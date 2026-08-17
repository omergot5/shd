// Shared visual primitives. Everything is RTL-first and mobile-first.

const GUARD_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444",
  "#06B6D4", "#F97316", "#84CC16", "#EC4899", "#6366F1",
];

/** Stable colour per guard so the same person looks the same everywhere. */
export const guardColor = (id) => {
  const s = String(id || "");
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return GUARD_COLORS[Math.abs(hash) % GUARD_COLORS.length];
};

export const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("");

export const Badge = ({ children, color = "blue", className = "" }) => {
  const cls = {
    blue: "bg-blue-100 text-blue-800", green: "bg-green-100 text-green-800",
    yellow: "bg-amber-100 text-amber-800", red: "bg-red-100 text-red-800",
    gray: "bg-gray-100 text-gray-600", purple: "bg-purple-100 text-purple-800",
    indigo: "bg-indigo-100 text-indigo-800",
  }[color] || "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cls} ${className}`}>
      {children}
    </span>
  );
};

export const Card = ({ children, className = "", ...rest }) => (
  <div
    className={`bg-white border border-gray-200/80 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${className}`}
    {...rest}
  >
    {children}
  </div>
);

export const Btn = ({
  children, onClick, variant = "primary", size = "md",
  disabled = false, loading = false, className = "", type = "button", title,
}) => {
  const v = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 shadow-sm",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50",
    danger: "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50",
    success: "bg-green-600 text-white hover:bg-green-700 disabled:opacity-50",
    ghost: "text-gray-600 hover:bg-gray-100 disabled:opacity-50",
    outline: "border border-gray-300 text-gray-700 hover:bg-gray-50 bg-white disabled:opacity-50",
  }[variant] || "";
  const s = {
    sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm", lg: "px-6 py-3.5 text-base",
  }[size] || "";
  return (
    <button
      type={type} onClick={onClick} disabled={disabled || loading} title={title}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed ${v} ${s} ${className}`}
    >
      {loading && <Spinner size={size === "lg" ? 18 : 14} />}
      {children}
    </button>
  );
};

export const Spinner = ({ size = 16, className = "" }) => (
  <svg className={`animate-spin ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
    <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const StatCard = ({ title, value, subtitle, icon, color = "blue", onClick }) => {
  const cls = {
    blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600",
    yellow: "bg-amber-50 text-amber-600", red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
  }[color] || "bg-gray-50 text-gray-600";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`bg-white border border-gray-200/80 rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-right w-full ${
        onClick ? "hover:border-blue-300 hover:shadow-md transition-all cursor-pointer" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-xl ${cls} flex items-center justify-center text-xl flex-shrink-0`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-gray-500 font-semibold">{title}</p>
          <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
          {subtitle && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>
    </Tag>
  );
};

export const Avatar = ({ id, name, size = 36, ring = false, label }) => (
  <div
    className={`rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 shadow-sm ${
      ring ? "ring-2 ring-white ring-offset-1" : ""
    }`}
    style={{ backgroundColor: guardColor(id), width: size, height: size, fontSize: size * 0.36 }}
    title={name}
  >
    {label || initials(name)}
  </div>
);

export const Field = ({ label, hint, error, children }) => (
  <div>
    {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}
    {children}
    {hint && !error && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
  </div>
);

export const Input = (props) => (
  <input
    {...props}
    className={`w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-shadow disabled:bg-gray-50 disabled:text-gray-400 ${props.className || ""}`}
  />
);

export const Select = (props) => (
  <select
    {...props}
    className={`w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 ${props.className || ""}`}
  />
);

export const EmptyState = ({ icon = "📭", title, body, action }) => (
  <Card className="text-center py-12">
    <div className="text-5xl mb-3">{icon}</div>
    <h3 className="font-bold text-gray-800 mb-1">{title}</h3>
    {body && <p className="text-sm text-gray-500 max-w-sm mx-auto mb-4">{body}</p>}
    {action}
  </Card>
);

export const Alert = ({ tone = "info", children, onClose }) => {
  const cls = {
    info: "bg-blue-50 border-blue-200 text-blue-800",
    warn: "bg-amber-50 border-amber-200 text-amber-800",
    error: "bg-red-50 border-red-200 text-red-700",
    success: "bg-green-50 border-green-200 text-green-800",
  }[tone];
  return (
    <div className={`border rounded-xl px-4 py-3 text-sm flex items-start gap-3 ${cls}`} role="alert">
      <div className="flex-1">{children}</div>
      {onClose && (
        <button onClick={onClose} className="opacity-50 hover:opacity-100 text-lg leading-none" aria-label="סגור">
          ×
        </button>
      )}
    </div>
  );
};

export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="flex items-start justify-between gap-4 flex-wrap">
    <div>
      <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
      {subtitle && <p className="text-gray-500 text-sm mt-0.5">{subtitle}</p>}
    </div>
    {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
  </div>
);

/** Horizontal meter used for workload / coverage bars. */
export const Meter = ({ value, max = 100, color = "#3B82F6", height = 6 }) => (
  <div className="bg-gray-100 rounded-full overflow-hidden" style={{ height }}>
    <div
      className="rounded-full transition-all duration-500"
      style={{ width: `${Math.max(0, Math.min(100, (value / (max || 1)) * 100))}%`, height, backgroundColor: color }}
    />
  </div>
);

export const Modal = ({ open, onClose, title, children, wide = false }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative bg-white w-full rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-auto ${
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        }`}
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <h2 className="font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none" aria-label="סגור">
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};
