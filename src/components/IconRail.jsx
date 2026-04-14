import { useRef, useState } from "react";
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
  const controlItems = CONTROL_SECTIONS.map(section => ({
    id: `control-${section.id}`,
    className: `rail-btn ${currentView === "tunnel" && panelOpen && activeSection === section.id ? "is-active" : ""}`,
    ariaLabel: `Open ${section.label} controls`,
    tooltip: section.label,
    icon: section.icon,
    isActive: currentView === "tunnel" && panelOpen && activeSection === section.id,
    onClick: () => onSectionChange(section.id),
  }));
  const viewItems = [
    {
      id: "analysis",
      className: `rail-btn ${currentView === "analysis" ? "is-active" : ""}`,
      ariaLabel: "Open analysis view",
      tooltip: "Analysis",
      icon: "analysis",
      isActive: currentView === "analysis",
      onClick: () => onViewChange("analysis"),
    },
    {
      id: "about",
      className: `rail-btn ${currentView === "about" ? "is-active" : ""}`,
      ariaLabel: "Open about view",
      tooltip: "About",
      icon: "about",
      isActive: currentView === "about",
      onClick: () => onViewChange("about"),
    },
  ];
  const actionItems = [
    {
      id: "run",
      className: `rail-action rail-action--run ${running ? "is-running" : "is-paused"}`,
      ariaLabel: running ? "Hold simulation" : "Run simulation",
      icon: running ? "pause" : "play",
      onClick: onRunToggle,
    },
    {
      id: "reset",
      className: "rail-btn",
      ariaLabel: "Reset solver",
      tooltip: "Reset",
      icon: "reset",
      onClick: onReset,
    },
  ];
  const railItems = [...controlItems, ...viewItems, ...actionItems];
  const activeIndex = railItems.findIndex(item => item.isActive);
  const defaultFocusIndex = activeIndex >= 0 ? activeIndex : 0;
  const [focusIndex, setFocusIndex] = useState(defaultFocusIndex);
  const buttonRefs = useRef([]);

  const moveFocus = nextIndex => {
    setFocusIndex(nextIndex);
    window.requestAnimationFrame(() => buttonRefs.current[nextIndex]?.focus());
  };
  const handleRailKeyDown = event => {
    const currentIndex = buttonRefs.current.findIndex(button => button === document.activeElement);
    const baseIndex = currentIndex >= 0 ? currentIndex : focusIndex;
    let nextIndex = null;

    if (event.key === "ArrowDown" || event.key === "ArrowRight") nextIndex = (baseIndex + 1) % railItems.length;
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") nextIndex = (baseIndex - 1 + railItems.length) % railItems.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = railItems.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    moveFocus(nextIndex);
  };
  const renderRailButton = item => {
    const index = railItems.indexOf(item);

    return (
      <button
        key={item.id}
        ref={node => { buttonRefs.current[index] = node; }}
        className={item.className}
        aria-label={item.ariaLabel}
        data-tooltip={item.tooltip}
        tabIndex={focusIndex === index ? 0 : -1}
        onFocus={() => setFocusIndex(index)}
        onClick={item.onClick}
      >
        <RailIcon icon={item.icon} />
      </button>
    );
  };

  return (
    <nav className="icon-rail" aria-label="AeroLab rail navigation" onKeyDown={handleRailKeyDown}>
      <div className="icon-rail__group">
        {controlItems.map(renderRailButton)}
      </div>
      <div className="icon-rail__separator" />
      <div className="icon-rail__group">
        {viewItems.map(renderRailButton)}
      </div>
      <div className="icon-rail__actions">
        {actionItems.map(renderRailButton)}
      </div>
    </nav>
  );
}
