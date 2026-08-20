<!-- refreshed: 2026-08-20 -->
# Architecture

**Analysis Date:** 2026-08-20

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│              React + Vite SPA (Browser)                    │
│  (src/App.jsx → Shell → Role-based App)                    │
├──────────────────┬──────────────────┬───────────────────────┤
│ SupervisorApp    │   GuardApp       │    AuthPage           │
│ `src/components/ │ `src/components/ │ `src/components/      │
│  SupervisorApp   │  GuardApp.jsx`   │  AuthPage.jsx`        │
│  .jsx`           │                  │                       │
│                  │  Week Calendar   │   Recovery/Setup      │
│  Week Flow       │  My Schedule     │   Forms               │
│  Calendar View   │  Availability    │                       │
│  Analytics       │  Swaps           │                       │
│  Dashboard       │                  │                       │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         │  useGuardian()   │  (Central State)   │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│  State Management & Auth Layer                              │
│  `src/hooks/useGuardian.js`                                 │
│  - Session & Profile Management                            │
│  - Team Data Hydration (in-memory cache)                   │
│  - Offline Snapshot (localStorage)                         │
│  - Real-time Subscriptions (Supabase WebSocket)            │
│  - Optimistic Updates & Deferred Actions                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Data Access & API Layer                                    │
│  `src/lib/api.js`                                           │
│  - Auth (login, register, password reset)                  │
│  - Team CRUD (create, load, update)                        │
│  - Shift Management (CRUD, publish)                        │
│  - Guard Management (add, remove, exempt deadline)         │
│  - Assignment Handling (assign, unassign, bulk ops)        │
│  - Availability Tracking                                   │
│  - Swap Request Management                                 │
│  - Task Management                                         │
│  - Row ↔ App Mappers (snake_case ↔ camelCase)             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Business Logic (Algorithms)                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Smart Scheduling Engine                             │   │
│  │ `src/lib/autoAssign.js`                             │   │
│  │ Deterministic constraint solver:                    │   │
│  │  1. Hard constraints (availability, labour laws)   │   │
│  │  2. Soft scoring (fairness, rest, rotation)        │   │
│  │  3. Most-constrained-first heuristic               │   │
│  │  4. Local search load balancing                    │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Load Fairness Calculator                            │   │
│  │ `src/lib/fairness.js`                               │   │
│  │ - Per-guard load tracking (hours × shift weight)   │   │
│  │ - Night/weekend multipliers                        │   │
│  │ - Fairness hints & recommendations                 │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Conflict Detection                                  │   │
│  │ `src/lib/conflicts.js`                              │   │
│  │ - Schedule overlap analysis                         │   │
│  │ - Constraint violation detection                   │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Utilities                                           │   │
│  │ `src/lib/dates.js` - Date/time parsing & formatting│   │
│  │ `src/lib/terms.js` - i18n vocabulary by profile    │   │
│  │ `src/lib/shareImage.js` - Schedule screenshots     │   │
│  │ `src/lib/demoData.js` - Seeding demo team          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Supabase (Backend)                                         │
│  `src/lib/supabaseClient.js`                                │
│  - Authentication (email/password, anonymous)              │
│  - Database (gs_teams, gs_profiles, gs_shifts, etc.)      │
│  - Real-time Subscriptions (postgres_changes)              │
│  - RPC Functions (gs_create_team, gs_join_team)           │
│  - Row-level Security (RLS)                                │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| **App** | Error boundary, auth state routing, boot sequence | `src/App.jsx` |
| **Shell** | Status-aware view dispatcher (boot, recovery, needs-team, anonymous, ready) | `src/App.jsx` |
| **SupervisorApp** | Main shift management interface for supervisors | `src/components/SupervisorApp.jsx` |
| **GuardApp** | Schedule view & availability submission for guards | `src/components/GuardApp.jsx` |
| **AuthPage** | Login, registration, team join, password recovery | `src/components/AuthPage.jsx` |
| **WeekFlow** | Step-by-step flow for building shifts → running assignments → publishing | `src/components/supervisor/WeekFlow.jsx` |
| **WeekCalendar** | 7-day grid view of shifts for a week | `src/components/supervisor/WeekCalendar.jsx` |
| **CalendarView** | Monthly calendar with published shifts summary | `src/components/supervisor/CalendarView.jsx` |
| **SupDashboard** | Overview: team metrics, today's shifts, pending swaps, open tasks | `src/components/supervisor/views.jsx` |
| **SmartAssign** | UI for running the scheduling algorithm and reviewing results | `src/components/SmartAssign.jsx` |
| **Analytics** | Charts: load distribution, night shifts, fairness metrics | `src/components/supervisor/Analytics.jsx` |
| **SwapMgmt** | Manage guard swap requests | `src/components/supervisor/views.jsx` |
| **TaskMgmt** | Create, edit, complete tasks (non-shift work) | `src/components/supervisor/views.jsx` |
| **TeamView** | Guard roster, settings, exempt deadlines | `src/components/supervisor/views.jsx` |
| **LiveSchedulePreview** | Real-time schedule display for guards (their shifts) | `src/components/LiveSchedulePreview.jsx` |
| **UI Components** | Buttons, forms, modals, cards, badges, spinners, undo bar | `src/components/ui.jsx` |
| **Icons** | SVG icon registry (star, check-circle, x-circle, etc.) | `src/components/icons.jsx` |

