import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../services/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Sun : Moon;

  return <button
    type="button"
    className="btn theme-toggle"
    onClick={toggleTheme}
    aria-label={`Switch to ${nextTheme} theme`}
    title={`Switch to ${nextTheme} theme`}
  ><Icon size={15} aria-hidden="true"/><span>{theme === "dark" ? "Light" : "Dark"}</span></button>;
}
