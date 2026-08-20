# Coding Conventions

**Analysis Date:** 2026-08-20

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `SupervisorApp.jsx`, `AuthPage.jsx`)
- Utilities and modules: camelCase (e.g., `autoAssign.js`, `dates.js`, `api.js`)
- Hooks: camelCase starting with `use` (e.g., `useGuardian.js`, `useTheme.js`)
- Design tokens: camelCase (e.g., `shiftPalette.js`)

**Functions:**
- camelCase, descriptive and action-oriented (e.g., `autoAssign`, `checkAssignment`, `availStatus`, `tally`)
- Private helpers: nested within files or prefixed with underscore if exported
- Event handlers: `on` + PascalCase (e.g., `onNavigate`, `onSeedDemo`, `onSubmit`)
- Pure utility functions exported individually from modules

**Variables:**
- camelCase for all variable declarations
- Short conventional abbreviations: `iv` for interval, `g` for guard, `s` for shift, `p` for person/profile
- Constants: SCREAMING_SNAKE_CASE (e.g., `DEFAULT_RULES`, `HOUR`, `GUARD_COLORS`)
- Collection-specific plurals: `guards`, `shifts`, `members`, `tasks`

**Types/Objects:**
- Object keys follow camelCase in the app layer (e.g., `startTime`, `endTime`, `requiredGuards`)
- Database column names use snake_case (e.g., `start_time`, `end_time`); transformed in `src/lib/api.js`
- Hebrew identifiers preserved exactly as used in business logic (e.g., `נטל`, `הוגנות`, `משמרות`)

## Code Style

**Formatting:**
- No enforced linter (no .eslintrc found)
- No automatic formatter (no .prettierrc found)
- Free-form JavaScript with consistent patterns observed in codebase
- Two-space logical indentation typical
- RTL awareness in component className: `dir="rtl"` on containers

**Module System:**
- ES modules throughout (`"type": "module"` in `package.json`)
- Named exports for utilities and components
- Default exports for React components (when single export)
- Mixed imports in files: React first, then local modules with relative paths

**Statement Style:**
- Semicolons used consistently (present but not enforced)
- Template literals for string interpolation with variables
- Ternary operators for simple conditionals (one line)
- Logical operators (`&&`, `||`) for short-circuit control flow
- Arrow functions preferred for all new functions

**Spacing:**
- Blank lines separate logical sections within functions
- Section dividers: `// ====` with 60-char repeat
- No trailing spaces in comments

## Import Organization

**Order:**
1. React and React libraries (`import React, { useEffect }`)
2. Third-party packages (`import { supabase } from "@supabase/supabase-js"`)
3. Local modules by layer: design → lib → components → hooks
4. Relative paths always used for local imports (`./`, `../`)

**Path Aliases:**
None configured — all imports use relative paths.

**Barrel Files:**
None used. Each module exports directly; `ui.jsx` is a component library, not a barrel.

## Comments

**When to Comment:**
- File headers: module purpose, architecture notes, key assumptions (always present)
- Complex algorithms: how/why, not what the code does (e.g., `autoAssign.js` explains the constraint solver strategy)
- Business logic: intent and rules in Hebrew when relevant (e.g., fairness weighting in `fairness.js`)
- Workarounds: why a shortcut exists (e.g., offline cache fallback in `useGuardian.js`)
- Non-obvious decisions: trade-offs and reasoning

**Comment Language:**
- Hebrew comments for product domain concepts and business rules
- English comments for technical implementation details (when necessary)
- Inline comments explain "why", not "what"

**JSDoc/TSDoc:**
- Simple style: single-line or brief multi-line
- Parameter descriptions in `@param` tags when type inference is insufficient
- Return type in `@returns` with example structure
- No type annotations in comments (code is untyped JavaScript)
- Example: `@returns {{ok: true} | {ok: false, code: string, reason: string}}`

## Error Handling

**Pattern:**
- `try/catch` with error transformation to user-facing messages (Hebrew)
- Errors thrown as `new Error(message)` or `coded(code, message)` helper
- Error objects carry `.code` property for programmatic branching (e.g., `error.code === "rest"`)
- Validation errors as early returns with specific reason strings

