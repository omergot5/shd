import { lazy, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Alert, Avatar, Btn, CardButton, IconBtn, Modal, Spinner, UndoBar } from "./ui.jsx";
import { Icon } from "./icons.jsx";
import { LogoMark } from "./Logo.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import { SupDashboard, SwapMgmt, TaskMgmt, TeamView } from "./supervisor/views.jsx";
import WeekFlow, { STEP_OF } from "./supervisor/WeekFlow.jsx";
import CalendarView from "./supervisor/CalendarView.jsx";
import { rangeLabelHe, weekByOffset } from "../lib/dates.js";
import { subscribeTerms, t, termProfile } from "../lib/terms.js";

// Charts pull in recharts (~400KB). Nobody sees them on first load, so they
// are split out and fetched only when the reports tab is opened.
const AnalyticsDash = lazy(() => import("./supervisor/Analytics.jsx"));

/**
 * ארבעה פריטים. לא יותר.
 *
 * קודם היו כאן אחד־עשר, מחולקים לשלוש קבוצות — וזה בדיוק גודל התפריט שבו
 * משתמש חדש מפסיק לקרוא ומתחיל לנחש. חמישה מהם (משמרות, זמינות, שיבוץ חכם,
 * שיבוץ ידני, פרסום) היו בעצם *שלבים של אותה משימה אחת*, ולכן הם התכנסו
 * ל"השבוע". השאר, שאף אחד לא נוגע בהם באמצע בניית סידור, ירדו ל"עוד".
 */
/* פונקציות ולא קבועים: `t()` שנקרא ברמת המודול מקבע את המילה הראשונה,
 * והחלפת פרופיל לא הייתה משנה כלום על המסך. */
const navItems = () => [
  { id: "week", label: "השבוע", icon: "calendar", week: true },
  { id: "calendar", label: t("nav.calendar"), icon: "grid" },
  { id: "team", label: t("nav.team"), icon: "users" },
  { id: "more", label: "עוד", icon: "menu", badge: true },
];

/** היעדים המשניים. נכנסים אליהם מכוונה, לא בטעות בדרך למשהו אחר. */
const moreItems = () => [
  { id: "dashboard", label: t("nav.dashboard"), icon: "chart", hint: "מצב הצוות במבט אחד" },
  { id: "swaps", label: t("nav.swaps"), icon: "swap", hint: "מי ביקש להתחלף ועם מי", badge: true },
  { id: "tasks", label: t("nav.tasks"), icon: "pencil", hint: "משימות שלא קשורות למשמרת" },
  { id: "analytics", label: t("nav.analytics"), icon: "trending", hint: "עומסים, לילות והוגנות" },
];

