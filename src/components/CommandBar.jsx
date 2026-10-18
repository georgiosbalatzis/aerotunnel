export default function CommandBar({ started, running, fps, convergenceDelta, onStart, onShowIntro, hasStarted, onMinimizeIntro }) {
  return (
    <section className={`workspace-intro ${started ? 'is-compact' : ''}`} aria-label="AeroTunnel introduction">
      <div className="workspace-intro__identity">
        <h1>AEROTUNNEL<span>.</span></h1>
        <p className="workspace-intro__descriptor">Aerodynamics &amp; Flow Simulation</p>
        {!started && <p className="workspace-intro__explanation">Explore airflow around a profile. Adjust its shape and flow conditions, then compare the aerodynamic response.</p>}
      </div>
      <div className="workspace-intro__actions">
        {!started ? <button type="button" className="workspace-primary" onClick={hasStarted ? onMinimizeIntro : onStart}>{hasStarted ? "Return to workspace" : "Start Simulation"} <span aria-hidden="true">→</span></button>
          : <button type="button" className="workspace-intro__expand" onClick={onShowIntro}>Tool overview</button>}
        <div className="workspace-status" aria-label="Simulation status">
          <span className={`workspace-status__dot ${running ? 'is-running' : ''}`} />
          <span>{running ? 'Running' : started ? 'Paused' : 'Ready'}</span>
          {started && <span className="workspace-status__detail">{fps} fps{running && convergenceDelta != null ? ` · Δ ${convergenceDelta.toExponential(1)}` : ''}</span>}
        </div>
      </div>
    </section>
  );
}
