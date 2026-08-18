import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Alert, Avatar, Btn, IconBtn, Modal, Spinner } from "./ui.jsx";
import { Icon } from "./icons.jsx";
import { LogoMark } from "./Logo.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import SmartAssign from "./SmartAssign.jsx";
import {
  SupDashboard, ShiftMgmt, AvailView, AssignView, ScheduleMgmt, SwapMgmt, TaskMgmt, TeamView,
} from "./supervisor/views.jsx";
import CalendarView from "./supervisor/CalendarView.jsx";
import { rangeLabelHe, weekByOffset } from "../lib/dates.js";

// Charts pull in recharts (~400KB). Nobody sees them on first load, so they
// are split out and fetched only when the reports tab is opened.
const AnalyticsDash = lazy(() => import("./supervisor/Analytics.jsx"));

const NAV = [
  { id: "dashboard", label: "לוח בקרה", icon: "chart", group: "ראשי" },
  { id: "calendar", label: "יומן", icon: "grid", group: "ראשי" },
  { id: "shifts", label: "ניהול משמרות", icon: "calendar", group: "תכנון", week: true },
  { id: "availability", label: "זמינות שומרים", icon: "check-circle", group: "תכנון", week: true },
  { id: "smart", label: "שיבוץ חכם", icon: "zap", group: "תכנון", week: true, highlight: true },
  { id: "assignment", label: "שיבוץ ידני", icon: "users", group: "תכנון", week: true },
  { id: "schedule", label: "פרסום סידור", icon: "clipboard", group: "תכנון", week: true },
  { id: "swaps", label: "בקשות החלפה", icon: "swap", group: "ניהול", badge: true },
  { id: "tasks", label: "משימות", icon: "pencil", group: "ניהול" },
  { id: "analytics", label: "דוחות", icon: "trending", group: "ניהול" },
  { id: "team", label: "הצוות שלי", icon: "key", group: "ניהול" },
];

const GROUPS = ["ראשי", "תכנון", "ניהול"];

const WeekNav = ({ offset, setOffset, dates }) => (
  <div className="glass flex items-center gap-1 p-1 rounded-xl">
    {/* RTL: the previous week sits to the right, so its chevron points right. */}
    <IconBtn icon="right" label="שבוע קודם" size="sm" onClick={() => setOffset(offset - 1)} />
    <div className="px-2 text-xs font-bold text-content select-none min-w-[128px] text-center leading-tight">
      {rangeLabelHe(dates)}
      {offset === 0 && <span className="block text-[10px] text-brand font-semibold">השבוע</span>}
      {offset === 1 && <span className="block text-[10px] text-muted font-semibold">שבוע הבא</span>}
    </div>
    <IconBtn icon="left" label="שבוע הבא" size="sm" onClick={() => setOffset(offset + 1)} />
    {offset !== 0 && (
      <button
        onClick={() => setOffset(0)}
        className="mr-1 h-8 px-2.5 text-[11px] font-bold rounded-lg bg-surface-sunken text-muted hover:text-content cursor-pointer transition-colors"
      >
        היום
      </button>
    )}
  </div>
);

