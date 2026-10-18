import { useId } from 'react';
import { chartDomain, chartPosition, finite, formatMetric, seriesSegments } from '../analysis/presentation.js';

export function AnalysisTrend({ rows, field }) {
  const segments = seriesSegments(rows.slice(-60), field);
  const domain = chartDomain(segments.flat().map(point => point.y));
  return segments.length ? <svg className="analysis-trend" viewBox="0 0 160 32" aria-hidden="true">
    {segments.map((segment, index) => segment.length === 1 ? <circle key={index} cx={4 + segment[0].x / Math.max(1, rows.slice(-60).length - 1) * 152} cy={28 - chartPosition(segment[0].y, domain) * 24} r="2" /> : <polyline key={index} points={segment.map(point => `${4 + point.x / Math.max(1, rows.slice(-60).length - 1) * 152},${28 - chartPosition(point.y, domain) * 24}`).join(' ')} />)}
  </svg> : <p className="analysis-microcopy">No recorded trend</p>;
}
export default function AnalysisChart({ rows, field, title, xKey, xLabel = 'Recorded sample', caption }) {
  const id = useId(), segments = seriesSegments(rows, field, xKey), points = segments.flat();
  const yDomain = chartDomain(points.map(point => point.y));
  let xDomain = xKey ? chartDomain(points.map(point => point.x), false) : { min: 0, max: Math.max(1, rows.length - 1) };
  if (!xKey && rows.length === 1) xDomain = { min: -.5, max: .5 };
  const x = value => 70 + chartPosition(value, xDomain) * 506;
  const y = value => 166 - chartPosition(value, yDomain) * 140;
  const yTicks = [yDomain.min, yDomain.min / 2 + yDomain.max / 2, yDomain.max];
  const xTicks = xKey ? [xDomain.min, xDomain.min / 2 + xDomain.max / 2, xDomain.max] : [...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])];
  return <figure className={`analysis-figure series-${field}`} aria-labelledby={`${id}-heading`}>
    <h4 id={`${id}-heading`}>{title}</h4>
    {points.length ? <div className="analysis-chart-scroll" role="region" tabIndex={0} onKeyDown={event => { if (event.code === 'Space') event.stopPropagation(); }} aria-label={`${title}; scroll horizontally on narrow screens`}>
      <svg className="analysis-chart-svg" viewBox="0 0 600 220" role="img" aria-labelledby={`${id}-svgtitle ${id}-description`}>
        <title id={`${id}-svgtitle`}>{title}</title><desc id={`${id}-description`}>{points.length} finite values from {rows.length} original records. Missing values remain gaps. {xLabel} on the horizontal axis; independent proxy scale on the vertical axis.</desc>
        {yTicks.map((value, index) => <g key={index}><line className="chart-grid" x1="70" x2="576" y1={y(value)} y2={y(value)} /><text x="62" y={y(value) + 4} textAnchor="end">{formatMetric(value, 6)}</text></g>)}
        {yDomain.min <= 0 && yDomain.max >= 0 && <line className="chart-zero" x1="70" x2="576" y1={y(0)} y2={y(0)} />}
        {xTicks.filter(finite).filter(value => value >= 0 || xKey).map((value, index) => <text key={index} x={x(value)} y="188" textAnchor={index === 0 ? 'start' : index === xTicks.length - 1 ? 'end' : 'middle'}>{formatMetric(xKey ? value : value + 1, 4)}</text>)}
        <text x="323" y="211" textAnchor="middle">{xLabel}</text>
        {segments.map((segment, index) => segment.length === 1 ? <circle key={index} className="chart-point" cx={x(segment[0].x)} cy={y(segment[0].y)} r="3" /> : <polyline key={index} className="chart-series" points={segment.map(point => `${x(point.x)},${y(point.y)}`).join(' ')} />)}
      </svg>
    </div> : <div className="analysis-empty">No finite {field.toUpperCase()} samples to plot.</div>}
    <figcaption>{caption || 'Original sample order, without smoothing. Horizontal spacing is by sample, not physical simulation time.'}{points.length === 1 && ' One point is available; a trend needs at least two.'}</figcaption>
  </figure>;
}
