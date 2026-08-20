// ============================================================
// One-click demo data.
//
// Builds a week that is deliberately *not* trivial to solve: a couple of
// guards are blocked on the busiest nights, one is on reserve duty midweek,
// and two shifts need double staffing. That way the smart assignment has
// something real to reason about instead of filling empty slots at random.
// ============================================================

import { supabase } from "./supabaseClient.js";
import { SHIFT_TONES } from "../design/shiftPalette.js";
import { weekByOffset } from "./dates.js";
import { shiftFromRow } from "./api.js";

const DEMO_GUARDS = [
  { name: "גיא לוי", phone: "050-1234567" },
  { name: "מיכל כהן", phone: "052-2345678" },
  { name: "אבי ישראלי", phone: "054-3456789" },
  { name: "רינה שמיר", phone: "058-4567890" },
  { name: "דן מזרחי", phone: "050-5678901" },
  { name: "נועה ברק", phone: "053-6789012" },
];

const DAY = { label: "משמרת יום", startTime: "07:00", endTime: "19:00", type: "morning", color: SHIFT_TONES.morning };
const NIGHT = { label: "משמרת לילה", startTime: "19:00", endTime: "07:00", type: "night", color: SHIFT_TONES.night };

/**
 * Availability pattern, indexed by guard order and day index.
 * a = available, u = unavailable, m = maybe, ? = never submitted.
 * Two guards are left partially blank on purpose so the supervisor can see
 * how the engine treats "no answer" differently from "available".
 */
const PATTERN = {
  //         day:  0    1    2    3    4    5    6
  0: { day: ["a", "a", "a", "u", "a", "a", "m"], night: ["u", "a", "a", "u", "a", "m", "a"] },
  1: { day: ["a", "u", "a", "a", "a", "m", "a"], night: ["u", "u", "a", "a", "a", "a", "m"] },
  2: { day: ["m", "a", "a", "a", "u", "a", "a"], night: ["u", "a", "m", "a", "a", "a", "a"] },
  3: { day: ["a", "a", "u", "u", "u", "a", "a"], night: ["a", "a", "u", "u", "u", "a", "a"] },
  4: { day: ["a", "a", "a", "a", "a", "u", "u"], night: ["a", "m", "a", "a", "a", "u", "u"] },
  5: { day: ["?", "?", "a", "a", "a", "a", "?"], night: ["?", "?", "a", "a", "m", "a", "?"] },
};

const COMMENTS = {
  "3-2": "מילואים",
  "3-3": "מילואים",
  "3-4": "מילואים",
  "0-3": "אירוע משפחתי",
  "4-5": "חתונה של אחותי",
};

const STATUS = { a: "available", u: "unavailable", m: "maybe" };

/**
 * Seeds guards + next week's shifts + availability for a team.
 * Safe to re-run: it only adds what is missing.
 */
