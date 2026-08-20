# Technology Stack

**Analysis Date:** 2026-08-20

## Languages

**Primary:**
- JavaScript (ES modules) — Used throughout the codebase for React components, logic, and build configuration
- JSX — React component syntax in `.jsx` files

**Secondary:**
- SQL — Supabase migrations and RLS policies in `supabase/migrations/`

## Runtime

**Environment:**
- Node.js v24.18.1 (confirmed in development environment)

**Package Manager:**
- npm (installed locally)
- Lockfile: `package-lock.json` present (107,386 bytes)

## Frameworks

**Core:**
- React 18.2.0 — Client-side UI framework
- React DOM 18.2.0 — React rendering for browsers

**Charting/Visualization:**
- Recharts 2.12.3 — Data visualization library for scheduling and assignment charts

**Build/Dev:**
- Vite 5.2.0 — Fast frontend build tool and dev server
  - Plugin: @vitejs/plugin-react 4.2.1 — JSX transformation and Fast Refresh
- Tailwind CSS 3.4.1 — Utility-first CSS framework for styling
- PostCSS 8.4.38 — CSS processing pipeline
- Autoprefixer 10.4.19 — Automatic vendor prefixes for CSS compatibility

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.101.0 — Supabase client SDK for database and authentication access
  - Enables row-level security (RLS) enforcement at the database level
  - Handles session persistence and auto token refresh
  - Location: `src/lib/supabaseClient.js`

**Frontend Libraries:**
- React 18.2.0 — Foundation for all UI components
- Recharts 2.12.3 — Charting for shift schedules and compatibility matrices
- Tailwind CSS 3.4.1 — Complete styling solution

**Build Dependencies:**
- Vite 5.2.0 — Modern bundler with dev server
- @vitejs/plugin-react 4.2.1 — React/JSX support
- PostCSS 8.4.38 + Autoprefixer 10.4.19 — CSS toolchain for Tailwind

## Configuration

**Environment:**
- Vite environment variables: `VITE_*` prefix for client-side exposure
- Critical vars:
  - `VITE_SUPABASE_URL` — Supabase project URL
  - `VITE_SUPABASE_ANON_KEY` — Supabase anonymous key (publishable, safe in client code)
- Defaults embedded: `src/lib/supabaseClient.js` lines 6-9 (fallback to production Supabase project)
- Local overrides: `.env.local` file (not committed to git)

**Build:**
- `vite.config.js` — Vite configuration (React plugin, port configuration via `PORT` env var or default 3000)
- `tailwind.config.js` — Tailwind theme extension with custom colors, animations, and font stack
- `postcss.config.js` — PostCSS plugin configuration (Tailwind + Autoprefixer)

## Platform Requirements

**Development:**
- Node.js v24.x (tested with v24.18.1)
- npm (any recent version compatible with Node.js)
- Modern browser (development server runs on port 3000)
- Optional: `.env.local` for environment variable overrides

**Production:**
- Deployment target: Vercel (confirmed by `.vercel/project.json`)
  - Project ID: `prj_nGpAmMX4dkNStmG2Bh8va7gU0Rq1`
  - Organization ID: `team_rWBN0jW3CPJWpJ4YRIR1ydJr`
  - Project name: `shd`
- Vite build output to `dist/` folder
- Static site hosting (SPA with client-side routing)

## Test Environment

**Test Framework:**
- Node.js scripts — Custom test runners in `scripts/` directory
- Run via: `npm test` (runs `scripts/verify-scheduler.mjs` and `scripts/verify-planning.mjs`)
- Also: `npm test:backend` (runs `scripts/verify-backend.mjs`)
- No external testing framework detected (no Jest, Vitest, etc.)

---

*Stack analysis: 2026-08-20*
