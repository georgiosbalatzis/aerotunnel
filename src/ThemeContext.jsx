import { createContext, useContext, useState, useEffect, useCallback } from "react";

/*
 * Theme system — f1stories.gr design language
 * Deep blacks, racing accents, editorial typography tokens
 */

const ThemeContext = createContext(null);

const themes = {
  dark: {
    "--bg-root": "#08060d",
    "--bg-panel": "rgba(14,12,20,0.92)",
    "--bg-panel-hover": "rgba(22,18,32,0.95)",
    "--bg-topbar": "rgba(8,6,13,0.96)",
    "--bg-canvas": "#0a0810",
    "--bg-input": "#16121f",
    "--bg-table-odd": "#0c0a14",
    "--bg-table-even": "#100e18",
    "--bg-table-header": "#0e0c16",

    "--border-primary": "rgba(255,255,255,0.06)",
    "--border-accent": "rgba(64,232,255,0.15)",
    "--border-subtle": "rgba(255,255,255,0.04)",
    "--border-hover": "rgba(64,232,255,0.25)",

    "--text-primary": "#e8e4f0",
    "--text-secondary": "#a098b4",
    "--text-muted": "#6a6280",
    "--text-dim": "#4a4460",
    "--text-faint": "#2e2a3c",
    "--text-heading": "#ffffff",

    "--accent-cyan": "#40e8ff",
    "--accent-cyan-glow": "rgba(64,232,255,0.08)",
    "--accent-cyan-border": "rgba(64,232,255,0.12)",
    "--accent-green": "#00e676",
    "--accent-green-glow": "rgba(0,230,118,0.06)",
    "--accent-orange": "#ff9100",
    "--accent-orange-glow": "rgba(255,145,0,0.06)",
    "--accent-red": "#ff3d3d",
    "--accent-red-glow": "rgba(255,61,61,0.06)",
    "--accent-purple": "#aa3bff",
    "--accent-purple-glow": "rgba(170,59,255,0.08)",
    "--accent-red-stat": "#ff5252",

    "--solid-fill": "rgb(40,36,52)",
    "--scrollbar-thumb": "rgba(255,255,255,0.08)",

    "--shadow-canvas": "0 8px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)",
    "--shadow-logo": "0 0 30px rgba(170,59,255,0.15)",
    "--shadow-card": "0 2px 20px rgba(0,0,0,0.3)",
    "--shadow-card-hover": "0 4px 30px rgba(0,0,0,0.4), 0 0 0 1px rgba(64,232,255,0.1)",

    "--colorbar-velocity": "linear-gradient(to bottom,#ff3d3d,#aa3bff,#40e8ff)",
    "--colorbar-pressure": "linear-gradient(to bottom,#ff3d3d,#aa3bff,#40e8ff)",

    "--topbar-blur": "blur(20px) saturate(1.8)",
    "--glass-bg": "rgba(14,12,20,0.75)",
    "--glass-border": "rgba(255,255,255,0.06)",

    "--gradient-brand": "linear-gradient(135deg, #aa3bff 0%, #40e8ff 100%)",
    "--gradient-warm": "linear-gradient(135deg, #ff3d3d 0%, #ff9100 100%)",
  },
  light: {
    "--bg-root": "#f4f2f7",
    "--bg-panel": "rgba(255,255,255,0.95)",
    "--bg-panel-hover": "rgba(248,246,252,0.98)",
    "--bg-topbar": "rgba(255,255,255,0.92)",
    "--bg-canvas": "#ece8f4",
    "--bg-input": "#e4e0ee",
    "--bg-table-odd": "#f8f6fc",
    "--bg-table-even": "#f0eef6",
    "--bg-table-header": "#e8e4f0",

    "--border-primary": "rgba(0,0,0,0.08)",
    "--border-accent": "rgba(120,40,220,0.2)",
    "--border-subtle": "rgba(0,0,0,0.04)",
    "--border-hover": "rgba(120,40,220,0.3)",

    "--text-primary": "#1a1428",
    "--text-secondary": "#4a4060",
    "--text-muted": "#7a7290",
    "--text-dim": "#9a94a8",
    "--text-faint": "#bab4c8",
    "--text-heading": "#0e0a18",

    "--accent-cyan": "#0891b2",
    "--accent-cyan-glow": "rgba(8,145,178,0.08)",
    "--accent-cyan-border": "rgba(8,145,178,0.2)",
    "--accent-green": "#059669",
    "--accent-green-glow": "rgba(5,150,105,0.06)",
    "--accent-orange": "#d97706",
    "--accent-orange-glow": "rgba(217,119,6,0.06)",
    "--accent-red": "#dc2626",
    "--accent-red-glow": "rgba(220,38,38,0.06)",
    "--accent-purple": "#7c3aed",
    "--accent-purple-glow": "rgba(124,58,237,0.08)",
    "--accent-red-stat": "#ef4444",

    "--solid-fill": "rgb(180,174,196)",
    "--scrollbar-thumb": "rgba(0,0,0,0.12)",

    "--shadow-canvas": "0 4px 30px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
    "--shadow-logo": "0 0 20px rgba(124,58,237,0.12)",
    "--shadow-card": "0 2px 12px rgba(0,0,0,0.06)",
    "--shadow-card-hover": "0 4px 20px rgba(0,0,0,0.1), 0 0 0 1px rgba(124,58,237,0.1)",

    "--colorbar-velocity": "linear-gradient(to bottom,#ef4444,#7c3aed,#0891b2)",
    "--colorbar-pressure": "linear-gradient(to bottom,#ef4444,#7c3aed,#0891b2)",

    "--topbar-blur": "blur(20px) saturate(1.4)",
    "--glass-bg": "rgba(255,255,255,0.7)",
    "--glass-border": "rgba(0,0,0,0.06)",

    "--gradient-brand": "linear-gradient(135deg, #7c3aed 0%, #0891b2 100%)",
    "--gradient-warm": "linear-gradient(135deg, #dc2626 0%, #d97706 100%)",
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
