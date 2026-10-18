import { useState } from 'react';
import ExportActions from './ExportActions.jsx';
import RecordedFrames from './RecordedFrames.jsx';
import { EMBED_CODE, EMBED_URL } from '../publishing/figure.js';

export default function PublishingDialog({ dialogRef, busy, error, onImage, actions, frames, canCapture, notice }) {
  const [options, setOptions] = useState({ title: '', theme: 'light', format: 'publication', legend: true, method: true });
  const [copied, setCopied] = useState('');
  const edit = (key, value) => setOptions(previous => ({ ...previous, [key]: value }));
  const copy = async () => {
    try { await navigator.clipboard.writeText(EMBED_CODE); setCopied('Embed code copied.'); }
    catch { setCopied('Clipboard unavailable. Select and copy the code below.'); }
  };
  const keepFocus = event => {
    if (event.key !== 'Tab') return;
    const controls = [...event.currentTarget.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')]
      .filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return <dialog ref={dialogRef} className="publishing-dialog" aria-labelledby="publishing-title" aria-modal="true" onKeyDown={keepFocus}>
    <header className="publishing-heading"><div><h2 id="publishing-title">Share &amp; export</h2><p>Publish a figure, retain the data or keep the setup.</p></div><button type="button" onClick={() => dialogRef.current.close()} aria-label="Close share and export">Close</button></header>
    <section id="publishing-image" aria-labelledby="publishing-image-title"><h3 id="publishing-image-title">Save Image</h3>
      <p className="publishing-note">Publication PNG: 2400px wide, with preserved geometry and scientific colors. Scaling adds no simulation detail. The displayed simulation keeps running during capture.</p>
      <div className="publishing-image-form">
        <label>Figure title <span>(optional; preset and field when blank)</span><input maxLength="140" value={options.title} onChange={event => edit('title', event.target.value)} placeholder="e.g. Front Wing · velocity field" /></label>
        <label>Image layout<select value={options.format} onChange={event => edit('format', event.target.value)}><option value="publication">Publication figure</option><option value="native">Native canvas · technical image</option></select></label>
        <label>Figure style<select value={options.theme} disabled={options.format === 'native'} onChange={event => edit('theme', event.target.value)}><option value="light">Light · paper</option><option value="dark">Dark · charcoal</option></select></label>
        <label className="publishing-check"><input type="checkbox" checked={options.legend} disabled={options.format === 'native'} onChange={event => edit('legend', event.target.checked)} />Include color legend when applicable</label>
        <label className="publishing-check"><input type="checkbox" checked={options.method} disabled={options.format === 'native'} onChange={event => edit('method', event.target.checked)} />Include methodology note</label>
      </div>
      {options.format === 'native' && <p className="publishing-note">Native PNG preserves the original canvas dimensions and excludes credits, units and context. Use the publication figure for articles.</p>}
      {!canCapture && <p className="publishing-note">Open Simulation to capture the selected visualization. Data and session downloads remain available here.</p>}
      <button type="button" className="publishing-primary" disabled={busy || !canCapture} onClick={() => onImage(options)}>{busy ? 'Preparing image…' : 'Save Image'}</button>
      {error && <p className="publishing-error" role="alert">{error}</p>}
    </section>
    <section aria-labelledby="publishing-data-title"><h3 id="publishing-data-title">Data &amp; simulation session</h3><ExportActions {...actions} />{notice && <p className="publishing-note" role={/failed/i.test(notice) ? "alert" : "status"}>{notice}</p>}<p className="publishing-note">JSON saves configuration and sampled history, not the LBM distributions, particle state or a deterministic replay. STL is a geometric extrusion, not validated 3D CFD. Imported files stay in your browser.</p></section>
    <section id="publishing-frames" aria-labelledby="publishing-frames-title"><h3 id="publishing-frames-title">Recorded Frames</h3><RecordedFrames {...frames} /></section>
    <section id="publishing-embed" aria-labelledby="publishing-embed-title"><h3 id="publishing-embed-title">Article embed</h3><p className="publishing-note">Interactive default F1 model with explicit Start. This embed does not contain your current geometry, settings, history or saved sessions. Download a figure and JSON separately to document your work.</p>
      <a href={EMBED_URL} target="_blank" rel="noopener noreferrer">Preview default embed</a>
      <label>Article embed code<textarea rows="5" readOnly value={EMBED_CODE} onFocus={event => event.target.select()} /></label>
      <button type="button" onClick={copy}>Copy embed code</button><p className="publishing-note" role="status">{copied}</p>
      <p className="publishing-note">Use at least 560px height on narrow screens. The article host must allow this iframe and the child’s scripts/WASM; production CSP and browser storage partitioning can affect availability. No cross-origin theme or session synchronization.</p>
    </section>
  </dialog>;
}
