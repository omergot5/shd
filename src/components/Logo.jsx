// ============================================================
// Brand mark — a 12-segment shift ring.
//
// The ring reads as a clock face; the bright arc is the block of hours
// that got assigned. So the mark says "scheduling" at 64px and still
// resolves to a recognisable ringed shape at 16px in a browser tab.
//
// Drawn with stroke-dasharray on a `pathLength="120"` circle: each of the
// 12 segments is exactly 10 units, so segment N is just a dash offset —
// no arc trigonometry, no hand-tuned path data, and re-colouring one
// segment is a one-character change.
// ============================================================

const SEGMENTS = 12;
const UNIT = 120 / SEGMENTS; // 10 units per segment
const DASH = 6.6; // segment body
const GAP = 120 - DASH; // everything else — leaves exactly one dash visible

/** Segment indices that render in the accent colour: the assigned block. */
const ASSIGNED = new Set([9, 10, 11, 0]);

export function LogoMark({ size = 40, className = "", title }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {/* 12 o'clock is at -90°, so the ring starts where a clock starts. */}
      <g transform="rotate(-90 24 24)">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <circle
            key={i}
            cx="24"
            cy="24"
            r="18"
            pathLength="120"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${DASH} ${GAP}`}
            strokeDashoffset={-i * UNIT}
            stroke={ASSIGNED.has(i) ? "rgb(var(--accent-strong))" : "rgb(var(--brand))"}
            opacity={ASSIGNED.has(i) ? 1 : 0.42}
          />
        ))}
      </g>

      {/* Hands, parked at the leading edge of the assigned block. */}
      <g stroke="rgb(var(--text))" strokeWidth="2.6" strokeLinecap="round">
        <path d="M24 24V15" />
        <path d="M24 24h6.5" opacity="0.6" />
      </g>
      <circle cx="24" cy="24" r="2.4" fill="rgb(var(--accent-strong))" />
    </svg>
  );
}

export const PRODUCT_NAME = "Smart Shift Management";

/**
 * Mark plus wordmark. `stacked` centres them for the auth screen; the
 * default inline row is what the app chrome uses.
 *
 * The name is set in two weights rather than one: at three words it is long
 * for a lockup, and letting "Management" recede keeps "Smart Shift" as the
 * part the eye actually catches.
 */
export function Logo({ size = 36, stacked = false, tagline, className = "" }) {
  const fontSize = size * (stacked ? 0.5 : 0.4);
  return (
    <div
      className={`flex items-center gap-3 ${stacked ? "flex-col text-center gap-3" : ""} ${className}`}
    >
      <LogoMark size={size} title={PRODUCT_NAME} />
      <div className={stacked ? "" : "text-right min-w-0"}>
        <div
          className="tracking-tight leading-tight whitespace-nowrap"
          style={{ fontSize }}
        >
          <span className="font-extrabold text-content">Smart Shift</span>{" "}
          <span className="font-medium text-muted">Management</span>
        </div>
        {tagline && <p className="text-muted text-sm mt-2">{tagline}</p>}
      </div>
    </div>
  );
}

export default Logo;
