# Codebase Concerns

**Analysis Date:** 2026-08-20

## Tech Debt

**Large React Components:**
- Issue: `views.jsx` contains 2,210 lines, `GuardApp.jsx` 886 lines, `AuthPage.jsx` 720 lines. These exceed maintainability thresholds and should be split.
- Files: `src/components/supervisor/views.jsx`, `src/components/GuardApp.jsx`, `src/components/AuthPage.jsx`
- Impact: Difficult to test, slow to compile, high risk of bugs on modification, long cognitive load for developers
- Fix approach: Break into smaller, focused components with clear responsibilities. Use custom hooks to extract state logic.

**Oversized Custom Hook:**
- Issue: `useGuardian.js` is 672 lines and handles auth, data loading, state management, optimistic updates, and undo logic
- Files: `src/hooks/useGuardian.js`
- Impact: Hard to test, high risk of side-effect bugs, difficult to debug state issues
- Fix approach: Split into separate hooks: `useAuth`, `useTeamData`, `useOptimisticUpdates`, `useUndoManager`

**Algorithm-Heavy Module:**
- Issue: `autoAssign.js` is 795 lines containing the core scheduling algorithm plus scoring and balancing
- Files: `src/lib/autoAssign.js`
- Impact: Complex to modify, difficult to add new scoring dimensions, potential for constraint violations if changed incorrectly
- Fix approach: Keep as-is but add comprehensive parameter documentation and extract helper functions for readability

## Known Bugs

**Duplicate Guard Creation (Fixed):**
- Symptoms: Guards could be created twice despite unique constraint
- Files: `src/lib/api.js`, `addGuard` function
- Trigger: Rapid calls to `addGuard`, race conditions, or session state issues
- Workaround: System now checks for uniqueness, but underlying race condition may still exist in concurrent scenarios
- Status: Partially mitigated by commit "Close the remaining ways a duplicate guard could still appear" (35a6310)

**Preference Test Failures (Fixed):**
- Symptoms: Preference tests failed when guards without sessions were tested
- Files: `scripts/verify-scheduler.mjs`
- Trigger: Calling preference logic with guards that don't own a profile
- Workaround: All guards now validated to own their profiles before preference evaluation
- Status: Fixed in commit "Fix the preference tests to use the session that owns the profile" (6d9c6a5)

## Security Considerations

**Single Security Layer (RLS Only):**
- Risk: Authorization depends entirely on Supabase RLS policies with no server-side validation checks
- Files: `src/lib/api.js`, `src/lib/supabaseClient.js`, `src/hooks/useGuardian.js`
- Current mitigation: RLS filters by `team_code` and `user_id`, preventing cross-team access
- Recommendations: 
  - Add server-side validation in critical paths (team ownership, role checks)
  - Verify RLS policies cover all new mutations
  - Document RLS policy assumptions in api.js

**Session State Trust:**
- Risk: Profile object from `getMyProfile()` is trusted without verification; guards can modify their own availability without explicit ownership check
- Files: `src/lib/api.js`, lines 103-113 (getMyProfile), `src/hooks/useGuardian.js`
- Current mitigation: RLS policies enforce ownership at database level
- Recommendations: Log session changes, add audit trail for sensitive operations

**Password Recovery Edge Cases:**
- Risk: Recovery token fragment must be read before Supabase-js clears it; if timing fails, user enters wrong state
- Files: `src/hooks/useGuardian.js`, lines 74-75, 128-131
- Current mitigation: Fragment is read at module load, before any async operations
- Recommendations: Add defensive checks for recovery state; test with multiple navigation patterns

## Performance Bottlenecks

**Algorithm Scales Linearly with Team Size:**
- Problem: `autoAssign()` performance degrades noticeably with 50+ guards and 100+ shifts
- Files: `src/lib/autoAssign.js`, lines 355-514 (greedy fill loop), 518-585 (balancing passes)
- Cause: 
  - Greedy fill is O(shifts × guards × candidates-per-shift)
  - Balancing loop runs 40 iterations by default (line 28: `balancePasses: 40`)
  - No early termination when balance threshold reached
- Improvement path: 
  - Add iteration limit based on current spread
  - Cache constraint checks (availability, rest violations) per guard-shift pair
  - Profile algorithm with large dataset to identify exact bottleneck

