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

/** 1X2 probabilities + fair decimal odds for a fixture at a moment. */
export function outcomeOdds(fixture: EFixture, home: ETeam, away: ETeam, atMs: number): OutcomeOdds {
  const dr = (home.rating - away.rating) / 400;
  const pHomeRaw = 1 / (1 + Math.pow(10, -dr));
  // Draws are likelier between evenly-matched sides; floor keeps longshot draws alive.
  const pDrawBase = Math.max(0.12, 0.3 - 0.22 * Math.abs(2 * pHomeRaw - 1));
  let pH = pHomeRaw * (1 - pDrawBase) * drift(`${fixture.id}|H`, atMs);
  let pD = pDrawBase * drift(`${fixture.id}|D`, atMs);
  let pA = (1 - pHomeRaw) * (1 - pDrawBase) * drift(`${fixture.id}|A`, atMs);
  const s = pH + pD + pA;
  pH /= s; pD /= s; pA /= s;
  return {
    probs: { H: pH, D: pD, A: pA },
    odds: { H: toOdds(pH), D: toOdds(pD), A: toOdds(pA) },
  };
}

/** Convenience: prob + odds for one side of a fixture (token markets back a team). */
export function teamWinOdds(fixture: EFixture, home: ETeam, away: ETeam, teamId: string, atMs: number): { prob: number; odds: number } {
  const o = outcomeOdds(fixture, home, away, atMs);
  const k: Outcome = teamId === home.id ? "H" : "A";
  return { prob: o.probs[k], odds: o.odds[k] };
}

/**
 * Anytime-scorer probability for a forward in a typical match of a phase.
 * Player rating dominates; the team's average opponent gap nudges it.
 */
export function scorerOdds(player: EPlayer, team: ETeam, phase: string, atMs: number): { prob: number; odds: number } {
  const base = 0.06 + ((player.rating - 60) / 39) * 0.5; // 60→6%, 99→56%
  const teamEdge = (team.rating - 1800) / 2000; // ±~0.15
  let p = Math.min(0.72, Math.max(0.04, base + teamEdge * 0.3));
  p *= drift(`${player.id}|${phase}`, atMs);
  p = Math.min(0.75, Math.max(0.03, p));
  return { prob: p, odds: toOdds(p) };
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
