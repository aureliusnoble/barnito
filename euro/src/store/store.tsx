// The whole mock backend: one localStorage blob, a React context, and every
// action the game needs. Locks snapshot odds at the moment of locking and are
// permanent (admin can unlock for testing). Only locked predictions score.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  Euro28State,
  EUser,
  EPhase,
  EFixture,
  ETeam,
  EPlayer,
  Outcome,
  OutcomeOdds,
  ScorerLine,
  TokenAssign,
  UserPredictions,
  UserScore,
} from "../types";
import { ADMIN_PIN, PHASES, SCORER_PICKS, STORAGE_KEY, TOKENS_BY_PHASE } from "../config";
import { TEAMS } from "../data/teams";
import { FORWARDS } from "../data/players";
import { BASE_FIXTURES } from "../data/fixtures";
import { outcomeOdds, scorerOdds, marginSpread, marginOutlook, outrightOdds, type MarginOutlook } from "../lib/odds";
import { computeScores } from "../lib/scoring";
import { fixtureSpice } from "../lib/spice";
import { advanceBracket, groupsComplete, winnerOf } from "../lib/bracket";
import { hash32, mulberry32 } from "../lib/rng";

// ---------------------------------------------------------------------------

const SEED_USERS: EUser[] = [
  { id: "admin", name: "Admin", isAdmin: true, pin: ADMIN_PIN, emoji: "🛠️" },
  { id: "aurelius", name: "Aurelius", isAdmin: false, emoji: "🦅" },
  { id: "sarah", name: "Sarah", isAdmin: false, emoji: "🌟" },
  { id: "stuart", name: "Stuart", isAdmin: false, emoji: "🎯" },
  { id: "will", name: "Will Guess Football Good", isAdmin: false, emoji: "🔮" },
  { id: "8azil", name: "8azil", isAdmin: false, emoji: "🎱" },
  { id: "javier", name: "Javier Barndembo", isAdmin: false, emoji: "🌶️" },
  { id: "robsonaldo", name: "Robsonaldo", isAdmin: false, emoji: "👟" },
];

const emptyPredictions = (): UserPredictions => ({ outcomes: {}, scorers: {}, tokens: {}, champion: null });

function freshState(): Euro28State {
  return {
    version: 2,
    users: SEED_USERS,
    sessionUserId: null,
    fixtures: BASE_FIXTURES.map((f) => ({ ...f, scorers: [...f.scorers] })),
    predictions: Object.fromEntries(SEED_USERS.map((u) => [u.id, emptyPredictions()])),
    admin: { simNow: null },
  };
}

function loadState(): Euro28State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as Euro28State;
    if (parsed.version !== 2 || !Array.isArray(parsed.fixtures)) return freshState();
    for (const u of parsed.users) if (!parsed.predictions[u.id]) parsed.predictions[u.id] = emptyPredictions();
    return parsed;
  } catch {
    return freshState();
  }
}

// ---------------------------------------------------------------------------

export interface StoreApi {
  state: Euro28State;
  me: EUser | null;
  isAdmin: boolean;
  nowMs: number;

  teams: ETeam[];
  forwards: EPlayer[];
  teamById: Map<string, ETeam>;
  playerById: Map<string, EPlayer>;
  fixtureById: Map<string, EFixture>;
  scores: UserScore[];
  scoreOf: (userId: string) => UserScore | undefined;

  phaseFirstKickoff: (phase: EPhase) => number;
  phaseTeamsKnown: (phase: EPhase) => boolean;
  fixtureStarted: (f: EFixture) => boolean;
  canPredictFixture: (f: EFixture) => boolean;
  canLockPhase: (phase: EPhase) => boolean;
  revealFixture: (f: EFixture) => boolean;
  revealPhase: (phase: EPhase) => boolean;

