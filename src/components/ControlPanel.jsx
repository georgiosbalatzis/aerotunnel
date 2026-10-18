import { useEffect, useId, useMemo, useRef, useState } from "react";
import F1Logo from "./F1Logo";
import NumericControl from "./NumericControl.jsx";
import { CONTROL_SECTIONS } from "./iconRailConfig.js";
import { geometryIssue, GEOMETRY_ERRORS, sessionIssue } from "../controls/validation.js";
import {
  COLS, ROWS, MAX_PARTICLES,
  PRESET_GROUPS, genPreset,
  normPoly, parseSVG, parseDXF, parseSTL, traceImg,
  generateNACA4, nacaDesignation,
} from "../engine/index.js";

const PANEL_TABS = CONTROL_SECTIONS;

const IMPORT_TABS = [
  { id: "preset", label: "Presets" },
  { id: "naca", label: "NACA" },
  { id: "f1tuner", label: "F1 Tuner" },
  { id: "svg", label: "SVG" },
  { id: "stl", label: "STL" },
  { id: "dxf", label: "DXF" },
  { id: "draw", label: "Sketch" },
  { id: "image", label: "Image" },
  { id: "session", label: "Session JSON" },
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

export default function ControlPanel({
  isOpen,
  section = "shape",
  onSectionChange,
  onClose,
  preset,
  poly,
  onResetGeometry,
  onOpenAnalysis,
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
  const activeTab = section;
  const panelId = useId();
  const [appliedEditor, setAppliedEditor] = useState(null);
  const [notice, setNotice] = useState("");
  const selectedPreset = useMemo(() => {
    if (!PRESET_GROUPS.some(group => group.items.some(item => item.id === preset))) return null;
    return JSON.stringify(poly) === JSON.stringify(genPreset(preset)) ? preset : null;
  }, [poly, preset]);
  const [importTab, setImportTab] = useState("preset");
  const [error, setError] = useState("");
  const importErrorRef = useRef(null);
  const reportError = message => {
    setError(message);
    if (message) requestAnimationFrame(() => importErrorRef.current?.scrollIntoView({ block: "nearest" }));
  };
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
    onSectionChange?.(id);
  };

  const applyImportedPoly = (nextPoly, kind = importTab) => {
    const issue = geometryIssue(nextPoly);
    if (issue) { reportError(GEOMETRY_ERRORS[issue]); return; }
    if (onShapeImport(nextPoly) === false) return;
    setAppliedEditor({ kind, poly: nextPoly });
    reportError("");
    setNotice("Profile updated. Transform and flow settings are retained.");
  };

  const handleFile = file => {
    if (!file) return;
    reportError(""); setNotice("");
    const name = file.name.toLowerCase();
    const readError = () => reportError(`Could not read ${file.name}. Choose the file again or export a new copy.`);
    if (name.endsWith(".json")) {
      const reader = new FileReader();
      reader.onerror = readError;
      reader.onload = event => {
        try {
          const data = JSON.parse(event.target.result);
          const issue = sessionIssue(data);
          if (issue) { reportError(issue); return; }
          if (onImportSession?.(data) !== false) setNotice(`Imported session: ${data.metadata?.name || file.name}`);
        } catch { reportError("This file is not valid JSON. Choose an exported AeroTunnel session."); }
      };
      reader.readAsText(file);
      return;
    }
    const load = (readMode, parser) => {
      const reader = new FileReader();
      reader.onerror = readError;
      reader.onload = event => {
        try {
          const nextPoly = parser(event.target.result);
          if (!nextPoly) { reportError(`No usable outline in ${file.name}. Export a closed 2D profile and try again.`); return; }
          applyImportedPoly(nextPoly, "import");
        } catch { reportError(`Could not parse ${file.name}. Check the format and export a finite 2D outline.`); }
      };
      readMode === "text" ? reader.readAsText(file) : reader.readAsArrayBuffer(file);
    };
    if (name.endsWith(".svg")) load("text", parseSVG);
    else if (name.endsWith(".stl")) load("buffer", parseSTL);
    else if (name.endsWith(".dxf")) load("text", parseDXF);
    else if (file.type?.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onerror = () => { URL.revokeObjectURL(url); reportError(`Could not decode ${file.name}. Choose a PNG or JPEG image.`); };
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const width = Math.min(img.width, 200), height = Math.min(img.height, 200);
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          const nextPoly = traceImg(ctx.getImageData(0, 0, width, height), width, height);
          if (!nextPoly) { reportError("No silhouette edges found. Use a dark, closed profile on a white background."); return; }
          applyImportedPoly(nextPoly, "import");
        } catch { reportError("The image could not be traced. Try a simple PNG or JPEG silhouette."); }
        finally { URL.revokeObjectURL(url); }
      };
      img.src = url;
    } else reportError("Choose SVG, ASCII/binary STL, DXF, an image, or an AeroTunnel JSON session.");
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
    event.currentTarget.setPointerCapture(event.pointerId);
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

  const endDraw = event => {
    drawingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (event.type === "pointercancel") return;
    const points = pointsRef.current;
    if (points.length < 5) { reportError("Draw a longer, closed contour with at least five points. The current geometry has been kept."); return; }
    const poly = normPoly(points);
    if (poly) applyImportedPoly(poly);
  };

  const renderShape = () => {
    const accept = importTab === "session" ? ".json" : importTab === "svg" ? ".svg" : importTab === "stl" ? ".stl" : importTab === "dxf" ? ".dxf" : "image/*";
    return (
      <>
        <div className="import-tabs" role="group" aria-label="Geometry source">
          {IMPORT_TABS.map(tab => (
            <button type="button" aria-pressed={importTab === tab.id} key={tab.id} className={`import-tab ${importTab === tab.id ? "is-active" : ""}`}
              onClick={() => { setImportTab(tab.id); reportError(""); }}>{tab.label}</button>
          ))}
        </div>
        <div>
          <div hidden={importTab !== "preset"}>{[...PRESET_GROUPS].reverse().map(group => (
            <div className="preset-group" key={group.label}>
              <div className="preset-group-label">{group.label}</div>
              <div className="preset-grid">
                {group.items.map(item => (
                  <button key={item.id} aria-pressed={selectedPreset === item.id} className={`preset-btn ${selectedPreset === item.id ? "is-active" : ""}`}
                    onClick={() => { onPresetSelect(item.id, genPreset(item.id)); reportError(""); setNotice(`Selected ${item.label}.`); }}>
                    <span className="preset-btn__name">{item.label}</span>
                    <small className="preset-btn__desc">{item.desc}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}</div>
          {/* 26.1 — NACA 4-digit airfoil generator */}
            <div className="naca-editor" hidden={importTab !== "naca"}>
              <div className="naca-designation">{nacaDesignation(nacaCamber, nacaCamberPos, nacaThickness)}</div>
              <div className="slider-stack">
                <NumericControl discrete label="Max Camber (M)" unit="%" value={nacaCamber}
                  min={0} max={9} step={1} onChange={v => { setNacaCamber(v); applyImportedPoly(generateNACA4(v, nacaCamberPos, nacaThickness)); }} />
                <NumericControl discrete label="Camber Position (P)" unit="%" value={nacaCamberPos}
                  min={10} max={90} step={10} onChange={v => { setNacaCamberPos(v); applyImportedPoly(generateNACA4(nacaCamber, v, nacaThickness)); }} />
                <NumericControl discrete label="Thickness (T)" unit="%" value={nacaThickness}
                  min={1} max={40} step={1} onChange={v => { setNacaThickness(v); applyImportedPoly(generateNACA4(nacaCamber, nacaCamberPos, v)); }} />
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
                    <button type="button" aria-pressed={appliedEditor?.poly === poly && appliedEditor?.kind === "naca" && nacaCamber === n.m && nacaCamberPos === n.p && nacaThickness === n.t} key={n.name} className="preset-btn" onClick={() => {
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
          {/* 26.2 — Parametric F1 tuner */}
            <div className="f1-tuner-editor" hidden={importTab !== "f1tuner"}>
              <div className="preset-group-label">F1 Aero Parameters</div>
              <div className="slider-stack">
                <NumericControl discrete label="Front Wing Angle" unit="°" value={f1FrontAngle}
                  min={0} max={30} step={1} onChange={v => { setF1FrontAngle(v); applyImportedPoly(generateF1Tuned(v, f1RearAngle, f1BodyHeight, f1NoseLength)); }} />
                <NumericControl discrete label="Rear Wing Angle" unit="°" value={f1RearAngle}
                  min={5} max={45} step={1} onChange={v => { setF1RearAngle(v); applyImportedPoly(generateF1Tuned(f1FrontAngle, v, f1BodyHeight, f1NoseLength)); }} />
                <NumericControl discrete label="Body Height" unit="%" value={f1BodyHeight}
                  min={20} max={80} step={1} onChange={v => { setF1BodyHeight(v); applyImportedPoly(generateF1Tuned(f1FrontAngle, f1RearAngle, v, f1NoseLength)); }} />
                <NumericControl discrete label="Nose Length" unit="%" value={f1NoseLength}
                  min={20} max={80} step={1} onChange={v => { setF1NoseLength(v); applyImportedPoly(generateF1Tuned(f1FrontAngle, f1RearAngle, f1BodyHeight, v)); }} />
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
                    <button type="button" aria-pressed={appliedEditor?.poly === poly && appliedEditor?.kind === "f1tuner" && f1FrontAngle === c.fa && f1RearAngle === c.ra && f1BodyHeight === c.bh && f1NoseLength === c.nl} key={c.name} className="preset-btn" onClick={() => {
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
            <div hidden={importTab !== "draw"}>
              <canvas
                ref={drawRef}
                width={232}
                height={130}
                className="sketch-canvas"
                role="img"
                aria-label="Sketch aerodynamic profile"
                onPointerDown={startDraw} onPointerMove={moveDraw}
                onPointerUp={endDraw} onPointerCancel={endDraw}
              />
              <p className="control-help">Draw a closed contour with a mouse, pen or touch. Release to apply.</p>
              <button type="button" className="control-secondary" onClick={() => { drawRef.current?.getContext("2d").clearRect(0, 0, 232, 130); pointsRef.current = []; }}>Clear sketch</button>
            </div>
          <div className="profile-import" hidden={["preset", "naca", "f1tuner", "draw"].includes(importTab)}>
            <label htmlFor={`${panelId}-file`}>Choose {importTab === "session" ? "a session JSON" : importTab === "image" ? "an image" : `a ${importTab.toUpperCase()}`} file</label>
            <input id={`${panelId}-file`} type="file" accept={accept} onChange={event => { handleFile(event.target.files[0]); event.target.value = ""; }} />
            <p className="control-help">Browse or drop a file anywhere in this panel. {importTab === "image" ? "Use a dark silhouette on white. PNG and JPEG are supported." : importTab === "session" ? "Previously exported JSON sessions retain their original data format." : importTab === "stl" ? "ASCII and binary STL are projected to a 2D profile." : "Use a closed 2D profile."}</p>
          </div>
        </div>
      </>
    );
  };

  const renderTransform = () => (
    <div className="slider-stack">
      <NumericControl label="Position X" unit="cells" value={cx} min={10} max={COLS - 10} step={1} onChange={setCx} />
      <NumericControl label="Position Y" unit="cells" value={cy} min={4} max={ROWS - 4} step={1} onChange={setCy} />
      <NumericControl label="Scale X" unit="cells" value={sx} min={10} max={COLS * .5} step={1} onChange={setSx} />
      <NumericControl label="Scale Y" unit="cells" value={sy} min={5} max={ROWS * .7} step={1} onChange={setSy} />
      <NumericControl label="Angle of attack" unit="°" value={aoa} min={-25} max={35} step={1} onChange={setAoa} />
      <NumericControl discrete label="Simplification" value={simplify} min={0} max={20} step={1} onChange={setSimplify} help="0 retains the original contour; higher levels reduce points." />
    </div>
  );

  // 24.3 — Drag-to-dismiss for mobile bottom sheet
  const dragRef = useRef(null);
  const dragStartY = useRef(null);

  const onDragStart = event => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartY.current = event.clientY;
  };
  const onDragMove = event => {
    if (dragStartY.current == null) return;
    const dy = event.clientY - dragStartY.current;
    const panel = dragRef.current;
    if (panel && dy > 0) {
      panel.style.transform = `translateY(${dy}px)`;
      panel.style.transition = "none";
    }
  };
  const onDragEnd = event => {
    if (dragStartY.current == null) return;
    const dy = event.clientY - dragStartY.current;
    dragStartY.current = null;
    const panel = dragRef.current;
    if (panel) {
      panel.style.transform = "";
      panel.style.transition = "";
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (event.type !== "pointercancel" && dy > 80) onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      dragStartY.current = null;
      if (dragRef.current) { dragRef.current.style.transform = ""; dragRef.current.style.transition = ""; }
      return;
    }
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    const frame = requestAnimationFrame(() => dragRef.current?.querySelector('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  const tabKeys = event => {
    const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]')];
    const index = tabs.indexOf(document.activeElement);
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault(); event.stopPropagation();
    selectTab(PANEL_TABS[next].id); tabs[next].focus();
  };

  return (
    <aside ref={dragRef} className={`control-panel professional-controls ${isOpen ? "is-open" : ""}`} aria-hidden={!isOpen} inert={!isOpen} aria-label="Simulation controls"
      onDrop={event => { if (!event.dataTransfer?.files?.length) return; event.preventDefault(); event.stopPropagation(); handleFile(event.dataTransfer.files[0]); }}
      onDragOver={event => event.preventDefault()}
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
      <div className="control-panel__drag-handle" onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd}>
        <div className="control-panel__drag-handle-pill" />
      </div>
      <div className="control-panel__header"><span>{title}</span><button type="button" aria-label="Close control panel" onClick={onClose}>&times;</button></div>
      <div className="control-panel__body">
        <div className="control-tabs" role="tablist" aria-label="Control tasks" onKeyDown={tabKeys}>
          {PANEL_TABS.map(tab => <button type="button" key={tab.id} role="tab" id={`${panelId}-${tab.id}-tab`}
            aria-selected={activeTab === tab.id} aria-controls={`${panelId}-${tab.id}-panel`} tabIndex={activeTab === tab.id ? 0 : -1}
            onFocus={event => event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" })}
            className={`control-tab ${activeTab === tab.id ? "is-active" : ""}`} onClick={() => selectTab(tab.id)}>{tab.label}</button>)}
        </div>
        <div className="control-panel__content">
          {error && <p ref={importErrorRef} className="control-error control-import-error" role="alert">{error}</p>}
          {notice && <p className="control-help" role="status">{notice}</p>}
          {PANEL_TABS.map(tab => (
            <div key={tab.id} role="tabpanel" id={`${panelId}-${tab.id}-panel`} aria-labelledby={`${panelId}-${tab.id}-tab`} hidden={activeTab !== tab.id}>
              {tab.id === "shape" && <>
                <p className="control-current-profile">{selectedPreset ? PRESET_GROUPS.flatMap(group => group.items).find(item => item.id === selectedPreset)?.label : "Custom profile"}</p>
                {renderShape()}
                <details className="control-disclosure"><summary>Transform geometry</summary>{renderTransform()}</details>
                <div className="control-reset-group"><button type="button" className="control-secondary" onClick={() => { onResetGeometry(); reportError(""); setNotice("Geometry reset to the F1 car and its default placement. Undo restores the previous geometry."); }}>Reset geometry</button>
                  <p className="control-help">Restores the F1 car and default position, scale and angle. Flow settings stay as set. This action is undoable.</p></div>
              </>}
              {tab.id === "flow" && <>
                <p className="control-help">Flow uses lattice units: one cell and one solver step. These values are not SI measurements.</p>
                <NumericControl label="Inlet velocity" unit="cells/step" value={vel} min={.02} max={.18} step={.005} onChange={setVel} />
                <NumericControl label="Viscosity" unit="cells²/step" value={nu} min={.005} max={.1} step={.001} onChange={setNu} />
                <NumericControl label="Turbulence factor" value={turb} min={0} max={3} step={.1} onChange={setTurb} help="Dimensionless inlet perturbation amplitude, not a turbulence model or percentage." />
              </>}
              {tab.id === "visual" && <>
                <p className="control-help">Choose a field above the viewport. Particle controls affect the Streamlines view.</p>
                <NumericControl discrete label="Particles" value={pCount} min={0} max={MAX_PARTICLES} step={10} onChange={setPCount} />
                <NumericControl label="Trail opacity" value={trailOp} min={0} max={1} step={.05} onChange={setTrailOp} help="0–1 opacity scale." />
              </>}
              {tab.id === "advanced" && <>
                <NumericControl discrete label="Simulation steps per frame" value={simSpd} min={1} max={8} step={1} onChange={setSimSpd} help="Solver steps per rendered frame; not a physical time multiplier." />
                <label className="control-checkbox"><input type="checkbox" checked={autoRun} onChange={() => setAutoRun(value => !value)} /><span>Run after geometry changes</span></label>
                <p className="control-help">Auto green-flag starts flow after changing a profile, once the workspace has been started.</p>
                <details className="control-disclosure"><summary>Reset and keyboard commands</summary><p className="control-help">Reset simulation (R) restarts flow with current geometry and settings. It keeps history and the run/pause state. Geometry reset and Undo/Redo affect profiles, not flow parameters.</p><dl className="control-shortcuts"><dt>Space</dt><dd>Run / pause</dd><dt>1–7</dt><dd>Visualization</dd><dt>R</dt><dd>Reset simulation</dd><dt>F / S</dt><dd>Fullscreen / screenshot</dd><dt>Z / Ctrl/Cmd+Z</dt><dd>Undo geometry</dd><dt>Ctrl/Cmd+Shift+Z</dt><dd>Redo geometry</dd></dl></details>
                <button type="button" className="control-secondary" onClick={onOpenAnalysis}>Analysis &amp; advanced tools</button><p className="control-help">Parameter sweeps, frame recording, saved sessions and exports.</p>
              </>}
            </div>
          ))}
        </div>
        <div className="control-panel__footer">
          <button type="button" className="control-secondary" onClick={onClose}>Done</button>
          {activeTab === "shape" && mode === "3d" && <button type="button" className="control-secondary" onClick={onExportSTL}>Export STL</button>}
          <a href="https://f1-stories.gr/" target="_blank" rel="noopener noreferrer"><F1Logo size={14} /> F1 STORIES</a>
        </div>
      </div>
    </aside>
  );
}
