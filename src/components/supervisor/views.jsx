import { useEffect, useState } from "react";
import {
  Alert, Avatar, Badge, Btn, Card, EmptyState, Field, guardColor, IconBtn, Input, Meter, Modal,
  PageHeader, readableInk, Select, StatCard,
} from "../ui.jsx";
import { Dot, Icon } from "../icons.jsx";
import { dayName, formatDateHe, fromISODate, rangeLabelHe, shiftHours, shortDate, todayISO } from "../../lib/dates.js";
import { availStatus } from "../../lib/autoAssign.js";

const SHIFT_TEMPLATES = [
  { key: "day12",   label: "יום 07:00–19:00",    startTime: "07:00", endTime: "19:00", type: "morning",   color: "#3B82F6" },
  { key: "night12", label: "לילה 19:00–07:00",   startTime: "19:00", endTime: "07:00", type: "night",     color: "#6366F1" },
  { key: "morning", label: "בוקר 07:00–15:00",   startTime: "07:00", endTime: "15:00", type: "morning",   color: "#F59E0B" },
  { key: "noon",    label: "צהריים 15:00–23:00", startTime: "15:00", endTime: "23:00", type: "afternoon", color: "#3B82F6" },
  { key: "night8",  label: "לילה 23:00–07:00",   startTime: "23:00", endTime: "07:00", type: "night",     color: "#6366F1" },
];

/**
 * Availability, as icon + word + colour. Three redundant channels, because
 * a colour alone fails WCAG 1.4.1 and an icon alone is ambiguous.
 */
