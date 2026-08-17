import { useMemo, useState } from "react";
import {
  Card, Btn, Badge, Avatar, PageHeader, EmptyState, Alert, Modal, Input, Select, Field, guardColor,
} from "./ui.jsx";
import {
  formatDateHe, shortDate, dayName, todayISO, addDays, weekByOffset, rangeLabelHe, fromISODate,
} from "../lib/dates.js";
import { availStatus } from "../lib/autoAssign.js";

const NAV = [
  { id: "schedule", label: "הסידור שלי", icon: "📅" },
  { id: "availability", label: "הגשת זמינות", icon: "✅" },
  { id: "swaps", label: "החלפות", icon: "🔄", badge: true },
];

// ============================================================
// MY SCHEDULE
// ============================================================

function MySchedule({ user, guards, shifts }) {
  const today = todayISO();
  const mine = shifts
    .filter((s) => s.published && s.assignedGuards.includes(user.id))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  const upcoming = mine.filter((s) => s.date >= today);
  const past = mine.filter((s) => s.date < today);
  const publishedAll = shifts.filter((s) => s.published);

  const nameOf = (id) => guards.find((g) => g.id === id)?.name || "—";

  return (
    <div className="space-y-6">
      <PageHeader
        title="הסידור שלי"
        subtitle={upcoming.length ? `${upcoming.length} משמרות קרובות` : "אין משמרות קרובות"}
      />

      {upcoming.length === 0 ? (
        <EmptyState
          icon="📭"
          title="אין לך משמרות מתוכננות"
          body={
            publishedAll.length === 0
              ? 'האחמ"ש עדיין לא פרסם את הסידור. ברגע שיפרסם — הוא יופיע כאן.'
              : "לא שובצת למשמרות בסידור שפורסם. אם זו טעות, פנה לאחמ״ש."
          }
        />
      ) : (
        <div className="space-y-3">
          {upcoming.map((s) => {
            const others = s.assignedGuards.filter((id) => id !== user.id);
            const isToday = s.date === todayISO();
            return (
              <div
                key={s.id}
                className="rounded-2xl p-4 text-white shadow-md relative overflow-hidden"
                style={{ background: s.color }}
              >
                {isToday && (
                  <span className="absolute top-3 left-3 bg-white text-gray-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    היום
                  </span>
                )}
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-black/20 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                    ⏰
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-lg leading-tight">{s.label}</h3>
                    <p className="text-sm opacity-95 mt-0.5">{formatDateHe(s.date)}</p>
                    <p className="text-sm font-semibold opacity-90 mt-1">
                      {s.startTime}–{s.endTime} · 📍 {s.location}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2.5 flex-wrap text-xs">
                      <span className="opacity-80">עם:</span>
                      {others.length === 0 ? (
                        <span className="opacity-70">לבד במשמרת</span>
                      ) : (
                        others.map((gid) => (
                          <span
                            key={gid}
                            className="px-2 py-0.5 rounded-md font-bold text-white border border-white/25"
                            style={{ backgroundColor: `${guardColor(gid)}CC` }}
                          >
                            {nameOf(gid)}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {publishedAll.length > 0 && (
        <Card>
          <h2 className="font-bold text-gray-800 mb-3">📋 הסידור המלא של הצוות</h2>
          <div className="space-y-4">
            {[...new Set(publishedAll.map((s) => s.date))].sort().map((date) => {
              const day = publishedAll.filter((s) => s.date === date);
              return (
                <div key={date}>
                  <p className="text-[11px] font-bold text-gray-400 mb-2 border-b border-gray-100 pb-1">
                    {formatDateHe(date)}
                  </p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {day.map((s) => {
                      const isMine = s.assignedGuards.includes(user.id);
                      return (
                        <div
                          key={s.id}
                          className={`p-3 rounded-xl text-white shadow-sm ${isMine ? "ring-2 ring-offset-1 ring-blue-500" : "opacity-85"}`}
                          style={{ background: s.color }}
                        >
                          <div className="flex items-center justify-between mb-1.5 gap-2">
                            <span className="font-bold text-xs bg-black/15 px-2 py-0.5 rounded-lg">{s.label}</span>
                            {isMine && (
                              <span className="text-[9px] bg-white text-blue-900 px-1.5 py-0.5 rounded-full font-bold">
                                שלי
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] opacity-90 mb-2">{s.startTime}–{s.endTime}</div>
                          <div className="flex flex-wrap gap-1">
                            {s.assignedGuards.length === 0 ? (
                              <span className="text-[10px] bg-black/25 px-1.5 py-0.5 rounded">לא משובץ</span>
                            ) : (
                              s.assignedGuards.map((gid) => (
                                <span
                                  key={gid}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                    gid === user.id
                                      ? "bg-white text-gray-900 border-white"
                                      : "text-white border-white/20"
                                  }`}
                                  style={gid === user.id ? {} : { backgroundColor: guardColor(gid) }}
                                >
                                  {nameOf(gid)}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// AVAILABILITY SUBMISSION
// ============================================================

function MyAvailability({ user, shifts, availability, actions, busy }) {
  const [offset, setOffset] = useState(1);
  const weekDates = useMemo(() => weekByOffset(offset), [offset]);
  const weekShifts = shifts.filter((s) => weekDates.includes(s.date));

  // The week is only locked once it has actually started — a guard should never
  // be stuck unable to answer for a week that is still in the future.
  const weekStarted = weekDates[0] < todayISO();
  // Recommended cut-off: Thursday 14:00 of the week before.
  const deadline = useMemo(() => {
    const d = fromISODate(addDays(weekDates[0], -3));
    d.setHours(14, 0, 0, 0);
    return d;
  }, [weekDates]);
  const pastDeadline = new Date() > deadline && !weekStarted;

  const answered = weekShifts.filter((s) => availStatus(availability, user.id, s.id) !== "unknown").length;
  const progress = weekShifts.length ? Math.round((answered / weekShifts.length) * 100) : 0;

  const setStatus = (shift, status) => {
    const raw = availability[`${user.id}-${shift.id}`];
    actions.setAvailability(shift.id, user.id, status, typeof raw === "object" ? raw?.comment : "");
  };
  const setComment = (shift, comment) => {
    const status = availStatus(availability, user.id, shift.id);
    actions.setAvailability(shift.id, user.id, status === "unknown" ? "available" : status, comment);
  };

  const markAll = (status) => {
    for (const s of weekShifts) {
      if (availStatus(availability, user.id, s.id) === "unknown") setStatus(s, status);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="הגשת זמינות"
        subtitle="סמן באילו משמרות אתה יכול לעבוד — זה מה שהשיבוץ מסתמך עליו"
      />

      <div className="flex bg-gray-100 p-1 rounded-xl w-fit border border-gray-200">
        {[0, 1, 2].map((o) => (
          <button
            key={o} onClick={() => setOffset(o)}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              offset === o ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {o === 0 ? "השבוע" : o === 1 ? "שבוע הבא" : "עוד שבועיים"}
          </button>
        ))}
      </div>

      {weekShifts.length === 0 ? (
        <EmptyState
          icon="📅" title="אין משמרות בשבוע הזה"
          body={`האחמ"ש עדיין לא הגדיר משמרות ל${rangeLabelHe(weekDates)}. נסה שבוע אחר או חזור מאוחר יותר.`}
        />
      ) : (
        <>
          {weekStarted ? (
            <Alert tone="warn">
              🔒 השבוע הזה כבר התחיל — לא ניתן לשנות זמינות. פנה לאחמ״ש אם משהו השתנה.
            </Alert>
          ) : pastDeadline ? (
            <Alert tone="warn">
              ⏰ המועד המומלץ להגשה ({deadline.toLocaleDateString("he-IL")} בשעה 14:00) חלף.
              עדיין אפשר להגיש, אבל ייתכן שהאחמ״ש כבר בנה את הסידור.
            </Alert>
          ) : (
            <Alert tone="info">
              ⏳ מומלץ להגיש עד {deadline.toLocaleDateString("he-IL")} בשעה 14:00
            </Alert>
          )}

          <Card>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800">
                  ענית על {answered} מתוך {weekShifts.length} משמרות
                </p>
                <div className="w-40 h-2 bg-gray-100 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-2 bg-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              {!weekStarted && answered < weekShifts.length && (
                <div className="flex gap-2">
                  <Btn size="sm" variant="outline" onClick={() => markAll("available")} disabled={busy}>
                    ✅ סמן הכל כזמין
                  </Btn>
                  <Btn size="sm" variant="outline" onClick={() => markAll("unavailable")} disabled={busy}>
                    ❌ סמן הכל כלא זמין
                  </Btn>
                </div>
              )}
            </div>
          </Card>

          <div className="space-y-6">
            {weekDates.map((date) => {
              const day = weekShifts.filter((s) => s.date === date);
              if (!day.length) return null;
              return (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <h2 className="text-sm font-bold text-gray-800 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
                      {dayName(date)}
                    </h2>
                    <span className="text-xs text-gray-400">{formatDateHe(date)}</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    {day.map((s) => {
                      const raw = availability[`${user.id}-${s.id}`];
                      const status = availStatus(availability, user.id, s.id);
                      const comment = typeof raw === "object" ? raw?.comment || "" : "";
                      return (
                        <Card
                          key={s.id} className="p-4"
                          style={{ borderRightColor: s.color, borderRightWidth: 6 }}
                        >
                          <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                            <div className="min-w-0">
                              <h3 className="font-bold text-base" style={{ color: s.color }}>{s.label}</h3>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {s.startTime}–{s.endTime} · 📍 {s.location}
                              </p>
                            </div>
                            {status !== "unknown" && (
                              <Badge color={{ available: "green", unavailable: "red", maybe: "yellow" }[status]}>
                                {{ available: "✅ זמין", unavailable: "❌ לא זמין", maybe: "🤔 אולי" }[status]}
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { val: "available", label: "✅ זמין", on: "bg-green-600 text-white", off: "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100" },
                              { val: "maybe", label: "🤔 אולי", on: "bg-amber-500 text-white", off: "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100" },
                              { val: "unavailable", label: "❌ לא", on: "bg-red-600 text-white", off: "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100" },
                            ].map(({ val, label, on, off }) => (
                              <button
                                key={val} disabled={weekStarted || busy}
                                onClick={() => setStatus(s, val)}
                                className={`py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                  status === val ? on : off
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text" placeholder="הערה לאחמ״ש (אופציונלי)…" disabled={weekStarted}
                            defaultValue={comment}
                            onBlur={(e) => e.target.value !== comment && setComment(s, e.target.value)}
                            className="w-full mt-3 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
                          />
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// SWAPS
// ============================================================

function MySwaps({ user, guards, shifts, swapRequests, actions, busy }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ shiftId: "", toGuard: "", message: "" });

  const myShifts = shifts.filter((s) => s.assignedGuards.includes(user.id) && s.date >= todayISO());
  const sent = swapRequests.filter((r) => r.fromGuard === user.id);
  const incoming = swapRequests.filter((r) => r.toGuard === user.id);

  const nameOf = (id) => guards.find((g) => g.id === id)?.name || "—";
  const shiftOf = (id) => shifts.find((s) => s.id === id);
  const clr = { pending: "yellow", approved: "green", rejected: "red" };
  const lbl = { pending: "ממתין", approved: "אושר", rejected: "נדחה" };

  const submit = async () => {
    if (!form.shiftId || !form.toGuard) return;
    await actions.createSwap({ shiftId: form.shiftId, fromGuard: user.id, toGuard: form.toGuard, message: form.message });
    setForm({ shiftId: "", toGuard: "", message: "" });
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="בקשות החלפה"
        subtitle="בקש ממישהו אחר לקחת משמרת שלך"
        actions={<Btn onClick={() => setShowForm(true)} disabled={!myShifts.length}>+ בקשה</Btn>}
      />

      {!myShifts.length && !sent.length && !incoming.length && (
        <EmptyState
          icon="🔄" title="אין לך משמרות להחליף"
          body="אחרי שתשובץ למשמרת בסידור שפורסם, תוכל לבקש מחבר לצוות להחליף אותך."
        />
      )}

      {incoming.length > 0 && (
        <div>
          <h2 className="font-bold text-gray-800 mb-2.5">📩 בקשות אליך</h2>
          <div className="space-y-2.5">
            {incoming.map((r) => {
              const s = shiftOf(r.shiftId);
              return (
                <Card key={r.id} className={r.status === "pending" ? "border-amber-200 bg-amber-50/30" : "opacity-70"}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-900">{nameOf(r.fromGuard)} מבקש שתחליף אותו</p>
                      {s && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatDateHe(s.date)} · {s.label} {s.startTime}–{s.endTime}
                        </p>
                      )}
                      {r.message && <p className="text-xs text-gray-600 mt-1">💬 {r.message}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge color={clr[r.status]}>{lbl[r.status]}</Badge>
                      {r.status === "pending" && (
                        <>
                          <Btn size="sm" variant="success" onClick={() => actions.decideSwap(r.id, "approved")} disabled={busy}>
                            מסכים
                          </Btn>
                          <Btn size="sm" variant="danger" onClick={() => actions.decideSwap(r.id, "rejected")} disabled={busy}>
                            לא
                          </Btn>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {sent.length > 0 && (
        <div>
          <h2 className="font-bold text-gray-800 mb-2.5">📤 הבקשות שלך</h2>
          <div className="space-y-2.5">
            {sent.map((r) => {
              const s = shiftOf(r.shiftId);
              return (
                <Card key={r.id}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-900">בקשה ל{nameOf(r.toGuard)}</p>
                      {s && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatDateHe(s.date)} · {s.label} {s.startTime}–{s.endTime}
                        </p>
                      )}
                    </div>
                    <Badge color={clr[r.status]}>{lbl[r.status]}</Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="בקשת החלפה">
        <div className="space-y-3">
          <Field label="המשמרת שלי">
            <Select value={form.shiftId} onChange={(e) => setForm((f) => ({ ...f, shiftId: e.target.value }))}>
              <option value="">בחר משמרת</option>
              {myShifts.map((s) => (
                <option key={s.id} value={s.id}>{shortDate(s.date)} — {s.label} {s.startTime}–{s.endTime}</option>
              ))}
            </Select>
          </Field>
          <Field label="לבקש מ">
            <Select value={form.toGuard} onChange={(e) => setForm((f) => ({ ...f, toGuard: e.target.value }))}>
              <option value="">בחר שומר</option>
              {guards.filter((g) => g.id !== user.id).map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="סיבה (אופציונלי)">
            <Input value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="אירוע משפחתי…" />
          </Field>
          <div className="flex gap-2 pt-1">
            <Btn onClick={submit} loading={busy} className="flex-1" disabled={!form.shiftId || !form.toGuard}>
              שלח בקשה
            </Btn>
            <Btn variant="secondary" onClick={() => setShowForm(false)}>ביטול</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// SHELL
// ============================================================

export default function GuardApp({ state }) {
  const { user, team, guards, shifts, availability, swapRequests, actions, busy, error, clearError, logout } = state;
  const [view, setView] = useState("schedule");

  const incoming = swapRequests.filter((r) => r.toGuard === user.id && r.status === "pending").length;
  const current = NAV.find((n) => n.id === view);

  const views = {
    schedule: <MySchedule user={user} guards={guards} shifts={shifts} />,
    availability: (
      <MyAvailability user={user} shifts={shifts} availability={availability} actions={actions} busy={busy} />
    ),
    swaps: (
      <MySwaps user={user} guards={guards} shifts={shifts} swapRequests={swapRequests} actions={actions} busy={busy} />
    ),
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#F6F7F9]" dir="rtl">
      <header className="flex-shrink-0 bg-slate-900 text-white">
        <div className="flex items-center justify-between px-4 py-3 max-w-3xl mx-auto w-full">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar id={user.id} name={user.name} size={38} />
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">{user.name}</p>
              <p className="text-slate-400 text-[10px]">
                מאבטח · {team?.name || "צוות"} <span className="font-mono">{user.teamCode}</span>
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="text-slate-400 hover:text-red-400 text-sm px-3 py-2 rounded-xl hover:bg-white/5 transition-colors"
          >
            🚪 יציאה
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-3 sm:p-5 pb-24 space-y-5">
          {error && <Alert tone="error" onClose={clearError}>{error}</Alert>}
          {views[view]}
        </div>
      </div>

      {/* Bottom tab bar — guards are on phones, not laptops. */}
      <nav className="flex-shrink-0 bg-white border-t border-gray-200 safe-bottom">
        <div className="flex max-w-3xl mx-auto">
          {NAV.map((item) => (
            <button
              key={item.id} onClick={() => setView(item.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 relative transition-colors ${
                view === item.id ? "text-blue-600" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span className="text-[10px] font-semibold">{item.label}</span>
              {item.badge && incoming > 0 && (
                <span className="absolute top-1.5 left-1/2 mr-4 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                  {incoming}
                </span>
              )}
              {view === item.id && <span className="absolute top-0 inset-x-4 h-0.5 bg-blue-600 rounded-full" />}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