## Pattern Overview

**Overall:** Hooks-based React with centralized state management, optimistic UI updates, and deferred operations (8-second undo). Supabase provides auth and database; real-time updates flow via WebSocket subscriptions.

**Key Characteristics:**
- **Deterministic scheduling** — same inputs always produce same schedule (no randomness)
- **Constraint-first algorithm** — hard constraints (labour laws, availability) filter before scoring
- **Offline-first UI** — latest state cached in localStorage, readable without network
- **Optimistic updates** — UI responds immediately; rollback if server rejects
- **Deferred deletions** — deletions shown immediately but can be undone for 8 seconds
- **Accessibility** — WCAG-compliant (triple-channel availability display: icon + label + color)

## Layers

**Presentation Layer:**
- Purpose: Render UI and handle user interaction
- Location: `src/components/`
- Contains: React components (.jsx), icon registry, UI primitives
- Depends on: `useGuardian()` hook, design tokens, icons
- Used by: Browser/Vite

**State Management Layer:**
- Purpose: Hold session, team data, auth state; expose actions; coordinate offline caching and real-time updates
- Location: `src/hooks/useGuardian.js`
- Contains: Central state object, action methods, boot sequence
- Depends on: `api.js`, Supabase client, localStorage
- Used by: All screens via hook

**Data Access Layer:**
- Purpose: Map database rows to app objects; encapsulate Supabase API
- Location: `src/lib/api.js`
- Contains: Auth functions, team/shift/guard/availability/swap/task CRUD, row mappers
- Depends on: Supabase client
- Used by: `useGuardian()`, components (via actions)

**Business Logic Layer:**
- Purpose: Implement scheduling algorithm, fairness calculation, conflict detection, formatting utilities
- Location: `src/lib/` (autoAssign.js, fairness.js, conflicts.js, dates.js, terms.js)
- Contains: Constraint solver, scoring functions, load balancing, date utilities, vocabulary
- Depends on: None (pure functions)
- Used by: `api.js` (for validation), components (for display), SmartAssign (for planning)

**Infrastructure Layer:**
- Purpose: Provide Supabase SDK initialization and configuration
- Location: `src/lib/supabaseClient.js`
- Contains: Supabase client instance, auth and database setup
- Depends on: @supabase/supabase-js
- Used by: `api.js`, `useGuardian()`

## Data Flow

### Primary Request Path (Supervisor Creating Shifts)

1. **User Input** — Supervisor fills shift form in WeekFlow (`src/components/supervisor/WeekFlow.jsx`)
2. **Action Call** — Form onSubmit calls `actions.addShifts(shifts)` (line 465 in useGuardian.js)
3. **API Write** — `api.createShifts()` → Supabase INSERT to gs_shifts table (`src/lib/api.js`)
4. **Data Refresh** — `refresh()` polls `api.loadTeam()` to reload all team data
5. **State Update** — `setData(team)` updates in-memory state, subscribers re-render
6. **UI Render** — WeekCalendar shows new shifts immediately

### Smart Assignment Flow

1. **User Initiates** — Supervisor clicks "סדר לי את השבוע" (SmartAssign button)
2. **Algorithm Runs** — `autoAssign()` in `src/lib/autoAssign.js` solves shift assignments
   - Takes: shifts[], guards[], availability{}, rules
   - Returns: assignments[], fairness report, constraint violations
