# 🏗️ ארכיטקטורת המערכת (System Architecture)

מבט-על על מבנה הקוד, שכבות האפליקציה וזרימת הנתונים ב-React.

---

## 🛠️ מחסנית טכנולוגית (Tech Stack)
- **Frontend Core:** React 18+, Vite, Vanilla CSS + Tailwind CSS.
- **State Management:** React Custom Hook (`src/hooks/useGuardian.js`).
- **Backend & Database:** Supabase (PostgreSQL + RLS + Auth).
- **Hosting & CI/CD:** Vercel.
- **Offline / PWA:** Service Worker (`public/sw.js`) + `localStorage` cache.

---

## 📂 מבנה הספריות בקוד (`src/`)

```text
src/
├── components/
│   ├── supervisor/
│   │   ├── WeekFlow.jsx        # מסך "השבוע" — ארבעת השלבים, לב חוויית האחמ"ש
│   │   ├── views.jsx           # מסכי הניהול (צוות, זמינות, החלפות, משימות)
│   │   ├── CalendarView.jsx    # יומן חודש / שבוע / יום
│   │   ├── WeekCalendar.jsx    # רשת שעות×ימים — מראה את *החורים* בסידור
│   │   └── Analytics.jsx       # דוחות (recharts, נטען lazy — חצי מה-bundle)
│   ├── GuardApp.jsx            # ממשק המאבטח / משתתף
│   ├── SupervisorApp.jsx       # עוטף ממשק מנהל
│   ├── SmartAssign.jsx         # מסך השיבוץ החכם — כללים, תוצאה ונימוקים
│   ├── AuthPage.jsx            # הרשמה, כניסה, שחזור סיסמה, הצטרפות לצוות
│   ├── LiveSchedulePreview.jsx # ההדגמה המונפשת במסך הכניסה (CSS בלבד)
│   ├── Logo.jsx / icons.jsx    # נכסי המותג וסט האייקונים
│   ├── ThemeToggle.jsx         # בהיר / כהה / לפי המערכת
│   └── ui.jsx                  # רכיבי UI בסיסיים (Buttons, Cards, UndoBar, EmptyStates)
├── hooks/
│   ├── useGuardian.js   # ה-State המרכזי, סנכרון עם API ושמירה מקומית
│   └── useTheme.js      # ערכת הנושא, חנות אחת דרך useSyncExternalStore
├── lib/
│   ├── api.js           # שכבת התקשורת מול Supabase — המקום היחיד שמכיר שמות עמודות
│   ├── supabaseClient.js# הלקוח, ו-pingCloud() שמחליט אם ליפול למצב מקומי
│   ├── autoAssign.js    # מנוע השיבוץ הדטרמיניסטי
│   ├── conflicts.js     # מטריצת ההתנגשויות בין סוגי משימות (טבלה שמנהל עורך)
│   ├── fairness.js      # הוגנות בחלון מתגלגל — "כמה חסר לו", לא "הוא עמוס"
│   ├── dates.js         # תאריכי YYYY-MM-DD מקומיים, בלי מעבר דרך UTC
│   ├── terms.js         # מילון המונחים המרכזי לתמיכה בפרופילים
│   ├── demoData.js      # שבוע הדגמה שאינו טריוויאלי לפתרון
│   └── shareImage.js    # מנוע רינדור הסידור השבועי ל-PNG דרך Canvas
├── design/
│   ├── tokens.css       # טוקני הצבע והמרווח, בהיר וכהה
│   └── shiftPalette.js  # סולם צבעי המשמרות — ככל שמאוחר יותר, כהה יותר
├── index.css            # עיצוב גלובלי, הגדרות כיווניות RTL ופונטים
└── App.jsx              # עטיפת האפליקציה, ראוטינג, ErrorBoundary ומשתמש נוכחי
```

מחוץ ל-`src/`: `scripts/` מחזיק את בדיקות ה-Node העצמאיות (`verify-scheduler`, `verify-planning`, `verify-backend`), `supabase/migrations/` את שינויי הסכמה, ו-`public/` את ה-service worker וה-manifest.

---

## 🔄 זרימת הנתונים (State Flow)
1. כל הנתונים (משמרות, שומרים, זמינויות, שיבוצים, החלפות) מנוהלים בריכוז דרך `useGuardian()`.
2. פעולות מחיקה ושינוי עוברות דרך מנגנון `deferred` של 8 שניות (המאפשר ביטול מיידי ב-`UndoBar` ללא חלונות אישור מעיקים).
3. נתונים נשמרים מקומית במקביל ב-`localStorage` כך שהאפליקציה נטענת מיידית גם ללא רשת (Offline Mode).
