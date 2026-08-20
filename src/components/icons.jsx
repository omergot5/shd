// ============================================================
// Icon set.
//
// One 24×24 stroke geometry, `currentColor`, no fills — so an icon
// inherits the colour and weight of whatever it sits next to, and a
// disabled or hovered parent restyles it for free.
//
// This replaced ~100 emoji. Emoji render differently on every OS, are
// announced verbatim by screen readers ("thumbs up sign"), and can't
// take a brand colour — none of which are acceptable in a product UI.
//
// Usage:
//   <Icon name="shield" />                decorative — hidden from AT
//   <Icon name="trash" label="מחק" />     meaningful — exposed with a name
// ============================================================

/**
 * Path geometry per icon. Values are either a `d` string or an array of
 * elements. Kept as data rather than 60 components so the set stays one
 * screenful and adding an icon is a one-line change.
 */
const PATHS = {
  // -- identity & security --
  shield:
    "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
  "shield-check": [
    "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
    "m9 12 2 2 4-4",
  ],
  lock: ["M7 11V7a5 5 0 0 1 10 0v4", { rect: [3, 11, 18, 11, 2] }],
  key: [
    "m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4",
    "m21 2-9.6 9.6",
    { circle: [7.5, 15.5, 5.5] },
  ],

  // -- people --
  user: ["M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", { circle: [12, 7, 4] }],
  users: [
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "M22 21v-2a4 4 0 0 0-3-3.87",
    "M16 3.13a4 4 0 0 1 0 7.75",
    { circle: [9, 7, 4] },
  ],
  briefcase: [
    "M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",
    { rect: [2, 7, 20, 14, 2] },
  ],

  // -- time & schedule --
  calendar: ["M8 2v4", "M16 2v4", "M3 10h18", { rect: [3, 4, 18, 18, 2] }],
  clock: ["M12 6v6l4 2", { circle: [12, 12, 10] }],
  moon: "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9",
  sun: [
    "M12 2v2",
    "M12 20v2",
    "m4.93 4.93 1.41 1.41",
    "m17.66 17.66 1.41 1.41",
    "M2 12h2",
    "M20 12h2",
    "m6.34 17.66-1.41 1.41",
    "m19.07 4.93-1.41 1.41",
    { circle: [12, 12, 4] },
  ],
  bed: ["M2 4v16", "M2 8h18a2 2 0 0 1 2 2v10", "M2 17h20", "M6 8v9"],

  // -- state --
  check: "M20 6 9 17l-5-5",
  "check-circle": ["m9 12 2 2 4-4", { circle: [12, 12, 10] }],
  x: ["M18 6 6 18", "m6 6 12 12"],
  "x-circle": ["m15 9-6 6", "m9 9 6 6", { circle: [12, 12, 10] }],
  help: ["M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", "M12 17h.01", { circle: [12, 12, 10] }],
  grid: [{ rect: [3, 3, 7, 7, 1] }, { rect: [14, 3, 7, 7, 1] }, { rect: [3, 14, 7, 7, 1] }, { rect: [14, 14, 7, 7, 1] }],
  bell: ["M10.27 21a2 2 0 0 0 3.46 0", "M4 17h16l-1.5-2.4a4 4 0 0 1-.5-2V9a6 6 0 1 0-12 0v3.6a4 4 0 0 1-.5 2z"],
  star: "M11.53 3.1a.53.53 0 0 1 .94 0l2.34 4.74 5.23.76a.53.53 0 0 1 .29.9l-3.78 3.69.89 5.2a.53.53 0 0 1-.76.56L12 16.5l-4.68 2.46a.53.53 0 0 1-.76-.56l.9-5.2-3.79-3.7a.53.53 0 0 1 .3-.9l5.22-.75z",
  info: ["M12 16v-4", "M12 8h.01", { circle: [12, 12, 10] }],
  alert: [
    "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",
    "M12 9v4",
    "M12 17h.01",
  ],

  // -- actions --
  plus: ["M5 12h14", "M12 5v14"],
  undo: ["M3 7v6h6", "M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"],
  image: [{ rect: [3, 3, 18, 18, 2] }, { circle: [9, 9, 2] }, "m21 15-4.6-4.6a2 2 0 0 0-2.8 0L3 21"],
  trash: [
    "M3 6h18",
    "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",
    "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
    "M10 11v6",
    "M14 11v6",
  ],
  pencil: [
    "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
    "m15 5 4 4",
  ],
  copy: [
    "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",
    { rect: [8, 8, 14, 14, 2] },
  ],
  send: ["m22 2-7 20-4-9-9-4z", "M22 2 11 13"],
  share: [
    "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8",
    "M16 6l-4-4-4 4",
    "M12 2v13",
  ],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "m16 17 5-5-5-5", "M21 12H9"],
  search: ["m21 21-4.3-4.3", { circle: [11, 11, 8] }],
  refresh: [
    "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",
    "M21 3v5h-5",
    "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",
    "M8 16H3v5",
  ],
  swap: ["M8 3 4 7l4 4", "M4 7h16", "m16 21 4-4-4-4", "M20 17H4"],
  shuffle: [
    "M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.8-1.1 2-1.7 3.3-1.7H22",
    "m18 2 4 4-4 4",
    "M2 6h1.9c1.5 0 2.9.9 3.6 2.2",
    "M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8",
    "m18 14 4 4-4 4",
  ],
  play: "m7 4 13 8-13 8z",

  // -- domain --
  zap: "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z",
  scale: [
    "m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1",
    "m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1",
    "M7 21h10",
    "M12 3v18",
    "M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2",
  ],
  target: [{ circle: [12, 12, 10] }, { circle: [12, 12, 6] }, { circle: [12, 12, 2] }],
  pin: [
    "M12 17v5",
    "M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z",
  ],
  "map-pin": [
    "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",
    { circle: [12, 10, 3] },
  ],
  clipboard: [
    "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",
    "M12 11h4",
    "M12 16h4",
    "M8 11h.01",
    "M8 16h.01",
    { rect: [8, 2, 8, 4, 1] },
  ],
  inbox: [
    "M22 12h-6l-2 3h-4l-2-3H2",
    "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  ],
  message: "M7.9 20A9 9 0 1 0 4 16.1L2 22z",
  sliders: [
    "M4 21v-7",
    "M4 10V3",
    "M12 21v-9",
    "M12 8V3",
    "M20 21v-5",
    "M20 12V3",
    "M1 14h6",
    "M9 8h6",
    "M17 16h6",
  ],
  chart: ["M3 3v16a2 2 0 0 0 2 2h16", "M18 17V9", "M13 17V5", "M8 17v-3"],
  trending: ["M16 7h6v6", "m22 7-8.5 8.5-5-5L2 17"],
  sparkles: [
    "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z",
    "M20 3v4",
    "M22 5h-4",
  ],
  rocket: [
    "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91 0",
    "m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2",
    "M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0",
    "M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5",
  ],
  wrench:
    "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
  offline: [
    "m2 2 20 20",
    "M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193",
    "M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07",
  ],

  // -- navigation --
  // RTL note: "back" points right, "forward" points left. Callers name the
  // direction they want visually, not semantically, so nothing flips twice.
  left: "m15 18-6-6 6-6",
  right: "m9 18 6-6-6-6",
  down: "m6 9 6 6 6-6",
  up: "m18 15-6-6-6 6",
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
};

