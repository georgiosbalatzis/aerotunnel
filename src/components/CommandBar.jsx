import { useState } from "react";
import F1Logo from "./F1Logo";
import ThemeToggle from "./ThemeToggle";

export default function CommandBar({
  running,
  fps,
  sessionName,
  onNameChange,
  currentPreset,
  currentMode,
  aoa,
  stats,
  hasRun,
  panelOpen,
  onPanelToggle,
  metricsOpen,
  onMetricsToggle,
  onThemeToggle,
}) {
  const [editingName, setEditingName] = useState(false);
  const reValue = hasRun
    ? (stats.re > 999 ? `${(stats.re / 1000).toFixed(1)}K` : stats.re || "—")
    : "—";

  return (
    <header className="command-bar">
      <div className="command-bar__left">
        <button
          className="command-menu-button"
          aria-label={panelOpen ? "Close control panel" : "Open control panel"}
          onClick={onPanelToggle}
        >
          {panelOpen ? "×" : "≡"}
        </button>
        <div className="brand-logo-mark"><F1Logo size={16} /></div>
        <div className="brand-text">
          <div className="brand-name">AeroLab</div>
          <div className="brand-sub">CFD Terminal</div>
        </div>
      </div>

      <div className="command-bar__center" aria-label="Session telemetry">
        <div className="command-chip">
          <span className="command-chip__key">Session</span>
          {editingName ? (
            <input className="session-name-input" autoFocus value={sessionName}
              onChange={event => onNameChange(event.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={event => { if (event.key === "Enter") setEditingName(false); }} />
          ) : (
            <button className="command-chip__value session-name-editable" onClick={() => setEditingName(true)} title="Click to rename">
              {sessionName}
            </button>
          )}
        </div>
        <div className="command-chip"><span className="command-chip__key">Pkg</span><span className="command-chip__value">{currentPreset?.label || "CUSTOM"}</span></div>
        <div className="command-chip"><span className="command-chip__key">Mode</span><span className="command-chip__value" style={{ color: currentMode.color }}>{currentMode.label}</span></div>
        <div className="command-chip"><span className="command-chip__key">AoA</span><span className="command-chip__value">{aoa}°</span></div>
        <div className="command-chip"><span className="command-chip__key">Re</span><span className="command-chip__value">{reValue}</span></div>
      </div>

      <div className="command-bar__right">
        <button
          className={`command-icon-button ${metricsOpen ? "is-active" : ""}`}
          aria-label={metricsOpen ? "Hide live metrics column" : "Show live metrics column"}
          onClick={onMetricsToggle}
        >
          ◧
        </button>
        <div className={`status-pill ${running ? "is-live" : "is-hold"}`}>
          <span className={`status-dot ${running ? "is-live" : "is-red"}`} />
          {running ? "GREEN FLAG" : "SESSION HOLD"}
        </div>
        <span className="fps-readout">{fps}<span style={{ opacity: .4, fontSize: 9 }}> FPS</span></span>
        <ThemeToggle onToggle={onThemeToggle} />
      </div>
    </header>
  );
}
