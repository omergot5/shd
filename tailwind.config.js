/** @type {import('tailwindcss').Config} */

// Colours are declared once in src/design/tokens.css and surfaced here by
// role. Writing `bg-brand` instead of `bg-blue-600` is what lets the whole
// app re-theme from a single file — and it means a class name can never
// silently disagree with the design system.
const channel = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: channel("bg"),
        "bg-deep": channel("bg-deep"),

        // Glass surfaces carry their own alpha — no opacity modifier.
        surface: "var(--surface)",
        "surface-hover": "var(--surface-hover)",
        "surface-raised": "var(--surface-raised)",
        "surface-sunken": "var(--surface-sunken)",

        hairline: "var(--hairline)",
        "hairline-strong": "var(--hairline-strong)",

        content: channel("text"),
        muted: channel("text-muted"),
        faint: channel("text-faint"),

        brand: channel("brand"),
        "brand-strong": channel("brand-strong"),
        "on-brand": channel("on-brand"),

        // קישוט בלבד — הטורקיז והמנטה של הלוגו. לא נושאים טקסט.
        "brand-soft": channel("brand-soft"),
        mint: channel("mint"),

        accent: channel("accent"),
        "accent-strong": channel("accent-strong"),
        "on-accent": channel("on-accent"),

        warn: channel("warn"),
        danger: channel("danger"),
        info: channel("info"),
      },
      borderColor: {
        DEFAULT: "var(--hairline)",
      },
      backdropBlur: {
        glass: "var(--blur)",
        "glass-strong": "var(--blur-strong)",
      },
      boxShadow: {
        glass: "var(--shadow-glass)",
        raised: "var(--shadow-raised)",
      },
      ringColor: {
        DEFAULT: "rgb(var(--ring) / 0.55)",
      },
      fontFamily: {
        // Rubik and Heebo are the two Google faces with genuinely good
        // Hebrew; the system stack covers them if the font never loads.
        sans: [
          "Rubik",
          "Heebo",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Arimo",
          "sans-serif",
        ],
        // Tabular figures for schedules, scores and counters, so numbers
        // stop shifting sideways as they update.
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "none" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "none" },
        },
        sheen: {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(220%)" },
        },
        // The undo window, drawn as it drains. RTL: it empties toward the left.
        drain: {
          from: { transform: "scaleX(1)" },
          to: { transform: "scaleX(0)" },
        },
        // תא בסידור החי במסך הכניסה: נכנס, נשאר, ומתפוגג לקראת סוף המחזור.
        "slot-in": {
          "0%": { opacity: "0", transform: "translateY(4px) scale(0.9)" },
          "6%": { opacity: "1", transform: "none" },
          "82%": { opacity: "1", transform: "none" },
          "94%, 100%": { opacity: "0", transform: "translateY(-3px) scale(0.96)" },
        },
        // הילה נושמת מאחורי הלוגו. איטית מספיק כדי לא לתפוס תשומת לב.
        breathe: {
          "0%, 100%": { opacity: "0.35", transform: "scale(1)" },
          "50%": { opacity: "0.6", transform: "scale(1.08)" },
        },
      },
      animation: {
        "fade-up": "fade-up 260ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "scale-in": "scale-in 200ms cubic-bezier(0.22, 1, 0.36, 1) both",
        sheen: "sheen 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite",
        drain: "drain 8s linear forwards",
        "slot-in": "slot-in 7s cubic-bezier(0.22, 1, 0.36, 1) infinite both",
        breathe: "breathe 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
