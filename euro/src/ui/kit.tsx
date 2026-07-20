// Barnito 28 design-system primitives. Every page composes from these so the
// overhauled look stays coherent. Theme: ink surfaces, volt CTAs, punch odds,
// skyx probabilities, mint points. Chart-categorical colors are validated for
// CVD + contrast on ink-900 and always ship with direct labels.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Lock, X } from "lucide-react";
import type { ETeam } from "../types";
import { fmtOdds, fmtPts, fmtProb, relKickoff } from "../lib/format";

// Validated categorical palette (dark surface #101525) — identity is never
// color-alone: BarBreakdown always direct-labels each segment.
export const CATEGORY_COLORS = {
  outcomes: "#3c8ef0",
  scorers: "#d97706",
  tokens: "#f43f80",
  champion: "#8b5cf6",
} as const;
export const CATEGORY_LABEL: Record<keyof typeof CATEGORY_COLORS, string> = {
  outcomes: "Results",
  scorers: "Scorers",
  tokens: "Tokens",
  champion: "Champion",
};

// ---------------------------------------------------------------------------

export function PageHead({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h1 className="font-grotesk text-2xl font-bold tracking-tight text-white">{title}</h1>
      {sub && <p className="mt-1 text-sm text-ink-300">{sub}</p>}
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between px-1">
      <h2 className="font-grotesk text-base font-bold text-white">{children}</h2>
      {hint && <span className="text-[11px] uppercase tracking-wide text-ink-400">{hint}</span>}
    </div>
  );
}

type BtnVariant = "primary" | "soft" | "ghost" | "danger";
export function Btn({
  variant = "soft",
  size = "md",
  className = "",
  disabled,
  onClick,
  children,
  type,
}: {
  variant?: BtnVariant;
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  type?: "button" | "submit";
}) {
  const v: Record<BtnVariant, string> = {
    primary:
      "bg-volt-400 text-ink-950 font-bold hover:bg-volt-300 disabled:bg-ink-700 disabled:text-ink-400",
    soft: "bg-white/[0.06] text-ink-100 hover:bg-white/[0.1] ring-1 ring-white/[0.08]",
    ghost: "text-ink-300 hover:text-white hover:bg-white/[0.05]",
    danger: "bg-red-500/15 text-red-300 ring-1 ring-red-500/30 hover:bg-red-500/25",
  };
  const s = { sm: "px-2.5 py-1.5 text-xs", md: "px-3.5 py-2 text-sm", lg: "px-5 py-3 text-base" };
  return (
    <button
      type={type ?? "button"}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${v[variant]} ${s[size]} ${className}`}
    >
      {children}
    </button>
  );
}

/** Probability meter — single-hue magnitude bar (thin, rounded, recessive track). */
export function ProbBar({ pct, className = "" }: { pct: number; className?: string }) {
  const w = Math.max(3, Math.min(100, Math.round(pct * 100)));
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07] ${className}`}>
      <div className="h-full rounded-full bg-skyx-400" style={{ width: `${w}%` }} />
    </div>
  );
}

/** Decimal odds chip — the multiplier a lock freezes. */
export function OddsTag({ odds, className = "" }: { odds: number; className?: string }) {
  return (
    <span className={`e-chip e-num bg-punch-500/15 text-punch-300 ring-1 ring-punch-500/25 ${className}`}>
      ×{fmtOdds(odds)}
    </span>
  );
}

/** Probability chip. */
export function ProbTag({ prob, className = "" }: { prob: number; className?: string }) {
  return <span className={`e-chip e-num bg-skyx-500/15 text-skyx-300 ring-1 ring-skyx-500/25 ${className}`}>{fmtProb(prob)}</span>;
}

/** Points chip — mint for gains, red for losses, neutral for zero/pending. */
export function PtsTag({ pts, signed = false, className = "" }: { pts: number; signed?: boolean; className?: string }) {
  const tone =
    pts > 0 ? "bg-mint-500/15 text-mint-300 ring-mint-500/25" : pts < 0 ? "bg-red-500/15 text-red-300 ring-red-500/30" : "bg-white/[0.06] text-ink-300 ring-white/[0.08]";
  const txt = (signed && pts > 0 ? "+" : "") + fmtPts(pts);
  return <span className={`e-chip e-num ring-1 ${tone} ${className}`}>{txt} pts</span>;
}

/**
 * The points formula, spelled out — the heart of the lock-in UX.
 * e.g. parts=[{v:"10",label:"base"},{v:"×4",label:"QF"},{v:"×7.14",label:"odds"}], result="286 pts"
 */
