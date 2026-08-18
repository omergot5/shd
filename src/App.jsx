import { Component } from "react";
import { useGuardian } from "./hooks/useGuardian.js";
import AuthPage from "./components/AuthPage.jsx";
import SupervisorApp from "./components/SupervisorApp.jsx";
import GuardApp from "./components/GuardApp.jsx";
import { LogoMark } from "./components/Logo.jsx";
import { Icon } from "./components/icons.jsx";
import { Btn, Spinner } from "./components/ui.jsx";

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
    console.error("Smart Shift Management crashed:", error, info);
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
    <LogoMark size={64} className="mx-auto mb-5" title="Smart Shift Management" />
    <div className="flex items-center justify-center gap-2 text-muted text-sm">
      <Spinner size={16} /> {label}
    </div>
  </Curtain>
);

function Shell() {
  const state = useGuardian();

  if (state.status === "booting") return <BootScreen />;

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
