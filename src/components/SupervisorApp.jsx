import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Avatar, Badge, Btn, Alert, Modal, Spinner } from "./ui.jsx";
import SmartAssign from "./SmartAssign.jsx";
import {
  SupDashboard, ShiftMgmt, AvailView, AssignView, ScheduleMgmt, SwapMgmt, TaskMgmt, TeamView,
} from "./supervisor/views.jsx";

const AnalyticsDash = lazy(() => import("./supervisor/Analytics.jsx"));
import { weekByOffset, rangeLabelHe, todayISO } from "../lib/dates.js";

const NAV = [
  { id: "dashboard", label: "לוח בקרה", icon: "📊", group: "ראשי" },
  { id: "shifts", label: "ניהול משמרות", icon: "📅", group: "תכנון", week: true },
  { id: "availability", label: "זמינות שומרים", icon: "✅", group: "תכנון", week: true },
  { id: "smart", label: "שיבוץ חכם", icon: "⚡", group: "תכנון", week: true, highlight: true },
  { id: "assignment", label: "שיבוץ ידני", icon: "👥", group: "תכנון", week: true },
  { id: "schedule", label: "פרסום סידור", icon: "📋", group: "תכנון", week: true },
  { id: "swaps", label: "בקשות החלפה", icon: "🔄", group: "ניהול", badge: true },
  { id: "tasks", label: "משימות", icon: "✏️", group: "ניהול" },
  { id: "analytics", label: "דוחות", icon: "📈", group: "ניהול" },
  { id: "team", label: "הצוות שלי", icon: "🔑", group: "ניהול" },
];

