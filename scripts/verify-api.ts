/**
 * Cheap preflight (~4 API calls): confirms the key/plan can see season 2026 and reports your
 * daily request limit, so you can verify cost + data coverage before the bigger setup run.
 *   API_FOOTBALL_KEY=xxx npm run verify
 */
import { WC_LEAGUE, WC_SEASON } from "./lib/apiFootball.js";

const BASE = process.env.API_FOOTBALL_BASE ?? "https://v3.football.api-sports.io";
const key = process.env.API_FOOTBALL_KEY;

async function get(path: string, params: Record<string, string | number> = {}) {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { "x-apisports-key": key! } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = (await res.json()) as any;
  return { status: res.status, body };
}

async function main() {
  if (!key) {
    console.error("✗ API_FOOTBALL_KEY is not set.");
    process.exit(1);
  }
  let ok = true;

  // 1) account status — plan + daily limit + usage
  const status = await get("status");
  const sub = status.body?.response?.subscription;
  const reqs = status.body?.response?.requests;
  if (sub) {
    console.log(`Plan:     ${sub.plan} (active: ${sub.active}, ends: ${sub.end})`);
    console.log(`Requests: ${reqs?.current ?? "?"} / ${reqs?.limit_day ?? "?"} today`);
  } else {
    console.warn("! Could not read /status:", JSON.stringify(status.body?.errors ?? status.body));
  }

  // 2) fixtures for WC 2026
  const fx = await get("fixtures", { league: WC_LEAGUE, season: WC_SEASON });
  const fxErr = fx.body?.errors;
  const fxCount = fx.body?.results ?? 0;
  if (fxErr && (Array.isArray(fxErr) ? fxErr.length : Object.keys(fxErr).length)) {
    console.error(`✗ fixtures (season ${WC_SEASON}) blocked: ${JSON.stringify(fxErr)}`);
    ok = false;
  } else {
    console.log(`✓ fixtures season ${WC_SEASON}: ${fxCount} found`);
  }

  // 3) standings (groups)
  const st = await get("standings", { league: WC_LEAGUE, season: WC_SEASON });
  const groups = st.body?.response?.[0]?.league?.standings?.length ?? 0;
  if (groups > 0) console.log(`✓ standings: ${groups} groups`);
  else console.warn(`! standings empty (groups may not be drawn yet): ${JSON.stringify(st.body?.errors ?? "")}`);

  // 4) one squad — confirm player positions are present
  const firstTeamId = st.body?.response?.[0]?.league?.standings?.[0]?.[0]?.team?.id;
  if (firstTeamId) {
    const pl = await get("players", { team: firstTeamId, season: WC_SEASON, page: 1 });
    const sample = pl.body?.response?.[0];
    const pos = sample?.statistics?.[0]?.games?.position ?? sample?.player?.position;
    if (pos) console.log(`✓ players: positions present (e.g. ${sample.player.name} = ${pos})`);
    else console.warn("! players returned but no position field found");
  }

  console.log(ok ? "\n✅ Looks good — safe to run Setup data." : "\n❌ This key/plan can't see 2026 — upgrade the plan (Pro+).");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("verify failed:", e.message);
  process.exit(1);
});
