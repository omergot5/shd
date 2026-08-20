// Standalone sanity check for the assignment engine.
//   node scripts/verify-scheduler.mjs
//
// Asserts the hard constraints actually hold on a generated week, and prints
// the coverage/fairness numbers so regressions are obvious.

import { autoAssign, checkAssignment, DEFAULT_RULES, shiftLoad } from "../src/lib/autoAssign.js";
import { shiftInterval, weekByOffset } from "../src/lib/dates.js";

const HOUR = 3600000;
let failures = 0;

const check = (label, cond, extra = "") => {
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

// ---------- fixture ----------
const dates = weekByOffset(1);
const guards = [
  { id: "g1", name: "גיא לוי" },
  { id: "g2", name: "מיכל כהן" },
  { id: "g3", name: "אבי ישראלי" },
  { id: "g4", name: "רינה שמיר" },
  { id: "g5", name: "דן מזרחי" },
];

const shifts = [];
dates.forEach((date, i) => {
  shifts.push({
    id: `d${i}`, date, label: "משמרת יום", type: "morning",
    startTime: "07:00", endTime: "19:00", requiredGuards: 1, assignedGuards: [],
  });
  shifts.push({
    id: `n${i}`, date, label: "משמרת לילה", type: "night",
    startTime: "19:00", endTime: "07:00", requiredGuards: 1, assignedGuards: [],
  });
});

// Everyone available by default; carve out some real-world unavailability.
const availability = {};
for (const g of guards) {
  for (const s of shifts) availability[`${g.id}-${s.id}`] = { status: "available" };
}
availability["g1-n0"] = { status: "unavailable", comment: "אירוע משפחתי" };
availability["g2-n0"] = { status: "unavailable" };
availability["g3-n0"] = { status: "unavailable" };
availability["g4-d3"] = { status: "unavailable" };
availability["g5-d3"] = { status: "maybe" };

// ---------- run ----------
const result = autoAssign({ shifts, guards, availability });
const rules = result.rules;

console.log("\n=== summary ===");
console.log(result.summary);
console.log("\n=== load per guard ===");
for (const p of result.fairness.perGuard) {
  console.log(`  ${p.name.padEnd(12)} ${String(p.shifts).padStart(2)} משמרות · ${p.nights} לילות · ${p.hours} שעות`);
}

// ---------- assertions ----------
console.log("\n=== hard constraints ===");

const shiftById = new Map(shifts.map((s) => [s.id, s]));
const byGuard = new Map(guards.map((g) => [g.id, []]));
for (const a of result.assignments) {
  byGuard.get(a.guardId).push({ ...shiftInterval(shiftById.get(a.shiftId)), shiftId: a.shiftId });
}

// 1. never assigned to someone who said no
const violatedAvailability = result.assignments.filter(
  (a) => availability[`${a.guardId}-${a.shiftId}`]?.status === "unavailable"
);
check("no guard assigned to a shift they marked unavailable", violatedAvailability.length === 0,
  JSON.stringify(violatedAvailability));

// 2. no overlaps
let overlapCount = 0;
for (const [, ivs] of byGuard) {
  const sorted = [...ivs].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end) overlapCount++;
  }
}
check("no guard double-booked", overlapCount === 0, `${overlapCount} overlaps`);

// 3. rest + consecutive-hours
let restViolations = 0;
let blockViolations = 0;
for (const [, ivs] of byGuard) {
  const sorted = [...ivs].sort((a, b) => a.start - b.start);
  let blockStart = null;
  let blockEnd = null;
  for (const iv of sorted) {
    if (blockEnd === null) {
      blockStart = iv.start; blockEnd = iv.end; continue;
    }
    const gap = (iv.start - blockEnd) / HOUR;
    if (gap === 0) {
      blockEnd = iv.end; // contiguous — same block
    } else {
      if ((blockEnd - blockStart) / HOUR > rules.maxConsecutiveHours) blockViolations++;
      if (gap < rules.minRestHours) restViolations++;
      blockStart = iv.start; blockEnd = iv.end;
    }
  }
  if (blockEnd !== null && (blockEnd - blockStart) / HOUR > rules.maxConsecutiveHours) blockViolations++;
}
check(`min rest of ${rules.minRestHours}h respected`, restViolations === 0, `${restViolations} violations`);
check(`max ${rules.maxConsecutiveHours}h consecutive respected`, blockViolations === 0, `${blockViolations} violations`);