export default function SupervisorApp({ state }) {
  const {
    user, team, guards, shifts, availability, swapRequests, tasks,
    actions, busy, error, clearError, logout,
  } = state;

  const [view, setView] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Default to next week — the week a supervisor actually plans.
  const [weekOffset, setWeekOffset] = useState(1);

  const weekDates = useMemo(() => weekByOffset(weekOffset), [weekOffset]);
  const pendingSwaps = swapRequests.filter((r) => r.status === "pending").length;
  const current = NAV.find((n) => n.id === view);

  const go = (id) => {
    setView(id);
    setMenuOpen(false);
  };

  // Escape closes the mobile drawer. Without it the only way out is the
  // scrim, which is not reachable from a keyboard.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // A freshly created team lands here straight from registration, so the team
  // code — the only thing needed to onboard the guards — gets its own moment.
  const seenKey = `gs-welcomed-${user.teamCode}`;
  const [welcome, setWelcome] = useState(false);
  useEffect(() => {
    if (guards.length === 0 && shifts.length === 0 && !localStorage.getItem(seenKey)) {
      setWelcome(true);
    }
  }, [guards.length, shifts.length, seenKey]);

  const dismissWelcome = () => {
    localStorage.setItem(seenKey, "1");
    setWelcome(false);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(user.teamCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked (http, or permission denied) — the code is on screen anyway */
    }
  };

  const startDemo = async () => {
    await actions.seedDemo();
    setWeekOffset(1);
    go("smart");
  };

  const common = { guards, shifts, availability, weekDates, actions, busy, onNavigate: go };

  const views = {
    dashboard: (
      <SupDashboard
        {...common}
        swapRequests={swapRequests}
        tasks={tasks}
        team={team}
        onSeedDemo={startDemo}
      />
    ),
    calendar: <CalendarView shifts={shifts} guards={guards} onNavigate={go} />,
    shifts: <ShiftMgmt {...common} />,
    availability: <AvailView {...common} />,
    smart: (
      <SmartAssign
        weekDates={weekDates}
        shifts={shifts}
        guards={guards}
        availability={availability}
        busy={busy}
        onApply={(ids, assignments) => actions.applyPlan(ids, assignments)}
      />
    ),
    assignment: <AssignView {...common} />,
    schedule: <ScheduleMgmt {...common} />,
    swaps: (
      <SwapMgmt
        guards={guards}
        shifts={shifts}
        swapRequests={swapRequests}
        actions={actions}
        busy={busy}
      />
    ),
    tasks: (
      <TaskMgmt guards={guards} tasks={tasks} weekDates={weekDates} actions={actions} busy={busy} />
    ),
    analytics: (
      <Suspense
        fallback={
          <div className="flex items-center justify-center gap-2 text-muted py-20 text-sm">
            <Spinner size={18} /> טוען גרפים…
          </div>
        }
      >
        <AnalyticsDash guards={guards} shifts={shifts} />
      </Suspense>
    ),
    team: (
      <TeamView
        user={user}
        team={team}
        guards={guards}
        actions={actions}
        busy={busy}
        onSeedDemo={startDemo}
      />
    ),
  };

  return (
    <div className="app-canvas flex h-[100dvh] overflow-hidden" dir="rtl">
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 right-0 z-50 w-64 glass-raised rounded-none border-y-0 border-r-0
          flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0 ${
            menuOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
          }`}
      >
        <div className="p-4 border-b border-hairline">
          <div className="flex items-center gap-3 min-w-0">
            <LogoMark size={34} />
            <div className="min-w-0">
              <p className="text-[13px] leading-tight tracking-tight whitespace-nowrap">
                <span className="font-extrabold text-content">Smart Shift</span>{" "}
                <span className="font-medium text-muted">Management</span>
              </p>
              <p className="text-muted text-[11px] truncate">{user.name}</p>
            </div>
          </div>
          <button
            onClick={() => go("team")}
            className="mt-3 w-full flex items-center justify-between bg-brand/10 hover:bg-brand/20 ring-1 ring-inset ring-brand/25 rounded-xl px-3 h-11 cursor-pointer transition-colors"
          >
            <span className="text-[10px] text-brand font-bold">קוד צוות</span>
            <span className="font-mono font-bold text-content text-sm tracking-[0.2em]">
              {user.teamCode}
            </span>
          </button>
        </div>

        <nav aria-label="ניווט ראשי" className="flex-1 p-3 space-y-4 overflow-y-auto">
          {GROUPS.map((group) => (
            <div key={group}>
              <p className="text-faint text-[10px] font-bold uppercase tracking-wider px-3 mb-1.5">
                {group}
              </p>
              <div className="space-y-0.5">
                {NAV.filter((n) => n.group === group).map((item) => {
                  const active = view === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => go(item.id)}
                      aria-current={active ? "page" : undefined}
                      className={`w-full flex items-center gap-3 px-3 h-11 rounded-xl text-sm font-medium
                        cursor-pointer transition-colors duration-200 ${
                          active
                            ? "bg-brand/15 text-content ring-1 ring-inset ring-brand/30"
                            : "text-muted hover:text-content hover:bg-surface-hover"
                        }`}
                    >
                      <Icon
                        name={item.icon}
                        size={18}
                        className={active ? "text-brand" : "opacity-80"}
                      />
                      <span className="flex-1 text-right">{item.label}</span>
                      {item.highlight && !active && (
                        <span className="text-[9px] font-bold bg-accent text-on-accent px-1.5 py-0.5 rounded">
                          חדש
                        </span>
                      )}
                      {item.badge && pendingSwaps > 0 && (
                        <span className="bg-danger text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                          {pendingSwaps}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-hairline space-y-2">
          <ThemeToggle className="w-full justify-center" />
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 h-11 rounded-xl text-sm font-medium text-muted hover:bg-danger/10 hover:text-danger cursor-pointer transition-colors"
          >
            <Icon name="logout" size={18} />
            <span>התנתקות</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 flex-shrink-0 glass rounded-none border-x-0 border-t-0 flex items-center justify-between gap-3 px-3 lg:px-6 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <IconBtn
              icon="menu"
              label="פתח תפריט"
              className="lg:hidden -mr-2"
              onClick={() => setMenuOpen(true)}
            />
            <h1 className="font-bold text-content text-base truncate">{current?.label}</h1>
          </div>

          {current?.week && (
            <div className="hidden sm:block">
              <WeekNav offset={weekOffset} setOffset={setWeekOffset} dates={weekDates} />
            </div>
          )}

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Announced politely so a screen reader hears saves without
             * having the focus yanked away mid-edit. */}
            <span role="status" aria-live="polite" className="sr-only">
              {busy ? "שומר" : ""}
            </span>
            {busy && (
              <span className="text-[11px] text-brand font-medium hidden sm:inline">שומר…</span>
            )}
            <Avatar id={user.id} name={user.name} size={30} />
          </div>
        </header>

        <div className="flex-1 overflow-auto p-3 lg:p-6">
          <div className="max-w-6xl mx-auto space-y-5 pb-10">
            {current?.week && (
              <div className="sm:hidden flex justify-center">
                <WeekNav offset={weekOffset} setOffset={setWeekOffset} dates={weekDates} />
              </div>
            )}
            {error && (
              <Alert tone="danger" onClose={clearError}>
                {error}
              </Alert>
            )}
            {views[view]}
          </div>
        </div>
      </main>

      <Modal open={welcome} onClose={dismissWelcome} title="הצוות שלך מוכן">
        <p className="text-sm text-muted mb-4">
          שלח את הקוד הזה למאבטחים. הם נכנסים לאפליקציה, בוחרים "מאבטח", מזינים את הקוד ואת שמם —
          בלי סיסמה ובלי הרשמה.
        </p>
        <div className="bg-brand/10 ring-1 ring-inset ring-brand/30 rounded-2xl p-5 text-center mb-4">
          <p className="text-[10px] text-brand uppercase tracking-[0.2em] mb-1.5">קוד הצוות</p>
          <p className="text-4xl font-mono font-black text-content tracking-[0.25em]">
            {user.teamCode}
          </p>
        </div>
        <div className="flex gap-2">
          <Btn
            icon={copied ? "check" : "copy"}
            onClick={async () => {
              await copyCode();
              dismissWelcome();
              go("team");
            }}
            className="flex-1"
          >
            {copied ? "הועתק" : "העתק ופתח את מסך הצוות"}
          </Btn>
          <Btn variant="secondary" onClick={dismissWelcome}>
            סגור
          </Btn>
        </div>
        <p className="text-xs text-faint mt-4 text-center">
          הקוד תמיד זמין לך בסרגל הצד ובמסך "הצוות שלי"
        </p>
      </Modal>
    </div>
  );
}
