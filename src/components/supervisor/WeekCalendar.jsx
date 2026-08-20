// ============================================================
// תצוגת שבוע — שעות בציר האנכי, ימים בציר האופקי.
//
// **הפיצ'ר כאן הוא לא הרשת, אלא החורים.** רשימה של משמרות מראה מה קיים;
// רק פריסה על ציר זמן מראה מה *חסר* — ומשבצת שדורשת שני אנשים ויש בה
// אחד היא בדיוק מה שמתפוצץ בשטח ביום שישי בערב.
//
// למה בלי ספרייה: `react-big-calendar` ו-`FullCalendar` שניהם חלשים ב-RTL,
// מביאים כמה מאות קילובייטים, ולא מכירים את הטוקנים שלנו — כלומר היו
// נראים כמו רכיב מודבק מאפליקציה אחרת. רשת שעות היא CSS Grid, וזה כל
// הסיפור. מה שכן היה קשה — משמרת שחוצה חצות — לא היה נפתר על ידן בכל מקרה.
// ============================================================

import { useMemo, useState } from "react";
import { DAYS_HE_SHORT, isToday, minutesOfTime, shortDate } from "../../lib/dates.js";
import { shiftTone } from "../../design/shiftPalette.js";
import { Badge, Btn, Card, EmptyState, readableInk } from "../ui.jsx";
import { Icon } from "../icons.jsx";

const HOUR_PX = 38;
const DAY_MIN = 24 * 60;

/**
 * משמרת אחת הופכת לקטע אחד או שניים.
 *
 * משמרת לילה שמסתיימת למחרת היא ישות אחת בנתונים אבל שני מלבנים על המסך.
 * הפיצול נעשה כאן ולא בציור, כדי שהקטע השני יידע שהוא המשך ולא התחלה —
 * אחרת היו נראים על הלוח שני לילות במקום אחד.
 */
function segmentsOf(shift, dayIndexOf) {
  const start = minutesOfTime(shift.startTime);
  const end = minutesOfTime(shift.endTime);
  const day = dayIndexOf(shift.date);
  if (day < 0) return [];

  if (end > start) return [{ shift, day, from: start, to: end, tail: false }];

  // חוצה חצות: עד סוף היום, וההמשך בעמודה הבאה אם היא בכלל בשבוע הזה.
  const out = [{ shift, day, from: start, to: DAY_MIN, tail: false }];
  if (end > 0 && day + 1 < 7) out.push({ shift, day: day + 1, from: 0, to: end, tail: true });
  return out;
}

const missingOf = (shift) =>
  Math.max(0, (shift.requiredGuards || 1) - (shift.assignedGuards?.length || 0));

