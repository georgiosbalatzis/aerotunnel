import { useEffect, useMemo, useRef } from "react";

function formatDelta(value) {
  const abs = Math.abs(value);
  if (abs >= 10) return abs.toFixed(0);
  if (abs >= 1) return abs.toFixed(2);
  return abs.toFixed(3);
}

function withAlpha(color, alpha) {
  const match = color.match(/rgba?\(([^)]+)\)/);
  if (!match) return color;
  const [r, g, b] = match[1].split(",").slice(0, 3).map(part => part.trim());
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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

function drawSparkline(canvas, values) {
  const ctx = canvas.getContext("2d");
  const { width, height, ratio } = resizeCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  if (values.length < 2) return;

  const color = getComputedStyle(canvas).color || "rgb(232, 0, 13)";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 1.5 * ratio;
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
  ctx.fillStyle = withAlpha(color, 0.14);
  ctx.fill();

  ctx.beginPath();
  points.forEach(([x, y], index) => {
    index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = withAlpha(color, 0.4);
  ctx.lineWidth = Math.max(1, ratio);
  ctx.stroke();
}

export default function MetricCard({
  label,
  value,
  rawValue,
  note,
  tone,
  historyValues = [],
  deltaMode = "up",
  badge = false,
  pulse = false,
  running = false,
}) {
  const canvasRef = useRef(null);
  const valueText = value == null ? "" : String(value);
  const canAnimate = running && Number.isFinite(rawValue);
  const values = useMemo(
    () => historyValues.filter(Number.isFinite).slice(-60),
    [historyValues],
  );
  const delta = useMemo(() => {
    if (values.length < 2) return null;
    const next = values[values.length - 1];
    const prev = values[values.length - 2];
    const diff = next - prev;
    if (Math.abs(diff) <= 0.001) return null;
    return {
      direction: diff > 0 ? "up" : "down",
      improved: deltaMode === "down" ? diff < 0 : diff > 0,
      value: formatDelta(diff),
    };
  }, [deltaMode, values]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let idleId = null;
    let rafId = null;
    let observer = null;
    let observerIdleId = null;
    let cancelled = false;

    const scheduleDraw = () => {
      if (cancelled) return;
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(() => drawSparkline(canvas, values));
      } else {
        rafId = window.requestAnimationFrame(() => drawSparkline(canvas, values));
      }
    };

    const setupObserver = () => {
      if (cancelled || !("ResizeObserver" in window)) return;
      observer = new ResizeObserver(scheduleDraw);
      observer.observe(canvas);
    };

    scheduleDraw();
    if ("requestIdleCallback" in window) {
      observerIdleId = window.requestIdleCallback(setupObserver);
    } else {
      rafId = window.requestAnimationFrame(setupObserver);
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (idleId !== null) window.cancelIdleCallback?.(idleId);
      if (observerIdleId !== null) window.cancelIdleCallback?.(observerIdleId);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [tone, values]);

  return (
    <div className={`metric-card ${badge ? "metric-card--badge" : ""}`} style={{ "--tone": tone }}>
      <div className="metric-label">{label}</div>
      {badge ? (
        <div className={`metric-regime-badge ${pulse ? "is-pulsing" : ""}`}>{valueText}</div>
      ) : (
        <div className={`metric-value ${canAnimate ? "is-animated" : ""}`} aria-label={valueText}>
          {canAnimate
            ? valueText.split("").map((char, index) => (
              <span className="metric-char" aria-hidden="true" style={{ "--delay": `${index * 16}ms` }} key={`${valueText}-${index}-${char}`}>
                {char}
              </span>
            ))
            : valueText}
        </div>
      )}
      <div className="metric-note-row">
        <span className="metric-note">{note}</span>
        <span className={`metric-delta ${delta ? "is-visible" : ""} ${delta?.improved ? "is-improved" : "is-degraded"}`}>
          {delta && (
            <>
              <span aria-hidden="true">{delta.direction === "up" ? <>&#9650;</> : <>&#9660;</>}</span>
              {delta.value}
            </>
          )}
        </span>
      </div>
      <canvas ref={canvasRef} className="metric-sparkline" aria-hidden="true" />
    </div>
  );
}
