import React, { createContext, useContext, useLayoutEffect, useMemo, useState } from "react";
import { applyTheme, persistTheme, readTheme, toggleThemeValue } from "./theme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readTheme);

  useLayoutEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = theme === "dark" ? "#0F1115" : "#F5F7FB";
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    toggleTheme: () => setTheme((current) => toggleThemeValue(current)),
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
