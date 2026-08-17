import { useMemo, useState } from "react";
import { autoAssign, DEFAULT_RULES, explainUnfilled, availStatus } from "../lib/autoAssign.js";
import { formatDateHe, shortDate, rangeLabelHe } from "../lib/dates.js";
import {
  Card, Btn, Badge, Avatar, Meter, PageHeader, EmptyState, Alert, Modal, Input, guardColor,
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
  score >= 75 ? { color: "green", label: "התאמה מצוינת" }
  : score >= 55 ? { color: "blue", label: "התאמה טובה" }
  : score >= 35 ? { color: "yellow", label: "התאמה סבירה" }
  : { color: "red", label: "התאמה בדוחק" };

const kindIcon = {
  availability: "✅", fairness: "⚖️", night: "🌙", rest: "😴",
  spread: "📆", continuity: "🔁", balance: "🔀", locked: "📌",
};

function RulesPanel({ rules, setRules, open, onClose }) {
  const num = (key, label, min, max, suffix) => (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-gray-100 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800">{label}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Input
          type="number" min={min} max={max} value={rules[key]}
          onChange={(e) => setRules((r) => ({ ...r, [key]: Number(e.target.value) }))}
          className="w-20 text-center"
        />
        <span className="text-xs text-gray-400 w-10">{suffix}</span>
      </div>
    </div>
  );

  const toggle = (key, label, help) => (
    <label className="flex items-center justify-between gap-4 py-2.5 border-b border-gray-100 last:border-0 cursor-pointer">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-400">{help}</p>
      </div>
      <input
        type="checkbox" checked={rules[key]}
        onChange={(e) => setRules((r) => ({ ...r, [key]: e.target.checked }))}
        className="w-5 h-5 accent-blue-600 flex-shrink-0"
      />
    </label>
  );

  return (
    <Modal open={open} onClose={onClose} title="⚙️ כללי השיבוץ">
      <p className="text-sm text-gray-500 mb-4">
        אלה האילוצים שהמנוע מחויב להם. שיבוץ שמפר אילוץ קשיח פשוט לא ייווצר —
        המשמרת תישאר פתוחה עם הסבר למה.
      </p>
      <div className="bg-gray-50 rounded-xl px-4 py-1 mb-4">
        {num("minRestHours", "מנוחה מינימלית בין משמרות", 0, 24, "שעות")}
        {num("maxConsecutiveHours", "מקסימום שעות רצופות", 4, 24, "שעות")}
        {num("maxShiftsPerWeek", "מקסימום משמרות בשבוע", 1, 14, "משמרות")}
        {num("maxNightsPerWeek", "מקסימום לילות בשבוע", 0, 7, "לילות")}
      </div>
      <div className="bg-gray-50 rounded-xl px-4 py-1">
        {toggle("allowMaybe", 'לשבץ גם מי שסימן "אולי"', "אחרת רק מי שסימן זמין במפורש")}
        {toggle("allowUnknown", "לשבץ גם מי שלא הגיש זמינות", "שימושי כשחלק מהצוות לא מילא")}
      </div>
      <div className="flex gap-2 mt-5">
        <Btn onClick={onClose} className="flex-1">שמור</Btn>
        <Btn variant="secondary" onClick={() => setRules(DEFAULT_RULES)}>אפס לברירת מחדל</Btn>
      </div>
    </Modal>
  );
}

function WhyModal({ entry, guard, shift, onClose }) {
  if (!entry) return null;
  const tone = scoreTone(entry.score);
  const positives = (entry.parts || []).filter((p) => p.points > 0);
  const negatives = (entry.parts || []).filter((p) => p.points < 0);
  const neutral = (entry.parts || []).filter((p) => p.points === 0);

  return (
    <Modal open onClose={onClose} title="למה דווקא הוא/היא?">
      <div className="flex items-center gap-3 mb-5">
        <Avatar id={guard?.id} name={guard?.name} size={48} />
        <div className="min-w-0">
          <p className="font-bold text-gray-900">{guard?.name}</p>
          <p className="text-xs text-gray-500">
            {shift?.label} · {formatDateHe(shift?.date)} · {shift?.startTime}–{shift?.endTime}
          </p>
        </div>
        <div className="mr-auto text-left">
          <p className="text-3xl font-black text-gray-900 leading-none">
            {entry.score}<span className="text-lg">%</span>
          </p>
          <Badge color={tone.color}>{tone.label}</Badge>
        </div>
      </div>

      <div className="space-y-1.5">
        {positives.map((p, i) => (
          <div key={i} className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-3.5 py-2.5">
            <span className="text-base">{kindIcon[p.kind] || "•"}</span>
            <span className="text-sm text-gray-700 flex-1">{p.label}</span>
            <span className="text-sm font-bold text-green-700">+{p.points}</span>
          </div>
        ))}
        {negatives.map((p, i) => (
          <div key={i} className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
            <span className="text-base">{kindIcon[p.kind] || "•"}</span>
            <span className="text-sm text-gray-700 flex-1">{p.label}</span>
            <span className="text-sm font-bold text-red-700">{p.points}</span>
          </div>
        ))}
        {neutral.map((p, i) => (
          <div key={i} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-3.5 py-2.5">
            <span className="text-base">{kindIcon[p.kind] || "•"}</span>
            <span className="text-sm text-gray-600 flex-1">{p.label}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        אחוז ההתאמה הוא סכום הנקודות למעלה ({entry.raw ?? "—"}) חלקי המקסימום האפשרי למשמרת מסוג זה.
        אילוצים קשיחים — מנוחה, שעות רצופות וזמינות — לא מנוקדים כלל: הם פוסלים מועמד על הסף,
        ולכן שיבוץ שמפר אותם פשוט לא נוצר.
      </p>
    </Modal>
  );
}

export default function SmartAssign({
  weekDates, shifts, guards, availability, onApply, onClear, busy,
}) {
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
  const shiftById = useMemo(() => new Map(weekShifts.map((s) => [s.id, s])), [weekShifts]);

  const submittedCount = useMemo(() => {
    const withAnswer = new Set();
    for (const g of guards) {
      if (weekShifts.some((s) => availStatus(availability, g.id, s.id) !== "unknown")) withAnswer.add(g.id);
    }
    return withAnswer.size;
  }, [guards, weekShifts, availability]);

  const run = () => {
    const result = autoAssign({
      shifts: weekShifts, guards, availability, rules, keepExisting: keepManual,
    });
    setPlan(result);
    setApplied(false);
  };

  const apply = async () => {
    await onApply(weekShifts.map((s) => s.id), plan.assignments);
    setApplied(true);
  };

  // ---------- guards / shifts missing ----------
  if (!guards.length) {
    return (
      <div className="space-y-6">
        <PageHeader title="שיבוץ חכם" subtitle="המנוע בונה סידור שבועי לפי זמינות, מנוחה והוגנות" />
        <EmptyState
          icon="👥" title="אין עדיין שומרים בצוות"
          body='כדי לשבץ צריך לפחות שומר אחד. הוסף שומרים במסך "הצוות שלי", או שתף איתם את קוד הצוות כדי שיצטרפו בעצמם.'
        />
      </div>
    );
  }

  if (!weekShifts.length) {
    return (
      <div className="space-y-6">
        <PageHeader title="שיבוץ חכם" subtitle="המנוע בונה סידור שבועי לפי זמינות, מנוחה והוגנות" />
        <EmptyState
          icon="📅" title="אין משמרות בשבוע הזה"
          body='צור משמרות במסך "ניהול משמרות" — יש שם כפתור שממלא שבוע שלם בלחיצה אחת — ואז חזור לכאן.'
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="שיבוץ חכם"
        subtitle={`${rangeLabelHe(weekDates)} · ${weekShifts.length} משמרות · ${guards.length} שומרים`}
        actions={
          <>
            <Btn variant="outline" onClick={() => setShowRules(true)}>⚙️ כללים</Btn>
            <Btn onClick={run} loading={busy} size="md">
              {plan ? "🔄 הרץ מחדש" : "⚡ הרץ שיבוץ חכם"}
            </Btn>
          </>
        }
      />

      {/* readiness */}
      <Card className="bg-gradient-to-l from-blue-50 to-white border-blue-100">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{submittedCount === guards.length ? "✅" : "ℹ️"}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800">
              {submittedCount} מתוך {guards.length} שומרים הגישו זמינות לשבוע הזה
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {submittedCount === guards.length
                ? "כל הצוות הגיש — השיבוץ יהיה מדויק ככל האפשר"
                : rules.allowUnknown
                ? "מי שלא הגיש עדיין ישובץ, אבל בעדיפות נמוכה. אפשר לשנות זאת בכללים."
                : 'לפי הכללים הנוכחיים מי שלא הגיש לא ישובץ כלל'}
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600 flex-shrink-0 cursor-pointer">
            <input
              type="checkbox" checked={keepManual} onChange={(e) => setKeepManual(e.target.checked)}
              className="w-4 h-4 accent-blue-600"
            />
            שמור שיבוצים ידניים
          </label>
        </div>
      </Card>

      {!plan ? (
        <EmptyState
          icon="⚡"
          title="מוכן לשבץ"
          body={`המנוע יעבור על ${weekShifts.length} המשמרות, יפסול כל מי שלא עומד באילוצים (זמינות, ${rules.minRestHours} שעות מנוחה, מקס' ${rules.maxConsecutiveHours} שעות רצוף), וידרג את השאר לפי הוגנות עומס וסבב לילות.`}
          action={<Btn size="lg" onClick={run} loading={busy}>⚡ הרץ שיבוץ חכם</Btn>}
        />
      ) : (
        <>
          {applied && (
            <Alert tone="success" onClose={() => setApplied(false)}>
              השיבוץ הוחל. אפשר לפרסם אותו לשומרים במסך "פרסום סידור".
            </Alert>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4">
              <p className="text-[11px] text-gray-500 font-semibold">כיסוי משמרות</p>
              <p className="text-3xl font-black text-gray-900 leading-tight">{plan.summary.coverage}%</p>
              <p className="text-[11px] text-gray-400 mb-2">
                {plan.summary.filledSlots}/{plan.summary.totalSlots} תקנים אוישו
              </p>
              <Meter value={plan.summary.coverage} color={plan.summary.coverage === 100 ? "#10B981" : "#F59E0B"} />
            </Card>
            <Card className="p-4">
              <p className="text-[11px] text-gray-500 font-semibold">ציון הוגנות</p>
              <p className="text-3xl font-black text-gray-900 leading-tight">{plan.summary.fairnessScore}</p>
              <p className="text-[11px] text-gray-400 mb-2">
                פער של {plan.fairness.spread} משמרות בין הכי עמוס לפנוי
              </p>
              <Meter value={plan.summary.fairnessScore} color="#8B5CF6" />
            </Card>
            <Card className="p-4">
              <p className="text-[11px] text-gray-500 font-semibold">משמרות פתוחות</p>
              <p className={`text-3xl font-black leading-tight ${plan.summary.openSlots ? "text-amber-600" : "text-green-600"}`}>
                {plan.summary.openSlots}
              </p>
              <p className="text-[11px] text-gray-400">
                {plan.summary.openSlots ? "דורשות טיפול ידני" : "הכל מאויש"}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] text-gray-500 font-semibold">החלטות המנוע</p>
              <p className="text-3xl font-black text-gray-900 leading-tight">{plan.assignments.length}</p>
              <p className="text-[11px] text-gray-400">
                {plan.summary.balanceMoves > 0 ? `כולל ${plan.summary.balanceMoves} העברות איזון` : "ללא צורך באיזון"}
              </p>
            </Card>
          </div>

          {/* actions */}
          <div className="flex flex-wrap gap-2 items-center">
            <Btn variant="success" size="lg" onClick={apply} loading={busy} disabled={applied}>
              {applied ? "✅ הוחל" : "החל את השיבוץ הזה"}
            </Btn>
            <Btn variant="outline" onClick={() => setPlan(null)}>בטל</Btn>
            <Btn variant="ghost" onClick={() => setShowLog((v) => !v)}>
              {showLog ? "הסתר" : "הצג"} יומן החלטות ({plan.log.length})
            </Btn>
            <span className="text-xs text-gray-400 mr-auto">
              שום דבר לא נשמר עד שתלחץ "החל"
            </span>
          </div>

          {showLog && (
            <Card className="bg-slate-900 border-slate-700 max-h-72 overflow-auto">
              <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-3">
                יומן ההחלטות של המנוע
              </p>
              <div className="space-y-1.5 font-mono text-[11px]">
                {plan.log.map((l, i) => (
                  <div key={i} className="flex gap-2 text-slate-300">
                    <span className="text-slate-600 w-6 flex-shrink-0">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-blue-400 flex-shrink-0">
                      {l.step === "assign" ? "ASSIGN" : l.step === "balance" ? "BALANCE" : "ORDER"}
                    </span>
                    <span className="flex-1">
                      {l.title} — {l.detail}
                      {l.runnerUp && <span className="text-slate-500"> · מקום שני: {l.runnerUp}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* workload */}
          <Card>
            <h2 className="font-bold text-gray-800 mb-1">חלוקת העומס המוצעת</h2>
            <p className="text-xs text-gray-500 mb-4">
              ממוצע של {plan.summary.targetPerGuard} משמרות לשומר
            </p>
            <div className="space-y-3">
              {plan.fairness.perGuard.map((p) => (
                <div key={p.guardId}>
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar id={p.guardId} name={p.name} size={26} />
                      <span className="text-sm font-medium text-gray-800 truncate">{p.name}</span>
                    </div>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {p.shifts} משמרות · {p.nights} לילות · {p.hours} ש'
                    </span>
                  </div>
                  <Meter
                    value={p.shifts}
                    max={Math.max(plan.fairness.max, 1)}
                    color={guardColor(p.guardId)}
                    height={7}
                  />
                </div>
              ))}
            </div>
          </Card>

          {/* proposed schedule */}
          <div>
            <h2 className="font-bold text-gray-800 mb-3">הסידור המוצע — לחץ על שומר כדי לראות למה נבחר</h2>
            <div className="space-y-4">
              {weekDates.map((date) => {
                const dayShifts = weekShifts.filter((s) => s.date === date);
                if (!dayShifts.length) return null;
                return (
                  <div key={date}>
                    <p className="text-xs font-bold text-gray-400 mb-2 border-b border-gray-100 pb-1">
                      {formatDateHe(date)}
                    </p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {dayShifts.map((shift) => {
                        const records = plan.detailByShift[shift.id] || [];
                        const need = Math.max(1, shift.requiredGuards || 1);
                        const short = records.length < need;
                        return (
                          <Card key={shift.id} className={`p-4 ${short ? "border-amber-300 bg-amber-50/40" : ""}`}>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ background: shift.color }}
                                />
                                <span className="font-bold text-sm text-gray-900 truncate">{shift.label}</span>
                              </div>
                              <Badge color={short ? "yellow" : "green"}>
                                {records.length}/{need}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-gray-400 mb-3">
                              {shift.startTime}–{shift.endTime} · 📍 {shift.location}
                            </p>
                            <div className="space-y-1.5">
                              {records.map((rec) => {
                                const g = guardById.get(rec.guardId);
                                const tone = scoreTone(rec.score);
                                return (
                                  <button
                                    key={rec.guardId}
                                    onClick={() => setWhy({ entry: rec, guard: g, shift })}
                                    className="w-full flex items-center gap-2 bg-gray-50 hover:bg-blue-50 border border-gray-100 hover:border-blue-200 rounded-lg px-2.5 py-2 transition-colors text-right"
                                  >
                                    <Avatar id={rec.guardId} name={g?.name} size={26} />
                                    <span className="text-xs font-medium text-gray-800 flex-1 truncate">
                                      {g?.name || "—"}
                                    </span>
                                    {rec.locked ? (
                                      <Badge color="gray">📌 ידני</Badge>
                                    ) : (
                                      <Badge color={tone.color}>{rec.score}% התאמה</Badge>
                                    )}
                                  </button>
                                );
                              })}
                              {short && (
                                <div className="text-[11px] text-amber-700 bg-amber-100/60 rounded-lg px-2.5 py-2">
                                  חסרים {need - records.length} — {explainUnfilled(
                                    plan.unfilled.find((u) => u.shiftId === shift.id)
                                  )}
                                </div>
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

          {/* unfilled detail */}
          {plan.unfilled.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/40">
              <h2 className="font-bold text-gray-800 mb-1">⚠️ משמרות שלא הצלחנו לאייש</h2>
              <p className="text-xs text-gray-500 mb-4">
                המנוע לא מפר אילוץ קשיח. הנה בדיוק מי נפסל ולמה — כך אפשר להחליט אם לשנות כלל או לדבר עם מישהו.
              </p>
              <div className="space-y-3">
                {plan.unfilled.map((u) => (
                  <div key={u.shiftId} className="bg-white rounded-xl p-3.5 border border-amber-100">
                    <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900">
                        {u.shift.label} · {shortDate(u.shift.date)} · {u.shift.startTime}–{u.shift.endTime}
                      </span>
                      <Badge color="yellow">חסרים {u.missing}</Badge>
                    </div>
                    <div className="space-y-1">
                      {u.blockers.slice(0, 6).map((b) => (
                        <div key={b.guardId} className="flex items-center gap-2 text-xs">
                          <Avatar id={b.guardId} name={b.name} size={20} />
                          <span className="text-gray-700 font-medium">{b.name}</span>
                          <span className="text-gray-400">—</span>
                          <span className="text-gray-500">{b.reason}</span>
                        </div>
                      ))}
                      {u.blockers.length > 6 && (
                        <p className="text-[11px] text-gray-400">ועוד {u.blockers.length - 6} שומרים…</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      <RulesPanel rules={rules} setRules={setRules} open={showRules} onClose={() => setShowRules(false)} />
      {why && <WhyModal {...why} onClose={() => setWhy(null)} />}
    </div>
  );
}
