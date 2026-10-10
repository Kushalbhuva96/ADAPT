import test from "node:test";
import assert from "node:assert/strict";
import { applyTheme, persistTheme, readTheme, THEME_STORAGE_KEY, toggleThemeValue } from "./theme.js";

test("theme toggle applies and persists the changed state across initialization", () => {
  const values = new Map([[THEME_STORAGE_KEY, "dark"]]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const root = { dataset: {}, style: {} };

  const nextTheme = toggleThemeValue(readTheme(storage));
  assert.equal(nextTheme, "light");
  assert.equal(applyTheme(nextTheme, root), "light");
  persistTheme(nextTheme, storage);
  assert.equal(root.dataset.theme, "light");
  assert.equal(root.style.colorScheme, "light");
  assert.equal(readTheme(storage), "light");

  const returnedTheme = toggleThemeValue(readTheme(storage));
  applyTheme(returnedTheme, root);
  persistTheme(returnedTheme, storage);
  assert.equal(root.dataset.theme, "dark");
  assert.equal(readTheme(storage), "dark");
});
