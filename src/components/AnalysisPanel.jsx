/* ═══════════════════════════════════════════════════════════
   AEROLAB · Analysis Panel
   Session trace, CL/CD history, lap samples
   f1stories.gr
   ═══════════════════════════════════════════════════════════ */

import { useEffect, useRef } from "react";
import { IS_MOBILE } from "../engine/constants.js";
import F1Logo from "./F1Logo.jsx";

function HistoryChart({ history }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || history.length < 2) return;
    const ctx = c.getContext("2d"), w = c.width, h = c.height, pad = 28;
    const iw = w - pad*2, ih = h - pad*2;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "var(--f1-black, #030305)";
    ctx.fillRect(0, 0, w, h);
    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad + (ih*i)/4;
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w-pad, y); ctx.stroke();
    }
    if (history.length < 2) {
      ctx.fillStyle = "rgba(144,144,168,0.4)";
      ctx.font = "500 14px 'Share Tech Mono'";
      ctx.fillText("Awaiting telemetry data...", pad+8, h/2);
      return;
    }
    const cl = history.map(s => s.cl), cd = history.map(s => s.cd);
    const mx = Math.max(...cl, ...cd, 0.1), mn = Math.min(0, ...cl, ...cd);
    const rng = mx - mn || 1;
    const mx2 = i => pad + (i/(history.length-1))*iw;
    const my2 = v => pad + ih - ((v-mn)/rng)*ih;
    const draw = (ser, col, fill) => {
      ctx.beginPath();
      ser.forEach((v, i) => { i === 0 ? ctx.moveTo(mx2(i), my2(v)) : ctx.lineTo(mx2(i), my2(v)); });
      ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke();
      ctx.lineTo(mx2(ser.length-1), my2(mn)); ctx.lineTo(mx2(0), my2(mn)); ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
    };
    draw(cl, "#00d46a", "rgba(0,212,106,0.1)");
    draw(cd, "#e8000d", "rgba(232,0,13,0.12)");
    // Labels
    ctx.fillStyle = "rgba(144,144,168,0.6)"; ctx.font = "10px 'Share Tech Mono'";
    ctx.fillText("CL", pad+4, pad+14);
    ctx.fillStyle = "rgba(232,0,13,0.7)";
    ctx.fillText("CD", pad+30, pad+14);
  }, [history]);
  return <canvas ref={ref} className="history-chart" width={720} height={280}/>;
}

export default function AnalysisPanel({ hSnap, miniRef, running, exportCSV, stats, ldRatio, regime }) {
  const recentRows = hSnap.slice(-8).reverse();
  return (
    <div className="analysis-view">
      <div className="analysis-grid">
        <div className="a-panel">
          <div className="a-panel__header">
            <div>
              <div className="a-panel__title">Session Trace</div>
              <div className="a-panel__sub">Lift & drag telemetry · live during run</div>
            </div>
            <button className="btn-ghost" onClick={exportCSV} disabled={!hSnap.length}>Export CSV ↓</button>
          </div>
          <div className="analysis-kpis">
            {[
              { key:"CL", val:stats.cl, note:"Lift coefficient", tone:"var(--f1-green)" },
              { key:"CD", val:stats.cd, note:"Drag coefficient", tone:"var(--f1-red)" },
              { key:"L/D", val:ldRatio, note:"Efficiency ratio", tone:"var(--f1-blue)" },
              { key:"Flow", val:regime.label, note:"Reynolds regime", tone:regime.col },
            ].map(m => (
              <div className="a-metric" style={{"--tone": m.tone}} key={m.key}>
                <div className="a-metric__key">{m.key}</div>
                <div className="a-metric__val">{m.val}</div>
                <div className="a-metric__note">{m.note}</div>
              </div>
            ))}
          </div>
          <HistoryChart history={hSnap}/>
          <div style={{display:"flex", gap:16, marginTop:10}}>
            <div style={{display:"flex", alignItems:"center", gap:6}}>
              <div style={{width:16, height:2, background:"var(--f1-green)"}}/>
              <span style={{fontFamily:"var(--font-mono)", fontSize:9, color:"var(--f1-dim)"}}>CL</span>
            </div>
            <div style={{display:"flex", alignItems:"center", gap:6}}>
              <div style={{width:16, height:2, background:"var(--f1-red)"}}/>
              <span style={{fontFamily:"var(--font-mono)", fontSize:9, color:"var(--f1-dim)"}}>CD</span>
            </div>
          </div>
        </div>

        <div style={{display:"grid", gap:16}}>
          <div className="a-panel">
            <div className="a-panel__header">
              <div>
                <div className="a-panel__title">Trackside Monitor</div>
                <div className="a-panel__sub">Live tunnel mirror</div>
              </div>
              <div className={`status-pill ${running?"is-live":"is-hold"}`}>
                <span className="status-dot" style={{background:running?"var(--f1-green)":"var(--f1-red)"}}/>
                {running ? "GREEN FLAG" : "SESSION HOLD"}
              </div>
            </div>
            <canvas ref={miniRef} width={420} height={200} className="mini-canvas"/>
          </div>
          <div className="a-panel">
            <div className="a-panel__header">
              <div>
                <div className="a-panel__title">Lap Samples</div>
                <div className="a-panel__sub">Latest {recentRows.length} rows</div>
              </div>
            </div>
            <div className="history-table">
              <div className="history-row is-head"><span>Time</span><span>CL</span><span>CD</span><span>Re</span></div>
              {recentRows.length ? recentRows.map(r => (
                <div className="history-row" key={r.t}>
                  <span>{new Date(r.t).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit", second:"2-digit"})}</span>
                  <span>{r.cl}</span><span>{r.cd}</span><span>{r.re}</span>
                </div>
              )) : <div className="history-empty">No samples yet. Run the simulation.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