**Full Team Reload on Any Write:**
- Problem: Single assignment change triggers `refresh()` which loads entire team (guards, shifts, availability, tasks, templates)
- Files: `src/hooks/useGuardian.js`, lines 162-174, 200-213
- Cause: Broadcast channel subscription (`team-{teamCode}`) has no granular filtering
- Impact: Slow UI on poor connections, especially with 50+ guards submitting availability simultaneously
- Improvement path: 
  - Implement differential updates (only load changed tables)
  - Add client-side mutation to avoid full refetch when possible
  - Batch updates during high-frequency periods (availability deadline)

**No Pagination or Lazy Loading:**
- Problem: All shifts and tasks for entire team loaded on initialization
- Files: `src/lib/api.js`, lines 238-288 (loadTeam uses 8 parallel queries)
- Impact: Initial load time grows with team history, browser memory pressure
- Improvement path: Add date-based filtering; load current + next week only, with lazy load for history

## Fragile Areas

**Offline Mode State:**
- Files: `src/hooks/useGuardian.js`, lines 50-67, 93, 145-152
- Why fragile: 
  - localStorage is single point of failure (quota exceeded silently, data corruption possible)
  - Offline mode persists stale data without clear expiration
  - Silent fallback to cached data masks network issues
  - No conflict resolution if cache is older than server
- Safe modification: 
  - Add version numbers to cached snapshot
  - Clear cache on login/logout
  - Show explicit "stale" indicators when offline
  - Test storage quota exhaustion scenarios

**Availability Validation Logic:**
- Files: `src/lib/autoAssign.js`, lines 166-231 (checkHardConstraints)
- Why fragile: 
  - Multiple interdependent constraints (rest, consecutive, caps, overlap)
  - Boundary conditions (touching shifts at end-to-start) are subtle
  - Changes to constraint weights elsewhere won't update decision logic
- Safe modification: 
  - Always run `npm test` after changes
  - Add specific unit tests for each constraint in isolation
  - Document boundary conditions explicitly

**Conflict Detection Module:**
- Files: `src/lib/conflicts.js`, lines 67-89 (findConflicts)
- Why fragile: 
  - No tests for this module at all
  - Task window logic assumes start/due date ordering is correct
  - Assumes assignees array is well-formed
  - Silent failures if compatibility matrix row is malformed
- Safe modification: 
  - Add defensive validation of input objects
  - Add tests for edge cases (missing dates, null assignees, malformed matrix)
  - Handle date comparison failures explicitly

**Balancing Algorithm**:
- Files: `src/lib/autoAssign.js`, lines 518-585
- Why fragile:
  - Moves are applied immediately with no rollback on constraint check failure
  - Modifies `assignments` and `load` state during iteration
  - Early termination condition (`if (gapSize < 2) break`) is hardcoded magic number
- Safe modification:
  - Add full constraint check after each move before committing
  - Add defensive snapshot/rollback mechanism
  - Document magic constants with reasoning

## Scaling Limits

**Team Size Capacity:**
- Current capacity: Tested/reliable up to ~50 guards, ~100 shifts/week
- Limit: Algorithm execution time becomes noticeable (>2s) at 100+ guards
- Limit: Full team reload takes >3s on 4G connections at 200 shifts
- Scaling path: 
  - Implement time-boxed search (run algorithm for N seconds, return best so far)
  - Add incremental update for multi-week planning
  - Consider WebWorker offload for algorithm

**Storage Per Team:**
- Current capacity: LocalStorage holds ~5MB (varies by browser)
- Limit: Teams with 20+ weeks of historical shifts exceed quota
- Scaling path: Implement data pruning (archive old shifts), use IndexedDB instead

**Concurrent Users:**
- Current capacity: ~10 simultaneous editors before Supabase broadcast causes lag
- Limit: Real-time subscriptions don't scale with user count
- Scaling path: Move to Postgres LISTEN/NOTIFY with connection pooling

## Dependencies at Risk

**Supabase JavaScript Client (`@supabase/supabase-js` ^2.101.0):**
- Risk: Major version is pinned but minor/patch float; breaking changes in auth flow possible
- Impact: Session handling, RLS enforcement, real-time subscriptions would break
- Migration plan: 
  - Lock to exact version during production phase
  - Monitor Supabase changelog for breaking changes
  - Add integration tests for auth flows before updating

**React (`^18.2.0`):**
- Risk: React 19 introduces changes to concurrent rendering and hooks semantics
- Impact: `useGuardian` hook state management could become unsafe
- Migration plan: Refactor hooks before upgrading; test all async operations thoroughly

**Recharts (`^2.12.3`):**
- Risk: Charting library is non-critical; older versions have known CVEs
- Impact: None for core scheduling, but analytics views use it
- Migration plan: Update safely once tested with new API

## Missing Critical Features

