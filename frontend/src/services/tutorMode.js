function readSavedMode() {
  try { return localStorage.getItem("adapt_tutor_mode") === "local" ? "local" : "hosted"; }
  catch { return "hosted"; }
}

let currentMode = readSavedMode();
let localTutorEngine = null;
const listeners = new Set();

export function getTutorMode() {
  return currentMode;
}

export function setTutorMode(mode) {
  currentMode = mode === "local" ? "local" : "hosted";
  try { localStorage.setItem("adapt_tutor_mode", currentMode); }
  catch {}
  for (const listener of listeners) listener(currentMode);
}

export function setLocalTutorEngine(engine) {
  localTutorEngine = engine || null;
}

export function getLocalTutorEngine() {
  return localTutorEngine;
}

export function subscribeTutorMode(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