const AVAIL = {
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

export function ShiftMgmt({ shifts, guards, weekDates, actions, busy }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const blank = {
    date: weekDates[0], startTime: "07:00", endTime: "19:00", label: "משמרת יום",
    location: "כניסה ראשית", requiredGuards: 1, type: "morning", color: "#3B82F6",
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

  const fillWeek = async () => {
    const existing = new Set(weekShifts.map((s) => `${s.date}|${s.startTime}`));
    const rows = [];
    for (const date of weekDates) {
      for (const tpl of [SHIFT_TEMPLATES[0], SHIFT_TEMPLATES[1]]) {
        if (existing.has(`${date}|${tpl.startTime}`)) continue;
        rows.push({
          date,
          label: tpl.type === "night" ? "משמרת לילה" : "משמרת יום",
          startTime: tpl.startTime, endTime: tpl.endTime, type: tpl.type, color: tpl.color,
          location: "כניסה ראשית", requiredGuards: 1,
        });
      }
    }
    if (rows.length) await actions.addShifts(rows);
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
        title="ניהול משמרות"
        subtitle={`${rangeLabelHe(weekDates)} · ${weekShifts.length} משמרות`}
        actions={
          <>
            <Btn variant="outline" icon="zap" onClick={fillWeek} loading={busy}>
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
          title="אין משמרות בשבוע הזה"
          body='לחץ "מלא שבוע" כדי ליצור משמרת יום ולילה לכל יום, או הוסף משמרת בודדת בהתאמה אישית.'
          action={
            <Btn size="lg" icon="zap" onClick={fillWeek} loading={busy}>
              מלא שבוע
            </Btn>
          }
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
                  <p className={`text-sm font-bold ${isToday ? "text-brand" : "text-content"}`} data-numeric>
                    {fromISODate(date).getDate()}
                  </p>
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

export function AvailView({ guards, shifts, availability, weekDates }) {
  const weekShifts = shifts.filter((s) => weekDates.includes(s.date));

  const submitted = guards.filter((g) =>
    weekShifts.some((s) => availStatus(availability, g.id, s.id) !== "unknown")
  );

  if (!weekShifts.length) {
    return (
      <div className="space-y-6">
        <PageHeader title="זמינות שומרים" subtitle={rangeLabelHe(weekDates)} />
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
        title="זמינות שומרים"
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

export function AssignView({ guards, shifts, availability, weekDates, actions, busy, onNavigate }) {
  const [date, setDate] = useState(weekDates[0]);
  useEffect(() => {
    if (!weekDates.includes(date)) setDate(weekDates[0]);
  }, [weekDates, date]);

  const dayShifts = shifts.filter((s) => s.date === date);

  return (
    <div className="space-y-6">
      <PageHeader
        title="שיבוץ ידני"
        subtitle="לחץ על שומר כדי לשבץ או להסיר"
        actions={
          <Btn variant="outline" icon="zap" onClick={() => onNavigate("smart")}>
            עבור לשיבוץ חכם
          </Btn>
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
                          <div className="flex justify-center mb-1">
                            <Avatar id={g.id} name={g.name} size={30} />
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

export function ScheduleMgmt({ guards, shifts, weekDates, actions, busy }) {
  const weekShifts = shifts.filter((s) => weekDates.includes(s.date));
  const allIds = weekShifts.map((s) => s.id);
  const publishedCount = weekShifts.filter((s) => s.published).length;
  const unassigned = weekShifts.filter((s) => s.assignedGuards.length < s.requiredGuards).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="פרסום סידור"
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

export function SwapMgmt({ guards, shifts, swapRequests, actions, busy }) {
  const gName = (id) => guards.find((g) => g.id === id)?.name || "—";
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
                  </div>
                </div>
                {r.status === "pending" && (
                  <div className="flex gap-2 flex-shrink-0">
                    <Btn
                      variant="accent"
                      size="sm"
                      icon="check"
                      onClick={() => actions.decideSwap(r.id, "approved")}
                      disabled={busy}
                    >
                      אשר
                    </Btn>
                    <Btn
                      variant="danger"
                      size="sm"
                      icon="x"
                      onClick={() => actions.decideSwap(r.id, "rejected")}
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

export function TaskMgmt({ guards, tasks, weekDates, actions, busy }) {
  const [showForm, setShowForm] = useState(false);
  const blank = { title: "", description: "", assignedTo: "", priority: "medium", dueDate: weekDates[0] };
  const [form, setForm] = useState(blank);
  const field = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async () => {
    if (!form.title.trim()) return;
    await actions.createTask(form);
    setForm(blank);
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="משימות"
        subtitle={`${tasks.filter((t) => t.status !== "done").length} פתוחות`}
        actions={
          <Btn icon="plus" onClick={() => setShowForm(true)}>
            משימה
          </Btn>
        }
      />

      {tasks.length === 0 ? (
        <EmptyState
          icon="pencil"
          title="אין משימות"
          body="הגדר משימות לצוות — בדיקת ציוד, תרגילים, דוחות."
          action={
            <Btn icon="plus" onClick={() => setShowForm(true)}>
              משימה ראשונה
            </Btn>
          }
        />
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => {
            const g = guards.find((x) => x.id === t.assignedTo);
            const done = t.status === "done";
            const prio = PRIORITY[t.priority] || PRIORITY.medium;
            return (
              <Card key={t.id} className={done ? "opacity-60" : ""}>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => actions.toggleTask(t.id, done ? "pending" : "done")}
                    disabled={busy}
                    role="checkbox"
                    aria-checked={done}
                    aria-label={`${t.title} — ${done ? "בוצע" : "לא בוצע"}`}
                    className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 cursor-pointer
                      ring-1 ring-inset transition-colors duration-200 ${
                        done
                          ? "bg-accent text-on-accent ring-accent"
                          : "bg-surface-sunken ring-hairline hover:ring-accent/50"
                      }`}
                  >
                    {done && <Icon name="check" size={14} strokeWidth={3} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`font-semibold text-sm ${done ? "line-through text-muted" : "text-content"}`}
                      >
                        {t.title}
                      </span>
                      <Badge tone={prio.tone}>
                        <Dot color={prio.color} size={6} />
                        {prio.label}
                      </Badge>
                    </div>
                    {t.description && <p className="text-xs text-muted mt-0.5">{t.description}</p>}
                    <div className="flex gap-3 mt-1 text-[11px] text-faint flex-wrap">
                      {g && (
                        <span className="flex items-center gap-1">
                          <Icon name="user" size={11} />
                          {g.name}
                        </span>
                      )}
                      {t.dueDate && (
                        <span className="flex items-center gap-1">
                          <Icon name="calendar" size={11} />
                          {formatDateHe(t.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                  <IconBtn
                    icon="trash"
                    label={`מחק את המשימה ${t.title}`}
                    size="sm"
                    className="hover:text-danger"
                    onClick={() => actions.deleteTask(t.id)}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="משימה חדשה"
        footer={
          <>
            <Btn onClick={save} loading={busy} disabled={!form.title.trim()} className="flex-1">
              שמור
            </Btn>
            <Btn variant="secondary" onClick={() => setShowForm(false)}>
              ביטול
            </Btn>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="כותרת">
            <Input value={form.title} onChange={field("title")} placeholder="בדיקת ציוד אבטחה" />
          </Field>
          <Field label="תיאור">
            <Input value={form.description} onChange={field("description")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="מוקצה ל">
              <Select value={form.assignedTo} onChange={field("assignedTo")}>
                <option value="">ללא</option>
                {guards.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="עדיפות">
              <Select value={form.priority} onChange={field("priority")}>
                <option value="high">גבוהה</option>
                <option value="medium">בינונית</option>
                <option value="low">נמוכה</option>
              </Select>
            </Field>
          </div>
          <Field label="תאריך יעד">
            <Select value={form.dueDate} onChange={field("dueDate")}>
              {weekDates.map((d) => (
                <option key={d} value={d}>
                  {formatDateHe(d)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// TEAM
// ============================================================

export function TeamView({ user, team, guards, actions, busy, onSeedDemo }) {
  const [copied, setCopied] = useState(null); // 'code' | 'message' | null
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const code = user.teamCode;
  const shareMsg = `שלום! מזמין אותך להצטרף למערכת Smart Shift Management של הצוות.
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
      <PageHeader title="הצוות שלי" subtitle={team?.name || "נהל שומרים ושתף את קוד הצוות"} />

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
                  </div>
                </div>
                <IconBtn
                  icon="trash"
                  label={`הסר את ${g.name} מהצוות`}
                  size="sm"
                  className="hover:text-danger"
                  onClick={() => actions.removeGuard(g.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
