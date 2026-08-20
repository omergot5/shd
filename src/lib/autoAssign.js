// ============================================================
// NexRota — smart assignment engine
//
// A deterministic constraint solver. Same inputs always produce the same
// schedule, and every decision it makes carries a human-readable reason,
// so a supervisor can see *why* a guard was picked and why a shift stayed open.
//
// Strategy:
//   1. Hard constraints filter the candidate set (labour rules, availability).
//   2. Soft criteria score whatever survives (fairness, rest, night rotation).
//   3. Shifts are filled most-constrained-first — the classic heuristic for
//      this family of problems; scheduling the hardest slot while the most
//      options remain avoids painting yourself into a corner.
//   4. A local-search pass then trades shifts between the busiest and quietest
//      guards to flatten the workload without breaking any hard constraint.
// ============================================================

import { shiftInterval, shiftHours, formatDateHe, fromISODate, minutesOfTime } from "./dates.js";

export const DEFAULT_RULES = {
  minRestHours: 8, // minimum gap between two separate shifts
  maxConsecutiveHours: 12, // longest unbroken block a guard may work
  maxShiftsPerWeek: 6,
  maxNightsPerWeek: 3,
  allowMaybe: true, // may assign guards who answered "אולי"
  allowUnknown: true, // may assign guards who never submitted availability
  honourPreferences: true, // weigh "מעדיף" above a plain "זמין"
  balancePasses: 40, // local-search iterations
};

export const RULE_LABELS = {
  minRestHours: "מנוחה מינימלית בין משמרות",
  maxConsecutiveHours: "מקסימום שעות רצופות",
  maxShiftsPerWeek: "מקסימום משמרות לשבוע",
  maxNightsPerWeek: "מקסימום לילות לשבוע",
  allowMaybe: 'לשבץ גם מי שסימן "אולי"',
  allowUnknown: "לשבץ גם מי שלא הגיש זמינות",
  honourPreferences: 'להעדיף את מי שסימן "מעדיף"',
};

/**
 * Availability is a ladder, not a switch. "I can work Sunday but I'd rather
 * have Tuesday" used to be unsayable: marking Sunday unavailable closes the
 * option, marking it available says nothing about the preference. "preferred"
 * sits above "available" and is deliberately *soft* — it never blocks a shift
 * and never overrides fairness, it only breaks the tie between two guards who
 * are both free. A guard who marks everything preferred therefore gains
 * nothing over one who marks everything available, which is the property that
 * keeps the feature honest.
 */
export const AVAILABILITY_ORDER = ["preferred", "available", "maybe", "unknown", "unavailable"];

const HOUR = 3600000;

/**
 * נטל יחסי לפי סוג תורנות.
 *
 * שתי תורנויות באותו אורך אינן שוות. לילה שובר את השינה, וסוף שבוע לוקח את
 * הזמן שאדם באמת רוצה לעצמו. אחראי שסופר "שלוש משמרות לכל אחד" ומרגיש שחילק
 * בהוגנות — מחלק בפועל את הלילות למי שפחות מתלונן.
 *
 * המספרים הם מכפיל על השעות ולא במקומן: תורנות לילה בת 12 שעות נושאת נטל של
 * 12 × 1.4. הם שמרניים בכוונה — מכפיל אגרסיבי הופך את הסבב לתנודתי, ומי
 * שקיבל לילה אחד היה נעלם מהשיבוץ ליומיים.
 */
export const LOAD_WEIGHTS = { night: 1.4, weekend: 1.25, day: 1, default: 1 };

/** שישי מהצהריים ושבת. ראשון הוא יום עבודה רגיל בישראל. */
const isWeekendShift = (shift) => {
  const day = fromISODate(shift.date).getDay();
  if (day === 6) return true;
  return day === 5 && minutesOfTime(shift.startTime) >= 12 * 60;
};

/**
 * הנטל של תורנות אחת — שעות × מכפיל הסוג. זו היחידה שבה נמדדת הוגנות בכל
 * המוצר, ולכן היא מיוצאת: מסך המשתתף חייב להראות בדיוק את המספר שהמנוע חילק
 * לפיו, אחרת שורת ההוגנות משקרת.
 */
