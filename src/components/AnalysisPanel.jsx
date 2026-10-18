import RecordedFrames from './RecordedFrames.jsx';
import { useEffect, useRef, useState } from 'react';
import AnalysisMetric from './AnalysisMetric.jsx';
import AnalysisChart from './AnalysisChart.jsx';
import AnalysisSweep from './AnalysisSweep.jsx';
import { SWEEP_VARIABLES, analysisSource, convergenceState, finite, formatMetric, formatRatio, formatTime, proxyRatio, readSessionGallery, regimeBand, sameSetup, savedSessionIssue, validTime } from '../analysis/presentation.js';

function SessionGallery({ name, setName, onSave, onLoad, onDelete }) {
  const [gallery, setGallery] = useState(readSessionGallery), [message, setMessage] = useState(''), [error, setError] = useState('');
  const refresh = () => setGallery(readSessionGallery());
  return <section className="report-section" id="analysis-sessions" aria-labelledby="analysis-sessions-heading">
    <div className="report-section-heading"><div><h3 id="analysis-sessions-heading">Saved sessions</h3><p>Store the current setup and its most recent 200 records in this browser. Up to ten sessions are retained. Loading a session without history leaves retained records unchanged.</p></div><span>{gallery.items.length}/10 saved</span></div>
    <form className="report-save-form" onSubmit={event => { event.preventDefault(); const ok = onSave(name); refresh(); setError(ok === false ? 'The session could not be saved. Download JSON to keep the current setup.' : ''); if (ok !== false) { setMessage('Current session saved.'); setName(''); } }}>
      <label htmlFor="analysis-session-name">Session name <span className="report-help">(optional)</span><input id="analysis-session-name" value={name} onChange={event => setName(event.target.value)} placeholder="Preset and time when left blank" disabled={!!gallery.error} /></label><button type="submit" className="report-button" disabled={!!gallery.error}>Save current session</button>
    </form>
    {(gallery.error || error) && <p className="report-error" role="alert">{gallery.error || error}</p>}{message && !error && <p className="report-help" role="status">{message}</p>}
    {gallery.items.length ? <ul className="report-session-list">{gallery.items.map((item, index) => { const issue = savedSessionIssue(item), title = item?.name || `Saved entry ${index + 1}`, count = Array.isArray(item?.history) ? item.history.length : 0; return <li key={`${item?.timestamp}-${index}`}>
      <div><h4>{title}</h4><p>{item?.preset || 'Custom setup'} · {formatTime(item?.timestamp)} · {count} historical records</p>{count > 0 && <p>Stored CL {formatMetric(item?.stats?.cl)} · CD {formatMetric(item?.stats?.cd)}</p>}{issue && <p className="report-error">{issue}</p>}</div>
      <div className="report-inline-actions"><button type="button" className="report-button" disabled={!!issue} aria-label={`Load ${title}`} onClick={() => { onLoad(item); setMessage(`Loaded ${title}. Recorded history is distinct from live measurements.`); }}>Load</button><button type="button" className="report-button" aria-label={`Delete ${title}`} onClick={() => { const ok = onDelete(index); refresh(); setError(ok === false ? 'This entry could not be deleted from browser storage.' : ''); setMessage(ok === false ? '' : `Deleted ${title}.`); }}>Delete</button></div>
    </li>; })}</ul> : !gallery.error && <div className="analysis-empty">No saved sessions. Save the current setup or download its JSON file.</div>}
  </section>;
}

