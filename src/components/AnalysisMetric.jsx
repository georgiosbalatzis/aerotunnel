import { AnalysisTrend } from './AnalysisChart.jsx';

export default function AnalysisMetric({ label, value, note, rows, field }) {
  return <div className="report-metric">
    <dt>{label}</dt><dd>{value}</dd><p>{note}</p>
    <AnalysisTrend rows={rows} field={field} />
  </div>;
}
