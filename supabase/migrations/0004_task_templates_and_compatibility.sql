-- ============================================================
-- תבניות משימה + מטריצת התנגשויות + עקיפה מודעת.
-- ============================================================

-- ---------- 1. תבניות משימה ----------
--
-- `team_code` הוא nullable בכוונה: שורה בלי קוד צוות היא תבנית מובנית
-- ששייכת לכולם, ושורה עם קוד היא תבנית שצוות מסוים המציא לעצמו. כך אין
-- צורך לשכפל את הקטלוג לכל צוות חדש שנוצר.
--
-- `positions` נושא את השדה הדינמי: "עמדות" היא תבנית אחת שמייצרת שלוש
-- משימות נפרדות, אחת לכל עמדה — כי עמדות אינן משימה אחת ששלושה עושים,
-- אלא שלוש משימות שכל אחת מאוישת בנפרד.

create table if not exists gs_task_templates (
  id          uuid primary key default gen_random_uuid(),
  team_code   text references gs_teams(code) on delete cascade,
  mode        text not null default 'civil' check (mode in ('civil','army','any')),
  title       text not null,
  category    text not null,
  icon        text,
  positions   jsonb not null default '[]'::jsonb,
  priority    text not null default 'medium',
  sort        int  not null default 100,
  created_at  timestamptz not null default now()
);

create index if not exists gs_task_templates_mode_idx
  on gs_task_templates (mode, sort);

alter table gs_task_templates enable row level security;

drop policy if exists gs_task_templates_read on gs_task_templates;
create policy gs_task_templates_read on gs_task_templates
  for select using (
    team_code is null
    or team_code in (select team_code from gs_profiles where user_id = auth.uid())
  );

drop policy if exists gs_task_templates_write on gs_task_templates;
create policy gs_task_templates_write on gs_task_templates
  for all using (
    team_code in (
      select team_code from gs_profiles
       where user_id = auth.uid() and role = 'supervisor'
    )
  );

-- `where not exists` שומר על ההרצה כאידמפוטנטית.
insert into gs_task_templates (team_code, mode, title, category, icon, positions, priority, sort)
select * from (values
  (null::text, 'army', 'סיור',          'סיור',   'target', '[]'::jsonb,                           'medium', 10),
  (null::text, 'army', 'עמדות',         'שמירות', 'shield', '["עמדה 1","עמדה 2","עמדה 3"]'::jsonb, 'high',   20),
  (null::text, 'army', 'מטבח',          'מטבח',   'inbox',  '[]'::jsonb,                           'medium', 30),
  (null::text, 'army', 'כוננות',        'כוננות', 'bell',   '[]'::jsonb,                           'high',   40),
  (null::text, 'army', 'מפקד כוננות',   'כוננות', 'star',   '[]'::jsonb,                           'high',   50),
  (null::text, 'army', 'נהגים בכוננות', 'כוננות', 'truck',  '[]'::jsonb,                           'medium', 60)
) as v(team_code, mode, title, category, icon, positions, priority, sort)
where not exists (
  select 1 from gs_task_templates t
   where t.team_code is null and t.mode = 'army' and t.title = v.title
);

-- ---------- 2. מטריצת ההתנגשויות ----------
--
-- זוג תיקיות ומה מותר ביניהן. הזוג נשמר **ממוין** (a <= b) כדי שהיחס יהיה
-- סימטרי מעצם המבנה, ולא בזכות קוד שזוכר לבדוק לשני הכיוונים.

create table if not exists gs_role_compatibility (
  id         uuid primary key default gen_random_uuid(),
  team_code  text references gs_teams(code) on delete cascade,
  a          text not null,
  b          text not null,
  rule       text not null default 'block' check (rule in ('allow','block')),
  note       text,
  created_at timestamptz not null default now(),
  constraint gs_role_compat_ordered check (a <= b)
);

create unique index if not exists gs_role_compat_pair_idx
  on gs_role_compatibility (coalesce(team_code, ''), a, b);

alter table gs_role_compatibility enable row level security;

drop policy if exists gs_role_compat_read on gs_role_compatibility;
create policy gs_role_compat_read on gs_role_compatibility
  for select using (
    team_code is null
    or team_code in (select team_code from gs_profiles where user_id = auth.uid())
  );

drop policy if exists gs_role_compat_write on gs_role_compatibility;
create policy gs_role_compat_write on gs_role_compatibility
  for all using (
    team_code in (
      select team_code from gs_profiles
       where user_id = auth.uid() and role = 'supervisor'
    )
  );

-- רק מה שבאמת מתנגש נרשם — היעדר שורה פירושו "מותר", כדי שהוספת תיקייה
-- חדשה לא תחסום בשקט כלום.
insert into gs_role_compatibility (team_code, a, b, rule, note)
select * from (values
  (null::text, 'כוננות', 'מטבח',   'allow', 'כוננות היא זמינות, לא נוכחות — אפשר להיות בכונן ולעבוד במטבח'),
  (null::text, 'מטבח',   'שמירות', 'block', 'עמדת שמירה דורשת נוכחות פיזית רצופה'),
  (null::text, 'סיור',   'שמירות', 'block', 'אי אפשר לאייש עמדה ולנוע בו־זמנית'),
  (null::text, 'כוננות', 'שמירות', 'block', 'עמדה מאיישת — היא לא כוננות'),
  (null::text, 'מטבח',   'סיור',   'block', 'סיור הוא תנועה מחוץ למטבח')
) as v(team_code, a, b, rule, note)
where not exists (
  select 1 from gs_role_compatibility c
   where c.team_code is null and c.a = v.a and c.b = v.b
);

-- ---------- 3. עקיפה מודעת ----------
--
-- מנהל רשאי לאלץ שיבוץ שמתנגש — אבל לא בשקט. ההערה נשמרת לצד השיבוץ
-- ומצטרפת להסבר שהאדם עצמו רואה.

alter table gs_assignments add column if not exists override_note text;
alter table gs_tasks       add column if not exists override_note text;
