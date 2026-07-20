// Match detail — everything the mock data can honestly show: team info (group
// position, form, power rank), the score and scorers, spice, everyone's revealed
// picks and token stakes. Timeline/lineups/stats need real match data (later).

import { useMemo } from "react";
import { MapPin } from "lucide-react";
import type { EFixture } from "../types";
import { PHASE_SHORT } from "../config";
import { useEuro } from "../store/store";
import { groupTable } from "../lib/table";
import { spiceLevel } from "../lib/spice";
import { fmtFull } from "../lib/format";
import { CountdownPill, Modal, PtsTag, SectionTitle, SpiceTag, TeamMark } from "../ui/kit";

type FormResult = "W" | "D" | "L";

function FormDots({ form }: { form: FormResult[] }) {
  const c: Record<FormResult, string> = { W: "bg-mint-400", D: "bg-ink-500", L: "bg-red-500" };
  if (form.length === 0) return <span className="text-ink-600">—</span>;
  return (
    <span className="flex gap-0.5">
      {form.slice(-4).map((r, i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${c[r]}`} title={r} />
      ))}
    </span>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-ink-400">{label}</span>
      <span className="font-semibold text-ink-100">{children}</span>
    </div>
  );
}

export default function FixtureModal({ fixture, onClose }: { fixture: EFixture; onClose: () => void }) {
  const { state, nowMs, teams, teamById, playerById, fixtureStarted, revealFixture, revealPhase, spiceOf, scoreOf } = useEuro();

  const home = fixture.homeTeamId ? teamById.get(fixture.homeTeamId) : undefined;
  const away = fixture.awayTeamId ? teamById.get(fixture.awayTeamId) : undefined;
  const finished = fixture.status === "FINISHED";
  const spice = finished ? 0 : spiceOf(fixture);

  // Form from finished mock results, chronological.
  const form = useMemo(() => {
    const map = new Map<string, FormResult[]>();
    for (const m of state.fixtures
      .filter((m) => m.status === "FINISHED" && m.homeGoals != null && m.awayGoals != null && m.homeTeamId && m.awayTeamId)
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff))) {
      const hr: FormResult = m.homeGoals! > m.awayGoals! ? "W" : m.homeGoals! < m.awayGoals! ? "L" : "D";
      const ar: FormResult = hr === "W" ? "L" : hr === "L" ? "W" : "D";
      map.set(m.homeTeamId!, [...(map.get(m.homeTeamId!) ?? []), hr]);
      map.set(m.awayTeamId!, [...(map.get(m.awayTeamId!) ?? []), ar]);
    }
    return map;
  }, [state.fixtures]);

  const powerRank = useMemo(() => {
    const sorted = [...teams].sort((a, b) => b.rating - a.rating);
    return new Map(sorted.map((t, i) => [t.id, i + 1]));
  }, [teams]);

  const groupPos = (teamId: string) => {
    const t = teamById.get(teamId);
    if (!t) return undefined;
    return groupTable(t.group, state.fixtures, teams).find((r) => r.teamId === teamId)?.pos;
  };

  const picks = useMemo(() => {
    if (!revealFixture(fixture)) return [];
    return state.users
      .filter((u) => !u.isAdmin)
      .map((u) => ({ user: u, pred: state.predictions[u.id]?.outcomes[fixture.id] }))
      .filter((x) => x.pred?.locked);
  }, [state, fixture, revealFixture]);

  const stakes = useMemo(() => {
    if (!revealPhase(fixture.phase)) return [];
    return state.users
      .filter((u) => !u.isAdmin)
      .flatMap((u) => {
        const tp = state.predictions[u.id]?.tokens[fixture.phase];
        if (!tp?.locked) return [];
        return tp.assigns
          .filter((a) => a.fixtureId === fixture.id)
          .map((a) => ({ user: u, a, line: scoreOf(u.id)?.tokenLines.find((l) => l.fixtureId === fixture.id && l.teamId === a.teamId) }));
      });
  }, [state, fixture, revealPhase, scoreOf]);

  const optionLabel = (o: "H" | "D" | "A") => (o === "H" ? home?.code ?? "H" : o === "A" ? away?.code ?? "A" : "DRAW");
  const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 10 > 3 || (n % 100 >= 11 && n % 100 <= 13) ? 0 : n % 10]}`;

  return (
    <Modal open onClose={onClose} title={`${home?.name ?? fixture.homeLabel ?? "TBD"} v ${away?.name ?? fixture.awayLabel ?? "TBD"}`}>
      {/* header */}
      <div className="flex items-center justify-center gap-2 text-[11px] text-ink-400">
        <span className="e-chip bg-white/[0.05] text-ink-300 ring-1 ring-white/[0.06]">
          {PHASE_SHORT[fixture.phase]}
          {fixture.group ? ` · Group ${fixture.group}` : ""}
        </span>
        <SpiceTag level={spiceLevel(spice)} />
        {finished ? (
          <span className="e-chip bg-white/[0.06] text-ink-200 ring-1 ring-white/[0.08]">Full time</span>
        ) : fixtureStarted(fixture) ? (
          <span className="e-chip bg-punch-500/15 text-punch-300 ring-1 ring-punch-500/25">Kicked off</span>
        ) : (
          <CountdownPill toIso={fixture.kickoff} nowMs={nowMs} />
        )}
      </div>
      {fixture.homeGoals != null && fixture.awayGoals != null && (
        <div className="text-center font-grotesk text-3xl font-extrabold text-white">
          {fixture.homeGoals}
          <span className="px-1.5 text-ink-600">–</span>
          {fixture.awayGoals}
        </div>
      )}
      {finished && fixture.penWinnerTeamId && (
        <p className="text-center text-xs text-punch-300">{teamById.get(fixture.penWinnerTeamId)?.name} win on penalties</p>
      )}
      <p className="flex items-center justify-center gap-1 text-center text-xs text-ink-400">
        {fmtFull(fixture.kickoff)} · <MapPin size={11} /> {fixture.venue}, {fixture.city}
      </p>

      {/* team info */}
      {home && away && (
        <div className="grid grid-cols-2 gap-2">
          {[home, away].map((t) => {
            const pos = groupPos(t.id);
            return (
              <div key={t.id} className="e-card space-y-1.5 p-3">
                <TeamMark team={t} size="sm" />
                <InfoRow label="Power rank">#{powerRank.get(t.id)} of 24</InfoRow>
                <InfoRow label="Group">{pos ? `${ordinal(pos)} in ${t.group}` : `Group ${t.group}`}</InfoRow>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-400">Form</span>
                  <FormDots form={form.get(t.id) ?? []} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* scorers */}
      {finished && fixture.scorers.length > 0 && (
        <div>
          <SectionTitle>Scorers</SectionTitle>
          <ul className="space-y-1 text-xs text-ink-200">
            {fixture.scorers.map((s, i) => {
              const p = playerById.get(s.playerId);
              const side = p && p.teamId === fixture.homeTeamId ? home : away;
              return (
                <li key={i} className="flex items-center justify-between">
                  <span>
                    ⚽ {p?.name ?? s.playerId}
                    {s.count > 1 ? ` ×${s.count}` : ""}
                  </span>
                  <span className="text-ink-500">{side?.code}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* everyone's picks */}
      <div>
        <SectionTitle hint={picks.length === 0 ? "hidden until kickoff" : undefined}>Predictions</SectionTitle>
        {picks.length === 0 ? (
          <p className="text-xs text-ink-500">🔒 Everyone's picks are revealed when the game kicks off.</p>
        ) : (
          <ul className="space-y-1">
            {picks.map(({ user, pred }) => {
              const line = scoreOf(user.id)?.outcomeLines.find((l) => l.fixtureId === fixture.id);
              return (
                <li key={user.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2 py-1 text-xs">
                  <span className="text-ink-200">
                    {user.emoji} {user.name}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="font-semibold text-white">{optionLabel(pred!.pick)}</span>
                    {finished && (line?.correct ? <PtsTag pts={line.points} /> : <span className="text-ink-500">0</span>)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* token stakes */}
      {stakes.length > 0 && (
        <div>
          <SectionTitle>Tokens riding on this</SectionTitle>
          <ul className="space-y-1">
            {stakes.map(({ user, a, line }, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2 py-1 text-xs">
                <span className="text-ink-200">
                  {user.emoji} {user.name} · {a.count}🪙 on {teamById.get(a.teamId)?.code ?? a.teamId}
                </span>
                {line ? <PtsTag pts={line.points} signed /> : <span className="text-ink-500">pending</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