export function shiftLoad(shift) {
  const base = LOAD_WEIGHTS[shift.type] ?? LOAD_WEIGHTS.default;
  const weekend = isWeekendShift(shift) ? LOAD_WEIGHTS.weekend : 1;
  // המכפילים לא מוכפלים זה בזה: לילה בשבת אינו פי 1.75 מיום חול. נלקח החמור
  // מביניהם, כדי שהסבב יישאר יציב.
  return shiftHours(shift) * Math.max(base, weekend);
}

// ---------- small helpers ----------

const availKey = (guardId, shiftId) => `${guardId}-${shiftId}`;

/** Availability entries may be a bare string (legacy) or {status, comment}. */
export const availStatus = (availability, guardId, shiftId) => {
  const raw = availability?.[availKey(guardId, shiftId)];
  if (!raw) return "unknown";
  return (typeof raw === "string" ? raw : raw.status) || "unknown";
};

const availComment = (availability, guardId, shiftId) => {
  const raw = availability?.[availKey(guardId, shiftId)];
  return typeof raw === "object" ? raw?.comment || "" : "";
};

/** For quantities that are genuinely fractional: hours, per-guard averages. */
const round = (n, digits = 1) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

/**
 * For score contributions. These are shown side by side in the "why?" panel,
 * so a `+8.8` sitting next to a `+40` reads like a bug even when the maths is
 * right — points are whole numbers everywhere they surface.
 */
const points = (n) => Math.round(n);

/** Stable deterministic ordering fallback so runs are reproducible. */
const tieBreak = (a, b) => String(a.guardId).localeCompare(String(b.guardId));

// ---------- guard workload bookkeeping ----------

function emptyLoad() {
  return { shifts: [], count: 0, nights: 0, hours: 0, load: 0, dates: new Set() };
}

/**
 * Merge the guard's intervals with a candidate one and return the length of
 * the unbroken block that contains the candidate. Shifts that touch end-to-start
 * (a 07:00–15:00 followed by 15:00–23:00) count as one continuous stretch.
 */
function blockHoursAround(intervals, candidate) {
  const all = [...intervals, candidate].sort((a, b) => a.start - b.start);
  let blockStart = candidate.start;
  let blockEnd = candidate.end;
  let grew = true;
  while (grew) {
    grew = false;
    for (const iv of all) {
      if (iv.start <= blockEnd && iv.end > blockEnd) {
        blockEnd = iv.end;
        grew = true;
      }
      if (iv.end >= blockStart && iv.start < blockStart) {
        blockStart = iv.start;
        grew = true;
      }
    }
  }
  return (blockEnd - blockStart) / HOUR;
}

/** Smallest rest gap (hours) between the candidate and any non-touching shift. */
function smallestRestGap(intervals, candidate) {
  let gap = Infinity;
  for (const iv of intervals) {
    if (iv.end <= candidate.start) gap = Math.min(gap, (candidate.start - iv.end) / HOUR);
    else if (iv.start >= candidate.end) gap = Math.min(gap, (iv.start - candidate.end) / HOUR);
  }
  return gap;
}

function overlaps(intervals, candidate) {
  return intervals.some((iv) => iv.start < candidate.end && candidate.start < iv.end);
}

// ---------- hard constraints ----------

/**
 * @returns {{ok: true} | {ok: false, code: string, reason: string}}
 */
