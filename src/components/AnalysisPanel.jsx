import { useEffect, useMemo, useRef } from "react";

const CHART_COLORS = {
  cl: "#00d46a",
  cd: "#e8000d",
  re: "#ff9500",
  ld: "#00b4ff",
};

function formatRe(value) {
  if (!Number.isFinite(value)) return "-";
  return value > 999 ? `${(value / 1000).toFixed(1)}k` : String(value);
}

function regimeDescription(label) {
  if (label === "LAMINAR") return "Attached flow. Wake energy is low and stable.";
  if (label === "TRANS.") return "Transition zone. Small setup changes can shift the wake.";
  if (label === "TURB.") return "Turbulent wake. Drag and separation need close review.";
  return "Run the tunnel to classify the current flow.";
}

function resizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width, height, ratio };
}

function drawKpiSparkline(canvas, values, color) {
  const ctx = canvas.getContext("2d");
  const { width, height, ratio } = resizeCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  if (values.length < 2) return;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3 * ratio;
  const step = (width - pad * 2) / Math.max(1, values.length - 1);
  const points = values.map((value, index) => [
    pad + index * step,
    height - pad - ((value - min) / span) * (height - pad * 2),
  ]);

  ctx.beginPath();
  points.forEach(([x, y], index) => {
    index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(points[points.length - 1][0], height - pad);
  ctx.lineTo(points[0][0], height - pad);
  ctx.closePath();
  ctx.fillStyle = `${color}22`;
  ctx.fill();

  ctx.beginPath();
  points.forEach(([x, y], index) => {
    index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = `${color}99`;
  ctx.lineWidth = Math.max(1, ratio);
  ctx.stroke();
}

function AnalysisKpiCard({ label, value, note, tone, color, values }) {
  const ref = useRef(null);
  const sparkValues = useMemo(() => values.filter(Number.isFinite).slice(-60), [values]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    drawKpiSparkline(canvas, sparkValues, color);
  }, [color, sparkValues]);

  return (
    <div className="analysis-kpi-card" style={{ "--tone": tone }}>
      <div className="analysis-kpi-card__label">{label}</div>
      <div className="analysis-kpi-card__value">{value}</div>
      <div className="analysis-kpi-card__note">{note}</div>
      <canvas ref={ref} className="analysis-kpi-card__sparkline" aria-hidden="true" />
    </div>
  );
}

function HistoryChart({ history }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    const { width, height, ratio } = resizeCanvas(canvas);
    let rafId = null;
    let cancelled = false;
    const started = performance.now();

    const drawGrid = (pad, plotWidth, plotHeight) => {
      ctx.strokeStyle = "rgba(255,255,255,0.07)";
      ctx.lineWidth = Math.max(1, ratio);
      for (let i = 0; i <= 4; i++) {
        const y = pad.top + (plotHeight * i) / 4;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(width - pad.right, y);
        ctx.stroke();
      }
      if (history.length > 1) {
        for (let index = 0; index < history.length; index += 20) {
          const x = pad.left + (index / (history.length - 1)) * plotWidth;
          ctx.beginPath();
          ctx.moveTo(x, pad.top);
          ctx.lineTo(x, height - pad.bottom);
          ctx.stroke();
        }
      }
    };

    const drawPlaceholder = () => {
      ctx.fillStyle = "rgba(128,128,160,0.65)";
      ctx.font = `${12 * ratio}px 'Share Tech Mono'`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("AWAITING TELEMETRY...", width / 2, height / 2);
      ctx.textAlign = "left";
    };

    const drawLine = (series, range, color, mapX, progress) => {
      if (series.length < 2) return;
      const maxIndex = Math.max(1, Math.floor((series.length - 1) * progress));
      const mapY = value => {
        const span = range.max - range.min || 1;
        return height - pad.bottom - ((value - range.min) / span) * plotHeight;
      };
      ctx.beginPath();
      for (let index = 0; index <= maxIndex; index++) {
        const x = mapX(index);
        const y = mapY(series[index]);
        index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, 2 * ratio);
      ctx.stroke();
    };

    const pad = { top: 34 * ratio, right: 48 * ratio, bottom: 30 * ratio, left: 48 * ratio };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const cl = history.map(sample => sample.cl).filter(Number.isFinite);
    const cd = history.map(sample => sample.cd).filter(Number.isFinite);
    const clRange = { min: Math.min(0, ...cl), max: Math.max(0.1, ...cl) };
    const cdRange = { min: Math.min(0, ...cd), max: Math.max(0.05, ...cd) };
    const mapX = index => pad.left + (index / Math.max(1, history.length - 1)) * plotWidth;

    const draw = () => {
      if (cancelled) return;
      const progress = Math.min(1, (performance.now() - started) / 600);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);
      drawGrid(pad, plotWidth, plotHeight);

      ctx.font = `${10 * ratio}px 'Share Tech Mono'`;
      ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(0,212,106,0.9)";
      ctx.fillText("CL", 12 * ratio, pad.top);
      ctx.fillStyle = "rgba(232,0,13,0.9)";
      ctx.fillText("CD", width - 34 * ratio, pad.top);
      ctx.fillStyle = "rgba(128,128,160,0.75)";
      ctx.fillText(clRange.max.toFixed(3), 12 * ratio, pad.top + 16 * ratio);
      ctx.fillText(cdRange.max.toFixed(3), width - 44 * ratio, pad.top + 16 * ratio);

      if (history.length < 5) {
        drawPlaceholder();
        return;
      }

      drawLine(history.map(sample => sample.cl), clRange, CHART_COLORS.cl, mapX, progress);
      drawLine(history.map(sample => sample.cd), cdRange, CHART_COLORS.cd, mapX, progress);

      if (progress < 1) rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [history]);

  return (
    <div className="history-chart-shell">
      <div className="history-chart-legend" aria-hidden="true">
        <span><i style={{ background: "var(--f1-green)" }} /> CL lift coefficient</span>
        <span><i style={{ background: "var(--f1-red)" }} /> CD drag coefficient</span>
      </div>
      <canvas ref={ref} className="history-chart" width={760} height={240} aria-label="CL and CD telemetry over time" />
    </div>
  );
}

export default function AnalysisPanel({ hSnap, exportCSV, stats, ldRatio, regime }) {
  const recentRows = hSnap.slice(-80).reverse();
  const sessionStart = hSnap[0]?.t ? new Date(hSnap[0].t).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }) : "pending";
  const history = useMemo(() => ({
    cl: hSnap.map(sample => sample.cl),
    cd: hSnap.map(sample => sample.cd),
    ld: hSnap.map(sample => sample.cd > 0 ? sample.cl / sample.cd : null),
    re: hSnap.map(sample => sample.re),
  }), [hSnap]);
  const kpis = [
    { label: "CL", value: stats.cl || "-", note: "Lift coefficient", tone: "var(--f1-green)", color: CHART_COLORS.cl, values: history.cl },
    { label: "CD", value: stats.cd || "-", note: "Drag coefficient", tone: "var(--f1-red)", color: CHART_COLORS.cd, values: history.cd },
    { label: "L/D", value: ldRatio, note: "Aero efficiency", tone: "var(--f1-blue)", color: CHART_COLORS.ld, values: history.ld },
    { label: "Re", value: formatRe(stats.re), note: "Reynolds number", tone: "var(--f1-amber)", color: CHART_COLORS.re, values: history.re },
  ];

  return (
    <div className="analysis-view">
      <div className="analysis-kpi-grid">
        {kpis.map(kpi => <AnalysisKpiCard key={kpi.label} {...kpi} />)}
      </div>

      <div className="analysis-main-grid">
        <section className="a-panel analysis-chart-panel">
          <div className="a-panel__header">
            <div>
              <div className="a-panel__title">CL/CD Over Time</div>
              <div className="a-panel__sub">Dual-axis aerodynamic telemetry trace</div>
            </div>
          </div>
          <HistoryChart history={hSnap} />
        </section>

        <aside className="a-panel analysis-history-panel">
          <div className="a-panel__header">
            <div>
              <div className="a-panel__title">History Table</div>
              <div className="a-panel__sub">Latest {recentRows.length} recorded samples</div>
            </div>
          </div>
          <div className="history-table">
            <div className="history-row is-head"><span>Time</span><span>CL</span><span>CD</span><span>Re</span></div>
            <div className="history-table__body">
              {recentRows.length ? recentRows.map(row => (
                <div className={`history-row ${row.cl > 0 ? "is-positive" : ""}`} key={row.t}>
                  <span>{new Date(row.t).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", second:"2-digit" })}</span>
                  <span>{row.cl}</span>
                  <span>{row.cd}</span>
                  <span>{row.re}</span>
                </div>
              )) : <div className="history-empty">No samples yet. Run the simulation.</div>}
            </div>
          </div>
        </aside>
      </div>

      <div className="analysis-bottom-row">
        <div className="analysis-session-meta">
          <button className="btn-primary" onClick={exportCSV} disabled={!hSnap.length}>Export CSV</button>
          <div>
            <span>Session started at {sessionStart}</span>
            <span>{hSnap.length} samples recorded</span>
          </div>
        </div>
        <div className="analysis-regime-card" style={{ "--tone": regime.col }}>
          <div className="analysis-regime-card__key">Flow Regime</div>
          <div className="analysis-regime-card__label">{regime.label}</div>
          <div className="analysis-regime-card__note">{regimeDescription(regime.label)}</div>
        </div>
      </div>
    </div>
  );
}
