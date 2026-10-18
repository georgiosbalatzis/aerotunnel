import { simplPoly, xformPoly } from '../engine/geometry.js';

// Preserve the simulated contour and screen-space AoA under one uniform world scale.
export function sceneProfile(poly, { sx, sy, aoa, simplify = 0 }, compact = false) {
  if (!poly || poly.length < 3) return null;
  const contour = simplify > 0 ? simplPoly(poly, simplify * .005) : poly;
  const points = xformPoly(contour, 0, 0, sx, sy, aoa);
  const base = xformPoly(contour, 0, 0, sx, sy, 0);
  const xs = base.map(point => point[0]), ys = base.map(point => point[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1e-6);
  const scale = (compact ? 1.86 : 2.05) / span;
  return points.map(([x, y]) => [x * scale, -y * scale]);
}

export function profileCacheKey(config) {
  return JSON.stringify([config.poly, config.sx, config.sy, config.aoa, config.simplify]);
}
