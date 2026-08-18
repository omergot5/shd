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

// Two interlocking cycles, woven. Each ring is an open arc rather than a
// closed circle — the break is what makes it read as a rotation instead of
// a wedding band, and the interlace is the handover from one shift to the
// next. Blue hands off to emerald, continuously.
//
// Geometry is exact, not eyeballed: with pathLength="360" one dash unit is
// one degree, so the arc sweep and the position of the gap are both stated
// in plain degrees.

const R = 9;
const LEFT = 18.5; // ring centres, 11 apart -> they overlap by 7
const RIGHT = 29.5;
const SWEEP = 300; // degrees of ring drawn; the missing 60 is the gap
const STROKE = 4.2;

/**
 * A short piece of the *right* ring, redrawn on top of the left one at the
 * upper crossing. The rings intersect twice; painting one strand over the
 * other at exactly one of those two points is the whole trick behind a woven
 * look. Do it at both and they just sit flat on each other.
 *
 * Endpoints are the points on the right ring at 212.3° and 252.3°, which
 * bracket the upper crossing at (24, 16.88).
 */
const WEAVE = "M21.89 19.20 A9 9 0 0 1 26.76 15.43";

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
      <g strokeWidth={STROKE} strokeLinecap="round">
        {/* Right ring first, so the left one lands on top of it. */}
        <circle
          cx={RIGHT}
          cy="24"
          r={R}
          pathLength="360"
          stroke="rgb(var(--accent-strong))"
          strokeDasharray={`${SWEEP} ${360 - SWEEP}`}
          strokeDashoffset={-75} /* gap sits lower-right */
        />
        <circle
          cx={LEFT}
          cy="24"
          r={R}
          pathLength="360"
          stroke="rgb(var(--brand))"
          strokeDasharray={`${SWEEP} ${360 - SWEEP}`}
          strokeDashoffset={-255} /* gap sits upper-left */
        />
        {/* …and the weave: right ring passes back over the left at the top. */}
        <path d={WEAVE} stroke="rgb(var(--accent-strong))" />
      </g>
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
