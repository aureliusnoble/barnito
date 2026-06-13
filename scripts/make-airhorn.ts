/**
 * Generate a real, copyright-free MLG-style airhorn as public/airhorn.wav (we synthesise it, so
 * it's free to use). The AirhornButton plays this file and only falls back to live Web-Audio if it
 * fails to load. Run: npm run airhorn
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./lib/util.js";

const SR = 44100;
// the classic short-short-loooong airhorn pattern (start, duration) in seconds
const HONKS: [number, number][] = [
  [0.02, 0.2],
  [0.32, 0.2],
  [0.62, 1.0],
];
const BASES = [233, 277, 350, 466]; // fat, slightly dissonant chord (air-horn stack)
const total = 1.8;
const n = Math.floor(SR * total);
const buf = new Float64Array(n);

function saw(phase: number): number {
  return 2 * (phase - Math.floor(phase + 0.5));
}

for (const [start, dur] of HONKS) {
  const s0 = Math.floor(start * SR);
  const s1 = Math.floor((start + dur) * SR);
  for (let i = s0; i < s1 && i < n; i++) {
    const t = (i - s0) / SR;
    // amplitude envelope: fast attack, short release
    const env =
      Math.min(1, t / 0.015) * Math.min(1, (dur - t) / 0.05) * (1 - 0.15 * Math.sin(t * 38));
    let v = 0;
    for (const f of BASES) {
      const bend = f * (0.965 + 0.035 * Math.min(1, t / 0.05)); // tiny upward pitch bend on attack
      v += saw((bend * (i / SR)) % 1);
      v += 0.6 * saw(((bend * 1.005) * (i / SR)) % 1); // detuned layer
    }
    buf[i] += (v / (BASES.length * 1.6)) * env;
  }
}

// one-pole low-pass to tame the buzz into a horn-like tone
let y = 0;
const a = 0.35;
for (let i = 0; i < n; i++) {
  y += a * (buf[i] - y);
  buf[i] = y;
}

// normalise
let peak = 0;
for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(buf[i]));
const gain = peak > 0 ? 0.92 / peak : 1;

// 16-bit PCM mono WAV
const dataLen = n * 2;
const out = Buffer.alloc(44 + dataLen);
out.write("RIFF", 0);
out.writeUInt32LE(36 + dataLen, 4);
out.write("WAVE", 8);
out.write("fmt ", 12);
out.writeUInt32LE(16, 16);
out.writeUInt16LE(1, 20); // PCM
out.writeUInt16LE(1, 22); // mono
out.writeUInt32LE(SR, 24);
out.writeUInt32LE(SR * 2, 28);
out.writeUInt16LE(2, 32);
out.writeUInt16LE(16, 34);
out.write("data", 36);
out.writeUInt32LE(dataLen, 40);
for (let i = 0; i < n; i++) {
  const s = Math.max(-1, Math.min(1, buf[i] * gain));
  out.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
}

const path = resolve(REPO_ROOT, "public/airhorn.wav");
writeFileSync(path, out);
console.log(`Wrote ${path} (${(out.length / 1024).toFixed(0)} KB, ${total}s)`);