// 4. weekly caps
const overCap = result.fairness.perGuard.filter((p) => p.shifts > rules.maxShiftsPerWeek);
check(`weekly cap of ${rules.maxShiftsPerWeek} shifts respected`, overCap.length === 0, JSON.stringify(overCap));
const overNights = result.fairness.perGuard.filter((p) => p.nights > rules.maxNightsPerWeek);
check(`night cap of ${rules.maxNightsPerWeek} respected`, overNights.length === 0, JSON.stringify(overNights));

// 5. required headcount never exceeded
let overfilled = 0;
for (const [sid, gids] of Object.entries(result.byShift)) {
  if (gids.length > Math.max(1, shiftById.get(sid).requiredGuards || 1)) overfilled++;
}
check("no shift over-staffed", overfilled === 0, `${overfilled} shifts`);

// 6. determinism
const again = autoAssign({ shifts, guards, availability });
check("deterministic across runs",
  JSON.stringify(again.byShift) === JSON.stringify(result.byShift));

// 7. quality bars
check("coverage >= 90%", result.summary.coverage >= 90, `${result.summary.coverage}%`);
check("workload spread <= 2 shifts", result.fairness.spread <= 2, `spread ${result.fairness.spread}`);

// 8. every assignment carries an explanation
const unexplained = result.assignments.filter((a) => !a.parts?.length);
check("every assignment has reasons", unexplained.length === 0, `${unexplained.length} without`);

// ---------- edge cases ----------
console.log("\n=== edge cases ===");
const noGuards = autoAssign({ shifts, guards: [], availability });
check("no guards -> everything unfilled, no crash", noGuards.unfilled.length === shifts.length);

const noShifts = autoAssign({ shifts: [], guards, availability });
check("no shifts -> empty result, no crash", noShifts.assignments.length === 0);

const allBusy = {};
for (const g of guards) for (const s of shifts) allBusy[`${g.id}-${s.id}`] = { status: "unavailable" };
const impossible = autoAssign({ shifts, guards, availability: allBusy });
check("everyone unavailable -> 0 assigned, reasons given",
  impossible.assignments.length === 0 && impossible.unfilled.every((u) => u.blockers.length > 0));

// ---------- preferences ----------
//
// The whole point of "preferred" is that it is *soft*. These checks pin down
// both halves of that: it must actually move the outcome when everything else
// is equal, and it must not be able to override a hard constraint, starve
// anyone, or pay out more than a plain "available" once it is switched off.
console.log("\n=== preferences ===");

// Two guards, one shift, identical in every respect except that g2 asked for it.
const duel = [
  { id: "s1", date: dates[0], label: "משמרת יום", type: "morning",
    startTime: "07:00", endTime: "19:00", requiredGuards: 1, assignedGuards: [] },
];
const twoGuards = [{ id: "g1", name: "גיא" }, { id: "g2", name: "מיכל" }];

const tie = autoAssign({
  shifts: duel, guards: twoGuards,
  availability: { "g1-s1": { status: "available" }, "g2-s1": { status: "available" } },
});
const preferWins = autoAssign({
  shifts: duel, guards: twoGuards,
  availability: { "g1-s1": { status: "available" }, "g2-s1": { status: "preferred" } },
});
check("a preference breaks the tie between two equally free guards",
  preferWins.byShift.s1[0] === "g2", `got ${preferWins.byShift.s1[0]}, tie went to ${tie.byShift.s1[0]}`);

const preferOther = autoAssign({
  shifts: duel, guards: twoGuards,
  availability: { "g1-s1": { status: "preferred" }, "g2-s1": { status: "available" } },
});
check("the preference decides it, not the guard ordering",
  preferOther.byShift.s1[0] === "g1", `got ${preferOther.byShift.s1[0]}`);

const preferOff = autoAssign({
  shifts: duel, guards: twoGuards, rules: { honourPreferences: false },
  availability: { "g1-s1": { status: "available" }, "g2-s1": { status: "preferred" } },
});
check("switching preferences off scores 'preferred' exactly as 'available'",
  preferOff.byShift.s1[0] === tie.byShift.s1[0],
  `got ${preferOff.byShift.s1[0]}, plain tie gives ${tie.byShift.s1[0]}`);

