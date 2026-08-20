// ============================================================
// הסידור השבועי כתמונה.
//
// למה בכלל: הצוות חי בוואטסאפ. גם כשכולם מותקנים באפליקציה, האחמ"ש רוצה
// להדביק את השבוע בקבוצה, והחלופות גרועות — צילום מסך נחתך ומגיע קטן, ו-PDF
// נפתח באפליקציה אחרת ורובם לא יפתחו אותו. תמונה נפתחת בתצוגה המקדימה של
// השיחה, בלי לחיצה אחת.
//
// שתי החלטות שמכתיבות את כל השאר:
//   1. רוחב 1080 ולא רוחב המסך. הרינדור לא תלוי בגודל החלון של מי שלחץ, אז
//      אותו שבוע מפיק אותה תמונה מטלפון וממחשב.
//   2. פלטה קבועה ובהירה, גם כשהאפליקציה במצב כהה. התמונה נצפית בתוך שיחה,
//      לא בתוך האפליקציה, ומסך כהה על רקע וואטסאפ בהיר נראה כמו תקלה.
// ============================================================

import { DAYS_HE, fromISODate, rangeLabelHe } from "./dates.js";

const W = 1080;
const PAD = 48;

const C = {
  bg: "#f6f8fb",
  card: "#ffffff",
  ink: "#0f172a",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#e2e8f0",
  brand: "#2563eb",
};

const F = (size, weight = 400) => `${weight} ${size}px Rubik, Arial, sans-serif`;

/**
 * מצייר קטע בכיוון שמאל־לימין בתוך ציור ימין־לשמאל.
 *
 * בלי זה "07:00–19:00" יוצא הפוך: אלגוריתם הדו־כיווניות רואה מקף ניטרלי בין
 * שני רצפי ספרות בהקשר ימין־לשמאל, ומסדר את הרצפים מימין לשמאל. משמרת בוקר
 * שנקראת כמשמרת לילה היא בדיוק סוג הטעות שסידור לא יכול להרשות לעצמו.
 *
 * החלפת `ctx.direction` ולא תווי בידוד (U+2066): הקנבס של Chrome מתעלם מהם.
 * `textAlign: "right"` ממשיך לעגן באותה נקודה, אז הפריסה לא זזה.
 */
function drawLtr(ctx, text, x, y) {
  ctx.direction = "ltr";
  ctx.fillText(text, x, y);
  ctx.direction = "rtl";
}

