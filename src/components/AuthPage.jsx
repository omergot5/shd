import { useId, useState } from "react";
import { Logo } from "./Logo.jsx";
import { Icon } from "./icons.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import { Alert, Btn, Field, Input, Spinner } from "./ui.jsx";

// ============================================================
// Entry point. Three deliberately distinct doors:
//   demo       — one click, nothing to fill in, fully seeded team
//   supervisor — email + password, works from any device
//   guard      — team code + name, no password to remember
//
// Each panel is a real <form>, so Enter submits, password managers fill,
// and the browser's own validation is available — none of which you get
// from a div with an onKeyDown listener.
// ============================================================

const DoorCard = ({ icon, tone, title, body, onClick, accent = false, badge, busy }) => (
  <button
    onClick={onClick}
    disabled={busy}
    className={`w-full text-right rounded-2xl p-4 cursor-pointer group
      transition-[background,border-color,transform,box-shadow] duration-200
      active:scale-[0.99] disabled:opacity-60 disabled:cursor-wait
      ${
        accent
          ? "bg-brand hover:bg-brand-strong border border-brand-strong/50 shadow-xl shadow-brand/25"
          : "glass hover:bg-surface-hover hover:border-hairline-strong"
      }`}
  >
    <div className="flex items-center gap-3.5">
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
          accent ? "bg-white/20 text-white" : tone
        }`}
      >
        <Icon name={icon} size={21} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className={`font-bold text-[15px] ${accent ? "text-white" : "text-content"}`}>
            {title}
          </h2>
          {badge && (
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                accent ? "bg-white/25 text-white" : "bg-surface-sunken text-muted"
              }`}
            >
              {badge}
            </span>
          )}
        </div>
        <p className={`text-xs mt-0.5 ${accent ? "text-white/80" : "text-muted"}`}>{body}</p>
      </div>
      {/* RTL: "forward" points left. */}
      <Icon
        name="left"
        size={18}
        className={`transition-transform duration-200 group-hover:-translate-x-0.5 ${
          accent ? "text-white/70" : "text-faint"
        }`}
      />
    </div>
  </button>
);

const Panel = ({ title, subtitle, onBack, onSubmit, children }) => (
  <form
    onSubmit={(e) => {
      e.preventDefault();
      onSubmit();
    }}
    className="glass rounded-2xl p-6 animate-fade-up"
  >
    <button
      type="button"
      onClick={onBack}
      className="text-muted hover:text-content text-sm mb-4 flex items-center gap-1 cursor-pointer transition-colors"
    >
      <Icon name="right" size={15} /> חזרה
    </button>
    <h2 className="text-content font-bold text-xl">{title}</h2>
    {subtitle && <p className="text-muted text-xs mt-1">{subtitle}</p>}
    <div className="mt-5 space-y-4">{children}</div>
  </form>
);