3. **Results Displayed** — SmartAssign shows proposed assignments with reasons (`src/components/SmartAssign.jsx`)
4. **User Reviews** — Supervisor can see why each guard was picked, conflicts, load balancing
5. **Apply or Reject** — "Apply" calls `actions.applyPlan()` which writes via `api.applyPlan()`, or changes rules and reruns
6. **Publish** — After satisfaction, supervisor calls `actions.publish()` to make visible to guards

### Availability Submission (Guard)

1. **Guard Submits** — Guard marks availability for week via GuardApp (`src/components/GuardApp.jsx`)
2. **Optimistic Update** — UI updates immediately: `actions.setAvailability(shiftId, guardId, status)`
3. **API Call** — `api.setAvailability()` → Supabase INSERT/UPDATE to gs_availability
4. **Real-time Sync** — Supervisor's screen receives postgres_changes event, calls `refresh()`
5. **Algorithm Sees It** — Next `autoAssign()` run factors in new availability

### Offline Read Path

1. **No Network** — `navigator.onLine` is false, or Supabase call fails
2. **Load from Cache** — `readOffline()` pulls snapshot from localStorage
3. **Stale Indicator** — UI sets `offline = true`, shows warning banner
4. **Network Returns** — `window.addEventListener('online', ...)` triggers `refresh()`
5. **Cache Updated** — Fresh data from Supabase overwrites localStorage snapshot

**State Management:**
- **Authority:** Supabase database is the source of truth
- **Local Cache:** In-memory `data` object in `useGuardian()` holds complete team state
- **Offline Snapshot:** `localStorage.getItem('gs-offline')` caches profile + team for offline reads
- **Real-time:** WebSocket subscriptions on `gs_shifts`, `gs_assignments`, `gs_availability`, `gs_profiles`, `gs_swap_requests` trigger `refresh()`
- **Optimistic Patching:** Actions like `toggleAssignment()` paint changes before server confirms; rollback snapshot if write fails

## Key Abstractions

**Shift Object:**
- Purpose: Represents a single security shift (e.g., "Monday morning 07:00-19:00")
- Examples: `src/components/supervisor/WeekCalendar.jsx`, `src/lib/api.js` (shiftFromRow)
- Pattern: App uses camelCase (`startTime`, `endTime`, `requiredGuards`, `assignedGuards`); database uses snake_case; mapper in api.js converts
- Fields: `id`, `date`, `label`, `startTime`, `endTime`, `location`, `type`, `color`, `published`, `assignedGuards`, `assignmentMeta`

**Guard Object:**
- Purpose: Represents a team member who can be assigned to shifts
- Examples: `src/lib/api.js` (profileFromRow), `useGuardian.js` (data.guards)
- Pattern: Flat object with profile data (name, phone, role, team membership, exemptions)
- Fields: `id`, `userId`, `name`, `phone`, `role`, `teamCode`, `isSupervisor`, `deadlineExempt`

**Availability Entry:**
- Purpose: Tracks whether a guard can work a specific shift
- Examples: `src/lib/api.js` (availabilityFromRows), `src/components/supervisor/views.jsx` (AVAIL object)
- Pattern: Keyed by `"${guardId}-${shiftId}"`, value is `{status, comment}` where status ∈ ["preferred", "available", "maybe", "unknown", "unavailable"]
- Used by: `autoAssign()` to filter candidates, SmartAssign UI to show visual indicators

**Assignment Object:**
- Purpose: Links a guard to a shift (the result of scheduling)
- Examples: `src/lib/api.js` (assignedGuards array in shiftFromRow), assignmentMeta
- Pattern: Stored as array of guard IDs on shift, plus metadata object `{source, score, reason}` for UI explanation
- Source values: `"manual"` (supervisor), `"auto"` (algorithm), `"rollover"` (from previous week)

**Fairness Plan:**
- Purpose: Per-guard workload summary, used by fairness hints and recommendations
- Examples: `src/lib/fairness.js` (fairnessPlan, fairnessHint), Analytics dashboard
- Pattern: Aggregate hours/nights/shifts per guard; calculate per-guard and team average; show over/under
- Fields: `name`, `shifts`, `nights`, `hours`, `load`, `diff` (vs average)

## Entry Points

**Web App (SPA):**
- Location: `index.html` (Vite entry)
- Triggers: Browser loads `http://localhost:3000` (dev) or deployed URL
- Responsibilities: 
  1. Resolve theme from localStorage before first paint (line 31-46 in index.html)
  2. Mount React root at `#root` div
  3. Load `src/main.jsx`

