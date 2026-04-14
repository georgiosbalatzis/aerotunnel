const REFERENCE_PROFILES = [
  { title: "NACA 0012", body: "CL 0.00-1.20 / CD 0.006-0.020" },
  { title: "NACA 2412", body: "CL 0.30-1.60 / CD 0.006-0.020" },
  { title: "F1 rear wing", body: "CL 2.50+ / CD 0.80-1.20" },
  { title: "Flat plate", body: "CL 0.00-1.00 / CD 0.02-1.28" },
];

function SigRow({ label, note, value, tone }) {
  const clamped = Math.max(0, Math.min(1, value));

  return (
    <div className="signal-row" style={{ "--tone": tone, "--fill": `${Math.max(4, clamped * 100)}%` }}>
      <div className="signal-copy">
        <span className="signal-label">{label}</span>
        <span className="signal-note">{note}</span>
      </div>
      <div className="signal-track"><span className="signal-fill" /></div>
    </div>
  );
}

export default function LiveMetricsColumn({
  isOpen,
  miniRef,
  vel,
  turb,
  nu,
  pCount,
  maxParticles,
  currentPreset,
  hasRun,
  stats,
  showKeys,
  shortcuts,
}) {
  const signals = [
    { label: "Velocity", note: vel.toFixed(3), value: vel / 0.18, tone: "var(--f1-blue)" },
    { label: "Turbulence", note: turb.toFixed(1), value: turb / 3, tone: "var(--f1-amber)" },
    { label: "Viscosity", note: nu.toFixed(3), value: nu / 0.1, tone: "var(--f1-green)" },
    { label: "Particles", note: `${pCount}/${maxParticles}`, value: pCount / maxParticles, tone: "var(--accent-flow)" },
  ];
  const currentCl = hasRun && Number.isFinite(stats.cl) ? stats.cl.toFixed(3) : "-";
  const profileName = currentPreset?.label || "CUSTOM";
  const profileDescription = currentPreset?.desc || "Imported or sketched package";

  return (
    <aside className={`live-metrics-col ${isOpen ? "is-open" : ""}`} aria-label="Live metrics column">
      <div className="live-section">
        <div className="live-section__title">ONBOARD</div>
        <canvas
          ref={miniRef}
          width={200}
          height={110}
          className="mini-canvas"
          role="img"
          aria-label="Onboard camera telemetry preview"
        />
        <div className="live-signals">
          {signals.map(signal => <SigRow key={signal.label} {...signal} />)}
        </div>
      </div>

      <div className="live-section">
        <div className="live-section__title">ACTIVE PACKAGE</div>
        <div className="live-package-card">
          <div className="live-package-card__name">{profileName}</div>
          <div className="live-package-card__desc">{profileDescription}</div>
        </div>
        <div className="live-cl-card">
          <div className="live-cl-card__key">Current CL</div>
          <div className="live-cl-card__value">{currentCl}</div>
        </div>
      </div>

      <div className="live-section">
        <div className="live-section__title">REFERENCE TABLE</div>
        <div className="live-reference-table">
          {REFERENCE_PROFILES.map(profile => (
            <div className="ref-item" key={profile.title}>
              <strong>{profile.title}</strong>
              <span>{profile.body}</span>
            </div>
          ))}
        </div>
      </div>

      {showKeys && (
        <div className="live-section">
          <div className="live-section__title">SHORTCUTS</div>
          <div className="shortcut-grid live-shortcut-grid">
            {shortcuts.map(([key, description]) => (
              <div className="shortcut-item" key={key}>
                <kbd>{key}</kbd>
                <span>{description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
