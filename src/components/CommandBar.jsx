export default function CommandBar({ running, fps, convergenceDelta, solverWarning }) {
  const deltaVal = convergenceDelta != null ? convergenceDelta : 1;
  const deltaColor = deltaVal < 1e-4 ? "var(--accent-hi)" : deltaVal < 1e-2 ? "var(--accent-mid)" : "var(--accent-crit)";
  const deltaText = deltaVal < 1e-6 ? "0" : deltaVal.toExponential(1);
  const barWidth = Math.max(2, Math.min(40, (1 - Math.min(1, Math.log10(deltaVal + 1e-8) / -1)) * 40));

  return (
    <header className="floating-title-chip">
      <span className="floating-title-chip__name">AEROLAB</span>
      <span className={`floating-title-chip__dot ${running ? "is-live" : "is-idle"}`} />
      <span className="floating-title-chip__fps">{fps}</span>
      {running && (
        <span className="floating-title-chip__convergence" title={`Convergence Δ = ${deltaText}`}>
          <span className="convergence-bar" style={{ width: `${barWidth}px`, background: deltaColor }} />
          <span className="convergence-label" style={{ color: deltaColor }}>Δ {deltaText}</span>
        </span>
      )}
    </header>
  );
}
