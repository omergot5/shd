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
