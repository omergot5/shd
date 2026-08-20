# External Integrations

**Analysis Date:** 2026-08-20

## APIs & External Services

**Supabase Backend:**
- Service: Supabase (managed PostgreSQL + hosted authentication)
- What it's used for: All data persistence, user authentication, real-time subscriptions, and row-level security enforcement
- SDK/Client: @supabase/supabase-js 2.101.0 (`src/lib/supabaseClient.js`)
- Auth: Email/password (supervisor registration), anonymous auth (guards joining without signup), password recovery via email recovery links

## Data Storage

**Databases:**
- Provider: Supabase (PostgreSQL)
  - Project URL: `https://biauxcgphdhwewszupsq.supabase.co`
  - Connection: Environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
  - Client: @supabase/supabase-js 2.101.0
  - Region: Not specified (inferred from URL)
- Connection Pooling: Supabase manages connection pooling automatically
- Tables (all prefixed `gs_`):
  - `gs_teams` — Team metadata and availability deadlines
  - `gs_profiles` — User/guard profiles with roles and team membership
  - `gs_shifts` — Shift definitions (date, time, location, required count, type, color)
  - `gs_assignments` — Guard-to-shift assignments with scoring and source tracking
  - `gs_availability` — Guard availability submissions (status + optional comment)
  - `gs_swap_requests` — Shift swap requests with approval workflow
  - `gs_tasks` — Tasks/missions organized by category (folder) with assignees and due dates
  - `gs_task_templates` — Reusable task templates (built-in and team-specific)
  - `gs_role_compatibility` — Matrix of role pairs with conflict rules (allow/block)

**File Storage:**
- Local filesystem only — No cloud file storage (S3, Firebase Storage, etc.)
- localStorage used for session persistence and undo state

**Caching:**
- None — No Redis, Memcached, or caching layer
- Session caching: Browser-based via `localStorage` (Supabase SDK handles)

## Authentication & Identity

**Auth Provider:**
- Service: Supabase Auth (built-in to Supabase)
- Implementation:
  - Supervisor registration: Email + password signup (`registerSupervisor` in `src/lib/api.js` line 132)
  - Supervisor login: Email + password login (`loginSupervisor` in `src/lib/api.js` line 152)
  - Guard onboarding: Anonymous or anonymous-then-identified auth (`joinAsGuard` in `src/lib/api.js` line 186)
  - Password recovery: Email recovery link with token in URL fragment (`requestPasswordReset` in `src/lib/api.js` line 173)
  - Logout: Supabase sign out
- Session persistence: Enabled (`persistSession: true` in `src/lib/supabaseClient.js` line 13)
- Auto token refresh: Enabled (`autoRefreshToken: true` in `src/lib/supabaseClient.js` line 14)
- Session detection in URL: Enabled for password recovery flow (`detectSessionInUrl: true` in `src/lib/supabaseClient.js` line 18)
- Storage key: Custom key `gs-auth` for session storage

**Row-Level Security (RLS):**
- All tables have RLS policies enabled
- Isolation by `team_code` — Users can only access data within their team
- Supervisor role: Full CRUD within team boundaries
- Guard role: Read published shifts, write own availability, create swap requests
- Policies prevent cross-team data leakage

## Monitoring & Observability

**Error Tracking:**
- None detected — No Sentry, LogRocket, or error logging service

**Logs:**
- Browser console only (`console.log`, error handling in components)
- No server-side logging configured
- Error messages translated to Hebrew for user display (`translateAuthError` in `src/lib/api.js` line 226)

## CI/CD & Deployment

**Hosting:**
- Platform: Vercel
  - Project ID: `prj_nGpAmMX4dkNStmG2Bh8va7gU0Rq1`
  - Org ID: `team_rWBN0jW3CPJWpJ4YRIR1ydJr`
  - Project name: `shd`
  - Configured in `.vercel/project.json`

**Build Process:**
- Build command: `npm run build` (runs Vite bundler)
- Output: `dist/` folder (static files)
- Dev server: `npm run dev` (Vite on port 3000, auto-detected via PORT env var)
- Preview: `npm run preview` (local production build preview)

**CI Pipeline:**
- None detected (no GitHub Actions, GitLab CI, or similar)
- Tests run locally: `npm test` executes custom Node.js scripts

## Environment Configuration

**Required env vars:**
- `VITE_SUPABASE_URL` — Supabase project URL (defaults to production if not set)
- `VITE_SUPABASE_ANON_KEY` — Supabase publishable key (defaults to production if not set)
- `PORT` — (Optional) dev server port; defaults to 3000 if not set

**Secrets location:**
- `.env.local` file (Git-ignored, not committed)
- Supabase keys are publishable and safe in client code (RLS enforces security)
- No private backend keys or secrets stored in frontend

**Development overrides:**
- `.env.local` can repoint the app to a staging Supabase project without code changes
- Supabase project URL and key are hardcoded as fallbacks in `src/lib/supabaseClient.js` lines 6-9

## Webhooks & Callbacks

**Incoming:**
- Password recovery redirect: `window.location.origin` (current origin, no specific webhook endpoint)
- Session detection in URL: Enabled for token exchange during password reset (`detectSessionInUrl: true`)

**Outgoing:**
- None detected
- Supabase real-time subscriptions: Used in `src/hooks/useGuardian.js` for live data updates on shifts, assignments, availability, and swap requests
- Listen channels: `gs_shifts`, `gs_assignments`, `gs_availability`, `gs_profiles`, `gs_swap_requests`

## External Font Services

**Google Fonts:**
- Rubik — Primary sans-serif font (excellent Hebrew support)
- Heebo — Secondary sans-serif font (Hebrew fallback)
- Monospace system stack fallback if fonts fail to load
- Configured in `tailwind.config.js` lines 60-72

## Offline Capability

**Local-only mode:**
- App detects cloud connectivity via `pingCloud()` function (`src/lib/supabaseClient.js` line 32)
- Falls back to localStorage-only mode when Supabase is unreachable
- Schedule stored in `localStorage` for offline access
- Demo mode can run entirely offline with seeded data

---

*Integration audit: 2026-08-20*
