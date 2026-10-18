import { PRESET_GROUPS } from '../engine/geometry.js';
import { FIELD_STYLES, formatFieldValue } from '../visualization/fields.js';

export const PRODUCT_URL = 'https://georgiosbalatzis.github.io/aerotunnel/';
export const EMBED_URL = `${PRODUCT_URL}?embed=1`;
export const EMBED_CODE = `<iframe src="${EMBED_URL}" title="AeroTunnel — educational 2D flow simulation" width="100%" height="640" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" allow="fullscreen"></iframe>`;
// The canvas sheet uses the same canonical core as styles/tokens.css.
export const FIGURE_THEMES = {
  light: { background: '#f2eee4', text: '#20251f', secondary: '#5b6256', border: '#c8c8b9' },
  dark: { background: '#1b1a19', text: '#eee8db', secondary: '#b6bbac', border: '#4b5146' },
};
export function profileLabel(preset) {
  return PRESET_GROUPS.flatMap(group => group.items).find(item => item.id === preset)?.label || preset || 'Custom profile';
}
export function defaultFigureTitle(frame) {
  const field = frame.comparing ? frame.fields.map((entry, index) => `${index ? 'B' : 'A'}: ${FIELD_STYLES[entry.mode]?.title || entry.mode}`).join(' / ') + (frame.difference ? ' · normalized Δ' : '') : frame.mode === '3d' ? 'Qualitative 3D view' : frame.mode === 'streamlines' ? 'Particle pathlines' : frame.mode === 'vectors' ? 'Velocity vectors' : FIELD_STYLES[frame.mode]?.title || frame.mode;
  return `${profileLabel(frame.preset)} · ${field}`;
}
export function figureTitle(value, fallback) {
  return String(value || fallback).replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 140) || fallback;
}
export function containRect(sourceWidth, sourceHeight, x, y, width, height) {
  if (![sourceWidth, sourceHeight, width, height].every(value => Number.isFinite(value) && value > 0)) throw new Error('The captured canvas has no usable dimensions.');
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  return { x: x + (width - sourceWidth * scale) / 2, y: y + (height - sourceHeight * scale) / 2, width: sourceWidth * scale, height: sourceHeight * scale };
}
export function wrapText(ctx, text, width) {
  const lines = []; let line = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    if (line && ctx.measureText(`${line} ${word}`).width <= width) { line += ` ${word}`; continue; }
    if (line) { lines.push(line); line = ''; }
    for (const char of word) {
      if (line && ctx.measureText(line + char).width > width) { lines.push(line); line = ''; }
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines;
}
export function fieldCaption(frame) {
  if (frame.mode === '3d') return `Qualitative 3D view · illustrative surface colors and potential-flow paths; not a 3D LBM solution.${frame.referenceShown ? ' Reference F1 model shown; not the simulated 2D boundary.' : ''}`;
  if (frame.mode === 'streamlines') return 'Particle pathlines · trail bands indicate age, not speed. Paths follow the 2D LBM velocity field.';
  return (frame.fields || []).map((field, index) => `${frame.comparing ? `${index ? 'B' : 'A'} · ` : ''}${FIELD_STYLES[field.mode]?.title || field.mode} (${FIELD_STYLES[field.mode]?.unit || 'unavailable units'}) · ${formatFieldValue(field.min)} to ${formatFieldValue(field.max)} · ${FIELD_STYLES[field.mode]?.note || 'No validated scale'}`).join(' / ') || 'No measured field scale available.';
}
export function freezeCanvas(source) {
  if (!source?.width || !source?.height) throw new Error('The visualization is not ready. Open the simulation and try again.');
  const frozen = document.createElement('canvas'); frozen.width = source.width; frozen.height = source.height;
  frozen.getContext('2d').drawImage(source, 0, 0);
  return frozen;
}
export function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    try { canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The browser could not encode the image. Try again.')), 'image/png'); }
    catch { reject(new Error('The browser blocked canvas capture. Use local assets and try again.')); }
  });
}
export function downloadImage(blob) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  try { link.href = url; link.download = `aerotunnel-${Date.now()}.png`; link.click(); }
  finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
