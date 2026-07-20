import { HashRouter, Routes, Route, NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Zap, Target, Trophy, Menu, ShieldCheck, LogOut, BookOpen, Wrench } from "lucide-react";
import { EuroProvider, useEuro } from "./store/store";
import { ToastProvider, Tabs } from "./ui/kit";
import { fmtPts } from "./lib/format";
import SignIn from "./pages/SignIn";
import Home from "./pages/Home";
import Matches from "./pages/Matches";
import Scorers from "./pages/Scorers";
import Tokens from "./pages/Tokens";
import Champion from "./pages/Champion";
import Leaderboard from "./pages/Leaderboard";
import Tournament from "./pages/Tournament";
import Rules from "./pages/Rules";
import Admin from "./pages/Admin";

function PicksHub() {
  const loc = useLocation();
  const nav = useNavigate();
  const cur = loc.pathname.includes("scorers")
    ? "scorers"
    : loc.pathname.includes("tokens")
      ? "tokens"
      : loc.pathname.includes("champion")
        ? "champion"
        : "matches";
  return (
    <div className="space-y-4">
      <Tabs
        options={[
          { value: "matches", label: "Matches" },
          { value: "scorers", label: "Scorers" },
          { value: "tokens", label: "Tokens" },
          { value: "champion", label: "Champion" },
        ]}
        value={cur}
        onChange={(v) => nav(`/picks/${v}`)}
      />
      <Routes>
        <Route path="matches" element={<Matches />} />
        <Route path="scorers" element={<Scorers />} />
        <Route path="tokens" element={<Tokens />} />
        <Route path="champion" element={<Champion />} />
        <Route path="*" element={<Navigate to="matches" replace />} />
      </Routes>
    </div>
  );
}

function TableHub() {
  const loc = useLocation();
  const nav = useNavigate();
  const cur = loc.pathname.includes("tournament") ? "tournament" : "leaderboard";
  return (
    <div className="space-y-4">
      <Tabs
        options={[
          { value: "leaderboard", label: "Leaderboard" },
          { value: "tournament", label: "Tournament" },
        ]}
        value={cur}
        onChange={(v) => nav(`/table/${v}`)}
      />
      <Routes>
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="tournament" element={<Tournament />} />
        <Route path="*" element={<Navigate to="leaderboard" replace />} />
      </Routes>
    </div>
  );
}

function MoreHub() {
  const { me, isAdmin, signOut } = useEuro();
  return (
    <div className="space-y-3">
      <div className="e-card flex items-center justify-between p-4">
        <span className="flex items-center gap-2.5">
          <span className="text-2xl">{me?.emoji}</span>
          <span>
            <span className="block font-grotesk font-bold text-white">{me?.name}</span>
            <span className="text-xs text-ink-400">{isAdmin ? "Administrator" : "Player"}</span>
          </span>
        </span>
        <button onClick={signOut} className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 py-2 text-sm font-semibold text-ink-200 ring-1 ring-white/[0.08] transition hover:bg-white/[0.12]">
          <LogOut size={14} /> Switch account
        </button>
      </div>
      <NavLink to="/rules" className="e-card e-card-hover flex items-center gap-3 p-4 text-ink-100">
        <BookOpen size={18} className="text-skyx-400" />
        <span>
          <span className="block font-semibold text-white">How scoring works</span>
          <span className="text-xs text-ink-400">Multipliers, odds, tokens — the full rulebook</span>
        </span>
      </NavLink>
      {isAdmin && (
        <NavLink to="/admin" className="e-card e-card-hover flex items-center gap-3 p-4 text-ink-100">
          <Wrench size={18} className="text-punch-400" />
          <span>
            <span className="block font-semibold text-white">Admin panel</span>
            <span className="text-xs text-ink-400">Time machine · results · simulations · users</span>
          </span>
        </NavLink>
      )}
    </div>
  );
}

const NAV = [
  { to: "/", label: "Home", icon: Zap, end: true },
  { to: "/picks", label: "Predict", icon: Target },
  { to: "/table", label: "Table", icon: Trophy },
  { to: "/more", label: "More", icon: Menu },
];

function Shell() {
  const { me, isAdmin, scores } = useEuro();
  if (!me) return <SignIn />;
  const mine = scores.find((s) => s.userId === me.id);
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/85 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <NavLink to="/" className="flex items-baseline gap-1.5">
            <span className="font-grotesk text-lg font-extrabold tracking-tight text-white">
              BARNITO<span className="text-volt-400">28</span>
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Euro 2028</span>
          </NavLink>
          <span className="flex items-center gap-2">
            {isAdmin && <ShieldCheck size={15} className="text-punch-400" />}
            <span className="e-chip bg-white/[0.06] text-ink-100 ring-1 ring-white/[0.08]">
              <span>{me.emoji}</span>
              <span className="max-w-[7rem] truncate">{me.name}</span>
              {mine && !isAdmin && <span className="e-num font-bold text-volt-300">{fmtPts(mine.total)}</span>}
            </span>
          </span>
        </div>
      </header>

      <main className="flex-1 px-4 pb-24 pt-4">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/matches" element={<Navigate to="/picks/matches" replace />} />
          <Route path="/picks/*" element={<PicksHub />} />
          <Route path="/table/*" element={<TableHub />} />
          <Route path="/more" element={<MoreHub />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/admin" element={isAdmin ? <Admin /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-ink-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-xl items-stretch justify-around px-2 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-1.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end as boolean | undefined}
              className={({ isActive }) =>
                `flex min-w-16 flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-semibold transition ${
                  isActive ? "text-volt-300" : "text-ink-400 hover:text-ink-200"
                }`
              }
            >
              <Icon size={19} strokeWidth={2.25} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <EuroProvider>
      <ToastProvider>
        <HashRouter>
          <Shell />
        </HashRouter>
      </ToastProvider>
    </EuroProvider>
  );
}
