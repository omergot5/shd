import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// רק בבנייה. בפיתוח ה-service worker היה מגיש קבצים מהמטמון וקוטע את ה-HMR,
// וכל שינוי היה נראה כאילו לא נשמר.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* לא נתמך או נחסם — האפליקציה עובדת בדיוק אותו דבר, רק בלי מצב לא־מקוון */
    });
  });
}
