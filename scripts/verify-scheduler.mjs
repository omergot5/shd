// Standalone sanity check for the assignment engine.
//   node scripts/verify-scheduler.mjs
//
// Asserts the hard constraints actually hold on a generated week, and prints
// the coverage/fairness numbers so regressions are obvious.

import { autoAssign, DEFAULT_RULES } from "../src/lib/autoAssign.js";
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

console.log(`\n${failures === 0 ? "PASS" : `FAIL — ${failures} failing check(s)`}\n`);
process.exit(failures === 0 ? 0 : 1);