// A preference must never beat "unavailable" on the same slot for someone else,
// nor pull a guard past a hard constraint.
const greedy = {};
for (const g of guards) for (const s of shifts) greedy[`${g.id}-${s.id}`] = { status: "preferred" };
const allPreferred = autoAssign({ shifts, guards, availability: greedy });
check("everyone marking 'preferred' does not break the caps",
  allPreferred.fairness.perGuard.every(
    (p) => p.shifts <= DEFAULT_RULES.maxShiftsPerWeek && p.nights <= DEFAULT_RULES.maxNightsPerWeek
  ));
check("everyone marking 'preferred' stays as fair as everyone marking 'available'",
  allPreferred.fairness.spread <= 2, `spread ${allPreferred.fairness.spread}`);

// The realistic case the feature was built for: open on Sunday, would rather
// have Tuesday. Both are honoured as available; Tuesday should win the pull.
const twoDays = [
  { id: "sun", date: dates[0], label: "יום א", type: "morning",
    startTime: "07:00", endTime: "15:00", requiredGuards: 1, assignedGuards: [] },
  { id: "tue", date: dates[2], label: "יום ג", type: "morning",
    startTime: "07:00", endTime: "15:00", requiredGuards: 1, assignedGuards: [] },
];
const softPref = autoAssign({
  shifts: twoDays, guards: twoGuards,
  availability: {
    "g1-sun": { status: "available" }, "g1-tue": { status: "preferred" },
    "g2-sun": { status: "available" }, "g2-tue": { status: "available" },
  },
});
check("open on both days, prefers Tuesday -> gets Tuesday, Sunday still covered",
  softPref.byShift.tue[0] === "g1" && softPref.byShift.sun[0] === "g2",
  JSON.stringify(softPref.byShift));

const blocked = autoAssign({
  shifts: duel, guards: twoGuards,
  availability: { "g1-s1": { status: "preferred" }, "g2-s1": { status: "available" } },
  rules: { maxShiftsPerWeek: 0 },
});
check("a preference cannot push a guard past a hard cap", blocked.assignments.length === 0);

// The opportunity-cost rule holds guards back from non-preferred shifts. That
// must never cost coverage — a shift left open to honour a wish would be a
// worse product than no preferences at all.
const scattered = {};
for (const g of guards) for (const s of shifts) scattered[`${g.id}-${s.id}`] = { status: "available" };
scattered["g1-d2"] = { status: "preferred" };
scattered["g2-n4"] = { status: "preferred" };
scattered["g3-d5"] = { status: "preferred" };
const mixed = autoAssign({ shifts, guards, availability: scattered });
const baseline = autoAssign({ shifts, guards, availability:
  Object.fromEntries(Object.keys(scattered).map((k) => [k, { status: "available" }])) });
check("preferences never reduce coverage",
  mixed.summary.coverage >= baseline.summary.coverage,
  `${mixed.summary.coverage}% vs ${baseline.summary.coverage}% baseline`);
const wishes = [["g1", "d2"], ["g2", "n4"], ["g3", "d5"]];
const granted = wishes.filter(([gid, sid]) => (mixed.byShift[sid] || []).includes(gid));
check("scattered preferences are honoured where legal",
  granted.length >= 2,
  `${granted.length}/3 granted — ${JSON.stringify({ d2: mixed.byShift.d2, n4: mixed.byShift.n4, d5: mixed.byShift.d5 })}`);

check("preferred assignments say so in the explanation",
  preferWins.assignments[0].parts.some((p) => p.label.includes("ביקש")),
  JSON.stringify(preferWins.assignments[0].parts.map((p) => p.label)));

// ---------- swap safety (FR-4.4) ----------
// Approving a swap must run the same hard constraints the engine itself runs.
// Without this a supervisor can approve a swap that breaks a rest rule, which
// silently voids the promise that the system never produces an illegal roster.
console.log("\nswap safety");

const swapShifts = [
  { id: "s1", date: dates[0], label: "לילה", type: "night",
    startTime: "23:00", endTime: "07:00", requiredGuards: 1, assignedGuards: ["g1"] },
  { id: "s2", date: dates[1], label: "בוקר", type: "morning",
    startTime: "08:00", endTime: "16:00", requiredGuards: 1, assignedGuards: ["g2"] },
];
const swapAvail = {};
for (const g of guards) for (const s of swapShifts) swapAvail[`${g.id}-${s.id}`] = { status: "available" };

