import { useMemo, useState } from "react";
import {
  Alert, Avatar, Badge, Btn, Card, EmptyState, Field, guardColor, Input, Meter, Modal, PageHeader,
  readableInk, Segmented, Select,
} from "./ui.jsx";
import { Icon } from "./icons.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import {
  addDays, availabilityDeadline, countdownHe, dayName, formatDateHe, fromISODate, rangeLabelHe,
  shortDate, toISODate, todayISO, weekByOffset,
} from "../lib/dates.js";
import { availStatus } from "../lib/autoAssign.js";

const NAV = [
  { id: "schedule", label: "הסידור שלי", icon: "calendar" },
  { id: "availability", label: "הגשת זמינות", icon: "check-circle" },
  { id: "swaps", label: "החלפות", icon: "swap", badge: true },
];

/** Availability as icon + word + colour — never colour alone. */
const AVAIL = {
  preferred:   { icon: "star",         label: "מעדיף",   short: "מעדיף", tone: "brand" },
  available:   { icon: "check-circle", label: "זמין",    short: "זמין",  tone: "accent" },
  maybe:       { icon: "help",         label: "אולי",    short: "אולי",  tone: "warn" },
  unavailable: { icon: "x-circle",     label: "לא זמין", short: "לא",    tone: "danger" },
};

const AVAIL_CHOICES = ["preferred", "available", "maybe", "unavailable"];

const SWAP_STATUS = {
  pending:  { label: "ממתין", tone: "warn" },
  approved: { label: "אושר",  tone: "accent" },
  rejected: { label: "נדחה",  tone: "danger" },
};

// ============================================================
// MY SCHEDULE
// ============================================================