function checkHardConstraints({ guard, shift, load, availability, rules }) {
  const status = availStatus(availability, guard.id, shift.id);
  const candidate = shiftInterval(shift);

  if (status === "unavailable") {
    const note = availComment(availability, guard.id, shift.id);
    return {
      ok: false,
      code: "unavailable",
      reason: note ? `סימן/ה "לא זמין" — ${note}` : 'סימן/ה "לא זמין" למשמרת זו',
    };
  }
  if (status === "maybe" && !rules.allowMaybe) {
    return { ok: false, code: "maybe-blocked", reason: 'סימן/ה "אולי", והכלל הנוכחי לא מאפשר שיבוץ כזה' };
  }
  if (status === "unknown" && !rules.allowUnknown) {
    return { ok: false, code: "no-availability", reason: "לא הגיש/ה זמינות לשבוע הזה" };
  }
  if (load.shifts.some((s) => s.shiftId === shift.id)) {
    return { ok: false, code: "already", reason: "כבר משובץ/ת למשמרת הזו" };
  }
  if (overlaps(load.shifts, candidate)) {
    return { ok: false, code: "overlap", reason: "חופף למשמרת אחרת שכבר שובצה" };
  }

  const block = blockHoursAround(load.shifts, candidate);
  if (block > rules.maxConsecutiveHours) {
    return {
      ok: false,
      code: "consecutive",
      reason: `היה יוצא רצף של ${round(block)} שעות (המקסימום ${rules.maxConsecutiveHours})`,
    };
  }

  const gap = smallestRestGap(load.shifts, candidate);
  const touching = load.shifts.some((iv) => iv.end === candidate.start || iv.start === candidate.end);
  if (!touching && gap < rules.minRestHours) {
    return {
      ok: false,
      code: "rest",
      reason: `רק ${round(gap)} שעות מנוחה מהמשמרת הסמוכה (נדרש ${rules.minRestHours})`,
    };
  }

  if (load.count >= rules.maxShiftsPerWeek) {
    return {
      ok: false,
      code: "weekly-cap",
      reason: `הגיע/ה לתקרה של ${rules.maxShiftsPerWeek} משמרות בשבוע`,
    };
  }
  if (shift.type === "night" && load.nights >= rules.maxNightsPerWeek) {
    return {
      ok: false,
      code: "night-cap",
      reason: `הגיע/ה לתקרה של ${rules.maxNightsPerWeek} לילות בשבוע`,
    };
  }

  return { ok: true, gap, block, status };
}

// ---------- soft scoring ----------

// Weights, kept here so the normalised match percentage below stays honest:
// the denominator is the best score this particular shift could hand out.
const W = { availability: 40, fairness: 35, night: 22, rest: 10, continuity: 5 };
const maxScoreFor = (shift) =>
  W.availability + W.fairness + W.rest + W.continuity + (shift.type === "night" ? W.night : 0);

