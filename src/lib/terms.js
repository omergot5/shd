/**
 * מילון המונחים — כל מילה שהמשתמש רואה ושמתארת *מה הוא עושה* חיה כאן.
 *
 * שתי סיבות לקובץ הזה, ורק שתיים:
 *
 * 1. עקביות. אם מסך אחד קורא לזה "פרסום סידור" ומסך אחר "שלח לצוות", המשתמש
 *    חושב שאלה שני דברים. כשהשם יושב במקום אחד, אי אפשר שהם יסטו.
 *
 * 2. פרופילים. אותה יכולת בדיוק נקראת אחרת בצבא ובמסעדה — "תורנות" מול
 *    "משמרת", "הצוות" מול "העובדים". ההבדל הזה הוא *אוצר מילים*, לא מבנה,
 *    ולכן הוא נפתר כאן ולא בעוד עץ רכיבים. אבן דרך ב' תמלא את
 *    `PROFILE_TERMS.army` — שום מסך לא ישתנה בגללה.
 *
 * הכלל: מונח שהוא שם של *יכולת* ("שיבוץ חכם") הוא באג. מונח הוא שם של
 * *פעולה* בגוף ראשון או שנייה ("סדר לי את השבוע").
 */

/** אוצר המילים האזרחי — ברירת המחדל, וגם הבסיס שכל פרופיל אחר יורש ממנו. */
const BASE = {
  // ניווט אחמ"ש
  "nav.dashboard":   "לוח בקרה",
  "nav.calendar":    "יומן",
  "nav.shifts":      "בניית השבוע",
  "nav.availability": "מי הגיש",
  "nav.smart":       "סדר לי את השבוע",
  "nav.assignment":  "לשבץ בעצמי",
  "nav.schedule":    "שלח לצוות",
  "nav.swaps":       "בקשות החלפה",
  "nav.tasks":       "משימות",
  "nav.analytics":   "דוחות",
  "nav.team":        "הצוות שלי",

  // ניווט משתתף
  "guard.nav.schedule":     "התורנויות שלי",
  "guard.nav.availability": "מתי אני יכול",
  "guard.nav.swaps":        "החלפות",

  // פעולות חוזרות
  "action.rerun":   "הרץ מחדש",
  "action.publish": "שלח לצוות",
};

/**
 * דריסות לפי פרופיל — רק המילים שבאמת שונות.
 *
 * מה שלא מופיע כאן יורש מ-BASE, וזה מכוון: פרופיל שמגדיר מחדש את כל אוצר
 * המילים הוא מוצר שני שמתחזה לפרופיל. ההבדל בין מפקד לאחמ"ש הוא כמה מילים,
 * לא כמה מסכים.
 */
const PROFILE_TERMS = {
  // אזרחי — מסעדות, מוקדים, אבטחה. זהה ל-BASE.
  civil: {},

  // צבאי. "סד\"כ" במקום "סידור", "תורנות" במקום "משמרת", ולשון פיקוד
  // במקום לשון שירות: מפקד *מפיץ* סד"כ, הוא לא "שולח לצוות".
  army: {
    "nav.shifts":       "בניית סד\"כ",
    "nav.availability": "מי דיווח",
    "nav.smart":        "בנה לי סד\"כ",
    "nav.assignment":   "לשבץ בעצמי",
    "nav.schedule":     "הפץ סד\"כ",
    "nav.swaps":        "בקשות חילוף",
    "nav.tasks":        "משימות",
    "nav.team":         "הכפופים לי",
    "guard.nav.schedule":     "התורנויות שלי",
    "guard.nav.availability": "דיווח זמינות",
    "guard.nav.swaps":        "חילופים",
    "action.publish":   "הפץ סד\"כ",
  },
};

/** התצוגה של הפרופילים במסך הבחירה. הסדר כאן הוא הסדר על המסך. */
export const PROFILES = [
  {
    id: "civil",
    label: "אבטחה, מסעדה או מוקד",
    hint: "משמרות, סידור שבועי, החלפות בין עובדים",
    icon: "users",
  },
  {
    id: "army",
    label: "צבא",
    hint: 'סד"כ תורנויות, לשון פיקוד, כפיפות',
    icon: "shield",
  },
];

const STORE_KEY = "gs-profile";

const readStored = () => {
  try {
    const v = localStorage.getItem(STORE_KEY);
    return PROFILE_TERMS[v] ? v : "civil";
  } catch {
    return "civil";
  }
};

let active = readStored();
let terms = { ...BASE, ...PROFILE_TERMS[active] };

/**
 * מנוי על שינויי פרופיל.
 *
 * בלי זה החלפת פרופיל לא הייתה נראית: מערכי הניווט נבנים פעם אחת בטעינת
 * המודול, אז `t()` שנקרא שם מקבע את המילה הראשונה לכל אורך החיים של הדף.
 * הרכיבים נרשמים דרך `useSyncExternalStore` ומחשבים את התוויות מחדש.
 */
const listeners = new Set();
export function subscribeTerms(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** נקרא בטעינת הצוות ובכל החלפת פרופיל. */
export function setTermProfile(profile) {
  const next = PROFILE_TERMS[profile] ? profile : "civil";
  if (next === active) return;
  active = next;
  terms = { ...BASE, ...PROFILE_TERMS[active] };
  try {
    localStorage.setItem(STORE_KEY, active);
  } catch {
    /* אחסון חסום — הבחירה תקפה לשיחה הזאת בלבד */
  }
  for (const fn of listeners) fn();
}

export function termProfile() {
  return active;
}

/** מחזיר את המונח. מפתח לא מוכר חוזר כמו שהוא — רועש בממשק, וזו הכוונה. */
export function t(key) {
  return terms[key] ?? key;
}
