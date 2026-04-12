import { CONTROL_SECTIONS } from "./iconRailConfig";

function RailIcon({ icon }) {
  if (icon === "shape") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    );
  }
  if (icon === "flow") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M4 8h8c3 0 3-4 0-4" />
        <path d="M4 12h13c4 0 4-5 0-5" />
        <path d="M4 16h10c3 0 3 4 0 4" />
      </svg>
    );
  }
  if (icon === "visual") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M12 3 21 12 12 21 3 12Z" />
        <path d="M8 12h8" />
      </svg>
    );
  }
  if (icon === "transform") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M5 19 19 5" />
        <path d="M12 5h7v7" />
        <path d="M5 13v6h6" />
      </svg>
    );
  }
  if (icon === "analysis") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M5 19V9" />
        <path d="M12 19V5" />
        <path d="M19 19v-7" />
      </svg>
    );
  }
  if (icon === "about") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 11v5" />
        <path d="M12 8h.01" />
      </svg>
    );
  }
  if (icon === "pause") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M9 7v10" />
        <path d="M15 7v10" />
      </svg>
    );
  }
  if (icon === "play") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M8 6 18 12 8 18Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M19 8a7 7 0 1 0 1 7" />
      <path d="M19 4v4h-4" />
    </svg>
  );
}

export default function IconRail({
  activeSection,
  onSectionChange,
  running,
  onRunToggle,
  onReset,
  currentView = "tunnel",
  panelOpen = false,
  onViewChange,
}) {
  return (
    <nav className="icon-rail" aria-label="AeroLab rail navigation">
      <div className="icon-rail__group">
        {CONTROL_SECTIONS.map(section => (
          <button
            key={section.id}
            className={`rail-btn ${currentView === "tunnel" && panelOpen && activeSection === section.id ? "is-active" : ""}`}
            aria-label={`Open ${section.label} controls`}
            data-tooltip={section.label}
            onClick={() => onSectionChange(section.id)}
          >
            <RailIcon icon={section.icon} />
          </button>
        ))}
      </div>
      <div className="icon-rail__separator" />
      <div className="icon-rail__group">
        <button
          className={`rail-btn ${currentView === "analysis" ? "is-active" : ""}`}
          aria-label="Open analysis view"
          data-tooltip="Analysis"
          onClick={() => onViewChange("analysis")}
        >
          <RailIcon icon="analysis" />
        </button>
        <button
          className={`rail-btn ${currentView === "about" ? "is-active" : ""}`}
          aria-label="Open about view"
          data-tooltip="About"
          onClick={() => onViewChange("about")}
        >
          <RailIcon icon="about" />
        </button>
      </div>
      <div className="icon-rail__actions">
        <button
          className={`rail-action rail-action--run ${running ? "is-running" : "is-paused"}`}
          aria-label={running ? "Hold simulation" : "Run simulation"}
          onClick={onRunToggle}
        >
          <RailIcon icon={running ? "pause" : "play"} />
        </button>
        <button className="rail-btn" aria-label="Reset solver" data-tooltip="Reset" onClick={onReset}>
          <RailIcon icon="reset" />
        </button>
      </div>
    </nav>
  );
}