function scoreCandidate({ guard, shift, load, availability, rules, stats, check }) {
  const parts = [];
  let score = 0;

  // 1. What the guard actually asked for.
  //
  // The rungs share one 40-point budget rather than stacking a bonus on top,
  // so the match percentage keeps its existing meaning: 40 is still the most
  // this dimension can pay out, and a shift full of willing guards still
  // reads as a strong match rather than being marked down for the absence of
  // an explicit preference.
  const status = check.status;
  const preferHonoured = status === "preferred" && rules.honourPreferences !== false;
  if (preferHonoured) {
    score += 40;
    parts.push({ label: "ביקש/ה את המשמרת הזו במפורש", points: 40, kind: "availability" });
  } else if (status === "available" || status === "preferred") {
    score += 34;
    parts.push({ label: "סימן/ה זמין/ה למשמרת", points: 34, kind: "availability" });
  } else if (status === "maybe") {
    score += 18;
    parts.push({ label: 'סימן/ה "אולי"', points: 18, kind: "availability" });
  } else {
    score += 5;
    parts.push({ label: "לא הגיש/ה זמינות — שיבוץ ברירת מחדל", points: 5, kind: "availability" });
  }

  // 2. Fairness — the further below the team average, the stronger the pull.
  // נמדד בנטל ולא בספירת משמרות: מי שעשה שני לילות נשא יותר ממי שעשה שלושה
  // בקרים, וספירה פשוטה הייתה שולחת אליו את הלילה הבא.
  const target = Math.max(stats.loadTargetPerGuard, 0.001);
  const fairness = Math.max(0, Math.min(1, 1 - load.load / target));
  const fairnessPts = points(35 * fairness);
  score += fairnessPts;
  parts.push({
    label:
      load.count === 0
        ? "טרם שובץ/ה השבוע"
        : `נטל נמוך יחסית — ${round(load.load)} מול ממוצע ${round(stats.loadTargetPerGuard)}`,
    points: fairnessPts,
    kind: "fairness",
  });

  // 3. Night rotation — measured against the team's expected share of nights,
  //    not against the hard cap, or nights pile onto whoever is free first.
  if (shift.type === "night") {
    const nightTarget = Math.max(stats.nightTargetPerGuard, 0.001);
    const nightFair = Math.max(0, Math.min(1, 1 - load.nights / nightTarget));
    const nightPts = points(22 * nightFair);
    score += nightPts;
    parts.push({
      label:
        load.nights === 0
          ? "טרם שובץ/ה ללילה השבוע"
          : `${load.nights} לילות עד כה מול ממוצע ${round(stats.nightTargetPerGuard)}`,
      points: nightPts,
      kind: "night",
    });
  }

  // 4. Rest comfort — more recovery time is better, capped at 24h.
  if (Number.isFinite(check.gap)) {
    const restPts = points((10 * Math.min(check.gap, 24)) / 24);
    score += restPts;
    parts.push({ label: `${round(check.gap)} שעות מנוחה מהמשמרת הקודמת`, points: restPts, kind: "rest" });
  } else {
    score += 10;
    parts.push({ label: "אין משמרת סמוכה — מנוחה מלאה", points: 10, kind: "rest" });
  }

  // 4b. Opportunity cost. A preference only works if the guard is still free
  //     when their preferred shift comes up for filling — and shifts are
  //     filled most-constrained-first, not in the order the guard would
  //     choose. Without this, someone who asked for Tuesday gets handed
  //     Sunday first simply because Sunday was processed earlier, and by
  //     Tuesday they are at their cap. Holding back slightly on their
  //     non-preferred shifts is what makes the request survive the ordering.
  //
  //     Deliberately smaller than the fairness weight: it nudges who takes
  //     which shift, it never leaves a shift unfilled to honour a wish.
  if (rules.honourPreferences !== false && status !== "preferred" && stats.hasPreference?.has(guard.id)) {
    score -= 6;
    parts.push({ label: "נשמר/ת למשמרת שביקש/ה במפורש", points: -6, kind: "preference" });
  }

  // 5. Don't stack two shifts on one calendar day if it can be avoided.
  if (load.dates.has(shift.date)) {
    score -= 12;
    parts.push({ label: "כבר משובץ/ת ביום הזה", points: -12, kind: "spread" });
  }

  // 6. A little continuity — same shift type across the week is easier to live with.
  const sameType = load.shifts.filter((s) => s.type === shift.type).length;
  if (sameType > 0 && sameType < 3) {
    score += W.continuity;
    parts.push({ label: `רגיל/ה למשמרות ${shift.label || shift.type}`, points: W.continuity, kind: "continuity" });
  }

  // Expressed as "how good a match is this, out of 100" — a raw point total
  // means nothing to a supervisor looking at the screen.
  const normalised = Math.max(0, Math.min(100, Math.round((score / maxScoreFor(shift)) * 100)));
  return { score: normalised, raw: points(score), parts };
}

// ---------- main entry point ----------

/**
 * @param {object} input
 * @param {Array}  input.shifts       shifts to fill (already scoped to the week/team)
 * @param {Array}  input.guards       candidate guards
 * @param {object} input.availability map of `${guardId}-${shiftId}` -> status|{status,comment}
 * @param {object} [input.rules]      overrides for DEFAULT_RULES
 * @param {boolean}[input.keepExisting] keep shift.assignedGuards as locked assignments
 */
