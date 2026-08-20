import { useSyncExternalStore } from "react";

// ============================================================
// Theme.
//
// Three states, not two: "system" is a real choice and stays in sync when
// the OS flips at sunset. Only an explicit light/dark pick stamps
// `data-theme` on <html> — which is what tokens.css keys off, so the
// cascade and this module can never disagree.
//
// Backed by one module-level store read through useSyncExternalStore
// rather than per-component useState. With useState, a toggle in the
// header and a chart reading the resolved theme would hold two separate
// copies and silently drift apart on the first click.
//
// First paint is handled by the inline script in index.html; by the time
// React mounts, the page is already the right colour.
// ============================================================

export const STORAGE_KEY = "gs-theme";
const MODES = ["system", "light", "dark"];

// NexRota is cream-first: tokens.css defines light on bare `:root`, so the
// only thing the OS can tell us that matters is "this user wants dark".
const darkMedia = () => window.matchMedia("(prefers-color-scheme: dark)");

function readStored() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return MODES.includes(saved) ? saved : "system";
  } catch {
    // Private mode or storage disabled. Not worth failing over.
    return "system";
  }
}

/** Writes the mode to <html>. Mirrors the pre-paint script in index.html. */
function applyMode(mode) {
  const root = document.documentElement;
  if (mode === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
}

let mode = typeof window === "undefined" ? "system" : readStored();
const listeners = new Set();

// The snapshot must be referentially stable between changes or
// useSyncExternalStore will loop forever, so it is cached, not rebuilt.
let snapshot = { mode, resolved: "light" };

function recompute() {
  const resolved = mode === "system" ? (darkMedia().matches ? "dark" : "light") : mode;
  if (snapshot.mode === mode && snapshot.resolved === resolved) return;
  snapshot = { mode, resolved };
  listeners.forEach((fn) => fn());
}

if (typeof window !== "undefined") {
  applyMode(mode);
  recompute();
  // Only "system" cares about OS changes, but subscribing once at module
  // load is simpler than attaching and detaching as the mode changes.
  darkMedia().addEventListener("change", recompute);
}

export function setThemeMode(next) {
  if (!MODES.includes(next) || next === mode) return;
  mode = next;
  applyMode(mode);
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore — the UI still works, it just won't remember */
  }
  recompute();

  // Keep the browser chrome (iOS status bar, Android address bar) in step.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", snapshot.resolved === "dark" ? "#0c211e" : "#f6f4e8");
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const getSnapshot = () => snapshot;

/** @returns {{ mode: 'system'|'light'|'dark', resolved: 'light'|'dark' }} */
export function useTheme() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
