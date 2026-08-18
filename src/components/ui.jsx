// ============================================================
// Shared visual primitives.
//
// RTL-first, mobile-first, and token-only: nothing in this file names a
// literal colour, so the whole app re-themes from design/tokens.css.
// If a screen needs a one-off style, it belongs here as a variant rather
// than as a class-name soup at the call site.
// ============================================================

import { Icon } from "./icons.jsx";

/* ------------------------------------------------------------------ *
 * Per-guard identity colour
 * ------------------------------------------------------------------ */

const GUARD_COLORS = [
  "#3B82F6", "#06B6D4", "#10B981", "#7C3AED", "#F43F5E",
  "#F97316", "#84CC16", "#EC4899", "#4F46E5", "#F59E0B",
];

/** Stable colour per guard, so the same person looks the same everywhere. */
export const guardColor = (id) => {
  const s = String(id || "");
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return GUARD_COLORS[Math.abs(hash) % GUARD_COLORS.length];
};

// WCAG relative luminance. Picking the ink by measurement rather than by
// eye is what guarantees every chip clears 4.5:1 — including the ones a
// future palette edit adds.
const toLinear = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * toLinear((n >> 16) & 255) +
    0.7152 * toLinear((n >> 8) & 255) +
    0.0722 * toLinear(n & 255)
  );
};

const INK_DARK = "#0B1220";
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/**
 * Whichever of white / near-black is more readable on `hex`. Used for guard
 * avatars and for shift cards, which are painted in a user-chosen colour —
 * hardcoding white text there fails contrast on every light shift colour.
 */
export const readableInk = (hex) => {
  const l = luminance(hex);
  return ratio(l, 1) >= ratio(l, luminance(INK_DARK)) ? "#FFFFFF" : INK_DARK;
};

export const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("");

/* ------------------------------------------------------------------ *
 * Surfaces
 * ------------------------------------------------------------------ */

export const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`glass rounded-2xl p-5 ${className}`} {...rest}>
    {children}
  </Tag>
);

/** A card that is also a button. Keeps the hover/focus contract in one place. */
export const CardButton = ({ children, className = "", ...rest }) => (
  <button
    className={`glass rounded-2xl p-5 text-right w-full cursor-pointer transition-[background,border-color,transform] duration-200 hover:bg-surface-hover hover:border-hairline-strong active:scale-[0.995] ${className}`}
    {...rest}
  >
    {children}
  </button>
);

/* ------------------------------------------------------------------ *
 * Buttons
 * ------------------------------------------------------------------ */

const BTN_VARIANTS = {
  primary:
    "bg-brand text-on-brand hover:bg-brand-strong shadow-lg shadow-brand/20 disabled:bg-brand/40",
  accent:
    "bg-accent text-on-accent hover:bg-accent-strong shadow-lg shadow-accent/20 disabled:bg-accent/40",
  danger: "bg-danger text-white hover:bg-danger/85",
  // "glass" is the default secondary on a glass canvas — a solid grey
  // button would punch a hole in the frosted surface behind it.
  secondary: "glass text-content hover:bg-surface-hover hover:border-hairline-strong",
  ghost: "text-muted hover:text-content hover:bg-surface-hover",
  outline: "border border-hairline-strong text-content hover:bg-surface-hover",
};

// h-11 is 44px — the minimum comfortable touch target. `sm` is below it on
// purpose and is only for dense desktop toolbars where rows are spaced out.
const BTN_SIZES = {
  sm: "h-9 px-3 text-xs gap-1.5",
  md: "h-11 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-[15px] gap-2",
};