// g1 comes off s1 at 07:00 and s2 starts at 08:00 — one hour of rest, not eight.
const illegalSwap = checkAssignment({
  guard: guards[0], shift: swapShifts[1], shifts: swapShifts, availability: swapAvail,
});
check("swap that breaks minimum rest is rejected", illegalSwap.ok === false, JSON.stringify(illegalSwap));
check("rejection names the rest rule", illegalSwap.code === "rest", illegalSwap.code);
check("rejection carries a human reason",
  typeof illegalSwap.reason === "string" && illegalSwap.reason.length > 0);

// g3 holds nothing this week, so the same move is legal for them.
const legalSwap = checkAssignment({
  guard: guards[2], shift: swapShifts[1], shifts: swapShifts, availability: swapAvail,
});
check("swap with a free guard is allowed", legalSwap.ok === true, JSON.stringify(legalSwap));

// An explicit "unavailable" blocks a swap exactly as it blocks the engine.
const blockedSwap = checkAssignment({
  guard: guards[2], shift: swapShifts[1], shifts: swapShifts,
  availability: { ...swapAvail, "g3-s2": { status: "unavailable" } },
});
check("swap onto a shift the guard marked unavailable is rejected",
  blockedSwap.ok === false, blockedSwap.code);

// The guard already on the shift is not a candidate to be swapped onto it.
const alreadyOn = checkAssignment({
  guard: guards[1], shift: swapShifts[1], shifts: swapShifts, availability: swapAvail,
});
check("swap onto a shift the guard already holds is rejected",
  alreadyOn.code === "already", alreadyOn.code);

// ---------------------------------------------------------------
// נטל (FR-3.2) — הוגנות נמדדת במשקל התורנות, לא בספירתן.
// ---------------------------------------------------------------

const loadWeek = weekByOffset(1);
const dayShift = {
  id: "L1", date: loadWeek[1], startTime: "07:00", endTime: "19:00",
  type: "day", requiredGuards: 1, assignedGuards: [], label: "יום",
};
const nightShift = { ...dayShift, id: "L2", type: "night", startTime: "19:00", endTime: "07:00" };

check("לילה נושא יותר נטל מיום באותו אורך",
  shiftLoad(nightShift) > shiftLoad(dayShift),
  `${shiftLoad(nightShift)} vs ${shiftLoad(dayShift)}`);

const satIndex = loadWeek.findIndex((d) => new Date(`${d}T12:00:00`).getDay() === 6);
const satShift = { ...dayShift, id: "L3", date: loadWeek[satIndex] };
check("שבת נושאת יותר נטל מיום חול",
  shiftLoad(satShift) > shiftLoad(dayShift),
  `${shiftLoad(satShift)} vs ${shiftLoad(dayShift)}`);

// המכפילים אינם מוכפלים זה בזה: לילה בשבת אינו 1.4 × 1.25.
const satNight = { ...nightShift, id: "L4", date: loadWeek[satIndex] };
check("לילה בשבת נלקח לפי המכפיל החמור ולא לפי מכפלתם",
  Math.abs(shiftLoad(satNight) - shiftLoad(nightShift)) < 1e-9,
  `${shiftLoad(satNight)} vs ${shiftLoad(nightShift)}`);

/**
 * המבחן האמיתי: שניים, לילה ושתי משמרות יום. מי שכבר נשא את הלילה נמצא מעל
 * הממוצע בנטל, ולכן אסור שיקבל גם את שתי משמרות היום — למרות שספירה פשוטה
 * הייתה רואה כאן תיקו של שיבוץ אחד לכל אחד.
 */
const two = [{ id: "a", name: "א" }, { id: "b", name: "ב" }];
const seq = [
  { ...nightShift, id: "N1", date: loadWeek[0] },
  { ...dayShift, id: "D1", date: loadWeek[2] },
  { ...dayShift, id: "D2", date: loadWeek[4] },
];
const loadPlan = autoAssign({ shifts: seq, guards: two, availability: {} });
const holderOfNight = loadPlan.assignments.find((a) => a.shiftId === "N1")?.guardId;
const nextTwo = ["D1", "D2"].map((id) => loadPlan.assignments.find((a) => a.shiftId === id)?.guardId);
check("מי שנשא לילה לא מקבל גם את שתי משמרות היום",
  nextTwo.filter((g) => g === holderOfNight).length <= 1,
  JSON.stringify({ holderOfNight, nextTwo }));

console.log(`\n${failures === 0 ? "PASS" : `FAIL — ${failures} failing check(s)`}\n`);
process.exit(failures === 0 ? 0 : 1);
