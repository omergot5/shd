// ============================================================
// Service worker — קריאה בלי רשת.
//
// המטרה מצומצמת בכוונה: שמאבטח שנמצא בחניון תת־קרקעי, במוצב בלי קליטה או
// במטוס יוכל *לראות* את הסידור שכבר נטען. כתיבה לא נשמרת כאן — פעולה בלי
// רשת תיכשל ותאמר זאת, וזה עדיף פי כמה מלהבטיח שמירה שלא קרתה.
//
// שתי אסטרטגיות, ולא אחת:
//   ניווטים   — רשת קודם, ובנפילה מגישים את מעטפת האפליקציה מהמטמון.
//   נכסים     — מטמון קודם עם רענון ברקע. שמות הקבצים של Vite נושאים גיבוב,
//               אז גרסה חדשה היא כתובת חדשה ולא יכולה להתנגש בישנה.
//
// הנתונים עצמם אינם כאן. הם נשמרים ב-localStorage ב-useGuardian, כי הם
// מגיעים מ-Supabase דרך WebSocket ו-POST ולא כ-GET שאפשר למטמן.
// ============================================================

const VERSION = "v1";
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.add("/")).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // רק המקור שלנו. קריאות ל-Supabase ולפונטים אינן עניינו של המטמון הזה —
  // בקשת API שמוגשת מהמטמון היא נתון ישן שמתחזה לטרי.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request)
        .then((res) => {
          caches.open(SHELL).then((c) => c.put("/", res.clone()));
          return res;
        })
        .catch(() => caches.match("/", { cacheName: SHELL }))
    );
    return;
  }

  e.respondWith(
    caches.match(request).then((hit) => {
      const live = fetch(request)
        .then((res) => {
          if (res.ok) caches.open(ASSETS).then((c) => c.put(request, res.clone()));
          return res;
        })
        .catch(() => hit);
      return hit || live;
    })
  );
});