export function autoAssign({ shifts, guards, availability = {}, rules: ruleOverrides, keepExisting = false }) {
  const rules = { ...DEFAULT_RULES, ...ruleOverrides };
  const log = [];

  const activeGuards = guards.filter(Boolean);
  const openShifts = shifts.filter(Boolean);

  if (!activeGuards.length || !openShifts.length) {
    return emptyResult(rules, openShifts, activeGuards);
  }

  // --- bookkeeping ---
  const load = new Map(activeGuards.map((g) => [g.id, emptyLoad()]));
  const assignments = []; // {shiftId, guardId, score, parts, locked}
  const byShift = new Map(openShifts.map((s) => [s.id, []]));

  const addAssignment = (shift, guard, score, parts, locked = false, raw = null) => {
    const iv = shiftInterval(shift);
    const l = load.get(guard.id);
    l.shifts.push({ ...iv, shiftId: shift.id, type: shift.type, date: shift.date });
    l.count += 1;
    l.hours += shiftHours(shift);
    l.load += shiftLoad(shift);
    l.dates.add(shift.date);
    if (shift.type === "night") l.nights += 1;
    const record = { shiftId: shift.id, guardId: guard.id, score, raw, parts, locked };
    assignments.push(record);
    byShift.get(shift.id).push(record);
    return record;
  };

  // Existing manual assignments stay put when asked to.
  if (keepExisting) {
    for (const shift of openShifts) {
      for (const gid of shift.assignedGuards || []) {
        const guard = activeGuards.find((g) => g.id === gid);
        if (guard) {
          addAssignment(shift, guard, 0, [{ label: "שיבוץ ידני קיים — נשמר", points: 0, kind: "locked" }], true);
        }
      }
    }
  }

  const totalSlots = openShifts.reduce((n, s) => n + Math.max(1, s.requiredGuards || 1), 0);
  const nightSlots = openShifts
    .filter((s) => s.type === "night")
    .reduce((n, s) => n + Math.max(1, s.requiredGuards || 1), 0);
  // Who asked for something specific this week. Computed once over the whole
  // set rather than per candidate, so the opportunity-cost rule above sees
  // the guard's *other* wishes even while scoring an unrelated shift.
  const hasPreference = new Set(
    activeGuards
      .filter((g) => openShifts.some((s) => availStatus(availability, g.id, s.id) === "preferred"))
      .map((g) => g.id)
  );

  const stats = {
    targetPerGuard: totalSlots / activeGuards.length,
    loadTargetPerGuard:
      openShifts.reduce((sum, s) => sum + shiftLoad(s) * Math.max(1, s.requiredGuards || 1), 0) /
      activeGuards.length,
    nightTargetPerGuard: nightSlots / activeGuards.length,
    hasPreference,
  };

  // --- order shifts most-constrained-first ---
  const flexibility = (shift) =>
    activeGuards.filter((g) => availStatus(availability, g.id, shift.id) !== "unavailable").length;

  const ordered = [...openShifts].sort((a, b) => {
    const fa = flexibility(a);
    const fb = flexibility(b);
    if (fa !== fb) return fa - fb; // fewest candidates first
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return String(a.id).localeCompare(String(b.id));
  });

  log.push({
    step: "order",
    title: "סדר מילוי",
    detail: `${ordered.length} משמרות מסודרות לפי מידת הקושי — הכי מוגבלת קודם`,
  });

  // --- greedy fill ---
  const unfilled = [];

  for (const shift of ordered) {
    const need = Math.max(1, shift.requiredGuards || 1);
    const blockers = [];

    while (byShift.get(shift.id).length < need) {
      const candidates = [];
      const roundBlockers = [];

      for (const guard of activeGuards) {
        const l = load.get(guard.id);
        const check = checkHardConstraints({ guard, shift, load: l, availability, rules });
        if (!check.ok) {
          roundBlockers.push({ guardId: guard.id, name: guard.name, code: check.code, reason: check.reason });
          continue;
        }
        const { score, raw, parts } = scoreCandidate({ guard, shift, load: l, availability, rules, stats, check });
        candidates.push({ guardId: guard.id, guard, score, raw, parts });
      }

      if (!candidates.length) {
        blockers.push(...roundBlockers);
        break;
      }

      candidates.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const ca = load.get(a.guardId).count;
        const cb = load.get(b.guardId).count;
        if (ca !== cb) return ca - cb;
        return tieBreak(a, b);
      });

      const winner = candidates[0];
      const runnerUp = candidates[1];
      addAssignment(shift, winner.guard, winner.score, winner.parts, false, winner.raw);

      log.push({
        step: "assign",
        title: `${shift.label} · ${formatDateHe(shift.date)}`,
        detail: `${winner.guard.name} — ${winner.score}% התאמה`,
        runnerUp: runnerUp ? `${runnerUp.guard.name} (${runnerUp.score}%)` : null,
        shiftId: shift.id,
        guardId: winner.guardId,
      });
    }

    const filled = byShift.get(shift.id).length;
    if (filled < need) {
      unfilled.push({
        shiftId: shift.id,
        shift,
        needed: need,
        filled,
        missing: need - filled,
        blockers: dedupeBlockers(blockers),
      });
    }
  }

  // --- local-search balancing ---
  const balanceMoves = balanceWorkload({
    openShifts, activeGuards, availability, rules, stats, load, assignments, byShift,
  });
  if (balanceMoves.length) {
    log.push({
      step: "balance",
      title: "איזון עומסים",
      detail: `${balanceMoves.length} החלפות בוצעו כדי לצמצם פערים בין השומרים`,
      moves: balanceMoves,
    });
  }

  return buildResult({ rules, openShifts, activeGuards, assignments, byShift, load, unfilled, log, stats, balanceMoves });
}

