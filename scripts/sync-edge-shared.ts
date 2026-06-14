/**
 * Copy the pure-TS scoring engine + types into the Supabase edge function as Deno-compatible
 * modules (single source of truth — re-run before deploying the function).
 *   npm run sync:edge
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./lib/util.js";

const OUT = resolve(REPO_ROOT, "supabase/functions/_shared");
mkdirSync(OUT, { recursive: true });

// Rewrite Node/Vite import specifiers to Deno relative+.ts specifiers.
function deno(src: string): string {
  return src
    .replace(/@shared\//g, "./") // path alias → local
    .replace(/(\.\.\/lib\/)/g, "./") // scripts/lib/* now sit alongside in _shared
    .replace(/\.js"/g, '.ts"'); // ESM .js → Deno .ts
}

const files: [string, string][] = [
  ["shared/types.ts", "types.ts"],
  ["shared/constants.ts", "constants.ts"],
  ["scripts/lib/standings.ts", "standings.ts"],
  ["scripts/lib/scoring.ts", "scoring.ts"],
];

const banner = "// AUTO-GENERATED from the repo source by scripts/sync-edge-shared.ts — do not edit.\n";
for (const [from, to] of files) {
  const src = readFileSync(resolve(REPO_ROOT, from), "utf8");
  writeFileSync(resolve(OUT, to), banner + deno(src));
  console.log(`  ${from} → supabase/functions/_shared/${to}`);
}
console.log("synced edge shared modules");
