-- ============================================================
-- תחום הפעילות של הצוות: אזרחי או צבאי.
--
-- הבחירה כבר הייתה קיימת במוצר, אבל היא ישבה ב-localStorage — כלומר כל
-- אדם בצוות ראה מילון מונחים אחר, ושיחה על "תורנות" מול "משמרת" הפכה
-- לבלבול אמיתי. תחום פעילות הוא תכונה של הארגון, לא העדפה של דפדפן.
--
-- ברירת המחדל `civil` שומרת על כל צוות קיים בדיוק כפי שהוא.
-- ============================================================

alter table gs_teams
  add column if not exists mode text not null default 'civil';

alter table gs_teams drop constraint if exists gs_teams_mode_chk;
alter table gs_teams
  add constraint gs_teams_mode_chk check (mode in ('civil','army'));
