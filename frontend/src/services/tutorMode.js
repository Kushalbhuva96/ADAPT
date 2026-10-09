let currentMode = "hosted";
let localTutorEngine = null;
const listeners = new Set();

export function getTutorMode() {
  return currentMode;
}

export function setTutorMode(mode) {
  currentMode = mode === "local" ? "local" : "hosted";
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
