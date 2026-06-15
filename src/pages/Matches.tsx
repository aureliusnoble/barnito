import { useMemo, useState } from "react";
import { LayoutGrid, Trophy, ChevronDown } from "lucide-react";
import { useBarnito } from "../data/store";
import MatchCard from "../components/MatchCard";
import Bracket from "../components/Bracket";
import { formatDay, flagEmoji, footballDayKey } from "../lib/format";
import { GROUPS } from "@shared/constants";

type GroupFilter = "ALL" | (typeof GROUPS)[number];
type DayFilter = "ALL" | 1 | 2 | 3;
type WhenFilter = "ALL" | "future" | "past";

export default function Matches() {
  const { matches, teamById } = useBarnito();
  const [mode, setMode] = useState<"groups" | "knockouts">("groups");
  const [group, setGroup] = useState<GroupFilter>("ALL");
  const [matchday, setMatchday] = useState<DayFilter>("ALL");
  const [country, setCountry] = useState<string>("ALL");
  const [when, setWhen] = useState<WhenFilter>("ALL");

  const now = Date.now();

  // Countries that actually feature in the group-stage fixtures, sorted alphabetically.
  const countries = useMemo(() => {
    const ids = new Set<string>();
    for (const m of matches.matches) { ids.add(m.homeTeamId); ids.add(m.awayTeamId); }
    return [...ids]
      .map((id) => teamById.get(id))
      .filter((t): t is NonNullable<typeof t> => !!t)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [matches, teamById]);

  const filtered = useMemo(() => {
    const arr = matches.matches
      .filter((m) => (group === "ALL" || m.group === group))
      .filter((m) => (matchday === "ALL" || m.matchday === matchday))
      .filter((m) => (country === "ALL" || m.homeTeamId === country || m.awayTeamId === country))
      .filter((m) => {
        if (when === "ALL") return true;
        const started = Date.parse(m.kickoff) <= now;
        return when === "past" ? started : !started;
      });
    // newest-first for past games, chronological otherwise
    arr.sort((a, b) => (when === "past" ? b.kickoff.localeCompare(a.kickoff) : a.kickoff.localeCompare(b.kickoff)));
    return arr;
  }, [matches, group, matchday, country, when, now]);

  // group by "football day" (noon UK → noon UK) for headers
  const byDay = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const m of filtered) {
      const key = footballDayKey(m.kickoff);
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* group stage vs knockouts */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-pitch-900/70 p-1 ring-1 ring-white/[0.06]">
        {([["groups", "Group stage", LayoutGrid], ["knockouts", "Knockouts", Trophy]] as const).map(
          ([m, label, Icon]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-semibold transition ${
                mode === m ? "bg-accent-500 text-pitch-950" : "text-pitch-300 hover:text-white"
              }`}
            >
              <Icon size={14} strokeWidth={2.5} />
              {label}
            </button>
          ),
        )}
      </div>

      {mode === "knockouts" ? (
        <Bracket />
      ) : (
        <>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-xs font-semibold text-pitch-400">Country</span>
          <div className="relative flex-1">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full appearance-none rounded-lg bg-pitch-800/70 py-1.5 pl-3 pr-8 text-sm text-pitch-100 ring-1 ring-white/[0.06] transition focus:outline-none focus:ring-accent-500/40"
            >
              <option value="ALL">All countries</option>
              {countries.map((t) => (
                <option key={t.id} value={t.id}>{flagEmoji(t.name)} {t.name}</option>
              ))}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-pitch-400" />
          </div>
        </div>
        <Pills
          label="When"
          value={when}
          options={["ALL", "future", "past"]}
          onChange={(v) => setWhen(v as WhenFilter)}
          render={(v) => (v === "ALL" ? "All" : v === "future" ? "Upcoming" : "Past")}
        />
        <Pills
          label="Group"
          value={group}
          options={["ALL", ...GROUPS]}
          onChange={(v) => setGroup(v as GroupFilter)}
          render={(v) => (v === "ALL" ? "All" : v)}
        />
        <Pills
          label="Matchday"
          value={matchday}
          options={["ALL", 1, 2, 3]}
          onChange={(v) => setMatchday(v as DayFilter)}
          render={(v) => (v === "ALL" ? "All" : `MD ${v}`)}
        />
      </div>

      {byDay.length === 0 && (
        <p className="card p-6 text-center text-pitch-400">No matches for this filter.</p>
      )}

      {byDay.map(([day, ms]) => (
        <section key={day}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-pitch-400">
            {formatDay(day + "T12:00:00Z")}
          </h3>
          <div className="space-y-2">
            {ms.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </section>
      ))}
        </>
      )}
    </div>
  );
}

function Pills<T extends string | number>({
  label,
  value,
  options,
  onChange,
  render,
}: {
  label: string;
  value: T;
  options: T[];
  onChange: (v: T) => void;
  render: (v: T) => string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs font-semibold text-pitch-400">{label}</span>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {options.map((o) => (
          <button
            key={String(o)}
            onClick={() => onChange(o)}
            className={`chip whitespace-nowrap px-2.5 py-1 transition ${
              value === o
                ? "bg-pitch-600 text-white"
                : "bg-pitch-800/70 text-pitch-300 hover:text-white"
            }`}
          >
            {render(o)}
          </button>
        ))}
      </div>
    </div>
  );
}
