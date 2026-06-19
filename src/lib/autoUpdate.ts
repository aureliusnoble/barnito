// Auto-reload when a new build is deployed. A single-page app keeps its loaded JavaScript until the
// page is reloaded, so without this, anyone with Barnito already open never sees an update (and e.g.
// shares an out-of-date result card). We compare the hashed bundle referenced by the *deployed*
// index.html against the one we're currently running, and reload when they differ.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const BUNDLE_RE = /assets\/(index-[A-Za-z0-9_-]+\.js)/;

function currentBundle(): string | null {
  for (const s of Array.from(document.scripts)) {
    const m = s.src.match(BUNDLE_RE);
    if (m) return m[1];
  }
  return null;
}

async function latestBundle(): Promise<string | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const m = (await res.text()).match(BUNDLE_RE);
    return m ? m[1] : null;
  } catch {
    return null; // offline / transient — try again next tick
  }
}

export function startAutoUpdate() {
  const current = currentBundle();
  if (!current) return;
  const check = async () => {
    if (document.visibilityState !== "visible") return;
    const latest = await latestBundle();
    if (!latest || latest === current) return;
    // guard against reload loops if the HTML is briefly still cached
    const last = Number(sessionStorage.getItem("barnito.autoReload") || 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem("barnito.autoReload", String(Date.now()));
    location.reload();
  };
  setInterval(check, CHECK_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void check(); });
  setTimeout(() => void check(), 15_000); // catch opens that happened just before a deploy
}
