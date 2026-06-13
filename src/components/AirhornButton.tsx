import { useCallback, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { Megaphone } from "lucide-react";

/**
 * Persistent bottom-left button: plays an MLG airhorn and blasts confetti everywhere.
 * The airhorn is synthesised with the Web Audio API (no asset, works offline). Drop a
 * file at public/airhorn.mp3 to override it with a real clip.
 */

let audioCtx: AudioContext | null = null;
function getCtx(): AudioContext {
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new Ctor();
  }
  return audioCtx;
}

// A single airhorn "honk": detuned saws through a lowpass with a fast attack and a tail.
function honk(ctx: AudioContext, start: number, duration: number) {
  const out = ctx.createGain();
  out.connect(ctx.destination);
  out.gain.setValueAtTime(0, start);
  out.gain.linearRampToValueAtTime(0.5, start + 0.02);
  out.gain.setValueAtTime(0.5, start + duration - 0.06);
  out.gain.exponentialRampToValueAtTime(0.0008, start + duration);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 2200;
  filter.Q.value = 6;
  filter.connect(out);

  const freqs = [277, 330, 415]; // a fat, dissonant chord — classic air-horn stab
  for (const base of freqs) {
    for (const detune of [-6, 6]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = base;
      osc.detune.value = detune;
      // tiny upward pitch bend on attack
      osc.frequency.setValueAtTime(base * 0.96, start);
      osc.frequency.exponentialRampToValueAtTime(base, start + 0.05);
      osc.connect(filter);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    }
  }
}

function playSynthAirhorn() {
  const ctx = getCtx();
  if (ctx.state === "suspended") void ctx.resume();
  const t = ctx.currentTime + 0.02;
  // the iconic short-short-loooong pattern
  honk(ctx, t, 0.18);
  honk(ctx, t + 0.28, 0.18);
  honk(ctx, t + 0.56, 0.9);
}

let realClip: HTMLAudioElement | null | undefined;
function playAirhorn() {
  // try a real clip once; fall back to the synth
  if (realClip === undefined) {
    const a = new Audio(`${import.meta.env.BASE_URL}airhorn.mp3`);
    a.addEventListener("error", () => {
      realClip = null;
      playSynthAirhorn();
    });
    a.play()
      .then(() => {
        realClip = a;
      })
      .catch(() => {
        realClip = null;
        playSynthAirhorn();
      });
    return;
  }
  if (realClip) {
    realClip.currentTime = 0;
    void realClip.play().catch(() => playSynthAirhorn());
  } else {
    playSynthAirhorn();
  }
}

function blastConfetti() {
  const colors = ["#16a34a", "#f97316", "#fde047", "#ffffff", "#22d3ee"];
  const fire = (originX: number, angle: number) =>
    confetti({
      particleCount: 80,
      spread: 75,
      startVelocity: 55,
      angle,
      origin: { x: originX, y: 1 },
      colors,
      scalar: 1.1,
      ticks: 220,
    });
  fire(0.1, 70);
  fire(0.5, 90);
  fire(0.9, 110);
  // a centre burst for good measure
  setTimeout(
    () =>
      confetti({
        particleCount: 120,
        spread: 360,
        startVelocity: 35,
        origin: { x: 0.5, y: 0.4 },
        colors,
        scalar: 1.2,
        ticks: 200,
      }),
    150,
  );
}

export default function AirhornButton() {
  const [active, setActive] = useState(false);
  const timer = useRef<number | null>(null);

  const onClick = useCallback(() => {
    playAirhorn();
    blastConfetti();
    setActive(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setActive(false), 1400);
  }, []);

  return (
    <button
      onClick={onClick}
      aria-label="Play airhorn"
      title="AIRHORN 📣"
      className="fixed bottom-20 left-3 z-30 sm:bottom-5"
    >
      <span className="relative flex h-14 w-14 items-center justify-center">
        {active && (
          <span className="absolute inset-0 rounded-full bg-spice-500/60 animate-pulse-ring" />
        )}
        <span
          className={`relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-spice-400 to-spice-600 text-white shadow-xl ring-2 ring-white/20 transition active:scale-90 ${
            active ? "animate-wiggle" : "hover:scale-105"
          }`}
        >
          <Megaphone size={24} strokeWidth={2.4} />
        </span>
      </span>
    </button>
  );
}
