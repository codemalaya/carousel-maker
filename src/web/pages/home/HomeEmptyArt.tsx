/**
 * Empty-state illustrations for the home page. Inline SVG so they follow the theme through the CSS tokens
 * (card/muted fills, muted-foreground lines, brand accent), same look as EmptyTrashArt.
 */
const line = { stroke: "var(--muted-foreground)", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** No projects yet: a small fan of slides with a plus on the front one. */
export function NoProjectsArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 170" fill="none" className={className} role="img" aria-label="Belum ada project">
      <ellipse cx="100" cy="152" rx="56" ry="6" fill="var(--muted)" />

      {/* back slides */}
      <rect x="40" y="46" width="62" height="78" rx="8" transform="rotate(-12 71 85)" fill="var(--muted)" {...line} opacity="0.9" />
      <rect x="98" y="46" width="62" height="78" rx="8" transform="rotate(12 129 85)" fill="var(--muted)" {...line} opacity="0.9" />

      {/* front slide: placeholder content + plus */}
      <rect x="68" y="34" width="64" height="88" rx="8" fill="var(--card)" {...line} />
      <rect x="77" y="45" width="30" height="5" rx="2.5" fill="var(--muted-foreground)" opacity="0.45" />
      <rect x="77" y="55" width="46" height="4" rx="2" fill="var(--muted-foreground)" opacity="0.25" />
      <rect x="77" y="63" width="38" height="4" rx="2" fill="var(--muted-foreground)" opacity="0.25" />
      <circle cx="100" cy="97" r="14" fill="var(--brand)" />
      <path d="M100 90v14M93 97h14" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />

      {/* sparkles */}
      <path d="M38 36v10M33 41h10" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M166 40v7M162.5 43.5h7" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <circle cx="174" cy="112" r="2.5" fill="var(--brand)" opacity="0.7" />
      <circle cx="26" cy="104" r="2.5" fill="var(--muted-foreground)" opacity="0.4" />
    </svg>
  );
}

/** Search found nothing: magnifier with a cross, a few faint placeholder rows. */
export function NoResultsArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 180 130" fill="none" className={className} role="img" aria-label="Tidak ada hasil">
      <ellipse cx="88" cy="118" rx="44" ry="5" fill="var(--muted)" />

      {/* faint result rows that are not there */}
      <g opacity="0.5" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 6">
        <path d="M128 36h32M128 52h24M132 68h28" />
      </g>

      {/* magnifier */}
      <path d="M92 80l26 26" stroke="var(--muted-foreground)" strokeWidth="9" strokeLinecap="round" />
      <path d="M92 80l26 26" stroke="var(--card)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="68" cy="56" r="34" fill="var(--card)" {...line} />
      <circle cx="68" cy="56" r="26" fill="var(--muted)" opacity="0.7" />
      <path d="M58 46l20 20M78 46L58 66" stroke="var(--brand)" strokeWidth="4" strokeLinecap="round" />

      {/* sparkles */}
      <path d="M24 28v8M20 32h8" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="30" cy="92" r="2.5" fill="var(--muted-foreground)" opacity="0.4" />
      <circle cx="150" cy="100" r="2.5" fill="var(--brand)" opacity="0.7" />
    </svg>
  );
}
