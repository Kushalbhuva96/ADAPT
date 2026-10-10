export const THEME_STORAGE_KEY = "adapt_theme";

export function normalizeTheme(theme) {
  return theme === "light" ? "light" : "dark";
}

export function readTheme(storage = globalThis.localStorage) {
  try {
    return normalizeTheme(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return "dark";
  }
}

export function toggleThemeValue(theme) {
  return normalizeTheme(theme) === "dark" ? "light" : "dark";
}

export function applyTheme(theme, root = globalThis.document?.documentElement) {
  const nextTheme = normalizeTheme(theme);
  if (root) {
    root.dataset.theme = nextTheme;
    root.style.colorScheme = nextTheme;
  }
  return nextTheme;
}

export function persistTheme(theme, storage = globalThis.localStorage) {
  const nextTheme = normalizeTheme(theme);
  try {
    storage?.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch {
    return nextTheme;
  }
  return nextTheme;
}
