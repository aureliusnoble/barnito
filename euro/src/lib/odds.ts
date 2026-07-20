// Mock odds engine. Deterministic in (ids, time): the same fixture at the same
// sim-time always prices the same, so locks are verifiable; prices drift slowly
// over hours so WHEN you lock matters (and the admin time machine moves markets).

import type { ETeam, EPlayer, EFixture, Outcome, OutcomeOdds } from "../types";
import { hash32 } from "./rng";

const DRIFT_AMP = 0.09; // ±9% swing on raw probabilities
const DRIFT_PERIOD_MS = 26 * 3600_000; // one full cycle ≈ 26h so it moves day to day

/** Deterministic drift factor around 1.0 for a market key at a moment. */
function drift(key: string, atMs: number): number {
  const phase = (hash32(key) % 997) / 997;
  return 1 + DRIFT_AMP * Math.sin(2 * Math.PI * (phase + atMs / DRIFT_PERIOD_MS));
}

const toOdds = (p: number): number => Math.round((1 / p) * 100) / 100;

/**
 * Normalize a set of implied probabilities to sum exactly 1.
 * Real bookmaker odds carry an overround (implied probs sum > 1, and longshots are
 * shaded extra), which would quietly tax some picks' EV relative to others if used
 * raw as payout multipliers. Every market in this engine routes through this, so
 * swapping mock prices for real ones later keeps "every pick EV-flat" true — feed
 * raw implied probs (1/decimal odds) in, use what comes out.
 */
export function normalizeProbs<K extends string>(raw: Record<K, number>): Record<K, number> {
  const entries = Object.entries(raw) as [K, number][];
  const sum = entries.reduce((a, [, v]) => a + v, 0);
  if (sum <= 0) return raw;
  return Object.fromEntries(entries.map(([k, v]) => [k, v / sum])) as Record<K, number>;
}

/** 1X2 probabilities + fair decimal odds for a fixture at a moment. */
export function outcomeOdds(fixture: EFixture, home: ETeam, away: ETeam, atMs: number): OutcomeOdds {
  const dr = (home.rating - away.rating) / 400;
  const pHomeRaw = 1 / (1 + Math.pow(10, -dr));
  // Draws are likelier between evenly-matched sides; floor keeps longshot draws alive.
  const pDrawBase = Math.max(0.12, 0.3 - 0.22 * Math.abs(2 * pHomeRaw - 1));
  const raw = {
    H: pHomeRaw * (1 - pDrawBase) * drift(`${fixture.id}|H`, atMs),
    D: pDrawBase * drift(`${fixture.id}|D`, atMs),
    A: (1 - pHomeRaw) * (1 - pDrawBase) * drift(`${fixture.id}|A`, atMs),
  };
  const probs = normalizeProbs(raw); // fair book: no overround survives this
  return {
    probs,
    odds: { H: toOdds(probs.H), D: toOdds(probs.D), A: toOdds(probs.A) },
  };
}

/** Convenience: prob + odds for one side of a fixture (token markets back a team). */
export function teamWinOdds(fixture: EFixture, home: ETeam, away: ETeam, teamId: string, atMs: number): { prob: number; odds: number } {
  const o = outcomeOdds(fixture, home, away, atMs);
  const k: Outcome = teamId === home.id ? "H" : "A";
  return { prob: o.probs[k], odds: o.odds[k] };
}

/**
 * Scorer market for a forward in a typical match of a phase.
 * `prob` is the ANYTIME-scorer probability (display). `odds` is the PER-GOAL fair
 * multiplier 1/λ, with λ = −ln(1−p) (Poisson expected goals implied by the anytime
 * prob). Paying per goal at 1/λ makes every pick's EV per match exactly the base —
 * stars get paid via braces instead of a structural edge, so only true knowledge of
 * a player being underpriced beats the market. With real odds later: derive p from
 * a normalized anytime market, then price the same way.
 */