// ---------- balancing ----------

function balanceWorkload({ openShifts, activeGuards, availability, rules, stats, load, assignments, byShift }) {
  const moves = [];
  const shiftById = new Map(openShifts.map((s) => [s.id, s]));

  for (let pass = 0; pass < rules.balancePasses; pass++) {
    const sorted = [...activeGuards].sort((a, b) => {
      const d = load.get(a.id).count - load.get(b.id).count;
      return d !== 0 ? d : String(a.id).localeCompare(String(b.id));
    });
    const lightest = sorted[0];
    const heaviest = sorted[sorted.length - 1];
    if (!lightest || !heaviest) break;

    const gapSize = load.get(heaviest.id).count - load.get(lightest.id).count;
    if (gapSize < 2) break; // already flat enough

    // Try to hand one of the heaviest guard's shifts to the lightest one.
    const movable = assignments
      .filter((a) => a.guardId === heaviest.id && !a.locked)
      .sort((a, b) => a.score - b.score); // give away the least-justified first

    let moved = false;
    for (const candidate of movable) {
      const shift = shiftById.get(candidate.shiftId);
      if (!shift) continue;

      // Simulate removing it from the heavy guard first — the light guard may
      // otherwise fail a rest check against a shift that is about to move.
      const heavyLoad = load.get(heaviest.id);
      const lightLoad = load.get(lightest.id);

      const check = checkHardConstraints({ guard: lightest, shift, load: lightLoad, availability, rules });
      if (!check.ok) continue;
      if (availStatus(availability, lightest.id, shift.id) === "unavailable") continue;

      // Apply the move.
      removeFromLoad(heavyLoad, shift);
      const { score, raw, parts } = scoreCandidate({
        guard: lightest, shift, load: lightLoad, availability, rules, stats, check,
      });
      addToLoad(lightLoad, shift);

      candidate.guardId = lightest.id;
      candidate.score = score;
      candidate.raw = raw;
      candidate.parts = [
        ...parts,
        { label: `הועבר/ה מ${heaviest.name} לאיזון עומסים`, points: 0, kind: "balance" },
      ];
      const list = byShift.get(shift.id);
      const idx = list.findIndex((r) => r === candidate);
      if (idx === -1) list.push(candidate);

      moves.push({
        shiftId: shift.id,
        from: heaviest.name,
        to: lightest.name,
        label: `${shift.label} · ${formatDateHe(shift.date)}`,
      });
      moved = true;
      break;
    }

    if (!moved) break; // no legal improvement left
  }

  return moves;
}

