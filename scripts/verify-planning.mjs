// Standalone sanity check for the conflict matrix and the fairness engine.
//   node scripts/verify-planning.mjs
//
// Both modules are pure, so they run here with no browser and no database.

import { compatIndex, findConflicts, pairKey, pairRule, taskWindow } from "../src/lib/conflicts.js";
import { fairnessHint, fairnessPlan, rollingLoad } from "../src/lib/fairness.js";
import { addDays, todayISO } from "../src/lib/dates.js";

let failures = 0;
const check = (label, cond, extra = "") => {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

// ============================================================
console.log("\nמטריצת ההתנגשויות\n");
// ============================================================

const rules = [
  { a: "כוננות", b: "מטבח", rule: "allow", note: "", teamCode: null },
  { a: "מטבח", b: "שמירות", rule: "block", note: "עמדה דורשת נוכחות", teamCode: null },
  { a: "סיור", b: "שמירות", rule: "block", note: "", teamCode: null },
];
const index = compatIndex(rules);

check("המפתח סימטרי", pairKey("שמירות", "מטבח") === pairKey("מטבח", "שמירות"));
check("זוג חסום נקרא משני הכיוונים",
  pairRule(index, "שמירות", "מטבח").rule === "block" &&
  pairRule(index, "מטבח", "שמירות").rule === "block");
check("זוג מותר במפורש נשאר מותר", pairRule(index, "מטבח", "כוננות").rule === "allow");
check("זוג שלא נרשם — מותר", pairRule(index, "ניקיון", "ציוד").rule === "allow");

// כלל של צוות גובר על המובנה, ולא משנה באיזה סדר הגיעו השורות.
const teamFirst = compatIndex([
  { a: "מטבח", b: "שמירות", rule: "allow", teamCode: "ABC123" },
  { a: "מטבח", b: "שמירות", rule: "block", teamCode: null },
]);
const builtinFirst = compatIndex([
  { a: "מטבח", b: "שמירות", rule: "block", teamCode: null },
  { a: "מטבח", b: "שמירות", rule: "allow", teamCode: "ABC123" },
]);
check("כלל של הצוות גובר על המובנה — בכל סדר טעינה",
  pairRule(teamFirst, "מטבח", "שמירות").rule === "allow" &&
  pairRule(builtinFirst, "מטבח", "שמירות").rule === "allow");

const mon = todayISO();
const wed = addDays(mon, 2);
const fri = addDays(mon, 4);
const nextWeek = addDays(mon, 9);

const existing = [
  { id: "t1", title: "עמדה 1", category: "שמירות", assignees: ["g1"], startDate: mon, dueDate: wed, status: "open" },
  { id: "t2", title: "מטבח ערב", category: "מטבח", assignees: ["g2"], startDate: mon, dueDate: wed, status: "open" },
  { id: "t3", title: "עמדה 2", category: "שמירות", assignees: ["g3"], startDate: nextWeek, dueDate: nextWeek, status: "open" },
  { id: "t4", title: "עמדה ישנה", category: "שמירות", assignees: ["g4"], startDate: mon, dueDate: wed, status: "done" },
];

const candidate = { id: "new", title: "מטבח בוקר", category: "מטבח", startDate: mon, dueDate: fri };

check("חלון של משימה עם תאריך יחיד נסגר על עצמו",
  taskWindow({ dueDate: mon })?.from === mon && taskWindow({ dueDate: mon })?.to === mon);
check("משימה בלי תאריכים לא מייצרת חלון", taskWindow({}) === null);

const hit = findConflicts({ candidate, assignees: ["g1"], tasks: existing, compat: index });
check("חפיפה בין זוג חסום נתפסת", hit.length === 1 && hit[0].taskId === "t1", JSON.stringify(hit));
check("הסיבה מהטבלה מגיעה עם הממצא", hit[0]?.note === "עמדה דורשת נוכחות");

check("זוג מותר לא נחסם",
  findConflicts({ candidate, assignees: ["g2"], tasks: existing, compat: index }).length === 0);
check("חוסר חפיפה בזמן לא נחסם",
  findConflicts({ candidate, assignees: ["g3"], tasks: existing, compat: index }).length === 0);
check("משימה שהושלמה כבר לא תופסת אף אחד",
  findConflicts({ candidate, assignees: ["g4"], tasks: existing, compat: index }).length === 0);
check("עריכת משימה לא מתנגשת עם עצמה",
  findConflicts({ candidate: existing[0], assignees: ["g1"], tasks: existing, compat: index }).length === 0);
check("משימה בלי תאריכים לא חוסמת",
  findConflicts({ candidate: { category: "מטבח" }, assignees: ["g1"], tasks: existing, compat: index }).length === 0);

const many = findConflicts({ candidate, assignees: ["g1", "g2", "g3"], tasks: existing, compat: index });
check("שורה אחת לכל אדם מתנגש, לא ספירה מצטברת",
  many.length === 1 && many[0].personId === "g1", JSON.stringify(many));

// ============================================================
console.log("\nמנוע ההוגנות\n");
// ============================================================

const guards = [
  { id: "g1", name: "אלה" },
  { id: "g2", name: "יניר" },
  { id: "g3", name: "נועה" },
];

const day = (date, assigned) => ({
  id: `d-${date}-${assigned}`, date, type: "morning",
  startTime: "07:00", endTime: "19:00", assignedGuards: [assigned],
});
const night = (date, assigned) => ({
  id: `n-${date}-${assigned}`, date, type: "night",
  startTime: "19:00", endTime: "07:00", assignedGuards: [assigned],
});

const weekStart = addDays(todayISO(), 7);
// שבועיים אחורה: אלה נשאה ארבע, יניר אחת, נועה כלום.
const history = [
  day(addDays(weekStart, -12), "g1"), day(addDays(weekStart, -10), "g1"),
  day(addDays(weekStart, -6), "g1"), day(addDays(weekStart, -3), "g1"),
  day(addDays(weekStart, -5), "g2"),
  // מחוץ לחלון — חייב להיות מתעלם.
  day(addDays(weekStart, -40), "g3"), day(addDays(weekStart, -39), "g3"),
];

const past = rollingLoad({ guards, shifts: history, until: weekStart, days: 14 });
check("החלון חותך מה שקדם לו",
  past.per.g3.count === 0, JSON.stringify(past.per.g3));
check("מה שבתוך החלון נספר", past.per.g1.count === 4 && past.per.g2.count === 1);

const plan = fairnessPlan({ guards, history, planned: [], until: weekStart, days: 14 });
const byId = Object.fromEntries(plan.rows.map((r) => [r.id, r]));

check("מי שנשא הכי הרבה יושב בתחתית ההמלצה",
  plan.rows[plan.rows.length - 1].id === "g1", JSON.stringify(plan.rows.map((r) => r.id)));
check("מי שלא נשא כלום מקבל את החוב הגדול ביותר", plan.rows[0].id === "g3");
check("החוב מתורגם למספר משמרות שאפשר לפעול לפיו",
  byId.g3.needs >= 1 && byId.g2.needs >= 1, JSON.stringify({ g3: byId.g3.needs, g2: byId.g2.needs }));
check("מי שמעל הממוצע מקבל מספר שלילי", byId.g1.needs <= -1, String(byId.g1.needs));
check("סכום החובות מתאפס בקירוב",
  Math.abs(plan.rows.reduce((a, r) => a + r.deficit, 0)) < 0.01,
  String(plan.rows.reduce((a, r) => a + r.deficit, 0)));

check("ההמלצה מנוסחת למי שחסר לו", fairnessHint(byId.g3)?.level === "under");
check("ההמלצה מזהירה את מי שמעל", fairnessHint(byId.g1)?.level === "over");
check("מי שמאוזן לא מקבל תג", fairnessHint({ needs: 0 }) === null);

// שיבוץ לשבוע הנוכחי מקטין את החוב תוך כדי עבודה.
const withPlanned = fairnessPlan({
  guards, history, planned: [day(weekStart, "g3"), day(addDays(weekStart, 1), "g3")],
  until: weekStart, days: 14,
});
const g3After = withPlanned.rows.find((r) => r.id === "g3");
check("שיבוץ לשבוע שנבנה מוריד את ההמלצה",
  g3After.needs < byId.g3.needs, JSON.stringify({ before: byId.g3.needs, after: g3After.needs }));

// לילה שוקל יותר מיום — שתי ספירות זהות אינן בהכרח נטל זהה.
const evenCount = fairnessPlan({
  guards: guards.slice(0, 2), history: [night(addDays(weekStart, -3), "g1"), day(addDays(weekStart, -3), "g2")],
  planned: [], until: weekStart, days: 14,
});
const nightHolder = evenCount.rows.find((r) => r.id === "g1");
check("נטל ולא ספירה — מי שנשא לילה נחשב עמוס יותר",
  nightHolder.deficit < 0, JSON.stringify(evenCount.rows));

check("צוות ריק לא מפיל את החישוב", fairnessPlan({ guards: [] }).rows.length === 0);

console.log(`\n${failures === 0 ? "PASS" : `FAIL — ${failures} failing check(s)`}\n`);
process.exit(failures === 0 ? 0 : 1);
