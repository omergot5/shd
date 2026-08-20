// ============================================================
// מסך "השבוע" — הלב של חוויית האחמ"ש.
//
// לפני המסך הזה היו חמישה פריטי תפריט נפרדים: ניהול משמרות, זמינות,
// שיבוץ חכם, שיבוץ ידני, פרסום. כל אחד מהם היה נכון, ואף אחד מהם לא אמר
// למשתמש *מה הצעד הבא*. אדם שנכנס בפעם הראשונה היה צריך שמישהו יסביר לו
// באיזה סדר ללחוץ — וזה בדיוק הדבר שהמוצר הזה מבטיח שלא יקרה.
//
// כאן זה מסך אחד עם ארבעה שלבים. פס השלבים הוא גם הניווט וגם הסטטוס:
// כל שלב מציג את המספר שלו (כמה משמרות, כמה הגישו, כמה מאוישות, כמה
// פורסמו), אז המשתמש רואה איפה הוא עומד בלי לפתוח כלום.
//
// עיקרון: השלבים *עוטפים* את הרכיבים הקיימים ולא משכתבים אותם. ShiftMgmt
// ו-ScheduleMgmt לא יודעים שהם חיים בתוך זרימה. זה גם מה שיאפשר לפרופיל
// הצבאי באבן דרך ב' להשמיט את שלב 2 — שם המפקד קובע ולא אוספים זמינות —
// בלי לגעת באף רכיב.
// ============================================================

import { useMemo, useState } from "react";
import { PrimaryAction, Segmented } from "../ui.jsx";
import { Icon } from "../icons.jsx";
import SmartAssign from "../SmartAssign.jsx";
import { ShiftMgmt, AvailView, AssignView, ScheduleMgmt } from "./views.jsx";
import { availStatus } from "../../lib/autoAssign.js";
import { t } from "../../lib/terms.js";

/** מזהי הניווט הישנים ממשיכים לעבוד — כל אחד נופל לשלב שלו. */
export const STEP_OF = {
  shifts: 0,
  availability: 1,
  smart: 2,
  assignment: 2,
  assign: 2,
  schedule: 3,
  publish: 3,
};

