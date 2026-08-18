// ============================================================
// Date helpers
//
// Everything in the app speaks "YYYY-MM-DD" local dates. We never round-trip
// through toISOString() for a calendar date — that converts to UTC and shifts
// Israel (UTC+2/+3) back a day for anything before 02:00/03:00 local.
// ============================================================

export const DAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
export const DAYS_HE_SHORT = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];
export const MONTHS_HE = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

/** Local calendar date of a Date object as YYYY-MM-DD. */
export const toISODate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** Parse YYYY-MM-DD as a local Date at noon (immune to DST edges). */
export const fromISODate = (iso) => new Date(`${iso}T12:00:00`);

export const todayISO = () => toISODate(new Date());

/**
 * When availability for a week closes. Stored on the team as an offset rather
 * than a date so it recurs every week with nobody maintaining it.
 *
 * Both sides must agree on this or the guard is told one thing and locked out
 * by another, so it lives here and is imported by guard and supervisor alike.
 */
/**
 * Six full weeks covering a month, Sunday-first and always 42 cells. A grid
 * that changes height between months makes the surrounding layout jump, so
 * the trailing days of the neighbouring months are included rather than
 * padded with blanks.
 */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = addDays(toISODate(first), -first.getDay());
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export const monthLabelHe = (year, month) => `${MONTHS_HE[month]} ${year}`;

export const DEADLINE_DEFAULTS = { days: 3, hour: 14 };

export function availabilityDeadline(weekStartISO, team) {
  const days = team?.deadlineDays ?? DEADLINE_DEFAULTS.days;
  const hour = team?.deadlineHour ?? DEADLINE_DEFAULTS.hour;
  const d = fromISODate(addDays(weekStartISO, -days));
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** "עוד יומיים ו-3 שעות" / "עבר לפני 5 שעות" — never a bare timestamp. */
export function countdownHe(target, now = new Date()) {
  const ms = target - now;
  const past = ms < 0;
  const mins = Math.floor(Math.abs(ms) / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const parts = [];
  if (days) parts.push(days === 1 ? "יום" : days === 2 ? "יומיים" : `${days} ימים`);
  if (hours && days < 3) parts.push(hours === 1 ? "שעה" : hours === 2 ? "שעתיים" : `${hours} שעות`);
  if (!parts.length) parts.push(mins <= 1 ? "פחות מדקה" : `${mins} דקות`);
  const span = parts.join(" ו-");
  return past ? `עבר לפני ${span}` : `עוד ${span}`;
}

export const addDays = (iso, n) => {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

export const diffInDays = (isoA, isoB) =>
  Math.round((fromISODate(isoA) - fromISODate(isoB)) / 86400000);

/** Sunday of the week containing `iso` (Israeli week starts Sunday). */
export const startOfWeek = (iso = todayISO()) => addDays(iso, -fromISODate(iso).getDay());

/** The 7 dates of the week starting at `sundayISO`. */
export const weekFrom = (sundayISO) => Array.from({ length: 7 }, (_, i) => addDays(sundayISO, i));

/** The week `offset` weeks away from the current one. offset 0 = this week. */
export const weekByOffset = (offset = 0) => weekFrom(addDays(startOfWeek(), offset * 7));

export const dayName = (iso) => DAYS_HE[fromISODate(iso).getDay()];

export const formatDateHe = (iso) => {
  const d = fromISODate(iso);
  return `יום ${DAYS_HE[d.getDay()]}, ${d.getDate()} ב${MONTHS_HE[d.getMonth()]}`;
};

export const shortDate = (iso) => {
  const d = fromISODate(iso);
  return `${DAYS_HE_SHORT[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
};

export const rangeLabelHe = (dates) => {
  if (!dates?.length) return "";
  const a = fromISODate(dates[0]);
  const b = fromISODate(dates[dates.length - 1]);
  const sameMonth = a.getMonth() === b.getMonth();
  return sameMonth
    ? `${a.getDate()}–${b.getDate()} ב${MONTHS_HE[b.getMonth()]}`
    : `${a.getDate()} ב${MONTHS_HE[a.getMonth()]} – ${b.getDate()} ב${MONTHS_HE[b.getMonth()]}`;
};

export const isPast = (iso) => iso < todayISO();
export const isToday = (iso) => iso === todayISO();

/** "07:00" -> 420 (minutes past midnight) */
export const minutesOfTime = (hhmm) => {
  const [h, m] = String(hhmm).slice(0, 5).split(":").map(Number);
  return h * 60 + (m || 0);
};

/** Absolute start/end timestamps for a shift, unwrapping overnight shifts. */
export const shiftInterval = (shift) => {
  const base = fromISODate(shift.date).setHours(0, 0, 0, 0);
  const start = base + minutesOfTime(shift.startTime) * 60000;
  let end = base + minutesOfTime(shift.endTime) * 60000;
  if (end <= start) end += 24 * 3600 * 1000; // crosses midnight
  return { start, end };
};

export const shiftHours = (shift) => {
  const { start, end } = shiftInterval(shift);
  return (end - start) / 3600000;
};
