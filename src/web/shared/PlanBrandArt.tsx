/**
 * Empty-state illustrations for the brand kit page and the planner's "belum dijadwalkan" card.
 * Inline SVG so they follow the theme through the CSS tokens (card/muted fills, muted-foreground lines, brand accent),
 * same look as EmptyTrashArt and HomeEmptyArt.
 */
const line = { stroke: "var(--muted-foreground)", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** No brand kits yet: paint chips fanned behind a brand card (logo slot, text lines, swatches) with a plus badge. */
export function NoBrandsArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 170" fill="none" className={className} role="img" aria-label="Belum ada brand">
      <ellipse cx="100" cy="152" rx="56" ry="6" fill="var(--muted)" />

      {/* paint chips */}
      <rect x="46" y="34" width="28" height="86" rx="8" transform="rotate(-16 60 120)" fill="var(--muted)" {...line} opacity="0.9" />
      <rect x="86" y="24" width="28" height="96" rx="8" fill="var(--brand)" stroke="var(--brand)" strokeWidth="2.5" opacity="0.9" />
      <rect x="126" y="34" width="28" height="86" rx="8" transform="rotate(16 140 120)" fill="var(--muted)" {...line} opacity="0.9" />

      {/* brand card */}
      <rect x="58" y="64" width="84" height="66" rx="9" fill="var(--card)" {...line} />
      <rect x="68" y="74" width="24" height="24" rx="6" stroke="var(--muted-foreground)" strokeWidth="2" strokeDasharray="4 4" opacity="0.7" />
      <rect x="98" y="77" width="32" height="5" rx="2.5" fill="var(--muted-foreground)" opacity="0.45" />
      <rect x="98" y="87" width="24" height="4" rx="2" fill="var(--muted-foreground)" opacity="0.25" />
      <circle cx="75" cy="114" r="6" fill="var(--muted-foreground)" opacity="0.25" />
      <circle cx="93" cy="114" r="6" fill="var(--muted-foreground)" opacity="0.4" />
      <circle cx="111" cy="114" r="6" fill="var(--brand)" />
      <circle cx="129" cy="114" r="6" fill="var(--muted-foreground)" opacity="0.15" />

      {/* plus badge */}
      <circle cx="146" cy="62" r="13" fill="var(--brand)" />
      <path d="M146 55v14M139 62h14" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />

      {/* sparkles */}
      <path d="M24 38v10M19 43h10" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M170 100v7M166.5 103.5h7" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <circle cx="186" cy="30" r="2.5" fill="var(--brand)" opacity="0.7" />
      <circle cx="28" cy="116" r="2.5" fill="var(--muted-foreground)" opacity="0.4" />
    </svg>
  );
}

/** Nothing left to schedule: a calendar page with a few days marked and a check badge. */
export function AllScheduledArt({ className }: { className?: string }) {
  const days = Array.from({ length: 12 }, (_, i) => ({ x: 70 + (i % 4) * 20, y: 74 + Math.floor(i / 4) * 18, on: [1, 6, 10].includes(i) }));
  return (
    <svg viewBox="0 0 200 150" fill="none" className={className} role="img" aria-label="Semua project sudah dijadwalkan">
      <ellipse cx="100" cy="136" rx="50" ry="5" fill="var(--muted)" />

      {/* ghost page behind */}
      <rect x="62" y="26" width="92" height="94" rx="10" transform="rotate(6 108 73)" stroke="var(--muted-foreground)" strokeWidth="2" strokeDasharray="4 5" opacity="0.5" />

      {/* calendar page */}
      <rect x="48" y="30" width="96" height="92" rx="10" fill="var(--card)" {...line} />
      <path d="M48 56h96" stroke="var(--muted-foreground)" strokeWidth="2.5" opacity="0.5" />
      <path d="M72 24v12M120 24v12" {...line} />
      {days.map((d, i) => (
        <circle key={i} cx={d.x - 2} cy={d.y} r={d.on ? 5 : 3.5} fill={d.on ? "var(--brand)" : "var(--muted-foreground)"} opacity={d.on ? 1 : 0.3} />
      ))}

      {/* check badge */}
      <circle cx="142" cy="112" r="16" fill="var(--brand)" />
      <path d="m134.5 112 5.5 5.5 10-11" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* sparkles */}
      <path d="M30 60v9M25.5 64.5h9" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M172 52v7M168.5 55.5h7" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <circle cx="36" cy="106" r="2.5" fill="var(--muted-foreground)" opacity="0.4" />
      <circle cx="170" cy="86" r="2.5" fill="var(--brand)" opacity="0.7" />
    </svg>
  );
}
