import { useRef, useState } from "react";
import F1Logo from "./F1Logo";
import {
  COLS, ROWS, MAX_PARTICLES,
  PRESET_GROUPS, genPreset,
  normPoly, parseSVG, parseDXF, parseSTL, traceImg,
} from "../engine/index.js";

const PANEL_TABS = [
  { id: "shape", label: "Shape" },
  { id: "flow", label: "Flow" },
  { id: "transform", label: "Transform" },
  { id: "visual", label: "Visual" },
];

const IMPORT_TABS = [
  { id: "preset", label: "Presets" },
  { id: "svg", label: "SVG" },
  { id: "stl", label: "STL" },
  { id: "dxf", label: "DXF" },
  { id: "draw", label: "Sketch" },
  { id: "image", label: "Image" },
];

function Slider({ label, value, display, min, max, step, onChange, tone, hintMin = min, hintMax = max, children }) {
  const pct = ((value - min) / (max - min || 1)) * 100;
  return (
    <label className="slider-control" style={{ "--tone": tone, "--fill": `${pct}%` }}>
      <div className="slider-row">
        <span className="slider-label">{label}</span>
        <span className="slider-value">{display}</span>
      </div>
      <div className="slider-track">
        <input className="slider-input" type="range" min={min} max={max} step={step} value={value}
          onChange={event => onChange(+event.target.value)} />
      </div>
      {children}
      <div className="slider-hints"><span>{hintMin}</span><span>{hintMax}</span></div>
    </label>
  );
}

