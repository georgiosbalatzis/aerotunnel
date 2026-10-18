export default function VisualizationModes({ modes, value, onChange }) {
  return <div className="floating-mode-bar scientific-modes" role="toolbar" aria-label="Visualization modes"
    onKeyDown={event => {
      const buttons = [...event.currentTarget.querySelectorAll('button')];
      const index = buttons.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : event.key === 'ArrowRight' ? (index + 1) % buttons.length : event.key === 'ArrowLeft' ? (index - 1 + buttons.length) % buttons.length : undefined;
      if (next === undefined) return;
      event.preventDefault(); event.stopPropagation(); buttons[next]?.focus();
    }}
    onTouchStart={event => { event.currentTarget._swipeX = event.touches[0].clientX; }}
    onTouchEnd={event => {
      if (event.currentTarget.scrollWidth > event.currentTarget.clientWidth) return;
      const start = event.currentTarget._swipeX;
      if (start == null) return;
      const distance = event.changedTouches[0].clientX - start;
      if (Math.abs(distance) < 60) return;
      const index = modes.findIndex(mode => mode.id === value);
      const next = distance < 0 ? Math.min(index + 1, modes.length - 1) : Math.max(index - 1, 0);
      if (next !== index) { onChange(modes[next].id); try { navigator.vibrate?.(10); } catch { /* Optional device feedback. */ } }
    }}>
    {modes.map((mode, index) => <button type="button" key={mode.id} className={`floating-mode-pill ${value === mode.id ? 'is-active' : ''}`}
      aria-label={`Switch visualization mode to ${mode.label}`} aria-pressed={value === mode.id} title={`${mode.label} [${index + 1}]`}
      onFocus={event => event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })} onClick={() => onChange(mode.id)}>
      <span className="floating-mode-pill__label">{mode.label}</span>
    </button>)}
  </div>;
}