export async function seedDemoTeam({ teamCode, existingGuards = [], existingShifts = [] }) {
  const dates = weekByOffset(1);

  // מה שכבר יושב בצוות נקרא **מכאן**, ולא רק ממה שהקורא מסר.
  //
  // `gs_create_team` אידמפוטנטית בכוונה: משתמש שכבר יש לו פרופיל מקבל בחזרה
  // את הצוות הקיים שלו במקום צוות חדש. לכן "פתח הדגמה" בפעם השנייה הגיע
  // לכאן עם צוות מלא ועם `existingGuards: []`, ניסה להכניס שוב את אותם שישה
  // שומרים, ונפל על `gs_profiles_one_name_per_team`. ההבטחה שבתיעוד למעלה
  // ("safe to re-run") הייתה תלויה בכך שכל קורא יזכור למסור את המצב — וזו
  // הבטחה שאי אפשר לקיים. עכשיו היא נכונה מעצם המבנה.
  const [rosterRes, weekRes] = await Promise.all([
    // `role = 'guard'` ו-`order` שניהם נדרשים ולא קוסמטיים: פרופיל המנהל
    // היה נספר כשומר ומזיז את כל אינדקסי `PATTERN` באחד, וסדר שאינו מובטח
    // היה נותן דפוס זמינות אחר בכל הרצה — בדיוק הדבר שהמוצר מבטיח שלא קורה.
    supabase
      .from("gs_profiles")
      .select("id, full_name")
      .eq("team_code", teamCode)
      .eq("role", "guard")
      .order("created_at"),
    supabase
      .from("gs_shifts")
      .select("*, gs_assignments(guard_id, source, score, reason)")
      .eq("team_code", teamCode)
      .in("date", dates),
  ]);
  if (rosterRes.error) throw new Error(`קריאת הצוות נכשלה: ${rosterRes.error.message}`);
  if (weekRes.error) throw new Error(`קריאת השבוע נכשלה: ${weekRes.error.message}`);

  const knownGuards = mergeById(
    existingGuards.map((g) => ({ id: g.id, name: g.name })),
    (rosterRes.data || []).map((r) => ({ id: r.id, name: r.full_name }))
  );
  const knownShifts = mergeById(existingShifts, (weekRes.data || []).map(shiftFromRow));

  // ---- guards ----
  const have = new Set(knownGuards.map((g) => g.name.trim()));
  const toAdd = DEMO_GUARDS.filter((g) => !have.has(g.name));
  let guardRows = [];
  if (toAdd.length) {
    const { data, error } = await supabase
      .from("gs_profiles")
      .insert(toAdd.map((g) => ({
        full_name: g.name, phone: g.phone, role: "guard", team_code: teamCode,
      })))
      .select();
    if (error) throw new Error(`יצירת שומרי הדגמה נכשלה: ${error.message}`);
    guardRows = data || [];
  }

  const allGuards = [
    ...knownGuards.map((g) => ({ id: g.id, full_name: g.name })),
    ...guardRows.map((r) => ({ id: r.id, full_name: r.full_name })),
  ];

  // ---- shifts ----
  const alreadyCovered = new Set(knownShifts.map((s) => `${s.date}|${s.startTime}`));
  const shiftPayload = [];
  dates.forEach((date, i) => {
    for (const tpl of [DAY, NIGHT]) {
      if (alreadyCovered.has(`${date}|${tpl.startTime}`)) continue;
      shiftPayload.push({
        team_code: teamCode,
        date,
        label: tpl.label,
        start_time: tpl.startTime,
        end_time: tpl.endTime,
        type: tpl.type,
        color: tpl.color,
        location: "כניסה ראשית",
        // Thursday and Friday nights are the busy ones — they need two guards.
        required_guards: tpl.type === "night" && (i === 4 || i === 5) ? 2 : 1,
      });
    }
  });

  let shiftRows = [];
  if (shiftPayload.length) {
    const { data, error } = await supabase
      .from("gs_shifts").insert(shiftPayload)
      .select("*, gs_assignments(guard_id, source, score, reason)");
    if (error) throw new Error(`יצירת משמרות הדגמה נכשלה: ${error.message}`);
    shiftRows = data || [];
  }

  const shifts = [...knownShifts, ...shiftRows.map(shiftFromRow)];

  // ---- availability ----
  const byDate = new Map();
  for (const s of shifts) {
    if (!byDate.has(s.date)) byDate.set(s.date, {});
    byDate.get(s.date)[s.type === "night" ? "night" : "day"] = s;
  }

  const availRows = [];
  allGuards.forEach((guard, gi) => {
    const pattern = PATTERN[gi];
    if (!pattern) return;
    dates.forEach((date, di) => {
      const slots = byDate.get(date);
      if (!slots) return;
      for (const kind of ["day", "night"]) {
        const shift = slots[kind];
        const code = pattern[kind][di];
        if (!shift || code === "?") continue;
        availRows.push({
          shift_id: shift.id,
          guard_id: guard.id,
          status: STATUS[code],
          comment: COMMENTS[`${gi}-${di}`] || null,
        });
      }
    });
  });

  if (availRows.length) {
    const { error } = await supabase
      .from("gs_availability").upsert(availRows, { onConflict: "shift_id,guard_id" });
    if (error) throw new Error(`הגשות זמינות ההדגמה נכשלו: ${error.message}`);
  }

  return {
    guardsAdded: guardRows.length,
    shiftsAdded: shiftRows.length,
    availabilityAdded: availRows.length,
    weekStart: dates[0],
  };
}

/** איחוד לפי מזהה, כשהראשון מנצח. שומר על סדר יציב. */
function mergeById(primary, extra) {
  const seen = new Set(primary.map((x) => x.id));
  return [...primary, ...extra.filter((x) => !seen.has(x.id))];
}
