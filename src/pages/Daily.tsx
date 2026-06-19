import { useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Puzzle, Info, X, Share2, Search, ChevronUp, ChevronDown } from "lucide-react";
import { useBarnito, useHelpers } from "../data/store";
import { Avatar } from "../components/visuals";
import { Crest } from "../components/bits";
import { usePersistentState } from "../lib/usePersistentState";
import { burstConfetti } from "../lib/confetti";
import type { Player } from "@shared/types";

// Confederation per World Cup nation — used for the "same championship" (yellow) on Nation.
const CONFED: Record<string, string> = {
  belgium: "UEFA", croatia: "UEFA", austria: "UEFA", scotland: "UEFA", norway: "UEFA",
  switzerland: "UEFA", turkiye: "UEFA", germany: "UEFA", england: "UEFA", france: "UEFA",
  spain: "UEFA", portugal: "UEFA", netherlands: "UEFA", czechia: "UEFA", "bosnia-and-herzegovina": "UEFA", sweden: "UEFA",
  brazil: "CONMEBOL", argentina: "CONMEBOL", uruguay: "CONMEBOL", colombia: "CONMEBOL", ecuador: "CONMEBOL", paraguay: "CONMEBOL",
  usa: "CONCACAF", mexico: "CONCACAF", canada: "CONCACAF", panama: "CONCACAF", haiti: "CONCACAF", curacao: "CONCACAF",
  morocco: "CAF", senegal: "CAF", tunisia: "CAF", algeria: "CAF", egypt: "CAF", ghana: "CAF",
  "ivory-coast": "CAF", "south-africa": "CAF", "cape-verde-islands": "CAF", "congo-dr": "CAF",
  japan: "AFC", "south-korea": "AFC", iran: "AFC", "saudi-arabia": "AFC", australia: "AFC",
  qatar: "AFC", uzbekistan: "AFC", iraq: "AFC", jordan: "AFC",
  "new-zealand": "OFC",
};

type Cell = { state: "g" | "y" | "r" | "n"; node: ReactNode };
const CELL_BG: Record<Cell["state"], string> = {
  g: "bg-emerald-600 text-white", y: "bg-amber-500 text-pitch-950", r: "bg-pitch-700 text-pitch-300", n: "bg-pitch-800 text-pitch-500",
};
const CELL_EMOJI: Record<Cell["state"], string> = { g: "🟩", y: "🟨", r: "🟥", n: "⬛" };
const COL_EMOJI = "🌍👕🛡️🎂⭐"; // Nation · Number · Club · Age · Rating — column key for the share card

