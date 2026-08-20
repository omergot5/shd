# Codebase Structure

**Analysis Date:** 2026-08-20

## Directory Layout

```
shd/
├── .claude/               # Claude Code settings & hooks
├── .agents/               # Agent skill library (managed by skills-lock.json)
├── .git/                  # Git repository
├── .planning/             # GSD planning documents (MASTER_PLAN.md, codebase/ analysis)
├── .vercel/               # Vercel deployment config
├── docs/                  # Project documentation
│   ├── agents/            # Team roles & agent assignments
│   ├── algorithm/         # Scheduling engine documentation
│   ├── architecture/      # System design docs
│   ├── database/          # Schema & RLS policies
│   └── product/           # PRD, glossary, product specs
│   └── plan/              # Milestone roadmaps
├── supabase/              # Supabase local dev config (migrations, functions)
├── src/                   # Frontend source code
│   ├── components/        # React components
│   │   ├── supervisor/    # Supervisor-only views
│   │   ├── App.jsx        # Root component & auth state routing
│   │   ├── SupervisorApp.jsx  # Main supervisor interface
│   │   ├── GuardApp.jsx   # Guard schedule & availability view
│   │   ├── AuthPage.jsx   # Login, register, team join, recovery
│   │   ├── SmartAssign.jsx    # Schedule algorithm UI
│   │   ├── LiveSchedulePreview.jsx  # Real-time schedule display
│   │   ├── ui.jsx         # UI primitives (buttons, forms, modals)
│   │   ├── icons.jsx      # SVG icon registry
│   │   ├── Logo.jsx       # NexRota branding
│   │   └── ThemeToggle.jsx    # Dark/light mode toggle
│   ├── hooks/             # Custom React hooks
│   │   ├── useGuardian.js # Central state management (session, team data, actions)
│   │   └── useTheme.js    # Theme (dark/light) persistence
│   ├── lib/               # Pure business logic & utilities
│   │   ├── api.js         # Data access layer (Supabase CRUD + mappers)
│   │   ├── autoAssign.js  # Deterministic scheduling engine
│   │   ├── fairness.js    # Workload fairness calculation & hints
│   │   ├── conflicts.js   # Schedule conflict detection
│   │   ├── dates.js       # Date/time parsing & formatting (Hebrew-aware)
│   │   ├── terms.js       # i18n vocabulary by team profile (civil/army/etc)
│   │   ├── supabaseClient.js  # Supabase SDK initialization
│   │   ├── demoData.js    # Seeding demo teams
│   │   └── shareImage.js  # Export schedule as screenshot
│   ├── design/            # Design system
│   │   ├── tokens.css     # Color, spacing, typography CSS variables
│   │   └── shiftPalette.js    # Shift type → color mapping
│   ├── App.jsx            # Root React component
│   ├── main.jsx           # Vite entry point
│   └── index.css          # Global styles (Tailwind setup)
├── scripts/               # Verification & utility scripts
│   ├── verify-scheduler.mjs   # Test assignment engine constraints
│   ├── verify-planning.mjs    # Test planning/task logic
│   └── verify-backend.mjs     # Test Supabase RPC functions
├── public/                # Static assets (logos, icons, manifest)
├── index.html             # HTML entry point
├── vite.config.js         # Vite build config
├── tailwind.config.js     # Tailwind CSS config
├── postcss.config.js      # PostCSS config (Tailwind)
├── package.json           # Dependencies & scripts
├── package-lock.json      # Locked dependency versions
├── CLAUDE.md              # Project instructions (this file loaded each session)
└── README.md              # Public project description
```

## Directory Purposes

**`.claude/`:**
- Purpose: Claude Code settings, hooks, preferences
- Contains: settings.json, settings.local.json (local overrides)
- Key files: Hooks for pre-build tests, custom keybindings

**`.agents/skills/`:**
- Purpose: Reusable agent skill library (brand, design, deploy-to-vercel, ui-styling, etc.)
- Contains: SKILL.md index files, rules, references, scripts
- Committed: Yes (managed via skills-lock.json, not manually edited)

**`.planning/`:**
- Purpose: GSD phase planning and codebase analysis documents
- Contains: MASTER_PLAN.md (current roadmap), codebase/ folder with ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, etc.

**`docs/`:**
- Purpose: Product and technical documentation
- Contains: PRD, glossary, algorithm explainers, database schema, roadmaps
- Read by: Team members, new contributors, Claude during phases

