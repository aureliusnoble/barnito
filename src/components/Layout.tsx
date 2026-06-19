import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Radio, CalendarDays, Trophy, Table2, Goal, Flame, Puzzle } from "lucide-react";
import AirhornButton from "./AirhornButton";
import InstallBanner from "./InstallBanner";
import { MatchModalProvider } from "./MatchModal";
import { PlayerModalProvider } from "./PlayerModal";

const NAV = [
  { to: "/", icon: Radio, label: "Now", end: true },
  { to: "/matches", icon: CalendarDays, label: "Matches" },
  { to: "/leaderboard", icon: Trophy, label: "Board" },
  { to: "/groups", icon: Table2, label: "Groups" },
  { to: "/scorers", icon: Goal, label: "Scorers" },
  { to: "/spicy", icon: Flame, label: "Spicy" },
  { to: "/daily", icon: Puzzle, label: "Daily" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const loc = useLocation();

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col">
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-pitch-950/70 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent-500/15 text-lg ring-1 ring-accent-500/25">
              ⚽
            </span>
            <div className="leading-none">
              <div className="font-display text-xl font-extrabold tracking-tight text-white">
                Barnito
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-pitch-400">
                World Cup 2026
              </div>
            </div>
          </div>
        </div>
        {/* desktop nav */}
        <nav className="mt-3 hidden gap-1 sm:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-accent-500 text-pitch-950 shadow-glow"
                    : "text-pitch-300 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <n.icon size={15} strokeWidth={2.5} />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1 px-3 pb-28 pt-5 sm:px-4">
        {/* PlayerModal must wrap MatchModal so the match modal's lineup tokens can open player cards */}
        <PlayerModalProvider>
          <MatchModalProvider>
            <div key={loc.pathname} className="animate-slide-up">
              {children}
            </div>
          </MatchModalProvider>
        </PlayerModalProvider>
      </main>

      {/* mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/[0.06] bg-pitch-950/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden">
        <div className="mx-auto grid max-w-3xl grid-cols-7">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `relative flex min-h-[52px] flex-col items-center justify-center gap-1 text-[10px] font-semibold transition ${
                  isActive ? "text-accent-400" : "text-pitch-400 active:text-pitch-200"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute top-0 h-0.5 w-7 rounded-full bg-accent-400 animate-fade-in" />
                  )}
                  <n.icon
                    size={20}
                    strokeWidth={isActive ? 2.6 : 2}
                    className={`transition-transform ${isActive ? "-translate-y-px scale-110" : ""}`}
                  />
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <AirhornButton />
      <InstallBanner />
    </div>
  );
}
