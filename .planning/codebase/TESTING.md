# Testing Patterns

**Analysis Date:** 2026-08-20

## Test Framework

**Runner:**
- Node.js `.mjs` scripts (ES modules), not Jest or Vitest
- Run via: `npm test` (runs multiple scripts sequentially)
- Individual scripts:
  - `node scripts/verify-scheduler.mjs` — algorithm tests
  - `node scripts/verify-planning.mjs` — fairness engine tests
  - `node scripts/verify-backend.mjs` — Supabase backend E2E tests

**Test Environment:**
- Pure Node.js execution (no browser, no DOM)
- No test library dependency (vanilla assertions)
- Direct imports of production code
- Environmental variables available (e.g., `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)

**Assertion Pattern:**
- Custom `check()` function: `const check = (label, cond, extra = "") => ...`
- Increments failure counter on false assertions
- Prints pass/fail status to console with label
- Includes optional extra debug information

**Output:**
- Human-readable console output (pass/fail for each assertion)
- Summary at end: "PASS" or "FAIL — N failing check(s)"
- Exit code: `0` for all pass, `1` if any failures
- Process exit: `process.exit(failures === 0 ? 0 : 1)`

## Test File Organization

**Location:**
- All tests in `scripts/` directory (not co-located with source)
- Separation of concerns: algorithm tests, fairness tests, backend tests
- Each script is standalone and independent

**Naming:**
- `verify-*.mjs` — descriptive of what's verified
- `.mjs` extension forces ES module handling

**Structure - Example:**
```javascript
// File header with purpose
// ---------- imports ----------
import { autoAssign, checkAssignment } from "../src/lib/autoAssign.js";

// ---------- fixtures ----------
const guards = [
  { id: "g1", name: "גיא לוי" },
  { id: "g2", name: "מיכל כהן" },
];
const shifts = [
  { id: "d0", date, label: "משמרת יום", ... },
  { id: "n0", date, label: "משמרת לילה", ... },
];

// ---------- assertions ----------
console.log("\n=== hard constraints ===");
check("no guard assigned to unavailable shift", violatedAvailability.length === 0);
check("no guard double-booked", overlapCount === 0, `${overlapCount} overlaps`);
```

## Test Structure

**Fixtures:**
- Real data structures with Hebrew identifiers: `{ id: "g1", name: "גיא לוי" }`
- Shift templates with actual times, types (morning/night), colors
- Availability map: `{ "g1-s1": {status: "available"}, "g2-s1": {status: "unavailable"} }`
- Deliberately incomplete/edge-case scenarios (e.g., all guards unavailable, no shifts)

**Check Function:**
```javascript
const check = (label, cond, extra = "") => {
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
};
```

**Failure Tracking:**
```javascript
let failures = 0;
// ... assertions ...
console.log(`\n${failures === 0 ? "PASS" : `FAIL — ${failures} failing check(s)`}\n`);
```

## Test Types

### Unit Tests - Algorithm (`verify-scheduler.mjs`)

**Scope:** `autoAssign()` function determinism and hard constraint validation

**What's tested:**
- Hard constraints never violated (8h rest, 12h consecutive max, 6 shifts/week, 3 nights/week cap)
- No overlaps or double-booking
- Availability respected (never assign unavailable guard)
- Determinism: identical inputs always produce identical output
- Coverage: `>= 90%` shifts filled
- Fairness: workload spread `<= 2` shifts between busiest and quietest
- Every assignment carries explanation reason

**Example assertion:**
```javascript
const violatedAvailability = result.assignments.filter(
  (a) => availability[`${a.guardId}-${a.shiftId}`]?.status === "unavailable"
);
check("no guard assigned to a shift they marked unavailable",
  violatedAvailability.length === 0, JSON.stringify(violatedAvailability));
```

### Unit Tests - Fairness Engine (`verify-planning.mjs`)

**Scope:** `fairnessPlan()` and conflict detection (`findConflicts()`)

**What's tested:**
- Conflict matrix: blocked/allowed role pairs correctly indexed
- Task window: date ranges correctly calculated
- Rolling load: 14-day window correctly cuts off old assignments
- Fairness calculation: deficit properly computed (load-based, not count-based)
- Hint generation: only "under" or "over" tagged when deficit > 1 shift
- Empty teams don't crash
- Preferences: soft constraint (breaks ties, never overrides hard rules)

**Example test:**
```javascript
const past = rollingLoad({ guards, shifts: history, until: weekStart, days: 14 });
check("window cuts what precedes it",
  past.per.g3.count === 0, JSON.stringify(past.per.g3));
check("what's inside the window counts",
  past.per.g1.count === 4 && past.per.g2.count === 1);
```

### Integration Tests - Supabase Backend (`verify-backend.mjs`)

**Scope:** Authentication, team creation, RPC calls, row-level security (RLS)

**What's tested:**
- Supervisor signup and team creation
- Team code generation (6 alphanumeric, unique, idempotent)
- Anonymous guard sign-in with team code (case-insensitive)
- Guard can only see their team's shifts and teammates (RLS)
- Unauthorized team codes rejected
- Multiple guards can join same team
- Shift insertion succeeds with required fields

**Connection:**
- Uses live Supabase project URL and anon key (from environment or hardcoded defaults)
- Creates throwaway test data with timestamp in email (`omer.sup.${Date.now()}@mailinator.com`)
- Does not clean up; relies on eventual admin cleanup or disposable test project

**Example flow:**
```javascript
const sup = fresh(); // new client instance
const { data: supAuth, error: supErr } = await sup.auth.signUp({
  email: `omer.sup.${stamp}@mailinator.com`,
  password: "Guardian!2345",
});
check("signUp succeeds", !supErr, supErr?.message);
const { data: teamRows, error: teamErr } = await sup.rpc("gs_create_team", {
  p_team_name: "מוקד בדיקה",
  p_full_name: "עומר האחמ״ש",
});
check("team code generated", /^[A-Z0-9]{6}$/.test(team?.team_code || ""));
```

## Preference Testing

The preference system (soft constraints) is thoroughly tested in `verify-scheduler.mjs`:

**Preference Wins in Ties:**
- When two guards are equally free, "preferred" breaks the tie
- Changing guard order doesn't change the winner

**Preferences Are Soft:**
- Cannot override hard constraints (rest rules, weekly caps)
- Marking all shifts "preferred" scores same as all "available"
- Spread remains `<= 2` even with all guards marking preferred
- Coverage never decreases with preferences on

**Opportunity Cost:**
- Guard holding a preferred shift is withheld from non-preferred ones
- But this never costs coverage (no shift left unfilled to honor a wish)

## Hard Constraint Testing

### Rest Rule Violations

**Test:** Swap onto a shift 1 hour after another — should fail
```javascript
const illegalSwap = checkAssignment({
  guard: guards[0], shift: swapShifts[1], shifts: swapShifts,
  availability: swapAvail,
});
check("swap that breaks minimum rest is rejected",
  illegalSwap.ok === false, JSON.stringify(illegalSwap));
```

### Weekly Caps

**Test:** Assigning at max capacity should be rejected
```javascript
const blocked = autoAssign({
  shifts: duel, guards: twoGuards,
  availability: { "g1-s1": { status: "preferred" }, "g2-s1": { status: "available" } },
  rules: { maxShiftsPerWeek: 0 },
});
check("a preference cannot push a guard past a hard cap",
  blocked.assignments.length === 0);
```

## Fairness Testing

**Load Weighting:**
- Night shift (1.4x) carries more weight than day (1x)
- Saturday (1.25x) carries more weight than weekday (1x)
- Multipliers don't stack: Saturday night takes the max (1.4), not 1.75

**Test:**
```javascript
check("night carries more load than day",
  shiftLoad(nightShift) > shiftLoad(dayShift),
  `${shiftLoad(nightShift)} vs ${shiftLoad(dayShift)}`);
```

**Rolling Fairness:**
- Guards with past overload get priority for current week
- Deficit (what they "owe") is expressed in shifts: `Math.round(deficit / avgShiftLoad)`

## Edge Cases

**Tested in `verify-scheduler.mjs`:**
- No guards: all shifts unfilled, no crash
- No shifts: empty result, no crash
- Everyone unavailable: 0 assigned, blockers recorded for each unfilled shift
- Scattered preferences: honored where legal, coverage never reduced

**Not tested (outside test scope):**
- Network failures (E2E tests assume live connection)
- Concurrent edits (Supabase RLS prevents, not tested)
- Invalid input (assumed well-formed by callers)

## Coverage

**Requirements:** No formal coverage target; pragmatic testing of critical paths

**Critical Paths Tested:**
- Assignment algorithm: all hard constraints, soft scoring, determinism
- Fairness calculation: load weighting, rolling window, deficit calculation
- Constraint checking: every rule type (rest, consecutive, caps)
- Backend: auth flow, RLS enforcement, RPC execution

**Not Required:**
- Component rendering (manual browser testing)
- UI event handlers (manual testing via `npm run dev`)
- Edge case UI behavior (tooltips, animations, error messages)
- Performance benchmarks

## Run Commands

```bash
npm test                          # Run all tests (scheduler + planning + backend combined)
node scripts/verify-scheduler.mjs # Run only algorithm tests
node scripts/verify-planning.mjs  # Run only fairness/conflict tests
node scripts/verify-backend.mjs   # Run only Supabase backend tests
```

**Expected Output (Pass):**
```
=== hard constraints ===
  ok   no guard assigned to a shift they marked unavailable
  ok   no guard double-booked
  ...
PASS
```

**Expected Output (Failure):**
```
  FAIL no guard double-booked — 2 overlaps
  ...
FAIL — 1 failing check(s)
```

## Pre-Commit Checks

- `npm test` runs on every build/dev restart (enforced in CLAUDE.md)
- `npm run build` also runs after changes
- Tests are deterministic and should always pass with stable data

---

*Testing analysis: 2026-08-20*