export default function WeekCalendar({ dates, shifts, guards, onOpenShift }) {
  const [holesOnly, setHolesOnly] = useState(false);

  const dayIndexOf = useMemo(() => {
    const map = new Map(dates.map((d, i) => [d, i]));
    return (iso) => (map.has(iso) ? map.get(iso) : -1);
  }, [dates]);

  const weekShifts = useMemo(
    () => shifts.filter((s) => dayIndexOf(s.date) >= 0),
    [shifts, dayIndexOf]
  );

  const holes = useMemo(
    () => weekShifts.filter((s) => missingOf(s) > 0),
    [weekShifts]
  );
  const missingTotal = holes.reduce((a, s) => a + missingOf(s), 0);

  const segments = useMemo(() => {
    const source = holesOnly ? holes : weekShifts;
    return source.flatMap((s) => segmentsOf(s, dayIndexOf));
  }, [holesOnly, holes, weekShifts, dayIndexOf]);

  const byDay = useMemo(() => {
    const cols = Array.from({ length: 7 }, () => []);
    for (const seg of segments) cols[seg.day].push(seg);
    // מיון לפי שעת התחלה כדי שחפיפות ייפרסו בסדר קבוע ולא לפי סדר השליפה.
    for (const col of cols) col.sort((a, b) => a.from - b.from || a.to - b.to);
    return cols;
  }, [segments]);

  const nameOf = useMemo(() => {
    const map = new Map(guards.map((g) => [g.id, g.name]));
    return (id) => map.get(id) || "";
  }, [guards]);

  if (!weekShifts.length) {
    return (
      <Card>
        <EmptyState
          icon="calendar"
          title="אין משמרות בשבוע הזה"
          body="בנה את השבוע או מלא אותו מתבנית, והלוח ייבנה מעצמו."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ---- שורת המצב: הדבר הראשון שהעין פוגשת ---- */}
      <div className="flex items-center gap-3 flex-wrap">
        {missingTotal > 0 ? (
          <button
            onClick={() => setHolesOnly((v) => !v)}
            aria-pressed={holesOnly}
            className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 ring-1 ring-inset cursor-pointer
              transition-colors ${
                holesOnly
                  ? "bg-warn text-on-brand ring-warn"
                  : "bg-warn/10 text-warn ring-warn/30 hover:bg-warn/15"
              }`}
          >
            <Icon name="alert" size={17} />
            <span className="font-bold">
              {missingTotal} מקומות לא מאוישים
            </span>
            <span className="text-xs opacity-80">
              {holesOnly ? "הצג הכול" : "הצג רק אותם"}
            </span>
          </button>
        ) : (
          <Badge tone="accent" icon="check-circle">כל המשמרות מאוישות</Badge>
        )}

        <div className="flex-1" />

        <Btn variant="ghost" icon="down" onClick={() => window.print()}>
          הדפס / שמור PDF
        </Btn>
      </div>

      {/* ---- הרשת ---- */}
      {/* דיב מפורש ולא <Card>: ל-Card יש p-5 משלו, ו-p-0 מבחוץ מפסיד לו בקסקדה. */}
      <div className="glass rounded-2xl overflow-hidden print-sheet">
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            {/* כותרות הימים */}
            <div
              className="grid sticky top-0 z-20 bg-surface/95 backdrop-blur
                border-b border-hairline"
              style={{ gridTemplateColumns: `3.25rem repeat(7, minmax(0, 1fr))` }}
            >
              <div />
              {dates.map((iso, i) => (
                <div
                  key={iso}
                  className={`px-1 py-2 text-center border-r border-hairline ${
                    isToday(iso) ? "bg-brand/10" : ""
                  }`}
                >
                  <div className={`text-xs font-bold ${isToday(iso) ? "text-brand" : "text-content"}`}>
                    {DAYS_HE_SHORT[i]}
                  </div>
                  <div className="text-[11px] text-faint tabular-nums">{shortDate(iso)}</div>
                </div>
              ))}
            </div>

            {/* גוף הלוח */}
            <div
              className="grid relative"
              style={{ gridTemplateColumns: `3.25rem repeat(7, minmax(0, 1fr))` }}
            >
              {/* ציר השעות */}
              <div className="relative" style={{ height: 24 * HOUR_PX }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    key={h}
                    className="absolute right-0 left-0 text-[11px] text-faint tabular-nums
                      text-center -translate-y-1/2"
                    style={{ top: h * HOUR_PX }}
                  >
                    {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
                  </div>
                ))}
              </div>

              {byDay.map((col, day) => (
                <div
                  key={dates[day]}
                  className={`relative border-r border-hairline ${
                    isToday(dates[day]) ? "bg-brand/[0.04]" : ""
                  }`}
                  style={{ height: 24 * HOUR_PX }}
                >
                  {/* קווי השעות */}
                  {Array.from({ length: 24 }, (_, h) => (
                    <div
                      key={h}
                      className="absolute inset-x-0 border-t border-hairline/60"
                      style={{ top: h * HOUR_PX }}
                    />
                  ))}

                  {col.map((seg, i) => (
                    <Block
                      key={`${seg.shift.id}-${seg.tail ? "b" : "a"}`}
                      seg={seg}
                      lane={i}
                      lanes={col.length}
                      nameOf={nameOf}
                      onOpen={onOpenShift}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {holesOnly && !holes.length && (
        <p className="text-sm text-muted text-center">אין חורים בשבוע הזה.</p>
      )}
    </div>
  );
}

/**
 * מלבן אחד על הלוח.
 *
 * חור מסומן **פעמיים**: פסים אלכסוניים ומסגרת אזהרה. סימון יחיד בצבע בלבד
 * לא נקרא אצל מי שלא מבחין בצבעים, וזו בדיוק המשבצת שאסור לפספס.
 */
function Block({ seg, lane, lanes, nameOf, onOpen }) {
  const { shift, from, to, tail } = seg;
  const missing = missingOf(shift);
  const bg = shiftTone(shift.color, shift.type);
  const ink = readableInk(bg);
  const height = Math.max(((to - from) / 60) * HOUR_PX - 2, 20);

  // חפיפות נפרסות לרוחב. עמודה עם משמרת אחת נשארת ברוחב מלא.
  const width = lanes > 1 ? `calc(${100 / Math.min(lanes, 3)}% - 3px)` : "calc(100% - 4px)";
  const offset = lanes > 1 ? `calc(${(lane % 3) * (100 / Math.min(lanes, 3))}% + 2px)` : "2px";

  const names = (shift.assignedGuards || []).map(nameOf).filter(Boolean);
  const compact = height < 46;

  return (
    <button
      type="button"
      onClick={onOpen ? () => onOpen(shift) : undefined}
      title={`${shift.label} · ${shift.startTime}–${shift.endTime}${
        missing ? ` · חסרים ${missing}` : ""
      }`}
      className={`absolute rounded-lg px-1.5 py-1 text-right overflow-hidden
        ring-1 ring-inset transition-shadow text-[11px] leading-tight
        ${onOpen ? "cursor-pointer hover:shadow-lg" : "cursor-default"}
        ${missing ? "ring-2 ring-warn" : "ring-black/10"}`}
      style={{
        top: (from / 60) * HOUR_PX + 1,
        height,
        insetInlineStart: offset,
        width,
        background: missing
          ? // פסים על גבי צבע המשמרת: הצבע עדיין אומר איזו משמרת זו,
            // והפסים אומרים שהיא לא שלמה.
            `repeating-linear-gradient(45deg, ${bg}, ${bg} 6px,
               rgb(var(--warn) / 0.55) 6px, rgb(var(--warn) / 0.55) 12px)`
          : bg,
        color: ink,
      }}
    >
      <span className="flex items-center gap-1 font-bold">
        {missing > 0 && <Icon name="alert" size={11} />}
        <span className="truncate">
          {tail ? "המשך " : ""}
          {shift.label}
        </span>
      </span>
      {!compact && (
        <span className="block tabular-nums opacity-85">
          {shift.startTime}–{shift.endTime}
        </span>
      )}
      {!compact && missing > 0 && (
        <span className="block font-bold">חסרים {missing}</span>
      )}
      {!compact && !missing && names.length > 0 && (
        <span className="block truncate opacity-90">{names.join(" · ")}</span>
      )}
    </button>
  );
}
