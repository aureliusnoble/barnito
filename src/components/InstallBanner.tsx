import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

/** Chrome's install prompt event (not in the standard DOM lib types). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "barnito-install-dismissed";

/**
 * Floating banner inviting Android/Chrome users to install Barnito to their home screen.
 * We capture Chrome's `beforeinstallprompt`, suppress the mini-infobar, and surface our own
 * styled prompt. Hidden once installed, already running standalone, or dismissed by the user.
 */
export default function InstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(() => localStorage.getItem(DISMISS_KEY) === "1");

  useEffect(() => {
    // Already launched as an installed app → never show.
    const standalone =
      (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches) ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) { setHidden(true); return; }

    const onPrompt = (e: Event) => {
      e.preventDefault(); // stop Chrome's default mini-infobar; we show our own
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { setDeferred(null); setHidden(true); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden || !deferred) return null;

  const install = async () => {
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "dismissed") dismiss();
  };
  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  };

  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+64px)] z-30 px-3 sm:bottom-4">
      <div className="card mx-auto flex max-w-md items-center gap-3 border-accent-500/25 bg-pitch-900/95 p-3 shadow-glow backdrop-blur-xl animate-slide-up">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-500/15 text-xl ring-1 ring-accent-500/25">
          ⚽
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="font-display text-sm font-bold text-white">Install Barnito</div>
          <div className="text-[11px] text-pitch-300">Add it to your home screen for a full-screen app.</div>
        </div>
        <button
          onClick={install}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent-500 px-3 py-1.5 text-sm font-semibold text-pitch-950 transition active:scale-95"
        >
          <Download size={15} strokeWidth={2.5} /> Add
        </button>
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
