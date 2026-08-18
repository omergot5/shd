import { useMemo, useState } from "react";
import { autoAssign, availStatus, DEFAULT_RULES, explainUnfilled } from "../lib/autoAssign.js";
import { formatDateHe, rangeLabelHe, shortDate } from "../lib/dates.js";
import { Icon } from "./icons.jsx";
import {
  Alert, Avatar, Badge, Btn, Card, EmptyState, guardColor, Input, Meter, Modal, PageHeader,
} from "./ui.jsx";

// ============================================================
// The smart assignment screen.
//
// The point of this screen is not that it fills a rota — it is that a
// supervisor can see *why* every decision was made and override any of it
// before anything is written. That is what makes an automated schedule
// trustworthy enough to actually publish.
// ============================================================

const scoreTone = (score) =>
  score >= 75 ? { tone: "accent", label: "התאמה מצוינת" }
  : score >= 55 ? { tone: "brand", label: "התאמה טובה" }
  : score >= 35 ? { tone: "warn", label: "התאמה סבירה" }
  : { tone: "danger", label: "התאמה בדוחק" };

/** One icon per scoring criterion, so the breakdown scans without reading. */
const KIND_ICON = {
  availability: "check-circle",
  fairness: "scale",
  night: "moon",
  rest: "bed",
  spread: "calendar",
  continuity: "refresh",
  balance: "shuffle",
  locked: "pin",
};

function RulesPanel({ rules, setRules, open, onClose }) {
  const num = (key, label, min, max, suffix) => (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-hairline last:border-0">
      <p className="text-sm font-medium text-content min-w-0">{label}</p>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Input
          type="number"
          min={min}
          max={max}
          value={rules[key]}
          onChange={(e) => setRules((r) => ({ ...r, [key]: Number(e.target.value) }))}
          className="w-20 text-center"
          aria-label={label}
        />
        <span className="text-xs text-faint w-12">{suffix}</span>
      </div>
    </div>
  );

  const toggle = (key, label, help) => (
    <label className="flex items-center justify-between gap-4 py-2.5 border-b border-hairline last:border-0 cursor-pointer">
      <div className="min-w-0">
        <p className="text-sm font-medium text-content">{label}</p>
        <p className="text-xs text-faint">{help}</p>
      </div>
      <input
        type="checkbox"
        checked={rules[key]}
        onChange={(e) => setRules((r) => ({ ...r, [key]: e.target.checked }))}
        className="w-5 h-5 accent-[rgb(var(--brand))] flex-shrink-0 cursor-pointer"
      />
    </label>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="כללי השיבוץ"
      subtitle="אלה האילוצים שהמנוע מחויב להם"
      footer={
        <>
          <Btn onClick={onClose} className="flex-1">
            שמור
          </Btn>
          <Btn variant="secondary" onClick={() => setRules(DEFAULT_RULES)}>
            אפס
          </Btn>
        </>
      }
    >
      <p className="text-sm text-muted mb-4">
        שיבוץ שמפר אילוץ קשיח פשוט לא ייווצר — המשמרת תישאר פתוחה עם הסבר למה.
      </p>
      <div className="bg-surface-sunken rounded-xl px-4 py-1 mb-4">
        {num("minRestHours", "מנוחה מינימלית בין משמרות", 0, 24, "שעות")}
        {num("maxConsecutiveHours", "מקסימום שעות רצופות", 4, 24, "שעות")}
        {num("maxShiftsPerWeek", "מקסימום משמרות בשבוע", 1, 14, "משמרות")}
        {num("maxNightsPerWeek", "מקסימום לילות בשבוע", 0, 7, "לילות")}
      </div>
      <div className="bg-surface-sunken rounded-xl px-4 py-1">
        {toggle("allowMaybe", 'לשבץ גם מי שסימן "אולי"', "אחרת רק מי שסימן זמין במפורש")}
        {toggle("allowUnknown", "לשבץ גם מי שלא הגיש זמינות", "שימושי כשחלק מהצוות לא מילא")}
        {toggle(
          "honourPreferences",
          'להתחשב במי שסימן "מעדיף"',
          "מכריע בין שני שומרים פנויים — לא גובר על הוגנות או על כלל קשיח"
        )}
      </div>
    </Modal>
  );
}

