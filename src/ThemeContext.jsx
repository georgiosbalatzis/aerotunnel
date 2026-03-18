import { createContext, useContext, useState, useEffect, useCallback } from "react";

/*
 * Theme system inspired by f1stories/betcast toggle pattern.
 * Uses CSS custom properties for zero-repaint theme switching.
 */

const ThemeContext = createContext(null);

// ── Token definitions ──────────────────────────────────────────────────────────
const themes = {
  dark: {
    "--bg-root": "#020810",
    "--bg-panel": "rgba(4,14,26,0.85)",
    "--bg-panel-hover": "rgba(8,22,40,0.9)",
    "--bg-topbar": "linear-gradient(180deg, rgba(6,18,32,0.98) 0%, rgba(4,12,24,0.95) 100%)",
    "--bg-canvas": "#030a12",
    "--bg-input": "#0a1828",
    "--bg-table-odd": "#040c18",
    "--bg-table-even": "#050e1c",
    "--bg-table-header": "#060e1a",

    "--border-primary": "#0a1e34",
    "--border-accent": "#1a4a6a",
    "--border-subtle": "#0d2540",

    "--text-primary": "#c0daf0",
    "--text-secondary": "#7aa0c0",
    "--text-muted": "#3a6a8a",
    "--text-dim": "#2a5a7a",
    "--text-faint": "#1a4060",
    "--text-heading": "#40e8ff",

    "--accent-cyan": "#40e8ff",
    "--accent-cyan-glow": "rgba(64,232,255,0.1)",
    "--accent-cyan-border": "rgba(64,232,255,0.15)",
    "--accent-green": "#00ff88",
    "--accent-green-glow": "rgba(0,255,136,0.06)",
    "--accent-orange": "#ffaa44",
    "--accent-red": "#ff5040",
    "--accent-red-glow": "rgba(255,80,60,0.06)",
    "--accent-purple": "#a080ff",
    "--accent-red-stat": "#ff5566",

    "--solid-fill": "rgb(50,62,78)",
    "--scrollbar-thumb": "#0a2040",

    "--shadow-canvas": "0 4px 40px rgba(0,10,30,0.5), inset 0 0 60px rgba(0,0,0,0.3)",
    "--shadow-logo": "0 0 20px rgba(64,232,255,0.1)",

    "--colorbar-velocity": "linear-gradient(to bottom,#ef4444,#3b82f6)",
    "--colorbar-pressure": "linear-gradient(to bottom,#dc2626,#2563eb)",

    "--topbar-blur": "blur(12px)",
  },
  light: {
    "--bg-root": "#f0f4f8",
    "--bg-panel": "rgba(255,255,255,0.92)",
    "--bg-panel-hover": "rgba(245,248,252,0.95)",
    "--bg-topbar": "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,254,0.96) 100%)",
    "--bg-canvas": "#e8eef4",
    "--bg-input": "#dce4ee",
    "--bg-table-odd": "#f5f8fc",
    "--bg-table-even": "#edf2f8",
    "--bg-table-header": "#e4eaf2",

    "--border-primary": "#c8d8e8",
    "--border-accent": "#6aaccf",
    "--border-subtle": "#d0dcea",

    "--text-primary": "#1a2a3a",
    "--text-secondary": "#3a5068",
    "--text-muted": "#6a8aa0",
    "--text-dim": "#8aaaba",
    "--text-faint": "#aabece",
    "--text-heading": "#0a7ea4",

    "--accent-cyan": "#0a7ea4",
    "--accent-cyan-glow": "rgba(10,126,164,0.08)",
    "--accent-cyan-border": "rgba(10,126,164,0.2)",
    "--accent-green": "#0a8a4a",
    "--accent-green-glow": "rgba(10,138,74,0.06)",
    "--accent-orange": "#c07820",
    "--accent-red": "#cc3030",
    "--accent-red-glow": "rgba(204,48,48,0.06)",
    "--accent-purple": "#7050cc",
    "--accent-red-stat": "#d04050",

    "--solid-fill": "rgb(160,175,195)",
    "--scrollbar-thumb": "#b8c8d8",

    "--shadow-canvas": "0 4px 24px rgba(0,20,60,0.08), inset 0 0 40px rgba(0,0,0,0.02)",
    "--shadow-logo": "0 0 12px rgba(10,126,164,0.15)",

    "--colorbar-velocity": "linear-gradient(to bottom,#ef4444,#3b82f6)",
    "--colorbar-pressure": "linear-gradient(to bottom,#dc2626,#2563eb)",

    "--topbar-blur": "blur(12px)",
  },
};

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    try {
      const saved = localStorage.getItem("aerotunnel-theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {}
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });

  // Apply CSS variables to :root
  useEffect(() => {
    const tokens = themes[mode];
    const root = document.documentElement;
    for (const [key, val] of Object.entries(tokens)) {
      root.style.setProperty(key, val);
    }
    root.setAttribute("data-theme", mode);
    try { localStorage.setItem("aerotunnel-theme", mode); } catch {}
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

// Helper: get current CSS variable value
export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