export default function ControlPanel({
  isOpen,
  section = "shape",
  onSectionChange,
  onClose,
  preset,
  onPresetSelect,
  onShapeImport,
  cx,
  setCx,
  cy,
  setCy,
  sx,
  setSx,
  sy,
  setSy,
  aoa,
  setAoa,
  simplify,
  setSimplify,
  vel,
  setVel,
  turb,
  setTurb,
  nu,
  setNu,
  pCount,
  setPCount,
  trailOp,
  setTrailOp,
  simSpd,
  setSimSpd,
  autoRun,
  setAutoRun,
}) {
  const [activeTab, setActiveTab] = useState(section);
  const [importTab, setImportTab] = useState("preset");
  const [error, setError] = useState("");
  const drawRef = useRef(null);
  const drawingRef = useRef(false);
  const pointsRef = useRef([]);
  const title = PANEL_TABS.find(tab => tab.id === activeTab)?.label || "Controls";

  const selectTab = id => {
    setActiveTab(id);
    onSectionChange?.(id);
  };

  const applyImportedPoly = poly => {
    if (!poly) return;
    onShapeImport(poly);
    setError("");
  };

  const handleFile = file => {
    if (!file) return;
    setError("");
    const name = file.name.toLowerCase();
    const load = (readMode, parser) => {
      const reader = new FileReader();
      reader.onload = event => {
        const poly = parser(event.target.result);
        if (!poly) {
          setError(`Parse failed: ${name.split(".").pop().toUpperCase()}`);
          return;
        }
        applyImportedPoly(poly);
      };
      readMode === "text" ? reader.readAsText(file) : reader.readAsArrayBuffer(file);
    };
    if (name.endsWith(".svg")) load("text", parseSVG);
    else if (name.endsWith(".stl")) load("buffer", parseSTL);
    else if (name.endsWith(".dxf")) load("text", parseDXF);
    else if (file.type?.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const width = Math.min(img.width, 200), height = Math.min(img.height, 200);
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        const poly = traceImg(canvas.getContext("2d").getImageData(0, 0, width, height), width, height);
        URL.revokeObjectURL(url);
        if (!poly) {
          setError("Edge trace failed.");
          return;
        }
        applyImportedPoly(poly);
      };
      img.src = url;
    } else setError("Use SVG, STL, DXF, PNG, JPG");
  };

  const getDrawPoint = event => {
    const canvas = drawRef.current;
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    return [(clientX - rect.left) * (canvas.width / rect.width), (clientY - rect.top) * (canvas.height / rect.height)];
  };

  const startDraw = event => {
    event.preventDefault();
    const canvas = drawRef.current;
    if (!canvas) return;
    drawingRef.current = true;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    pointsRef.current = [getDrawPoint(event)];
  };

  const moveDraw = event => {
    event.preventDefault();
    if (!drawingRef.current || !drawRef.current) return;
    const [x, y] = getDrawPoint(event);
    pointsRef.current.push([x, y]);
    const ctx = drawRef.current.getContext("2d");
    const points = pointsRef.current;
    ctx.strokeStyle = "#00d4ff";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    if (points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(points[points.length - 2][0], points[points.length - 2][1]);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const endDraw = () => {
    drawingRef.current = false;
    const points = pointsRef.current;
    if (points.length < 5) return;
    const poly = normPoly(points);
    if (poly) applyImportedPoly(poly);
  };

  const renderShape = () => {
    const accept = importTab === "svg" ? ".svg" : importTab === "stl" ? ".stl" : importTab === "dxf" ? ".dxf" : "image/*";
    return (
      <>
        <div className="import-tabs">
          {IMPORT_TABS.map(tab => (
            <button key={tab.id} className={`import-tab ${importTab === tab.id ? "is-active" : ""}`}
              onClick={() => { setImportTab(tab.id); setError(""); }}>{tab.label}</button>
          ))}
        </div>
        <div onDrop={event => { event.preventDefault(); handleFile(event.dataTransfer?.files?.[0]); }} onDragOver={event => event.preventDefault()}>
          {importTab === "preset" && PRESET_GROUPS.map(group => (
            <div className="preset-group" key={group.label}>
              <div className="preset-group-label">{group.label}</div>
              <div className="preset-grid">
                {group.items.map(item => (
                  <button key={item.id} className={`preset-btn ${preset === item.id ? "is-active" : ""}`}
                    onClick={() => { onPresetSelect(item.id, genPreset(item.id)); setError(""); }}>
                    <span className="preset-btn__name">{item.label}</span>
                    <small className="preset-btn__desc">{item.desc}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {importTab === "draw" && (
            <div>
              <canvas
                ref={drawRef}
                width={232}
                height={130}
                className="sketch-canvas"
                role="img"
                aria-label="Sketch aerodynamic profile"
                onMouseDown={startDraw}
                onMouseMove={moveDraw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={moveDraw}
                onTouchEnd={endDraw}
              />
              <div className="sketch-hint">SKETCH CONTOUR &rarr; RELEASE TO BUILD</div>
            </div>
          )}
          {importTab !== "preset" && importTab !== "draw" && (
            <label className="dropzone">
              <span>{importTab === "image" ? "Load PNG / JPG" : `Load ${importTab.toUpperCase()} file`}</span>
              <small>Drag & drop or browse</small>
              <input type="file" accept={accept} hidden onChange={event => { handleFile(event.target.files[0]); event.target.value = ""; }} />
            </label>
          )}
        </div>
        {error && <div className="error-callout">{error}</div>}
      </>
    );
  };

  const renderActiveTab = () => {
    if (activeTab === "flow") return (
      <div className="slider-stack">
        <Slider label="Inlet Velocity" value={vel} display={vel.toFixed(3)} min={.02} max={.18} step={.005} onChange={setVel} tone="var(--f1-blue)" />
        <Slider label="Turbulence" value={turb} display={turb.toFixed(1)} min={0} max={3} step={.1} onChange={setTurb} tone="var(--f1-amber)" />
        <Slider label={<>Viscosity &nu;</>} value={nu} display={nu.toFixed(3)} min={.005} max={.1} step={.001} onChange={setNu} tone="var(--f1-green)" />
      </div>
    );
    if (activeTab === "transform") return (
      <div className="slider-stack">
        <Slider label="Position X" value={cx} display={cx.toFixed(0)} min={10} max={COLS - 10} step={1} onChange={setCx} tone="var(--f1-blue)" />
        <Slider label="Position Y" value={cy} display={cy.toFixed(0)} min={4} max={ROWS - 4} step={1} onChange={setCy} tone="var(--f1-blue)" />
        <Slider label="Scale X" value={sx} display={sx.toFixed(0)} min={10} max={COLS * .5} step={1} onChange={setSx} tone="var(--f1-green)" />
        <Slider label="Scale Y" value={sy} display={sy.toFixed(0)} min={5} max={ROWS * .7} step={1} onChange={setSy} tone="var(--f1-green)" />
        <Slider label="Angle of Attack" value={aoa} display={`${aoa}\u00b0`} min={-25} max={35} step={1} onChange={setAoa} tone="var(--f1-amber)" hintMin={"-25\u00b0"} hintMax={"35\u00b0"}>
          <div className="slider-ticks"><span>-15&deg;</span><span>0&deg;</span><span>+15&deg;</span></div>
        </Slider>
        <Slider label="Simplify" value={simplify} display={simplify} min={0} max={20} step={1} onChange={setSimplify} tone="var(--f1-dim)" />
      </div>
    );
    if (activeTab === "visual") return (
      <div className="slider-stack">
        <Slider label="Particles" value={pCount} display={pCount} min={0} max={MAX_PARTICLES} step={10} onChange={setPCount} tone="var(--f1-blue)" />
        <Slider label="Trail Opacity" value={trailOp} display={trailOp.toFixed(2)} min={0} max={1} step={.05} onChange={setTrailOp} tone="var(--f1-amber)" />
        <Slider label="Sim Speed" value={simSpd} display={`${simSpd}\u00d7`} min={1} max={8} step={1} onChange={setSimSpd} tone="var(--accent-flow)" />
        <label className={`toggle-chip ${autoRun ? "is-active" : ""}`}>
          <input type="checkbox" checked={autoRun} onChange={() => setAutoRun(value => !value)} />
          AUTO GREEN-FLAG
        </label>
      </div>
    );
    return renderShape();
  };

  // 24.3 — Drag-to-dismiss for mobile bottom sheet
  const dragRef = useRef(null);
  const dragStartY = useRef(null);

  const onDragStart = event => {
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    dragStartY.current = clientY;
  };
  const onDragMove = event => {
    if (dragStartY.current == null) return;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    const dy = clientY - dragStartY.current;
    const panel = dragRef.current;
    if (panel && dy > 0) {
      panel.style.transform = `translateY(${dy}px)`;
      panel.style.transition = "none";
    }
  };
  const onDragEnd = event => {
    if (dragStartY.current == null) return;
    const clientY = event.changedTouches ? event.changedTouches[0].clientY : event.clientY;
    const dy = clientY - dragStartY.current;
    dragStartY.current = null;
    const panel = dragRef.current;
    if (panel) {
      panel.style.transform = "";
      panel.style.transition = "";
    }
    if (dy > 80) onClose();
  };

  return (
    <aside ref={dragRef} className={`control-panel ${isOpen ? "is-open" : ""}`} aria-hidden={!isOpen}>
      {/* 24.3 — Drag handle for mobile bottom sheet */}
      <div className="control-panel__drag-handle"
        onTouchStart={onDragStart} onTouchMove={onDragMove} onTouchEnd={onDragEnd}
        onMouseDown={onDragStart} onMouseMove={onDragMove} onMouseUp={onDragEnd}>
        <div className="control-panel__drag-handle-pill" />
      </div>
      <div className="control-panel__header">
        <span>{title}</span>
        <button aria-label="Close control panel" onClick={onClose}>&times;</button>
      </div>
      <div className="control-panel__body">
        <div className="control-tabs" role="tablist" aria-label="Control panel tabs">
          {PANEL_TABS.map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`control-tab ${activeTab === tab.id ? "is-active" : ""}`}
              onClick={() => selectTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="control-panel__content">
          <div className="control-tab-panel" role="tabpanel" key={activeTab}>
            {renderActiveTab()}
          </div>
        </div>
        <div className="control-panel__footer">
          <F1Logo size={14} />
          <a href="https://f1stories.gr" target="_blank" rel="noopener noreferrer">f1stories.gr</a>
        </div>
      </div>
    </aside>
  );
}