function removeFromLoad(l, shift) {
  const idx = l.shifts.findIndex((s) => s.shiftId === shift.id);
  if (idx === -1) return;
  l.shifts.splice(idx, 1);
  l.count -= 1;
  l.hours -= shiftHours(shift);
  l.load -= shiftLoad(shift);
  if (shift.type === "night") l.nights -= 1;
  if (!l.shifts.some((s) => s.date === shift.date)) l.dates.delete(shift.date);
}

function addToLoad(l, shift) {
  const iv = shiftInterval(shift);
  l.shifts.push({ ...iv, shiftId: shift.id, type: shift.type, date: shift.date });
  l.count += 1;
  l.hours += shiftHours(shift);
  l.load += shiftLoad(shift);
  l.dates.add(shift.date);
  if (shift.type === "night") l.nights += 1;
}

// ---------- result shaping ----------

function dedupeBlockers(blockers) {
  const seen = new Map();
  for (const b of blockers) if (!seen.has(b.guardId)) seen.set(b.guardId, b);
  return [...seen.values()];
}

function buildResult({ rules, openShifts, activeGuards, assignments, byShift, load, unfilled, log, stats, balanceMoves }) {
  const totalSlots = openShifts.reduce((n, s) => n + Math.max(1, s.requiredGuards || 1), 0);
  const filledSlots = assignments.length;

  const perGuard = activeGuards
    .map((g) => {
      const l = load.get(g.id);
      return {
        guardId: g.id,
        name: g.name,
        shifts: l.count,
        nights: l.nights,
        hours: round(l.hours),
      };
    })
    .sort((a, b) => b.shifts - a.shifts || String(a.guardId).localeCompare(String(b.guardId)));

  const counts = perGuard.map((p) => p.shifts);
  const max = counts.length ? Math.max(...counts) : 0;
  const min = counts.length ? Math.min(...counts) : 0;
  const mean = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
  const variance = counts.length
    ? counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length
    : 0;

  // 100 = perfectly even. Each full shift of spread costs ~15 points.
  const fairnessScore = Math.max(0, Math.round(100 - Math.sqrt(variance) * 15));
  const coverage = totalSlots ? Math.round((filledSlots / totalSlots) * 100) : 100;

  return {
    rules,
    assignments,
    byShift: Object.fromEntries([...byShift].map(([k, v]) => [k, v.map((r) => r.guardId)])),
    detailByShift: Object.fromEntries([...byShift].map(([k, v]) => [k, v])),
    unfilled,
    fairness: { perGuard, spread: max - min, max, min, mean: round(mean), score: fairnessScore },
    summary: {
      totalSlots,
      filledSlots,
      openSlots: totalSlots - filledSlots,
      coverage,
      fairnessScore,
      guards: activeGuards.length,
      shifts: openShifts.length,
      balanceMoves: balanceMoves.length,
      targetPerGuard: round(stats.targetPerGuard),
    },
    log,
  };
}

function emptyResult(rules, shifts, guards) {
  return {
    rules,
    assignments: [],
    byShift: {},
    detailByShift: {},
    unfilled: shifts.map((s) => ({
      shiftId: s.id,
      shift: s,
      needed: Math.max(1, s.requiredGuards || 1),
      filled: 0,
      missing: Math.max(1, s.requiredGuards || 1),
      blockers: [],
    })),
    fairness: { perGuard: [], spread: 0, max: 0, min: 0, mean: 0, score: 100 },
    summary: {
      totalSlots: 0, filledSlots: 0, openSlots: 0, coverage: 0,
      fairnessScore: 100, guards: guards.length, shifts: shifts.length,
      balanceMoves: 0, targetPerGuard: 0,
    },
    log: [],
  };
}

// ---------- explanation helpers for the UI ----------

/** Turns a scored assignment into a short Hebrew sentence. */
/**
 * Can this guard legally take this shift, given everything else already on the
 * roster? Answers the question a swap approval asks, using the *same* checker
 * the engine runs — a swap that the engine would never have produced must not
 * be reachable by approving a request either.
 *
 * The guard's current load is rebuilt from `shifts`, so the caller passes the
 * roster it already holds rather than any private engine state.
 *
 * @returns {{ok: boolean, code?: string, reason?: string}}
 */