export default function AuthPage({ onRegister, onLogin, onJoin, onDemo, busy, error, clearError }) {
  const [mode, setMode] = useState(null); // null | 'login' | 'register' | 'guard'
  const [local, setLocal] = useState("");
  const id = useId();

  const [form, setForm] = useState({
    email: "", password: "", fullName: "", teamName: "", confirm: "", teamCode: "", guardName: "",
  });

  const set = (key) => (e) => {
    const value = key === "teamCode" ? e.target.value.toUpperCase() : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setLocal("");
    clearError?.();
  };

  const go = (next) => () => {
    setMode(next);
    setLocal("");
    clearError?.();
  };

  const fail = local || error;

  const submitRegister = async () => {
    if (!form.fullName.trim()) return setLocal("יש להזין שם מלא");
    if (!form.email.trim()) return setLocal("יש להזין אימייל");
    if (form.password.length < 6) return setLocal("הסיסמה חייבת להיות באורך 6 תווים לפחות");
    if (form.password !== form.confirm) return setLocal("הסיסמאות לא תואמות");
    try {
      // On success the parent swaps this screen for the app, which greets
      // the new supervisor with their team code.
      await onRegister({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        teamName: form.teamName,
      });
    } catch (e) {
      setLocal(
        e.code === "EMAIL_CONFIRMATION_REQUIRED"
          ? "נשלח אליך מייל אימות — אשר אותו ואז התחבר"
          : e.message
      );
    }
  };

  const submitLogin = async () => {
    if (!form.email.trim() || !form.password) return setLocal("יש למלא אימייל וסיסמה");
    try {
      await onLogin({ email: form.email, password: form.password });
    } catch (e) {
      setLocal(e.code === "NO_TEAM" ? "החשבון קיים אך אין לו צוות — הירשם מחדש" : e.message);
    }
  };

  const submitJoin = async () => {
    if (form.teamCode.trim().length < 6) return setLocal("יש להזין קוד צוות בן 6 תווים");
    if (!form.guardName.trim()) return setLocal("יש להזין את שמך המלא");
    try {
      await onJoin({ teamCode: form.teamCode, fullName: form.guardName });
    } catch (e) {
      setLocal(e.message);
    }
  };

  return (
    <div className="app-canvas min-h-screen flex flex-col items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8 animate-fade-up">
          <Logo size={64} stacked tagline="שיבוץ משמרות חכם לצוותי אבטחה" />
        </div>

        {!mode ? (
          <div className="space-y-3 animate-fade-up">
            <DoorCard
              icon="play"
              accent
              badge="ללא הרשמה"
              title="הפעל הדגמה"
              body="צוות מלא עם נתונים אמיתיים — לראות את השיבוץ החכם עובד"
              onClick={onDemo}
              busy={busy}
            />

            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-hairline" />
              <span className="text-faint text-[11px]">או התחבר לצוות שלך</span>
              <div className="flex-1 h-px bg-hairline" />
            </div>

            <DoorCard
              icon="briefcase"
              tone="bg-warn/15 text-warn ring-1 ring-inset ring-warn/25"
              title='מנהל משמרת (אחמ"ש)'
              body="בונה את הסידור ומשבץ — כניסה עם אימייל וסיסמה"
              onClick={go("login")}
            />
            <DoorCard
              icon="shield"
              tone="bg-brand/15 text-brand ring-1 ring-inset ring-brand/25"
              title="מאבטח"
              body="מגיש זמינות וצופה בסידור — כניסה עם קוד צוות בלבד"
              onClick={go("guard")}
            />

            {busy && (
              <div className="flex items-center justify-center gap-2 text-muted text-sm pt-2">
                <Spinner size={16} /> מכין את ההדגמה…
              </div>
            )}
            {fail && <Alert tone="danger">{fail}</Alert>}
          </div>
        ) : mode === "guard" ? (
          <Panel
            title="כניסת מאבטח"
            subtitle="בלי סיסמה — רק הקוד שקיבלת מהאחמ״ש והשם שלך"
            onBack={go(null)}
            onSubmit={submitJoin}
          >
            <Field label="קוד צוות" hint="6 תווים, לדוגמה: K7M2XQ" htmlFor={`${id}-code`}>
              <Input
                id={`${id}-code`}
                className="font-mono tracking-[0.35em] text-center text-lg uppercase"
                placeholder="______"
                maxLength={6}
                autoComplete="off"
                autoCapitalize="characters"
                value={form.teamCode}
                onChange={set("teamCode")}
              />
            </Field>
            <Field
              label="שמך המלא"
              hint="בדיוק כמו שהאחמ״ש רשם אותך, אם כבר הוסיף אותך"
              htmlFor={`${id}-guard-name`}
            >
              <Input
                id={`${id}-guard-name`}
                placeholder="ישראל ישראלי"
                autoComplete="name"
                value={form.guardName}
                onChange={set("guardName")}
              />
            </Field>
            {fail && <Alert tone="danger">{fail}</Alert>}
            <Btn type="submit" size="lg" className="w-full" loading={busy}>
              כניסה למערכת
            </Btn>
          </Panel>
        ) : mode === "login" ? (
          <Panel
            title="כניסת מנהל משמרת"
            subtitle="הסידור שלך נשמר בענן וזמין מכל מכשיר"
            onBack={go(null)}
            onSubmit={submitLogin}
          >
            <Field label="אימייל" htmlFor={`${id}-email`}>
              <Input
                id={`${id}-email`}
                type="email"
                placeholder="name@example.com"
                autoComplete="email"
                value={form.email}
                onChange={set("email")}
              />
            </Field>
            <Field label="סיסמה" htmlFor={`${id}-pw`}>
              <Input
                id={`${id}-pw`}
                type="password"
                placeholder="••••••"
                autoComplete="current-password"
                value={form.password}
                onChange={set("password")}
              />
            </Field>
            {fail && <Alert tone="danger">{fail}</Alert>}
            <Btn type="submit" size="lg" className="w-full" loading={busy}>
              כניסה
            </Btn>
            <button
              type="button"
              onClick={go("register")}
              className="w-full text-brand hover:text-brand-strong text-sm font-medium pt-1 cursor-pointer transition-colors"
            >
              אין לך חשבון? פתח צוות חדש
            </button>
          </Panel>
        ) : (
          <Panel
            title="פתיחת צוות חדש"
            subtitle="תוך רגע יהיה לך קוד צוות לשלוח למאבטחים"
            onBack={go(null)}
            onSubmit={submitRegister}
          >
            <Field label="שמך המלא" htmlFor={`${id}-name`}>
              <Input
                id={`${id}-name`}
                placeholder="ישראל ישראלי"
                autoComplete="name"
                value={form.fullName}
                onChange={set("fullName")}
              />
            </Field>
            <Field
              label="שם הצוות / האתר"
              hint="אופציונלי — למשל: מוקד תל אביב"
              htmlFor={`${id}-team`}
            >
              <Input
                id={`${id}-team`}
                placeholder="הצוות שלי"
                autoComplete="organization"
                value={form.teamName}
                onChange={set("teamName")}
              />
            </Field>
            <Field label="אימייל" htmlFor={`${id}-new-email`}>
              <Input
                id={`${id}-new-email`}
                type="email"
                placeholder="name@example.com"
                autoComplete="email"
                value={form.email}
                onChange={set("email")}
              />
            </Field>
            <Field label="סיסמה" hint="לפחות 6 תווים" htmlFor={`${id}-new-pw`}>
              <Input
                id={`${id}-new-pw`}
                type="password"
                placeholder="••••••"
                autoComplete="new-password"
                value={form.password}
                onChange={set("password")}
              />
            </Field>
            <Field label="אימות סיסמה" htmlFor={`${id}-confirm`}>
              <Input
                id={`${id}-confirm`}
                type="password"
                placeholder="••••••"
                autoComplete="new-password"
                invalid={Boolean(form.confirm) && form.confirm !== form.password}
                value={form.confirm}
                onChange={set("confirm")}
              />
            </Field>
            {fail && <Alert tone="danger">{fail}</Alert>}
            <Btn type="submit" size="lg" className="w-full" loading={busy}>
              צור צוות וקבל קוד
            </Btn>
          </Panel>
        )}

        <div className="flex justify-center mt-8">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
