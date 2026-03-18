import { useTheme } from "./ThemeContext";

/*
 * Pill-shaped toggle with smooth sliding dot and sun/moon icons.
 * Inspired by the f1stories / betcast toggle pattern: 
 *   compact, high-contrast, with a satisfying slide animation.
 */
export default function ThemeToggle() {
  const { mode, toggle, isDark } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      style={{
        position: "relative",
        width: 52,
        height: 28,
        borderRadius: 14,
        border: "1px solid var(--border-accent)",
        background: isDark
          ? "linear-gradient(135deg, #0a1e34 0%, #0d2a46 100%)"
          : "linear-gradient(135deg, #dce8f4 0%, #c0d4e8 100%)",
        cursor: "pointer",
        padding: 0,
        display: "flex",
        alignItems: "center",
        transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Sliding dot */}
      <div
        style={{
          position: "absolute",
          top: 3,
          left: isDark ? 3 : 25,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: isDark
            ? "linear-gradient(135deg, #40e8ff, #60f0ff)"
            : "linear-gradient(135deg, #f59e0b, #fbbf24)",
          boxShadow: isDark
            ? "0 0 8px rgba(64,232,255,0.5)"
            : "0 0 8px rgba(245,158,11,0.5)",
          transition: "left 0.35s cubic-bezier(0.4, 0, 0.2, 1), background 0.35s, box-shadow 0.35s",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Icon inside dot */}
        {isDark ? (
          // Moon
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 1 }}>
            <path
              d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
              stroke="#020810"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        ) : (
          // Sun
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="4" stroke="#78350f" strokeWidth="2.2" />
            <path
              d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
              stroke="#78350f"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
    </button>
  );
}
