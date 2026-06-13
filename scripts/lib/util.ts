import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const DATA_DIR = resolve(REPO_ROOT, "public/data");

export function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function writeJson(file: string, data: unknown): void {
  const path = resolve(DATA_DIR, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`  wrote ${file} (${JSON.stringify(data).length.toLocaleString()} bytes)`);
}

/** Deterministic small hash → unsigned int, for reproducible synthetic data. */
export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Seeded pseudo-random in [0,1) from a string. */
export function rand(seed: string): number {
  return hash(seed) / 0xffffffff;
}

export function randInt(seed: string, maxInclusive: number): number {
  return Math.floor(rand(seed) * (maxInclusive + 1));
}

/**
 * Convert an openfootball date ("2026-06-11") + time ("13:00 UTC-6") into an
 * ISO UTC timestamp. Falls back to noon UTC if the time can't be parsed.
 */
export function toIsoUtc(date: string, time?: string): string {
  if (!time) return `${date}T12:00:00Z`;
  const m = time.match(/(\d{1,2}):(\d{2})\s*UTC([+-]\d{1,2})?/);
  if (!m) return `${date}T12:00:00Z`;
  const [, hh, mm, off] = m;
  const offset = off ? parseInt(off, 10) : 0;
  // local time minus offset = UTC
  const localMinutes = parseInt(hh, 10) * 60 + parseInt(mm, 10) - offset * 60;
  const base = Date.parse(`${date}T00:00:00Z`);
  return new Date(base + localMinutes * 60_000).toISOString().replace(/\.\d{3}Z$/, "Z");
}