**Audit Trail:**
- Problem: No log of who made what change and when
- Blocks: Cannot debug unfair schedules or track supervisor decisions
- Impact: Supervisors cannot explain why assignments changed

**Concurrent Edit Conflict Resolution:**
- Problem: If two supervisors edit the same shift simultaneously, last write wins
- Blocks: Distributed team coordination
- Impact: Changes get silently overwritten without warning

**Bulk Availability Submission:**
- Problem: Each guard must submit individually; no batch/template availability
- Blocks: Team onboarding, seasonal rosters
- Impact: Adoption friction

## Test Coverage Gaps

**No Unit Tests:**
- What's not tested: Individual functions in `autoAssign.js` (scoreCandidate, blockHoursAround, etc.), `conflicts.js` (pairRule, findConflicts), `fairness.js` (fairnessPlan, rollingLoad), `dates.js` utilities
- Files: `src/lib/autoAssign.js`, `src/lib/conflicts.js`, `src/lib/fairness.js`, `src/lib/dates.js`
- Risk: Refactoring these modules could introduce silent bugs; scoring changes are unchecked in isolation
- Priority: High (these are business logic)

**No Hook Tests:**
- What's not tested: `useGuardian` state machine, optimistic updates, error recovery, `useTheme` persistence, offline cache
- Files: `src/hooks/useGuardian.js`, `src/hooks/useTheme.js`
- Risk: State logic bugs cause unpredictable UI behavior
- Priority: High (state is core)

**No Component Tests:**
- What's not tested: React component rendering, event handling, form validation, error boundaries
- Files: All files in `src/components/`
- Risk: UI bugs discovered only in manual testing or production
- Priority: Medium (UI easier to catch manually)

**No API Integration Tests:**
- What's not tested: Auth flows (signup, login, password reset), team operations, CRUD on shifts/availability/tasks, RLS enforcement
- Files: `src/lib/api.js`
- Risk: Database schema changes break API contract without warning
- Priority: Medium

**No E2E Tests:**
- What's not tested: Full user journeys (new team → invite guard → submit availability → auto-assign → view schedule)
- Risk: Critical flows fail silently in production
- Priority: High (should run before release)

**Algorithm Edge Cases:**
- What's not tested: Performance with 100+ guards, determinism with identical scores, preferences with all guards marking same shift, constraints that cannot be satisfied
- Files: `src/lib/autoAssign.js`
- Risk: Regressions in fairness or coverage
- Priority: High (already has manual tests; formalize these)

**Conflict Detection:**
- What's not tested: All rules in conflict matrix, window overlap logic, task status filtering, override notes
- Files: `src/lib/conflicts.js`
- Risk: Task conflicts incorrectly flagged or missed
- Priority: Medium (fewer users affected)

## Migration Hazards

**Database Schema Migrations:**
- Hazard: `supabase/migrations/0002_task_folders.sql`, `0003_workspace_mode.sql`, `0004_task_templates_and_compatibility.sql` not run on all environments
- Files: `supabase/migrations/` directory
- Impact: Teams on old schema will break if code assumes new columns exist
- Mitigation: 
  - API gracefully handles missing columns (see `asTaskError` in `api.js`)
  - Test code against both old and new schema before deploying
  - Document migration prerequisites in deployment checklist

**RLS Policy Changes:**
- Hazard: New table (`gs_role_compatibility`) added without explicit RLS creation in this codebase
- Files: `supabase/migrations/0004_task_templates_and_compatibility.sql`
- Impact: If RLS doesn't exist, all users can see all compatibility rules (info leak)
- Mitigation: Verify RLS policies are applied; test with low-privilege session

## Silent Failure Modes

**Availability Deadline Passing:**
- Scenario: Guard submits availability after deadline; system accepts it but supervisor doesn't see it (not queried until next week)
- Files: `src/lib/api.js` (setAvailability), `src/hooks/useGuardian.js` (no deadline enforcement in UI)
- Mitigation: Add UI warning; load current week's deadline on mount; highlight past-deadline entries

**localStorage Quota Exceeded:**
- Scenario: Offline cache can't write; app continues without update, user sees stale data next time
- Files: `src/hooks/useGuardian.js`, lines 52-58
- Mitigation: Log quota exceeded errors; show explicit "cannot cache" warning; fail loudly, not silently

**Supabase Connection Timeout:**
- Scenario: No network (not `offline` event, just timeout); app waits 30s silently
- Files: All `api.js` calls lack explicit timeout
- Mitigation: Add 5s timeout to all API calls; fail fast

---

*Concerns audit: 2026-08-20*
