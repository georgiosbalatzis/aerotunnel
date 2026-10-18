import { useRef } from "react";
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
  if (icon === "simulation") {
    return <svg viewBox="0 0 24 24" aria-hidden><rect x="3" y="5" width="18" height="14" /><path d="M6 9h12M6 15h12" /></svg>;
  }
  if (icon === "about") {
    return <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v1" /></svg>;
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
  started = true,
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
  const controlItems = CONTROL_SECTIONS.map(section => ({
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
      id: "simulation",
      className: `floating-rail-btn ${currentView === "tunnel" ? "is-active" : ""}`,
      ariaLabel: "Open simulation view",
      tooltip: "Simulation",
      icon: "simulation",
      isActive: currentView === "tunnel",
      onClick: () => onViewChange("tunnel"),
    },
    {
      id: "compare",
      className: `floating-rail-btn ${compareMode ? "is-active" : ""}`,
      ariaLabel: "Compare fields",
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
    {
      id: "about",
      className: `floating-rail-btn ${currentView === "about" ? "is-active" : ""}`,
      ariaLabel: "Open About view",
      tooltip: "About",
      icon: "about",
      isActive: currentView === "about",
      onClick: () => onViewChange("about"),
    },
  ];
  const actionItems = [
    {
      id: "run",
      className: `floating-rail-action ${running ? "is-running" : "is-paused"}`,
      ariaLabel: running ? "Pause simulation" : "Run simulation",
      icon: running ? "pause" : "play",
      onClick: onRunToggle,
    },
    {
      id: "reset",
      className: "floating-rail-btn",
      ariaLabel: "Reset simulation",
      tooltip: "Reset simulation",
      title: "Restart flow with current geometry, settings and history (R)",
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
  const railItems = [...viewItems.filter(item => item.id !== "compare"), ...controlItems, viewItems.find(item => item.id === "compare"), ...actionItems.filter(item => item.id !== "run"), actionItems.find(item => item.id === "run")];
  const buttonRefs = useRef([]);
  const handleRailKeyDown = event => {
    const buttons = buttonRefs.current.filter(button => button && !button.disabled && button.getClientRects().length);
    const current = buttons.indexOf(document.activeElement);
    let next;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = buttons.length - 1;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (current + 1) % buttons.length;
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = (current - 1 + buttons.length) % buttons.length;
    if (next === undefined) return;
    event.preventDefault();
    buttons[next]?.focus();
  };
  const renderRailButton = item => {
    const index = railItems.indexOf(item);

    return (
      <button
        type="button"
        key={item.id}
        ref={node => { buttonRefs.current[index] = node; }}
        className={item.className}
        aria-label={item.ariaLabel}
        aria-pressed={item.isActive}
        disabled={(item.id === "undo" && !canUndo) || (item.id === "redo" && !canRedo)}
        title={item.title || item.tooltip || item.ariaLabel}
        data-control-section={item.id.startsWith("control-") ? item.id.slice(8) : undefined}
        onFocus={event => event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" })}
        tabIndex={0}
        onClick={item.onClick}
      >
        <RailIcon icon={item.icon} />
        <span className="rail-button-label">{item.id === "run" ? running ? "Pause" : "Run" : item.tooltip}</span>
      </button>
    );
  };

  return (
    <nav className="workspace-navigation" aria-label="AEROTUNNEL rail navigation" onKeyDown={handleRailKeyDown}>
      <div className="workspace-navigation__views" role="group" aria-label="Application views">
        {viewItems.filter(item => item.id !== "compare").map(renderRailButton)}
      </div>
      <div className="workspace-navigation__tools" role="group" aria-label="Simulation settings and comparison" hidden={currentView !== "tunnel"}>
        {controlItems.map(renderRailButton)}
        {renderRailButton(viewItems.find(item => item.id === "compare"))}
        {actionItems.filter(item => item.id !== "run").map(renderRailButton)}
      </div>
      <div className="workspace-navigation__run">
        {started && renderRailButton(actionItems.find(item => item.id === "run"))}
      </div>
    </nav>
  );
}
