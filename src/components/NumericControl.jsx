import { useId, useState } from 'react';
import { parseControlNumber, formatControlNumber } from '../controls/validation.js';

export default function NumericControl({ label, value, min, max, step, onChange, unit = '', help = '', discrete = false }) {
  const id = useId();
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const description = `${id}-help`;
  const commit = () => {
    if (draft === null || draft === String(value)) { setDraft(null); setError(''); return; }
    const result = parseControlNumber(draft, min, max, discrete ? step : undefined);
    if (result.error) { setError(result.error); requestAnimationFrame(() => document.getElementById(description)?.scrollIntoView({ block: 'nearest' })); return; }
    onChange(result.value);
    setDraft(null);
    setError('');
  };
  const formatted = `${formatControlNumber(value)}${unit ? ` ${unit}` : ''}`;
  return (
    <div className="engineering-setting">
      <div className="engineering-setting__heading">
        <label htmlFor={`${id}-range`}>{label}</label>
        <div className="engineering-setting__number">
          <input id={`${id}-number`} type="number" inputMode={discrete ? "numeric" : "decimal"} step={discrete ? step : "any"} min={min} max={max}
            aria-label={`${label} value`} aria-describedby={description} aria-invalid={!!error}
            value={draft ?? formatControlNumber(value)} onChange={event => { setDraft(event.target.value); setError(""); }}
            onBlur={commit} onKeyDown={event => {
              if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); commit(); }
              if (event.key === 'Escape' && draft !== null) { event.stopPropagation(); setDraft(null); setError(''); }
            }} />
          {unit && <span>{unit}</span>}
        </div>
      </div>
      <input id={`${id}-range`} type="range" min={min} max={max} step={step} value={value}
        aria-describedby={description} aria-valuetext={formatted} onChange={event => { setDraft(null); setError(''); onChange(+event.target.value); }} />
      <div className="engineering-setting__bounds" aria-hidden="true"><span>{min}</span><span>{max}</span></div>
      <p id={description} className={error ? 'control-error' : 'control-help'} role={error ? 'alert' : undefined}>
        {error || `${help}${help ? ' ' : ''}${unit ? `Unit: ${unit}. ` : ''}Range ${min}–${max}.`}
        {!error && (value < min || value > max) && ' Stored value retained outside this device’s slider range.'}
      </p>
    </div>
  );
}
