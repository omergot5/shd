import { setThemeMode, useTheme } from "../hooks/useTheme.js";
import { Icon } from "./icons.jsx";

// Three buttons rather than one switch, because the underlying model has
// three states. A two-state switch would have to lie about "follow system",
// and a user who picks dark at noon expects it to still be dark at midnight.
const OPTIONS = [
  { mode: "system", icon: "sliders", label: "לפי המערכת" },
  { mode: "light", icon: "sun", label: "מצב בהיר" },
  { mode: "dark", icon: "moon", label: "מצב כהה" },
];

export default function ThemeToggle({ className = "" }) {
  const { mode } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="ערכת נושא"
      className={`inline-flex items-center gap-0.5 rounded-xl bg-surface-sunken ring-1 ring-inset ring-hairline p-1 ${className}`}
    >
      {OPTIONS.map((opt) => {
        const active = mode === opt.mode;
        return (
          <button
            key={opt.mode}
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            title={opt.label}
            onClick={() => setThemeMode(opt.mode)}
            className={`h-8 w-8 rounded-lg inline-flex items-center justify-center cursor-pointer
              transition-colors duration-200
              ${active ? "bg-brand text-on-brand" : "text-muted hover:text-content"}`}
          >
            <Icon name={opt.icon} size={15} />
          </button>
        );
      })}
    </div>
  );
}
