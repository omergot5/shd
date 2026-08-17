import { useEffect, useMemo, useState } from "react";
import {
  Card, Btn, Badge, Avatar, Meter, StatCard, PageHeader, EmptyState, Alert, Modal,
  Input, Select, Field, guardColor,
} from "../ui.jsx";
import {
  formatDateHe, shortDate, dayName, todayISO, rangeLabelHe, DAYS_HE, shiftHours,
} from "../../lib/dates.js";
import { availStatus } from "../../lib/autoAssign.js";

const SHIFT_TEMPLATES = [
  { key: "day12",   label: "יום 07:00–19:00",     startTime: "07:00", endTime: "19:00", type: "morning",   color: "#3B82F6" },
  { key: "night12", label: "לילה 19:00–07:00",    startTime: "19:00", endTime: "07:00", type: "night",     color: "#6366F1" },
  { key: "morning", label: "בוקר 07:00–15:00",    startTime: "07:00", endTime: "15:00", type: "morning",   color: "#F59E0B" },
  { key: "noon",    label: "צהריים 15:00–23:00",  startTime: "15:00", endTime: "23:00", type: "afternoon", color: "#3B82F6" },
  { key: "night8",  label: "לילה 23:00–07:00",    startTime: "23:00", endTime: "07:00", type: "night",     color: "#6366F1" },
];

// ============================================================
// DASHBOARD
// ============================================================

