export function parseControlNumber(text, min, max, step) {
  if (!String(text).trim() || !Number.isFinite(Number(text))) return { error: 'Enter a finite number.' };
  const value = Number(text);
  if (value < min || value > max) return { error: `Enter a value from ${min} to ${max}.` };
  if (step && Math.abs((value - min) / step - Math.round((value - min) / step)) > 1e-8) return { error: `Use increments of ${step} from ${min}.` };
  return { value };
}

export function formatControlNumber(value) {
  return Number.isFinite(value) ? String(Number(value.toPrecision(12))) : String(value);
}

export function geometryIssue(poly) {
  if (!Array.isArray(poly) || poly.length < 3) return 'geom-points';
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const point of poly) {
    if (!Array.isArray(point) || point.length < 2 || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) return 'geom-nonfinite';
    minX = Math.min(minX, point[0]); maxX = Math.max(maxX, point[0]);
    minY = Math.min(minY, point[1]); maxY = Math.max(maxY, point[1]);
  }
  if ((maxX - minX) * (maxY - minY) < 1e-6) return 'geom-area';
  const origin = poly[0];
  // CAD contours can begin with near-duplicate vertices; use a stable baseline.
  const direction = poly.reduce((farthest, point) =>
    Math.hypot(point[0] - origin[0], point[1] - origin[1]) > Math.hypot(farthest[0] - origin[0], farthest[1] - origin[1]) ? point : farthest, origin);
  if (!direction || poly.every(point => Math.abs((direction[0] - origin[0]) * (point[1] - origin[1]) - (direction[1] - origin[1]) * (point[0] - origin[0])) < 1e-12)) return 'geom-area';
  return null;
}

export const GEOMETRY_ERRORS = {
  'geom-points': 'The profile needs at least three points. Choose a closed outline or draw a longer contour.',
  'geom-nonfinite': 'The profile contains invalid coordinates. Check the source file and import a finite 2D outline.',
  'geom-area': 'The profile does not enclose a usable 2D area. Choose a closed outline.',
};

export function sessionIssue(data) {
  if (!data || data.app !== 'aerolab' || !data.version) return 'Choose an AeroTunnel JSON session exported by this application.';
  const fields = { geometry: ['cx', 'cy', 'sx', 'sy', 'aoa', 'simplify'], solver: ['vel', 'turb', 'nu'], display: ['pCount', 'trailOp', 'simSpd'] };
  if (!Object.keys(fields).some(key => data[key] && typeof data[key] === 'object')) return 'This session has no geometry or simulation settings.';
  for (const [section, keys] of Object.entries(fields)) {
    if (data[section] === undefined) continue;
    if (!data[section] || typeof data[section] !== 'object' || Array.isArray(data[section])) return `The session ${section} settings are invalid.`;
    for (const key of keys) if (data[section][key] !== undefined && !Number.isFinite(data[section][key])) return `The session value ${key} must be a finite number.`;
  }
  if (data.geometry?.preset !== undefined && typeof data.geometry.preset !== 'string') return 'The session preset name must be text.';
  if (data.display?.mode !== undefined && !['velocity','pressure','streamlines','vorticity','vectors','schlieren','3d'].includes(data.display.mode)) return 'Choose a supported session visualization.';
  if (data.geometry?.poly !== undefined) {
    const issue = geometryIssue(data.geometry.poly);
    if (issue) return GEOMETRY_ERRORS[issue];
  }
  return null;
}