/** One line of the score breakdown: criterion, contribution, and its weight. */
const ScoreRow = ({ part, max }) => {
  const positive = part.points > 0;
  const negative = part.points < 0;
  const tone = positive ? "accent" : negative ? "danger" : "neutral";
  const width = max ? Math.min(100, (Math.abs(part.points) / max) * 100) : 0;

  return (
    <div className="flex items-center gap-3 bg-surface-sunken rounded-xl px-3.5 py-2.5">
      <Icon
        name={KIND_ICON[part.kind] || "info"}
        size={16}
        className={positive ? "text-accent" : negative ? "text-danger" : "text-faint"}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-content truncate">{part.label}</p>
        {width > 0 && (
          <div className="mt-1.5">
            <Meter
              value={width}
              height={3}
              color={positive ? "rgb(var(--accent))" : "rgb(var(--danger))"}
            />
          </div>
        )}
      </div>
      {part.points !== 0 && (
        <span
          className={`text-sm font-bold tabular-nums ${positive ? "text-accent" : "text-danger"}`}
        >
          {positive ? "+" : ""}
          {part.points}
        </span>
      )}
      {part.points === 0 && <Badge tone={tone}>מידע</Badge>}
    </div>
  );
};

function WhyModal({ entry, guard, shift, onClose }) {
  if (!entry) return null;
  const tone = scoreTone(entry.score);
  const parts = entry.parts || [];
  // Scale every bar against the single biggest contribution, so the visual
  // weights match the actual weights instead of all maxing out.
  const peak = Math.max(1, ...parts.map((p) => Math.abs(p.points)));
  const ordered = [...parts].sort((a, b) => b.points - a.points);

  return (
    <Modal open onClose={onClose} title="למה דווקא הוא/היא?" wide>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Avatar id={guard?.id} name={guard?.name} size={48} />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-content">{guard?.name}</p>
          <p className="text-xs text-muted">
            {shift?.label} · {formatDateHe(shift?.date)} · {shift?.startTime}–{shift?.endTime}
          </p>
        </div>
        <div className="text-left">
          <p className="text-3xl font-black text-content leading-none" data-numeric>
            {entry.score}
            <span className="text-lg text-muted">%</span>
          </p>
          <Badge tone={tone.tone} className="mt-1">
            {tone.label}
          </Badge>
        </div>
      </div>

      <div className="space-y-1.5">
        {ordered.map((part, i) => (
          <ScoreRow key={i} part={part} max={peak} />
        ))}
      </div>

      <p className="text-xs text-faint mt-4 leading-relaxed">
        אחוז ההתאמה הוא סכום הנקודות למעלה ({entry.raw ?? "—"}) חלקי המקסימום האפשרי למשמרת מסוג זה.
        אילוצים קשיחים — מנוחה, שעות רצופות וזמינות — לא מנוקדים כלל: הם פוסלים מועמד על הסף, ולכן
        שיבוץ שמפר אותם פשוט לא נוצר.
      </p>
    </Modal>
  );
}

/** A KPI tile. Big number first — that is what a supervisor scans for. */
const Kpi = ({ label, value, unit, hint, meter, meterColor, tone = "text-content" }) => (
  <Card className="p-4">
    <p className="text-[11px] text-muted font-semibold">{label}</p>
    <p className={`text-3xl font-black leading-tight ${tone}`} data-numeric>
      {value}
      {unit && <span className="text-lg text-muted">{unit}</span>}
    </p>
    <p className="text-[11px] text-faint mb-2">{hint}</p>
    {meter !== undefined && <Meter value={meter} color={meterColor} label={label} />}
  </Card>
);

