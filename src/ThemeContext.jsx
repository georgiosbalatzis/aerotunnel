/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from "react";

/*
 * Theme system — f1stories.gr design language
 * Supplies BOTH the editorial tokens (--bg-*, --text-*, --accent-*)
 * AND the pit-wall terminal tokens (--f1-*) so every CSS selector works in both modes.
 */

const ThemeContext = createContext(null);

const themes = {
  dark: {
    /* ── Editorial tokens ── */
    "--bg-root":          "#050505",
    "--bg-panel":         "rgba(16,16,18,0.92)",
    "--bg-panel-hover":   "rgba(23,23,26,0.96)",
    "--bg-panel-strong":  "rgba(8,8,9,0.96)",
    "--bg-panel-soft":    "rgba(24,24,27,0.82)",
    "--bg-topbar":        "rgba(6,6,7,0.92)",
    "--bg-canvas":        "#030303",
    "--bg-input":         "rgba(255,255,255,0.08)",
    "--border-primary":   "rgba(255,255,255,0.1)",
    "--border-accent":    "rgba(225,6,0,0.22)",
    "--border-subtle":    "rgba(255,255,255,0.04)",
    "--border-hover":     "rgba(225,6,0,0.32)",
    "--border-strong":    "rgba(225,6,0,0.4)",
    "--text-primary":     "#f5f5f7",
    "--text-secondary":   "#b5b7bd",
    "--text-muted":       "#7f828a",
    "--text-dim":         "#595c64",
    "--text-faint":       "#31333a",
    "--text-heading":     "#ffffff",
    "--accent-red":       "#e10600",
    "--accent-red-glow":  "rgba(225,6,0,0.15)",
    "--accent-purple":    "#e10600",
    "--accent-purple-glow":"rgba(225,6,0,0.15)",
    "--accent-green":     "#6ef36b",
    "--accent-green-glow":"rgba(110,243,107,0.12)",
    "--accent-orange":    "#ffb347",
    "--accent-cyan":      "#d9dde3",
    "--scrollbar-thumb":  "rgba(255,255,255,0.16)",
    "--shadow-canvas":    "0 28px 60px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.04)",
    "--shadow-card":      "0 22px 44px rgba(0,0,0,0.28)",
    "--topbar-blur":      "blur(18px) saturate(1.3)",
    "--glass-bg":         "rgba(16,16,18,0.72)",
    "--glass-border":     "rgba(255,255,255,0.06)",
    "--gradient-brand":   "linear-gradient(135deg, #e10600 0%, #ff6a00 55%, #f5f5f7 100%)",

    /* ── F1 Terminal tokens (used by cfdlab.css) ── */
    "--f1-black":    "#030305",
    "--f1-carbon":   "#0a0a0f",
    "--f1-slate":    "#111118",
    "--f1-panel":    "#16161f",
    "--f1-border":   "#252530",
    "--f1-border-hi":"#3a3a50",
    "--f1-red":      "#e8000d",
    "--f1-red-dim":  "rgba(232,0,13,0.18)",
    "--f1-red-glow": "rgba(232,0,13,0.35)",
    "--f1-amber":    "#ff9500",
    "--f1-green":    "#00d46a",
    "--f1-blue":     "#00b4ff",
    "--f1-white":    "#f0f0f8",
    "--f1-silver":   "#9090a8",
    "--f1-dim":      "#505068",
    "--f1-ghost":    "#2a2a38",
    "--glow-red":    "0 0 24px rgba(232,0,13,0.4), 0 0 60px rgba(232,0,13,0.15)",
    "--glow-green":  "0 0 16px rgba(0,212,106,0.5)",
    "--shadow-panel":"0 4px 24px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.03) inset",
    "--shadow-deep": "0 8px 48px rgba(0,0,0,0.8)",
    "--grid-line":   "rgba(255,255,255,0.025)",
  },
  light: {
    /* ── Editorial tokens ── */
    "--bg-root":          "#efefef",
    "--bg-panel":         "rgba(255,255,255,0.94)",
    "--bg-panel-hover":   "rgba(252,252,252,0.98)",
    "--bg-panel-strong":  "rgba(249,249,250,0.98)",
    "--bg-panel-soft":    "rgba(244,244,246,0.92)",
    "--bg-topbar":        "rgba(245,245,246,0.9)",
    "--bg-canvas":        "#ececed",
    "--bg-input":         "rgba(0,0,0,0.08)",
    "--border-primary":   "rgba(16,16,18,0.1)",
    "--border-accent":    "rgba(213,10,0,0.18)",
    "--border-subtle":    "rgba(0,0,0,0.05)",
    "--border-hover":     "rgba(213,10,0,0.24)",
    "--border-strong":    "rgba(213,10,0,0.34)",
    "--text-primary":     "#151517",
    "--text-secondary":   "#4e5159",
    "--text-muted":       "#767983",
    "--text-dim":         "#a0a3ab",
    "--text-faint":       "#c8cad0",
    "--text-heading":     "#050506",
    "--accent-red":       "#d50a00",
    "--accent-red-glow":  "rgba(213,10,0,0.1)",
    "--accent-purple":    "#d50a00",
    "--accent-purple-glow":"rgba(213,10,0,0.1)",
    "--accent-green":     "#1a8f2e",
    "--accent-green-glow":"rgba(26,143,46,0.1)",
    "--accent-orange":    "#c97b16",
    "--accent-cyan":      "#2b2e35",
    "--scrollbar-thumb":  "rgba(16,16,18,0.16)",
    "--shadow-canvas":    "0 22px 48px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.4)",
    "--shadow-card":      "0 16px 32px rgba(0,0,0,0.08)",
    "--topbar-blur":      "blur(16px) saturate(1.15)",
    "--glass-bg":         "rgba(255,255,255,0.8)",
    "--glass-border":     "rgba(16,16,18,0.08)",
    "--gradient-brand":   "linear-gradient(135deg, #d50a00 0%, #ff7b00 55%, #fafafa 100%)",

    /* ── F1 Terminal tokens — LIGHT variants ── */
    "--f1-black":    "#f6f6f8",
    "--f1-carbon":   "#eeeeef",
    "--f1-slate":    "#e4e4e8",
    "--f1-panel":    "#dddde2",
    "--f1-border":   "#c8c8d0",
    "--f1-border-hi":"#a8a8b4",
    "--f1-red":      "#d50a00",
    "--f1-red-dim":  "rgba(213,10,0,0.1)",
    "--f1-red-glow": "rgba(213,10,0,0.18)",
    "--f1-amber":    "#c97b16",
    "--f1-green":    "#0a8a3e",
    "--f1-blue":     "#0070c0",
    "--f1-white":    "#151518",
    "--f1-silver":   "#4a4a5c",
    "--f1-dim":      "#8a8a9c",
    "--f1-ghost":    "#d0d0d8",
    "--glow-red":    "0 0 16px rgba(213,10,0,0.18), 0 0 40px rgba(213,10,0,0.06)",
    "--glow-green":  "0 0 12px rgba(10,138,62,0.3)",
    "--shadow-panel":"0 2px 16px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.6) inset",
    "--shadow-deep": "0 4px 32px rgba(0,0,0,0.12)",
    "--grid-line":   "rgba(16,16,18,0.04)",
  },
};

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    try {
      const saved = localStorage.getItem("aerotunnel-theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch { /* ignore */ }
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });

  useEffect(() => {
    const tokens = themes[mode];
    const root = document.documentElement;
    for (const [key, val] of Object.entries(tokens)) {
      root.style.setProperty(key, val);
    }
    root.setAttribute("data-theme", mode);
    // Set color-scheme for native elements
    root.style.colorScheme = mode;
    try { localStorage.setItem("aerotunnel-theme", mode); } catch { /* ignore */ }
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
