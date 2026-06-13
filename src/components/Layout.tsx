import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useBarnito } from "../data/store";
import AirhornButton from "./AirhornButton";
import { MatchModalProvider } from "./MatchModal";

const NAV = [
  { to: "/", icon: "⚡", label: "Now", end: true },
  { to: "/matches", icon: "📅", label: "Matches" },
  { to: "/leaderboard", icon: "🏆", label: "Board" },
  { to: "/groups", icon: "📊", label: "Groups" },
  { to: "/scorers", icon: "⚽", label: "Scorers" },
  { to: "/spicy", icon: "🌶️", label: "Spicy" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { scores } = useBarnito();
  const updated = new Date(scores.updatedAt);

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col">
      <header className="sticky top-0 z-20 border-b border-pitch-800/60 bg-pitch-950/80 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-extrabold tracking-tight text-pitch-50">
              Barnito
            </span>
            <span className="text-lg">⚽</span>
          </div>
          <div className="text-right text-[10px] leading-tight text-pitch-400">
            <div>World Cup 2026</div>
            <div title={updated.toLocaleString()}>
              updated {updated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
                    ? "bg-pitch-600 text-white shadow"
                    : "text-pitch-300 hover:bg-pitch-800/60 hover:text-pitch-50"
                }`
              }
            >
              <span>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1 px-3 pb-28 pt-4 sm:px-4">
        <MatchModalProvider>{children}</MatchModalProvider>
      </main>

      {/* mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-pitch-800/60 bg-pitch-950/90 backdrop-blur-md sm:hidden">
        <div className="mx-auto grid max-w-3xl grid-cols-6">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition ${
                  isActive ? "text-pitch-50" : "text-pitch-400"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`text-lg ${isActive ? "scale-110" : ""} transition-transform`}>
                    {n.icon}
                  </span>
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <AirhornButton />
    </div>
  );
}
