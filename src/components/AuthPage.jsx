import { useState } from "react";
import { Btn, Field, Input, Alert, Spinner } from "./ui.jsx";

// ============================================================
// Entry point. Three deliberately distinct doors:
//   demo      — one click, nothing to fill in, fully seeded team
//   supervisor— email + password, works from any device
//   guard     — team code + name, no password to remember
// ============================================================

const Logo = () => (
  <div className="text-center mb-8">
    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-900/40 text-3xl">
      🛡️
    </div>
    <h1 className="text-3xl font-extrabold text-white tracking-tight">Guardian Shifts</h1>
    <p className="text-blue-300/80 mt-1.5 text-sm">שיבוץ משמרות חכם לצוותי אבטחה</p>
  </div>
);

const DoorCard = ({ icon, iconBg, title, body, onClick, accent = false, badge }) => (
  <button
    onClick={onClick}
    className={`w-full text-right rounded-2xl p-4 transition-all group border ${
      accent
        ? "bg-blue-600 hover:bg-blue-500 border-blue-400/40 shadow-lg shadow-blue-900/30"
        : "bg-white/[0.07] hover:bg-white/[0.14] border-white/15"
    }`}
  >
    <div className="flex items-center gap-3.5">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-white font-bold text-[15px]">{title}</h2>
          {badge && (
            <span className="text-[10px] font-bold bg-white/20 text-white px-1.5 py-0.5 rounded">{badge}</span>
          )}
        </div>
        <p className={`text-xs mt-0.5 ${accent ? "text-blue-100" : "text-blue-300/80"}`}>{body}</p>
      </div>
      <span className="text-white/40 group-hover:text-white transition-colors text-lg">‹</span>
    </div>
  </button>
);

const Panel = ({ title, subtitle, onBack, children }) => (
  <div className="bg-white/[0.07] backdrop-blur border border-white/15 rounded-2xl p-6">
    <button onClick={onBack} className="text-blue-300 hover:text-white text-sm mb-4 flex items-center gap-1">
      › חזרה
    </button>
    <h2 className="text-white font-bold text-xl">{title}</h2>
    {subtitle && <p className="text-blue-300/80 text-xs mt-1 mb-5">{subtitle}</p>}
    <div className="mt-5 space-y-4">{children}</div>
  </div>
);

const darkInput =
  "w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 text-sm transition-shadow";

const DarkField = ({ label, hint, children }) => (
  <div>
    <label className="block text-blue-200 text-sm mb-1.5 font-medium">{label}</label>
    {children}
    {hint && <p className="text-blue-400/60 text-xs mt-1.5">{hint}</p>}
  </div>
);

