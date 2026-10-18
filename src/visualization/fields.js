import { TURBO, COOLWARM } from '../engine/lut.js';

export function paletteGradient(lut, brightness = 1) {
  return `linear-gradient(to right,${Array.from(lut, (color, i) => `rgb(${[color & 255, (color >>> 8) & 255, (color >>> 16) & 255].map(c => Math.floor(c * brightness)).join(',')}) ${i / 255 * 100}%`).join(',')})`;
}
const arrows = Uint32Array.from({ length: 256 }, (_, i) => {
  const t = i / 255;
  const r = t < .5 ? (t * 2 * 255) | 0 : 255;
  const g = t < .5 ? 255 : ((1 - (t - .5) * 2) * 255) | 0;
  const b = t < .3 ? ((1 - t / .3) * 200) | 0 : 0;
  return (255 << 24) | (b << 16) | (g << 8) | r;
});
export const FIELD_STYLES = {
  velocity: { title: 'Speed |u|', unit: 'cells/step', note: 'Lattice velocity · automatic range', bars: [{ label: 'Turbo', gradient: paletteGradient(TURBO) }] },
  pressure: { title: 'Density ρ', unit: 'lattice density', note: 'Pressure proxy · raw density, not Pa', bars: [{ label: 'CoolWarm', gradient: paletteGradient(COOLWARM) }] },
  vorticity: { title: 'Signed vorticity ωz', unit: '1/step', note: 'Automatic range · zero has no fixed color', bars: [{ label: 'Turbo', gradient: paletteGradient(TURBO) }] },
  vectors: { title: 'Speed |u|', unit: 'cells/step', note: 'Arrow length capped · automatic range', bars: [{ label: 'Arrows', gradient: paletteGradient(arrows) }, { label: 'Background', gradient: paletteGradient(TURBO, .3) }] },
  schlieren: { title: 'Vertical density gradient |∂ρ/∂y|', unit: 'lattice density/cell', note: 'Contrast normalized to each frame’s maximum', bars: [{ label: 'Low → high', gradient: 'linear-gradient(to right,rgb(240,230,200),rgb(40,25,15))' }] },
};
export function formatFieldValue(value) {
  if (!Number.isFinite(value)) return '—';
  return String(Number(value.toPrecision(8)));
}
export function comparisonAvailable(mode) {
  return !['streamlines', 'vectors', '3d'].includes(mode);
}