/** שובר טקסט לשורות ברוחב נתון. מחזיר מערך שורות, לפחות אחת. */
function wrap(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let line = words[0];
  for (const word of words.slice(1)) {
    const next = `${line} ${word}`;
    if (ctx.measureText(next).width <= maxWidth) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * מודדים לפני שמציירים: גובה הקנבס תלוי בכמה שורות ייקחו שמות המשובצים,
 * ואי אפשר לדעת את זה בלי הקשר ציור. לכן שני מעברים על אותו מבנה.
 */
function layout(ctx, dates, shifts, nameOf) {
  const days = [];
  let y = 0;
  for (const date of dates) {
    const rows = shifts
      .filter((s) => s.date === date)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((s) => {
        const names = (s.assignedGuards || []).map(nameOf);
        ctx.font = F(26);
        const lines = names.length
          ? wrap(ctx, names.join(" · "), W - PAD * 2 - 300)
          : ["— לא מאויש —"];
        return { shift: s, lines, height: Math.max(84, 46 + lines.length * 34) };
      });
    const height = 54 + (rows.length ? rows.reduce((a, r) => a + r.height, 0) : 70);
    days.push({ date, rows, y, height });
    y += height + 16;
  }
  return { days, total: y };
}

/** מצייר את השבוע ומחזיר קנבס. סינכרוני — הפונטים כבר נטענו. */
export function renderWeekCanvas({ dates, shifts, guards, teamName }) {
  const measure = document.createElement("canvas").getContext("2d");
  const nameOf = (id) => guards.find((g) => g.id === id)?.name || "לא ידוע";
  const { days, total } = layout(measure, dates, shifts, nameOf);

  const HEAD = 150;
  const FOOT = 60;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = HEAD + total + FOOT + PAD;
  const ctx = canvas.getContext("2d");
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const right = W - PAD;

  // כותרת
  ctx.fillStyle = C.ink;
  ctx.font = F(46, 800);
  ctx.fillText(teamName || "סידור השבוע", right, 82);
  ctx.fillStyle = C.brand;
  ctx.font = F(30, 600);
  ctx.fillText(rangeLabelHe(dates), right, 124);

  let y = HEAD;
  for (const day of days) {
    roundRect(ctx, PAD, y, W - PAD * 2, day.height, 22);
    ctx.fillStyle = C.card;
    ctx.fill();

    ctx.fillStyle = C.ink;
    ctx.font = F(28, 700);
    const d = fromISODate(day.date);
    ctx.fillText(DAYS_HE[d.getDay()], right - 24, y + 44);
    ctx.fillStyle = C.faint;
    ctx.font = F(24, 500);
    drawLtr(ctx, `${d.getDate()}/${d.getMonth() + 1}`, right - 130, y + 44);

    let ry = y + 54;
    if (!day.rows.length) {
      ctx.fillStyle = C.faint;
      ctx.font = F(26);
      ctx.fillText("אין משמרות", right - 24, ry + 34);
    }

    for (const row of day.rows) {
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD + 24, ry);
      ctx.lineTo(W - PAD - 24, ry);
      ctx.stroke();

      // פס הצבע של המשמרת — אותו צבע שמופיע באפליקציה, כדי שמי שמכיר את
      // המסך יזהה את התמונה מיד.
      roundRect(ctx, right - 24 - 6, ry + 18, 6, row.height - 36, 3);
      ctx.fillStyle = row.shift.color || C.brand;
      ctx.fill();

      ctx.fillStyle = C.ink;
      ctx.font = F(28, 700);
      drawLtr(ctx, `${row.shift.startTime}–${row.shift.endTime}`, right - 44, ry + 46);
      ctx.fillStyle = C.muted;
      ctx.font = F(24, 500);
      ctx.fillText(row.shift.label || "", right - 240, ry + 46);

      ctx.fillStyle = row.lines[0].startsWith("—") ? C.faint : C.ink;
      ctx.font = F(26);
      row.lines.forEach((line, i) => {
        ctx.fillText(line, right - 44, ry + 82 + i * 34);
      });

      ry += row.height;
    }

    y += day.height + 16;
  }

  ctx.fillStyle = C.faint;
  ctx.font = F(22, 500);
  ctx.textAlign = "center";
  drawLtr(ctx, "NexRota", W / 2, canvas.height - 34);

  return canvas;
}

const toBlob = (canvas) =>
  new Promise((resolve) => canvas.toBlob(resolve, "image/png"));

/**
 * משתף את התמונה, ואם אין שיתוף — מוריד אותה.
 *
 * `canShare({files})` נבדק ולא רק `share`: בדסקטופ יש `navigator.share` שלא
 * מקבל קבצים, וקריאה אליו שם נכשלת אחרי שהמשתמש כבר לחץ.
 *
 * @returns {"shared"|"downloaded"|"cancelled"}
 */
export async function shareWeekImage({ dates, shifts, guards, teamName }) {
  // הכותרת מצוירת ב-Rubik. בלי ההמתנה, לחיצה ראשונה מייצרת תמונה בפונט
  // ברירת המחדל של המערכת.
  if (document.fonts?.ready) await document.fonts.ready;

  const canvas = renderWeekCanvas({ dates, shifts, guards, teamName });
  const blob = await toBlob(canvas);
  if (!blob) throw new Error("לא הצלחנו ליצור את התמונה");

  const fileName = `סידור ${rangeLabelHe(dates)}.png`.replace(/[\\/:*?"<>|]/g, "-");
  const file = new File([blob], fileName, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return "shared";
    } catch (e) {
      // ביטול של המשתמש אינו תקלה ואסור שיציג שגיאה.
      if (e.name === "AbortError") return "cancelled";
      /* כל כשל אחר — נופלים להורדה */
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