**`src/`:**
- Purpose: All frontend source code
- Build: Vite bundles this into `dist/` on `npm run build`

**`src/components/`:**
- Purpose: React components (presentational & container)
- Pattern: One component per file (.jsx); supervisor views grouped in `supervisor/` subdirectory
- Key files:
  - `App.jsx` — Root; ErrorBoundary, Shell, auth routing
  - `SupervisorApp.jsx` — Main supervisor UI (week, calendar, team, dashboard, swaps, tasks, analytics)
  - `GuardApp.jsx` — Guard view (my shifts, availability, swaps)
  - `ui.jsx` — Reusable UI library (Btn, Modal, Field, etc.); 500+ lines
  - `supervisor/views.jsx` — Modular views (SupDashboard, TeamView, SwapMgmt, TaskMgmt)

**`src/components/supervisor/`:**
- Purpose: Supervisor-only features
- Contains:
  - `WeekFlow.jsx` — Multi-step flow: create shifts → set availability → auto-assign → publish
  - `WeekCalendar.jsx` — 7-day grid with shift cards, drag-to-assign
  - `CalendarView.jsx` — Month overview of published weeks
  - `Analytics.jsx` — Charts (load, nights, fairness) via Recharts
  - `views.jsx` — Modular page components (dashboard, team roster, swaps, tasks)

**`src/hooks/`:**
- Purpose: Custom React hooks
- Key files:
  - `useGuardian.js` — THE central hook. Everything goes through here. ~670 lines. Must read before touching state or auth.
  - `useTheme.js` — Dark/light mode toggle with localStorage persistence

**`src/lib/`:**
- Purpose: Pure business logic, not React-specific
- Characteristics: No React imports (except dates.js might format for JSX display)
- Testing: `scripts/verify-scheduler.mjs` tests autoAssign and constraint checking
- Key files:
  - `api.js` — Supabase queries and row↔object mappers. Source of truth for database schema mapping.
  - `autoAssign.js` — Scheduling algorithm. Deterministic, ~400 lines. Comments in Hebrew.
  - `fairness.js` — Load balancing and fairness hints. Read by SmartAssign and Analytics.
  - `conflicts.js` — Schedule overlap detection. Used in SmartAssign to show violations.
  - `dates.js` — Date math and Hebrew formatting. Dependency for almost everything.
  - `terms.js` — i18n vocabulary (civil/army/etc profiles). Read once per app load.

**`src/design/`:**
- Purpose: Design tokens and shift type styling
- Files:
  - `tokens.css` — CSS custom properties (colors, spacing, shadows, blur, etc.)
  - `shiftPalette.js` — Shift type → RGB color, e.g., `shiftTone("morning")` → `"var(--shift-morning)"`

**`scripts/`:**
- Purpose: Node scripts (not included in bundle)
- Run via: `npm test` (runs all), `npm run test:backend`
- Key scripts:
  - `verify-scheduler.mjs` — Checks autoAssign output for constraint violations and prints fairness stats
  - `verify-planning.mjs` — Tests task/planning logic
  - `verify-backend.mjs` — Tests Supabase RPC functions

**`public/`:**
- Purpose: Static assets served as-is
- Contains: Logo variants, app manifest, apple-touch-icon
- URL: `/` in dev/prod (e.g., `/logo-mark.png` in index.html)

## Key File Locations

**Entry Points:**
- Browser: `index.html` → loads `/src/main.jsx`
- App boot: `src/main.jsx` → ReactDOM renders `src/App.jsx` into `#root`
- Auth/status routing: `src/App.jsx` → `Shell()` component dispatches to screen

**Configuration:**
- Build: `vite.config.js` (port 3000, React plugin)
- Styles: `src/index.css` (imports tokens.css, Tailwind setup)
- Tokens: `src/design/tokens.css` (colors, spacing, shadows)
- Tailwind: `tailwind.config.js` (font, plugins)
- CSS: `postcss.config.js` (Tailwind processor)

**Core Logic:**
- State management: `src/hooks/useGuardian.js` (session, team data, actions, offline caching, realtime sync)
- API/Database: `src/lib/api.js` (Supabase CRUD, row mappers)
- Scheduling engine: `src/lib/autoAssign.js` (constraint solver, deterministic)
- Fairness: `src/lib/fairness.js` (load per guard, hints)
- Utilities: `src/lib/dates.js`, `src/lib/terms.js`, `src/lib/conflicts.js`

