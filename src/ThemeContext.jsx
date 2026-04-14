/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect } from "react";

/*
 * Dark-only CFD color system.
 * The jet colormap is the brand palette; legacy --f1-* names remain as aliases
 * so existing components can migrate without losing the Phase 14/15 UI shell.
 */

const ThemeContext = createContext(null);

const DARK_THEME = {
  "--bg-void": "#06080c",
  "--bg-base": "#0a0e16",
  "--bg-glass": "rgba(10, 14, 22, 0.72)",
  "--bg-glass-hi": "rgba(10, 14, 22, 0.88)",
  "--border-glass": "rgba(255, 255, 255, 0.06)",
  "--border-hover": "rgba(255, 255, 255, 0.12)",
  "--text-primary": "rgba(255, 255, 255, 0.87)",
  "--text-secondary": "rgba(255, 255, 255, 0.50)",
  "--text-dim": "rgba(255, 255, 255, 0.25)",
  "--accent-flow": "#00d4ff",
  "--accent-hi": "#22ff88",
  "--accent-mid": "#eeff22",
  "--accent-warn": "#ff6600",
  "--accent-crit": "#ff0022",

  "--bg-root": "#06080c",
  "--bg-panel": "rgba(10, 14, 22, 0.88)",
  "--bg-panel-hover": "rgba(12, 18, 30, 0.94)",
  "--bg-panel-strong": "rgba(5, 8, 16, 0.96)",
  "--bg-panel-soft": "rgba(10, 14, 22, 0.72)",
  "--bg-topbar": "rgba(6, 8, 12, 0.88)",
  "--bg-canvas": "#030507",
  "--bg-input": "rgba(255, 255, 255, 0.08)",
  "--border-primary": "rgba(255, 255, 255, 0.06)",
  "--border-accent": "rgba(0, 212, 255, 0.28)",
  "--border-subtle": "rgba(255, 255, 255, 0.04)",
  "--border-strong": "rgba(0, 212, 255, 0.42)",
  "--text-muted": "rgba(255, 255, 255, 0.50)",
  "--text-faint": "rgba(255, 255, 255, 0.18)",
  "--text-heading": "rgba(255, 255, 255, 0.87)",
  "--accent-red": "#ff0022",
  "--accent-red-glow": "rgba(255, 0, 34, 0.24)",
  "--accent-purple": "#00d4ff",
  "--accent-purple-glow": "rgba(0, 212, 255, 0.14)",
  "--accent-green": "#22ff88",
  "--accent-green-glow": "rgba(34, 255, 136, 0.14)",
  "--accent-orange": "#ff6600",
  "--accent-cyan": "#00d4ff",
  "--scrollbar-thumb": "rgba(255, 255, 255, 0.16)",
  "--shadow-canvas": "0 28px 60px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
  "--shadow-card": "0 22px 44px rgba(0, 0, 0, 0.28)",
  "--topbar-blur": "blur(18px) saturate(1.3)",
  "--glass-bg": "rgba(10, 14, 22, 0.72)",
  "--glass-border": "rgba(255, 255, 255, 0.06)",
  "--gradient-brand": "linear-gradient(135deg, #00d4ff 0%, #22ff88 55%, #ff6600 100%)",

  "--f1-void": "#06080c",
  "--f1-base": "#0a0e16",
  "--f1-raised": "#0c121e",
  "--f1-elevated": "#101827",
  "--f1-inset": "rgba(255, 255, 255, 0.08)",
  "--f1-edge": "rgba(255, 255, 255, 0.06)",
  "--f1-edge-hi": "rgba(255, 255, 255, 0.12)",
  "--f1-black": "#06080c",
  "--f1-carbon": "rgba(10, 14, 22, 0.72)",
  "--f1-slate": "rgba(10, 14, 22, 0.88)",
  "--f1-panel": "rgba(10, 14, 22, 0.88)",
  "--f1-border": "rgba(255, 255, 255, 0.06)",
  "--f1-border-hi": "rgba(255, 255, 255, 0.12)",
  "--f1-red": "#ff0022",
  "--f1-red-dim": "rgba(255, 0, 34, 0.16)",
  "--f1-red-glow": "rgba(255, 0, 34, 0.30)",
  "--f1-amber": "#ff6600",
  "--f1-green": "#22ff88",
  "--f1-blue": "#00d4ff",
  "--f1-cyan": "#00d4ff",
  "--f1-white": "rgba(255, 255, 255, 0.87)",
  "--f1-silver": "rgba(255, 255, 255, 0.50)",
  "--f1-dim": "rgba(255, 255, 255, 0.25)",
  "--f1-ghost": "rgba(255, 255, 255, 0.10)",
  "--f1-text-hi": "rgba(255, 255, 255, 0.87)",
  "--f1-text-md": "rgba(255, 255, 255, 0.50)",
  "--f1-text-lo": "rgba(255, 255, 255, 0.25)",
  "--glow-red": "0 0 0 1px rgba(255, 0, 34, 0.42), 0 0 22px rgba(255, 0, 34, 0.18)",
  "--glow-green": "0 0 0 1px rgba(34, 255, 136, 0.4), 0 0 20px rgba(34, 255, 136, 0.16)",
  "--glow-blue": "0 0 0 1px rgba(0, 212, 255, 0.38), 0 0 18px rgba(0, 212, 255, 0.14)",
  "--shadow-panel": "0 4px 24px rgba(0, 0, 0, 0.6), 0 1px 0 rgba(255, 255, 255, 0.03) inset",
  "--shadow-deep": "0 8px 48px rgba(0, 0, 0, 0.8)",
  "--grid-line": "rgba(255, 255, 255, 0.025)",
};

export function ThemeProvider({ children }) {
  useEffect(() => {
    const root = document.documentElement;
    for (const [key, val] of Object.entries(DARK_THEME)) {
      root.style.setProperty(key, val);
    }
    root.setAttribute("data-theme", "dark");
    root.style.colorScheme = "dark";
    try { localStorage.setItem("aerotunnel-theme", "dark"); } catch { /* ignore */ }
  }, []);

  const toggle = useCallback(() => {}, []);

  return (
    <ThemeContext.Provider value={{ mode: "dark", toggle, isDark: true }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
}
