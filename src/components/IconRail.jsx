import { useRef, useState } from "react";
import { CONTROL_SECTIONS } from "./iconRailConfig";

const FLOATING_CONTROL_IDS = new Set(["shape", "flow", "visual"]);

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
  if (icon === "compare") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M12 4v16" />
        <rect x="3" y="6" width="7" height="12" rx="1" />
        <rect x="14" y="6" width="7" height="12" rx="1" />
      </svg>
    );
  }
  if (icon === "undo") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M5 8a7 7 0 0 1 14 0 7 7 0 0 1-7 7H5" />
        <path d="M5 4v4h4" />
      </svg>
    );
  }
  if (icon === "redo") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M19 8a7 7 0 0 0-14 0 7 7 0 0 0 7 7h7" />
        <path d="M19 4v4h-4" />
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
  onCompareToggle,
  compareMode = false,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}) {
  const controlItems = CONTROL_SECTIONS.filter(section => FLOATING_CONTROL_IDS.has(section.id)).map(section => ({
    id: `control-${section.id}`,
    className: `floating-rail-btn ${currentView === "tunnel" && panelOpen && activeSection === section.id ? "is-active" : ""}`,
    ariaLabel: `Toggle ${section.label} controls`,
    tooltip: section.label,
    icon: section.icon,
    isActive: currentView === "tunnel" && panelOpen && activeSection === section.id,
    onClick: () => onSectionChange(section.id),
  }));
  const viewItems = [
    {
      id: "compare",
      className: `floating-rail-btn ${compareMode ? "is-active" : ""}`,
      ariaLabel: compareMode ? "Exit comparison mode" : "Enter comparison mode",
      tooltip: "Compare",
      icon: "compare",
      isActive: compareMode,
      onClick: onCompareToggle,
    },
    {
      id: "analysis",
      className: `floating-rail-btn ${currentView === "analysis" ? "is-active" : ""}`,
      ariaLabel: "Open analysis view",
      tooltip: "Analysis",
      icon: "analysis",
      isActive: currentView === "analysis",
      onClick: () => onViewChange("analysis"),
    },
  ];
  const actionItems = [
    {
      id: "run",
      className: `floating-rail-action ${running ? "is-running" : "is-paused"}`,
      ariaLabel: running ? "Hold simulation" : "Run simulation",
      icon: running ? "pause" : "play",
      onClick: onRunToggle,
    },
    {
      id: "reset",
      className: "floating-rail-btn",
      ariaLabel: "Reset solver",
      tooltip: "Reset",
      icon: "reset",
      onClick: onReset,
    },
    {
      id: "undo",
      className: `floating-rail-btn ${!canUndo ? "is-disabled" : ""}`,
      ariaLabel: "Undo shape change",
      tooltip: "Undo",
      icon: "undo",
      onClick: onUndo,
    },
    {
      id: "redo",
      className: `floating-rail-btn ${!canRedo ? "is-disabled" : ""}`,
      ariaLabel: "Redo shape change",
      tooltip: "Redo",
      icon: "redo",
      onClick: onRedo,
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
    <nav className="floating-rail" aria-label="AeroLab rail navigation" onKeyDown={handleRailKeyDown}>
      <div className="floating-rail__group">
        {controlItems.map(renderRailButton)}
      </div>
      <div className="floating-rail__separator" />
      <div className="floating-rail__group">
        {viewItems.map(renderRailButton)}
      </div>
      <div className="floating-rail__actions">
        {actionItems.map(renderRailButton)}
      </div>
    </nav>
  );
}