  oddsFor: (f: EFixture) => OutcomeOdds | null;
  /** Frozen-at-lock market spread (expected margin, signed) for a team in a fixture. */
  spreadFor: (f: EFixture, teamId: string) => number | null;
  /** Cover probability + typical win/loss distances for a token on this team. */
  marginOutlookFor: (f: EFixture, teamId: string) => MarginOutlook | null;
  /** Round-relative leaderboard-swing rating for a fixture (0 sleepy … 2+ table-shaker). */
  spiceOf: (f: EFixture) => number;
  scorerOddsFor: (p: EPlayer, phase: EPhase) => { prob: number; odds: number };
  outright: Map<string, { prob: number; odds: number }>;

  signIn: (userId: string, pin?: string) => string | null;
  signOut: () => void;

  setOutcomeDraft: (fid: string, pick: Outcome) => string | null;
  clearOutcomeDraft: (fid: string) => void;
  lockOutcome: (fid: string) => string | null;
  /** Lock every unlocked outcome draft in a phase at current odds. Returns error or null. */
  lockAllOutcomes: (phase: EPhase) => string | null;
  setScorerDraft: (phase: EPhase, playerIds: string[]) => string | null;
  lockScorers: (phase: EPhase) => string | null;
  setTokenDraft: (phase: EPhase, assigns: TokenAssign[]) => string | null;
  lockTokens: (phase: EPhase) => string | null;
  setChampionDraft: (teamId: string) => string | null;
  lockChampion: () => string | null;

  adminSetSimNow: (iso: string | null) => void;
  adminSetResult: (
    fid: string,
    res: { homeGoals: number; awayGoals: number; scorers: ScorerLine[]; penWinnerTeamId?: string | null },
  ) => string | null;
  adminClearResult: (fid: string) => void;
  adminSimulateFixture: (fid: string) => void;
  adminSimulatePhase: (phase: EPhase) => void;
  adminSimulateAll: () => void;
  adminUnlock: (userId: string, kind: "outcome" | "scorers" | "tokens" | "champion", key?: string) => void;
  adminSeedDemo: () => void;
  adminReset: () => void;
}

const Ctx = createContext<StoreApi | null>(null);

export function useEuro(): StoreApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useEuro outside provider");
  return api;
}

// ---------------------------------------------------------------------------