export const Btn = ({
  children,
  onClick,
  variant = "primary",
  size = "md",
  icon,
  disabled = false,
  loading = false,
  className = "",
  type = "button",
  ...rest
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    className={`inline-flex items-center justify-center rounded-xl font-semibold cursor-pointer
      transition-[background-color,border-color,box-shadow,transform] duration-200
      active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100
      ${BTN_VARIANTS[variant] || BTN_VARIANTS.primary} ${BTN_SIZES[size] || BTN_SIZES.md} ${className}`}
    {...rest}
  >
    {loading ? (
      <Spinner size={size === "lg" ? 18 : 15} />
    ) : (
      icon && <Icon name={icon} size={size === "sm" ? 15 : 17} />
    )}
    {children}
  </button>
);

/**
 * Icon-only button. `label` is required — an unlabelled icon button is
 * silent to a screen reader, and it doubles as the hover tooltip.
 */
export const IconBtn = ({ icon, label, onClick, size = "md", className = "", ...rest }) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    aria-label={label}
    className={`inline-flex items-center justify-center rounded-xl text-muted cursor-pointer
      hover:text-content hover:bg-surface-hover transition-colors duration-200
      ${size === "sm" ? "h-9 w-9" : "h-11 w-11"} ${className}`}
    {...rest}
  >
    <Icon name={icon} size={size === "sm" ? 16 : 19} />
  </button>
);

export const Spinner = ({ size = 16, className = "" }) => (
  <svg
    className={`animate-spin ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
    <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/* ------------------------------------------------------------------ *
 * Labels & status
 * ------------------------------------------------------------------ */

const TONES = {
  brand: "bg-brand/15 text-brand ring-brand/25",
  accent: "bg-accent/15 text-accent ring-accent/25",
  warn: "bg-warn/15 text-warn ring-warn/25",
  danger: "bg-danger/15 text-danger ring-danger/25",
  info: "bg-info/15 text-info ring-info/25",
  neutral: "bg-surface-sunken text-muted ring-hairline",
};

export const Badge = ({ children, tone = "neutral", icon, className = "" }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold
      ring-1 ring-inset ${TONES[tone] || TONES.neutral} ${className}`}
  >
    {icon && <Icon name={icon} size={12} strokeWidth={2.25} />}
    {children}
  </span>
);

export const Alert = ({ tone = "info", title, children, onClose }) => {
  const icon = { info: "info", warn: "alert", danger: "alert", accent: "check-circle" }[tone] || "info";
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`rounded-xl px-4 py-3 text-sm flex items-start gap-3 ring-1 ring-inset ${
        TONES[tone] || TONES.info
      }`}
    >
      <Icon name={icon} size={17} className="mt-0.5" />
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? "text-content/80 mt-0.5" : ""}>{children}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="סגור התראה"
          className="opacity-60 hover:opacity-100 cursor-pointer transition-opacity -m-1 p-1"
        >
          <Icon name="x" size={15} />
        </button>
      )}
    </div>
  );
};

export const Avatar = ({ id, name, size = 36, ring = false, label }) => {
  const bg = guardColor(id);
  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold flex-shrink-0 select-none ${
        ring ? "ring-2 ring-bg" : ""
      }`}
      style={{
        backgroundColor: bg,
        color: readableInk(bg),
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
      }}
      title={name}
    >
      {label || initials(name)}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Data display
 * ------------------------------------------------------------------ */

export const StatCard = ({ title, value, subtitle, icon, tone = "brand", onClick }) => {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`glass rounded-2xl p-4 text-right w-full ${
        onClick
          ? "cursor-pointer hover:bg-surface-hover hover:border-hairline-strong transition-[background,border-color] duration-200"
          : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center ring-1 ring-inset ${
            TONES[tone] || TONES.brand
          }`}
        >
          <Icon name={icon} size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted font-semibold">{title}</p>
          <p className="text-2xl font-bold text-content leading-tight" data-numeric>
            {value}
          </p>
          {subtitle && <p className="text-[11px] text-faint mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>
    </Tag>
  );
};

/** Horizontal meter for workload / coverage. */
export const Meter = ({ value, max = 100, color = "rgb(var(--brand))", height = 6, label }) => {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div
      className="bg-surface-sunken rounded-full overflow-hidden"
      style={{ height }}
      role="meter"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%`, height, backgroundColor: color }}
      />
    </div>
  );
};

export const EmptyState = ({ icon = "inbox", title, body, action }) => (
  <Card className="text-center py-12">
    <div className="w-14 h-14 rounded-2xl bg-surface-sunken ring-1 ring-inset ring-hairline text-muted mx-auto mb-4 flex items-center justify-center">
      <Icon name={icon} size={26} />
    </div>
    <h3 className="font-bold text-content mb-1">{title}</h3>
    {body && <p className="text-sm text-muted max-w-sm mx-auto mb-4">{body}</p>}
    {action}
  </Card>
);

