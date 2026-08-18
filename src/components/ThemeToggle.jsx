import { setThemeMode, useTheme } from "../hooks/useTheme.js";
import { Icon } from "./icons.jsx";

// Light and dark only. "Follow system" is still the default the app boots
// with — it just isn't a button, because as a third control it read as a
// settings affordance that appeared to do nothing (its result is identical
// to whichever of the other two the OS already resolves to). Selection is
// therefore keyed off `resolved`, so a user still on system sees the
// theme they are actually looking at marked as active.
const OPTIONS = [
  { mode: "light", icon: "sun", label: "מצב בהיר" },
  { mode: "dark", icon: "moon", label: "מצב כהה" },
];

export default function ThemeToggle({ className = "" }) {
  const { resolved } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="ערכת נושא"
      className={`inline-flex items-center gap-0.5 rounded-xl bg-surface-sunken ring-1 ring-inset ring-hairline p-1 ${className}`}
    >
      {OPTIONS.map((opt) => {
        const active = resolved === opt.mode;
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
