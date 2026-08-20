import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { SHIFT_TONES } from "../../design/shiftPalette.js";
import {
  Alert, Avatar, Badge, Btn, Card, EmptyState, Field, guardColor, IconBtn, Input, Meter, Modal,
  PageHeader, readableInk, Select, StatCard, Textarea,
} from "../ui.jsx";
import { Dot, Icon } from "../icons.jsx";
import {
  availabilityDeadline, dayName, formatDateHe, fromISODate, rangeLabelHe, shiftHours, shortDate,
  toISODate, todayISO, weekByOffset,
} from "../../lib/dates.js";
import { availStatus, checkAssignment } from "../../lib/autoAssign.js";
import { PROFILES, subscribeTerms, t, termProfile } from "../../lib/terms.js";
import { compatIndex, explainConflict, findConflicts } from "../../lib/conflicts.js";
import { fairnessHint, fairnessPlan } from "../../lib/fairness.js";

/**
 * Whole-week patterns. Two 12-hour shifts is the common security roster, but
 * three-eights and four-sixes are just as standard elsewhere — and building a
 * 4-shift week by hand is 28 identical trips through a modal.
 */
const WEEK_PATTERNS = [
  {
    key: "x2", title: "2 משמרות ליום", hint: "12 שעות כל אחת — הנפוץ באבטחה",
    shifts: [
      { label: "משמרת יום", startTime: "07:00", endTime: "19:00", type: "morning", color: SHIFT_TONES.morning },
      { label: "משמרת לילה", startTime: "19:00", endTime: "07:00", type: "night", color: SHIFT_TONES.night },
    ],
  },
  {
    key: "x3", title: "3 משמרות ליום", hint: "8 שעות כל אחת — בוקר, צהריים, לילה",
    shifts: [
      { label: "בוקר", startTime: "07:00", endTime: "15:00", type: "morning", color: SHIFT_TONES.morning },
      { label: "צהריים", startTime: "15:00", endTime: "23:00", type: "afternoon", color: SHIFT_TONES.afternoon },
      { label: "לילה", startTime: "23:00", endTime: "07:00", type: "night", color: SHIFT_TONES.night },
    ],
  },
  {
    key: "x4", title: "4 משמרות ליום", hint: "6 שעות כל אחת — כיסוי צפוף",
    shifts: [
      { label: "בוקר", startTime: "06:00", endTime: "12:00", type: "morning", color: SHIFT_TONES.morning },
      { label: "צהריים", startTime: "12:00", endTime: "18:00", type: "afternoon", color: SHIFT_TONES.afternoon },
      { label: "ערב", startTime: "18:00", endTime: "00:00", type: "evening", color: SHIFT_TONES.evening },
      { label: "לילה", startTime: "00:00", endTime: "06:00", type: "night", color: SHIFT_TONES.night },
    ],
  },
];

const SHIFT_TEMPLATES = [
  { key: "day12",   label: "יום 07:00–19:00",    startTime: "07:00", endTime: "19:00", type: "morning",   color: SHIFT_TONES.morning },
  { key: "night12", label: "לילה 19:00–07:00",   startTime: "19:00", endTime: "07:00", type: "night",     color: SHIFT_TONES.night },
  { key: "morning", label: "בוקר 07:00–15:00",   startTime: "07:00", endTime: "15:00", type: "morning",   color: SHIFT_TONES.morning },
  { key: "noon",    label: "צהריים 15:00–23:00", startTime: "15:00", endTime: "23:00", type: "afternoon", color: SHIFT_TONES.afternoon },
  { key: "night8",  label: "לילה 23:00–07:00",   startTime: "23:00", endTime: "07:00", type: "night",     color: SHIFT_TONES.night },
];

/**
 * Availability, as icon + word + colour. Three redundant channels, because
 * a colour alone fails WCAG 1.4.1 and an icon alone is ambiguous.
 */
const AVAIL = {
  preferred:   { icon: "star",         label: "מעדיף",    tone: "brand",  cls: "text-brand" },
  available:   { icon: "check-circle", label: "זמין",     tone: "accent", cls: "text-accent" },
  unavailable: { icon: "x-circle",     label: "לא זמין",  tone: "danger", cls: "text-danger" },
  maybe:       { icon: "help",         label: "אולי",     tone: "warn",   cls: "text-warn" },
  unknown:     { icon: "info",         label: "לא הגיש",  tone: "neutral", cls: "text-faint" },
};

// ============================================================
// DASHBOARD
// ============================================================

