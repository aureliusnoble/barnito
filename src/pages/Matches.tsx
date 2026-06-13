import { useMemo, useState } from "react";
import { LayoutGrid, Trophy } from "lucide-react";
import { useBarnito } from "../data/store";
import MatchCard from "../components/MatchCard";
import Bracket from "../components/Bracket";
import { formatDay } from "../lib/format";
import { GROUPS } from "@shared/constants";

type GroupFilter = "ALL" | (typeof GROUPS)[number];
type DayFilter = "ALL" | 1 | 2 | 3;

export default function Matches() {
  const { matches } = useBarnito();
  const [mode, setMode] = useState<"groups" | "knockouts">("groups");
  const [group, setGroup] = useState<GroupFilter>("ALL");
  const [matchday, setMatchday] = useState<DayFilter>("ALL");

  const filtered = useMemo(() => {
    return matches.matches
      .filter((m) => (group === "ALL" || m.group === group))
      .filter((m) => (matchday === "ALL" || m.matchday === matchday))
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  }, [matches, group, matchday]);

  // group by calendar day for headers
  const byDay = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const m of filtered) {
      const key = m.kickoff.slice(0, 10);
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
