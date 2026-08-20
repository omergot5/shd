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
│   ├── supervisor/      # ממשק האחמ"ש (WeekFlow, תצוגות ניהול, שיבוץ)
│   ├── GuardApp.jsx     # ממשק המאבטח / משתתף
│   ├── SupervisorApp.jsx# עוטף ממשק מנהל
│   └── ui.jsx           # רכיבי UI בסיסיים (Buttons, Cards, UndoBar, EmptyStates)
├── hooks/
│   └── useGuardian.js   # ה-State המרכזי, סנכרון עם API ושמירה מקומית
├── lib/
│   ├── api.js           # שכבת התקשורת מול Supabase / Mock API
│   ├── autoAssign.js    # מנוע השיבוץ הדטרמיניסטי
│   ├── terms.js         # מילון המונחים המרכזי לתמיכה בפרופילים
│   └── shareImage.js    # מנוע רינדור הסידור השבועי ל-PNG דרך Canvas
├── index.css            # עיצוב גלובלי, הגדרות כיווניות RTL ופונטים
└── App.jsx              # עטיפת האפליקציה, ראוטינג וניהול משתמש נוכחי
```

---

## 🔄 זרימת הנתונים (State Flow)
1. כל הנתונים (משמרות, שומרים, זמינויות, שיבוצים, החלפות) מנוהלים בריכוז דרך `useGuardian()`.
2. פעולות מחיקה ושינוי עוברות דרך מנגנון `deferred` של 8 שניות (המאפשר ביטול מיידי ב-`UndoBar` ללא חלונות אישור מעיקים).
3. נתונים נשמרים מקומית במקביל ב-`localStorage` כך שהאפליקציה נטענת מיידית גם ללא רשת (Offline Mode).
