# 🗄️ סכמת בסיס הנתונים ואבטחה (Database & RLS)

המערכת מבוססת על **Supabase PostgreSQL** ומיישמת מדיניות אבטחה מבוססת תפקידים ו-Row Level Security (RLS).

---

## 📊 ישויות ליבה (Core Entities)

1. **`users` (משתמשים / שומרים ומנהלים):**
   - שדות: `id`, `name`, `email`, `role` (`supervisor` / `guard`), `phone`, `avatar`.
2. **`shifts` (תקני משמרות שבועיות):**
   - שדות: `id`, `week_id`, `day`, `name`, `start_time`, `end_time`, `required_guards`, `shift_type`.
3. **`availabilities` (הגשות זמינות):**
   - שדות: `id`, `shift_id`, `user_id`, `status` (`available` / `maybe` / `unavailable`).
4. **`assignments` (שיבוצים בפועל):**
   - שדות: `id`, `shift_id`, `user_id`, `assigned_by` (`auto` / `manual`), `status` (`draft` / `published`).
5. **`swap_requests` (בקשות להחלפת משמרת):**
   - שדות: `id`, `from_user_id`, `to_user_id`, `shift_id`, `status` (`pending` / `approved` / `rejected`), `reason`.

---

## 🔒 מדיניות אבטחה (RLS Principles)
- **מאבטח (Guard):**
  - רשאי לקרוא משמרות וסידורים שפורסמו (`published`).
  - רשאי לכתוב ולערוך אך ורק את הזמינויות שלו (`user_id = auth.uid()`).
  - רשאי לפתוח בקשת החלפה עבור משמרת שלו.
- **אחמ"ש / מנהל (Supervisor):**
  - הרשאות מלאות (CRUD) על יצירת משמרות, הרצת שיבוץ אוטומטי, פרסום סידור ואישור החלפות.