export function EuroProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Euro28State>(loadState);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const api = useMemo<StoreApi>(() => {
    void tick;
    const nowMs = state.admin.simNow ? Date.parse(state.admin.simNow) : Date.now();
    const me = state.users.find((u) => u.id === state.sessionUserId) ?? null;
    const isAdmin = !!me?.isAdmin;
    const teamById = new Map(TEAMS.map((t) => [t.id, t]));
    const playerById = new Map(FORWARDS.map((p) => [p.id, p]));
    const fixtureById = new Map(state.fixtures.map((f) => [f.id, f]));
    const scores = computeScores(state, TEAMS);

    const phaseFixtures = (phase: EPhase) => state.fixtures.filter((f) => f.phase === phase);
    const phaseFirstKickoff = (phase: EPhase) =>
      Math.min(...phaseFixtures(phase).map((f) => Date.parse(f.kickoff)));
    const phaseTeamsKnown = (phase: EPhase) =>
      phaseFixtures(phase).every((f) => !!f.homeTeamId && !!f.awayTeamId);
    const fixtureStarted = (f: EFixture) => nowMs >= Date.parse(f.kickoff);
    // A round's match picks ALL close when the round's first game kicks off.
    const canPredictFixture = (f: EFixture) => !!f.homeTeamId && !!f.awayTeamId && nowMs < phaseFirstKickoff(f.phase);
    const canLockPhase = (phase: EPhase) => phaseTeamsKnown(phase) && nowMs < phaseFirstKickoff(phase);

    const oddsFor = (f: EFixture): OutcomeOdds | null => {
      const h = f.homeTeamId && teamById.get(f.homeTeamId);
      const a = f.awayTeamId && teamById.get(f.awayTeamId);
      if (!h || !a) return null;
      return outcomeOdds(f, h, a, nowMs);
    };
    const spreadFor = (f: EFixture, teamId: string) => {
      const h = f.homeTeamId && teamById.get(f.homeTeamId);
      const a = f.awayTeamId && teamById.get(f.awayTeamId);
      if (!h || !a) return null;
      return marginSpread(f, h, a, teamId, nowMs);
    };
    const marginOutlookFor = (f: EFixture, teamId: string) => {
      const h = f.homeTeamId && teamById.get(f.homeTeamId);
      const a = f.awayTeamId && teamById.get(f.awayTeamId);
      if (!h || !a) return null;
      return marginOutlook(f, h, a, teamId, nowMs);
    };
    const scorerOddsFor = (p: EPlayer, phase: EPhase) =>
      scorerOdds(p, teamById.get(p.teamId)!, phase, nowMs);

    // --- mutation helpers ---------------------------------------------------
    const mutate = (fn: (draft: Euro28State) => void) =>
      setState((prev) => {
        const next: Euro28State = JSON.parse(JSON.stringify(prev));
        fn(next);
        return next;
      });
    const myPreds = (draft: Euro28State): UserPredictions | null =>
      me ? (draft.predictions[me.id] ??= emptyPredictions()) : null;

    // Fill any knockout slots that new results determine (no-op when nothing new).
    const reAdvance = (draft: Euro28State) => {
      draft.fixtures = advanceBracket(draft.fixtures, TEAMS);
    };

    // --- simulation ---------------------------------------------------------
    const simulate = (draft: Euro28State, fid: string) => {
      const f = draft.fixtures.find((x) => x.id === fid);
      if (!f || !f.homeTeamId || !f.awayTeamId) return;
      const h = teamById.get(f.homeTeamId)!;
      const a = teamById.get(f.awayTeamId)!;
      const rng = mulberry32(hash32(`${fid}|${draft.admin.simNow ?? ""}|${Date.now()}`));
      const o = outcomeOdds(f, h, a, Date.parse(f.kickoff));
      const r = rng();
      const outcome: Outcome = r < o.probs.H ? "H" : r < o.probs.H + o.probs.D ? "D" : "A";
      const winGoals = 1 + Math.floor(rng() * 3) + (rng() < 0.15 ? 1 : 0); // 1..4
      const loseGoals = Math.max(0, winGoals - 1 - Math.floor(rng() * 3)); // 0..winGoals-1
      const drawGoals = Math.floor(rng() * 3); // 0..2
      let hg: number, ag: number;
      if (outcome === "H") [hg, ag] = [winGoals, loseGoals];
      else if (outcome === "A") [hg, ag] = [loseGoals, winGoals];
      else [hg, ag] = [drawGoals, drawGoals];
      const credit = (teamId: string, n: number): ScorerLine[] => {
        const fw = FORWARDS.filter((p) => p.teamId === teamId);
        const lines = new Map<string, number>();
        for (let i = 0; i < n; i++) {
          const weights = fw.map((p) => Math.pow(p.rating - 55, 2));
          const total = weights.reduce((x, y) => x + y, 0);
          let pick = fw[0];
          let acc = 0;
          const target = rng() * total;
          for (let j = 0; j < fw.length; j++) {
            acc += weights[j];
            if (target <= acc) { pick = fw[j]; break; }
          }
          if (pick) lines.set(pick.id, (lines.get(pick.id) ?? 0) + 1);
        }
        return [...lines.entries()].map(([playerId, count]) => ({ playerId, count }));
      };
      f.homeGoals = hg;
      f.awayGoals = ag;
      f.scorers = [...credit(f.homeTeamId, hg), ...credit(f.awayTeamId, ag)];
      f.status = "FINISHED";
      f.penWinnerTeamId =
        f.phase !== "group" && hg === ag ? (rng() < o.probs.H / (o.probs.H + o.probs.A) ? f.homeTeamId : f.awayTeamId) : null;
    };

    // Locks a full set of demo picks for every non-admin user, for every phase
    // whose teams are currently known and not yet locked by that user.
    const seedDemo = (draft: Euro28State) => {
      const known = PHASES.filter((ph) =>
        draft.fixtures.filter((f) => f.phase === ph).every((f) => f.homeTeamId && f.awayTeamId),
      );
      const outrights = outrightOdds(TEAMS, nowMs);
      for (const u of draft.users) {
        if (u.isAdmin) continue;
        const rng = mulberry32(hash32(`seed|${u.id}`));
        const p = (draft.predictions[u.id] ??= emptyPredictions());
        // champion
        if (!p.champion?.locked) {
          const pool = [...TEAMS].sort((a, b) => b.rating - a.rating).slice(0, 8);
          const teamId = pool[Math.floor(rng() * pool.length)].id;
          p.champion = { teamId, locked: true, lockedAt: new Date(nowMs).toISOString(), outrightOdds: outrights.get(teamId)?.odds };
        }
        for (const ph of known) {
          const fxs = draft.fixtures.filter((f) => f.phase === ph);
          const at = Math.min(...fxs.map((f) => Date.parse(f.kickoff))) - 3 * 3600_000;
          // outcomes for every fixture of the phase
          for (const f of fxs) {
            if (p.outcomes[f.id]?.locked) continue;
            const h = teamById.get(f.homeTeamId!)!;
            const a = teamById.get(f.awayTeamId!)!;
            const o = outcomeOdds(f, h, a, at);
            const r = rng();
            // Favour the model but keep personality: 70% pick favourite, else underdog/draw.
            const fav: Outcome = o.probs.H >= o.probs.A ? "H" : "A";
            const dog: Outcome = fav === "H" ? "A" : "H";
            const pick: Outcome = r < 0.62 ? fav : r < 0.8 ? dog : "D";
            p.outcomes[f.id] = { pick, locked: true, lockedAt: new Date(at).toISOString(), odds: o.odds[pick], prob: o.probs[pick] };
          }
          // scorer picks
          if (!p.scorers[ph]?.locked) {
            const teamsIn = new Set(fxs.flatMap((f) => [f.homeTeamId!, f.awayTeamId!]));
            const pool = FORWARDS.filter((x) => teamsIn.has(x.teamId)).sort((a, b) => b.rating - a.rating).slice(0, 24);
            const picks: string[] = [];
            while (picks.length < SCORER_PICKS[ph] && pool.length) {
              const i = Math.floor(Math.pow(rng(), 1.6) * pool.length);
              const [chosen] = pool.splice(i, 1);
              picks.push(chosen.id);
            }
            const oddsByPlayer: Record<string, number> = {};
            for (const pid of picks) {
              const pl = playerById.get(pid)!;
              oddsByPlayer[pid] = scorerOdds(pl, teamById.get(pl.teamId)!, ph, at).odds;
            }
            p.scorers[ph] = { playerIds: picks, locked: true, lockedAt: new Date(at).toISOString(), oddsByPlayer };
          }
          // tokens: spread over random fixtures, mostly favourites
          if (!p.tokens[ph]?.locked) {
            let left = TOKENS_BY_PHASE[ph];
            const assigns: TokenAssign[] = [];
            const spreadByAssign: Record<string, number> = {};
            const shuffled = [...fxs].sort(() => rng() - 0.5);
            for (const f of shuffled) {
              if (left <= 0) break;
              const n = Math.min(left, 1 + Math.floor(rng() * 2));
              const h = teamById.get(f.homeTeamId!)!;
              const a = teamById.get(f.awayTeamId!)!;
              const team = (rng() < 0.7 ? (h.rating >= a.rating ? h : a) : h.rating >= a.rating ? a : h).id;
              assigns.push({ fixtureId: f.id, teamId: team, count: n });
              spreadByAssign[`${f.id}:${team}`] = marginSpread(f, h, a, team, at);
              left -= n;
            }
            p.tokens[ph] = { assigns, locked: true, lockedAt: new Date(at).toISOString(), spreadByAssign };
          }
        }
      }
    };

    return {
      state,
      me,
      isAdmin,
      nowMs,
      teams: TEAMS,
      forwards: FORWARDS,
      teamById,
      playerById,
      fixtureById,
      scores,
      scoreOf: (userId) => scores.find((s) => s.userId === userId),

      phaseFirstKickoff,
      phaseTeamsKnown,
      fixtureStarted,
      canPredictFixture,
      canLockPhase,
      revealFixture: (f) => isAdmin || fixtureStarted(f),
      revealPhase: (phase) => isAdmin || nowMs >= phaseFirstKickoff(phase),

      oddsFor,
      spreadFor,
      marginOutlookFor,
      spiceOf: (f) => fixtureSpice(state, teamById, f),
      scorerOddsFor,
      outright: outrightOdds(TEAMS, nowMs),

      signIn: (userId, pin) => {
        const u = state.users.find((x) => x.id === userId);
        if (!u) return "Unknown account.";
        if (u.pin && pin !== u.pin) return "Wrong PIN.";
        mutate((d) => { d.sessionUserId = userId; });
        return null;
      },
      signOut: () => mutate((d) => { d.sessionUserId = null; }),

      setOutcomeDraft: (fid, pick) => {
        const f = fixtureById.get(fid);
        if (!me) return "Sign in first.";
        if (!f) return "Unknown fixture.";
        if (!canPredictFixture(f)) return "Predictions are closed for this match.";
        const existing = state.predictions[me.id]?.outcomes[fid];
        if (existing?.locked) return "Already locked — locks are permanent.";
        mutate((d) => { const p = myPreds(d)!; p.outcomes[fid] = { pick, locked: false }; });
        return null;
      },
      clearOutcomeDraft: (fid) =>
        mutate((d) => {
          const p = myPreds(d);
          if (p && !p.outcomes[fid]?.locked) delete p.outcomes[fid];
        }),
      lockOutcome: (fid) => {
        const f = fixtureById.get(fid);
        if (!me) return "Sign in first.";
        if (!f) return "Unknown fixture.";
        if (!canPredictFixture(f)) return "Too late — this round's picks are closed.";
        const pred = state.predictions[me.id]?.outcomes[fid];
        if (!pred) return "Pick an outcome first.";
        if (pred.locked) return "Already locked.";
        const o = oddsFor(f);
        if (!o) return "No odds available.";
        mutate((d) => {
          const p = myPreds(d)!;
          p.outcomes[fid] = {
            pick: pred.pick,
            locked: true,
            lockedAt: new Date(nowMs).toISOString(),
            odds: o.odds[pred.pick],
            prob: o.probs[pred.pick],
          };
        });
        return null;
      },

      lockAllOutcomes: (phase) => {
        if (!me) return "Sign in first.";
        const preds = state.predictions[me.id]?.outcomes ?? {};
        const targets = state.fixtures.filter(
          (f) => f.phase === phase && canPredictFixture(f) && preds[f.id] && !preds[f.id].locked,
        );
        if (targets.length === 0) return "No unlocked picks to lock in this round.";
        const snaps: Record<string, { pick: Outcome; odds: number; prob: number }> = {};
        for (const f of targets) {
          const o = oddsFor(f);
          if (!o) return "No odds available.";
          const pick = preds[f.id].pick;
          snaps[f.id] = { pick, odds: o.odds[pick], prob: o.probs[pick] };
        }
        mutate((d) => {
          const p = myPreds(d)!;
          for (const [fid, snap] of Object.entries(snaps)) {
            p.outcomes[fid] = { pick: snap.pick, locked: true, lockedAt: new Date(nowMs).toISOString(), odds: snap.odds, prob: snap.prob };
          }
        });
        return null;
      },

      setScorerDraft: (phase, playerIds) => {
        if (!me) return "Sign in first.";
        if (!canLockPhase(phase)) return "This round's picks are closed.";
        if (state.predictions[me.id]?.scorers[phase]?.locked) return "Already locked.";
        const uniq = [...new Set(playerIds)];
        if (uniq.length > SCORER_PICKS[phase]) return `Max ${SCORER_PICKS[phase]} picks for this round.`;
        if (uniq.some((id) => !playerById.has(id))) return "Forwards only.";
        mutate((d) => { const p = myPreds(d)!; p.scorers[phase] = { playerIds: uniq, locked: false }; });
        return null;
      },
      lockScorers: (phase) => {
        if (!me) return "Sign in first.";
        if (!canLockPhase(phase)) return "This round's picks are closed.";
        const sp = state.predictions[me.id]?.scorers[phase];
        if (!sp) return "Pick your forwards first.";
        if (sp.locked) return "Already locked.";
        if (sp.playerIds.length !== SCORER_PICKS[phase])
          return `Pick exactly ${SCORER_PICKS[phase]} forwards to lock.`;
        const oddsByPlayer: Record<string, number> = {};
        for (const pid of sp.playerIds) {
          const pl = playerById.get(pid)!;
          oddsByPlayer[pid] = scorerOddsFor(pl, phase).odds;
        }
        mutate((d) => {
          const p = myPreds(d)!;
          p.scorers[phase] = { playerIds: sp.playerIds, locked: true, lockedAt: new Date(nowMs).toISOString(), oddsByPlayer };
        });
        return null;
      },

      setTokenDraft: (phase, assigns) => {
        if (!me) return "Sign in first.";
        if (!canLockPhase(phase)) return "This round's tokens are closed.";
        if (state.predictions[me.id]?.tokens[phase]?.locked) return "Already locked.";
        const total = assigns.reduce((a, b) => a + b.count, 0);
        if (total > TOKENS_BY_PHASE[phase]) return `Only ${TOKENS_BY_PHASE[phase]} tokens this round.`;
        for (const a of assigns) {
          const f = fixtureById.get(a.fixtureId);
          if (!f || f.phase !== phase) return "Token on an invalid match.";
          if (a.teamId !== f.homeTeamId && a.teamId !== f.awayTeamId) return "Token on a team not in that match.";
          if (a.count < 1) return "Tokens must be positive.";
        }
        mutate((d) => { const p = myPreds(d)!; p.tokens[phase] = { assigns, locked: false }; });
        return null;
      },
      lockTokens: (phase) => {
        if (!me) return "Sign in first.";
        if (!canLockPhase(phase)) return "This round's tokens are closed.";
        const tp = state.predictions[me.id]?.tokens[phase];
        if (!tp) return "Assign some tokens first.";
        if (tp.locked) return "Already locked.";
        if (tp.assigns.length === 0) return "Assign at least one token.";
        const spreadByAssign: Record<string, number> = {};
        for (const a of tp.assigns) {
          const f = fixtureById.get(a.fixtureId)!;
          const sp = spreadFor(f, a.teamId);
          if (sp == null) return "No spread available.";
          spreadByAssign[`${a.fixtureId}:${a.teamId}`] = sp;
        }
        mutate((d) => {
          const p = myPreds(d)!;
          p.tokens[phase] = { assigns: tp.assigns, locked: true, lockedAt: new Date(nowMs).toISOString(), spreadByAssign };
        });
        return null;
      },

      setChampionDraft: (teamId) => {
        if (!me) return "Sign in first.";
        if (nowMs >= phaseFirstKickoff("group")) return "The tournament has started — champion picks are closed.";
        if (state.predictions[me.id]?.champion?.locked) return "Already locked.";
        if (!teamById.has(teamId)) return "Unknown team.";
        mutate((d) => { const p = myPreds(d)!; p.champion = { teamId, locked: false }; });
        return null;
      },
      lockChampion: () => {
        if (!me) return "Sign in first.";
        if (nowMs >= phaseFirstKickoff("group")) return "The tournament has started — champion picks are closed.";
        const c = state.predictions[me.id]?.champion;
        if (!c) return "Pick a team first.";
        if (c.locked) return "Already locked.";
        const o = outrightOdds(TEAMS, nowMs).get(c.teamId);
        mutate((d) => {
          const p = myPreds(d)!;
          p.champion = { teamId: c.teamId, locked: true, lockedAt: new Date(nowMs).toISOString(), outrightOdds: o?.odds };
        });
        return null;
      },

      adminSetSimNow: (iso) => mutate((d) => { d.admin.simNow = iso; }),
      adminSetResult: (fid, res) => {
        const f = fixtureById.get(fid);
        if (!f) return "Unknown fixture.";
        if (!f.homeTeamId || !f.awayTeamId) return "Teams not set yet.";
        if (f.phase !== "group" && res.homeGoals === res.awayGoals && !res.penWinnerTeamId)
          return "Drawn knockout needs a shootout winner.";
        mutate((d) => {
          const df = d.fixtures.find((x) => x.id === fid)!;
          df.homeGoals = res.homeGoals;
          df.awayGoals = res.awayGoals;
          df.scorers = res.scorers;
          df.status = "FINISHED";
          df.penWinnerTeamId = f.phase !== "group" && res.homeGoals === res.awayGoals ? res.penWinnerTeamId : null;
          reAdvance(d);
        });
        return null;
      },
      adminClearResult: (fid) =>
        mutate((d) => {
          const df = d.fixtures.find((x) => x.id === fid);
          if (!df) return;
          df.status = "SCHEDULED";
          df.homeGoals = null;
          df.awayGoals = null;
          df.scorers = [];
          df.penWinnerTeamId = null;
          // Downstream knockout slots may now be stale: re-derive every unfinished slot.
          for (const f of d.fixtures) {
            if (f.phase !== "group" && f.status !== "FINISHED") {
              f.homeTeamId = null;
              f.awayTeamId = null;
            }
          }
          reAdvance(d);
        }),
      adminSimulateFixture: (fid) => mutate((d) => { simulate(d, fid); reAdvance(d); }),
      adminSimulatePhase: (phase) =>
        mutate((d) => {
          for (const f of d.fixtures.filter((x) => x.phase === phase && x.status !== "FINISHED")) simulate(d, f.id);
          reAdvance(d);
        }),
      adminSimulateAll: () =>
        mutate((d) => {
          seedDemo(d); // lock in any missing picks for phases currently known
          for (const ph of PHASES) {
            for (const f of d.fixtures.filter((x) => x.phase === ph && x.status !== "FINISHED")) simulate(d, f.id);
            reAdvance(d);
            seedDemo(d); // newly-known rounds get picks before they're simulated
          }
        }),
      adminUnlock: (userId, kind, key) =>
        mutate((d) => {
          const p = d.predictions[userId];
          if (!p) return;
          if (kind === "outcome" && key) { const o = p.outcomes[key]; if (o) o.locked = false; }
          if (kind === "scorers" && key) { const s = p.scorers[key as EPhase]; if (s) s.locked = false; }
          if (kind === "tokens" && key) { const t = p.tokens[key as EPhase]; if (t) t.locked = false; }
          if (kind === "champion" && p.champion) p.champion.locked = false;
        }),
      adminSeedDemo: () => mutate((d) => seedDemo(d)),
      adminReset: () =>
        setState(() => {
          const s = freshState();
          s.sessionUserId = state.sessionUserId;
          return s;
        }),
    };
  }, [state, tick]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

// Re-export bits pages regularly need alongside the hook.
export { groupsComplete, winnerOf };
