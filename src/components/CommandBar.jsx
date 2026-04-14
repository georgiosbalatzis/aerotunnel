export default function CommandBar({ running, fps }) {
  return (
    <header className="floating-title-chip">
      <span className="floating-title-chip__name">AEROLAB</span>
      <span className={`floating-title-chip__dot ${running ? "is-live" : "is-idle"}`} />
      <span className="floating-title-chip__fps">{fps}</span>
    </header>
  );
}