export function SupDashboard({ guards, shifts, swapRequests, tasks, team, onNavigate, onSeedDemo, busy }) {
  const today = todayISO();
  const todayShifts = shifts.filter((s) => s.date === today);
  const pendingSwaps = swapRequests.filter((r) => r.status === "pending").length;
  const openTasks = tasks.filter((t) => t.status !== "done").length;
  const published = shifts.filter((s) => s.published).length;
  const upcoming = shifts
    .filter((s) => s.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  // A brand-new team sees a checklist instead of a wall of zeroes.
  const steps = [
    { done: guards.length > 0, label: "הוסף שומרים לצוות", hint: "שתף את קוד הצוות או הוסף ידנית", to: "team" },
    { done: shifts.length > 0, label: "הגדר את משמרות השבוע", hint: 'יש כפתור "מלא שבוע" שעושה זאת בלחיצה', to: "shifts" },
    { done: shifts.some((s) => s.assignedGuards.length > 0), label: "שבץ שומרים למשמרות", hint: "הרץ את השיבוץ החכם", to: "smart" },
    { done: published > 0, label: "פרסם את הסידור", hint: "רק אחרי פרסום השומרים רואים אותו", to: "schedule" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const isNew = doneCount < steps.length;

  const maxLoad = Math.max(
    1,
    ...guards.map((g) => shifts.filter((s) => s.assignedGuards.includes(g.id)).length)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`שלום${team?.name ? `, ${team.name}` : ""}`}
        subtitle={isNew ? "בוא נסיים את ההקמה — 4 צעדים קצרים" : "סיכום מצב הצוות"}
      />

      {isNew && (
        <Card>
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div>
              <h2 className="font-bold text-content flex items-center gap-2">
                <Icon name="rocket" size={18} className="text-brand" />
                הקמת הצוות
              </h2>
              <p className="text-xs text-muted mt-0.5">
                {doneCount} מתוך {steps.length} הושלמו
              </p>
            </div>
            <Btn variant="outline" size="sm" icon="sparkles" onClick={onSeedDemo} loading={busy}>
              מלא לי נתוני הדגמה
            </Btn>
          </div>
          <Meter value={doneCount} max={steps.length} height={8} label="התקדמות ההקמה" />
          <ol className="mt-4 space-y-2">
            {steps.map((s, i) => (
              <li key={s.to}>
                <button
                  onClick={() => onNavigate(s.to)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl ring-1 ring-inset text-right cursor-pointer transition-colors duration-200 ${
                    s.done
                      ? "bg-accent/10 ring-accent/25"
                      : "bg-surface-sunken ring-hairline hover:bg-surface-hover hover:ring-brand/30"
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      s.done ? "bg-accent text-on-accent" : "bg-surface ring-1 ring-inset ring-hairline text-muted"
                    }`}
                  >
                    {s.done ? <Icon name="check" size={14} strokeWidth={2.5} /> : i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${s.done ? "text-muted line-through" : "text-content"}`}>
                      {s.label}
                    </p>
                    {!s.done && <p className="text-xs text-muted">{s.hint}</p>}
                  </div>
                  {!s.done && <Icon name="left" size={16} className="text-faint" />}
                </button>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="שומרים בצוות" value={guards.length} icon="users" tone="brand" onClick={() => onNavigate("team")} />
        <StatCard
          title="משמרות היום"
          value={todayShifts.length}
          subtitle={`${todayShifts.filter((s) => s.assignedGuards.length >= s.requiredGuards).length} מאוישות`}
          icon="calendar"
          tone="accent"
          onClick={() => onNavigate("shifts")}
        />
        <StatCard
          title="בקשות החלפה"
          value={pendingSwaps}
          subtitle="ממתינות"
          icon="swap"
          tone={pendingSwaps ? "warn" : "brand"}
          onClick={() => onNavigate("swaps")}
        />
        <StatCard title="משימות פתוחות" value={openTasks} icon="pencil" tone="info" onClick={() => onNavigate("tasks")} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <h2 className="font-bold text-content mb-4 flex items-center gap-2">
            <Icon name="calendar" size={17} className="text-muted" />
            המשמרות הקרובות
          </h2>
          {upcoming.length === 0 ? (
            <p className="text-muted text-sm text-center py-8">אין משמרות מתוכננות</p>
          ) : (
            <div className="space-y-2.5">
              {upcoming.map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-sunken ring-1 ring-inset ring-hairline">
                  <div className="w-1.5 h-10 rounded-full flex-shrink-0" style={{ background: s.color }} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-content truncate">
                      {s.label} <span className="text-muted font-normal">· {shortDate(s.date)}</span>
                    </p>
                    <p className="text-[11px] text-muted" data-numeric>
                      {s.startTime}–{s.endTime}
                    </p>
                  </div>
                  <div className="flex -space-x-2 space-x-reverse flex-shrink-0">
                    {s.assignedGuards.slice(0, 3).map((gid) => (
                      <Avatar key={gid} id={gid} name={guards.find((x) => x.id === gid)?.name} size={26} ring />
                    ))}
                    {s.assignedGuards.length === 0 && <Badge tone="neutral">לא משובץ</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-bold text-content mb-4 flex items-center gap-2">
            <Icon name="users" size={17} className="text-muted" />
            עומס השומרים
          </h2>
          {guards.length === 0 ? (
            <p className="text-muted text-sm text-center py-8">אין שומרים עדיין</p>
          ) : (
            <div className="space-y-3">
              {guards.map((g) => {
                const count = shifts.filter((s) => s.assignedGuards.includes(g.id)).length;
                return (
                  <div key={g.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar id={g.id} name={g.name} size={26} />
                        <span className="text-sm font-medium text-content truncate">{g.name}</span>
                      </div>
                      <span className="text-xs text-muted flex-shrink-0" data-numeric>
                        {count} משמרות
                      </span>
                    </div>
                    <Meter value={count} max={maxLoad} color={guardColor(g.id)} label={`עומס של ${g.name}`} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// SHIFT MANAGEMENT
// ============================================================

export function ShiftMgmt({ shifts, guards, weekDates, actions, busy, embedded = false }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [spreadFrom, setSpreadFrom] = useState(null); // date whose layout is being copied
  const [spreadTo, setSpreadTo] = useState([]);
  const [showFill, setShowFill] = useState(false);
  const blank = {
    date: weekDates[0], startTime: "07:00", endTime: "19:00", label: "משמרת יום",
    location: "כניסה ראשית", requiredGuards: 1, type: "morning", color: SHIFT_TONES.morning,
  };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    setForm((f) => ({ ...f, date: weekDates.includes(f.date) ? f.date : weekDates[0] }));
  }, [weekDates]);

  const weekShifts = shifts.filter((s) => weekDates.includes(s.date));
  const field = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const openNew = (date) => {
    setForm({ ...blank, date: date || weekDates[0] });
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (s) => {
    setForm({ ...s });
    setEditing(s.id);
    setShowForm(true);
  };

  const save = async () => {
    if (editing) await actions.updateShift(editing, form);
    else await actions.addShifts([form]);
    setShowForm(false);
    setEditing(null);
  };

  /**
   * "מלא שבוע" **מחליף** את השבוע, לא מוסיף עליו.
   *
   * הגרסה הקודמת דילגה על משמרות שכבר קיימות, ולכן מעבר מ-2 משמרות ליום
   * ל-3 היה משאיר את השתיים הישנות ומוסיף שלוש — חמש משמרות ביום שאיש
   * לא ביקש. מי שבוחר מבנה שבוע מצהיר איך השבוע נראה, ולא מבקש תוספת.
   */
  const fillWeek = async (pattern) => {
    const rows = [];
    for (const date of weekDates) {
      for (const tpl of pattern.shifts) {
        rows.push({
          date,
          label: tpl.label,
          startTime: tpl.startTime, endTime: tpl.endTime, type: tpl.type, color: tpl.color,
          location: "כניסה ראשית", requiredGuards: 1,
        });
      }
    }
    await actions.replaceShifts(weekShifts.map((s) => s.id), rows);
    setShowFill(false);
  };

  /** מחיקת השבוע כולו. `deleteShifts` נותן UndoBar, ולכן אין דיאלוג אישור. */
  const clearWeek = () => {
    if (!weekShifts.length) return;
    actions.deleteShifts(
      weekShifts.map((s) => s.id),
      `${weekShifts.length} משמרות נמחקו`
    );
  };

  /**
   * Copy one day's layout onto other days. Building Sunday exactly right and
   * then rebuilding it six more times by hand was the single most tedious
   * thing in the app.
   *
   * Only the shift *definition* travels — times, label, location, headcount.
   * Assignments deliberately do not: the same person on the same shift seven
   * days running would break every rest rule the scheduler enforces.
   */
  const openSpread = (date) => {
    setSpreadFrom(date);
    setSpreadTo(weekDates.filter((d) => d !== date));
  };

  const spreadShifts = spreadFrom ? weekShifts.filter((s) => s.date === spreadFrom) : [];

  const runSpread = async () => {
    // A shift already occupying that slot wins; re-applying is a no-op rather
    // than a way to end up with two identical 07:00 shifts.
    const taken = new Set(weekShifts.map((s) => `${s.date}|${s.startTime}|${s.endTime}`));
    const rows = [];
    for (const date of spreadTo) {
      for (const s of spreadShifts) {
        const key = `${date}|${s.startTime}|${s.endTime}`;
        if (taken.has(key)) continue;
        taken.add(key);
        rows.push({
          date,
          label: s.label,
          startTime: s.startTime,
          endTime: s.endTime,
          type: s.type,
          color: s.color,
          location: s.location,
          requiredGuards: s.requiredGuards,
        });
      }
    }
    if (rows.length) await actions.addShifts(rows);
    setSpreadFrom(null);
  };

  const applyTemplate = (tpl) =>
    setForm((f) => ({
      ...f,
      startTime: tpl.startTime, endTime: tpl.endTime, type: tpl.type, color: tpl.color,
      label:
        tpl.type === "night" ? "משמרת לילה" : tpl.type === "afternoon" ? "משמרת צהריים" : "משמרת יום",
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={embedded ? null : t("nav.shifts")}
        subtitle={`${rangeLabelHe(weekDates)} · ${weekShifts.length} משמרות`}
        actions={
          <>
            {weekShifts.length > 0 && (
              <Btn variant="ghost" icon="trash" onClick={clearWeek} disabled={busy}>
                מחק שבוע
              </Btn>
            )}
            <Btn variant="outline" icon="zap" onClick={() => setShowFill(true)} loading={busy}>
              מלא שבוע
            </Btn>
            <Btn icon="plus" onClick={() => openNew()}>
              משמרת
            </Btn>
          </>
        }
      />

      {weekShifts.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="אין עדיין משמרות בשבוע הזה"
          body="בחר איך נראה שבוע רגיל אצלך, ואמלא לך את כל השבוע. אפשר לשנות כל משמרת אחר כך."
          choices={[
            {
              label: "3 משמרות ביום",
              hint: "בוקר · צהריים · לילה, 8 שעות כל אחת",
              icon: "zap",
              disabled: busy,
              onClick: () => fillWeek(WEEK_PATTERNS.find((p) => p.key === "x3")),
            },
            {
              label: "בוקר + לילה",
              hint: "12 שעות כל אחת — הנפוץ באבטחה",
              icon: "zap",
              disabled: busy,
              onClick: () => fillWeek(WEEK_PATTERNS.find((p) => p.key === "x2")),
            },
            {
              label: "אבנה בעצמי",
              hint: "משמרת אחת, בהתאמה אישית",
              icon: "plus",
              onClick: () => openNew(),
            },
          ]}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {weekDates.map((date) => {
            const day = weekShifts.filter((s) => s.date === date);
            const isToday = date === todayISO();
            return (
              <div key={date}>
                <div className={`text-center mb-2 pb-2 border-b-2 ${isToday ? "border-brand" : "border-hairline"}`}>
                  <p className={`text-[11px] ${isToday ? "text-brand font-bold" : "text-muted"}`}>{dayName(date)}</p>
                  <div className="flex items-center justify-center gap-1">
                    <p className={`text-sm font-bold ${isToday ? "text-brand" : "text-content"}`} data-numeric>
                      {fromISODate(date).getDate()}
                    </p>
                    {day.length > 0 && (
                      <IconBtn
                        icon="copy"
                        size="sm"
                        label={`החל את משמרות ${dayName(date)} על שאר השבוע`}
                        onClick={() => openSpread(date)}
                      />
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  {day.map((s) => {
                    const ink = readableInk(s.color);
                    return (
                      <div
                        key={s.id}
                        className="rounded-xl p-2.5 text-xs relative cursor-pointer transition-[filter,transform] duration-200 hover:brightness-110 active:scale-[0.98] shadow-sm"
                        style={{ background: s.color, color: ink }}
                        onClick={() => openEdit(s)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openEdit(s);
                          }
                        }}
                      >
                        <div className="font-bold text-[12px] pl-6">{s.label}</div>
                        <div className="opacity-90 mt-0.5 text-[10px]" data-numeric>
                          {s.startTime}–{s.endTime}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {s.assignedGuards.map((gid) => {
                            const g = guards.find((x) => x.id === gid);
                            if (!g) return null;
                            const c = guardColor(gid);
                            return (
                              <span
                                key={gid}
                                className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                                style={{ backgroundColor: c, color: readableInk(c) }}
                              >
                                {g.name.split(" ")[0]}
                              </span>
                            );
                          })}
                          {s.assignedGuards.length === 0 && (
                            <span className="bg-black/25 text-white px-1.5 py-0.5 rounded text-[9px]">לא משובץ</span>
                          )}
                        </div>
                        <div className="mt-1 text-[9px] opacity-85 font-semibold" data-numeric>
                          {s.assignedGuards.length}/{s.requiredGuards}
                          {s.published && " · פורסם"}
                        </div>
                        {/* Always visible, not hover-only: a hover-gated control
                            is unreachable on a touch screen. */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            actions.deleteShift(s.id);
                          }}
                          className="absolute top-1.5 left-1.5 w-6 h-6 flex items-center justify-center rounded-full bg-black/25 text-white opacity-70 hover:opacity-100 hover:bg-danger transition-[opacity,background] cursor-pointer"
                          aria-label={`מחק את ${s.label} ב${shortDate(s.date)}`}
                        >
                          <Icon name="x" size={12} strokeWidth={2.5} />
                        </button>
                      </div>
                    );
                  })}
                  {day.length === 0 && (
                    <button
                      onClick={() => openNew(date)}
                      className="w-full border-2 border-dashed border-hairline rounded-xl py-4 text-faint hover:border-brand/50 hover:text-brand transition-colors cursor-pointer flex items-center justify-center"
                      aria-label={`הוסף משמרת ל${formatDateHe(date)}`}
                    >
                      <Icon name="plus" size={18} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={showFill}
        onClose={() => setShowFill(false)}
        title={`מלא את ${rangeLabelHe(weekDates)}`}
        footer={
          <Btn variant="secondary" onClick={() => setShowFill(false)} className="flex-1">
            ביטול
          </Btn>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted">
            בחר מבנה יום — הוא ייווצר לכל שבעת הימים בלחיצה אחת.
          </p>
          {weekShifts.length > 0 && (
            <Alert tone="warn">
              {weekShifts.length} המשמרות שכבר בשבוע הזה יוחלפו, והשיבוצים שבהן יימחקו.
            </Alert>
          )}
          {WEEK_PATTERNS.map((p) => (
            <button
              key={p.key}
              onClick={() => fillWeek(p)}
              disabled={busy}
              className="w-full text-right p-4 rounded-xl bg-surface-sunken ring-1 ring-inset ring-hairline
                hover:ring-brand/50 hover:bg-surface-hover cursor-pointer transition-colors duration-200
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="font-bold text-content text-sm">{p.title}</span>
                <span className="text-[11px] text-faint" data-numeric>
                  {p.shifts.length * weekDates.length} משמרות
                </span>
              </div>
              <p className="text-xs text-muted mb-2.5">{p.hint}</p>
              <div className="flex gap-1.5 flex-wrap">
                {p.shifts.map((s) => (
                  <span
                    key={s.startTime}
                    className="text-[10px] font-bold px-2 py-1 rounded-lg"
                    style={{ background: s.color, color: readableInk(s.color) }}
                    data-numeric
                  >
                    {s.startTime}–{s.endTime}
                  </span>
                ))}
              </div>
            </button>
          ))}
          <Alert tone="info">
            משמרת שכבר קיימת באותן שעות תדולג — אפשר להריץ בלי לייצר כפילויות.
          </Alert>
        </div>
      </Modal>

      <Modal
        open={Boolean(spreadFrom)}
        onClose={() => setSpreadFrom(null)}
        title={spreadFrom ? `החל את ${dayName(spreadFrom)} על שאר השבוע` : ""}
        footer={
          <>
            <Btn
              onClick={runSpread}
              loading={busy}
              disabled={!spreadTo.length}
              icon="copy"
              className="flex-1"
            >
              החל על {spreadTo.length} ימים
            </Btn>
            <Btn variant="secondary" onClick={() => setSpreadFrom(null)}>
              ביטול
            </Btn>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-content mb-2">
              המשמרות שיועתקו ({spreadShifts.length})
            </p>
            <div className="space-y-1.5">
              {spreadShifts.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 text-xs bg-surface-sunken rounded-lg px-3 py-2"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="font-medium text-content">{s.label}</span>
                  <span className="text-muted" data-numeric>
                    {s.startTime}–{s.endTime}
                  </span>
                  <span className="text-faint mr-auto" data-numeric>
                    {s.requiredGuards} שומרים
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-content mb-2">לאילו ימים</p>
            <div className="grid grid-cols-3 gap-2">
              {weekDates
                .filter((d) => d !== spreadFrom)
                .map((d) => {
                  const on = spreadTo.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() =>
                        setSpreadTo((prev) =>
                          prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
                        )
                      }
                      className={`h-11 rounded-xl text-xs font-medium ring-1 ring-inset cursor-pointer
                        transition-colors duration-200 flex flex-col items-center justify-center ${
                          on
                            ? "bg-brand text-on-brand ring-brand"
                            : "bg-surface-sunken ring-hairline text-muted hover:text-content"
                        }`}
                    >
                      <span>{dayName(d)}</span>
                      <span className="text-[10px] opacity-80" data-numeric>
                        {shortDate(d)}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>

          <Alert tone="info">
            יום שכבר יש בו משמרת באותן שעות יידלג — אפשר להריץ שוב בלי לייצר כפילויות.
            השיבוצים עצמם לא מועתקים, רק הגדרת המשמרות.
          </Alert>
        </div>
      </Modal>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "עריכת משמרת" : "משמרת חדשה"}
        footer={
          <>
            <Btn onClick={save} loading={busy} className="flex-1">
              {editing ? "שמור" : "צור משמרת"}
            </Btn>
            {editing && (
              <Btn
                variant="danger"
                icon="trash"
                onClick={async () => {
                  await actions.deleteShift(editing);
                  setShowForm(false);
                }}
              >
                מחק
              </Btn>
            )}
            <Btn variant="secondary" onClick={() => setShowForm(false)}>
              ביטול
            </Btn>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-content mb-2">תבניות מהירות</p>
            <div className="flex flex-wrap gap-2">
              {SHIFT_TEMPLATES.map((t) => {
                const active = form.startTime === t.startTime && form.endTime === t.endTime;
                return (
                  <button
                    key={t.key}
                    onClick={() => applyTemplate(t)}
                    aria-pressed={active}
                    className={`px-3 h-9 rounded-lg text-xs font-medium ring-1 ring-inset cursor-pointer transition-colors duration-200 ${
                      active
                        ? "bg-brand text-on-brand ring-brand"
                        : "bg-surface-sunken ring-hairline text-muted hover:text-content hover:ring-brand/40"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="תאריך">
              <Select value={form.date} onChange={field("date")}>
                {weekDates.map((d) => (
                  <option key={d} value={d}>
                    {formatDateHe(d)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="תווית">
              <Input value={form.label} onChange={field("label")} />
            </Field>
            <Field label="שעת התחלה">
              <Input type="time" value={form.startTime} onChange={field("startTime")} />
            </Field>
            <Field label="שעת סיום">
              <Input type="time" value={form.endTime} onChange={field("endTime")} />
            </Field>
            <Field label="מיקום">
              <Input value={form.location} onChange={field("location")} />
            </Field>
            <Field label="שומרים נדרשים">
              <Input
                type="number"
                min="1"
                max="10"
                value={form.requiredGuards}
                onChange={(e) => setForm((f) => ({ ...f, requiredGuards: Number(e.target.value) }))}
              />
            </Field>
          </div>
          <p className="text-xs text-muted">
            אורך המשמרת:{" "}
            {shiftHours({ date: form.date, startTime: form.startTime, endTime: form.endTime })} שעות
          </p>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// AVAILABILITY REVIEW
// ============================================================

export function AvailView({ guards, shifts, availability, weekDates, embedded = false }) {
  const weekShifts = shifts.filter((s) => weekDates.includes(s.date));

  const submitted = guards.filter((g) =>
    weekShifts.some((s) => availStatus(availability, g.id, s.id) !== "unknown")
  );

  if (!weekShifts.length) {
    return (
      <div className="space-y-6">
        <PageHeader title={embedded ? null : t("nav.availability")} subtitle={rangeLabelHe(weekDates)} />
        <EmptyState
          icon="calendar"
          title="אין משמרות בשבוע הזה"
          body="צור משמרות כדי שהשומרים יוכלו להגיש זמינות."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={embedded ? null : t("nav.availability")}
        subtitle={`${rangeLabelHe(weekDates)} · ${submitted.length} מתוך ${guards.length} הגישו`}
      />

      {submitted.length < guards.length && (
        <Alert tone="info">
          {guards.length - submitted.length} שומרים טרם הגישו זמינות לשבוע הזה:{" "}
          <strong>
            {guards.filter((g) => !submitted.includes(g)).map((g) => g.name).join(", ")}
          </strong>
        </Alert>
      )}

      {weekDates.map((date) => {
        const dayShifts = weekShifts.filter((s) => s.date === date);
        if (!dayShifts.length) return null;
        return (
          <Card key={date} className="overflow-x-auto">
            <h3 className="font-bold text-content mb-3">{formatDateHe(date)}</h3>
            <table className="w-full text-sm min-w-[420px]">
              <caption className="sr-only">זמינות השומרים ל{formatDateHe(date)}</caption>
              <thead>
                <tr className="border-b border-hairline">
                  <th scope="col" className="text-right py-2 px-3 font-medium text-muted">
                    שומר
                  </th>
                  {dayShifts.map((s) => (
                    <th key={s.id} scope="col" className="text-center py-2 px-3 font-medium text-muted">
                      <div className="text-xs">{s.label}</div>
                      <div className="text-[10px] font-normal text-faint">
                        {s.startTime}–{s.endTime}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {guards.map((g) => (
                  <tr key={g.id} className="border-b border-hairline last:border-0">
                    <th scope="row" className="py-2.5 px-3 text-right font-normal">
                      <div className="flex items-center gap-2">
                        <Avatar id={g.id} name={g.name} size={24} />
                        <span className="font-medium text-content text-xs">{g.name}</span>
                      </div>
                    </th>
                    {dayShifts.map((s) => {
                      const raw = availability[`${g.id}-${s.id}`];
                      const meta = AVAIL[availStatus(availability, g.id, s.id)];
                      const comment = typeof raw === "object" ? raw?.comment : "";
                      return (
                        <td key={s.id} className="py-2.5 px-3 text-center">
                          <span className={`inline-flex flex-col items-center gap-0.5 ${meta.cls}`}>
                            <Icon name={meta.icon} size={18} label={meta.label} />
                            <span className="text-[10px] font-medium">{meta.label}</span>
                          </span>
                          {comment && (
                            <span
                              className="flex items-center justify-center gap-1 text-[10px] text-muted mt-0.5 max-w-[90px] mx-auto"
                              title={comment}
                            >
                              <Icon name="message" size={10} />
                              <span className="truncate">{comment}</span>
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// MANUAL ASSIGNMENT
// ============================================================

export function AssignView({ guards, shifts, availability, weekDates, actions, busy, onNavigate, embedded = false }) {
  const [date, setDate] = useState(weekDates[0]);
  useEffect(() => {
    if (!weekDates.includes(date)) setDate(weekDates[0]);
  }, [weekDates, date]);

  const dayShifts = shifts.filter((s) => s.date === date);

  /**
   * ההמלצה: מי צריך לקבל עוד, ומי כבר מעל הממוצע.
   *
   * ההיסטוריה היא כל מה שקדם לשבוע שנבנה, והשבוע עצמו נספר בנפרד — כך
   * שההמלצה יורדת תוך כדי שיבוץ ולא נשארת תלושה ממה שקורה על המסך.
   */
  const weekStart = weekDates[0];
  const weekEnd = weekDates[weekDates.length - 1];
  const fairness = useMemo(() => {
    const history = shifts.filter((s) => s.date < weekStart);
    const planned = shifts.filter((s) => s.date >= weekStart && s.date <= weekEnd);
    return fairnessPlan({ guards, history, planned, until: weekStart, days: 14 });
  }, [guards, shifts, weekStart, weekEnd]);

  const hintOf = useMemo(() => {
    const map = new Map(fairness.rows.map((r) => [r.id, fairnessHint(r)]));
    return (id) => map.get(id) || null;
  }, [fairness]);

  const under = fairness.rows.filter((r) => r.needs >= 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title={embedded ? null : t("nav.assignment")}
        subtitle="לחץ על שומר כדי לשבץ או להסיר"
        actions={
          embedded ? null : (
            <Btn variant="outline" icon="zap" onClick={() => onNavigate("smart")}>
              {t("nav.smart")}
            </Btn>
          )
        }
      />

      <div className="flex gap-1.5 flex-wrap" role="tablist" aria-label="בחירת יום">
        {weekDates.map((d) => (
          <button
            key={d}
            role="tab"
            aria-selected={date === d}
            onClick={() => setDate(d)}
            className={`px-3 h-9 rounded-lg text-xs font-semibold cursor-pointer transition-colors duration-200 ${
              date === d
                ? "bg-brand text-on-brand"
                : "glass text-muted hover:text-content"
            }`}
          >
            {shortDate(d)}
          </button>
        ))}
      </div>

      {/* ---- המלצת האיזון ----
        * נמדדת על שבועיים אחורה ולא על השבוע שעל המסך: מי שנשא שני שבועות
        * רצופים נראה מאוזן לגמרי בשבוע השלישי, וזה בדיוק הקיפוח שאף אחד
        * לא מצליח להצביע עליו. */}
      {under.length > 0 && (
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2.5 flex-wrap">
            <Icon name="scale" size={17} className="text-brand" />
            <h3 className="font-bold text-content text-sm">איזון על פני שבועיים</h3>
            <span className="text-xs text-muted">
              ממוצע הצוות: {fairness.avgLoad} נטל
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {under.map((r) => (
              <span
                key={r.id}
                className="flex items-center gap-2 h-9 pr-1.5 pl-3 rounded-xl
                  bg-brand/10 ring-1 ring-inset ring-brand/25"
              >
                <Avatar id={r.id} name={r.name} size={24} />
                <span className="text-xs font-semibold text-content">{r.name}</span>
                <span className="text-xs font-bold text-brand" data-numeric>
                  +{r.needs}
                </span>
              </span>
            ))}
          </div>
          <p className="text-[11px] text-faint mt-2">
            המספר הוא כמה משמרות עוד מגיעות לו כדי להשתוות לצוות. הוא יורד תוך כדי שיבוץ.
          </p>
        </div>
      )}

      {dayShifts.length === 0 ? (
        <EmptyState icon="calendar" title="אין משמרות בתאריך הזה" />
      ) : (
        dayShifts.map((shift) => {
          const ink = readableInk(shift.color);
          return (
            <Card key={shift.id} className="p-0 overflow-hidden">
              <div
                className="p-4 flex items-center justify-between gap-3 flex-wrap"
                style={{ background: shift.color, color: ink }}
              >
                <div>
                  <h3 className="font-bold text-lg">
                    {shift.label}{" "}
                    <span className="opacity-80 text-sm font-medium" data-numeric>
                      {shift.startTime}–{shift.endTime}
                    </span>
                  </h3>
                  <p className="text-sm opacity-90 mt-0.5 flex items-center gap-1">
                    <Icon name="map-pin" size={13} />
                    {shift.location} · נדרשים {shift.requiredGuards}
                  </p>
                </div>
                <div className="bg-black/20 px-3 py-1.5 rounded-xl font-bold text-sm" data-numeric>
                  {shift.assignedGuards.length}/{shift.requiredGuards}
                </div>
              </div>
              <div className="p-4">
                {guards.length === 0 ? (
                  <p className="text-muted text-sm text-center py-4">אין שומרים בצוות</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                    {guards.map((g) => {
                      const status = availStatus(availability, g.id, shift.id);
                      const meta = AVAIL[status];
                      const assigned = shift.assignedGuards.includes(g.id);
                      const raw = availability[`${g.id}-${shift.id}`];
                      const comment = typeof raw === "object" ? raw?.comment : "";
                      return (
                        <button
                          key={g.id}
                          onClick={() => actions.toggleAssignment(shift.id, g.id)}
                          disabled={busy}
                          aria-pressed={assigned}
                          className={`p-2.5 rounded-xl ring-2 ring-inset text-center cursor-pointer
                            transition-[background,box-shadow,transform] duration-200 active:scale-[0.97]
                            disabled:opacity-60 disabled:cursor-wait ${
                              assigned
                                ? "ring-brand bg-brand/15"
                                : status === "available"
                                ? "ring-accent/30 bg-accent/10 hover:ring-accent/60"
                                : status === "unavailable"
                                ? "ring-danger/20 bg-danger/5 opacity-60"
                                : status === "maybe"
                                ? "ring-warn/30 bg-warn/10"
                                : "ring-hairline bg-surface-sunken hover:ring-hairline-strong"
                            }`}
                          title={comment ? `הערה: ${comment}` : undefined}
                        >
                          <div className="flex justify-center mb-1 relative">
                            <Avatar id={g.id} name={g.name} size={30} />
                            {/* התג יושב על התמונה ולא בשורה נפרדת: הרשת
                              * צפופה, ושורה רביעית הייתה מרסקת אותה. */}
                            {(() => {
                              const h = hintOf(g.id);
                              if (!h) return null;
                              return (
                                <span
                                  className={`absolute -top-1 -left-1.5 min-w-[18px] h-[18px] px-1
                                    rounded-full text-[10px] font-bold flex items-center justify-center
                                    ring-2 ring-surface ${
                                      h.level === "under"
                                        ? "bg-brand text-on-brand"
                                        : "bg-warn text-on-brand"
                                    }`}
                                  title={h.text}
                                  data-numeric
                                >
                                  {/* מספר ולא סימן קריאה: "!" אומר שמשהו לא
                                    * בסדר, ולא כמה — ומנהל צריך לדעת כמה. */}
                                  {h.level === "under" ? "+" : "−"}
                                  {Math.abs(fairness.rows.find((r) => r.id === g.id)?.needs || 0)}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="text-[11px] font-semibold text-content truncate">
                            {g.name.split(" ")[0]}
                          </div>
                          <div className="text-[10px] text-muted flex items-center justify-center gap-0.5">
                            {assigned && <Icon name="check" size={10} strokeWidth={3} className="text-brand" />}
                            {assigned ? "משובץ" : meta.label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

// ============================================================
// PUBLISH
// ============================================================

/**
 * שיתוף השבוע כתמונה.
 *
 * הצוות חי בוואטסאפ, ולכן זו הדרך שבה סידור באמת מגיע לאנשים — גם אחרי
 * שפורסם באפליקציה. הקוד של הרינדור נטען רק בלחיצה: הוא מיותר לחלוטין
 * לכל מי שרק בונה סידור ולא משתף אותו.
 */
function ShareWeekBtn({ dates, shifts, guards }) {
  const [state, setState] = useState("idle");
  const run = async () => {
    setState("working");
    try {
      const { shareWeekImage } = await import("../../lib/shareImage.js");
      const how = await shareWeekImage({ dates, shifts, guards });
      setState(how === "downloaded" ? "downloaded" : "idle");
    } catch {
      setState("failed");
    }
  };
  return (
    <Btn
      variant="outline"
      icon="image"
      onClick={run}
      loading={state === "working"}
      title="תמונה שאפשר לשלוח בוואטסאפ"
    >
      {state === "downloaded" ? "התמונה הורדה" : state === "failed" ? "נסה שוב" : "שתף כתמונה"}
    </Btn>
  );
}

export function ScheduleMgmt({ guards, shifts, weekDates, actions, busy, embedded = false }) {
  const weekShifts = shifts.filter((s) => weekDates.includes(s.date));
  const allIds = weekShifts.map((s) => s.id);
  const publishedCount = weekShifts.filter((s) => s.published).length;
  const unassigned = weekShifts.filter((s) => s.assignedGuards.length < s.requiredGuards).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={embedded ? null : t("nav.schedule")}
        subtitle={`${rangeLabelHe(weekDates)} · ${publishedCount}/${weekShifts.length} מפורסמות`}
        actions={
          <>
            {publishedCount < weekShifts.length && (
              <Btn variant="accent" icon="share" onClick={() => actions.publish(allIds, true)} loading={busy}>
                פרסם הכל
              </Btn>
            )}
            {publishedCount > 0 && (
              <Btn variant="outline" onClick={() => actions.publish(allIds, false)} loading={busy}>
                בטל פרסום
              </Btn>
            )}
            {weekShifts.length > 0 && (
              <ShareWeekBtn dates={weekDates} shifts={weekShifts} guards={guards} />
            )}
          </>
        }
      />

      {weekShifts.length === 0 ? (
        <EmptyState icon="clipboard" title="אין מה לפרסם" body="צור ושבץ משמרות תחילה." />
      ) : (
        <>
          {unassigned > 0 && (
            <Alert tone="warn">
              {unassigned} משמרות עדיין לא מאוישות במלואן. אפשר לפרסם בכל זאת — השומרים יראו אותן
              כפתוחות.
            </Alert>
          )}
          {weekDates.map((date) => {
            const dayShifts = weekShifts.filter((s) => s.date === date);
            if (!dayShifts.length) return null;
            const allPub = dayShifts.every((s) => s.published);
            return (
              <Card key={date}>
                <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                  <div>
                    <h3 className="font-bold text-content">{formatDateHe(date)}</h3>
                    <p className="text-xs text-muted">{dayShifts.length} משמרות</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={allPub ? "accent" : "neutral"} icon={allPub ? "check" : "pencil"}>
                      {allPub ? "מפורסם" : "טיוטה"}
                    </Badge>
                    <Btn
                      size="sm"
                      variant={allPub ? "outline" : "primary"}
                      onClick={() => actions.publish(dayShifts.map((s) => s.id), !allPub)}
                    >
                      {allPub ? "בטל" : "פרסם יום"}
                    </Btn>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {dayShifts.map((s) => {
                    const ink = readableInk(s.color);
                    return (
                      <div
                        key={s.id}
                        className="p-3 rounded-xl shadow-sm"
                        style={{ background: s.color, color: ink }}
                      >
                        <div className="flex justify-between items-start mb-2 gap-2">
                          <span className="font-bold text-sm bg-black/15 px-2 py-0.5 rounded-lg">
                            {s.label}
                          </span>
                          <span className="text-[11px] opacity-90" data-numeric>
                            {s.startTime}–{s.endTime}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {s.assignedGuards.length === 0 ? (
                            <span className="bg-black/30 text-white px-2 py-1 rounded-md text-[11px] font-semibold">
                              לא משובץ
                            </span>
                          ) : (
                            s.assignedGuards.map((gid) => {
                              const g = guards.find((x) => x.id === gid);
                              if (!g) return null;
                              const c = guardColor(gid);
                              return (
                                <span
                                  key={gid}
                                  className="px-2 py-1 rounded-md text-[11px] font-bold"
                                  style={{ backgroundColor: c, color: readableInk(c) }}
                                >
                                  {g.name}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}

// ============================================================
// SWAPS
// ============================================================

const SWAP_STATUS = {
  pending:  { label: "ממתין", tone: "warn" },
  approved: { label: "אושר",  tone: "accent" },
  rejected: { label: "נדחה",  tone: "danger" },
};

export function SwapMgmt({ guards, shifts, availability = {}, swapRequests, actions, busy }) {
  const gName = (id) => guards.find((g) => g.id === id)?.name || "—";

  // A swap the engine would never have produced must not be reachable by
  // approving a request either — so the same hard constraints run here, and
  // the reason is shown before the supervisor commits rather than after.
  const legality = (r) => {
    const shift = shifts.find((x) => x.id === r.shiftId);
    const guard = guards.find((g) => g.id === r.toGuard);
    if (!shift || !guard) {
      return { ok: false, reason: "המשמרת או המאבטח כבר לא קיימים" };
    }
    return checkAssignment({ guard, shift, shifts, availability });
  };
  const pending = swapRequests.filter((r) => r.status === "pending");
  const resolved = swapRequests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <PageHeader title="בקשות החלפה" subtitle={`${pending.length} ממתינות לאישור`} />
      {swapRequests.length === 0 ? (
        <EmptyState
          icon="swap"
          title="אין בקשות החלפה"
          body="כשמאבטח יבקש להחליף משמרת, הבקשה תופיע כאן לאישורך."
        />
      ) : (
        [...pending, ...resolved].map((r) => {
          const s = shifts.find((x) => x.id === r.shiftId);
          const status = SWAP_STATUS[r.status];
          const legal = r.status === "pending" ? legality(r) : null;
          return (
            <Card key={r.id} className={r.status === "pending" ? "!border-warn/30" : "opacity-70"}>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <Icon name="swap" size={22} className="text-muted" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-content">{gName(r.fromGuard)}</span>
                      <Icon name="left" size={14} className="text-faint" />
                      <span className="font-semibold text-sm text-content">{gName(r.toGuard)}</span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    {s && (
                      <p className="text-xs text-muted mt-1">
                        {formatDateHe(s.date)} · {s.label} {s.startTime}–{s.endTime}
                      </p>
                    )}
                    {r.message && (
                      <p className="text-xs text-muted mt-1 flex items-center gap-1">
                        <Icon name="message" size={12} />
                        {r.message}
                      </p>
                    )}
                    {legal && !legal.ok && (
                      <p className="text-xs text-danger mt-2 flex items-start gap-1 font-semibold">
                        <Icon name="alert" size={12} className="mt-[3px] flex-shrink-0" />
                        <span>לא ניתן לאשר — {gName(r.toGuard)} {legal.reason}</span>
                      </p>
                    )}
                  </div>
                </div>
                {r.status === "pending" && (
                  <div className="flex gap-2 flex-shrink-0">
                    <Btn
                      variant="accent"
                      size="sm"
                      icon="check"
                      onClick={() => actions.decideSwap(r, "approved")}
                      disabled={busy || !legal?.ok}
                      title={legal?.ok ? undefined : legal?.reason}
                    >
                      אשר
                    </Btn>
                    <Btn
                      variant="danger"
                      size="sm"
                      icon="x"
                      onClick={() => actions.decideSwap(r, "rejected")}
                      disabled={busy}
                    >
                      דחה
                    </Btn>
                  </div>
                )}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

// ============================================================
// TASKS
// ============================================================

const PRIORITY = {
  high:   { label: "גבוהה",  tone: "danger", color: "rgb(var(--danger))" },
  medium: { label: "בינונית", tone: "warn",   color: "rgb(var(--warn))" },
  low:    { label: "נמוכה",  tone: "brand",  color: "rgb(var(--brand))" },
};

/**
 * תיקיות מוצעות.
 *
 * תיקייה כאן היא **תווית, לא ישות**: היא נשמרת כטקסט על המשימה, ולכן
 * מנהל משמרת ממציא "סיור לילה" תוך כדי עבודה בלי לפתוח מסך ניהול
 * תיקיות ובלי הרשאות. הרשימה כאן היא רק קיצור דרך לשמות הנפוצים —
 * מי שכותב שם אחר מקבל תיקייה חדשה באותה מידה.
 */
const FOLDERS = [
  { name: "שמירות", icon: "shield" },
  { name: "סיור", icon: "target" },
  { name: "מטבח", icon: "inbox" },
  { name: "ציוד", icon: "wrench" },
  { name: "ניקיון", icon: "sparkles" },
  { name: "כללי", icon: "clipboard" },
];

const UNFILED = "כללי";
const folderIcon = (name) => FOLDERS.find((f) => f.name === name)?.icon || "clipboard";

/** חלון הזמן של משימה, כמשפט אחד. */
const rangeText = (task) => {
  if (task.startDate && task.dueDate && task.startDate !== task.dueDate)
    return `${formatDateHe(task.startDate)} – ${formatDateHe(task.dueDate)}`;
  return task.dueDate ? formatDateHe(task.dueDate) : "";
};

/** ערימת פרצופים. מעל ארבעה — השאר נספרים, כי חמישה עיגולים כבר לא נקראים. */
const People = ({ ids, guards, size = 22, max = 4 }) => {
  const people = ids.map((id) => guards.find((g) => g.id === id)).filter(Boolean);
  if (!people.length) return <span className="text-[11px] text-faint">אין משויכים</span>;
  return (
    <div className="flex items-center">
      <div className="flex -space-x-1.5 space-x-reverse">
        {people.slice(0, max).map((g) => (
          <Avatar key={g.id} id={g.id} name={g.name} size={size} ring label={g.name} />
        ))}
      </div>
      {people.length > max && (
        <span className="text-[11px] text-muted font-semibold mr-2" data-numeric>
          +{people.length - max}
        </span>
      )}
    </div>
  );
};

export function TaskMgmt({
  guards, tasks, weekDates, actions, busy,
  templates = [], compatibility = [], mode = "civil",
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [openFolder, setOpenFolder] = useState(null); // null = הכול
  const [picked, setPicked] = useState([]); // מפתחות של תבנית+עמדה
  const [override, setOverride] = useState(false);

  const blank = {
    title: "", description: "", category: UNFILED, assignees: [],
    priority: "medium", startDate: weekDates[0], dueDate: weekDates[6] || weekDates[0],
    overrideNote: "",
  };
  const [form, setForm] = useState(blank);
  const field = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const toggleAssignee = (id) =>
    setForm((f) => ({
      ...f,
      assignees: f.assignees.includes(id)
        ? f.assignees.filter((x) => x !== id)
        : [...f.assignees, id],
    }));

  const openNew = () => {
    setForm({ ...blank, category: openFolder || UNFILED });
    setEditing(null);
    setOverride(false);
    setShowForm(true);
  };

  const openEdit = (task) => {
    setForm({
      title: task.title, description: task.description, category: task.category || UNFILED,
      assignees: task.assignees || [], priority: task.priority,
      startDate: task.startDate || "", dueDate: task.dueDate || "",
      overrideNote: task.overrideNote || "",
    });
    setEditing(task.id);
    setOverride(Boolean(task.overrideNote));
    setShowForm(true);
  };

  // ---- מטריצת ההתנגשויות ----
  const compat = useMemo(() => compatIndex(compatibility), [compatibility]);
  const conflicts = useMemo(
    () =>
      findConflicts({
        candidate: { ...form, id: editing },
        assignees: form.assignees,
        tasks,
        compat,
      }),
    [form, editing, tasks, compat]
  );
  const nameOf = (id) => guards.find((g) => g.id === id)?.name || "מישהו";
  // חסימה היא ברירת המחדל; עקיפה נפתחת רק אחרי שנכתבה סיבה. הערה ריקה
  // הופכת את המתג לכפתור "המשך" — וזה בדיוק מה שהוא לא אמור להיות.
  const blocked = conflicts.length > 0 && (!override || !form.overrideNote.trim());

  const save = async () => {
    if (!form.title.trim() || blocked) return;
    // חלון הפוך הוא שגיאת הקלדה, לא כוונה — מיישרים אותו במקום לחסום.
    const clean =
      form.startDate && form.dueDate && form.startDate > form.dueDate
        ? { ...form, startDate: form.dueDate, dueDate: form.startDate }
        : form;
    // ההצדקה שייכת להתנגשות. אין התנגשות — אין מה להצדיק, והשדה מתנקה
    // כדי שלא תישאר בשורה סיבה לדבר שכבר לא קורה.
    const withNote = { ...clean, overrideNote: conflicts.length ? clean.overrideNote : "" };
    if (editing) await actions.editTask(editing, withNote);
    else await actions.createTask(withNote);
    setShowForm(false);
    setEditing(null);
  };

  /**
   * תבנית הופכת למשימות.
   *
   * תבנית עם עמדות מייצרת משימה נפרדת לכל עמדה שנבחרה, כי "עמדות" היא לא
   * משימה אחת שלושה אנשים עושים — הן שלוש משימות שכל אחת מהן מאוישת בנפרד.
   */
  const templateKey = (tpl, pos) => `${tpl.id}|${pos || ""}`;

  // תבנית של הפרופיל הנוכחי, או כזו שסומנה כמתאימה לשניהם.
  const visibleTemplates = templates.filter((tpl) => tpl.mode === mode || tpl.mode === "any");

  const applyTemplates = async () => {
    const rows = [];
    for (const tpl of templates) {
      const slots = tpl.positions.length ? tpl.positions : [null];
      for (const pos of slots) {
        if (!picked.includes(templateKey(tpl, pos))) continue;
        rows.push({
          title: pos ? `${tpl.title} — ${pos}` : tpl.title,
          description: "",
          category: tpl.category,
          assignees: [],
          priority: tpl.priority,
          startDate: weekDates[0],
          dueDate: weekDates[6] || weekDates[0],
        });
      }
    }
    if (!rows.length) return;
    await actions.createTasks(rows);
    setPicked([]);
  };

  /**
   * קיבוץ לתיקיות. הסדר הוא: התיקיות המוצעות לפי סדרן, ואחריהן כל שם
   * שהמשתמש המציא, לפי א״ב — כך שמיקום התיקייה במסך לא קופץ בכל טעינה.
   */
  const folders = (() => {
    const map = new Map();
    for (const task of tasks) {
      const key = task.category || UNFILED;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(task);
    }
    const known = FOLDERS.map((f) => f.name).filter((n) => map.has(n));
    const custom = [...map.keys()].filter((n) => !FOLDERS.some((f) => f.name === n)).sort();
    return [...known, ...custom].map((name) => {
      const items = map.get(name);
      const open = items.filter((t) => t.status !== "done");
      return {
        name,
        items,
        open: open.length,
        // מי משויך לתיקייה = איחוד המשויכים של המשימות הפתוחות שבה.
        people: [...new Set(open.flatMap((t) => t.assignees || []))],
      };
    });
  })();

  const shown = openFolder ? folders.filter((f) => f.name === openFolder) : folders;
  const openCount = tasks.filter((t) => t.status !== "done").length;

  const TaskRow = ({ task }) => {
    const done = task.status === "done";
    const prio = PRIORITY[task.priority] || PRIORITY.medium;
    const range = rangeText(task);
    return (
      <div
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-200
          hover:bg-surface-hover ${done ? "opacity-55" : ""}`}
      >
        <button
          onClick={() => actions.toggleTask(task.id, done ? "pending" : "done")}
          disabled={busy}
          role="checkbox"
          aria-checked={done}
          aria-label={`${task.title} — ${done ? "בוצע" : "לא בוצע"}`}
          className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 cursor-pointer
            ring-1 ring-inset transition-colors duration-200 ${
              done
                ? "bg-accent text-on-accent ring-accent"
                : "bg-surface-sunken ring-hairline hover:ring-accent/50"
            }`}
        >
          {done && <Icon name="check" size={14} strokeWidth={3} />}
        </button>

        <button
          type="button"
          onClick={() => openEdit(task)}
          className="flex-1 min-w-0 text-right cursor-pointer"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`font-semibold text-sm ${done ? "line-through text-muted" : "text-content"}`}
            >
              {task.title}
            </span>
            <Badge tone={prio.tone}>
              <Dot color={prio.color} size={6} />
              {prio.label}
            </Badge>
          </div>
          {task.description && <p className="text-xs text-muted mt-0.5">{task.description}</p>}
          {range && (
            <span className="flex items-center gap-1 mt-1 text-[11px] text-faint" data-numeric>
              <Icon name="calendar" size={11} />
              {range}
            </span>
          )}
        </button>

        <People ids={task.assignees || []} guards={guards} size={24} max={3} />

        <IconBtn
          icon="trash"
          label={`מחק את המשימה ${task.title}`}
          size="sm"
          className="hover:text-danger flex-shrink-0"
          onClick={() => actions.deleteTask(task.id)}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="משימות"
        subtitle={`${openCount} פתוחות · ${folders.length} תיקיות`}
        actions={
          <Btn icon="plus" onClick={openNew}>
            משימה
          </Btn>
        }
      />

      {/* ---- תבניות. רק כשיש מה להציע — שורה ריקה היא רעש ---- */}
      {visibleTemplates.length > 0 && (
        <div className="glass rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Icon name="sparkles" size={17} className="text-brand" />
            <h2 className="font-bold text-content text-sm">תבניות מוכנות</h2>
            <p className="text-xs text-muted">
              בחר מה נדרש השבוע — כל בחירה נפתחת כמשימה בתיקייה שלה
            </p>
            <div className="mr-auto">
              <Btn
                size="sm"
                icon="plus"
                onClick={applyTemplates}
                loading={busy}
                disabled={!picked.length}
              >
                {picked.length ? `צור ${picked.length}` : "צור"}
              </Btn>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {visibleTemplates.flatMap((tpl) => {
              const slots = tpl.positions.length ? tpl.positions : [null];
              return slots.map((pos) => {
                const key = templateKey(tpl, pos);
                const on = picked.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setPicked((p) => (on ? p.filter((k) => k !== key) : [...p, key]))
                    }
                    className={`flex items-center gap-2 h-10 px-3 rounded-xl text-sm font-semibold
                      cursor-pointer ring-1 ring-inset transition-colors duration-200 ${
                        on
                          ? "bg-brand text-on-brand ring-brand"
                          : "bg-surface-sunken ring-hairline text-muted hover:text-content"
                      }`}
                  >
                    <Icon name={on ? "check" : tpl.icon} size={15} />
                    {pos ? `${tpl.title} · ${pos}` : tpl.title}
                  </button>
                );
              });
            })}
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <EmptyState
          icon="clipboard"
          title="אין עדיין משימות"
          body="משימה נשמרת בתיקייה — שמירות, סיור, מטבח — עם טווח תאריכים והאנשים שמבצעים אותה."
          action={
            <Btn icon="plus" onClick={openNew}>
              משימה ראשונה
            </Btn>
          }
        />
      ) : (
        <>
          {/* שורת התיקיות. גם ניווט וגם תשובה לשאלה "מי על מה" — כל שבב
            * נושא את מספר המשימות הפתוחות בתיקייה שלו. */}
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setOpenFolder(null)}
              aria-pressed={openFolder === null}
              className={`h-10 px-3.5 rounded-xl text-sm font-semibold cursor-pointer
                ring-1 ring-inset transition-colors duration-200 ${
                  openFolder === null
                    ? "bg-brand text-on-brand ring-brand"
                    : "bg-surface-sunken ring-hairline text-muted hover:text-content"
                }`}
            >
              הכול
            </button>
            {folders.map((f) => {
              const on = openFolder === f.name;
              return (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => setOpenFolder(on ? null : f.name)}
                  aria-pressed={on}
                  className={`h-10 px-3.5 rounded-xl text-sm font-semibold cursor-pointer
                    flex items-center gap-2 ring-1 ring-inset transition-colors duration-200 ${
                      on
                        ? "bg-brand text-on-brand ring-brand"
                        : "bg-surface-sunken ring-hairline text-muted hover:text-content"
                    }`}
                >
                  <Icon name={folderIcon(f.name)} size={15} />
                  {f.name}
                  <span
                    className={`text-[11px] font-bold ${on ? "opacity-80" : "text-faint"}`}
                    data-numeric
                  >
                    {f.open}
                  </span>
                </button>
              );
            })}
          </div>

          {/* לא <Card>: הריפוד שלו הוא p-5, ו-p-0 באותה קבוצת utility לא
            * בהכרח מנצח אותו בסדר ה-CSS. כותרת התיקייה חייבת להיצמד לשוליים,
            * אז המשטח נבנה כאן במפורש. */}
          <div className="space-y-4">
            {shown.map((f) => (
              <div key={f.name} className="glass rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-surface-sunken border-b border-hairline flex-wrap">
                  <span className="w-9 h-9 rounded-xl bg-brand/12 text-brand ring-1 ring-inset ring-brand/25 flex items-center justify-center flex-shrink-0">
                    <Icon name={folderIcon(f.name)} size={18} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-bold text-content text-[15px]">{f.name}</h2>
                    <p className="text-[11px] text-muted" data-numeric>
                      {f.open} פתוחות מתוך {f.items.length}
                    </p>
                  </div>
                  {/* השאלה "מי בשמירות" נענית כאן, בלי לפתוח אף משימה. */}
                  <div className="mr-auto flex items-center gap-2">
                    <span className="text-[11px] text-faint hidden sm:inline">מי בתיקייה</span>
                    <People ids={f.people} guards={guards} />
                  </div>
                </div>
                <div className="p-1.5">
                  {f.items.map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "עריכת משימה" : "משימה חדשה"}
        footer={
          <>
            <Btn
              onClick={save}
              loading={busy}
              disabled={!form.title.trim() || blocked}
              className="flex-1"
            >
              {blocked ? "יש התנגשות" : "שמור"}
            </Btn>
            <Btn variant="secondary" onClick={() => setShowForm(false)}>
              ביטול
            </Btn>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="כותרת">
            <Input
              value={form.title}
              onChange={field("title")}
              placeholder="בדיקת ציוד אבטחה"
              autoFocus
            />
          </Field>

          <Field label="תיאור" hint="אופציונלי">
            <Input value={form.description} onChange={field("description")} />
          </Field>

          <Field
            label="תיקייה"
            hint="אפשר להקליד שם חדש — הוא ייפתח כתיקייה"
            htmlFor="task-folder"
          >
            <Input
              id="task-folder"
              list="task-folders"
              value={form.category}
              onChange={field("category")}
              placeholder={UNFILED}
            />
            {/* datalist ולא select: השמות המוכרים מוצעים, ושם חדש עדיין מותר. */}
            <datalist id="task-folders">
              {[...new Set([...FOLDERS.map((f) => f.name), ...folders.map((f) => f.name)])].map(
                (n) => (
                  <option key={n} value={n} />
                )
              )}
            </datalist>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="מתאריך">
              <Input type="date" value={form.startDate || ""} onChange={field("startDate")} />
            </Field>
            <Field label="עד תאריך">
              <Input type="date" value={form.dueDate || ""} onChange={field("dueDate")} />
            </Field>
          </div>

          <Field label="עדיפות">
            <Select value={form.priority} onChange={field("priority")}>
              <option value="high">גבוהה</option>
              <option value="medium">בינונית</option>
              <option value="low">נמוכה</option>
            </Select>
          </Field>

          <Field
            label="מי מבצע"
            hint={form.assignees.length ? `${form.assignees.length} נבחרו` : "אפשר לבחור כמה"}
          >
            <div className="flex flex-wrap gap-2">
              {guards.map((g) => {
                const on = form.assignees.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleAssignee(g.id)}
                    aria-pressed={on}
                    className={`flex items-center gap-2 h-11 pr-1.5 pl-3 rounded-xl cursor-pointer
                      ring-1 ring-inset transition-colors duration-200 ${
                        on
                          ? "bg-brand/12 ring-brand/45 text-content"
                          : "bg-surface-sunken ring-hairline text-muted hover:text-content"
                      }`}
                  >
                    <Avatar id={g.id} name={g.name} size={26} />
                    <span className="text-sm font-medium">{g.name}</span>
                    {/* וי ולא רק צבע — אותו כלל שחל על כל שאר המוצר. */}
                    {on && <Icon name="check" size={14} className="text-brand" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* ---- התנגשות ----
            * מופיע מתחת לבוחר האנשים ולא בראש הטופס, כי זה המקום שבו נוצרה
            * הבעיה — ומנהל שקורא אזהרה רחוק מהסיבה שלה לא יודע מה לשנות. */}
          {conflicts.length > 0 && (
            <div className="rounded-2xl ring-1 ring-inset ring-warn/40 bg-warn/10 p-3.5 space-y-3">
              <div className="flex items-start gap-2">
                <Icon name="alert" size={17} className="text-warn flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-bold text-content text-sm">
                    {conflicts.length === 1
                      ? "שיבוץ אחד מתנגש"
                      : `${conflicts.length} שיבוצים מתנגשים`}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {conflicts.map((c) => (
                      <li key={`${c.personId}-${c.taskId}`} className="text-xs text-muted">
                        {explainConflict(c, nameOf)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={override}
                  onChange={(e) => setOverride(e.target.checked)}
                  className="w-4 h-4 accent-[rgb(var(--warn))] cursor-pointer"
                />
                <span className="text-sm font-semibold text-content">
                  אני יודע — שבץ בכל זאת
                </span>
              </label>

              {override && (
                <Field
                  label="למה"
                  hint="חובה. ההסבר נשמר, ומגיע גם לאנשים המשובצים"
                  error={form.overrideNote.trim() ? undefined : "בלי סיבה אי אפשר לעקוף"}
                >
                  <Textarea
                    rows={2}
                    value={form.overrideNote}
                    onChange={field("overrideNote")}
                    placeholder="המטבח סגור באותן שעות, אז אין חפיפה בפועל"
                    autoFocus
                  />
                </Field>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// TEAM
// ============================================================

/**
 * When availability closes, as an offset from the start of the week rather
 * than a date — so it recurs every week without anyone maintaining it. The
 * preview line matters more than the inputs: "3 days before at 14:00" is
 * abstract until you see which day and hour that actually lands on.
 */
function DeadlineSettings({ team, actions, busy }) {
  const days = team?.deadlineDays ?? 3;
  const hour = team?.deadlineHour ?? 14;
  const nextWeek = weekByOffset(1);
  const preview = availabilityDeadline(nextWeek[0], team);

  return (
    <Card>
      <h2 className="font-bold text-content mb-1 flex items-center gap-2">
        <Icon name="bell" size={18} className="text-brand" />
        עד מתי אפשר להגיש
      </h2>
      <p className="text-sm text-muted mb-4">
        השומרים רואים ספירה לאחור, וההתראה מתחדדת ככל שהמועד מתקרב.
      </p>

      <div className="grid grid-cols-2 gap-3 max-w-sm">
        <Field label="כמה ימים לפני תחילת השבוע">
          <Select
            value={days}
            onChange={(e) => actions.updateTeamSettings({ deadlineDays: Number(e.target.value) })}
            disabled={busy}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7].map((d) => (
              <option key={d} value={d}>
                {d === 0 ? "ביום תחילת השבוע" : d === 1 ? "יום אחד" : `${d} ימים`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="שעה">
          <Select
            value={hour}
            onChange={(e) => actions.updateTeamSettings({ deadlineHour: Number(e.target.value) })}
            disabled={busy}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Alert tone="info" className="mt-4">
        לשבוע הבא ({rangeLabelHe(nextWeek)}) ההגשה נסגרת ב
        <b>
          {dayName(toISODate(preview))}, {preview.toLocaleDateString("he-IL")} בשעה{" "}
          {String(hour).padStart(2, "0")}:00
        </b>
        . אפשר לפטור שומר מסוים דרך אייקון הפעמון ברשימה למטה.
      </Alert>
    </Card>
  );
}

/**
 * בחירת תחום הפעילות.
 *
 * זו לא הגדרה טכנית אלא שאלה אחת בשפה של המשתמש — "איפה אתה עובד?" —
 * שמשנה את אוצר המילים של כל המוצר. המבנה נשאר זהה בכל הפרופילים; מפקד
 * ואחמ"ש עושים בדיוק את אותם ארבעה שלבים, רק קוראים להם אחרת.
 *
 * הבחירה נשמרת מקומית ולא בשרת: היא מאפיין של מי שמסתכל, לא של הצוות, ואין
 * סיבה שהחלפה אצל אחד תשנה את המסך של אחר. חוץ מזה היא לא דורשת מיגרציה.
 */
function ProfilePicker({ team, actions, busy }) {
  // מקור האמת הוא הצוות. `termProfile` נשאר כגיבוי לרגע שבין טעינת המסך
  // לטעינת הצוות, כדי שהכרטיס לא יהבהב על ברירת מחדל שגויה.
  const fallback = useSyncExternalStore(subscribeTerms, termProfile, termProfile);
  const active = team?.mode || fallback;
  return (
    <Card>
      <h2 className="font-bold text-content mb-1 flex items-center gap-2">
        <Icon name="shield" size={18} className="text-brand" />
        תחום הפעילות
      </h2>
      <p className="text-sm text-muted mb-4">
        משנה את המילים בממשק כך שיתאימו למקום שבו אתה עובד, ואת תבניות המשימות
        שמוצעות לך. השלבים והחישובים זהים בכל הפרופילים.
        <span className="block mt-1 text-xs text-faint">
          הבחירה חלה על כל הצוות — לא רק על המכשיר הזה.
        </span>
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {PROFILES.map((p) => {
          const on = p.id === active;
          return (
            <button
              key={p.id}
              onClick={() => actions.updateTeamSettings({ mode: p.id })}
              disabled={busy}
              aria-pressed={on}
              className={`text-right rounded-2xl p-4 ring-1 ring-inset cursor-pointer
                transition-[background,box-shadow] duration-200 flex items-start gap-3 ${
                  on
                    ? "bg-brand/15 ring-brand/40"
                    : "bg-surface-sunken ring-hairline hover:bg-surface-hover"
                }`}
            >
              <span
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  on ? "bg-brand text-on-brand" : "bg-surface ring-1 ring-inset ring-hairline text-muted"
                }`}
              >
                <Icon name={on ? "check" : p.icon} size={19} />
              </span>
              <span className="min-w-0">
                <span className="block font-bold text-content">{p.label}</span>
                <span className="block text-xs text-muted mt-0.5">{p.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

export function TeamView({ user, team, guards, actions, busy, onSeedDemo }) {
  const [copied, setCopied] = useState(null); // 'code' | 'message' | null
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const code = user.teamCode;
  const shareMsg = `שלום! מזמין אותך להצטרף למערכת NexRota של הצוות.
קוד הצוות שלנו: ${code}
נכנסים לאפליקציה, בוחרים "מאבטח" ומזינים את הקוד ואת השם המלא.`;

  const copy = (what, text) => async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard blocked — the code is visible on screen anyway */
    }
  };

  const add = async () => {
    if (!name.trim()) return;
    await actions.addGuard(name, phone);
    setName("");
    setPhone("");
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.team")} subtitle={team?.name || "נהל שומרים ושתף את קוד הצוות"} />

      <ProfilePicker team={team} actions={actions} busy={busy} />

      <DeadlineSettings team={team} actions={actions} busy={busy} />

      <Card>
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <h2 className="font-bold text-content mb-1 flex items-center gap-2">
              <Icon name="key" size={18} className="text-brand" />
              קוד הצוות
            </h2>
            <p className="text-sm text-muted max-w-xs">
              זה כל מה שמאבטח צריך כדי להיכנס — בלי סיסמה ובלי הרשמה
            </p>
          </div>
          <div className="text-center">
            <div className="bg-brand/10 ring-1 ring-inset ring-brand/30 rounded-2xl px-7 py-4 mb-3">
              <p className="text-4xl font-mono font-black text-content tracking-[0.25em]">{code}</p>
            </div>
            <div className="flex gap-2 justify-center">
              <Btn
                onClick={copy("code", code)}
                variant={copied === "code" ? "accent" : "primary"}
                size="sm"
                icon={copied === "code" ? "check" : "copy"}
              >
                {copied === "code" ? "הועתק" : "העתק קוד"}
              </Btn>
              <Btn
                onClick={copy("message", shareMsg)}
                variant="outline"
                size="sm"
                icon={copied === "message" ? "check" : "send"}
              >
                {copied === "message" ? "הועתק" : "העתק הודעה"}
              </Btn>
            </div>
          </div>
        </div>
        <div className="mt-4 p-3 bg-surface-sunken rounded-xl ring-1 ring-inset ring-hairline">
          <p className="text-[11px] text-faint mb-1">הודעה מוכנה לשליחה בוואטסאפ:</p>
          <p className="text-sm text-muted whitespace-pre-line">{shareMsg}</p>
        </div>
      </Card>

      <Card>
        <h2 className="font-bold text-content mb-3 flex items-center gap-2">
          <Icon name="plus" size={17} className="text-muted" />
          הוסף שומר ידנית
        </h2>
        <p className="text-xs text-muted mb-3">
          שומר שהוספת כאן יוכל להיכנס עם קוד הצוות ואותו שם בדיוק, והפרופיל יתחבר אליו אוטומטית.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="flex gap-2 flex-wrap"
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="שם מלא"
            aria-label="שם מלא של השומר"
            className="flex-1 min-w-[150px]"
          />
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="טלפון (אופציונלי)"
            aria-label="טלפון"
            type="tel"
            className="w-40"
          />
          <Btn type="submit" disabled={!name.trim()} loading={busy}>
            הוסף
          </Btn>
        </form>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="font-bold text-content flex items-center gap-2">
            <Icon name="users" size={17} className="text-muted" />
            שומרים ({guards.length})
          </h2>
          {guards.length === 0 && onSeedDemo && (
            <Btn variant="outline" size="sm" icon="sparkles" onClick={onSeedDemo} loading={busy}>
              מלא נתוני הדגמה
            </Btn>
          )}
        </div>
        {guards.length === 0 ? (
          <p className="text-muted text-sm text-center py-8">
            אין שומרים עדיין — שתף את קוד הצוות או הוסף ידנית
          </p>
        ) : (
          <ul className="space-y-2">
            {guards.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between p-3 bg-surface-sunken rounded-xl ring-1 ring-inset ring-hairline"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar id={g.id} name={g.name} size={36} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-content truncate flex items-center gap-2">
                      {g.name}
                      {/* Text, not just a green dot: colour alone carries no
                          meaning for a colour-blind or screen-reader user. */}
                      {g.userId && (
                        <Badge tone="accent">
                          <Dot color="rgb(var(--accent))" size={6} />
                          מחובר
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-faint">{g.phone || "—"}</p>
                    {g.deadlineExempt && (
                      <Badge tone="info" icon="bell">
                        פטור ממועד ההגשה
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Per-guard exception. A deadline with no way to grant one
                      is a deadline that generates phone calls — reservists,
                      illness, a guard who joined mid-week. */}
                  <IconBtn
                    icon="bell"
                    size="sm"
                    label={
                      g.deadlineExempt
                        ? `החזר את ${g.name} למועד ההגשה הרגיל`
                        : `פטור את ${g.name} ממועד ההגשה`
                    }
                    className={g.deadlineExempt ? "text-info" : ""}
                    onClick={() => actions.setGuardExempt(g.id, !g.deadlineExempt)}
                  />
                  <IconBtn
                    icon="trash"
                    label={`הסר את ${g.name} מהצוות`}
                    size="sm"
                    className="hover:text-danger"
                    onClick={() => actions.removeGuard(g.id)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