// Numeric tile (age / rating) with an optional chevron pointing toward the answer (↑ = answer higher).
function numNode(value: ReactNode, dir: number): ReactNode {
  return (
    <span className="flex flex-col items-center justify-center leading-none">
      <span className="text-[11px] font-bold tabular-nums">{value}</span>
      {dir > 0 ? <ChevronUp size={9} strokeWidth={3} /> : dir < 0 ? <ChevronDown size={9} strokeWidth={3} /> : null}
    </span>
  );
}
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function ukToday(): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g("year")}-${g("month")}-${g("day")}`;
}
function seedFrom(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const MAX_GUESSES = 10;

export default function Daily() {
  const { roster, matchById, matches, playerById } = useBarnito();
  void matchById;
  const { teamName } = useHelpers();
  const today = ukToday();
  const [guesses, setGuesses] = usePersistentState<string[]>(`barnito.daily.v1.${today}`, []);
  const [query, setQuery] = useState("");
  const [showRules, setShowRules] = useState(false);
  const [copied, setCopied] = useState(false);

  // average World Cup match rating per player (for the Rating field)
  const ratingByPlayer = useMemo(() => {
    const agg = new Map<string, { s: number; n: number }>();
    for (const m of matches.matches) for (const r of m.ratings ?? []) {
      if (r.playerId && r.rating != null) { const a = agg.get(r.playerId) ?? { s: 0, n: 0 }; a.s += r.rating; a.n++; agg.set(r.playerId, a); }
    }
    const out = new Map<string, number>();
    for (const [k, v] of agg) out.set(k, v.s / v.n);
    return out;
  }, [matches]);

  // Answer pool: a Champions-League-pedigree player (the fame gate) with every field populated —
  // current club, age, and a World Cup rating (so the rating clue is always meaningful).
  const pool = useMemo(
    () => roster.players.filter((p) => p.ucl && p.club?.name && p.age != null && ratingByPlayer.has(p.id)),
    [roster.players, ratingByPlayer],
  );
  // Guesses: any actual World Cup squad member (age set by the squad endpoint).
  const guessPool = useMemo(() => roster.players.filter((p) => p.age != null), [roster.players]);
  // Pick the day's target by argmax of hash(date|id) — stable even if the pool grows/shrinks as
  // club data backfills (unlike `seed % length`, which would shift the answer mid-session).
  const target = useMemo(() => {
    let best: Player | undefined, bestH = -1;
    for (const p of pool) { const h = seedFrom(`${today}|${p.id}`); if (h > bestH) { bestH = h; best = p; } }
    return best;
  }, [pool, today]);
  // Barnito #1 = 19 Jun 2026 (launch day); increments each UK day after.
  const dayNo = Math.max(1, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse("2026-06-19T00:00:00Z")) / 86400000) + 1);

  const won = !!target && guesses.includes(target.id);
  const over = won || guesses.length >= MAX_GUESSES;

  const rating = (id: string) => ratingByPlayer.get(id);
  function compare(guess: Player): Cell[] {
    const t = target!;
    // Nation
    const nat: Cell = {
      state: guess.teamId === t.teamId ? "g" : CONFED[guess.teamId] && CONFED[guess.teamId] === CONFED[t.teamId] ? "y" : "r",
      node: <Crest teamId={guess.teamId} size={20} />,
    };
    // Number (green = same #, yellow = same position)
    const num: Cell = {
      state: guess.number != null && t.number != null && guess.number === t.number ? "g" : guess.position === t.position ? "y" : "r",
      node: <span className="text-[11px] font-bold tabular-nums">{guess.number ?? "–"}</span>,
    };
    // Club (green = same club, yellow = same league)
    const sameClub = !!guess.club?.name && guess.club.name === t.club?.name;
    const sameLeague = !!guess.club?.league && guess.club.league === t.club?.league;
    const club: Cell = {
      // unknown or non-pool league can never be the answer's club/league → red (not grey)
      state: sameClub ? "g" : sameLeague ? "y" : "r",
      node: guess.club?.logo ? <img src={guess.club.logo} alt="" className="h-5 w-5 object-contain" /> : <span className="text-[9px] font-bold">{guess.club?.name?.slice(0, 3) ?? "–"}</span>,
    };
    // Age (green exact, yellow within 2) — chevron points toward the answer
    const ageState: Cell["state"] = guess.age == null || t.age == null ? "n" : guess.age === t.age ? "g" : Math.abs(guess.age - t.age) <= 2 ? "y" : "r";
    const ageDir = ageState === "y" || ageState === "r" ? (t.age! > guess.age! ? 1 : -1) : 0;
    const age: Cell = { state: ageState, node: numNode(guess.age ?? "–", ageDir) };
    // WC rating (green within 0.2, yellow within 1) — chevron points toward the answer
    const rg = rating(guess.id), rt = target && rating(t.id);
    const ratingState: Cell["state"] = rg == null || rt == null ? "n" : Math.abs(rg - rt) <= 0.2 ? "g" : Math.abs(rg - rt) <= 1 ? "y" : "r";
    const ratingDir = (ratingState === "y" || ratingState === "r") && rg != null && rt != null ? (rt > rg ? 1 : -1) : 0;
    const ratingCell: Cell = { state: ratingState, node: numNode(rg != null ? rg.toFixed(1) : "–", ratingDir) };
    return [nat, num, club, age, ratingCell];
  }

  const suggestions = useMemo(() => {
    const q = norm(query.trim());
    if (q.length < 2 || over) return [];
    const made = new Set(guesses);
    return guessPool
      .filter((p) => !made.has(p.id) && norm(p.name).includes(q))
      .sort((a, b) => Number(norm(b.name).startsWith(q)) - Number(norm(a.name).startsWith(q)) || a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [query, guessPool, guesses, over]);

  const pick = (p: Player) => {
    if (over || !target) return;
    setQuery("");
    setGuesses([...guesses, p.id]);
    if (p.id === target.id) { burstConfetti(); try { void new Audio(`${import.meta.env.BASE_URL}airhorn.mp3`).play(); } catch { /* ignore */ } }
  };

  const share = () => {
    const grid = guesses.map((id) => compare(playerById.get(id)!).map((c) => CELL_EMOJI[c.state]).join("")).join("\n");
    const head = `Barnito ⚽ Daily #${dayNo} — ${won ? `${guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`}`;
    const text = `${head}\n${COL_EMOJI}\n${grid}\nhttps://aureliusnoble.github.io/barnito/#/daily`;
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => { /* ignore */ });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-white">
          <Puzzle size={18} className="text-accent-400" /> Daily player
        </h2>
        <button onClick={() => setShowRules(true)} className="grid h-9 w-9 place-items-center rounded-full bg-pitch-800 text-pitch-300 ring-1 ring-white/10 transition hover:text-accent-300" title="How to play">
          <Info size={17} />
        </button>
      </div>

      {!target ? (
        <p className="card p-6 text-center text-sm text-pitch-400">Today's player is warming up — check back in a moment.</p>
      ) : (
        <>
          <p className="-mt-1 text-sm text-pitch-400">
            Guess the mystery World Cup player in {MAX_GUESSES}. Each pick reveals how it compares.
          </p>

          {/* column headers */}
          <div className="grid grid-cols-[1fr_repeat(5,2.1rem)] items-center gap-1 px-1 text-[9px] font-semibold uppercase tracking-wide text-pitch-500 sm:grid-cols-[1fr_repeat(5,2.4rem)]">
            <span>Player</span>
            <span className="text-center">Nat</span>
            <span className="text-center">No.</span>
            <span className="text-center">Club</span>
            <span className="text-center">Age</span>
            <span className="text-center">Rtg</span>
          </div>

          {/* guesses */}
          <div className="space-y-1.5">
            {guesses.map((id) => {
              const p = playerById.get(id);
              if (!p) return null;
              const cells = compare(p);
              const hit = p.id === target.id;
              return (
                <div key={id} className={`grid grid-cols-[1fr_repeat(5,2.1rem)] items-center gap-1 rounded-xl p-1 sm:grid-cols-[1fr_repeat(5,2.4rem)] ${hit ? "ring-1 ring-emerald-500/40" : ""}`}>
                  <span className="flex min-w-0 items-center gap-1.5 pl-0.5">
                    <Avatar photo={p.photo} name={p.name} position={p.position} size={24} />
                    <span className="truncate text-xs font-semibold text-pitch-100">{p.name}</span>
                  </span>
                  {cells.map((c, i) => (
                    <span key={i} className={`grid aspect-square place-items-center rounded-md ${CELL_BG[c.state]}`}>{c.node}</span>
                  ))}
                </div>
              );
            })}
            {/* empty slots */}
            {!over && Array.from({ length: Math.max(0, 1) }).map((_, i) => <div key={`slot${i}`} className="h-1" />)}
          </div>

          {/* input */}
          {!over && (
            <div className="relative">
              <div className="flex items-center gap-2 rounded-xl bg-pitch-900 px-3 py-2 ring-1 ring-white/10 focus-within:ring-accent-500/40">
                <Search size={16} className="shrink-0 text-pitch-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type a World Cup player…"
                  className="w-full bg-transparent text-sm text-pitch-100 placeholder:text-pitch-500 focus:outline-none"
                />
                <span className="shrink-0 text-[11px] font-semibold text-pitch-500">{guesses.length}/{MAX_GUESSES}</span>
              </div>
              {query.trim().length >= 2 && (
                <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-white/10 bg-pitch-900 shadow-xl">
                  {suggestions.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-pitch-500">No World Cup player matches “{query.trim()}”.</p>
                  ) : (
                    suggestions.map((p) => (
                      <button key={p.id} onClick={() => pick(p)} className="flex w-full items-center gap-2.5 border-b border-white/[0.05] px-3 py-2 text-left last:border-0 hover:bg-white/[0.04]">
                        <Avatar photo={p.photo} name={p.name} position={p.position} size={26} />
                        <span className="min-w-0 flex-1 truncate text-sm text-pitch-100">{p.name}</span>
                        <Crest teamId={p.teamId} size={14} />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* result */}
          {over && (
            <div className={`card p-4 text-center ${won ? "ring-1 ring-emerald-500/30" : ""}`}>
              <div className="mb-2 text-3xl">{won ? "🎉" : "😵"}</div>
              <p className="font-display text-lg font-bold text-white">
                {won ? `Got it in ${guesses.length}!` : "Out of guesses"}
              </p>
              <div className="mt-2 flex items-center justify-center gap-2 text-sm text-pitch-200">
                <Avatar photo={target.photo} name={target.name} position={target.position} size={28} />
                <span className="font-semibold text-white">{target.name}</span>
                <Crest teamId={target.teamId} size={15} />
                <span className="text-pitch-400">{teamName(target.teamId)}</span>
              </div>
              <button onClick={share} className="mx-auto mt-3 flex items-center gap-2 rounded-full bg-accent-500 px-4 py-2 text-sm font-bold text-pitch-950 transition active:scale-95">
                <Share2 size={15} /> {copied ? "Copied!" : "Share result"}
              </button>
              <p className="mt-2 text-xs text-pitch-500">Next player at midnight (UK).</p>
            </div>
          )}
        </>
      )}

      {showRules && <RulesCard onClose={() => setShowRules(false)} />}
    </div>
  );
}

function RulesCard({ onClose }: { onClose: () => void }) {
  const Row = ({ label, green, yellow }: { label: string; green: string; yellow: string }) => (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="w-12 shrink-0 font-semibold text-pitch-100">{label}</span>
      <span className="text-emerald-400">🟩 {green}</span>
      <span className="text-amber-400">🟨 {yellow}</span>
    </li>
  );
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-fade-in sm:items-center" onClick={onClose}>
      <div className="card max-h-[88vh] w-full max-w-sm animate-slide-up overflow-y-auto rounded-b-none rounded-t-4xl border-white/10 p-5 sm:rounded-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-white">How to play</h3>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full bg-white/5 text-pitch-300 hover:bg-white/10 hover:text-white"><X size={16} /></button>
        </div>
        <p className="text-sm text-pitch-300">
          Guess the mystery player in up to <b className="text-white">10</b> tries. You can guess
          <b className="text-white"> any player at this World Cup</b>; each pick locks in and shows how its fields compare:
        </p>
        <ul className="mt-3 space-y-2 text-[13px] text-pitch-300">
          <Row label="Nation" green="same nation" yellow="same confederation" />
          <Row label="No." green="same shirt number" yellow="same position" />
          <Row label="Club" green="same club" yellow="same league" />
          <Row label="Age" green="exact" yellow="within 2 years" />
          <Row label="Rating" green="within 0.2" yellow="within 1" />
        </ul>
        <p className="mt-3 text-xs text-pitch-500">
          <b className="text-pitch-300">Rating</b> is a player's average match rating so far at this World Cup. 🟥 = no match · ⬛ = unknown
          (e.g. a player who hasn't played yet). ↑/↓ on Age & Rating point toward the answer. A fresh player appears every day at midnight UK time.
        </p>
      </div>
    </div>,
    document.body,
  );
}