export function checkAssignment({ guard, shift, shifts = [], availability = {}, rules: ruleOverrides }) {
  if (!guard || !shift) return { ok: false, code: "missing", reason: "חסרים פרטי המשמרת או השומר" };

  const rules = { ...DEFAULT_RULES, ...ruleOverrides };
  const load = emptyLoad();
  for (const s of shifts) {
    // The target shift is excluded: `checkHardConstraints` reports being
    // already on it through its own `already` code, and counting it here as
    // well would double-book the guard against themselves.
    if (!s || s.id === shift.id) continue;
    if ((s.assignedGuards || []).includes(guard.id)) addToLoad(load, s);
  }

  if ((shift.assignedGuards || []).includes(guard.id)) {
    load.shifts.push({ ...shiftInterval(shift), shiftId: shift.id, type: shift.type, date: shift.date });
  }

  return checkHardConstraints({ guard, shift, load, availability, rules });
}

export function explainAssignment(record, guardName) {
  if (!record) return "";
  const top = [...(record.parts || [])]
    .filter((p) => p.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 2)
    .map((p) => p.label);
  if (!top.length) return `${guardName} שובץ/ה ידנית`;
  return `${guardName}: ${top.join(" · ")}`;
}

export function explainUnfilled(entry) {
  if (!entry?.blockers?.length) return "אין שומרים זמינים בצוות";
  const byCode = entry.blockers.reduce((acc, b) => {
    acc[b.code] = (acc[b.code] || 0) + 1;
    return acc;
  }, {});
  const labels = {
    unavailable: "סימנו לא זמינים",
    rest: "חוסמי מנוחה",
    consecutive: "חריגת שעות רצופות",
    overlap: "חופפים למשמרת אחרת",
    "weekly-cap": "הגיעו לתקרת המשמרות",
    "night-cap": "הגיעו לתקרת הלילות",
    "no-availability": "לא הגישו זמינות",
    "maybe-blocked": 'סימנו "אולי"',
    already: "כבר משובצים",
  };
  return Object.entries(byCode)
    .map(([code, n]) => `${n} ${labels[code] || code}`)
    .join(" · ");
}

/**
 * כמה תורנויות, לילות ושעות יש לכל אחד — ומה הממוצע בצוות.
 *
 * המספר הבודד ("3 תורנויות") לא אומר כלום; מה שאדם באמת רוצה לדעת הוא אם
 * יצא לו יותר מלאחרים. לכן כל מונה חוזר לצד הממוצע, ותמיד מאותו חתך משמרות
 * שהקורא רואה על המסך — הקורא מסנן, הפונקציה רק סופרת.
 *
 * הממוצע מחושב על פני כל אנשי הצוות, כולל מי שלא שובץ בכלל: אם שלושה מתוך
 * עשרה נושאים את כל השבוע, זו בדיוק העובדה ששורת ההוגנות אמורה לחשוף.
 */
export function teamAverages(guards, shifts) {
  const perGuard = {};
  for (const g of guards) perGuard[g.id] = { count: 0, nights: 0, hours: 0, load: 0 };

  for (const s of shifts) {
    const hours = shiftHours(s);
    const weight = shiftLoad(s);
    for (const id of s.assignedGuards || []) {
      const rec = perGuard[id];
      if (!rec) continue; // שובץ ואז הוסר מהצוות
      rec.count += 1;
      rec.hours += hours;
      rec.load += weight;
      if (s.type === "night") rec.nights += 1;
    }
  }

  const n = guards.length || 1;
  const sum = (key) => Object.values(perGuard).reduce((a, r) => a + r[key], 0);
  const avg = {
    count: round(sum("count") / n),
    nights: round(sum("nights") / n),
    hours: round(sum("hours") / n),
    load: round(sum("load") / n),
  };

  return { perGuard, avg };
}
