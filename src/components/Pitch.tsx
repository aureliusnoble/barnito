/** Pitch markings — vertical full pitch, viewBox in metres (68×105), brand palette. */
export function PitchMarkings() {
  const line = { fill: "none", stroke: "#eafff4", strokeWidth: 0.35, strokeOpacity: 0.32 } as const;
  const spot = { fill: "#eafff4", fillOpacity: 0.32 } as const;
  return (
    <svg viewBox="0 0 68 105" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
      {/* mown grass stripes */}
      {Array.from({ length: 7 }).map((_, i) => (
        <rect key={i} x="0" y={(i * 105) / 7} width="68" height={105 / 7} fill={i % 2 ? "#135230" : "#0f4527"} />
      ))}
      <rect x="0.9" y="0.9" width="66.2" height="103.2" rx="0.6" {...line} />
      <line x1="0.9" y1="52.5" x2="67.1" y2="52.5" {...line} />
      <circle cx="34" cy="52.5" r="9.15" {...line} />
      <circle cx="34" cy="52.5" r="0.5" {...spot} />
      {/* corner arcs */}
      <path d="M0.9 2.4 A1.5 1.5 0 0 0 2.4 0.9" {...line} />
      <path d="M65.6 0.9 A1.5 1.5 0 0 0 67.1 2.4" {...line} />
      <path d="M2.4 104.1 A1.5 1.5 0 0 0 0.9 102.6" {...line} />
      <path d="M67.1 102.6 A1.5 1.5 0 0 0 65.6 104.1" {...line} />
      {/* bottom goal */}
      <rect x="13.84" y="87.7" width="40.32" height="16.4" {...line} />
      <rect x="24.84" y="98.6" width="18.32" height="5.5" {...line} />
      <circle cx="34" cy="93.2" r="0.5" {...spot} />
      <path d="M26.8 87.7 A 9.15 9.15 0 0 1 41.2 87.7" {...line} />
      {/* top goal */}
      <rect x="13.84" y="0.9" width="40.32" height="16.4" {...line} />
      <rect x="24.84" y="0.9" width="18.32" height="5.5" {...line} />
      <circle cx="34" cy="11.8" r="0.5" {...spot} />
      <path d="M26.8 17.3 A 9.15 9.15 0 0 0 41.2 17.3" {...line} />
    </svg>
  );
}

/** Shortened display name: drop a leading initial, keep the last token. */
export const lastName = (name: string) => {
  const parts = name.replace(/^[A-Z]\.\s*/, "").split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? name;
};
