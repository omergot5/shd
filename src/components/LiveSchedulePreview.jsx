// ============================================================
// הסידור שמסדר את עצמו — הפיצ'ר של מסך הכניסה.
//
// מסך כניסה שכתוב עליו "שיבוץ חכם" מבקש מהמבקר להאמין למילה. הלוח הזה
// *מראה* לו: שבעה ימים מתמלאים לנגד עיניו, שם אחרי שם, ובסוף נדלקת שורת
// "הסידור מוכן". מי שמסדר משמרות ביד מזהה תוך שנייה מה נחסך לו — וזה
// המשפט היחיד שהמסך הזה צריך להעביר.
//
// שלוש החלטות שמחזיקות את זה:
//
//   1. **אנימציית CSS בלבד.** אין `setInterval`, אין state, אין רינדור מחדש.
//      ההשהיה של כל תא היא `animation-delay` שמחושב מהאינדקס, והלולאה היא
//      `infinite`. מסך כניסה שמבזבז מחזורי מעבד על אנימציה הוא סתירה עצמית.
//
//   2. **נתונים אמיתיים למראה, לא Lorem.** שמות עבריים, שעות סבירות, וצבעים
//      מאותה פלטה של המוצר עצמו. מי שייכנס אחר כך יראה את אותו לוח בדיוק.
//
//   3. **מכובד ל-`prefers-reduced-motion`.** מי שביקש פחות תנועה מקבל את
//      הלוח מלא ודומם — לא ריק. המידע הוא העיקר, התנועה היא הקישוט.
// ============================================================

import { DAYS_HE_SHORT } from "../lib/dates.js";
import { SHIFT_TONES } from "../design/shiftPalette.js";
import { readableInk } from "./ui.jsx";

const NAMES = ["דן", "רינה", "גיא", "אבי", "נועה", "מיכל", "יובל"];

/**
 * שתי שורות: בוקר ולילה.
 *
 * הצבעים נלקחים מ-`SHIFT_TONES` ולא מטוקני `brand`/`accent` — שניהם
 * טורקיז, ובלוח קטן הם נקראו כאותו צבע בדיוק. כאן, כמו בכל המוצר,
 * בהיר = מוקדם וכהה = מאוחר, ולכן ההדגמה מלמדת את השפה של המסך
 * שאליו נכנסים אחריה.
 */
const ROWS = [
  { label: "07:00", bg: SHIFT_TONES.morning },
  { label: "19:00", bg: SHIFT_TONES.night },
];

export default function LiveSchedulePreview() {
  return (
    <div
      className="glass-raised rounded-3xl p-4 sm:p-5 select-none w-full max-w-md"
      // הלוח הוא קישוט שמדגים את המוצר. קורא מסך שיקריא 14 שמות בדויים
      // רק יעכב את מי שבא להתחבר.
      aria-hidden="true"
    >
      <div className="mb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-brand">
            כך זה נראה
          </p>
          <p className="text-sm font-bold text-content mt-0.5">שבוע שלם, בלחיצה אחת</p>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {DAYS_HE_SHORT.map((d) => (
          <div key={d} className="text-center text-[10px] font-bold text-faint pb-0.5">
            {d}
          </div>
        ))}

        {ROWS.map((row, r) =>
          DAYS_HE_SHORT.map((d, i) => {
            // ההשהיה רצה על פני שתי השורות ברצף, כך שהלוח מתמלא
            // יום־אחרי־יום ולא שורה־אחרי־שורה — בדיוק כמו שאדם היה ממלא.
            const step = r * 7 + i;
            return (
              <div
                key={`${row.label}-${d}`}
                style={{
                  animationDelay: `${step * 0.14}s`,
                  background: row.bg,
                  color: readableInk(row.bg),
                }}
                className="rounded-lg px-0.5 sm:px-1 py-1.5 text-center
                  animate-slot-in motion-reduce:animate-none"
              >
                <span className="block text-[9px] font-semibold opacity-80" data-numeric>
                  {row.label}
                </span>
                <span className="block text-[10px] font-bold truncate leading-tight">
                  {NAMES[(step * 3 + r) % NAMES.length]}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* השורה התחתונה נדלקת אחרי שכל התאים מלאים — היא הפאנץ' של ההדגמה. */}
      <div
        style={{ animationDelay: "2.2s" }}
        className="mt-4 flex items-center gap-2.5 rounded-xl bg-surface-sunken ring-1 ring-inset ring-hairline px-3 py-2.5
          animate-slot-in motion-reduce:animate-none"
      >
        <span className="w-6 h-6 rounded-full bg-accent text-on-accent flex items-center justify-center flex-shrink-0 text-[13px] font-black">
          ✓
        </span>
        <span className="text-xs text-content font-semibold leading-snug">
          14 משמרות · 0 הפרות מנוחה
          <span className="block text-[11px] text-muted font-medium">
            כל שיבוץ עם הסבר למה דווקא הוא
          </span>
        </span>
      </div>
    </div>
  );
}
