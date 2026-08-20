// ============================================================
// מותג — NexRota.
//
// הסמל הוא **קובץ הלוגו האמיתי**, לא ציור מחדש: הסרט חולץ מהמקור,
// נחתך לריבוע, והרקע הקרם הפך לשקוף — ולכן הוא יושב נכון גם על הקרם
// וגם על היער הכהה, בלי גרסה שנייה ובלי ריבוע קרם מסביב.
//
// ⚠️ `public/logo-mark.png` הוא מקור האמת היחיד: אותו קובץ משמש כאן,
// כ-favicon וב-manifest. החלפת הלוגו = החלפת הקובץ הזה, וזהו.
// ============================================================

export const LOGO_SRC = "/logo-mark.png";
export const PRODUCT_NAME = "NexRota";
export const PRODUCT_TAGLINE = "ניהול משמרות חכם";

export function LogoMark({ size = 40, className = "", title }) {
  return (
    <img
      src={LOGO_SRC}
      width={size}
      height={size}
      // רוחב וגובה מפורשים נשמרים כדי שהפריסה לא תקפוץ בזמן שהתמונה נטענת.
      style={{ width: size, height: size }}
      className={`object-contain flex-shrink-0 ${className}`}
      alt={title || ""}
      aria-hidden={title ? undefined : true}
      draggable="false"
      decoding="async"
    />
  );
}

/**
 * סמל + שם. `stacked` ממרכז אותם למסך הכניסה; שורת ברירת המחדל היא מה
 * שכרום האפליקציה משתמש בו.
 *
 * השם נכתב במשקל אחד ובריווח צפוף, כמו בלוגו עצמו. פיצול "Nex" ו-"Rota"
 * לשני משקלים היה שובר מילה אחת לשתיים — וזה בדיוק מה שלוגו לא עושה.
 */
export function Logo({ size = 36, stacked = false, tagline, className = "" }) {
  const fontSize = size * (stacked ? 0.52 : 0.46);
  return (
    <div
      className={`flex items-center gap-2.5 ${stacked ? "flex-col text-center gap-3" : ""} ${className}`}
    >
      <LogoMark size={size} title={PRODUCT_NAME} />
      <div className={stacked ? "" : "text-right min-w-0"}>
        <div
          className="font-extrabold tracking-[-0.02em] leading-tight whitespace-nowrap text-content"
          style={{ fontSize }}
        >
          {PRODUCT_NAME}
        </div>
        {tagline && (
          <p className={`text-muted ${stacked ? "text-sm mt-1.5" : "text-xs mt-0.5"}`}>{tagline}</p>
        )}
      </div>
    </div>
  );
}

export default Logo;