export default function AnalysisPanel({ isActive = true, hSnap, sample, setup, convergenceDelta, running, started, exportTools, onPublish, onSaveSession, onLoadSession, onDeleteSession, sweepState, sweepReport, onStartSweep, onCancelSweep, recording, onStartRecording, onStopRecording, recordFrameCount, recordingExport, onReturn, onFullscreen }) {
  const [form, setForm] = useState({ param: 'aoa', ...SWEEP_VARIABLES.aoa }), [reference, setReference] = useState(0), [page, setPage] = useState(0), [sessionName, setSessionName] = useState('');
  const heading = useRef(null);
  useEffect(() => { if (!isActive) return; const frame = requestAnimationFrame(() => heading.current?.focus({ preventScroll: true })); return () => cancelAnimationFrame(frame); }, [isActive]);
  if (!isActive) return <article className="analysis-report" hidden inert />;
  const history = Array.isArray(hSnap) ? hSnap : [], source = analysisSource(sample, history, setup), values = source.values;
  const visualRows = history.map(row => row && typeof row === 'object' ? { ...row, ld: proxyRatio(row) } : {});
  const state = running ? 'Running' : started ? 'Paused' : history.length ? 'Recorded history' : 'Not started';
  const unavailable = source.available && ['cl', 'cd', 're', 'maxV'].some(key => !finite(values?.[key]));
  const metrics = [{ label: 'CL proxy', value: formatMetric(values?.cl), note: 'Heuristic lift magnitude', field: 'cl' }, { label: 'CD proxy', value: formatMetric(values?.cd), note: 'Heuristic drag indicator', field: 'cd' }, { label: 'Re*', value: formatMetric(values?.re), note: 'Scaled lattice estimate', field: 're' }, { label: 'L/D proxy', value: formatRatio(proxyRatio(values)), note: 'Ratio of recorded CL to CD', field: 'ld' }];
  const convergenceReady = !!sample && sample.fluidCells > 0 && sameSetup(sample.setup, setup), delta = convergenceReady && finite(convergenceDelta) && convergenceDelta >= 0 ? convergenceDelta : null;
  const pageSize = 25, pages = Math.max(1, Math.ceil(history.length / pageSize)), currentPage = Math.min(page, pages - 1);
  const recent = history.map((row, index) => ({ row, index })).reverse().slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const maxRatio = sample && (!finite(sample.setup?.vel) || sample.setup.vel <= 0) ? null : values?.maxV;

  return <article className="analysis-report" aria-labelledby="analysis-title">
    <header className="analysis-report-header"><div><h2 id="analysis-title" ref={heading} tabIndex={-1}>Analysis</h2><p>Engineering report for the 2D LBM workspace.</p></div><div className="report-header-actions"><span className="report-status">{state}</span><button type="button" className="report-button" onClick={onReturn}>Open simulation</button></div></header>
    <nav className="report-navigation" aria-label="Analysis sections">{[['metrics', 'Metrics'], ['interpretation', 'Interpretation'], ['history', 'History'], ['sweep', 'Sweep'], ['sessions', 'Sessions'], ['exports', 'Exports']].map(([id, label]) => <a key={id} href={`#analysis-${id}`}>{label}</a>)}</nav>
    <section className="report-section" id="analysis-metrics" aria-labelledby="analysis-metrics-heading">
      <div className="report-section-heading"><div><h3 id="analysis-metrics-heading">Aerodynamic indicators</h3><p>{source.source}{source.available && validTime(source.at) ? ` · ${formatTime(source.at)}` : ''}{source.stale ? ' · settings changed since this sample' : ''}</p></div>{unavailable && <span className="report-status">Unavailable values</span>}</div>
      {!source.available && <p className="report-notice">No measured sample yet. Start the simulation and wait for its first telemetry update. Initial zeros are not treated as measurements.</p>}
      {sample?.fluidCells === 0 && <p className="report-notice">No fluid cells with finite speed were available at this sample. CL, CD and maximum speed are unavailable; Re* only describes the configured estimate.</p>}
      {source.stale && <p className="report-notice">These values belong to the previous setup. A new live sample will replace them after the simulation runs.</p>}
      <dl className="report-metrics">{metrics.map(metric => <AnalysisMetric key={metric.field} {...metric} rows={visualRows} />)}</dl>
      <p className="report-help">CL/CD are bulk-velocity proxies, not integrated aerodynamic forces. L/D is unavailable for a missing, nonfinite or nonpositive CD. Recorded trends retain valid zeros and gaps.</p>
    </section>
    <section className="report-section" id="analysis-interpretation" aria-labelledby="analysis-interpretation-heading">
      <div className="report-section-heading"><div><h3 id="analysis-interpretation-heading">Flow &amp; convergence</h3><p>Interpretation of the available sample, with its limits.</p></div></div>
      <dl className="report-interpretation"><div><dt>Maximum speed ratio</dt><dd>{formatMetric(maxRatio, 3)}</dd><p>max |u| / inlet speed. Dimensionless, not m/s. A live zero-inlet fallback is unavailable; old records lack inlet provenance.</p></div><div><dt>Velocity-change Δu</dt><dd>{formatMetric(delta, 6)}</dd><p>{convergenceState(convergenceDelta, convergenceReady)}. Cells/step; not an accuracy certificate.</p></div><div><dt>Legacy Re* band</dt><dd>{regimeBand(values?.re)}</dd><p>Thresholds 2300/4000. Not a validated transition or turbulence diagnosis.</p></div></dl>
      <div className="report-setup"><h4>Current setup</h4><dl><div><dt>Profile</dt><dd>{setup.preset || 'Custom'}</dd></div><div><dt>Inlet</dt><dd>{formatMetric(setup.vel)} cells/step</dd></div><div><dt>Viscosity</dt><dd>{formatMetric(setup.nu)} cells²/step</dd></div><div><dt>Angle</dt><dd>{formatMetric(setup.aoa)}°</dd></div></dl></div>
      <p className="report-help">History can span multiple setups. Restored records are not a fresh solver state. The 3D view is a qualitative extrusion/potential-flow illustration, not validated full 3D CFD.</p>
    </section>
    <section className="report-section" id="analysis-history" aria-labelledby="analysis-history-heading">
      <div className="report-section-heading"><div><h3 id="analysis-history-heading">Recorded history</h3><p>{history.length} retained records · {history.length < 2 ? 'Insufficient data for a trend' : 'Independent CL/CD scales, each including zero'}</p></div><span className="report-pan-hint">Narrow screen: scroll figures and tables horizontally.</span></div>
      <div className="report-figures"><AnalysisChart rows={history} field="cl" title="CL · lift proxy" /><AnalysisChart rows={history} field="cd" title="CD · drag proxy" /></div>
      <details className="report-details"><summary>Recorded samples · {history.length} rows</summary>
        <div className="report-table-scroll" role="region" tabIndex={0} onKeyDown={event => { if (event.code === 'Space') event.stopPropagation(); }} aria-label="Recorded samples; scroll horizontally on narrow screens"><table className="report-table"><caption>Newest first. Timestamps are wall-clock recording times. Missing or invalid values remain unavailable; original data are retained.</caption><thead><tr><th scope="col">Record</th><th scope="col">Recorded time</th><th scope="col">CL proxy</th><th scope="col">CD proxy</th><th scope="col">L/D proxy</th><th scope="col">Re*</th><th scope="col">Max speed ratio</th></tr></thead><tbody>{recent.map(({ row, index }) => <tr key={index}><th scope="row">{index + 1}</th><td>{formatTime(row?.t)}</td><td>{formatMetric(row?.cl)}</td><td>{formatMetric(row?.cd)}</td><td>{formatRatio(proxyRatio(row))}</td><td>{formatMetric(row?.re)}</td><td>{formatMetric(row?.maxV, 3)}</td></tr>)}</tbody></table></div>
        {history.length > 0 && <div className="report-pagination"><button type="button" className="report-button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Newer records</button><span>Page {currentPage + 1} of {pages}</span><button type="button" className="report-button" disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}>Older records</button></div>}
      </details>
    </section>
    <AnalysisSweep form={form} setForm={setForm} active={sweepState} report={sweepReport} reference={reference} setReference={setReference} onStart={onStartSweep} onCancel={onCancelSweep} />
    <SessionGallery name={sessionName} setName={setSessionName} onSave={onSaveSession} onLoad={onLoadSession} onDelete={onDeleteSession} />
    <section className="report-section" id="analysis-exports" aria-labelledby="analysis-exports-heading">
      <div className="report-section-heading"><div><h3 id="analysis-exports-heading">Export &amp; documentation</h3><p>Keep the underlying records and setup, with their original formats.</p></div></div>
      <div className="report-inline-actions"><button type="button" className="report-button" onClick={onPublish}>Share &amp; Export</button><button type="button" className="report-button" onClick={onFullscreen}>Fullscreen</button></div>
      {exportTools}
      <h4 style={{ marginTop: 24 }}>Recorded Frames</h4>
      <RecordedFrames recording={recording} count={recordFrameCount} state={recordingExport} onStart={onStartRecording} onStop={onStopRecording} />
      <details className="report-details"><summary>Method, units &amp; export contract</summary><p>AeroTunnel is an educational two-dimensional D2Q9 LBM simulation in lattice units. CL = abs(mean(uy) × 2 × (1 + .06 × AoA)); CD = mean(abs(ux − inlet)) × .5 + .008. These are not surface-force coefficients. Re* = inlet × sx / (ν + 10⁻⁶) × 10.</p><p>CSV columns remain timestamp, cl, cd, re, maxV. The historical maxV name denotes a speed ratio. JSON uses the existing version-2 session format and preserves original history. Sweep CSV and recording ZIP formats remain compatible. Nonfinite fields are shown as gaps or unavailable values, without rewriting the source records.</p></details>
    </section>
  </article>;
}
