import { useEffect, useState } from "react";
import { Download, X, Share, Plus } from "lucide-react";

/** Chrome's install prompt event (not in the standard DOM lib types). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "barnito-install-dismissed";

const isStandalone = () =>
  (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches) ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** iOS Safari can't fire beforeinstallprompt; it installs via the Share sheet instead. */
const isIosSafari = () => {
  const ua = navigator.userAgent;
  const iOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const safari = !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua); // other iOS browsers can't add to home screen
  return iOS && safari;
};

/**
 * Floating banner inviting users to install Barnito to their home screen.
 * Android/Chrome: capture `beforeinstallprompt` and offer a one-tap install.
 * iOS/Safari: show Share-sheet instructions (Safari has no install API).
 * Hidden once installed, already standalone, or dismissed.
 */
export default function InstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [hidden, setHidden] = useState(() => localStorage.getItem(DISMISS_KEY) === "1");

  useEffect(() => {
    if (isStandalone()) { setHidden(true); return; }

    const onPrompt = (e: Event) => {
      e.preventDefault(); // stop Chrome's default mini-infobar; we show our own
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { setDeferred(null); setHidden(true); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // iOS never fires beforeinstallprompt, so surface the manual instructions directly.
    if (isIosSafari()) setIosHint(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  };

  if (hidden) return null;
  if (!deferred && !iosHint) return null;

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "dismissed") dismiss();
  };

  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+64px)] z-30 px-3 sm:bottom-4">
      <div className="card mx-auto flex max-w-md items-center gap-3 border-accent-500/25 bg-pitch-900/95 p-3 shadow-glow backdrop-blur-xl animate-slide-up">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-500/15 text-xl ring-1 ring-accent-500/25">
          ⚽
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="font-display text-sm font-bold text-white">Install Barnito</div>
          {deferred ? (
            <div className="text-[11px] text-pitch-300">Add it to your home screen for a full-screen app.</div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[11px] text-pitch-300">
              <span>Tap</span>
              <Share size={12} className="inline text-accent-300" strokeWidth={2.5} />
              <span>then</span>
              <span className="inline-flex items-center gap-0.5 font-semibold text-pitch-100">
                <Plus size={11} strokeWidth={3} /> Add to Home Screen
              </span>
            </div>
          )}
        </div>
        {deferred && (
          <button
            onClick={install}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent-500 px-3 py-1.5 text-sm font-semibold text-pitch-950 transition active:scale-95"
          >
            <Download size={15} strokeWidth={2.5} /> Add
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/5 text-pitch-300 transition hover:bg-white/10 hover:text-white"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