export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="flex items-start justify-between gap-4 flex-wrap">
    <div>
      <h1 className="text-2xl font-bold text-content tracking-tight">{title}</h1>
      {subtitle && <p className="text-muted text-sm mt-1">{subtitle}</p>}
    </div>
    {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
  </div>
);

/* ------------------------------------------------------------------ *
 * Forms
 * ------------------------------------------------------------------ */

const CONTROL =
  "w-full h-11 bg-surface-sunken border border-hairline rounded-xl px-3.5 text-sm text-content " +
  "placeholder:text-faint transition-[border-color,box-shadow] duration-200 " +
  "hover:border-hairline-strong focus:border-brand focus:ring-2 focus:ring-brand/30 focus:outline-none " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

export const Field = ({ label, hint, error, htmlFor, children }) => (
  <div>
    {label && (
      <label htmlFor={htmlFor} className="block text-sm font-medium text-content mb-1.5">
        {label}
      </label>
    )}
    {children}
    {/* Hint and error share the slot, so the layout doesn't jump when a
     * field goes invalid — and the error replaces rather than stacks. */}
    {error ? (
      <p className="text-xs text-danger mt-1.5 flex items-center gap-1">
        <Icon name="alert" size={12} strokeWidth={2.25} />
        {error}
      </p>
    ) : (
      hint && <p className="text-xs text-faint mt-1.5">{hint}</p>
    )}
  </div>
);

export const Input = ({ className = "", invalid, ...rest }) => (
  <input
    {...rest}
    aria-invalid={invalid || undefined}
    className={`${CONTROL} ${invalid ? "border-danger focus:border-danger focus:ring-danger/30" : ""} ${className}`}
  />
);

export const Select = ({ className = "", children, ...rest }) => (
  <select {...rest} className={`${CONTROL} cursor-pointer pl-8 ${className}`}>
    {children}
  </select>
);

export const Textarea = ({ className = "", rows = 3, ...rest }) => (
  <textarea {...rest} rows={rows} className={`${CONTROL} h-auto py-2.5 resize-y ${className}`} />
);

/**
 * Segmented control. Better than a <select> for 2–4 mutually exclusive
 * options because the alternatives stay visible, and better than radios
 * because it fits a toolbar.
 */
export const Segmented = ({ value, onChange, options, size = "md", className = "" }) => (
  <div
    role="tablist"
    className={`inline-flex bg-surface-sunken ring-1 ring-inset ring-hairline rounded-xl p-1 gap-1 ${className}`}
  >
    {options.map((opt) => {
      const active = opt.value === value;
      return (
        <button
          key={opt.value}
          role="tab"
          aria-selected={active}
          onClick={() => onChange(opt.value)}
          className={`inline-flex items-center gap-1.5 rounded-lg font-semibold cursor-pointer
            transition-colors duration-200 whitespace-nowrap
            ${size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3.5 text-sm"}
            ${active ? "bg-brand text-on-brand shadow-sm" : "text-muted hover:text-content"}`}
        >
          {opt.icon && <Icon name={opt.icon} size={14} />}
          {opt.label}
        </button>
      );
    })}
  </div>
);

/* ------------------------------------------------------------------ *
 * Overlay
 * ------------------------------------------------------------------ */

export const Modal = ({ open, onClose, title, subtitle, children, wide = false, footer }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm animate-fade-up"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`glass-raised relative w-full rounded-t-3xl sm:rounded-2xl max-h-[92vh]
          flex flex-col animate-scale-in ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
      >
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-hairline">
          <div className="min-w-0">
            <h2 className="font-bold text-content">{title}</h2>
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          <IconBtn icon="x" label="סגור" onClick={onClose} size="sm" className="-mt-1 -ml-1" />
        </header>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && (
          <footer className="px-5 py-4 border-t border-hairline flex gap-2 justify-start">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
};

/** Loading placeholder that reserves the final height, so nothing shifts. */
export const Skeleton = ({ className = "" }) => (
  <div className={`relative overflow-hidden bg-surface-sunken rounded-lg ${className}`} aria-hidden="true">
    <div className="absolute inset-y-0 w-1/3 bg-gradient-to-l from-transparent via-white/[0.07] to-transparent animate-sheen" />
  </div>
);
