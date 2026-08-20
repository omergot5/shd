-- ============================================================
-- תיקיות משימות, טווח תאריכים, ושיוך מרובה.
--
-- שלוש עמודות בלבד, כולן nullable ועם ברירת מחדל — ולכן ההרצה בטוחה
-- על טבלה מלאה ולא נוגעת בשורות קיימות.
--
--   category   שם התיקייה כטקסט חופשי ("שמירות", "מטבח", "סיור").
--              לא טבלה נפרדת בכוונה: תיקייה כאן היא תווית שמנהל משמרת
--              ממציא תוך כדי עבודה, ולא ישות שמישהו מתחזק.
--   assignees  מערך של מזהי אנשים. `assigned_to` הישן נשאר וממשיך
--              להתמלא באיש הראשון, כדי ששום קוד ישן לא יישבר.
--   start_date תחילת החלון. `due_date` כבר קיים והוא הסוף שלו.
-- ============================================================

alter table gs_tasks add column if not exists category   text;
alter table gs_tasks add column if not exists assignees  jsonb not null default '[]'::jsonb;
alter table gs_tasks add column if not exists start_date date;

-- משימות שנוצרו לפני השינוי מקבלות את המשויך היחיד שלהן לתוך המערך,
-- כך שמסך התיקיות מראה אותן נכון מהרגע הראשון.
update gs_tasks
   set assignees = jsonb_build_array(assigned_to)
 where assigned_to is not null
   and assignees = '[]'::jsonb;

-- שליפה לפי תיקייה היא הפעולה שהמסך עושה בכל טעינה.
create index if not exists gs_tasks_team_category_idx
    on gs_tasks (team_code, category);
