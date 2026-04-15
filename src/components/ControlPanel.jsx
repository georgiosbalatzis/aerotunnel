import { useRef, useState } from "react";
import F1Logo from "./F1Logo";
import {
  COLS, ROWS, MAX_PARTICLES,
  PRESET_GROUPS, genPreset,
  normPoly, parseSVG, parseDXF, parseSTL, traceImg,
  generateNACA4, nacaDesignation,
} from "../engine/index.js";

const PANEL_TABS = [
  { id: "shape", label: "Shape" },
  { id: "flow", label: "Flow" },
  { id: "transform", label: "Transform" },
  { id: "visual", label: "Visual" },
];

const IMPORT_TABS = [
  { id: "preset", label: "Presets" },
  { id: "naca", label: "NACA" },
  { id: "f1tuner", label: "F1 Tuner" },
  { id: "svg", label: "SVG" },
  { id: "stl", label: "STL" },
  { id: "dxf", label: "DXF" },
  { id: "draw", label: "Sketch" },
  { id: "image", label: "Image" },
];

/* 26.2 — Parametric F1 car generator */
function generateF1Tuned(frontAngle, rearAngle, bodyHeight, noseLength) {
  const fa = frontAngle / 30;    // 0–1 normalized
  const ra = rearAngle / 45;     // 0–1 normalized
  const bh = bodyHeight / 100;   // 0–1 normalized
  const nl = noseLength / 100;   // 0–1 normalized

  // Base F1 silhouette with parametric adjustments
  const noseEnd = 0.08 + nl * 0.12;  // nose tip x position
  const frontDip = 0.35 - fa * 0.15; // front wing dip (lower = more angle)
  const rearRise = 0.18 + ra * 0.18; // rear wing rise
  const bodyTop = 0.22 + (1 - bh) * 0.12;  // body top line
  const bodyBot = 0.62 + bh * 0.06;  // body bottom line

  return [
    [0, 0.58],
    [0.01, 0.55],
    [0.03, 0.49],
    [noseEnd * 0.6, 0.43 - fa * 0.03],
    [noseEnd, frontDip + 0.06],
    [noseEnd + 0.02, frontDip],
    [noseEnd + 0.05, frontDip + 0.04],
    [0.15, 0.35 - fa * 0.02],
    [0.20, bodyTop + 0.08],
    [0.25, bodyTop + 0.06],
    [0.30, bodyTop + 0.03],
    [0.34, bodyTop],
    [0.38, bodyTop + 0.02],
    [0.42, bodyTop + 0.01],
    [0.50, bodyTop],
    [0.58, bodyTop],
    [0.66, bodyTop + 0.01],
    [0.74, bodyTop + 0.04],
    [0.78, bodyTop + 0.06],
    [0.80, bodyTop + 0.04],
    [0.82, rearRise],
    [0.84, rearRise - 0.04],
    [0.86, rearRise - 0.02],
    [0.88, rearRise],
    [0.92, rearRise + 0.06],
    [0.96, 0.38 + ra * 0.02],
    [1, 0.46],
    [1, 0.50],
    [0.98, 0.54],
    [0.96, 0.58],
    [0.94, bodyBot - 0.02],
    [0.90, bodyBot],
    [0.86, bodyBot],
    [0.80, bodyBot],
    [0.70, bodyBot],
    [0.60, bodyBot],
    [0.50, bodyBot],
    [0.40, bodyBot],
    [0.30, bodyBot - 0.02],
    [0.24, bodyBot - 0.02],
    [0.18, bodyBot],
    [0.12, bodyBot + 0.01],
    [0.08, bodyBot + 0.01],
    [0.06, bodyBot - 0.02],
    [0.04, 0.61],
    [0.02, 0.59],
    [0, 0.58],
  ];
}

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
  mode,
  onExportSTL,
  onImportSession,
}) {
  const [activeTab, setActiveTab] = useState(section);
  const [importTab, setImportTab] = useState("preset");
  const [error, setError] = useState("");
  const drawRef = useRef(null);
  const drawingRef = useRef(false);
  const pointsRef = useRef([]);

  // 26.1 — NACA 4-digit parameters
  const [nacaCamber, setNacaCamber] = useState(2);
  const [nacaCamberPos, setNacaCamberPos] = useState(40);
  const [nacaThickness, setNacaThickness] = useState(12);

  // 26.2 — F1 tuner parameters
  const [f1FrontAngle, setF1FrontAngle] = useState(12);
  const [f1RearAngle, setF1RearAngle] = useState(25);
  const [f1BodyHeight, setF1BodyHeight] = useState(50);
  const [f1NoseLength, setF1NoseLength] = useState(50);
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
    // 29.1 — Detect JSON session import
    if (name.endsWith(".json")) {
      const reader = new FileReader();
      reader.onload = event => {
        try {
          const data = JSON.parse(event.target.result);
          if (data.app === "aerolab" && data.version) {
            onImportSession?.(data);
            return;
          }
        } catch (_) { /* not valid JSON */ }
        setError("Not a valid AeroLab session file");
      };
      reader.readAsText(file);
      return;
    }
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
          {/* 26.1 — NACA 4-digit airfoil generator */}
          {importTab === "naca" && (
            <div className="naca-editor">
              <div className="naca-designation">{nacaDesignation(nacaCamber, nacaCamberPos, nacaThickness)}</div>
              <div className="slider-stack">
                <Slider label="Max Camber (M)" value={nacaCamber} display={`${nacaCamber}%`}
                  min={0} max={9} step={1} onChange={v => { setNacaCamber(v); applyImportedPoly(generateNACA4(v, nacaCamberPos, nacaThickness)); }}
                  tone="var(--accent-flow)" hintMin="0%" hintMax="9%" />
                <Slider label="Camber Position (P)" value={nacaCamberPos} display={`${nacaCamberPos}%`}
                  min={10} max={90} step={10} onChange={v => { setNacaCamberPos(v); applyImportedPoly(generateNACA4(nacaCamber, v, nacaThickness)); }}
                  tone="var(--accent-flow)" hintMin="10%" hintMax="90%" />
                <Slider label="Thickness (T)" value={nacaThickness} display={`${nacaThickness}%`}
                  min={1} max={40} step={1} onChange={v => { setNacaThickness(v); applyImportedPoly(generateNACA4(nacaCamber, nacaCamberPos, v)); }}
                  tone="var(--f1-green)" hintMin="1%" hintMax="40%" />
              </div>
              <div className="naca-presets">
                <div className="preset-group-label">Common Profiles</div>
                <div className="preset-grid">
                  {[
                    { name: "NACA 0012", m: 0, p: 40, t: 12, desc: "Symmetric" },
                    { name: "NACA 2412", m: 2, p: 40, t: 12, desc: "General aviation" },
                    { name: "NACA 4412", m: 4, p: 40, t: 12, desc: "High lift" },
                    { name: "NACA 2324", m: 2, p: 30, t: 24, desc: "Thick section" },
                    { name: "NACA 6409", m: 6, p: 40, t: 9, desc: "High camber" },
                    { name: "NACA 0006", m: 0, p: 40, t: 6, desc: "Thin symmetric" },
                  ].map(n => (
                    <button key={n.name} className="preset-btn" onClick={() => {
                      setNacaCamber(n.m); setNacaCamberPos(n.p); setNacaThickness(n.t);
                      applyImportedPoly(generateNACA4(n.m, n.p, n.t));
                    }}>
                      <span className="preset-btn__name">{n.name}</span>
                      <small className="preset-btn__desc">{n.desc}</small>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* 26.2 — Parametric F1 tuner */}
          {importTab === "f1tuner" && (
            <div className="f1-tuner-editor">
              <div className="preset-group-label">F1 Aero Parameters</div>
              <div className="slider-stack">
                <Slider label="Front Wing Angle" value={f1FrontAngle} display={`${f1FrontAngle}°`}
                  min={0} max={30} step={1} onChange={v => { setF1FrontAngle(v); applyImportedPoly(generateF1Tuned(v, f1RearAngle, f1BodyHeight, f1NoseLength)); }}
                  tone="var(--accent-flow)" hintMin="0°" hintMax="30°" />
                <Slider label="Rear Wing Angle" value={f1RearAngle} display={`${f1RearAngle}°`}
                  min={5} max={45} step={1} onChange={v => { setF1RearAngle(v); applyImportedPoly(generateF1Tuned(f1FrontAngle, v, f1BodyHeight, f1NoseLength)); }}
                  tone="var(--accent-warn)" hintMin="5°" hintMax="45°" />
                <Slider label="Body Height" value={f1BodyHeight} display={`${f1BodyHeight}%`}
                  min={20} max={80} step={1} onChange={v => { setF1BodyHeight(v); applyImportedPoly(generateF1Tuned(f1FrontAngle, f1RearAngle, v, f1NoseLength)); }}
                  tone="var(--f1-green)" hintMin="20%" hintMax="80%" />
                <Slider label="Nose Length" value={f1NoseLength} display={`${f1NoseLength}%`}
                  min={20} max={80} step={1} onChange={v => { setF1NoseLength(v); applyImportedPoly(generateF1Tuned(f1FrontAngle, f1RearAngle, f1BodyHeight, v)); }}
                  tone="var(--f1-amber)" hintMin="20%" hintMax="80%" />
              </div>
              <div className="naca-presets">
                <div className="preset-group-label">Configurations</div>
                <div className="preset-grid">
                  {[
                    { name: "Low Drag", fa: 5, ra: 10, bh: 35, nl: 60, desc: "Monza spec" },
                    { name: "High Downforce", fa: 22, ra: 40, bh: 55, nl: 45, desc: "Monaco spec" },
                    { name: "Balanced", fa: 12, ra: 25, bh: 50, nl: 50, desc: "All-round" },
                    { name: "Rain Setup", fa: 18, ra: 35, bh: 60, nl: 40, desc: "Wet conditions" },
                  ].map(c => (
                    <button key={c.name} className="preset-btn" onClick={() => {
                      setF1FrontAngle(c.fa); setF1RearAngle(c.ra); setF1BodyHeight(c.bh); setF1NoseLength(c.nl);
                      applyImportedPoly(generateF1Tuned(c.fa, c.ra, c.bh, c.nl));
                    }}>
                      <span className="preset-btn__name">{c.name}</span>
                      <small className="preset-btn__desc">{c.desc}</small>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
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
          {importTab !== "preset" && importTab !== "draw" && importTab !== "naca" && importTab !== "f1tuner" && (
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
          {activeTab === "shape" && mode === "3d" && (
            <button className="btn-ghost btn-export-stl" onClick={onExportSTL}>Export STL</button>
          )}
          <F1Logo size={14} />
          <a href="https://f1stories.gr" target="_blank" rel="noopener noreferrer">f1stories.gr</a>
        </div>
      </div>
    </aside>
  );
}
