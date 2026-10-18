import { FIELD_STYLES, formatFieldValue, comparisonAvailable } from '../visualization/fields.js';

function ScalarLegend({ field, side }) {
  const spec = FIELD_STYLES[field.mode];
  const uniform = field.min === field.max;
  return <section className="field-scale" aria-label={`${side ? `${side}: ` : ''}${spec.title} field legend`} data-field={field.mode} data-min={field.min} data-max={field.max}>
    <div className="field-scale__heading"><strong>{side && `${side} · `}{spec.title}</strong><span>{spec.unit}</span></div>
    <div className="field-scale__bars">{spec.bars.map(bar => <div key={bar.label} className="field-scale__bar-row">
      {spec.bars.length > 1 && <span>{bar.label}</span>}
      <div className="field-scale__bar" style={{ background: uniform ? bar.gradient.match(/rgb\([^)]+\)/)?.[0] : bar.gradient }} title={bar.label} />
    </div>)}</div>
    <div className="field-scale__ticks" aria-label="Displayed scale limits">
      {(uniform ? [field.min] : [field.min, field.min + (field.max - field.min) / 2, field.max]).map((value, index) => <span key={index}>{formatFieldValue(value)}{uniform && ' (uniform)'}</span>)}
    </div>
    <p>{spec.note}{field.fallback && ' · fallback scale'}</p>
  </section>;
}
export default function FieldLegend({ mode, frame, comparison, difference }) {
  const comparing = comparison && comparisonAvailable(mode);
  return <div className={`plot-legend ${comparing ? 'is-comparison' : ''}`} aria-label="Scientific field interpretation">
    {mode === '3d' ? <div className="plot-legend__explanation"><strong>Qualitative 3D view</strong><p>Potential-flow paths and illustrative surface colors. Not a 3D LBM solution.</p></div>
      : mode === 'streamlines' ? <div className="plot-legend__explanation"><strong>Particle pathlines</strong><p><span className="pathline-key" aria-hidden="true"><i /><i /><i /></span> Trail bands show age, not speed. Particles follow the 2D LBM velocity field.</p></div>
        : frame.mode !== mode || frame.comparing !== comparing ? <p className="plot-legend__pending" role="status">Preparing field scale…</p>
          : <>{frame.fields.map((field, index) => <ScalarLegend key={`${index}-${field.mode}`} field={field} side={comparing ? index === 0 ? 'A' : 'B' : undefined} />)}
            {comparing && <p className="plot-legend__comparison-note">A/B use independent automatic ranges. {difference ? 'Red tint shows |normalized A − normalized B|, dimensionless; not a physical field difference.' : 'Matching colors do not imply matching physical values.'}</p>}</>}
    {comparison && !comparisonAvailable(mode) && <p className="plot-legend__comparison-note">Comparison waits for a 2D scalar view.</p>}
  </div>;
}
