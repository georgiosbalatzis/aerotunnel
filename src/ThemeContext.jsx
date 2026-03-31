/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from "react";

/*
 * Theme system — f1stories.gr design language
 * Deep blacks, racing accents, editorial typography tokens
 */

const ThemeContext = createContext(null);

const themes = {
  dark: {
    "--bg-root": "#050505",
    "--bg-panel": "rgba(16, 16, 18, 0.92)",
    "--bg-panel-hover": "rgba(23, 23, 26, 0.96)",
    "--bg-panel-strong": "rgba(8, 8, 9, 0.96)",
    "--bg-panel-soft": "rgba(24, 24, 27, 0.82)",
    "--bg-topbar": "rgba(6, 6, 7, 0.92)",
    "--bg-canvas": "#030303",
    "--bg-input": "rgba(255, 255, 255, 0.08)",
    "--bg-table-odd": "rgba(14, 14, 16, 0.92)",
    "--bg-table-even": "rgba(19, 19, 21, 0.94)",
    "--bg-table-header": "rgba(26, 26, 29, 0.96)",

    "--border-primary": "rgba(255,255,255,0.1)",
    "--border-accent": "rgba(225, 6, 0, 0.22)",
    "--border-subtle": "rgba(255,255,255,0.04)",
    "--border-hover": "rgba(225, 6, 0, 0.32)",
    "--border-strong": "rgba(225, 6, 0, 0.4)",

    "--text-primary": "#f5f5f7",
    "--text-secondary": "#b5b7bd",
    "--text-muted": "#7f828a",
    "--text-dim": "#595c64",
    "--text-faint": "#31333a",
    "--text-heading": "#ffffff",

    "--accent-cyan": "#d9dde3",
    "--accent-cyan-glow": "rgba(217, 221, 227, 0.14)",
    "--accent-cyan-border": "rgba(217, 221, 227, 0.22)",
    "--accent-green": "#6ef36b",
    "--accent-green-glow": "rgba(110, 243, 107, 0.12)",
    "--accent-orange": "#ffb347",
    "--accent-orange-glow": "rgba(255, 179, 71, 0.14)",
    "--accent-red": "#e10600",
    "--accent-red-glow": "rgba(225, 6, 0, 0.15)",
    "--accent-purple": "#e10600",
    "--accent-purple-glow": "rgba(225, 6, 0, 0.15)",
    "--accent-red-stat": "#ff5c52",

    "--solid-fill": "rgb(44, 44, 47)",
    "--scrollbar-thumb": "rgba(255,255,255,0.16)",

    "--shadow-canvas": "0 28px 60px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.04)",
    "--shadow-logo": "0 0 28px rgba(225, 6, 0, 0.22)",
    "--shadow-card": "0 22px 44px rgba(0,0,0,0.28)",
    "--shadow-card-hover": "0 24px 46px rgba(0,0,0,0.32)",
    "--shadow-topbar": "0 16px 30px rgba(0,0,0,0.24)",
    "--shadow-hero": "0 16px 34px rgba(225, 6, 0, 0.22)",

    "--colorbar-velocity": "linear-gradient(to bottom, #f5f5f7, #ffb347, #e10600)",
    "--colorbar-pressure": "linear-gradient(to bottom, #f5f5f7, #777a82, #e10600)",

    "--topbar-blur": "blur(18px) saturate(1.3)",
    "--glass-bg": "rgba(16, 16, 18, 0.72)",
    "--glass-border": "rgba(255,255,255,0.06)",

    "--gradient-brand": "linear-gradient(135deg, #e10600 0%, #ff6a00 55%, #f5f5f7 100%)",
    "--gradient-warm": "linear-gradient(135deg, #e10600 0%, #ffb347 100%)",
    "--grid-line": "rgba(255,255,255,0.025)",
  },
  light: {
    "--bg-root": "#efefef",
    "--bg-panel": "rgba(255, 255, 255, 0.94)",
    "--bg-panel-hover": "rgba(252, 252, 252, 0.98)",
    "--bg-panel-strong": "rgba(249, 249, 250, 0.98)",
    "--bg-panel-soft": "rgba(244, 244, 246, 0.92)",
    "--bg-topbar": "rgba(245, 245, 246, 0.9)",
    "--bg-canvas": "#ececed",
    "--bg-input": "rgba(0, 0, 0, 0.08)",
    "--bg-table-odd": "rgba(252, 252, 252, 0.95)",
    "--bg-table-even": "rgba(244, 244, 246, 0.96)",
    "--bg-table-header": "rgba(236, 236, 239, 0.96)",

    "--border-primary": "rgba(16,16,18,0.1)",
    "--border-accent": "rgba(213, 10, 0, 0.18)",
    "--border-subtle": "rgba(0,0,0,0.05)",
    "--border-hover": "rgba(213, 10, 0, 0.24)",
    "--border-strong": "rgba(213, 10, 0, 0.34)",

    "--text-primary": "#151517",
    "--text-secondary": "#4e5159",
    "--text-muted": "#767983",
    "--text-dim": "#a0a3ab",
    "--text-faint": "#c8cad0",
    "--text-heading": "#050506",

    "--accent-cyan": "#2b2e35",
    "--accent-cyan-glow": "rgba(43, 46, 53, 0.1)",
    "--accent-cyan-border": "rgba(43, 46, 53, 0.18)",
    "--accent-green": "#1a8f2e",
    "--accent-green-glow": "rgba(26, 143, 46, 0.1)",
    "--accent-orange": "#c97b16",
    "--accent-orange-glow": "rgba(201, 123, 22, 0.12)",
    "--accent-red": "#d50a00",
    "--accent-red-glow": "rgba(213, 10, 0, 0.1)",
    "--accent-purple": "#d50a00",
    "--accent-purple-glow": "rgba(213, 10, 0, 0.1)",
    "--accent-red-stat": "#d50a00",

    "--solid-fill": "rgb(182, 182, 186)",
    "--scrollbar-thumb": "rgba(16,16,18,0.16)",

    "--shadow-canvas": "0 22px 48px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.4)",
    "--shadow-logo": "0 0 20px rgba(213, 10, 0, 0.14)",
    "--shadow-card": "0 16px 32px rgba(0,0,0,0.08)",
    "--shadow-card-hover": "0 18px 34px rgba(0,0,0,0.12)",
    "--shadow-topbar": "0 10px 20px rgba(0,0,0,0.06)",
    "--shadow-hero": "0 14px 26px rgba(213, 10, 0, 0.12)",

    "--colorbar-velocity": "linear-gradient(to bottom, #fafafa, #c97b16, #d50a00)",
    "--colorbar-pressure": "linear-gradient(to bottom, #fafafa, #7b7f86, #d50a00)",

    "--topbar-blur": "blur(16px) saturate(1.15)",
    "--glass-bg": "rgba(255,255,255,0.8)",
    "--glass-border": "rgba(16,16,18,0.08)",

    "--gradient-brand": "linear-gradient(135deg, #d50a00 0%, #ff7b00 55%, #fafafa 100%)",
    "--gradient-warm": "linear-gradient(135deg, #d50a00 0%, #ffb347 100%)",
    "--grid-line": "rgba(16,16,18,0.03)",
  },
};

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    try {
      const saved = localStorage.getItem("aerotunnel-theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      // Ignore storage access failures and fall back to system preference.
    }
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });

  useEffect(() => {
    const tokens = themes[mode];
    const root = document.documentElement;
    for (const [key, val] of Object.entries(tokens)) {
      root.style.setProperty(key, val);
    }
    root.setAttribute("data-theme", mode);
    try {
      localStorage.setItem("aerotunnel-theme", mode);
    } catch {
      // Ignore storage write failures so theme switching still works in-session.
    }
  }, [mode]);

  const toggle = useCallback(() => setMode(m => (m === "dark" ? "light" : "dark")), []);

  return (
    <ThemeContext.Provider value={{ mode, toggle, isDark: mode === "dark" }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
}