export default function AuthPage({ onRegister, onLogin, onJoin, onDemo, busy, error, clearError }) {
  const [mode, setMode] = useState(null); // null | 'login' | 'register' | 'guard'
  const [local, setLocal] = useState("");

  const [form, setForm] = useState({
    email: "", password: "", fullName: "", teamName: "", confirm: "", teamCode: "", guardName: "",
  });
  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setLocal("");
    clearError?.();
  };

  const reset = () => {
    setMode(null);
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
      // On success the parent swaps this screen for the app, which greets the
      // new supervisor with their team code.
      await onRegister({
        email: form.email, password: form.password,
        fullName: form.fullName, teamName: form.teamName,
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
    if (form.teamCode.trim().length < 4) return setLocal("יש להזין קוד צוות בן 6 תווים");
    if (!form.guardName.trim()) return setLocal("יש להזין את שמך המלא");
    try {
      await onJoin({ teamCode: form.teamCode, fullName: form.guardName });
    } catch (e) {
      setLocal(e.message);
    }
  };

  const onEnter = (fn) => (e) => e.key === "Enter" && fn();

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4"
      dir="rtl"
    >
      <div className="w-full max-w-md">
        <Logo />

        {!mode ? (
          /* ── door selection ── */
          <div className="space-y-3">
            <DoorCard
              icon="🎬" iconBg="bg-white/20" accent badge="ללא הרשמה"
              title="הפעל הדגמה"
              body="צוות מלא עם נתונים אמיתיים — לראות את השיבוץ החכם עובד"
              onClick={onDemo}
            />

            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-white/30 text-[11px]">או התחבר לצוות שלך</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <DoorCard
              icon="👔" iconBg="bg-amber-500"
              title='מנהל משמרת (אחמ"ש)'
              body="בונה את הסידור ומשבץ — כניסה עם אימייל וסיסמה"
              onClick={() => setMode("login")}
            />
            <DoorCard
              icon="👮" iconBg="bg-blue-500"
              title="מאבטח"
              body="מגיש זמינות וצופה בסידור — כניסה עם קוד צוות בלבד"
              onClick={() => setMode("guard")}
            />

            {busy && (
              <div className="flex items-center justify-center gap-2 text-blue-300 text-sm pt-2">
                <Spinner size={16} /> מכין את ההדגמה…
              </div>
            )}
            {fail && <Alert tone="error">{fail}</Alert>}
          </div>
        ) : mode === "guard" ? (
          <Panel
            title="👮 כניסת מאבטח"
            subtitle="בלי סיסמה — רק הקוד שקיבלת מהאחמ״ש והשם שלך"
            onBack={reset}
          >
            <DarkField label="קוד צוות" hint="6 תווים, לדוגמה: K7M2XQ">
              <input
                className={`${darkInput} font-mono tracking-[0.3em] text-center text-lg uppercase`}
                placeholder="______" maxLength={6} value={form.teamCode}
                onChange={(e) => {
                  setForm((f) => ({ ...f, teamCode: e.target.value.toUpperCase() }));
                  setLocal(""); clearError?.();
                }}
                onKeyDown={onEnter(submitJoin)}
              />
            </DarkField>
            <DarkField label="שמך המלא" hint="בדיוק כמו שהאחמ״ש רשם אותך, אם כבר הוסיף אותך">
              <input
                className={darkInput} placeholder="ישראל ישראלי" value={form.guardName}
                onChange={set("guardName")} onKeyDown={onEnter(submitJoin)}
              />
            </DarkField>
            {fail && <Alert tone="error">{fail}</Alert>}
            <Btn size="lg" className="w-full" onClick={submitJoin} loading={busy}>
              כניסה למערכת
            </Btn>
          </Panel>
        ) : mode === "login" ? (
          <Panel title="🔐 כניסת מנהל משמרת" subtitle="הסידור שלך נשמר בענן וזמין מכל מכשיר" onBack={reset}>
            <DarkField label="אימייל">
              <input
                className={darkInput} type="email" placeholder="name@example.com" autoComplete="email"
                value={form.email} onChange={set("email")} onKeyDown={onEnter(submitLogin)}
              />
            </DarkField>
            <DarkField label="סיסמה">
              <input
                className={darkInput} type="password" placeholder="••••••" autoComplete="current-password"
                value={form.password} onChange={set("password")} onKeyDown={onEnter(submitLogin)}
              />
            </DarkField>
            {fail && <Alert tone="error">{fail}</Alert>}
            <Btn size="lg" className="w-full" onClick={submitLogin} loading={busy}>
              כניסה
            </Btn>
            <button
              onClick={() => { setMode("register"); setLocal(""); clearError?.(); }}
              className="w-full text-blue-300 hover:text-white text-sm underline pt-1"
            >
              אין לך חשבון? פתח צוות חדש
            </button>
          </Panel>
        ) : (
          <Panel
            title="🆕 פתיחת צוות חדש"
            subtitle="תוך רגע יהיה לך קוד צוות לשלוח למאבטחים"
            onBack={reset}
          >
            <DarkField label="שמך המלא">
              <input className={darkInput} placeholder="ישראל ישראלי" value={form.fullName} onChange={set("fullName")} />
            </DarkField>
            <DarkField label="שם הצוות / האתר" hint="אופציונלי — למשל: מוקד תל אביב">
              <input className={darkInput} placeholder="הצוות שלי" value={form.teamName} onChange={set("teamName")} />
            </DarkField>
            <DarkField label="אימייל">
              <input
                className={darkInput} type="email" placeholder="name@example.com" autoComplete="email"
                value={form.email} onChange={set("email")}
              />
            </DarkField>
            <DarkField label="סיסמה" hint="לפחות 6 תווים">
              <input
                className={darkInput} type="password" placeholder="••••••" autoComplete="new-password"
                value={form.password} onChange={set("password")}
              />
            </DarkField>
            <DarkField label="אימות סיסמה">
              <input
                className={darkInput} type="password" placeholder="••••••" autoComplete="new-password"
                value={form.confirm} onChange={set("confirm")} onKeyDown={onEnter(submitRegister)}
              />
            </DarkField>
            {fail && <Alert tone="error">{fail}</Alert>}
            <Btn size="lg" className="w-full" onClick={submitRegister} loading={busy}>
              צור צוות וקבל קוד
            </Btn>
          </Panel>
        )}
      </div>
    </div>
  );
}
