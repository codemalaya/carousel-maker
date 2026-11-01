/**
 * Empty-trash illustration. Inline SVG so it follows the theme through the CSS tokens
 * (muted fill, muted-foreground lines, brand accent) in both light and dark.
 */
export function EmptyTrashArt({ className }: { className?: string }) {
  const line = { stroke: "var(--muted-foreground)", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg viewBox="0 0 200 170" fill="none" className={className} role="img" aria-label="Sampah kosong">
      {/* ground shadow */}
      <ellipse cx="100" cy="153" rx="46" ry="6" fill="var(--muted)" />

      {/* ghost slides that used to live here */}
      <g opacity="0.55">
        <rect x="46" y="22" width="34" height="43" rx="5" transform="rotate(-12 63 43)" stroke="var(--muted-foreground)" strokeWidth="2" strokeDasharray="4 5" />
        <rect x="118" y="14" width="34" height="43" rx="5" transform="rotate(10 135 35)" stroke="var(--muted-foreground)" strokeWidth="2" strokeDasharray="4 5" />
      </g>

      {/* bin body */}
      <path d="M68 70h64l-6 74a6 6 0 0 1-6 5.5H80a6 6 0 0 1-6-5.5z" fill="var(--muted)" {...line} />
      <path d="M90 86v44M110 86v44" stroke="var(--muted-foreground)" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />

      {/* lid, slightly ajar */}
      <g transform="rotate(-9 66 62)">
        <rect x="58" y="54" width="84" height="10" rx="5" fill="var(--card)" {...line} />
        <path d="M91 54v-4a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v4" {...line} />
      </g>

      {/* all clear badge */}
      <circle cx="136" cy="104" r="17" fill="var(--brand)" />
      <path d="m128 104 5.5 5.5L145 98" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* sparkles */}
      <path d="M40 98v10M35 103h10" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M168 78v7M164.5 81.5h7" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <circle cx="30" cy="60" r="2.5" fill="var(--muted-foreground)" opacity="0.4" />
      <circle cx="172" cy="128" r="2.5" fill="var(--brand)" opacity="0.7" />
    </svg>
  );
}