export async function composeFigure(source, frame, options) {
  const title = figureTitle(options.title, defaultFigureTitle(frame));
  if (document.fonts) await Promise.all([document.fonts.load('500 64px "IBM Plex Sans"', title + fieldCaption(frame)), document.fonts.load('700 64px "Barlow Condensed"', 'AEROTUNNEL.')]);
  const theme = FIGURE_THEMES[options.theme] || FIGURE_THEMES.light;
  const canvas = document.createElement('canvas'); canvas.width = 2400;
  const ctx = canvas.getContext('2d'), margin = 96, width = 2208;
  const font = (size, weight = 400, family = 'IBM Plex Sans') => { ctx.font = `${weight} ${size}px "${family}", sans-serif`; };
  font(72, 500); const titleLines = wrapText(ctx, title, width);
  font(36); const settings = wrapText(ctx, `${frame.mode === '3d' ? '2D setup: ' : ''}${profileLabel(frame.preset)} · AoA ${formatFieldValue(frame.aoa)}° · inlet ${formatFieldValue(frame.vel)} cells/step · viscosity ${formatFieldValue(frame.nu)} cells²/step`, width);
  font(36, 500); const caption = wrapText(ctx, fieldCaption(frame), width);
  const method = options.method ? wrapText(ctx, 'Educational 2D D2Q9 LBM in lattice units. Unvalidated model; no SI conversion or complete-car prediction. This image freezes a displayed frame. JSON preserves setup and sampled history, not solver distributions or deterministic replay.', width) : [];
  const warning = frame.warning ? wrapText(ctx, `Warning at capture: ${frame.warning}`, width) : [];
  const plotY = 212 + titleLines.length * 86 + settings.length * 48 + 32;
  const plotHeight = Math.min(1250, width * source.height / source.width);
  const scalar = !['3d', 'streamlines'].includes(frame.mode) && options.legend;
  const legends = scalar ? (frame.fields || []).filter(field => FIELD_STYLES[field.mode]) : [];
  const legendHeight = legends.length ? Math.max(...legends.map(field => 150 + FIELD_STYLES[field.mode].bars.length * 54 + wrapText(ctx, FIELD_STYLES[field.mode].note, legends.length > 1 ? 1056 : width).length * 44)) : 0;
  const comparison = frame.comparing ? wrapText(ctx, `A/B use independent automatic ranges; matching colors do not imply matching values.${frame.difference ? ' Red tint is |normalized A − normalized B|, dimensionless, not a physical subtraction.' : ''}`, width) : [];
  canvas.height = Math.ceil(plotY + plotHeight + 48 + caption.length * 48 + legendHeight + comparison.length * 44 + warning.length * 44 + method.length * 44 + 180);
  ctx.fillStyle = theme.background; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = theme.text; font(56, 700, 'Barlow Condensed'); ctx.fillText('AEROTUNNEL.', margin, 104);
  font(36, 500); ctx.textAlign = 'right'; ctx.fillText('F1 STORIES', canvas.width - margin, 104); ctx.textAlign = 'left';
  ctx.fillStyle = '#ed4c32'; ctx.fillRect(margin, 134, width, 3);
  const drawLines = (lines, y, lineHeight, color = theme.text) => { ctx.fillStyle = color; for (const line of lines) { ctx.fillText(line, margin, y); y += lineHeight; } return y; };
  font(72, 500); let y = drawLines(titleLines, 220, 86);
  font(36); y = drawLines(settings, y + 12, 48, theme.secondary);
  // Never stretch the geometry or recolor/interpolate scientific pixels.
  ctx.fillStyle = '#06080c'; ctx.fillRect(margin, plotY, width, plotHeight);
  const rect = containRect(source.width, source.height, margin, plotY, width, plotHeight);
  ctx.imageSmoothingEnabled = false; ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height);
  font(36, 500); y = drawLines(caption, plotY + plotHeight + 58, 48);
  if (legends.length) {
    const colWidth = legends.length > 1 ? 1056 : width;
    legends.forEach((field, index) => {
      const spec = FIELD_STYLES[field.mode], x = margin + index * (colWidth + 96); let ly = y + 22;
      font(32, 500); ctx.fillStyle = theme.text;
      for (const bar of spec.bars) {
        if (spec.bars.length > 1) { ctx.fillText(bar.label, x, ly); ly += 38; }
        const colors = [...bar.gradient.matchAll(/rgb\((\d+),(\d+),(\d+)\)/g)].map(match => `rgb(${match[1]},${match[2]},${match[3]})`);
        if (field.min === field.max) ctx.fillStyle = colors[0];
        else { const gradient = ctx.createLinearGradient(x, 0, x + colWidth, 0); colors.forEach((color, i) => gradient.addColorStop(i / Math.max(1, colors.length - 1), color)); ctx.fillStyle = gradient; }
        ctx.fillRect(x, ly, colWidth, 26); ly += 54;
      }
      ctx.fillStyle = theme.text; font(32);
      const ticks = field.min === field.max ? [field.min] : [field.min, field.min / 2 + field.max / 2, field.max];
      ticks.forEach((value, i) => { ctx.textAlign = ticks.length === 1 ? 'left' : i === 0 ? 'left' : i === 2 ? 'right' : 'center'; ctx.fillText(`${formatFieldValue(value)}${ticks.length === 1 ? ' (uniform)' : ''}`, x + (ticks.length === 1 ? 0 : colWidth * i / 2), ly); });
      ctx.textAlign = 'left'; ly += 48; ctx.fillStyle = theme.secondary;
      for (const line of wrapText(ctx, `${spec.note}${field.fallback ? ' · fallback scale' : ''}`, colWidth)) { ctx.fillText(line, x, ly); ly += 44; }
    });
    y += legendHeight;
  }
  font(34); y = drawLines(comparison, y + 12, 44, theme.secondary);
  y = drawLines(warning, y + (warning.length ? 16 : 0), 44);
  y = drawLines(method, y + (method.length ? 24 : 0), 44, theme.secondary);
  ctx.fillStyle = theme.border; ctx.fillRect(margin, canvas.height - 116, width, 1);
  font(28); ctx.fillStyle = theme.secondary;
  ctx.fillText(`f1-stories.gr · ${frame.running ? 'Running' : 'Paused / ready'} · ${new Date(frame.at).toISOString()} · source ${source.width}×${source.height}px`, margin, canvas.height - 66);
  return canvas;
}
