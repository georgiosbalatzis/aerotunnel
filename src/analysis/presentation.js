import { geometryIssue } from '../controls/validation.js';
export const SETUP_FIELDS = ['poly', 'cx', 'cy', 'sx', 'sy', 'aoa', 'simplify', 'vel', 'turb', 'nu'];
export const SWEEP_VARIABLES = {
  aoa: { label: 'Angle of attack', unit: '°', min: -10, max: 20, steps: 31 },
  velocity: { label: 'Inlet velocity', unit: 'cells/step', min: .02, max: .18, steps: 17 },
  viscosity: { label: 'Viscosity', unit: 'cells²/step', min: .005, max: .1, steps: 20 },
};
export const finite = value => typeof value === 'number' && Number.isFinite(value);
export const sameSetup = (a, b) => !!a && !!b && SETUP_FIELDS.every(key => Object.is(a[key], b[key]));
export function formatMetric(value, digits = 4) {
  if (!finite(value)) return '—';
  if (Math.abs(value) >= 1e7 || (value !== 0 && Math.abs(value) < .0001)) return value.toExponential(3);
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: digits }).format(value);
}
export function proxyRatio(row) {
  if (!finite(row?.cl) || !finite(row?.cd) || row.cd <= 0) return null;
  const value = row.cl / row.cd;
  return finite(value) ? value : null;
}
export function formatRatio(value) {
  if (!finite(value)) return '—';
  return Math.abs(value) >= 1e7 ? value.toExponential(3) : value.toFixed(2);
}
export function validTime(value) {
  return (finite(value) || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(new Date(value).getTime());
}
export function formatTime(value) {
  return validTime(value) ? new Date(value).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', year: 'numeric', month: 'short', day: 'numeric' }) : 'Unavailable time';
}
export function csvIssue(history) {
  if (!Array.isArray(history) || !history.length) return 'Record at least one sample for CSV export.';
  if (history.some(row => !row || typeof row !== 'object' || !validTime(row.t))) return 'Some records have no valid timestamp. JSON preserves the original records; CSV cannot encode their time reliably.';
  if (history.some(row => ['cl', 'cd', 're', 'maxV'].some(key => row[key] != null && !finite(row[key])))) return 'Some records contain nonnumeric or nonfinite metrics. CSV is unavailable; JSON preserves the original data safely.';
  return '';
}
export function analysisSource(sample, history, setup) {
  if (sample) return { values: sample.fluidCells === 0 ? { ...sample.values, cl: null, cd: null, maxV: null } : sample.values, at: sample.at, source: 'Last live sample', stale: !sameSetup(sample.setup, setup), available: true };
  if (history.length) return { values: history.at(-1), at: history.at(-1)?.t, source: 'Latest recorded sample', stale: false, available: true };
  return { values: null, at: null, source: 'Awaiting a sample', stale: false, available: false };
}
export function regimeBand(value) {
  if (!finite(value) || value < 0) return 'Unavailable';
  return value < 2300 ? 'LAMINAR' : value < 4000 ? 'TRANS.' : 'TURB.';
}
export function convergenceState(value, available) {
  if (!available) return 'Not sampled for this setup';
  if (!finite(value) || value < 0) return 'Unavailable result';
  return value < 1e-4 ? 'Below sweep stop threshold' : 'Unconverged estimate';
}
export function chartDomain(values, includeZero = true) {
  let min = includeZero ? 0 : Infinity, max = includeZero ? 0 : -Infinity, count = 0;
  for (const value of values) if (finite(value)) { min = Math.min(min, value); max = Math.max(max, value); count++; }
  if (!count) return { min: 0, max: 1, count };
  if (min === max) {
    if (includeZero) return { min: 0, max: 1, count };
    const pad = Math.max(Math.abs(min) * .05, .0001);
    return { min: finite(min - pad) ? min - pad : min, max: finite(max + pad) ? max + pad : max, count };
  }
  const scale = Math.max(Math.abs(min), Math.abs(max));
  const pad = (max / scale - min / scale) * .08 * scale;
  const lower = min < 0 ? min - pad : min, upper = max > 0 ? max + pad : max;
  return { min: finite(lower) ? lower : min, max: finite(upper) ? upper : max, count };
}
export function chartPosition(value, domain) {
  const scale = Math.max(Math.abs(domain.min), Math.abs(domain.max), 1);
  return (value / scale - domain.min / scale) / (domain.max / scale - domain.min / scale);
}
export function seriesSegments(rows, key, xKey) {
  const segments = []; let segment = [];
  rows.forEach((row, index) => {
    const x = xKey ? row?.[xKey] : index, y = row?.[key];
    if (finite(x) && finite(y)) segment.push({ x, y, index });
    else if (segment.length) { segments.push(segment); segment = []; }
  });
  if (segment.length) segments.push(segment);
  return segments;
}
export function validateSweep({ param, min, max, steps }) {
  if (!SWEEP_VARIABLES[param]) return 'Choose a sweep variable.';
  for (const [label, value] of [['Start', min], ['End', max]]) if (!String(value).trim() || !finite(Number(value))) return `${label} must be a finite number.`;
  if (!finite(Number(max) - Number(min))) return 'The interval is too large to represent reliably.';
  if (!String(steps).trim() || !Number.isInteger(Number(steps)) || Number(steps) < 2 || Number(steps) > 100) return 'Use a whole number of points from 2 to 100.';
  return '';
}
export function sweepCSV(report) {
  return `${report.param},cl,cd,ld_ratio,regime\n${report.results.map(row => `${row.value},${row.cl},${row.cd},${row.ld},${row.regime}`).join('\n')}`;
}
export function readSessionGallery() {
  try {
    const data = JSON.parse(localStorage.getItem('aerolab-sessions') || '[]');
    if (!Array.isArray(data)) return { items: [], error: 'Saved-session data is unreadable. Existing storage has been left untouched.' };
    return { items: data, error: '' };
  } catch { return { items: [], error: 'Saved sessions are unavailable. Download the current setup as JSON instead.' }; }
}
export function savedSessionIssue(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return 'This entry has no readable settings.';
  if (item.poly !== undefined && geometryIssue(item.poly)) return 'This entry has an invalid profile. Original storage has been retained.';
  if (item.history !== undefined && !Array.isArray(item.history)) return 'This entry has an unreadable history.';
  for (const key of ['cx', 'cy', 'sx', 'sy', 'aoa', 'simplify', 'vel', 'nu', 'turb', 'pCount', 'trailOp', 'simSpd']) if (item[key] != null && !finite(item[key])) return `The stored ${key} value is unavailable.`;
  return '';
}