export function SupDashboard({ guards, shifts, swapRequests, tasks, team, onNavigate, onSeedDemo, busy }) {
  const today = todayISO();
  const todayShifts = shifts.filter((s) => s.date === today);
  const pendingSwaps = swapRequests.filter((r) => r.status === "pending").length;
  const openTasks = tasks.filter((t) => t.status !== "done").length;
  const published = shifts.filter((s) => s.published).length;
  const upcoming = shifts.filter((s) => s.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);

  // A brand-new team sees a checklist instead of a wall of zeroes.
  const steps = [
    { done: guards.length > 0, label: "הוסף שומרים לצוות", hint: 'שתף את קוד הצוות או הוסף ידנית', to: "team" },
    { done: shifts.length > 0, label: "הגדר את משמרות השבוע", hint: 'יש כפתור "מלא שבוע" שעושה זאת בלחיצה', to: "shifts" },
    { done: shifts.some((s) => s.assignedGuards.length > 0), label: "שבץ שומרים למשמרות", hint: "הרץ את השיבוץ החכם", to: "smart" },
    { done: published > 0, label: "פרסם את הסידור", hint: "רק אחרי פרסום השומרים רואים אותו", to: "schedule" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const isNew = doneCount < steps.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`שלום${team?.name ? `, ${team.name}` : ""}`}
        subtitle={
          isNew ? "בוא נסיים את ההקמה — 4 צעדים קצרים" : "סיכום מצב הצוות"
        }
      />

      {isNew && (
        <Card className="border-blue-200 bg-blue-50/50">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div>
              <h2 className="font-bold text-gray-900">🚀 הקמת הצוות</h2>
              <p className="text-xs text-gray-500 mt-0.5">{doneCount} מתוך {steps.length} הושלמו</p>
            </div>
            <Btn variant="outline" size="sm" onClick={onSeedDemo} loading={busy}>
              ✨ מלא לי נתוני הדגמה
            </Btn>
          </div>
          <Meter value={doneCount} max={steps.length} color="#3B82F6" height={8} />
          <div className="mt-4 space-y-2">
            {steps.map((s, i) => (
              <button
                key={i} onClick={() => onNavigate(s.to)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-right transition-colors ${
                  s.done
                    ? "bg-green-50 border-green-200"
                    : "bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50/50"
                }`}
              >
                <span className="text-lg flex-shrink-0">{s.done ? "✅" : `${i + 1}️⃣`}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${s.done ? "text-green-800 line-through" : "text-gray-800"}`}>
                    {s.label}
                  </p>
                  {!s.done && <p className="text-xs text-gray-500">{s.hint}</p>}
                </div>
                {!s.done && <span className="text-gray-400 text-lg">‹</span>}
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="שומרים בצוות" value={guards.length} icon="👮" color="blue" onClick={() => onNavigate("team")} />
        <StatCard
          title="משמרות היום" value={todayShifts.length}
          subtitle={`${todayShifts.filter((s) => s.assignedGuards.length >= s.requiredGuards).length} מאוישות`}
          icon="📅" color="green" onClick={() => onNavigate("shifts")}
        />
        <StatCard
          title="בקשות החלפה" value={pendingSwaps} subtitle="ממתינות" icon="🔄"
          color={pendingSwaps ? "yellow" : "blue"} onClick={() => onNavigate("swaps")}
        />
        <StatCard title="משימות פתוחות" value={openTasks} icon="✏️" color="purple" onClick={() => onNavigate("tasks")} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <h2 className="font-bold text-gray-800 mb-4">📅 המשמרות הקרובות</h2>
          {upcoming.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">אין משמרות מתוכננות</p>
          ) : (
            <div className="space-y-2.5">
              {upcoming.map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/60">
                  <div
                    className="w-1.5 h-10 rounded-full flex-shrink-0"
                    style={{ background: s.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {s.label} <span className="text-gray-400 font-normal">· {shortDate(s.date)}</span>
                    </p>
                    <p className="text-[11px] text-gray-500">{s.startTime}–{s.endTime}</p>
                  </div>
                  <div className="flex -space-x-2 space-x-reverse flex-shrink-0">
                    {s.assignedGuards.slice(0, 3).map((gid) => {
                      const g = guards.find((x) => x.id === gid);
                      return <Avatar key={gid} id={gid} name={g?.name} size={26} ring />;
                    })}
                    {s.assignedGuards.length === 0 && (
                      <Badge color="gray">לא משובץ</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-bold text-gray-800 mb-4">👥 עומס השומרים</h2>
          {guards.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">אין שומרים עדיין</p>
          ) : (
            <div className="space-y-3">
              {guards.map((g) => {
                const count = shifts.filter((s) => s.assignedGuards.includes(g.id)).length;
                const max = Math.max(1, ...guards.map((x) => shifts.filter((s) => s.assignedGuards.includes(x.id)).length));
                return (
                  <div key={g.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar id={g.id} name={g.name} size={26} />
                        <span className="text-sm font-medium text-gray-800 truncate">{g.name}</span>
                      </div>
                      <span className="text-xs text-gray-500 flex-shrink-0">{count} משמרות</span>
                    </div>
                    <Meter value={count} max={max} color={guardColor(g.id)} />
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
    date: weekDates[0], startTime: "07:00", endTime: "19:00",
    label: "משמרת יום", location: "כניסה ראשית", requiredGuards: 1, type: "morning", color: "#3B82F6",
  };
  const [form, setForm] = useState(blank);

  useEffect(() => { setForm((f) => ({ ...f, date: weekDates.includes(f.date) ? f.date : weekDates[0] })); }, [weekDates]);

  const weekShifts = shifts.filter((s) => weekDates.includes(s.date));

  const openNew = () => { setForm(blank); setEditing(null); setShowForm(true); };
  const openEdit = (s) => { setForm({ ...s }); setEditing(s.id); setShowForm(true); };

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
          date, label: tpl.label.split(" ")[0] === "יום" ? "משמרת יום" : "משמרת לילה",
          startTime: tpl.startTime, endTime: tpl.endTime, type: tpl.type, color: tpl.color,
          location: "כניסה ראשית", requiredGuards: 1,
        });
      }
    }
    if (rows.length) await actions.addShifts(rows);
  };

  const applyTemplate = (tpl) =>
    setForm((f) => ({
      ...f, startTime: tpl.startTime, endTime: tpl.endTime, type: tpl.type, color: tpl.color,
      label: tpl.type === "night" ? "משמרת לילה" : tpl.type === "afternoon" ? "משמרת צהריים" : "משמרת יום",
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="ניהול משמרות"
        subtitle={`${rangeLabelHe(weekDates)} · ${weekShifts.length} משמרות`}
        actions={
          <>
            <Btn variant="outline" onClick={fillWeek} loading={busy}>⚡ מלא שבוע</Btn>
            <Btn onClick={openNew}>+ משמרת</Btn>
          </>
        }
      />

      {weekShifts.length === 0 ? (
        <EmptyState
          icon="📅" title="אין משמרות בשבוע הזה"
          body='לחץ "מלא שבוע" כדי ליצור משמרת יום ולילה לכל יום, או הוסף משמרת בודדת בהתאמה אישית.'
          action={<Btn size="lg" onClick={fillWeek} loading={busy}>⚡ מלא שבוע</Btn>}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {weekDates.map((date) => {
            const day = weekShifts.filter((s) => s.date === date);
            const isToday = date === todayISO();
            return (
              <div key={date}>
                <div className={`text-center mb-2 pb-2 border-b-2 ${isToday ? "border-blue-500" : "border-gray-200"}`}>
                  <p className={`text-[11px] ${isToday ? "text-blue-600 font-bold" : "text-gray-400"}`}>
                    {dayName(date)}
                  </p>
                  <p className={`text-sm font-bold ${isToday ? "text-blue-600" : "text-gray-800"}`}>
                    {new Date(`${date}T12:00:00`).getDate()}
                  </p>
                </div>
                <div className="space-y-1.5">
                  {day.map((s) => (
                    <div
                      key={s.id} onClick={() => openEdit(s)}
                      className="rounded-xl p-2.5 text-xs relative group cursor-pointer hover:brightness-95 transition-all shadow-sm"
                      style={{ background: s.color, color: "#fff" }}
                      title="לחץ לעריכה"
                    >
                      <div className="font-bold text-[12px] pl-4">{s.label}</div>
                      <div className="opacity-90 mt-0.5 text-[10px]">{s.startTime}–{s.endTime}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {s.assignedGuards.map((gid) => {
                          const g = guards.find((x) => x.id === gid);
                          if (!g) return null;
                          return (
                            <span
                              key={gid}
                              className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white shadow-sm"
                              style={{ backgroundColor: guardColor(gid) }}
                            >
                              {g.name.split(" ")[0]}
                            </span>
                          );
                        })}
                        {s.assignedGuards.length === 0 && (
                          <span className="bg-black/25 px-1.5 py-0.5 rounded text-[9px]">לא משובץ</span>
                        )}
                      </div>
                      <div className="mt-1 text-[9px] opacity-80 font-semibold">
                        {s.assignedGuards.length}/{s.requiredGuards}
                        {s.published && " · פורסם"}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); actions.deleteShift(s.id); }}
                        className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 focus:opacity-100 text-red-600 bg-white/90 hover:bg-white rounded-full w-5 h-5 flex items-center justify-center shadow-sm text-xs"
                        aria-label="מחק משמרת"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {day.length === 0 && (
                    <button
                      onClick={() => { setForm({ ...blank, date }); setEditing(null); setShowForm(true); }}
                      className="w-full border-2 border-dashed border-gray-200 rounded-xl py-4 text-gray-300 hover:border-blue-300 hover:text-blue-400 transition-colors text-lg"
                    >
                      +
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "עריכת משמרת" : "משמרת חדשה"}>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">תבניות מהירות</p>
            <div className="flex flex-wrap gap-2">
              {SHIFT_TEMPLATES.map((t) => (
                <button
                  key={t.key} onClick={() => applyTemplate(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    form.startTime === t.startTime && form.endTime === t.endTime
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white border-gray-300 text-gray-600 hover:border-blue-400"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="תאריך">
              <Select value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}>
                {weekDates.map((d) => <option key={d} value={d}>{formatDateHe(d)}</option>)}
              </Select>
            </Field>
            <Field label="תווית">
              <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
            </Field>
            <Field label="שעת התחלה">
              <Input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
            </Field>
            <Field label="שעת סיום">
              <Input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
            </Field>
            <Field label="מיקום">
              <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
            </Field>
            <Field label="שומרים נדרשים">
              <Input
                type="number" min="1" max="10" value={form.requiredGuards}
                onChange={(e) => setForm((f) => ({ ...f, requiredGuards: Number(e.target.value) }))}
              />
            </Field>
          </div>
          <p className="text-xs text-gray-400">
            אורך המשמרת: {shiftHours({ date: form.date, startTime: form.startTime, endTime: form.endTime })} שעות
          </p>
          <div className="flex gap-2 pt-2">
            <Btn onClick={save} loading={busy} className="flex-1">{editing ? "שמור" : "צור משמרת"}</Btn>
            {editing && (
              <Btn variant="danger" onClick={async () => { await actions.deleteShift(editing); setShowForm(false); }}>
                מחק
              </Btn>
            )}
            <Btn variant="secondary" onClick={() => setShowForm(false)}>ביטול</Btn>
          </div>
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
  const icon = { available: "✅", unavailable: "❌", maybe: "🤔" };

  const submitted = guards.filter((g) =>
    weekShifts.some((s) => availStatus(availability, g.id, s.id) !== "unknown")
  );

  if (!weekShifts.length) {
    return (
      <div className="space-y-6">
        <PageHeader title="זמינות שומרים" subtitle={rangeLabelHe(weekDates)} />
        <EmptyState icon="📅" title="אין משמרות בשבוע הזה" body="צור משמרות כדי שהשומרים יוכלו להגיש זמינות." />
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
          <strong>{guards.filter((g) => !submitted.includes(g)).map((g) => g.name).join(", ")}</strong>
        </Alert>
      )}

      {weekDates.map((date) => {
        const dayShifts = weekShifts.filter((s) => s.date === date);
        if (!dayShifts.length) return null;
        return (
          <Card key={date} className="overflow-x-auto">
            <h3 className="font-bold text-gray-800 mb-3">{formatDateHe(date)}</h3>
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-right py-2 px-3 font-medium text-gray-500">שומר</th>
                  {dayShifts.map((s) => (
                    <th key={s.id} className="text-center py-2 px-3 font-medium text-gray-500">
                      <div className="text-xs">{s.label}</div>
                      <div className="text-[10px] font-normal text-gray-400">{s.startTime}–{s.endTime}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {guards.map((g) => (
                  <tr key={g.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <Avatar id={g.id} name={g.name} size={24} />
                        <span className="font-medium text-gray-800 text-xs">{g.name}</span>
                      </div>
                    </td>
                    {dayShifts.map((s) => {
                      const raw = availability[`${g.id}-${s.id}`];
                      const status = availStatus(availability, g.id, s.id);
                      const comment = typeof raw === "object" ? raw?.comment : "";
                      return (
                        <td key={s.id} className="py-2.5 px-3 text-center">
                          <div className="text-lg">
                            {icon[status] || <span className="text-gray-300 text-sm">—</span>}
                          </div>
                          {comment && (
                            <div className="text-[10px] text-gray-500 mt-0.5 truncate max-w-[90px] mx-auto" title={comment}>
                              💬 {comment}
                            </div>
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

      <div className="flex gap-4 text-xs text-gray-500">
        <span>✅ זמין</span><span>❌ לא זמין</span><span>🤔 אולי</span><span>— לא הגיש</span>
      </div>
    </div>
  );
}

// ============================================================
// MANUAL ASSIGNMENT
// ============================================================

export function AssignView({ guards, shifts, availability, weekDates, actions, busy, onNavigate }) {
  const [date, setDate] = useState(weekDates[0]);
  useEffect(() => { if (!weekDates.includes(date)) setDate(weekDates[0]); }, [weekDates, date]);

  const dayShifts = shifts.filter((s) => s.date === date);

  return (
    <div className="space-y-6">
      <PageHeader
        title="שיבוץ ידני"
        subtitle="לחץ על שומר כדי לשבץ או להסיר"
        actions={<Btn variant="outline" onClick={() => onNavigate("smart")}>⚡ עבור לשיבוץ חכם</Btn>}
      />

      <div className="flex gap-1.5 flex-wrap">
        {weekDates.map((d) => (
          <button
            key={d} onClick={() => setDate(d)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              date === d ? "bg-blue-600 text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {shortDate(d)}
          </button>
        ))}
      </div>

      {dayShifts.length === 0 ? (
        <EmptyState icon="📅" title="אין משמרות בתאריך הזה" />
      ) : (
        dayShifts.map((shift) => (
          <Card key={shift.id} className="p-0 overflow-hidden">
            <div className="p-4 text-white flex items-center justify-between gap-3 flex-wrap" style={{ background: shift.color }}>
              <div>
                <h3 className="font-bold text-lg">
                  {shift.label} <span className="opacity-80 text-sm font-medium">{shift.startTime}–{shift.endTime}</span>
                </h3>
                <p className="text-sm opacity-90 mt-0.5">📍 {shift.location} · נדרשים {shift.requiredGuards}</p>
              </div>
              <div className="bg-white/20 px-3 py-1.5 rounded-xl font-bold text-sm">
                {shift.assignedGuards.length}/{shift.requiredGuards}
              </div>
            </div>
            <div className="p-4">
              {guards.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">אין שומרים בצוות</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                  {guards.map((g) => {
                    const status = availStatus(availability, g.id, shift.id);
                    const assigned = shift.assignedGuards.includes(g.id);
                    const raw = availability[`${g.id}-${shift.id}`];
                    const comment = typeof raw === "object" ? raw?.comment : "";
                    return (
                      <button
                        key={g.id} onClick={() => actions.toggleAssignment(shift.id, g.id)} disabled={busy}
                        className={`p-2.5 rounded-xl border-2 text-center transition-all disabled:opacity-60 ${
                          assigned ? "border-blue-500 bg-blue-50"
                          : status === "available" ? "border-green-200 bg-green-50 hover:border-green-400"
                          : status === "unavailable" ? "border-red-100 bg-red-50/50 opacity-60"
                          : status === "maybe" ? "border-amber-200 bg-amber-50"
                          : "border-gray-200 bg-gray-50 hover:border-gray-300"
                        }`}
                        title={comment ? `הערה: ${comment}` : undefined}
                      >
                        <div className="flex justify-center mb-1">
                          <Avatar id={g.id} name={g.name} size={30} label={assigned ? "✓" : undefined} />
                        </div>
                        <div className="text-[11px] font-semibold text-gray-800 truncate">{g.name.split(" ")[0]}</div>
                        <div className="text-[10px] text-gray-400">
                          {assigned ? "משובץ" : { available: "זמין", unavailable: "לא זמין", maybe: "אולי" }[status] || "לא הגיש"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        ))
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
              <Btn variant="success" onClick={() => actions.publish(allIds, true)} loading={busy}>
                פרסם הכל ✅
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
        <EmptyState icon="📋" title="אין מה לפרסם" body="צור ושבץ משמרות תחילה." />
      ) : (
        <>
          {unassigned > 0 && (
            <Alert tone="warn">
              {unassigned} משמרות עדיין לא מאוישות במלואן. אפשר לפרסם בכל זאת — השומרים יראו אותן כפתוחות.
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
                    <h3 className="font-bold text-gray-900">{formatDateHe(date)}</h3>
                    <p className="text-xs text-gray-400">{dayShifts.length} משמרות</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color={allPub ? "green" : "gray"}>{allPub ? "✅ מפורסם" : "📝 טיוטה"}</Badge>
                    <Btn
                      size="sm" variant={allPub ? "outline" : "primary"}
                      onClick={() => actions.publish(dayShifts.map((s) => s.id), !allPub)}
                    >
                      {allPub ? "בטל" : "פרסם יום"}
                    </Btn>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {dayShifts.map((s) => (
                    <div key={s.id} className="p-3 rounded-xl text-white shadow-sm" style={{ background: s.color }}>
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-sm bg-black/15 px-2 py-0.5 rounded-lg">{s.label}</span>
                        <span className="text-[11px] opacity-90">{s.startTime}–{s.endTime}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {s.assignedGuards.length === 0 ? (
                          <span className="bg-black/30 px-2 py-1 rounded-md text-[11px] font-semibold">לא משובץ</span>
                        ) : (
                          s.assignedGuards.map((gid) => {
                            const g = guards.find((x) => x.id === gid);
                            if (!g) return null;
                            return (
                              <span
                                key={gid}
                                className="px-2 py-1 rounded-md text-[11px] font-bold text-white border border-white/25"
                                style={{ backgroundColor: `${guardColor(gid)}CC` }}
                              >
                                {g.name}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))}
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

export function SwapMgmt({ guards, shifts, swapRequests, actions, busy }) {
  const gName = (id) => guards.find((g) => g.id === id)?.name || "—";
  const getShift = (id) => shifts.find((s) => s.id === id);
  const pending = swapRequests.filter((r) => r.status === "pending");
  const resolved = swapRequests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <PageHeader title="בקשות החלפה" subtitle={`${pending.length} ממתינות לאישור`} />
      {swapRequests.length === 0 ? (
        <EmptyState icon="🔄" title="אין בקשות החלפה" body="כשמאבטח יבקש להחליף משמרת, הבקשה תופיע כאן לאישורך." />
      ) : (
        [...pending, ...resolved].map((r) => {
          const s = getShift(r.shiftId);
          return (
            <Card key={r.id} className={r.status === "pending" ? "border-amber-200" : "opacity-70"}>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl">🔄</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{gName(r.fromGuard)}</span>
                      <span className="text-gray-400">←</span>
                      <span className="font-semibold text-sm">{gName(r.toGuard)}</span>
                      <Badge color={{ pending: "yellow", approved: "green", rejected: "red" }[r.status]}>
                        {{ pending: "ממתין", approved: "אושר", rejected: "נדחה" }[r.status]}
                      </Badge>
                    </div>
                    {s && (
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDateHe(s.date)} · {s.label} {s.startTime}–{s.endTime}
                      </p>
                    )}
                    {r.message && <p className="text-xs text-gray-600 mt-1">💬 {r.message}</p>}
                  </div>
                </div>
                {r.status === "pending" && (
                  <div className="flex gap-2 flex-shrink-0">
                    <Btn variant="success" size="sm" onClick={() => actions.decideSwap(r.id, "approved")} disabled={busy}>
                      אשר
                    </Btn>
                    <Btn variant="danger" size="sm" onClick={() => actions.decideSwap(r.id, "rejected")} disabled={busy}>
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

export function TaskMgmt({ guards, tasks, weekDates, actions, busy }) {
  const [showForm, setShowForm] = useState(false);
  const blank = { title: "", description: "", assignedTo: "", priority: "medium", dueDate: weekDates[0] };
  const [form, setForm] = useState(blank);

  const prioClr = { high: "red", medium: "yellow", low: "blue" };
  const prioLbl = { high: "🔴 גבוהה", medium: "🟡 בינונית", low: "🔵 נמוכה" };

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
        actions={<Btn onClick={() => setShowForm(true)}>+ משימה</Btn>}
      />

      {tasks.length === 0 ? (
        <EmptyState
          icon="✏️" title="אין משימות" body="הגדר משימות לצוות — בדיקת ציוד, תרגילים, דוחות."
          action={<Btn onClick={() => setShowForm(true)}>+ משימה ראשונה</Btn>}
        />
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => {
            const g = guards.find((x) => x.id === t.assignedTo);
            const done = t.status === "done";
            return (
              <Card key={t.id} className={done ? "opacity-60" : ""}>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => actions.toggleTask(t.id, done ? "pending" : "done")}
                    className="text-2xl flex-shrink-0" disabled={busy} aria-label="סמן כבוצע"
                  >
                    {done ? "✅" : "⬜"}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-semibold text-sm ${done ? "line-through text-gray-400" : "text-gray-900"}`}>
                        {t.title}
                      </span>
                      <Badge color={prioClr[t.priority]}>{prioLbl[t.priority]}</Badge>
                    </div>
                    {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
                    <div className="flex gap-3 mt-1 text-[11px] text-gray-400 flex-wrap">
                      {g && <span>👤 {g.name}</span>}
                      {t.dueDate && <span>📅 {formatDateHe(t.dueDate)}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => actions.deleteTask(t.id)}
                    className="text-gray-300 hover:text-red-500 text-lg flex-shrink-0" aria-label="מחק"
                  >
                    🗑️
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="משימה חדשה">
        <div className="space-y-3">
          <Field label="כותרת">
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="בדיקת ציוד אבטחה" />
          </Field>
          <Field label="תיאור">
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="מוקצה ל">
              <Select value={form.assignedTo} onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}>
                <option value="">ללא</option>
                {guards.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
            </Field>
            <Field label="עדיפות">
              <Select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                <option value="high">גבוהה</option>
                <option value="medium">בינונית</option>
                <option value="low">נמוכה</option>
              </Select>
            </Field>
          </div>
          <Field label="תאריך יעד">
            <Select value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}>
              {weekDates.map((d) => <option key={d} value={d}>{formatDateHe(d)}</option>)}
            </Select>
          </Field>
          <div className="flex gap-2 pt-1">
            <Btn onClick={save} loading={busy} className="flex-1">שמור</Btn>
            <Btn variant="secondary" onClick={() => setShowForm(false)}>ביטול</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// TEAM
// ============================================================

export function TeamView({ user, team, guards, actions, busy, onSeedDemo }) {
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const code = user.teamCode;
  const shareMsg = `שלום! מזמין אותך להצטרף למערכת Guardian Shifts של הצוות.
קוד הצוות שלנו: ${code}
נכנסים לאפליקציה, בוחרים "מאבטח" ומזינים את הקוד ואת השם המלא.`;

  const copy = async (text, flag = true) => {
    try {
      await navigator.clipboard.writeText(text);
      if (flag) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch { /* clipboard blocked — the code is visible on screen anyway */ }
  };

  const add = async () => {
    if (!name.trim()) return;
    await actions.addGuard(name, phone);
    setName(""); setPhone("");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="הצוות שלי" subtitle={team?.name || "נהל שומרים ושתף את קוד הצוות"} />

      <Card className="border-blue-200 bg-blue-50/40">
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <h2 className="font-bold text-gray-800 mb-1">🔑 קוד הצוות</h2>
            <p className="text-sm text-gray-500 max-w-xs">
              זה כל מה שמאבטח צריך כדי להיכנס — בלי סיסמה ובלי הרשמה
            </p>
          </div>
          <div className="text-center">
            <div className="bg-white border-2 border-blue-300 rounded-2xl px-7 py-4 mb-3 shadow-sm">
              <p className="text-4xl font-mono font-black text-blue-700 tracking-[0.25em]">{code}</p>
            </div>
            <div className="flex gap-2 justify-center">
              <Btn onClick={() => copy(code)} variant={copied ? "success" : "primary"} size="sm">
                {copied ? "✅ הועתק" : "📋 העתק קוד"}
              </Btn>
              <Btn onClick={() => copy(shareMsg, false)} variant="outline" size="sm">📤 העתק הודעה</Btn>
            </div>
          </div>
        </div>
        <div className="mt-4 p-3 bg-white rounded-xl border border-blue-100">
          <p className="text-[11px] text-gray-400 mb-1">הודעה מוכנה לשליחה בוואטסאפ:</p>
          <p className="text-sm text-gray-700 whitespace-pre-line">{shareMsg}</p>
        </div>
      </Card>

      <Card>
        <h2 className="font-bold text-gray-800 mb-3">➕ הוסף שומר ידנית</h2>
        <p className="text-xs text-gray-500 mb-3">
          שומר שהוספת כאן יוכל להיכנס עם קוד הצוות ואותו שם בדיוק, והפרופיל יתחבר אליו אוטומטית.
        </p>
        <div className="flex gap-2 flex-wrap">
          <Input
            value={name} onChange={(e) => setName(e.target.value)} placeholder="שם מלא"
            onKeyDown={(e) => e.key === "Enter" && add()} className="flex-1 min-w-[150px]"
          />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="טלפון (אופציונלי)" className="w-40" />
          <Btn onClick={add} disabled={!name.trim()} loading={busy}>הוסף</Btn>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="font-bold text-gray-800">👥 שומרים ({guards.length})</h2>
          {guards.length === 0 && onSeedDemo && (
            <Btn variant="outline" size="sm" onClick={onSeedDemo} loading={busy}>✨ מלא נתוני הדגמה</Btn>
          )}
        </div>
        {guards.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">
            אין שומרים עדיין — שתף את קוד הצוות או הוסף ידנית
          </p>
        ) : (
          <div className="space-y-2">
            {guards.map((g) => (
              <div key={g.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar id={g.id} name={g.name} size={36} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {g.name} {g.userId && <span title="מחובר למערכת">🟢</span>}
                    </p>
                    <p className="text-xs text-gray-400">{g.phone || "—"}</p>
                  </div>
                </div>
                <button
                  onClick={() => actions.removeGuard(g.id)}
                  className="text-gray-300 hover:text-red-500 text-lg flex-shrink-0" aria-label="הסר שומר"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-gray-400 mt-3">🟢 = כבר נכנס למערכת מהמכשיר שלו</p>
      </Card>
    </div>
  );
}
