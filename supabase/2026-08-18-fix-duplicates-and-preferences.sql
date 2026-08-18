-- ============================================================
-- Smart Shift Management — 2026-08-18
--
-- Run this whole file once in the Supabase SQL editor:
--   Dashboard -> SQL Editor -> New query -> paste -> Run
--
-- It does three things:
--   1. Merges the duplicate guard profiles that already exist.
--   2. Stops new duplicates being created, structurally.
--   3. Adds the "preferred" availability tier the scheduler now reads.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Repair: merge duplicate guards
--
-- A guard's session is anonymous. Clear browser data, switch device, or just
-- let the token expire, and signInAnonymously() hands out a NEW auth uid.
-- gs_join_team looked the person up by uid, found nothing, and inserted a
-- second profile. Every visit produced another copy — which is why
-- דניאל אולבסקי appeared three times, with his assignments on one copy and
-- his availability on another.
--
-- Keep the oldest profile per (team, name): it is the one the supervisor
-- created and the one carrying the phone number. Move everything the younger
-- copies own onto it, then remove them. No assignment or availability is
-- lost — only the empty shells.
-- ------------------------------------------------------------

create temporary table gs_dupes on commit drop as
select id,
       first_value(id) over (
         partition by team_code, lower(btrim(full_name))
         order by created_at
       ) as keeper
from public.gs_profiles
where role = 'guard';

-- Drop collisions first: the keeper may already hold the same shift, and the
-- (shift_id, guard_id) primary key would reject the move.
delete from public.gs_assignments a
using gs_dupes d
where a.guard_id = d.id and d.id <> d.keeper
  and exists (select 1 from public.gs_assignments k
              where k.guard_id = d.keeper and k.shift_id = a.shift_id);

update public.gs_assignments a set guard_id = d.keeper
from gs_dupes d where a.guard_id = d.id and d.id <> d.keeper;

delete from public.gs_availability v
using gs_dupes d
where v.guard_id = d.id and d.id <> d.keeper
  and exists (select 1 from public.gs_availability k
              where k.guard_id = d.keeper and k.shift_id = v.shift_id);

update public.gs_availability v set guard_id = d.keeper
from gs_dupes d where v.guard_id = d.id and d.id <> d.keeper;

update public.gs_swap_requests s set from_guard = d.keeper
from gs_dupes d where s.from_guard = d.id and d.id <> d.keeper;

update public.gs_swap_requests s set to_guard = d.keeper
from gs_dupes d where s.to_guard = d.id and d.id <> d.keeper;

update public.gs_tasks t set assigned_to = d.keeper
from gs_dupes d where t.assigned_to = d.id and d.id <> d.keeper;

delete from public.gs_profiles p
using gs_dupes d where p.id = d.id and d.id <> d.keeper;


-- ------------------------------------------------------------
-- 2a. Prevention, belt: one guard per name per team
--
-- Two people with the same name in one team now need a distinguishing
-- suffix ("דניאל א."). That is a small cost for making the corruption
-- impossible rather than merely unlikely.
-- ------------------------------------------------------------

create unique index if not exists gs_profiles_one_name_per_team
  on public.gs_profiles (team_code, lower(btrim(full_name)))
  where role = 'guard';


-- ------------------------------------------------------------
-- 2b. Prevention, braces: adopt the returning guard
--
-- The name within a team is the stable identity here, not the anonymous uid.
-- When the uid is unknown, adopt the existing guard of that name and re-point
-- it at the current session. Unclaimed placeholders are preferred, and the
-- oldest match wins so the supervisor-created row survives.
--
-- The trade-off is deliberate: anyone holding the team code can already read
-- the roster, so name-based adoption grants nothing the code did not. The
-- alternative is a duplicate on every visit, which is worse.
-- ------------------------------------------------------------

create or replace function public.gs_join_team(p_code text, p_full_name text)
returns table(profile_id uuid, team_code text, team_name text, full_name text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_code  text;
  v_name  text;
  v_prof  record;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if coalesce(btrim(p_full_name), '') = '' then
    raise exception 'NAME_REQUIRED';
  end if;

  select t.code, t.name into v_code, v_name
    from public.gs_teams t where t.code = upper(btrim(p_code));
  if not found then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  -- Known session: nothing to do.
  select * into v_prof from public.gs_profiles p where p.user_id = auth.uid();
  if found then
    if v_prof.team_code <> v_code then
      raise exception 'ALREADY_IN_ANOTHER_TEAM';
    end if;
    profile_id := v_prof.id; team_code := v_prof.team_code;
    team_name := v_name; full_name := v_prof.full_name; return next; return;
  end if;

  -- Unknown session, known name: a returning guard.
  select * into v_prof from public.gs_profiles p
    where p.team_code = v_code
      and p.role = 'guard'
      and lower(btrim(p.full_name)) = lower(btrim(p_full_name))
    order by (p.user_id is not null), p.created_at
    limit 1;

  if found then
    update public.gs_profiles set user_id = auth.uid() where id = v_prof.id;
    profile_id := v_prof.id; team_code := v_code;
    team_name := v_name; full_name := v_prof.full_name; return next; return;
  end if;

  -- Genuinely new person.
  insert into public.gs_profiles (user_id, full_name, role, team_code)
    values (auth.uid(), btrim(p_full_name), 'guard', v_code)
    returning * into v_prof;

  profile_id := v_prof.id; team_code := v_code;
  team_name := v_name; full_name := v_prof.full_name; return next;
end;
$function$;


-- ------------------------------------------------------------
-- 3. The "preferred" availability tier
--
-- "I can work Sunday, but I'd rather have Tuesday" was previously
-- unexpressible: marking Sunday unavailable closes the option, marking it
-- available says nothing about the preference. A fourth level sits above
-- "available" — it never blocks a shift, it only outranks.
-- ------------------------------------------------------------

alter table public.gs_availability
  drop constraint if exists gs_availability_status_check;

alter table public.gs_availability
  add constraint gs_availability_status_check
  check (status = any (array['preferred'::text, 'available'::text, 'maybe'::text, 'unavailable'::text]));


-- ------------------------------------------------------------
-- Verify
-- ------------------------------------------------------------

select team_code, full_name, count(*) as copies
from public.gs_profiles
where role = 'guard'
group by 1, 2
having count(*) > 1;
-- Expect: 0 rows.
