/**
 * Upsert parsed predictions (public/data/predictions.json) into the Supabase `participants` table.
 * Run after `npm run predictions`. Needs the service-role key (writes bypass RLS):
 *   SUPABASE_SERVICE_ROLE_KEY=... npm run predictions:upload
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PredictionsFile } from "@shared/types.js";
import { DATA_DIR } from "./lib/util.js";

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://pkzlcfkupayzqphxjjgi.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY (Project Settings → API → service_role).");
  process.exit(1);
}
const supa = createClient(url, serviceKey, { auth: { persistSession: false } });

const file = JSON.parse(readFileSync(resolve(DATA_DIR, "predictions.json"), "utf8")) as PredictionsFile;
const rows = file.participants.map((p) => ({
  id: p.id, name: p.name, match_scores: p.matchScores, top_players: p.topPlayers,
  champion: p.champion, updated_at: new Date().toISOString(),
}));

const { error } = await supa.from("participants").upsert(rows, { onConflict: "id" });
if (error) { console.error("upload failed:", error.message); process.exit(1); }
console.log(`Uploaded ${rows.length} participants to Supabase.`);
