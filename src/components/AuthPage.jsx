import { useId, useState } from "react";
import { Logo, PRODUCT_TAGLINE } from "./Logo.jsx";
import { Icon } from "./icons.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import LiveSchedulePreview from "./LiveSchedulePreview.jsx";
import { Alert, Btn, Field, Input, Spinner } from "./ui.jsx";
import { PROFILES, setTermProfile } from "../lib/terms.js";

// ============================================================
// מסך הכניסה.
//
// שני חצאים שלא מתערבבים:
//
//   הצד המספר   — יושב ישירות על הקרם, בלי מסגרת. כותרת, הדגמה חיה,
//                  ושלוש עובדות. זה החומר שמשכנעים בו.
//   הצד המתחבר  — לוח אטום ומורם (`glass-raised`) שנראה כמו חפץ פיזי
//                  מונח על הנייר. זו הדלת.
//
// ההפרדה היא בחומר, לא בקו מפריד: מי שבא להתחבר מזהה את הלוח תוך רבע
// שנייה בלי לקרוא מילה, ומי שבא ללמוד לא נתקל בטופס.
//
// בטלפון הסדר מתהפך — הלוח עולה מעל הקיפול והסיפור יורד מתחתיו, כי מי
// שפותח בטלפון כמעט תמיד בא להיכנס, לא להתרשם.
//
// כל פאנל הוא `<form>` אמיתי, ולכן Enter שולח, מנהל הסיסמאות ממלא,
// והוולידציה של הדפדפן זמינה — שלושה דברים שלא מקבלים מ-div עם onKeyDown.
// ============================================================

const FEATURES = [
  { icon: "scale", text: "הוגנות נמדדת, לא מורגשת" },
  { icon: "bed", text: "חוקי מנוחה נאכפים אוטומטית" },
  { icon: "offline", text: "נקרא גם בלי קליטה" },
];

/* ------------------------------------------------------------------ *
 * קלט קוד צוות מפוצל
 *
 * שש תיבות נפרדות עונות על שאלה שהמשתמש שואל בלי לומר אותה בקול: כמה
 * תווים אמורים להיות פה. תיבה אחת ארוכה לא עונה עליה, וגם לא מראה כמה
 * נשאר.
 *
 * מתחת למכסה זה עדיין **input אחד** — התיבות הן תצוגה בלבד, וה-input
 * שקוף ומתוח מעליהן. זה מה שמשאיר הדבקה, מילוי אוטומטי, מקלדת נייד
 * וקוראי מסך עובדים; שישה inputs עם ניהול פוקוס ידני שוברים את כולם.
 * ------------------------------------------------------------------ */
const LEN = 6;