const WeekNav = ({ offset, setOffset, dates }) => (
  <div className="flex items-center gap-1 bg-white p-1 rounded-xl shadow-sm border border-gray-200">
    <button
      onClick={() => setOffset(offset - 1)}
      className="p-2 hover:bg-gray-100 rounded-lg text-gray-600" title="שבוע קודם" aria-label="שבוע קודם"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
    </button>
    <div className="px-3 text-xs font-bold text-gray-800 select-none min-w-[130px] text-center">
      {rangeLabelHe(dates)}
      {offset === 0 && <span className="block text-[10px] text-blue-600 font-semibold">השבוע</span>}
      {offset === 1 && <span className="block text-[10px] text-gray-400 font-semibold">שבוע הבא</span>}
    </div>
    <button
      onClick={() => setOffset(offset + 1)}
      className="p-2 hover:bg-gray-100 rounded-lg text-gray-600" title="שבוע הבא" aria-label="שבוע הבא"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
    </button>
    {offset !== 0 && (
      <button
        onClick={() => setOffset(0)}
        className="mr-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-200"
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
  // Default to next week — that is the week a supervisor actually plans.
  const [weekOffset, setWeekOffset] = useState(1);

  const weekDates = useMemo(() => weekByOffset(weekOffset), [weekOffset]);
  const pendingSwaps = swapRequests.filter((r) => r.status === "pending").length;
  const current = NAV.find((n) => n.id === view);

  const go = (id) => { setView(id); setMenuOpen(false); };

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

  const copyCode = () => navigator.clipboard?.writeText(user.teamCode).catch(() => {});

  const common = { guards, shifts, availability, weekDates, actions, busy, onNavigate: go };

  const views = {
    dashboard: (
      <SupDashboard
        {...common} swapRequests={swapRequests} tasks={tasks} team={team}
        onSeedDemo={async () => { await actions.seedDemo(); setWeekOffset(1); go("smart"); }}
      />
    ),
    shifts: <ShiftMgmt {...common} />,
    availability: <AvailView {...common} />,
    smart: (
      <SmartAssign
        weekDates={weekDates} shifts={shifts} guards={guards} availability={availability}
        busy={busy}
        onApply={(ids, assignments) => actions.applyPlan(ids, assignments)}
        onClear={(ids) => actions.clearAssignments(ids)}
      />
    ),
    assignment: <AssignView {...common} />,
    schedule: <ScheduleMgmt {...common} />,
    swaps: <SwapMgmt guards={guards} shifts={shifts} swapRequests={swapRequests} actions={actions} busy={busy} />,
    tasks: <TaskMgmt guards={guards} tasks={tasks} weekDates={weekDates} actions={actions} busy={busy} />,
    analytics: (
      <Suspense
        fallback={
          <div className="flex items-center justify-center gap-2 text-gray-400 py-20 text-sm">
            <Spinner size={18} /> טוען גרפים…
          </div>
        }
      >
        <AnalyticsDash guards={guards} shifts={shifts} />
      </Suspense>
    ),
    team: (
      <TeamView
        user={user} team={team} guards={guards} actions={actions} busy={busy}
        onSeedDemo={async () => { await actions.seedDemo(); setWeekOffset(1); go("smart"); }}
      />
    ),
  };

  const groups = ["ראשי", "תכנון", "ניהול"];

  return (
    <div className="flex h-[100dvh] bg-[#F6F7F9]" dir="rtl">
      {menuOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden" onClick={() => setMenuOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 right-0 z-50 w-64 bg-slate-900 flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-lg shadow-lg">
              🛡️
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm">Guardian Shifts</p>
              <p className="text-slate-400 text-[10px] truncate">{user.name}</p>
            </div>
          </div>
          <button
            onClick={() => go("team")}
            className="mt-3 w-full flex items-center justify-between bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 rounded-xl px-3 py-2 transition-colors"
          >
            <span className="text-[10px] text-blue-400 font-bold">קוד צוות</span>
            <span className="font-mono font-bold text-white text-sm tracking-[0.2em]">{user.teamCode}</span>
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {groups.map((group) => (
            <div key={group}>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider px-3 mb-1.5">{group}</p>
              <div className="space-y-0.5">
                {NAV.filter((n) => n.group === group).map((item) => (
                  <button
                    key={item.id} onClick={() => go(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      view === item.id
                        ? "bg-white/10 text-white ring-1 ring-white/10"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <span className={`text-base ${view === item.id ? "" : "opacity-70"}`}>{item.icon}</span>
                    <span className="flex-1 text-right">{item.label}</span>
                    {item.highlight && view !== item.id && (
                      <span className="text-[9px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded">חדש</span>
                    )}
                    {item.badge && pendingSwaps > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {pendingSwaps}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <span className="opacity-70">🚪</span><span>התנתקות</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 flex-shrink-0 bg-white/90 backdrop-blur border-b border-gray-200 flex items-center justify-between gap-3 px-3 lg:px-6 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setMenuOpen(true)}
              className="lg:hidden p-2 -mr-1 text-gray-500 hover:bg-gray-100 rounded-xl" aria-label="תפריט"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <h1 className="font-bold text-gray-900 text-base truncate">{current?.label}</h1>
          </div>

          {current?.week && (
            <div className="hidden sm:block">
              <WeekNav offset={weekOffset} setOffset={setWeekOffset} dates={weekDates} />
            </div>
          )}

          <div className="flex items-center gap-2 flex-shrink-0">
            {busy && <span className="text-[11px] text-blue-600 font-medium hidden sm:inline">שומר…</span>}
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
            {error && <Alert tone="error" onClose={clearError}>{error}</Alert>}
            {views[view]}
          </div>
        </div>
      </main>

      <Modal open={welcome} onClose={dismissWelcome} title="🎉 הצוות שלך מוכן">
        <p className="text-sm text-gray-600 mb-4">
          שלח את הקוד הזה למאבטחים. הם נכנסים לאפליקציה, בוחרים "מאבטח", מזינים את הקוד ואת שמם —
          בלי סיסמה ובלי הרשמה.
        </p>
        <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5 text-center mb-4">
          <p className="text-[10px] text-blue-500 uppercase tracking-[0.2em] mb-1.5">קוד הצוות</p>
          <p className="text-4xl font-mono font-black text-blue-700 tracking-[0.25em]">{user.teamCode}</p>
        </div>
        <div className="flex gap-2">
          <Btn onClick={() => { copyCode(); dismissWelcome(); go("team"); }} className="flex-1">
            📋 העתק ופתח את מסך הצוות
          </Btn>
          <Btn variant="secondary" onClick={dismissWelcome}>סגור</Btn>
        </div>
        <p className="text-xs text-gray-400 mt-4 text-center">
          הקוד תמיד זמין לך בסרגל הצד ובמסך "הצוות שלי"
        </p>
      </Modal>
    </div>
  );
}