function MySchedule({ user, guards, shifts }) {
  const today = todayISO();
  const mine = shifts
    .filter((s) => s.published && s.assignedGuards.includes(user.id))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  const upcoming = mine.filter((s) => s.date >= today);
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
          icon="inbox"
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
            const isToday = s.date === today;
            const ink = readableInk(s.color);
            return (
              <div
                key={s.id}
                className="rounded-2xl p-4 shadow-lg relative overflow-hidden"
                style={{ background: s.color, color: ink }}
              >
                {isToday && (
                  <span
                    className="absolute top-3 left-3 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: ink, color: s.color }}
                  >
                    היום
                  </span>
                )}
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-black/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon name="clock" size={24} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-lg leading-tight">{s.label}</h3>
                    <p className="text-sm opacity-95 mt-0.5">{formatDateHe(s.date)}</p>
                    <p className="text-sm font-semibold opacity-90 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span data-numeric>
                        {s.startTime}–{s.endTime}
                      </span>
                      <Icon name="map-pin" size={13} />
                      {s.location}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2.5 flex-wrap text-xs">
                      <span className="opacity-80">עם:</span>
                      {others.length === 0 ? (
                        <span className="opacity-70">לבד במשמרת</span>
                      ) : (
                        others.map((gid) => {
                          const c = guardColor(gid);
                          return (
                            <span
                              key={gid}
                              className="px-2 py-0.5 rounded-md font-bold"
                              style={{ backgroundColor: c, color: readableInk(c) }}
                            >
                              {nameOf(gid)}
                            </span>
                          );
                        })
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
          <h2 className="font-bold text-content mb-3 flex items-center gap-2">
            <Icon name="clipboard" size={17} className="text-muted" />
            הסידור המלא של הצוות
          </h2>
          <div className="space-y-4">
            {[...new Set(publishedAll.map((s) => s.date))].sort().map((date) => (
              <div key={date}>
                <p className="text-[11px] font-bold text-muted mb-2 border-b border-hairline pb-1.5">
                  {formatDateHe(date)}
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {publishedAll
                    .filter((s) => s.date === date)
                    .map((s) => {
                      const isMine = s.assignedGuards.includes(user.id);
                      const ink = readableInk(s.color);
                      return (
                        <div
                          key={s.id}
                          className={`p-3 rounded-xl shadow-sm ${
                            isMine ? "ring-2 ring-offset-2 ring-offset-bg ring-brand" : "opacity-80"
                          }`}
                          style={{ background: s.color, color: ink }}
                        >
                          <div className="flex items-center justify-between mb-1.5 gap-2">
                            <span className="font-bold text-xs bg-black/15 px-2 py-0.5 rounded-lg">
                              {s.label}
                            </span>
                            {isMine && (
                              <span
                                className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                                style={{ background: ink, color: s.color }}
                              >
                                שלי
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] opacity-90 mb-2" data-numeric>
                            {s.startTime}–{s.endTime}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {s.assignedGuards.length === 0 ? (
                              <span className="text-[10px] bg-black/25 text-white px-1.5 py-0.5 rounded">
                                לא משובץ
                              </span>
                            ) : (
                              s.assignedGuards.map((gid) => {
                                const c = gid === user.id ? ink : guardColor(gid);
                                return (
                                  <span
                                    key={gid}
                                    className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                                    style={{
                                      backgroundColor: c,
                                      color: gid === user.id ? s.color : readableInk(c),
                                    }}
                                  >
                                    {nameOf(gid)}
                                  </span>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// AVAILABILITY SUBMISSION
// ============================================================

function MyAvailability({ user, team, shifts, availability, actions, busy }) {
  const [offset, setOffset] = useState(1);
  const weekDates = useMemo(() => weekByOffset(offset), [offset]);
  const weekShifts = shifts.filter((s) => weekDates.includes(s.date));

  // The week is only locked once it has actually started — a guard should
  // never be stuck unable to answer for a week that is still in the future.
  const weekStarted = weekDates[0] < todayISO();
  const deadline = useMemo(() => availabilityDeadline(weekDates[0], team), [weekDates, team]);
  const pastDeadline = new Date() > deadline && !weekStarted;
  const hoursLeft = (deadline - new Date()) / 3600000;
  const deadlineLabel = `${dayName(toISODate(deadline))}, ${deadline.toLocaleDateString("he-IL")} בשעה ${String(deadline.getHours()).padStart(2, "0")}:00`;

  const answered = weekShifts.filter(
    (s) => availStatus(availability, user.id, s.id) !== "unknown"
  ).length;
  const remaining = weekShifts.length - answered;

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

      <Segmented
        value={offset}
        onChange={setOffset}
        options={[
          { value: 0, label: "השבוע" },
          { value: 1, label: "שבוע הבא" },
          { value: 2, label: "עוד שבועיים" },
        ]}
      />

      {weekShifts.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="אין משמרות בשבוע הזה"
          body={`האחמ"ש עדיין לא הגדיר משמרות ל${rangeLabelHe(weekDates)}. נסה שבוע אחר או חזור מאוחר יותר.`}
        />
      ) : (
        <>
          {weekStarted ? (
            <Alert tone="warn" title="השבוע הזה כבר התחיל">
              לא ניתן לשנות זמינות. פנה לאחמ״ש אם משהו השתנה.
            </Alert>
          ) : pastDeadline ? (
            <Alert
              tone={user.deadlineExempt ? "info" : "danger"}
              title={user.deadlineExempt ? "המועד חלף — אבל אושר לך להגיש" : "המועד להגשה חלף"}
            >
              {deadlineLabel} ({countdownHe(deadline)}).{" "}
              {user.deadlineExempt
                ? 'האחמ״ש פתח לך את ההגשה באופן אישי, אפשר להמשיך כרגיל.'
                : "עדיין אפשר להגיש, אבל ייתכן שהאחמ״ש כבר בנה את הסידור — עדכן אותו."}
            </Alert>
          ) : (
            // Urgency escalates on its own as the deadline closes. A guard who
            // opens the app the night before should not have to work out from a
            // date whether that is soon.
            <Alert
              tone={hoursLeft <= 24 ? "warn" : "info"}
              title={hoursLeft <= 24 ? "ההגשה נסגרת בקרוב" : undefined}
              icon={hoursLeft <= 24 ? "bell" : undefined}
            >
              יש להגיש עד {deadlineLabel} — <b>{countdownHe(deadline)}</b>
              {remaining > 0 && ` · נותרו ${remaining} משמרות ללא מענה`}
            </Alert>
          )}

          <Card>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-content">
                  ענית על {answered} מתוך {weekShifts.length} משמרות
                </p>
                <div className="max-w-[240px] mt-2">
                  <Meter
                    value={answered}
                    max={weekShifts.length}
                    height={8}
                    label="התקדמות ההגשה"
                  />
                </div>
              </div>
              {!weekStarted && answered < weekShifts.length && (
                <div className="flex gap-2 flex-wrap">
                  <Btn size="sm" variant="outline" icon="check-circle" onClick={() => markAll("available")} disabled={busy}>
                    סמן הכל כזמין
                  </Btn>
                  <Btn size="sm" variant="outline" icon="x-circle" onClick={() => markAll("unavailable")} disabled={busy}>
                    סמן הכל כלא זמין
                  </Btn>
                </div>
              )}
            </div>
            {/* Without this, "מעדיף" reads as a stronger "זמין" and everyone
                picks it. Saying out loud that it costs nothing and grants no
                guarantee is what keeps the signal meaningful. */}
            <p className="text-xs text-muted mt-3 pt-3 border-t border-hairline flex items-start gap-2">
              <Icon name="star" size={13} className="text-brand mt-0.5 shrink-0" />
              <span>
                <b className="text-content">מעדיף</b> = אני פנוי, ואם אפשר הייתי שמח דווקא למשמרת הזו.
                זה לא סוגר לך שום אופציה ולא מבטיח שיבוץ — זה רק מכריע בין שני שומרים שממילא פנויים.
              </span>
            </p>
          </Card>

          <div className="space-y-6">
            {weekDates.map((date) => {
              const day = weekShifts.filter((s) => s.date === date);
              if (!day.length) return null;
              return (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <h2 className="text-sm font-bold text-content glass px-3 py-1.5 rounded-lg">
                      {dayName(date)}
                    </h2>
                    <span className="text-xs text-muted">{formatDateHe(date)}</span>
                    <div className="flex-1 h-px bg-hairline" />
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    {day.map((s) => {
                      const raw = availability[`${user.id}-${s.id}`];
                      const status = availStatus(availability, user.id, s.id);
                      const comment = typeof raw === "object" ? raw?.comment || "" : "";
                      const meta = AVAIL[status];
                      return (
                        <Card
                          key={s.id}
                          className="p-4"
                          style={{ borderRightColor: s.color, borderRightWidth: 6 }}
                        >
                          <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                            <div className="min-w-0">
                              <h3 className="font-bold text-base text-content">{s.label}</h3>
                              <p className="text-xs text-muted mt-0.5 flex items-center gap-1">
                                <span data-numeric>
                                  {s.startTime}–{s.endTime}
                                </span>
                                <Icon name="map-pin" size={11} />
                                {s.location}
                              </p>
                            </div>
                            {meta && (
                              <Badge tone={meta.tone} icon={meta.icon}>
                                {meta.label}
                              </Badge>
                            )}
                          </div>

                          <div
                            className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                            role="radiogroup"
                            aria-label={`זמינות ל${s.label} ב${formatDateHe(s.date)}`}
                          >
                            {AVAIL_CHOICES.map((val) => {
                              const m = AVAIL[val];
                              const on = status === val;
                              const toneCls = {
                                preferred: on
                                  ? "bg-brand text-on-brand ring-brand"
                                  : "text-brand ring-brand/25 hover:bg-brand/10",
                                available: on
                                  ? "bg-accent text-on-accent ring-accent"
                                  : "text-accent ring-accent/25 hover:bg-accent/10",
                                maybe: on
                                  ? "bg-warn text-white ring-warn"
                                  : "text-warn ring-warn/25 hover:bg-warn/10",
                                unavailable: on
                                  ? "bg-danger text-white ring-danger"
                                  : "text-danger ring-danger/25 hover:bg-danger/10",
                              }[val];
                              return (
                                <button
                                  key={val}
                                  role="radio"
                                  aria-checked={on}
                                  disabled={weekStarted || busy}
                                  onClick={() => setStatus(s, val)}
                                  className={`h-11 rounded-xl text-xs font-bold ring-1 ring-inset cursor-pointer
                                    flex items-center justify-center gap-1.5
                                    transition-[background,color,box-shadow] duration-200
                                    disabled:opacity-40 disabled:cursor-not-allowed ${toneCls}`}
                                >
                                  <Icon name={m.icon} size={14} strokeWidth={2.25} />
                                  {m.short}
                                </button>
                              );
                            })}
                          </div>

                          <Input
                            type="text"
                            placeholder="הערה לאחמ״ש (אופציונלי)…"
                            aria-label={`הערה על ${s.label}`}
                            disabled={weekStarted}
                            defaultValue={comment}
                            onBlur={(e) => e.target.value !== comment && setComment(s, e.target.value)}
                            className="mt-3 h-10 text-xs"
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
  const field = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const myShifts = shifts.filter((s) => s.assignedGuards.includes(user.id) && s.date >= todayISO());
  const sent = swapRequests.filter((r) => r.fromGuard === user.id);
  const incoming = swapRequests.filter((r) => r.toGuard === user.id);

  const nameOf = (id) => guards.find((g) => g.id === id)?.name || "—";
  const shiftOf = (id) => shifts.find((s) => s.id === id);

  const submit = async () => {
    if (!form.shiftId || !form.toGuard) return;
    await actions.createSwap({
      shiftId: form.shiftId,
      fromGuard: user.id,
      toGuard: form.toGuard,
      message: form.message,
    });
    setForm({ shiftId: "", toGuard: "", message: "" });
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="בקשות החלפה"
        subtitle="בקש ממישהו אחר לקחת משמרת שלך"
        actions={
          <Btn icon="plus" onClick={() => setShowForm(true)} disabled={!myShifts.length}>
            בקשה
          </Btn>
        }
      />

      {!myShifts.length && !sent.length && !incoming.length && (
        <EmptyState
          icon="swap"
          title="אין לך משמרות להחליף"
          body="אחרי שתשובץ למשמרת בסידור שפורסם, תוכל לבקש מחבר לצוות להחליף אותך."
        />
      )}

      {incoming.length > 0 && (
        <section>
          <h2 className="font-bold text-content mb-2.5 flex items-center gap-2">
            <Icon name="inbox" size={17} className="text-muted" />
            בקשות אליך
          </h2>
          <div className="space-y-2.5">
            {incoming.map((r) => {
              const s = shiftOf(r.shiftId);
              const status = SWAP_STATUS[r.status];
              return (
                <Card key={r.id} className={r.status === "pending" ? "!border-warn/30" : "opacity-70"}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-content">
                        {nameOf(r.fromGuard)} מבקש שתחליף אותו
                      </p>
                      {s && (
                        <p className="text-xs text-muted mt-0.5">
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
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {r.status === "pending" && (
                        <>
                          <Btn
                            size="sm"
                            variant="accent"
                            icon="check"
                            onClick={() => actions.decideSwap(r.id, "approved")}
                            disabled={busy}
                          >
                            מסכים
                          </Btn>
                          <Btn
                            size="sm"
                            variant="danger"
                            icon="x"
                            onClick={() => actions.decideSwap(r.id, "rejected")}
                            disabled={busy}
                          >
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
        </section>
      )}

      {sent.length > 0 && (
        <section>
          <h2 className="font-bold text-content mb-2.5 flex items-center gap-2">
            <Icon name="send" size={17} className="text-muted" />
            הבקשות שלך
          </h2>
          <div className="space-y-2.5">
            {sent.map((r) => {
              const s = shiftOf(r.shiftId);
              const status = SWAP_STATUS[r.status];
              return (
                <Card key={r.id}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-content">בקשה ל{nameOf(r.toGuard)}</p>
                      {s && (
                        <p className="text-xs text-muted mt-0.5">
                          {formatDateHe(s.date)} · {s.label} {s.startTime}–{s.endTime}
                        </p>
                      )}
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="בקשת החלפה"
        footer={
          <>
            <Btn
              onClick={submit}
              loading={busy}
              className="flex-1"
              disabled={!form.shiftId || !form.toGuard}
            >
              שלח בקשה
            </Btn>
            <Btn variant="secondary" onClick={() => setShowForm(false)}>
              ביטול
            </Btn>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="המשמרת שלי">
            <Select value={form.shiftId} onChange={field("shiftId")}>
              <option value="">בחר משמרת</option>
              {myShifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {shortDate(s.date)} — {s.label} {s.startTime}–{s.endTime}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="לבקש מ">
            <Select value={form.toGuard} onChange={field("toGuard")}>
              <option value="">בחר שומר</option>
              {guards
                .filter((g) => g.id !== user.id)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="סיבה (אופציונלי)">
            <Input value={form.message} onChange={field("message")} placeholder="אירוע משפחתי…" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// SHELL
// ============================================================

export default function GuardApp({ state }) {
  const {
    user, team, guards, shifts, availability, swapRequests, actions, busy, error, clearError, logout,
  } = state;
  const [view, setView] = useState("schedule");

  // Nobody on the roster matched this name, so a fresh profile was made. That
  // is right for a genuinely new guard and wrong for a typo — and the two look
  // identical from here. Only the guard knows which, so ask them while they
  // can still fix it, rather than letting a stray second entry sit in the
  // supervisor's roster unnoticed.
  const [nameNoticeSeen, setNameNoticeSeen] = useState(false);
  const showNameNotice = user.isNewProfile && !nameNoticeSeen;

  const incoming = swapRequests.filter(
    (r) => r.toGuard === user.id && r.status === "pending"
  ).length;

  const views = {
    schedule: <MySchedule user={user} guards={guards} shifts={shifts} />,
    availability: (
      <MyAvailability
        user={user}
        team={team}
        shifts={shifts}
        availability={availability}
        actions={actions}
        busy={busy}
      />
    ),
    swaps: (
      <MySwaps
        user={user}
        guards={guards}
        shifts={shifts}
        swapRequests={swapRequests}
        actions={actions}
        busy={busy}
      />
    ),
  };

  return (
    <div className="app-canvas flex flex-col h-[100dvh]" dir="rtl">
      <header className="flex-shrink-0 glass rounded-none border-x-0 border-t-0 safe-top">
        <div className="flex items-center justify-between gap-2 px-4 py-3 max-w-3xl mx-auto w-full">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar id={user.id} name={user.name} size={38} />
            <div className="min-w-0">
              <p className="font-bold text-sm text-content truncate">{user.name}</p>
              <p className="text-muted text-[11px]">
                מאבטח · {team?.name || "צוות"}{" "}
                <span className="font-mono">{user.teamCode}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <ThemeToggle />
            <button
              onClick={logout}
              className="text-muted hover:text-danger text-sm px-3 h-11 rounded-xl hover:bg-danger/10 cursor-pointer transition-colors flex items-center gap-1.5"
            >
              <Icon name="logout" size={16} />
              <span className="hidden sm:inline">יציאה</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-3 sm:p-5 pb-24 space-y-5">
          {error && (
            <Alert tone="danger" onClose={clearError}>
              {error}
            </Alert>
          )}
          {showNameNotice && (
            <Alert tone="warn" onClose={() => setNameNoticeSeen(true)}>
              <b>נרשמת בתור "{user.name}" — פרופיל חדש.</b>{" "}
              אם האחמ״ש כבר הוסיף אותך לצוות, ייתכן שהשם נכתב קצת אחרת. במקרה כזה
              צא וכנס שוב עם השם המדויק שהוא רשם, אחרת המשמרות שלך יגיעו לרשומה השנייה.
              אם זו הפעם הראשונה שלך — הכל תקין, אפשר להתעלם.
            </Alert>
          )}
          {views[view]}
        </div>
      </div>

      {/* Bottom tab bar — guards are on phones, not laptops. */}
      <nav aria-label="ניווט ראשי" className="flex-shrink-0 glass rounded-none border-x-0 border-b-0 safe-bottom">
        <div className="flex max-w-3xl mx-auto">
          {NAV.map((item) => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                aria-current={active ? "page" : undefined}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 min-h-[56px] relative
                  cursor-pointer transition-colors duration-200 ${
                    active ? "text-brand" : "text-muted hover:text-content"
                  }`}
              >
                <Icon name={item.icon} size={21} />
                <span className="text-[10px] font-semibold">{item.label}</span>
                {item.badge && incoming > 0 && (
                  <span className="absolute top-1.5 left-1/2 mr-4 bg-danger text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {incoming}
                  </span>
                )}
                {active && <span className="absolute top-0 inset-x-4 h-0.5 bg-brand rounded-full" />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