export default function SmartAssign({ weekDates, shifts, guards, availability, onApply, busy }) {
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [plan, setPlan] = useState(null);
  const [showRules, setShowRules] = useState(false);
  const [keepManual, setKeepManual] = useState(true);
  const [why, setWhy] = useState(null);
  const [showLog, setShowLog] = useState(false);
  const [applied, setApplied] = useState(false);

  const weekShifts = useMemo(
    () => shifts.filter((s) => weekDates.includes(s.date)),
    [shifts, weekDates]
  );

  const guardById = useMemo(() => new Map(guards.map((g) => [g.id, g])), [guards]);

  const submittedCount = useMemo(() => {
    const withAnswer = new Set();
    for (const g of guards) {
      if (weekShifts.some((s) => availStatus(availability, g.id, s.id) !== "unknown")) {
        withAnswer.add(g.id);
      }
    }
    return withAnswer.size;
  }, [guards, weekShifts, availability]);

  const run = () => {
    setPlan(
      autoAssign({ shifts: weekShifts, guards, availability, rules, keepExisting: keepManual })
    );
    setApplied(false);
  };

  const apply = async () => {
    await onApply(weekShifts.map((s) => s.id), plan.assignments);
    setApplied(true);
  };

  const header = (
    <PageHeader
      title="שיבוץ חכם"
      subtitle="המנוע בונה סידור שבועי לפי זמינות, מנוחה והוגנות"
    />
  );

  if (!guards.length) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          icon="users"
          title="אין עדיין שומרים בצוות"
          body='כדי לשבץ צריך לפחות שומר אחד. הוסף שומרים במסך "הצוות שלי", או שתף איתם את קוד הצוות כדי שיצטרפו בעצמם.'
        />
      </div>
    );
  }

  if (!weekShifts.length) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          icon="calendar"
          title="אין משמרות בשבוע הזה"
          body='צור משמרות במסך "ניהול משמרות" — יש שם כפתור שממלא שבוע שלם בלחיצה אחת — ואז חזור לכאן.'
        />
      </div>
    );
  }

  const allSubmitted = submittedCount === guards.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="שיבוץ חכם"
        subtitle={`${rangeLabelHe(weekDates)} · ${weekShifts.length} משמרות · ${guards.length} שומרים`}
        actions={
          <>
            <Btn variant="outline" icon="sliders" onClick={() => setShowRules(true)}>
              כללים
            </Btn>
            <Btn icon={plan ? "refresh" : "zap"} onClick={run} loading={busy}>
              {plan ? "הרץ מחדש" : "הרץ שיבוץ חכם"}
            </Btn>
          </>
        }
      />

      {/* Readiness — how much the engine has to work with. */}
      <Card>
        <div className="flex items-start gap-3 flex-wrap">
          <Icon
            name={allSubmitted ? "check-circle" : "info"}
            size={22}
            className={allSubmitted ? "text-accent" : "text-brand"}
          />
          <div className="flex-1 min-w-[16rem]">
            <p className="text-sm font-semibold text-content">
              {submittedCount} מתוך {guards.length} שומרים הגישו זמינות לשבוע הזה
            </p>
            <p className="text-xs text-muted mt-0.5">
              {allSubmitted
                ? "כל הצוות הגיש — השיבוץ יהיה מדויק ככל האפשר"
                : rules.allowUnknown
                ? "מי שלא הגיש עדיין ישובץ, אבל בעדיפות נמוכה. אפשר לשנות זאת בכללים."
                : "לפי הכללים הנוכחיים מי שלא הגיש לא ישובץ כלל"}
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted flex-shrink-0 cursor-pointer">
            <input
              type="checkbox"
              checked={keepManual}
              onChange={(e) => setKeepManual(e.target.checked)}
              className="w-4 h-4 accent-[rgb(var(--brand))]"
            />
            שמור שיבוצים ידניים
          </label>
        </div>
      </Card>

      {!plan ? (
        <EmptyState
          icon="zap"
          title="מוכן לשבץ"
          body={`המנוע יעבור על ${weekShifts.length} המשמרות, יפסול כל מי שלא עומד באילוצים (זמינות, ${rules.minRestHours} שעות מנוחה, מקס' ${rules.maxConsecutiveHours} שעות רצוף), וידרג את השאר לפי הוגנות עומס וסבב לילות.`}
          action={
            <Btn size="lg" icon="zap" onClick={run} loading={busy}>
              הרץ שיבוץ חכם
            </Btn>
          }
        />
      ) : (
        <div className="space-y-6 animate-fade-up">
          {applied && (
            <Alert tone="accent" onClose={() => setApplied(false)}>
              השיבוץ הוחל. אפשר לפרסם אותו לשומרים במסך "פרסום סידור".
            </Alert>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi
              label="כיסוי משמרות"
              value={plan.summary.coverage}
              unit="%"
              hint={`${plan.summary.filledSlots}/${plan.summary.totalSlots} תקנים אוישו`}
              meter={plan.summary.coverage}
              meterColor={
                plan.summary.coverage === 100 ? "rgb(var(--accent))" : "rgb(var(--warn))"
              }
            />
            <Kpi
              label="ציון הוגנות"
              value={plan.summary.fairnessScore}
              hint={`פער של ${plan.fairness.spread} משמרות בין הכי עמוס לפנוי`}
              meter={plan.summary.fairnessScore}
              meterColor="rgb(var(--brand))"
            />
            <Kpi
              label="משמרות פתוחות"
              value={plan.summary.openSlots}
              tone={plan.summary.openSlots ? "text-warn" : "text-accent"}
              hint={plan.summary.openSlots ? "דורשות טיפול ידני" : "הכל מאויש"}
            />
            <Kpi
              label="החלטות המנוע"
              value={plan.assignments.length}
              hint={
                plan.summary.balanceMoves > 0
                  ? `כולל ${plan.summary.balanceMoves} העברות איזון`
                  : "ללא צורך באיזון"
              }
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Btn variant="accent" size="lg" icon={applied ? "check" : "check-circle"} onClick={apply} loading={busy} disabled={applied}>
              {applied ? "הוחל" : "החל את השיבוץ הזה"}
            </Btn>
            <Btn variant="outline" onClick={() => setPlan(null)}>
              בטל
            </Btn>
            <Btn
              variant="ghost"
              icon={showLog ? "up" : "down"}
              onClick={() => setShowLog((v) => !v)}
              aria-expanded={showLog}
            >
              יומן החלטות ({plan.log.length})
            </Btn>
            <span className="text-xs text-faint mr-auto">שום דבר לא נשמר עד שתלחץ "החל"</span>
          </div>

          {showLog && (
            <Card className="max-h-72 overflow-auto">
              <p className="text-muted text-[11px] font-bold uppercase tracking-wider mb-3">
                יומן ההחלטות של המנוע
              </p>
              <div className="space-y-1.5 font-mono text-[11px]">
                {plan.log.map((l, i) => (
                  <div key={i} className="flex gap-2 text-muted">
                    <span className="text-faint w-6 flex-shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={`flex-shrink-0 font-bold ${
                        l.step === "assign"
                          ? "text-accent"
                          : l.step === "balance"
                          ? "text-brand"
                          : "text-faint"
                      }`}
                    >
                      {l.step === "assign" ? "ASSIGN" : l.step === "balance" ? "BALANCE" : "ORDER"}
                    </span>
                    <span className="flex-1 text-content/80">
                      {l.title} — {l.detail}
                      {l.runnerUp && <span className="text-faint"> · מקום שני: {l.runnerUp}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <h2 className="font-bold text-content mb-1">חלוקת העומס המוצעת</h2>
            <p className="text-xs text-muted mb-4">
              ממוצע של {plan.summary.targetPerGuard} משמרות לשומר
            </p>
            <div className="space-y-3">
              {plan.fairness.perGuard.map((p) => (
                <div key={p.guardId}>
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar id={p.guardId} name={p.name} size={26} />
                      <span className="text-sm font-medium text-content truncate">{p.name}</span>
                    </div>
                    <span className="text-xs text-muted flex-shrink-0" data-numeric>
                      {p.shifts} משמרות · {p.nights} לילות · {p.hours} ש'
                    </span>
                  </div>
                  <Meter
                    value={p.shifts}
                    max={Math.max(plan.fairness.max, 1)}
                    color={guardColor(p.guardId)}
                    height={7}
                    label={`עומס של ${p.name}`}
                  />
                </div>
              ))}
            </div>
          </Card>

          <div>
            <h2 className="font-bold text-content mb-3">
              הסידור המוצע — לחץ על שומר כדי לראות למה נבחר
            </h2>
            <div className="space-y-4">
              {weekDates.map((date) => {
                const dayShifts = weekShifts.filter((s) => s.date === date);
                if (!dayShifts.length) return null;
                return (
                  <div key={date}>
                    <p className="text-xs font-bold text-muted mb-2 border-b border-hairline pb-1.5">
                      {formatDateHe(date)}
                    </p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {dayShifts.map((shift) => {
                        const records = plan.detailByShift[shift.id] || [];
                        const need = Math.max(1, shift.requiredGuards || 1);
                        const short = records.length < need;
                        return (
                          <Card
                            key={shift.id}
                            className={`p-4 ${short ? "!border-warn/40" : ""}`}
                          >
                            <div className="flex items-center justify-between mb-3 gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ background: shift.color }}
                                  aria-hidden="true"
                                />
                                <span className="font-bold text-sm text-content truncate">
                                  {shift.label}
                                </span>
                              </div>
                              <Badge tone={short ? "warn" : "accent"}>
                                {records.length}/{need}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-faint mb-3 flex items-center gap-1">
                              <span data-numeric>
                                {shift.startTime}–{shift.endTime}
                              </span>
                              <Icon name="map-pin" size={11} />
                              {shift.location}
                            </p>
                            <div className="space-y-1.5">
                              {records.map((rec) => {
                                const g = guardById.get(rec.guardId);
                                const tone = scoreTone(rec.score);
                                return (
                                  <button
                                    key={rec.guardId}
                                    onClick={() => setWhy({ entry: rec, guard: g, shift })}
                                    className="w-full flex items-center gap-2 bg-surface-sunken hover:bg-surface-hover ring-1 ring-inset ring-hairline hover:ring-brand/40 rounded-lg px-2.5 py-2 transition-[background,box-shadow] duration-200 text-right cursor-pointer"
                                  >
                                    <Avatar id={rec.guardId} name={g?.name} size={26} />
                                    <span className="text-xs font-medium text-content flex-1 truncate">
                                      {g?.name || "—"}
                                    </span>
                                    {rec.locked ? (
                                      <Badge tone="neutral" icon="pin">
                                        ידני
                                      </Badge>
                                    ) : (
                                      <Badge tone={tone.tone}>{rec.score}% התאמה</Badge>
                                    )}
                                  </button>
                                );
                              })}
                              {short && (
                                <p className="text-[11px] text-warn bg-warn/10 ring-1 ring-inset ring-warn/20 rounded-lg px-2.5 py-2">
                                  חסרים {need - records.length} —{" "}
                                  {explainUnfilled(
                                    plan.unfilled.find((u) => u.shiftId === shift.id)
                                  )}
                                </p>
                              )}
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {plan.unfilled.length > 0 && (
            <Card className="!border-warn/30">
              <h2 className="font-bold text-content mb-1 flex items-center gap-2">
                <Icon name="alert" size={18} className="text-warn" />
                משמרות שלא הצלחנו לאייש
              </h2>
              <p className="text-xs text-muted mb-4">
                המנוע לא מפר אילוץ קשיח. הנה בדיוק מי נפסל ולמה — כך אפשר להחליט אם לשנות כלל או
                לדבר עם מישהו.
              </p>
              <div className="space-y-3">
                {plan.unfilled.map((u) => (
                  <div
                    key={u.shiftId}
                    className="bg-surface-sunken rounded-xl p-3.5 ring-1 ring-inset ring-hairline"
                  >
                    <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-content">
                        {u.shift.label} · {shortDate(u.shift.date)} · {u.shift.startTime}–
                        {u.shift.endTime}
                      </span>
                      <Badge tone="warn">חסרים {u.missing}</Badge>
                    </div>
                    <div className="space-y-1">
                      {u.blockers.slice(0, 6).map((b) => (
                        <div key={b.guardId} className="flex items-center gap-2 text-xs">
                          <Avatar id={b.guardId} name={b.name} size={20} />
                          <span className="text-content font-medium">{b.name}</span>
                          <span className="text-faint">—</span>
                          <span className="text-muted">{b.reason}</span>
                        </div>
                      ))}
                      {u.blockers.length > 6 && (
                        <p className="text-[11px] text-faint">
                          ועוד {u.blockers.length - 6} שומרים…
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      <RulesPanel
        rules={rules}
        setRules={setRules}
        open={showRules}
        onClose={() => setShowRules(false)}
      />
      {why && <WhyModal {...why} onClose={() => setWhy(null)} />}
    </div>
  );
}
