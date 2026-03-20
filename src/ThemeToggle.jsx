import { useTheme } from "./ThemeContext";

export default function ThemeToggle() {
  const { toggle, isDark } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      style={{
        position: "relative",
        width: 48,
        height: 26,
        borderRadius: 13,
        border: "1px solid var(--border-primary)",
        background: isDark
          ? "rgba(255,255,255,0.04)"
          : "rgba(0,0,0,0.06)",
        cursor: "pointer",
        padding: 0,
        display: "flex",
        alignItems: "center",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 3,
          left: isDark ? 3 : 23,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: isDark
            ? "var(--gradient-brand)"
            : "linear-gradient(135deg, #f59e0b, #fbbf24)",
          boxShadow: isDark
            ? "0 0 12px rgba(170,59,255,0.4)"
            : "0 0 12px rgba(245,158,11,0.4)",
          transition: "left 0.4s cubic-bezier(0.4, 0, 0.2, 1), background 0.4s, box-shadow 0.4s",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isDark ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="4" stroke="#78350f" strokeWidth="2.2"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="#78350f" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        )}
      </div>
    </button>
  );
}
