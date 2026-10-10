import test from "node:test";
import assert from "node:assert/strict";
import { getTutorMode, setTutorMode, subscribeTutorMode } from "./tutorMode.js";

test("Tutor mode is saved across page and app restarts", () => {
  const previousStorage = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  const modes = [];
  const unsubscribe = subscribeTutorMode((mode) => modes.push(mode));
  try {
    setTutorMode("local");
    assert.equal(values.get("adapt_tutor_mode"), "local");
    assert.equal(getTutorMode(), "local");
    setTutorMode("hosted");
    assert.equal(values.get("adapt_tutor_mode"), "hosted");
    assert.deepEqual(modes, ["local", "hosted"]);
  } finally {
    unsubscribe();
    setTutorMode("hosted");
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});
