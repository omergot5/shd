# סכמת בסיס הנתונים ואבטחה

**מקור:** נשלף מהסכמה החיה של פרויקט Supabase `biauxcgphdhwewszupsq` ("Guardian Shifts"), 20 באוגוסט 2026.
כל הטבלאות בסכמת `public` ונושאות קידומת `gs_`.

> גרסה קודמת של המסמך תיארה טבלאות בשמות `users` / `shifts` / `assignments`.
> הן מעולם לא היו קיימות בפועל. מה שכתוב כאן הוא מה שיש.

---

## מפתח הבידוד: `team_code`

אין `organization_id` ואין טבלת ארגונים. **קוד הצוות הוא גבול הבידוד היחיד** —
מחרוזת בת שישה תווים שמנהל מקבל ביצירת הצוות ומחלק לאנשיו. כל טבלה ברמה
העליונה נושאת `team_code`, וכל שאילתה מסננת לפיו.

זה מכוון: הצטרפות לצוות היא הקלדת קוד, בלי הזמנות ובלי ניהול משתמשים.
המחיר — מי שמחזיק בקוד נמצא בפנים.

---

## טבלאות

### `gs_teams` — הצוות
| עמודה | טיפוס | הערה |
|---|---|---|
| `code` | text (PK) | קוד ההצטרפות |
| `name` | text | |
| `owner_id` | uuid | המשתמש שיצר |
| `avail_deadline_days` | int | כמה ימים לפני תחילת השבוע נסגרת הגשת הזמינות |
| `avail_deadline_hour` | int | באיזו שעה |
| `avail_reminders` | bool | |
| `mode` | text | `civil` \| `army` — תחום הפעילות. מחליף מונחים ותבניות, לא מבנה |

### `gs_profiles` — אנשים
`id`, `user_id` (nullable — אדם יכול להתקיים בסידור בלי חשבון), `full_name`,
`phone`, `role` (`supervisor` \| `guard`), `team_code`, `deadline_exempt`.

### `gs_shifts` — משמרות
`id`, `team_code`, `date`, `label`, `start_time`, `end_time`, `location`,
`required_guards`, `type`, `color`, `published`.

- `type` ∈ `morning` \| `afternoon` \| `evening` \| `night` \| `custom` — מזין את
  משקלי הנטל במנוע ואת סולם הצבעים.
- `color` — hex. ברירת המחדל בבסיס הנתונים היא `#7FC0AE` (מנטת הבוקר).
  ערכי ברירת מחדל ישנים מהתקופה שלפני המיתוג ממופים מחדש **בקריאה**
  (`src/design/shiftPalette.js`), בלי מיגרציה.
- `published` — משמרת שלא פורסמה אינה נראית למשתתפים.

### `gs_availability` — הגשות זמינות
מפתח מורכב `(shift_id, guard_id)`. `status` ∈ `preferred` \| `available` \|
`maybe` \| `unavailable`. חוסר שורה = `unknown`, וזה מצב לגיטימי שהמנוע יודע
לטפל בו.

### `gs_assignments` — שיבוצים
`(shift_id, guard_id)`, `source` (`auto` \| `manual`), `score`, `reason`.
**`reason` הוא חוזה מוצר, לא לוג:** זהו ההסבר שהמשתתף רואה למה נבחר.

### `gs_swap_requests` — החלפות
`shift_id`, `from_guard`, `to_guard`, `status` (`pending` \| `approved` \| `rejected`), `message`.

### `gs_task_templates` — תבניות משימה
`team_code?`, `mode`, `title`, `category`, `icon`, `positions` (jsonb), `priority`, `sort`.

`team_code` nullable: שורה בלי קוד היא תבנית מובנית לכולם, שורה עם קוד היא
תבנית של צוות מסוים. `positions` מייצר משימה נפרדת לכל עמדה — "עמדות" אינה
משימה אחת ששלושה עושים, אלא שלוש משימות שכל אחת מאוישת בנפרד.

### `gs_role_compatibility` — מטריצת התנגשויות
`team_code?`, `a`, `b`, `rule` (`allow` \| `block`), `note`.

הזוג נשמר **ממוין** (`a <= b`, נאכף ב-check constraint) ולכן היחס סימטרי
מעצם המבנה. **היעדר שורה פירושו "מותר"** — תיקייה חדשה לא חוסמת בשקט כלום.
שורה של צוות גוברת על המובנה.

### `gs_tasks` — משימות ותיקיות
`title`, `description`, `category`, `assignees` (jsonb, ברירת מחדל `[]`),
`assigned_to` (נשמר לתאימות — מתמלא באיש הראשון), `status`, `priority`,
`start_date`, `due_date`, `override_note`.

**תיקייה היא טקסט חופשי בעמודת `category`, לא טבלה.** בכוונה: תיקייה כאן היא
תווית שמנהל ממציא תוך כדי עבודה ("שמירות", "מטבח", "סיור"), לא ישות שמישהו
מתחזק. אינדקס `gs_tasks_team_category_idx` על `(team_code, category)`.

---

## RLS

מופעל על כל הטבלאות. העיקרון:

- **משתתף** — קורא משמרות שפורסמו בצוות שלו; כותב אך ורק את שורות הזמינות
  שלו; פותח בקשת החלפה למשמרת שהוא משובץ בה.
- **מנהל** — CRUD מלא בגבולות ה-`team_code` שלו.
- אף מדיניות אינה חוצה `team_code`.

---

## מיגרציות

`supabase/migrations/` מכיל את מה שהורץ ידנית מעבר לסכמה הראשונית:

| קובץ | מה עשה |
|---|---|
| `0002_task_folders.sql` | הוסיף `category`, `assignees`, `start_date` + backfill + אינדקס |
| `0003_workspace_mode.sql` | הוסיף `gs_teams.mode` עם check constraint |
| `0004_task_templates_and_compatibility.sql` | שתי הטבלאות החדשות + RLS + זרעים + `override_note` |

בנוסף הורצה `brand_shift_color_default` — שינוי ברירת המחדל של `gs_shifts.color`
מ-`#3B82F6` ל-`#7FC0AE`.