export default function WeekFlow({
  step, setStep, guards, shifts, availability, weekDates, actions, busy, onNavigate,
}) {
  // ברירת המחדל היא השיבוץ האוטומטי. הידני יושב לצידו בתוך אותו שלב — הוא
  // תיקון של התוצאה, לא מסך מתחרה.
  const [assignMode, setAssignMode] = useState("auto");

  const weekShifts = useMemo(
    () => shifts.filter((s) => weekDates.includes(s.date)),
    [shifts, weekDates]
  );

  // כמה אנשים ענו משהו על השבוע הזה. "הגיש" = נגע לפחות במשמרת אחת.
  const submitted = useMemo(() => {
    let n = 0;
    for (const g of guards) {
      if (weekShifts.some((s) => availStatus(availability, g.id, s.id) !== "unknown")) n++;
    }
    return n;
  }, [guards, weekShifts, availability]);

  // איוש נמדד במקומות ולא במשמרות: משמרת שדורשת שניים ויש בה אחד היא חצי
  // מאוישת, ולהציג אותה כ"לא מאוישת" מסתיר בדיוק כמה חסר.
  const slots = useMemo(() => {
    let need = 0;
    let filled = 0;
    for (const s of weekShifts) {
      const req = Math.max(1, s.requiredGuards || 1);
      need += req;
      filled += Math.min(req, (s.assignedGuards || []).length);
    }
    return { need, filled };
  }, [weekShifts]);

  const published = weekShifts.filter((s) => s.published).length;
  const hasShifts = weekShifts.length > 0;

  const meta = [
    {
      label: t("nav.shifts"),
      count: hasShifts ? String(weekShifts.length) : null,
      done: hasShifts,
    },
    {
      label: t("nav.availability"),
      count: guards.length ? `${submitted}/${guards.length}` : null,
      done: guards.length > 0 && submitted === guards.length,
    },
    {
      label: t("nav.smart"),
      count: slots.need ? `${slots.filled}/${slots.need}` : null,
      done: slots.need > 0 && slots.filled >= slots.need,
    },
    {
      label: t("nav.schedule"),
      count: hasShifts ? `${published}/${weekShifts.length}` : null,
      done: hasShifts && published === weekShifts.length,
    },
  ];

  // `embedded` אומר לרכיב שכותרת המסך כבר נאמרה — פס השלבים הוא הכותרת.
  const common = { guards, shifts, availability, weekDates, actions, busy, onNavigate, embedded: true };

  const body = [
    <ShiftMgmt key="shifts" {...common} />,
    <AvailView key="avail" {...common} />,
    <div key="assign" className="space-y-5">
      <Segmented
        value={assignMode}
        onChange={setAssignMode}
        options={[
          { value: "auto", label: "תסדר לי", icon: "zap" },
          { value: "manual", label: "אסדר בעצמי", icon: "users" },
        ]}
      />
      {assignMode === "auto" ? (
        <SmartAssign
          weekDates={weekDates}
          shifts={shifts}
          guards={guards}
          availability={availability}
          busy={busy}
          embedded
          onApply={(ids, assignments) => actions.applyPlan(ids, assignments)}
        />
      ) : (
        <AssignView {...common} onNavigate={() => setAssignMode("auto")} />
      )}
    </div>,
    <ScheduleMgmt key="publish" {...common} />,
  ][step];

  // הפעולה הראשית של כל שלב. בשלושת הראשונים היא "סיימתי כאן, קדימה"; רק
  // בשלב האחרון היא פעולה אמיתית על הנתונים — וזה מכוון, כי פרסום הוא
  // הרגע היחיד בזרימה שהצוות מרגיש.
  const action = [
    {
      children: "בניתי את השבוע — מי הגיש?",
      icon: "left",
      onClick: () => setStep(1),
      disabled: !hasShifts,
      hint: hasShifts
        ? `${weekShifts.length} משמרות בשבוע הזה`
        : "צריך לפחות משמרת אחת כדי להמשיך",
    },
    {
      children: "סדר לי את השבוע",
      icon: "zap",
      onClick: () => {
        setAssignMode("auto");
        setStep(2);
      },
      disabled: !hasShifts || guards.length === 0,
      hint:
        guards.length === 0
          ? "אין עדיין אנשים בצוות"
          : submitted === guards.length
            ? "כולם הגישו — אפשר לשבץ"
            : `${guards.length - submitted} עוד לא הגישו. אפשר לשבץ בלעדיהם.`,
    },
    {
      children: "הסידור מוכן — לשלוח לצוות",
      icon: "left",
      onClick: () => setStep(3),
      disabled: slots.filled === 0,
      hint:
        slots.filled === 0
          ? "עוד לא שובץ אף אחד"
          : slots.filled < slots.need
            ? `${slots.need - slots.filled} מקומות עדיין פתוחים — אפשר לשלוח בכל זאת`
            : "כל המקומות מאוישים",
    },
    {
      children: hasShifts && published === weekShifts.length ? "הסידור אצל הצוות" : "שלח לצוות",
      icon: "send",
      variant: "accent",
      onClick: () => actions.publish(weekShifts.map((s) => s.id), true),
      loading: busy,
      disabled: !hasShifts || published === weekShifts.length,
      hint: !hasShifts
        ? "אין מה לשלוח"
        : published === weekShifts.length
          ? "כל המשמרות פורסמו. כל שינוי כאן יופיע אצלם מיד."
          : "אחרי השליחה כל אחד רואה בטלפון את התורנויות שלו",
    },
  ][step];

  return (
    <div className="space-y-5">
      {/* פס השלבים — ניווט וסטטוס באותו רכיב, כדי שלא יהיו שני מקורות אמת
        * לשאלה "איפה אני עומד".
        *
        * נדבק לראש הגלילה בכוונה: שלב "בניית השבוע" ארוך משבעה ימים, ואם
        * הפס נגלל החוצה המשתמש נשאר באמצע מסך בלי דרך לראות איפה הוא עומד
        * או לעבור הלאה. ההיצמדות היא מינוס־ריפוד ההורה, כדי שלא ייפתח פס
        * שקוף מעליו שדרכו נראה התוכן עובר. */}
      <ol
        className="sticky -top-3 lg:-top-6 z-20 flex gap-2 overflow-x-auto
          -mx-3 px-3 pt-3 pb-2 lg:-mx-6 lg:px-6 lg:pt-6 bg-bg/90 backdrop-blur-md"
      >
        {meta.map((s, i) => {
          const active = i === step;
          return (
            <li key={s.label} className="flex-1 min-w-[9.5rem]">
              <button
                onClick={() => setStep(i)}
                aria-current={active ? "step" : undefined}
                // הכיתוב הנראה הוא "1 · בניית השבוע · 14" — שלושה חלקים שקוראים
                // יחד כג'יבריש בהקראה. השם הנגיש אומר אותו דבר במשפט.
                aria-label={`שלב ${i + 1}: ${s.label}${s.count ? ` — ${s.count}` : ""}${
                  s.done ? " — הושלם" : ""
                }`}
                className={`w-full h-full text-right rounded-2xl px-3.5 py-3 ring-1 ring-inset
                  cursor-pointer transition-[background,box-shadow] duration-200 ${
                    active
                      ? "bg-brand/15 ring-brand/40"
                      : "bg-surface-sunken ring-hairline hover:bg-surface-hover hover:ring-hairline-strong"
                  }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                      s.done
                        ? "bg-accent text-on-accent"
                        : active
                          ? "bg-brand text-on-brand"
                          : "bg-surface ring-1 ring-inset ring-hairline text-muted"
                    }`}
                  >
                    {s.done ? <Icon name="check" size={13} strokeWidth={2.5} /> : i + 1}
                  </span>
                  <span
                    className={`text-[13px] font-bold truncate ${active ? "text-content" : "text-muted"}`}
                  >
                    {s.label}
                  </span>
                </span>
                <span className="block text-[11px] text-faint mt-1 pr-8" data-numeric>
                  {s.count ?? "—"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {body}

      <PrimaryAction {...action} />
    </div>
  );
}