**Testing:**
- Scheduler: `scripts/verify-scheduler.mjs` (runs constraints, prints fairness)
- Backend: `scripts/verify-backend.mjs` (RPC functions)
- Planning: `scripts/verify-planning.mjs` (task logic)

## Naming Conventions

**Files:**
- Components: `PascalCase.jsx` (e.g., `SupervisorApp.jsx`, `WeekCalendar.jsx`)
- Hooks: `useCamelCase.js` (e.g., `useGuardian.js`, `useTheme.js`)
- Utilities: `camelCase.js` (e.g., `autoAssign.js`, `fairness.js`, `api.js`)
- Styles: `tokens.css` (global), or inline className (Tailwind)

**Directories:**
- Features: `lowercase` (e.g., `components/supervisor/`, `src/lib/`, `src/hooks/`)
- Utilities: Grouped by concern in `src/lib/` (not separate directories)

**Variables & Functions:**
- Constants: `UPPER_SNAKE_CASE` (e.g., `AVAILABILITY_ORDER`, `LOAD_WEIGHTS`, `DEFAULT_RULES`)
- Functions: `camelCase` (e.g., `availStatus()`, `shiftLoad()`, `autoAssign()`)
- React components: `PascalCase` (e.g., `function SupervisorApp() {}`)
- CSS classes: Tailwind utilities + custom `.glass`, `.glass-raised`, `.app-canvas`, `.safe-bottom`

**Database:**
- Supabase tables: `gs_` prefix (e.g., `gs_teams`, `gs_profiles`, `gs_shifts`, `gs_assignments`, `gs_availability`)
- Columns: `snake_case` (e.g., `start_time`, `required_guards`, `team_code`)
- App objects: `camelCase` (e.g., `startTime`, `requiredGuards`, `teamCode`)
- Mappers: `shiftFromRow()`, `profileFromRow()` in `api.js` convert snake → camel

## Where to Add New Code

**New Feature (e.g., "Guard Preferences"):**
- Algorithm: `src/lib/preferences.js` (pure functions, no React)
- API layer: Add methods to `src/lib/api.js` (fetch/update preferences from Supabase)
- State: Add fields to EMPTY object and action methods in `src/hooks/useGuardian.js`
- UI: New component `src/components/supervisor/PreferencesView.jsx` (or `src/components/GuardPreferences.jsx` if guard-facing)
- Integration: Export view from `src/components/supervisor/views.jsx` and add route in `SupervisorApp.jsx`

**New Component/Module:**
- Presentational: `src/components/FeatureName.jsx` (uses state from parent via props)
- Container: `src/components/FeatureContainer.jsx` (pulls from `useGuardian()` hook)
- Supervisor-specific: `src/components/supervisor/FeatureView.jsx`
- Guard-specific: `src/components/GuardFeature.jsx`

**Utilities & Pure Functions:**
- Date math: Add to `src/lib/dates.js`
- Vocabulary/i18n: Add to `src/lib/terms.js` (BASE object for all profiles, PROFILE_TERMS for overrides)
- New algorithms: Create `src/lib/algorithmName.js` (e.g., `src/lib/shiftOptimizer.js`)
- Mappers for new tables: Add to `src/lib/api.js` (`newEntityFromRow()`, `newEntityToRow()`)

**Tests:**
- Scheduler constraints: Add assertions to `scripts/verify-scheduler.mjs`
- New RPC functions: Add tests to `scripts/verify-backend.mjs`
- Task logic: Add to `scripts/verify-planning.mjs`

**Documentation:**
- Algorithm explainer: `docs/algorithm/featureName.md`
- Schema changes: `docs/database/schema-and-rls.md`
- Product specs: `docs/product/PRD.md` (or new .md in that folder)

## Special Directories

**`dist/`:**
- Purpose: Build output from `npm run build`
- Generated: Yes (via Vite)
- Committed: No (in .gitignore)
- Contents: Minified HTML, CSS, JS bundles, static assets

**`node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes (via npm install)
- Committed: No (in .gitignore)

**`public/`:**
- Purpose: Static assets copied to root of production build
- Generated: No
- Committed: Yes
- Examples: `/logo-mark.png`, `/manifest.json`, `/apple-touch-icon.png`

---

*Structure analysis: 2026-08-20*
