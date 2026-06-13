import { useState } from "react";
import { useBarnito } from "../data/store";
import { flagEmoji } from "../lib/format";
import type { Position } from "@shared/types";

/** Team crest: real logo when available, emoji flag fallback. */
export function Crest({
  teamId,
  size = 24,
  className = "",
}: {
  teamId: string;
  size?: number;
  className?: string;
}) {
  const { teamById } = useBarnito();
  const team = teamById.get(teamId);
  const [broken, setBroken] = useState(false);
  const px = `${size}px`;

  if (team?.logo && !broken) {
    return (
      <img
        src={team.logo}
        alt={team.name}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setBroken(true)}
        className={`inline-block object-contain ${className}`}
        style={{ width: px, height: px }}
      />
    );
  }
  return (
    <span
      className={`inline-flex items-center justify-center leading-none ${className}`}
      style={{ width: px, height: px, fontSize: `${size * 0.85}px` }}
      aria-hidden
    >
      {flagEmoji(team?.name ?? teamId)}
    </span>
  );
}

const POS_RING: Record<Position, string> = {
  GK: "ring-purple-400/60",
  DEF: "ring-sky-400/60",
  MID: "ring-accent-400/60",
  FWD: "ring-spice-400/70",
};

function initials(name: string): string {
  const parts = name.replace(/^[A-Z]\.\s*/, "").split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1] ?? name;
  return last.slice(0, 2).toUpperCase();
}

/** Player avatar: photo when available, initials fallback ringed by position colour. */
export function Avatar({
  photo,
  name,
  position,
  size = 36,
  className = "",
}: {
  photo?: string | null;
  name: string;
  position?: Position | null;
  size?: number;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const px = `${size}px`;
  const ring = position ? POS_RING[position] : "ring-white/10";

  if (photo && !broken) {
    return (
      <img
        src={photo}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setBroken(true)}
        className={`inline-block shrink-0 rounded-full object-cover ring-2 ${ring} ${className}`}
        style={{ width: px, height: px }}
      />
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-pitch-700 text-[0.7em] font-bold text-pitch-200 ring-2 ${ring} ${className}`}
      style={{ width: px, height: px }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