const CodeInput = ({ id, value, onChange }) => {
  const cells = Array.from({ length: LEN }, (_, i) => value[i] || "");
  const cursor = Math.min(value.length, LEN - 1);

  return (
    <div className="relative">
      <input
        id={id}
        value={value}
        onChange={onChange}
        maxLength={LEN}
        autoComplete="one-time-code"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        aria-label={`קוד צוות, ${LEN} תווים`}
        // הטקסט שקוף — לא ה-input. `opacity-0` היה מסתיר אותו גם מכלים
        // שקוראים את העץ הנגיש, ו-`sr-only` היה מוציא אותו מסדר הפוקוס.
        // כאן ה-input נשאר אלמנט גלוי לכל דבר; רק הפיקסלים שלו שקופים,
        // והתיבות שמתחתיו הן שמציירות את מה שהוקלד ואת מיקוד המקלדת.
        className="peer absolute inset-0 w-full h-full z-10 cursor-text
          bg-transparent text-transparent border-0 p-0 focus:outline-none"
        style={{ caretColor: "transparent" }}
      />
      <div aria-hidden="true" className="flex justify-center gap-1.5 sm:gap-2">
        {cells.map((c, i) => (
          <div
            key={i}
            className={`w-11 h-14 sm:w-12 sm:h-16 rounded-xl flex items-center justify-center
              font-mono font-bold text-xl transition-all duration-150 ring-1 ring-inset ${
                c
                  ? "bg-brand/10 ring-brand/40 text-content"
                  : "bg-surface-sunken ring-hairline text-faint"
              } ${
                i === cursor
                  ? "peer-focus:ring-2 peer-focus:ring-brand peer-focus:bg-brand/5 peer-focus:scale-105"
                  : ""
              }`}
          >
            {c || "·"}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * שדה סיסמה עם חשיפה
 *
 * הסיבה מספר אחת לכישלון כניסה היא הקלדה שגויה שאי אפשר לראות. כפתור
 * טקסט ולא אייקון־עין: "הצג" חד־משמעי, ואייקון עין הוא בדיוק סוג הסמל
 * ששני אנשים מפרשים הפוך.
 * ------------------------------------------------------------------ */
const PasswordInput = ({ id, ...rest }) => {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={shown ? "text" : "password"} className="pl-16" {...rest} />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-pressed={shown}
        className="absolute left-1 top-1/2 -translate-y-1/2 h-9 px-3 rounded-lg text-xs font-semibold
          text-muted hover:text-content hover:bg-surface-hover cursor-pointer transition-colors"
      >
        {shown ? "הסתר" : "הצג"}
      </button>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * דלתות
 * ------------------------------------------------------------------ */
const DoorCard = ({ icon, tone, title, body, onClick, accent = false, badge, busy }) => (
  <button
    onClick={onClick}
    disabled={busy}
    className={`w-full text-right rounded-2xl p-3.5 sm:p-4 cursor-pointer group
      transition-[background,box-shadow,transform] duration-200
      active:scale-[0.99] disabled:opacity-60 disabled:cursor-wait
      ${
        accent
          ? "bg-gradient-to-l from-brand to-brand-strong shadow-lg shadow-brand/25 hover:shadow-xl hover:shadow-brand/30"
          : "bg-surface-sunken ring-1 ring-inset ring-hairline hover:bg-surface-hover hover:ring-hairline-strong"
      }`}
  >
    <div className="flex items-center gap-3.5">
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
          accent ? "bg-mint/25 text-white" : tone
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
                accent ? "bg-white/25 text-white" : "bg-surface text-muted"
              }`}
            >
              {badge}
            </span>
          )}
        </div>
        <p className={`text-xs mt-0.5 ${accent ? "text-white/85" : "text-muted"}`}>{body}</p>
      </div>
      {/* RTL: "קדימה" מצביע שמאלה. */}
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
    className="animate-fade-up"
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

/**
 * שלוש נקודות התקדמות. השלב שהושלם מקבל וי ולא רק צבע — צבע בלבד לא נקרא
 * למי שלא מבחין בו, וזה אותו כלל שחל על דרגות הזמינות בכל שאר המוצר.
 */
const Steps = ({ current, total }) => (
  <ol
    className="flex items-center justify-center gap-2"
    aria-label={`שלב ${current + 1} מתוך ${total}`}
  >
    {Array.from({ length: total }, (_, i) => {
      const done = i < current;
      const active = i === current;
      return (
        <li key={i} className="flex items-center gap-2">
          <span
            aria-current={active ? "step" : undefined}
            className={`flex items-center justify-center rounded-full text-[10px] font-black
              transition-all duration-300 ${
                done
                  ? "w-5 h-5 bg-accent text-on-accent"
                  : active
                    ? "w-5 h-5 bg-brand text-on-brand ring-4 ring-brand/20"
                    : "w-2 h-2 bg-hairline-strong"
              }`}
          >
            {done ? <Icon name="check" size={11} strokeWidth={3} /> : active ? i + 1 : ""}
          </span>
          {i < total - 1 && (
            <span
              className={`h-px w-6 transition-colors duration-300 ${
                done ? "bg-accent" : "bg-hairline"
              }`}
            />
          )}
        </li>
      );
    })}
  </ol>
);

export default function AuthPage({
  onRegister, onLogin, onJoin, onDemo, onForgot, busy, error, clearError,
}) {
  // null | 'login' | 'register' | 'guard' | 'forgot'
  const [mode, setMode] = useState(null);
  const [step, setStep] = useState(0);
  const [local, setLocal] = useState("");
  const [sent, setSent] = useState(false);
  const id = useId();

  const [form, setForm] = useState({
    email: "", password: "", fullName: "", teamName: "", confirm: "", teamCode: "", guardName: "",
    profile: "civil",
  });

  const set = (key) => (e) => {
    const value = key === "teamCode" ? e.target.value.toUpperCase() : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setLocal("");
    clearError?.();
  };

  const go = (next) => () => {
    setMode(next);
    setStep(0);
    setLocal("");
    setSent(false);
    clearError?.();
  };

  const fail = local || error;

  /** בחירת התחום משנה את אוצר המילים מיד — עוד לפני שנוצר החשבון. */
  const pickProfile = (profileId) => {
    setForm((f) => ({ ...f, profile: profileId }));
    setTermProfile(profileId);
  };

  const submitRegister = async () => {
    if (form.password.length < 6) return setLocal("הסיסמה חייבת להיות באורך 6 תווים לפחות");
    if (form.password !== form.confirm) return setLocal("הסיסמאות לא תואמות");
    if (!form.email.trim()) return setLocal("יש להזין אימייל");
    try {
      // בהצלחה — ההורה מחליף את המסך באפליקציה, שמקבלת את מנהל המשמרת
      // החדש עם קוד הצוות שלו.
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

  /** כל שלב באשף שומר על עצמו, כדי שהשגיאה תופיע ליד השדה שגרם לה. */
  const nextStep = () => {
    if (step === 0) {
      if (!form.fullName.trim()) return setLocal("יש להזין שם מלא");
      setLocal("");
      return setStep(1);
    }
    if (step === 1) {
      setLocal("");
      return setStep(2);
    }
    return submitRegister();
  };

  const submitLogin = async () => {
    if (!form.email.trim() || !form.password) return setLocal("יש למלא אימייל וסיסמה");
    try {
      await onLogin({ email: form.email, password: form.password });
    } catch (e) {
      // NO_TEAM אינו כישלון — ההורה כבר עבר למסך השלמת ההקמה, והצגת שגיאה
      // כאן הייתה סותרת אותו.
      if (e.code !== "NO_TEAM") setLocal(e.message);
    }
  };

  const submitForgot = async () => {
    if (!form.email.trim()) return setLocal("יש להזין את האימייל שלך");
    try {
      await onForgot(form.email);
      setSent(true);
    } catch (e) {
      setLocal(e.message);
    }
  };

  const submitJoin = async () => {
    if (form.teamCode.trim().length < LEN) return setLocal(`יש להזין קוד צוות בן ${LEN} תווים`);
    if (!form.guardName.trim()) return setLocal("יש להזין את שמך המלא");
    try {
      await onJoin({ teamCode: form.teamCode, fullName: form.guardName });
    } catch (e) {
      setLocal(e.message);
    }
  };

  const doors = (
    <div className="space-y-3 animate-fade-up">
      <DoorCard
        icon="play"
        accent
        badge="ללא הרשמה"
        title="הפעל הדגמה"
        body="צוות מלא עם נתונים אמיתיים — לראות את השיבוץ עובד"
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
        tone="bg-brand/12 text-brand ring-1 ring-inset ring-brand/25"
        title="מנהל משמרת"
        body="בונה את הסידור ומשבץ — כניסה עם אימייל וסיסמה"
        onClick={go("login")}
      />
      <DoorCard
        icon="shield"
        tone="bg-accent/12 text-accent ring-1 ring-inset ring-accent/25"
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
  );

  const wizard = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        nextStep();
      }}
      className="animate-fade-up"
    >
      <div className="flex items-center justify-between gap-4 mb-5">
        <button
          type="button"
          onClick={step === 0 ? go(null) : () => setStep(step - 1)}
          className="text-muted hover:text-content text-sm flex items-center gap-1 cursor-pointer transition-colors"
        >
          <Icon name="right" size={15} /> חזרה
        </button>
        <Steps current={step} total={3} />
      </div>

      {step === 0 && (
        <div key="s0" className="animate-fade-up">
          <h2 className="text-content font-bold text-xl">נעים להכיר</h2>
          <p className="text-muted text-xs mt-1">שתי שאלות, ואפשר להתחיל</p>
          <div className="mt-5 space-y-4">
            <Field label="שמך המלא" htmlFor={`${id}-name`}>
              <Input
                id={`${id}-name`}
                placeholder="ישראל ישראלי"
                autoComplete="name"
                autoFocus
                value={form.fullName}
                onChange={set("fullName")}
              />
            </Field>
            <Field
              label="שם הצוות או האתר"
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
          </div>
        </div>
      )}

      {step === 1 && (
        <div key="s1" className="animate-fade-up">
          <h2 className="text-content font-bold text-xl">איפה אתה עובד?</h2>
          <p className="text-muted text-xs mt-1">
            נתאים את המילים בממשק. אפשר לשנות בכל רגע בהגדרות.
          </p>
          <div className="mt-5 space-y-2.5">
            {PROFILES.map((p) => {
              const on = form.profile === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pickProfile(p.id)}
                  aria-pressed={on}
                  className={`w-full text-right rounded-2xl p-4 ring-1 ring-inset cursor-pointer
                    flex items-center gap-3.5 transition-[background,box-shadow] duration-200 ${
                      on
                        ? "bg-brand/12 ring-brand/40"
                        : "bg-surface-sunken ring-hairline hover:bg-surface-hover"
                    }`}
                >
                  <span
                    className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      on
                        ? "bg-brand text-on-brand"
                        : "bg-surface ring-1 ring-inset ring-hairline text-muted"
                    }`}
                  >
                    <Icon name={on ? "check" : p.icon} size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-content text-[15px]">{p.label}</span>
                    <span className="block text-xs text-muted mt-0.5">{p.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 2 && (
        <div key="s2" className="animate-fade-up">
          <h2 className="text-content font-bold text-xl">פרטי הכניסה שלך</h2>
          <p className="text-muted text-xs mt-1">הסידור נשמר בענן וזמין מכל מכשיר</p>
          <div className="mt-5 space-y-4">
            <Field label="אימייל" htmlFor={`${id}-new-email`}>
              <Input
                id={`${id}-new-email`}
                type="email"
                placeholder="name@example.com"
                autoComplete="email"
                autoFocus
                value={form.email}
                onChange={set("email")}
              />
            </Field>
            <Field label="סיסמה" hint="לפחות 6 תווים" htmlFor={`${id}-new-pw`}>
              <PasswordInput
                id={`${id}-new-pw`}
                placeholder="••••••"
                autoComplete="new-password"
                value={form.password}
                onChange={set("password")}
              />
            </Field>
            <Field label="אימות סיסמה" htmlFor={`${id}-confirm`}>
              <PasswordInput
                id={`${id}-confirm`}
                placeholder="••••••"
                autoComplete="new-password"
                invalid={Boolean(form.confirm) && form.confirm !== form.password}
                value={form.confirm}
                onChange={set("confirm")}
              />
            </Field>
          </div>
        </div>
      )}

      {fail && (
        <div className="mt-4">
          <Alert tone="danger">{fail}</Alert>
        </div>
      )}

      <Btn type="submit" size="lg" className="w-full mt-5" loading={busy}>
        {step === 2 ? "צור צוות וקבל קוד" : "המשך"}
      </Btn>

      {step === 0 && (
        <p className="text-center text-xs text-faint mt-3">
          כבר יש לך חשבון?{" "}
          <button
            type="button"
            onClick={go("login")}
            className="text-brand hover:text-brand-strong font-semibold cursor-pointer transition-colors"
          >
            כניסה
          </button>
        </p>
      )}
    </form>
  );

  return (
    <div className="app-canvas min-h-[100dvh]" dir="rtl">
      <div
        className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-8 sm:py-12 min-h-[100dvh]
          grid lg:grid-cols-[1fr_minmax(0,24rem)] gap-10 lg:gap-16 items-center"
      >
        {/* ================= הצד המספר =================
          * יושב על הקרם בלי מסגרת. הניגוד מול הלוח האטום שלצידו הוא
          * ההפרדה — קו מפריד היה מוסיף רעש ולא מידע. */}
        <section className="order-2 lg:order-1 flex flex-col gap-7 lg:gap-9">
          <div>
            <h1 className="text-[28px] sm:text-4xl lg:text-[2.6rem] font-black text-content leading-[1.15] tracking-tight">
              מי שמסדר משמרות ביד
              <br />
              <span className="text-brand">מחזיק ארבעה דברים בראש.</span>
            </h1>
            <p className="text-muted mt-4 text-[15px] leading-relaxed max-w-md">
              מי זמין, מי לא צבר מספיק מנוחה, מי עבר את התקרה, ומי מקבל בעקביות פחות מכולם.
              NexRota מחזיקה את כולם — ומסבירה כל שיבוץ.
            </p>
          </div>

          <LiveSchedulePreview />

          <ul className="flex flex-wrap gap-x-6 gap-y-2.5 text-[13px] text-muted">
            {FEATURES.map((f) => (
              <li key={f.text} className="flex items-center gap-2">
                <Icon name={f.icon} size={15} className="text-accent flex-shrink-0" />
                {f.text}
              </li>
            ))}
          </ul>
        </section>

        {/* ================= הצד המתחבר ================= */}
        <aside className="order-1 lg:order-2 w-full max-w-md mx-auto lg:mx-0 lg:sticky lg:top-10">
          <div className="relative">
            {/* הילה רכה מאחורי הלוח — נותנת לו להתרומם מהנייר בלי צל כבד.
              * `inset-0` ולא `-inset-6`: התיבה חייבת להישאר בתוך הפריסה, אחרת
              * היא מוסיפה גלילה אופקית בטלפון. הטשטוש כבר פורש אותה החוצה
              * ויזואלית, והוא לא משפיע על ה-layout. */}
            <div
              className="absolute inset-0 -z-10 rounded-[2rem] bg-brand/15 blur-3xl
                animate-breathe motion-reduce:animate-none"
              aria-hidden="true"
            />

            <div className="glass-raised rounded-3xl p-5 sm:p-7">
              <div className="flex items-center justify-between gap-3 mb-6">
                <Logo size={38} tagline={PRODUCT_TAGLINE} />
                <ThemeToggle />
              </div>

              {mode === null && doors}
              {mode === "register" && wizard}

              {mode === "guard" && (
                <Panel
                  title="כניסת מאבטח"
                  subtitle="בלי סיסמה — רק הקוד שקיבלת ממנהל המשמרת והשם שלך"
                  onBack={go(null)}
                  onSubmit={submitJoin}
                >
                  <Field
                    label="קוד צוות"
                    hint={`${form.teamCode.length} מתוך ${LEN} תווים`}
                    htmlFor={`${id}-code`}
                  >
                    <CodeInput id={`${id}-code`} value={form.teamCode} onChange={set("teamCode")} />
                  </Field>
                  <Field
                    label="שמך המלא"
                    hint="בדיוק כמו שמנהל המשמרת רשם אותך, אם כבר הוסיף אותך"
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
              )}

              {mode === "login" && (
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
                      autoFocus
                      value={form.email}
                      onChange={set("email")}
                    />
                  </Field>
                  <Field label="סיסמה" htmlFor={`${id}-pw`}>
                    <PasswordInput
                      id={`${id}-pw`}
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
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <button
                      type="button"
                      onClick={go("register")}
                      className="text-brand hover:text-brand-strong text-sm font-semibold cursor-pointer transition-colors"
                    >
                      אין לך חשבון? פתח צוות חדש
                    </button>
                    <button
                      type="button"
                      onClick={go("forgot")}
                      className="text-muted hover:text-content text-sm cursor-pointer transition-colors"
                    >
                      שכחתי סיסמה
                    </button>
                  </div>
                </Panel>
              )}

              {mode === "forgot" && (
                <Panel
                  title="איפוס סיסמה"
                  subtitle="נשלח אליך קישור למייל. הוא תקף לשעה אחת."
                  onBack={go("login")}
                  onSubmit={submitForgot}
                >
                  {sent ? (
                    <>
                      <Alert tone="accent" title="נשלח">
                        אם קיים חשבון עם הכתובת הזו, הקישור בדרך. בדוק גם בספאם.
                      </Alert>
                      <Btn variant="secondary" className="w-full" onClick={go("login")}>
                        חזרה לכניסה
                      </Btn>
                    </>
                  ) : (
                    <>
                      <Field label="אימייל" htmlFor={`${id}-forgot`}>
                        <Input
                          id={`${id}-forgot`}
                          type="email"
                          placeholder="name@example.com"
                          autoComplete="email"
                          value={form.email}
                          onChange={set("email")}
                        />
                      </Field>
                      {fail && <Alert tone="danger">{fail}</Alert>}
                      <Btn type="submit" size="lg" className="w-full" loading={busy}>
                        שלח לי קישור
                      </Btn>
                    </>
                  )}
                </Panel>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