const titles = (more) => ({
  week: "השבוע",
  more: "עוד",
  ...Object.fromEntries(more.map((m) => [m.id, m.label])),
  calendar: t("nav.calendar"),
  team: t("nav.team"),
});

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
    actions, busy, error, clearError, logout, pending, undo, offline,
  } = state;

  // ברירת המחדל היא העבודה עצמה, לא לוח בקרה. אחמ"ש שנכנס לאפליקציה בא
  // לסדר את השבוע — הוא לא בא לקרוא סטטיסטיקה על עצמו.
  const [view, setView] = useState("week");
  const [weekStep, setWeekStep] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Default to next week — the week a supervisor actually plans.
  const [weekOffset, setWeekOffset] = useState(1);

  // החלפת פרופיל מרעננת את כל התוויות. בלי המנוי הזה השמות היו קופאים
  // על אלה שנקראו בטעינת המודול.
  const profile = useSyncExternalStore(subscribeTerms, termProfile, termProfile);
  const NAV = useMemo(() => navItems(), [profile]);
  const MORE = useMemo(() => moreItems(), [profile]);
  const TITLES = useMemo(() => titles(MORE), [MORE]);

  const weekDates = useMemo(() => weekByOffset(weekOffset), [weekOffset]);
  const pendingSwaps = swapRequests.filter((r) => r.status === "pending").length;
  const current = NAV.find((n) => n.id === view);
  const isWeek = view === "week";

  /**
   * ניווט אחד לכל האפליקציה. מזהי היעדים הישנים ("smart", "schedule"…) עדיין
   * מגיעים מכפתורים בתוך המסכים, והם נפתרים כאן לשלב בתוך "השבוע" — כך אף
   * קריאה קיימת לא נשברה כשחמישה מסכים הפכו לאחד.
   */
  const go = (id) => {
    if (id in STEP_OF) {
      setWeekStep(STEP_OF[id]);
      setView("week");
    } else {
      setView(id);
    }
    setMenuOpen(false);
  };

  // כל מעבר — בין מסכים ובין שלבים — מתחיל בראש התוכן. בלי זה, מעבר משלב
  // ארוך לשלב קצר נוחת באמצע המסך החדש, ונראה כאילו חצי ממנו חסר.
  const scroller = useRef(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [view, weekStep]);

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
    week: <WeekFlow {...common} step={weekStep} setStep={setWeekStep} />,
    calendar: <CalendarView shifts={shifts} guards={guards} onNavigate={go} />,
    more: (
      <div className="grid gap-3 sm:grid-cols-2">
        {MORE.map((m) => (
          <CardButton key={m.id} onClick={() => go(m.id)} className="flex items-center gap-3.5">
            <span className="w-11 h-11 rounded-xl bg-brand/15 ring-1 ring-inset ring-brand/25 text-brand flex items-center justify-center flex-shrink-0">
              <Icon name={m.icon} size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-content">{m.label}</span>
              <span className="block text-xs text-muted mt-0.5">{m.hint}</span>
            </span>
            {m.badge && pendingSwaps > 0 && (
              <span className="bg-danger text-white text-[11px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                {pendingSwaps}
              </span>
            )}
            <Icon name="left" size={17} className="text-faint flex-shrink-0" />
          </CardButton>
        ))}
      </div>
    ),
    dashboard: (
      <SupDashboard
        {...common}
        swapRequests={swapRequests}
        tasks={tasks}
        team={team}
        onSeedDemo={startDemo}
      />
    ),
    swaps: (
      <SwapMgmt
        guards={guards}
        shifts={shifts}
        availability={availability}
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

  // מסך משני נפתח מתוך "עוד", אז הדרך חזרה חייבת להיות גלויה — בלי להסתמך
  // על כפתור "אחורה" של הדפדפן, שבאפליקציה חד־עמודית פשוט מוציא מהאתר.
  const secondary = MORE.find((m) => m.id === view);

  return (
    <div className="app-canvas flex h-[100dvh] overflow-hidden" dir="rtl">
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* התפריט נפתח לפי בקשה ונסגר אחריה — גם במסך רחב. סרגל שפתוח תמיד
        * גוזל שליש מרוחב הקריאה במסך שכולו טבלאות שבועיות, ובעיקר הוא מציג
        * את הניווט בזמן שהמשתמש כבר בתוך משימה. `inert` כשסגור, אחרת אפשר
        * להגיע בטאב לכפתורים שנמצאים מחוץ למסך. */}
      <aside
        {...(menuOpen ? {} : { inert: "" })}
        className={`fixed inset-y-0 right-0 z-50 w-64 glass-raised rounded-none border-y-0 border-r-0
          flex flex-col transition-transform duration-300 ${
            menuOpen ? "translate-x-0" : "translate-x-full"
          }`}
      >
        <div className="p-4 border-b border-hairline">
          <div className="flex items-center gap-3 min-w-0">
            <LogoMark size={34} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-extrabold tracking-[-0.02em] leading-tight text-content">
                NexRota
              </p>
              <p className="text-muted text-[11px] truncate">{user.name}</p>
            </div>
            {/* דרך שנייה לסגור, בתוך הסרגל עצמו. ההמבורגר בכותרת נמצא מחוץ
              * לשדה הראייה ברגע שהסרגל פתוח, והרקע המעומעם הוא יעד שאי אפשר
              * להגיע אליו במקלדת. RTL: הסרגל נשלף ימינה, ולכן החץ מצביע ימינה. */}
            <IconBtn
              icon="right"
              label="סגור תפריט"
              size="sm"
              className="-ml-1 flex-shrink-0"
              onClick={() => setMenuOpen(false)}
            />
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

        <nav aria-label="ניווט ראשי" className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            // מסך משני מדליק את "עוד", כי משם הגיעו אליו.
            const active = view === item.id || (item.id === "more" && !!secondary);
            return (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                aria-current={active ? "page" : undefined}
                className={`w-full flex items-center gap-3 px-3 h-12 rounded-xl text-sm font-semibold
                  cursor-pointer transition-colors duration-200 ${
                    active
                      ? "bg-brand/15 text-content ring-1 ring-inset ring-brand/30"
                      : "text-muted hover:text-content hover:bg-surface-hover"
                  }`}
              >
                <Icon name={item.icon} size={19} className={active ? "text-brand" : "opacity-80"} />
                <span className="flex-1 text-right">{item.label}</span>
                {item.badge && pendingSwaps > 0 && (
                  <span className="bg-danger text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {pendingSwaps}
                  </span>
                )}
              </button>
            );
          })}
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
              icon={menuOpen ? "x" : "menu"}
              label={menuOpen ? "סגור תפריט" : "פתח תפריט"}
              className="-mr-2"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            />
            {secondary && (
              <IconBtn icon="right" label="חזרה לעוד" size="sm" onClick={() => go("more")} />
            )}
            <h1 className="font-bold text-content text-base truncate">
              {TITLES[view] || current?.label}
            </h1>
          </div>

          {isWeek && (
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

        <div ref={scroller} className="flex-1 overflow-auto p-3 lg:p-6">
          <div className="max-w-6xl mx-auto space-y-5 pb-10">
            {isWeek && (
              <div className="sm:hidden flex justify-center">
                <WeekNav offset={weekOffset} setOffset={setWeekOffset} dates={weekDates} />
              </div>
            )}
            {error && (
              <Alert tone="danger" onClose={clearError}>
                {error}
              </Alert>
            )}
            {offline && (
              <Alert tone="warn" title="אין חיבור — מוצג הסידור האחרון שנטען">
                אפשר לקרוא הכול. שינויים לא יישמרו עד שהרשת תחזור.
              </Alert>
            )}
            {views[view]}
          </div>
        </div>
      </main>

      {/* מחוץ ל-main: הרצועה מרחפת מעל כל מסך, ולא צריכה לדעת מי פתוח. */}
      <UndoBar key={pending?.label} label={pending?.label} onUndo={undo} />

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
          הקוד תמיד זמין לך בסרגל הצד ובמסך "{t("nav.team")}"
        </p>
      </Modal>
    </div>
  );
}
