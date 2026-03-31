import { useTheme } from "./ThemeContext";

export default function ThemeToggle() {
  const { toggle, isDark } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      style={{
        position: "relative",
        width: 72,
        height: 34,
        borderRadius: 6,
        border: "1px solid var(--border-strong)",
        background: "var(--bg-panel)",
        cursor: "pointer",
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingInline: 12,
        color: "var(--text-muted)",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 10,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        transition: "all 0.3s ease",
        overflow: "hidden",
        flexShrink: 0,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      <span style={{ opacity: isDark ? 1 : 0.35, zIndex: 1 }}>N</span>
      <span style={{ opacity: isDark ? 0.35 : 1, zIndex: 1 }}>D</span>
      <div
        style={{
          position: "absolute",
          top: 4,
          left: isDark ? 4 : 36,
          width: 32,
          height: 24,
          borderRadius: 4,
          background: isDark
            ? "var(--gradient-brand)"
            : "linear-gradient(135deg, #ffffff, #dadde3)",
          boxShadow: isDark
            ? "0 0 18px rgba(225,6,0,0.32)"
            : "0 0 10px rgba(0,0,0,0.12)",
          transition: "left 0.3s ease, background 0.3s ease, box-shadow 0.3s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isDark ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="#130504" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="4" stroke="#575b63" strokeWidth="2.2"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="#575b63" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        )}
      </div>
    </button>
  );
}