**Rethrow Convention:**
- API layer (`src/lib/api.js`): throws translated errors
- UI layer (`src/hooks/useGuardian.js`): centralised error reporting with `run()` helper
- Auth screens: opt into `rethrow: true` to branch on `error.code`
- Data actions: silent catch, show generic user message via state

**Constraint Violations:**
- Hard constraint check returns `{ok: false, code: string, reason: string}`
- Code identifies the rule (e.g., `"rest"`, `"consecutive"`, `"weekly-cap"`)
- Reason is human-readable Hebrew explanation for UI display
- Example from `autoAssign.js`: `{ok: false, code: "rest", reason: "רק ${round(gap)} שעות מנוחה..."}`

## Logging

**Framework:** `console` only (no logger library)

**Patterns:**
- `console.error()`: runtime errors logged during development/debugging
- `console.log()`: test output and debug tracing (in scripts only)
- No log levels or structured logging
- No logs sent to external service

## Function Design

**Size:**
- Utility functions: typically 5–15 lines (small and focused)
- Complex algorithms broken into 5–10 sub-functions (see `autoAssign.js`)
- Components: 50–200 lines typical; longer ones split into smaller components

**Parameters:**
- Destructure objects: `({guard, shift, load, availability}) => ...`
- Options passed as config objects: `{rules, stats, check}`
- Callback parameters: specific names (`fn`, `work`, `patch`)

**Return Values:**
- Objects with descriptive keys (e.g., `{ok: true, gap: 8.5, block: 12}`)
- Arrays for lists (e.g., `[guard1, guard2, guard3]`)
- Nullable: return `null` when result is absent (not `undefined`)
- Promises: all async functions return Promise, no mixing sync/async

## Module Design

**Exports:**
- All exports named; no wildcard imports
- Related functions grouped in one module (e.g., all assignment logic in `autoAssign.js`)
- Internal helpers: nested functions, not exported
- Pure functions: no module-level mutable state

**Data Mappers:**
- Input: database rows with snake_case
- Output: app objects with camelCase
- Mapper functions: `fromRow()`, `toRow()` (e.g., `shiftFromRow`, `profileToRow` in `api.js`)
- Conversion happens at data layer; UI always works with camelCase

## Dependency Patterns

**State Management:**
- Single source of truth: `useGuardian` hook holds entire team dataset
- Optimistic updates: paint immediately, rollback on server error
- Undo pattern: delay write 8 seconds, allow cancel without reverting

**Module Dependencies:**
- `api.js` (data layer) knows database schema; nothing above it does
- `autoAssign.js` and `fairness.js` are pure; no side effects
- `supabaseClient.js`: single shared instance, no initialization logic in components
- Circular imports: none found; clear unidirectional flow

## Anti-Patterns to Avoid

### Hardcoded Database Column Names Above API Layer

**What happens:** Component reads `shift.start_time` instead of `shift.startTime`
**Why it's wrong:** Schema change breaks entire UI; creates coupling to database
**Do this instead:** Use mappers in `src/lib/api.js` — database columns stay there, app uses camelCase everywhere

### Error Swallowing

**What happens:** `catch (e) { /* silence */ }` or `catch (e) { setError(null) }`
**Why it's wrong:** User never learns the action failed; can lead to data inconsistency
**Do this instead:** All errors reported. Use `run()` in hooks; UI always shows result or error

### Sync/Async Mixing

**What happens:** `const data = loadTeam()` (returns Promise, not data)
**Why it's wrong:** Race conditions, undefined reads, infinite re-renders
**Do this instead:** All data access is `async/await` in effects or event handlers; never in render

### Mutable Module State

**What happens:** `let cache = {}; export function getCached() { ... }`
**Why it's wrong:** Tests and multiple instances share same state; hard to reset
**Do this instead:** State lives in React (hooks) or function parameters; modules are stateless

---

*Convention analysis: 2026-08-20*
