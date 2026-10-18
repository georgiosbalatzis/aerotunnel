/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useSyncExternalStore } from "react";

const ThemeContext = createContext(null);
const controller = window.aeroTunnelTheme;

export function ThemeProvider({ children }) {
  const mode = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  return (
    <ThemeContext.Provider value={{ mode, toggle: controller.toggle, isDark: mode === "dark" }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
}