export function scorerOdds(player: EPlayer, team: ETeam, phase: string, atMs: number): { prob: number; odds: number } {
  const base = 0.06 + ((player.rating - 60) / 39) * 0.5; // 60→6%, 99→56%
  const teamEdge = (team.rating - 1800) / 2000; // ±~0.15
  let p = Math.min(0.72, Math.max(0.04, base + teamEdge * 0.3));
  p *= drift(`${player.id}|${phase}`, atMs);
  p = Math.min(0.75, Math.max(0.03, p));
  const lambda = -Math.log(1 - p); // implied expected goals per match
  return { prob: p, odds: toOdds(lambda) };
}

/**
 * The winning-margin distribution implied by the result simulator's scoreline
 * model (winner goals 1–4 with a 15% bonus, loser trailing by 1–3):
 * margin | win ∈ {1: 52.2%, 2: 35%, 3: 12.8%}. Its mean converts win/lose
 * probabilities into an expected goal margin (the "line").
 */
const MARGIN_PMF: [number, number][] = [
  [1, 0.5222],
  [2, 0.35],
  [3, 0.1278],
];
const MEAN_WIN_MARGIN = MARGIN_PMF.reduce((a, [m, p]) => a + m * p, 0); // ≈ 1.606

/**
 * Market spread for a team in a fixture: its expected goal margin (signed;
 * favourites positive), frozen at token lock. Tokens pay on margin − spread, which
 * has zero expectation on BOTH sides of every game — only beating the market's
 * margin view earns points.
 */
export function marginSpread(fixture: EFixture, home: ETeam, away: ETeam, teamId: string, atMs: number): number {
  const o = outcomeOdds(fixture, home, away, atMs);
  const pT = teamId === home.id ? o.probs.H : o.probs.A;
  const pO = teamId === home.id ? o.probs.A : o.probs.H;
  return Math.round(MEAN_WIN_MARGIN * (pT - pO) * 100) / 100;
}

export interface MarginOutlook {
  line: number;
  /** Probability the team finishes ahead of its line (earns points). */
  cover: number;
  /** Average goals past the line when it covers (positive). */
  avgWinDelta: number;
  /** Average goals short of the line when it misses (negative). */
  avgLossDelta: number;
}

/**
 * The human-readable view of a token bet: how often this side beats its line,
 * and the typical distance either way — computed from the same margin model the
 * line comes from, so cover × avgWin + miss × avgLoss ≈ 0 (zero expectation).
 */
export function marginOutlook(fixture: EFixture, home: ETeam, away: ETeam, teamId: string, atMs: number): MarginOutlook {
  const o = outcomeOdds(fixture, home, away, atMs);
  const pT = teamId === home.id ? o.probs.H : o.probs.A;
  const pO = teamId === home.id ? o.probs.A : o.probs.H;
  const pD = o.probs.D;
  const line = Math.round(MEAN_WIN_MARGIN * (pT - pO) * 100) / 100;

  // Full margin pmf from this team's perspective: wins positive, losses negative.
  const outcomes: [number, number][] = [
    ...MARGIN_PMF.map(([m, p]) => [m, pT * p] as [number, number]),
    [0, pD],
    ...MARGIN_PMF.map(([m, p]) => [-m, pO * p] as [number, number]),
  ];
  let cover = 0, winSum = 0, miss = 0, lossSum = 0;
  for (const [m, p] of outcomes) {
    const delta = m - line;
    if (delta > 1e-9) { cover += p; winSum += p * delta; }
    else if (delta < -1e-9) { miss += p; lossSum += p * delta; }
  }
  return {
    line,
    cover,
    avgWinDelta: cover > 0 ? winSum / cover : 0,
    avgLossDelta: miss > 0 ? lossSum / miss : 0,
  };
}

/** Outright champion odds (display only): softmax over ratings. */
export function outrightOdds(teams: ETeam[], atMs: number): Map<string, { prob: number; odds: number }> {
  const ws = teams.map((t) => ({ t, w: Math.exp(t.rating / 120) * drift(`outright|${t.id}`, atMs) }));
  const sum = ws.reduce((a, b) => a + b.w, 0);
  const out = new Map<string, { prob: number; odds: number }>();
  for (const { t, w } of ws) {
    const p = w / sum;
    out.set(t.id, { prob: p, odds: toOdds(p) });
  }
  return out;
}
