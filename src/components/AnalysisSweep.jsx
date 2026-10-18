import { useId, useState } from 'react';
import AnalysisChart from './AnalysisChart.jsx';
import { SWEEP_VARIABLES, finite, formatMetric, formatRatio, sweepCSV, validateSweep } from '../analysis/presentation.js';

export default function AnalysisSweep({ form, setForm, active, report, reference, setReference, onStart, onCancel }) {
  const id = useId(), [error, setError] = useState('');
  const current = active || report, rows = current?.results || [], variable = SWEEP_VARIABLES[current?.param || form.param];
  const referenceRow = rows[Math.min(reference, Math.max(0, rows.length - 1))];
  const submit = event => {
    event.preventDefault();
    const issue = validateSweep(form); setError(issue);
    if (issue) return;
    setReference(0); onStart(form.param, Number(form.min), Number(form.max), Number(form.steps));
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([sweepCSV(current)], { type: 'text/csv' }));
    const link = document.createElement('a'); link.href = url; link.download = `aerotunnel-sweep-${current.param}-${Date.now()}.csv`; link.click(); URL.revokeObjectURL(url);
  };
  const edit = (key, value) => { setError(''); setForm(previous => ({ ...previous, [key]: value })); };
  return <section className="report-section" id="analysis-sweep" aria-labelledby={`${id}-heading`}>
    <div className="report-section-heading"><div><h3 id={`${id}-heading`}>Parameter sweep</h3><p>Inspect the recorded response across a parameter interval.</p></div><span className="report-status">{active ? 'Running sweep' : report?.status === 'cancelled' ? 'Cancelled' : report ? 'Complete' : 'Not run'}</span></div>
    <form onSubmit={submit} noValidate className="report-sweep-form" aria-describedby={`${id}-help ${id}-error`}>
      <label htmlFor={`${id}-variable`}>Sweep variable<select id={`${id}-variable`} value={form.param} disabled={!!active} onChange={event => { const param = event.target.value; setError(''); setForm({ param, ...SWEEP_VARIABLES[param] }); }}>
        {Object.entries(SWEEP_VARIABLES).map(([key, spec]) => <option key={key} value={key}>{spec.label}</option>)}
      </select></label>
      <label htmlFor={`${id}-start`}>Start ({SWEEP_VARIABLES[form.param].unit})<input id={`${id}-start`} type="number" step="any" inputMode="decimal" value={form.min} disabled={!!active} onChange={event => edit('min', event.target.value)} /></label>
      <label htmlFor={`${id}-end`}>End ({SWEEP_VARIABLES[form.param].unit})<input id={`${id}-end`} type="number" step="any" inputMode="decimal" value={form.max} disabled={!!active} onChange={event => edit('max', event.target.value)} /></label>
      <label htmlFor={`${id}-points`}>Points<input id={`${id}-points`} type="number" min="2" max="100" step="1" inputMode="numeric" value={form.steps} disabled={!!active} onChange={event => edit('steps', event.target.value)} /></label>
      {active ? <button type="button" className="report-button" onClick={event => { event.preventDefault(); onCancel(); }}>Cancel sweep</button> : <button type="submit" className="report-button">Run sweep</button>}
      <p id={`${id}-help`} className="report-help">Finite endpoints, 2–100 whole points. Descending and equal endpoints are supported. Existing solver stability limits still apply.</p>
      <p id={`${id}-error`} className="report-error" role={error ? 'alert' : undefined}>{error}</p>
    </form>
    {current && <div className="report-sweep-summary">
      <p><strong>{variable.label}</strong> · {formatMetric(current.min)} → {formatMetric(current.max)} {variable.unit} · {current.current}/{current.steps} points recorded</p>
      <progress value={current.current} max={current.steps} aria-label="Sweep progress" />
      {!active && <p role="status">{report.status === 'cancelled' ? 'Partial results retained. Cancellation restores the selected parameter on the next queued frame; no automatic CSV is requested.' : 'Sweep complete. Original parameter restored; the existing automatic CSV download was requested.'}</p>}
    </div>}
    <p className="report-help">Each point advances the same solver for up to 200 steps or until Δu &lt; 10⁻⁴. This is a heuristic stop rule, not validated convergence. Pause the live run for an easier comparison. The inherited viscosity-sweep Re* calculation can use the preceding viscosity; its band is not a physical diagnosis.</p>
    {rows.length ? <>
      <AnalysisChart rows={rows} field="cl" xKey="value" title="CL proxy across the sweep" xLabel={`${variable.label} (${variable.unit})`} caption="Recorded points joined in sweep order, without interpolation or smoothing. Repeated parameter values can overlap." />
      <div className="report-table-scroll" tabIndex={0} onKeyDown={event => { if (event.code === 'Space') event.stopPropagation(); }} role="region" aria-label="Sweep results; scroll horizontally on narrow screens">
        <table className="report-table"><caption>Choose a reference row to compare actual recorded proxies. Δ columns are display-only differences; exports retain their original values and columns.</caption><thead><tr><th scope="col">Reference</th><th scope="col">{variable.label}</th><th scope="col">CL proxy</th><th scope="col">Δ CL</th><th scope="col">CD proxy</th><th scope="col">Δ CD</th><th scope="col">L/D proxy</th><th scope="col">Legacy band</th></tr></thead>
          <tbody>{rows.map((row, index) => <tr key={index}><td><input type="radio" name={`${id}-reference`} checked={Math.min(reference, rows.length - 1) === index} aria-label={`Use sweep point ${index + 1} as reference`} onChange={() => setReference(index)} /></td><td>{formatMetric(row?.value)}</td><td>{formatMetric(row?.cl)}</td><td>{formatMetric(finite(row?.cl) && finite(referenceRow?.cl) ? row.cl - referenceRow.cl : null)}</td><td>{formatMetric(row?.cd)}</td><td>{formatMetric(finite(row?.cd) && finite(referenceRow?.cd) ? row.cd - referenceRow.cd : null)}</td><td>{formatRatio(row?.ld)}</td><td>{row?.regime || 'Unavailable'}</td></tr>)}</tbody>
        </table>
      </div><button type="button" className="report-button" onClick={download}>Download sweep CSV</button>
    </> : <div className="analysis-empty">No sweep results yet. Select a variable and interval, then run a sweep.</div>}
  </section>;
}
