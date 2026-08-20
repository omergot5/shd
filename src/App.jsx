import { Component, useState } from "react";
import { useGuardian } from "./hooks/useGuardian.js";
import AuthPage from "./components/AuthPage.jsx";
import SupervisorApp from "./components/SupervisorApp.jsx";
import GuardApp from "./components/GuardApp.jsx";
import { Logo, LogoMark } from "./components/Logo.jsx";
import { Icon } from "./components/icons.jsx";
import { Alert, Btn, Field, Input, Spinner } from "./components/ui.jsx";

/** Full-bleed centred layout shared by every pre-app screen. */
const Curtain = ({ children }) => (
  <div className="app-canvas min-h-screen flex items-center justify-center p-6 text-center" dir="rtl">
    <div className="max-w-sm w-full animate-fade-up">{children}</div>
  </div>
);

const Emblem = ({ icon, tone = "text-muted" }) => (
  <div
    className={`glass w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center ${tone}`}
  >
    <Icon name={icon} size={28} />
  </div>
);

/**
 * A render error used to blank the whole screen with no way back. Now it
 * shows what happened and offers a reload — the difference between "the app
 * is broken" and "something went wrong, try again".
 */
class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("NexRota crashed:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Curtain>
        <Emblem icon="wrench" tone="text-warn" />
        <h1 className="text-content font-bold text-xl mb-2">משהו השתבש</h1>
        <p className="text-muted text-sm mb-6">
          נתקלנו בתקלה בלתי צפויה. רענון הדף בדרך כלל פותר את זה.
        </p>
        <div className="flex gap-2 justify-center">
          <Btn icon="refresh" onClick={() => window.location.reload()}>
            רענן את הדף
          </Btn>
          <Btn
            variant="outline"
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
          >
            נקה והתחל מחדש
          </Btn>
        </div>
        <pre
          className="text-[10px] text-faint mt-6 overflow-auto max-h-32 text-left"
          dir="ltr"
        >
          {String(this.state.error?.message || this.state.error)}
        </pre>
      </Curtain>
    );
  }
}

const BootScreen = ({ label = "טוען…" }) => (
  <Curtain>
    <LogoMark size={64} className="mx-auto mb-5" title="NexRota" />
    <div className="flex items-center justify-center gap-2 text-muted text-sm">
      <Spinner size={16} /> {label}
    </div>
  </Curtain>
);

/** Shared chrome for the two short forms that sit between auth and the app. */
const MiniForm = ({ title, subtitle, onSubmit, error, busy, cta, children }) => (
  <div className="app-canvas min-h-screen flex items-center justify-center p-4" dir="rtl">
    <div className="w-full max-w-md animate-fade-up">
      <div className="flex justify-center mb-8">
        <Logo size={56} stacked />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="glass rounded-2xl p-6 space-y-4"
      >
        <div>
          <h1 className="text-content font-bold text-xl">{title}</h1>
          <p className="text-muted text-xs mt-1">{subtitle}</p>
        </div>
        {children}
        {error && <Alert tone="danger">{error}</Alert>}
        <Btn type="submit" size="lg" className="w-full" loading={busy}>
          {cta}
        </Btn>
      </form>
    </div>
  </div>
);

/** Landed here from a recovery email. */
function ResetPassword({ onSubmit, busy }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");

  const submit = async () => {
    if (password.length < 6) return setErr("הסיסמה חייבת להיות באורך 6 תווים לפחות");
    if (password !== confirm) return setErr("הסיסמאות לא תואמות");
    try {
      await onSubmit(password);
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <MiniForm
      title="בחר סיסמה חדשה"
      subtitle="אחרי השמירה תיכנס אוטומטית"
      onSubmit={submit}
      error={err}
      busy={busy}
      cta="שמור סיסמה והתחבר"
    >
      <Field label="סיסמה חדשה" hint="לפחות 6 תווים">
        <Input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setErr("");
          }}
        />
      </Field>
      <Field label="אימות סיסמה">
        <Input
          type="password"
          autoComplete="new-password"
          invalid={Boolean(confirm) && confirm !== password}
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            setErr("");
          }}
        />
      </Field>
    </MiniForm>
  );
}

/**
 * Authenticated, but with no team — an interrupted signup, or an account
 * older than the current schema. This used to be a dead end that told the
 * user to register again with an address that was already taken.
 */
function FinishSetup({ onSubmit, onCancel, busy }) {
  const [fullName, setFullName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!fullName.trim()) return setErr("יש להזין שם מלא");
    try {
      await onSubmit({ fullName, teamName });
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <MiniForm
      title="עוד צעד אחד"
      subtitle="החשבון שלך מאומת, אבל עדיין אין לו צוות. בוא ניצור אחד."
      onSubmit={submit}
      error={err}
      busy={busy}
      cta="צור צוות וקבל קוד"
    >
      <Field label="שמך המלא">
        <Input
          placeholder="ישראל ישראלי"
          autoComplete="name"
          value={fullName}
          onChange={(e) => {
            setFullName(e.target.value);
            setErr("");
          }}
        />
      </Field>
      <Field label="שם הצוות / האתר" hint="אופציונלי — למשל: מוקד תל אביב">
        <Input
          placeholder="הצוות שלי"
          autoComplete="organization"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
        />
      </Field>
      <button
        type="button"
        onClick={onCancel}
        className="w-full text-muted hover:text-content text-sm cursor-pointer transition-colors"
      >
        התנתק
      </button>
    </MiniForm>
  );
}

function Shell() {
  const state = useGuardian();

  if (state.status === "booting") return <BootScreen />;

  if (state.status === "recovery") {
    return <ResetPassword onSubmit={state.setNewPassword} busy={state.busy} />;
  }

  if (state.status === "needs-team") {
    return (
      <FinishSetup onSubmit={state.completeSetup} onCancel={state.logout} busy={state.busy} />
    );
  }

  if (state.status === "error") {
    return (
      <Curtain>
        <Emblem icon="offline" tone="text-danger" />
        <h1 className="text-content font-bold text-xl mb-2">לא הצלחנו להתחבר לשרת</h1>
        <p className="text-muted text-sm mb-6">{state.error}</p>
        <Btn icon="refresh" onClick={() => window.location.reload()}>
          נסה שוב
        </Btn>
      </Curtain>
    );
  }

  if (state.status === "anonymous" || !state.user) {
    return (
      <AuthPage
        onRegister={state.register}
        onLogin={state.login}
        onJoin={state.joinTeam}
        onDemo={state.startGuestDemo}
        onForgot={state.requestPasswordReset}
        busy={state.busy}
        error={state.error}
        clearError={state.clearError}
      />
    );
  }

  return state.user.role === "supervisor" ? (
    <SupervisorApp state={state} />
  ) : (
    <GuardApp state={state} />
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Shell />
    </ErrorBoundary>
  );
}
