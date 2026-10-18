export default function RecordedFrames({ recording, count, state, onStart, onStop }) {
  const captured = count > 0 && !['exported', 'packaging'].includes(state.status);
  return <div className="recorded-frames">
    <div className="publishing-actions">
      {recording ? <button type="button" onClick={onStop}>Stop recording &amp; export ({count})</button> : <button type="button" disabled={state.status === 'packaging'} onClick={onStart}>{captured ? 'Start new recording' : 'Record PNG frames'}</button>}
      {!recording && captured && <button type="button" onClick={onStop}>Export captured frames ({count})</button>}
    </div>
    <p className="publishing-note">Native 2D canvas only, up to 300 PNG frames in a ZIP; no 3D, title or legend. Starting a new recording replaces unexported frames. Stop packages completed PNGs; late encoding can be retried if initially empty.</p>
    <p className="publishing-note" role={state.status === 'error' ? 'alert' : 'status'}>{state.status === 'packaging' ? 'Packaging PNG frames…' : state.status === 'exported' ? `Export requested for ${state.frames} PNG frames.` : state.status === 'error' ? 'Frame export failed. Captured frames are retained; try again.' : state.status === 'empty' ? 'No completed PNG frames yet. Wait briefly, then retry Export captured frames.' : recording ? 'Recording the 2D canvas.' : captured ? `${count} capture requests retained for export.` : 'No pending frame export.'}</p>
  </div>;
}