**App Boot:**
- Location: `src/App.jsx` → `Shell()` component
- Triggers: React mounts the App
- Responsibilities:
  1. Wrap everything in ErrorBoundary
  2. Call `useGuardian()` to initialize state and auth
  3. Route to appropriate screen based on auth status (booting, anonymous, recovery, needs-team, ready, error)

**Auth Flow:**
- Unauthenticated: Show AuthPage (`src/components/AuthPage.jsx`) with login/register/join forms
- Recovery link: Show ResetPassword form
- Authenticated, no team: Show FinishSetup form
- Authenticated with team: Load team data, show SupervisorApp or GuardApp based on role

## Architectural Constraints

- **Threading:** Single-threaded event loop (browser). No workers.
- **Global state:** One `useGuardian()` hook per app instance (React convention); state is not a global singleton, but passed via context-like pattern (props through Shell → SupervisorApp/GuardApp)
- **Circular imports:** None detected; architecture is layered and acyclic
- **Real-time sync:** All data changes flow through Supabase subscriptions; no manual cache invalidation needed if using the subscription pattern
- **Offline-read only:** Offline mode cannot write. `optimistic()` and `deferred()` functions still attempt writes if available; if network is down, writes fail silently and data rolls back.
- **Determinism:** `autoAssign()` function is fully deterministic within a single JS runtime; uses stable sort (`tieBreak()`) to ensure reproducibility across runs
- **No Math.random():** Never used in scheduling engine. All randomness removed in favor of deterministic heuristics.

## Anti-Patterns

### Stale Optimistic Updates

**What happens:** Component calls `optimistic()`, UI updates immediately, but network write fails silently and rollback snapshot is never applied because component unmounts before the promise settles.

**Why it's wrong:** User sees a change that never actually happened. Next page refresh shows the old state, confusing the user about what they did.

**Do this instead:** Use the error flag from `useGuardian()` (state.error) and always show it. The `run()` function in useGuardian.js (line 225) centralizes error reporting. Never ignore a promise rejection.

### Reading `data` Directly in Callbacks

**What happens:** A callback closure captures `data` at creation time; by the time it runs, `data` has changed, but the callback uses stale values.

**Why it's wrong:** Async actions update based on old state, causing race conditions (e.g., assigning to wrong shift).

**Do this instead:** Use `dataRef.current` (line 99 in useGuardian.js). The ref always points to the latest state, even inside callbacks created earlier.

### Calling `actions` with Non-Stable Reference

**What happens:** If `actions` object changes on every render (because it depends on `data`), memoized child components re-render on every keystroke.

**Why it's wrong:** Performance collapse for large team rosters; every guard change retriggers analytics chart.

**Do this instead:** The `actions` object (line 451) depends only on stable callbacks (`run`, `optimistic`, `deferred`, `refresh`), never on `data`. Read current state through `dataRef` inside the action, not as a dependency.

## Error Handling

**Strategy:** Centralized error collection in `useGuardian()` with two modes:

1. **Sync errors** (auth validation): Rethrow immediately, caller handles and displays inline (see `ResetPassword` form, line 113-162 in App.jsx)
2. **Async errors** (data mutations): Catch in `run()`, store in state.error, display in error banner; automatically clear when user initiates new action

**Patterns:**
- Auth errors from Supabase are translated to user-friendly Hebrew messages via `translateAuthError()` in api.js (line 226)
- Data action errors show in error banner, not modal, because users often recover by retrying
- Network failures in offline mode: data rolls back, offline flag is set, UI shows "צילום ישן" (stale snapshot) warning
- Unhandled promise rejections cause the error banner to stay visible until user clicks the action again

## Cross-Cutting Concerns

**Logging:** `console.error()` in ErrorBoundary (App.jsx line 38) and boot error path (useGuardian.js line 140). No persistent logs; errors are reported via error banner to user.

**Validation:** 
- Auth forms: password length, email format, team name not empty (handled in ResetPassword, FinishSetup components)
- Shifts: required_guards ≥ 1, start_time < end_time (validated in SmartAssign before `applyPlan()`)
- Availability: status must be in AVAILABILITY_ORDER (enforced by availStatus() in autoAssign.js)

**Authentication:** 
- Supabase Auth handles session lifecycle (JWT refresh, logout, password reset)
- RLS policies on database tables enforce row-level access (team members see only their team's data)
- Anonymous sessions allowed for guest demo; isolated demo teams with `gs_create_team` RPC

---

*Architecture analysis: 2026-08-20*
