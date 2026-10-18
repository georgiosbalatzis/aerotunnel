export default function ExportActions({ onCSV, onJSON, onLoad, onSTL, csvProblem, hasGeometry }) {
  return <div className="publishing-actions">
    <button type="button" onClick={onCSV} disabled={!!csvProblem} title={csvProblem || 'Download all retained records'}>Export Data (CSV)</button>
    <button type="button" onClick={onJSON}>Save Simulation Session (JSON)</button>
    <button type="button" onClick={onLoad}>Load Session</button>
    <button type="button" onClick={onSTL} disabled={!hasGeometry}>Export STL</button>
    {csvProblem && <p className="publishing-note">{csvProblem}</p>}
  </div>;
}