export const ICON_NAMES = Object.keys(PATHS);

/** Renders one geometry entry: a `d` string, a rect spec, or a circle spec. */
function Shape({ spec, i }) {
  if (typeof spec === "string") return <path key={i} d={spec} />;
  if (spec.rect) {
    const [x, y, width, height, rx] = spec.rect;
    return <rect key={i} x={x} y={y} width={width} height={height} rx={rx} />;
  }
  const [cx, cy, r] = spec.circle;
  return <circle key={i} cx={cx} cy={cy} r={r} />;
}

/**
 * @param name    key from PATHS
 * @param size    px; 16 inline with text, 20 in buttons, 24+ standalone
 * @param label   accessible name. Omit for decorative icons that sit next to
 *                text saying the same thing — those get aria-hidden instead.
 * @param filled  solid rather than stroked (only `play` is designed for it)
 */
export function Icon({ name, size = 20, label, className = "", strokeWidth = 1.75, filled = false }) {
  const geometry = PATHS[name];
  if (!geometry) {
    // Loud in development, invisible in production — a typo'd icon name
    // should never ship a blank square, but it also should never crash.
    if (import.meta.env?.DEV) console.warn(`Icon: unknown name "${name}"`);
    return null;
  }
  const shapes = Array.isArray(geometry) ? geometry : [geometry];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`flex-shrink-0 ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {shapes.map((spec, i) => (
        <Shape key={i} spec={spec} i={i} />
      ))}
    </svg>
  );
}

/**
 * A status dot. Replaces the coloured-circle emoji — and unlike them it
 * is never the *only* carrier of meaning: every caller pairs it with a
 * text label, per WCAG 1.4.1 (colour is not used alone).
 */
export const Dot = ({ color = "currentColor", size = 8, className = "" }) => (
  <span
    className={`inline-block rounded-full flex-shrink-0 ${className}`}
    style={{ width: size, height: size, backgroundColor: color }}
    aria-hidden="true"
  />
);
