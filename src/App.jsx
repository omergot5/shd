import { Component } from "react";
import { useGuardian } from "./hooks/useGuardian.js";
import AuthPage from "./components/AuthPage.jsx";
import SupervisorApp from "./components/SupervisorApp.jsx";
import GuardApp from "./components/GuardApp.jsx";
import { Btn, Spinner } from "./components/ui.jsx";

/**
 * A render error used to blank the whole screen with no way back. Now it shows
 * what happened and offers a reload, which is the difference between "the app
 * is broken" and "something went wrong, try again".
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("Guardian Shifts crashed:", error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center"
        dir="rtl"
      >
        <div className="max-w-sm">
          <div className="text-5xl mb-4">🛠️</div>
          <h1 className="text-white font-bold text-xl mb-2">משהו השתבש</h1>
          <p className="text-slate-400 text-sm mb-6">
            נתקלנו בתקלה בלתי צפויה. רענון הדף בדרך כלל פותר את זה.
          </p>
          <div className="flex gap-2 justify-center">
            <Btn onClick={() => window.location.reload()}>רענן את הדף</Btn>
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
          <pre className="text-[10px] text-slate-600 mt-6 overflow-auto max-h-32 text-left" dir="ltr">
            {String(this.state.error?.message || this.state.error)}
          </pre>
        </div>
      </div>
    );
  }
}

const BootScreen = ({ label = "טוען…" }) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center" dir="rtl">
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-5 text-3xl shadow-lg">
        🛡️
      </div>
      <div className="flex items-center justify-center gap-2 text-blue-300 text-sm">
        <Spinner size={16} /> {label}
      </div>
    </div>
  </div>
);

function Shell() {
  const state = useGuardian();

  if (state.status === "booting") return <BootScreen />;

  if (state.status === "error") {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center" dir="rtl">
        <div className="max-w-sm">
          <div className="text-5xl mb-4">📡</div>
          <h1 className="text-white font-bold text-xl mb-2">לא הצלחנו להתחבר לשרת</h1>
          <p className="text-slate-400 text-sm mb-6">{state.error}</p>
          <Btn onClick={() => window.location.reload()}>נסה שוב</Btn>
        </div>
      </div>
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

  return state.user.role === "supervisor" ? <SupervisorApp state={state} /> : <GuardApp state={state} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Shell />
    </ErrorBoundary>
  );
}