export function FormulaRow({ parts, result }: { parts: { v: string; label: string }[]; result: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {parts.map((p, i) => (
        <span key={i} className="flex flex-col items-center rounded-lg bg-white/[0.05] px-2.5 py-1.5 ring-1 ring-white/[0.06]">
          <span className="e-num font-grotesk text-sm font-bold text-white">{p.v}</span>
          <span className="text-[9px] uppercase tracking-wide text-ink-400">{p.label}</span>
        </span>
      ))}
      <span className="text-ink-500">=</span>
      <span className="flex flex-col items-center rounded-lg bg-volt-400/15 px-3 py-1.5 ring-1 ring-volt-400/30">
        <span className="e-num font-grotesk text-sm font-extrabold text-volt-300">{result}</span>
        <span className="text-[9px] uppercase tracking-wide text-volt-400/80">if right</span>
      </span>
    </div>
  );
}

export function TeamMark({ team, size = "md", muted = false }: { team: ETeam | undefined; size?: "sm" | "md" | "lg"; muted?: boolean }) {
  if (!team) return <span className="text-ink-500">TBD</span>;
  const s = { sm: "text-sm", md: "text-base", lg: "text-lg" };
  return (
    <span className={`inline-flex items-center gap-1.5 ${muted ? "opacity-60" : ""}`}>
      <span className={s[size]}>{team.flag}</span>
      <span className={`font-semibold ${muted ? "text-ink-300" : "text-white"} ${size === "sm" ? "text-xs" : "text-sm"}`}>{team.name}</span>
    </span>
  );
}

export function LockBadge({ lockedAt }: { lockedAt?: string }) {
  return (
    <span className="e-chip bg-volt-400/15 text-volt-300 ring-1 ring-volt-400/25" title={lockedAt ? `Locked ${new Date(lockedAt).toLocaleString("en-GB")}` : "Locked"}>
      <Lock size={10} strokeWidth={2.5} /> locked
    </span>
  );
}

export function CountdownPill({ toIso, nowMs }: { toIso: string; nowMs: number }) {
  return <span className="e-chip e-num bg-white/[0.06] text-ink-200 ring-1 ring-white/[0.08]">{relKickoff(toIso, nowMs)}</span>;
}

export function Tabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-ink-900/80 p-1 ring-1 ring-white/[0.06]">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-semibold transition ${
            value === o.value ? "bg-volt-400 text-ink-950" : "text-ink-300 hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ emoji, children }: { emoji: string; children: ReactNode }) {
  return (
    <div className="e-card p-8 text-center text-ink-300">
      <div className="mb-2 text-3xl">{emoji}</div>
      {children}
    </div>
  );
}

export function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <span className="inline-flex items-center gap-1">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.06] text-ink-200 ring-1 ring-white/[0.08] transition hover:bg-white/[0.12] disabled:opacity-30"
      >
        −
      </button>
      <span className="e-num w-6 text-center font-grotesk text-sm font-bold text-white">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.06] text-ink-200 ring-1 ring-white/[0.08] transition hover:bg-white/[0.12] disabled:opacity-30"
      >
        +
      </button>
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-fade-in sm:items-center" onClick={onClose}>
      <div
        className="e-card max-h-[88vh] w-full max-w-md animate-slide-up overflow-y-auto rounded-b-none rounded-t-3xl border-white/10 p-4 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-grotesk text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full bg-white/5 text-ink-300 transition hover:bg-white/10 hover:text-white">
            <X size={15} />
          </button>
        </div>
        <div className="space-y-3">{children}</div>
        {footer && <div className="mt-4 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * Category breakdown bar (leaderboard) — validated categorical palette, fixed
 * order, ≥2px gaps between segments, ALWAYS direct-labeled below (never color-alone).
 */
export function BarBreakdown({ items }: { items: { key: keyof typeof CATEGORY_COLORS; value: number }[] }) {
  const total = items.reduce((a, b) => a + Math.max(0, b.value), 0);
  return (
    <div>
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
        {total <= 0 ? (
          <div className="h-full w-full bg-white/[0.06]" />
        ) : (
          items
            .filter((i) => i.value > 0)
            .map((i) => (
              <div key={i.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(i.value / total) * 100}%`, background: CATEGORY_COLORS[i.key] }} />
            ))
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        {items.map((i) => (
          <span key={i.key} className="inline-flex items-center gap-1 text-[11px] text-ink-300">
            <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLORS[i.key] }} />
            {CATEGORY_LABEL[i.key]} <span className="e-num font-semibold text-ink-100">{fmtPts(i.value)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toasts — actions return error strings; pages surface them here.
// ---------------------------------------------------------------------------

interface Toast {
  id: number;
  text: string;
  tone: "ok" | "err";
}
const ToastCtx = createContext<{ toast: (text: string, tone?: "ok" | "err") => void }>({ toast: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const toast = useCallback((text: string, tone: "ok" | "err" = "ok") => {
    const id = nextId.current++;
    setItems((xs) => [...xs, { id, text, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((t) => t.id !== id)), 3200);
  }, []);
  useEffect(() => () => setItems([]), []);
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className={`animate-slide-up rounded-xl px-3.5 py-2 text-sm font-semibold shadow-card ring-1 backdrop-blur ${
              t.tone === "ok" ? "bg-ink-900/95 text-volt-300 ring-volt-400/30" : "bg-ink-900/95 text-red-300 ring-red-500/40"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
