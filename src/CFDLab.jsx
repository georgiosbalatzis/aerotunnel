import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ThemeToggle from "./components/ThemeToggle";
import F1Logo from "./components/F1Logo";
import View3D from "./components/View3D";
import AnalysisPanel from "./components/AnalysisPanel";
import AboutPanel from "./components/AboutPanel";
import "./cfdlab.css";

import {
  SIM_W, SIM_H, COLS, ROWS,
  DEFAULT_PARTICLES, MAX_PARTICLES, TRAIL_LEN, IS_MOBILE,
  LBM, createPool, resizePool,
  normPoly, xformPoly, simplPoly, genPreset, PRESET_GROUPS,
  parseSVG, parseDXF, parseSTL, traceImg,
  TURBO, COOLWARM,
} from "./engine/index.js";

/* ── Static config ── */
const MODES = [
  { id:"velocity",    label:"Velocity",    short:"VEL", color:"#00b4ff", tone:"var(--f1-blue)"  },
  { id:"pressure",    label:"Pressure",    short:"PRS", color:"#ff9500", tone:"var(--f1-amber)" },
  { id:"streamlines", label:"Streamlines", short:"STR", color:"#00d46a", tone:"var(--f1-green)" },
  { id:"vorticity",   label:"Vorticity",   short:"VRT", color:"#e8000d", tone:"var(--f1-red)"   },
  { id:"3d",          label:"3D View",     short:"3D",  color:"#ff9500", tone:"var(--f1-amber)" },
];

const IMPORT_TABS = [
  { id:"preset", label:"Presets" },
  { id:"svg",    label:"SVG" },
  { id:"stl",    label:"STL" },
  { id:"dxf",    label:"DXF" },
  { id:"draw",   label:"Sketch" },
  { id:"image",  label:"Image" },
];

const SHORTCUTS = [
  ["Space","Run / Pause"],["R","Reset solver"],["1-5","Switch view mode"],
  ["F","Fullscreen"],["S","Snapshot"],["Z","Undo shape"],["/","Keyboard help"],
];

/* ── Hooks ── */
function useHistory(maxLen = 1000) {
  const buf = useRef([]);
  const push = useCallback(entry => {
    buf.current.push({ ...entry, t: Date.now() });
    if (buf.current.length > maxLen) buf.current = buf.current.slice(-maxLen);
  }, [maxLen]);
  const clear = useCallback(() => { buf.current = []; }, []);
  return [buf, push, clear];
}

/* ── Sidebar section ── */
function SidebarSection({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`control-section ${open ? "is-open" : ""}`}>
      <button className="control-section__header" onClick={() => setOpen(o => !o)}>
        <span className="control-section__title">{title}</span>
        <span className="control-section__toggle">▶</span>
      </button>
      <div className="control-section__body">{children}</div>
    </div>
  );
}

/* ── Slider ── */
function Sl({ label, value, display, min, max, step, onChange, tone }) {
  const pct = ((value - min) / (max - min || 1)) * 100;
  return (
    <label className="slider-control" style={{ "--tone": tone, "--fill": `${pct}%` }}>
      <div className="slider-row">
        <span className="slider-label">{label}</span>
        <span className="slider-value">{display}</span>
      </div>
      <div className="slider-track">
        <input className="slider-input" type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(+e.target.value)} />
      </div>
    </label>
  );
}

/* ── Signal bar ── */
function SigRow({ label, note, value, tone }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className="signal-row" style={{ "--tone": tone, "--fill": `${Math.max(4, clamped * 100)}%` }}>
      <div className="signal-copy">
        <span className="signal-label">{label}</span>
        <span className="signal-note">{note}</span>
      </div>
      <div className="signal-track"><span className="signal-fill" /></div>
    </div>
  );
}

/* ═══════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════ */
export default function CFDLab() {
  const solverRef  = useRef(null);
  const partsRef   = useRef(createPool());
  const canvasRef  = useRef(null);
  const wrapRef    = useRef(null);
  const drawRef    = useRef(null);
  const miniRef    = useRef(null);
  const rafRef     = useRef(null);
  const frameRef   = useRef(0);
  const imgRef     = useRef(null);
  const buf32Ref   = useRef(null);
  const drawingRef = useRef(false);
  const dptsRef    = useRef([]);

  /* ── State ── */
  const [view,      setView]      = useState("tunnel");
  const [tab,       setTab]       = useState("preset");
  const [running,   setRunning]   = useState(false);
  const [mode,      setMode]      = useState("velocity");
  const [preset,    setPreset]    = useState("f1car");
  const [poly,      setPoly]      = useState(() => genPreset("f1car"));
  const [prevPoly,  setPrevPoly]  = useState(null);
  const [error,     setError]     = useState("");
  const [simplify,  setSimplify]  = useState(0);
  const [stats,     setStats]     = useState({ cl: 0, cd: 0, re: 0, maxV: 0 });
  const [hasRun,    setHasRun]    = useState(false);
  const [pCount,    setPCount]    = useState(DEFAULT_PARTICLES);
  const [trailOp,   setTrailOp]   = useState(1);
  const [simSpd,    setSimSpd]    = useState(1);
  const [fps,       setFps]       = useState(0);
  const [cx,        setCx]        = useState(COLS * 0.35);
  const [cy,        setCy]        = useState(ROWS / 2);
  const [sx,        setSx]        = useState(COLS * 0.25);
  const [sy,        setSy]        = useState(ROWS * 0.45);
  const [aoa,       setAoa]       = useState(0);
  const [vel,       setVel]       = useState(0.12);
  const [turb,      setTurb]      = useState(0.15);
  const [nu,        setNu]        = useState(0.015);
  const [histRef, pushHist, clearHist] = useHistory(1000);
  const [histSnap,  setHistSnap]  = useState([]);
  const [isFS,      setIsFS]      = useState(false);
  const [showKeys,  setShowKeys]  = useState(false);
  const [autoRun,   setAutoRun]   = useState(true);
  const [sessionName, setSessionName] = useState("FP1 AERO RUN");
  const [editingName, setEditingName] = useState(false);
  const [panelOpen, setPanelOpen] = useState(!IS_MOBILE);
  const [activeSection, setActiveSection] = useState("shape");
  const [metricsOpen, setMetricsOpen] = useState(!IS_MOBILE);

  /* ── Consolidated params ref ── */
  const P = useRef({
    running: false, mode: "velocity", vel: 0.12, turb: 0.15, nu: 0.015,
    pCount: DEFAULT_PARTICLES, trailOp: 1, simSpd: 1,
    cx: COLS*0.35, cy: ROWS/2, sx: COLS*0.25, sy: ROWS*0.45, aoa: 0,
    simplify: 0, poly: null, _outline: null,
  });

  useEffect(() => {
    const p = P.current;
    p.running = running; p.mode = mode; p.vel = vel; p.turb = turb; p.nu = nu;
    p.pCount = pCount; p.trailOp = trailOp; p.simSpd = simSpd;
    p.cx = cx; p.cy = cy; p.sx = sx; p.sy = sy; p.aoa = aoa;
    p.simplify = simplify; p.poly = poly;
    if (solverRef.current) solverRef.current.setNu(nu);
    resizePool(partsRef.current, pCount);
    if (poly) {
      const s = simplify > 0 ? simplPoly(poly, simplify * 0.005) : poly;
      p._outline = xformPoly(s, cx, cy, sx, sy, aoa);
    } else {
      p._outline = null;
    }
  }, [running, mode, vel, turb, nu, pCount, trailOp, simSpd, cx, cy, sx, sy, aoa, simplify, poly]);

  useEffect(() => {
    if (!solverRef.current) {
      const s = new LBM(COLS, ROWS); s.setNu(0.015); solverRef.current = s;
    }
  }, []);

  const rebuild = useCallback(() => {
    const p = P.current;
    if (!p.poly || !solverRef.current) return;
    const s = p.simplify > 0 ? simplPoly(p.poly, p.simplify * 0.005) : p.poly;
    solverRef.current.buildSolid(xformPoly(s, p.cx, p.cy, p.sx, p.sy, p.aoa));
  }, []);

  useEffect(() => { rebuild(); }, [cx, cy, sx, sy, aoa, simplify, poly, rebuild]);
  useEffect(() => {
    if (!poly || !autoRun) return;
    const frame = requestAnimationFrame(() => setRunning(true));
    return () => cancelAnimationFrame(frame);
  }, [poly, autoRun]);
  useEffect(() => {
    if (!running || hasRun) return;
    const frame = requestAnimationFrame(() => setHasRun(true));
    return () => cancelAnimationFrame(frame);
  }, [running, hasRun]);

  const resetSolver = useCallback(() => {
    const s = new LBM(COLS, ROWS); s.setNu(P.current.nu); solverRef.current = s; rebuild();
  }, [rebuild]);

  const toggleFS = useCallback(() => {
    const el = wrapRef.current; if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.().then(() => setIsFS(true)).catch(() => {});
    else { document.exitFullscreen?.(); setIsFS(false); }
  }, []);

  useEffect(() => {
    const h = () => setIsFS(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  const snap = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const a = document.createElement("a");
    a.download = `aerolab-${Date.now()}.png`; a.href = c.toDataURL("image/png"); a.click();
  }, []);

  const exportCSV = useCallback(() => {
    const d = histRef.current; if (!d.length) return;
    const header = "timestamp,cl,cd,re,maxV\n";
    const rows = d.map(r => `${new Date(r.t).toISOString()},${r.cl},${r.cd},${r.re},${r.maxV}`).join("\n");
    const b = new Blob([header + rows], { type: "text/csv" });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a"); a.href = u; a.download = `aerolab-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(u);
  }, [histRef]);

  const undoShape = useCallback(() => {
    if (prevPoly) { setPoly(prevPoly); setPrevPoly(null); }
  }, [prevPoly]);

  const applyPoly = useCallback((p) => {
    if (!p) return;
    setPrevPoly(poly);
    setPoly(p);
    setError("");
  }, [poly]);

  const resetAll = useCallback(() => {
    setRunning(false); setVel(0.12); setTurb(0.15); setNu(0.015);
    setCx(COLS*0.35); setCy(ROWS/2); setSx(COLS*0.25); setSy(ROWS*0.45);
    setAoa(0); setSimplify(0); setPCount(DEFAULT_PARTICLES); setTrailOp(1);
    setSimSpd(1); setPreset("f1car"); setTab("preset");
    setPoly(genPreset("f1car")); setPrevPoly(null);
    setStats({ cl:0, cd:0, re:0, maxV:0 }); setHasRun(false);
    clearHist(); setHistSnap([]);
    const s = new LBM(COLS, ROWS); s.setNu(0.015); solverRef.current = s;
  }, [clearHist]);

  useEffect(() => {
    const h = e => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      switch (e.code) {
        case "Space": e.preventDefault(); setRunning(r => !r); break;
        case "KeyR": resetSolver(); break;
        case "Digit1": setMode("velocity"); break;
        case "Digit2": setMode("pressure"); break;
        case "Digit3": setMode("streamlines"); break;
        case "Digit4": setMode("vorticity"); break;
        case "Digit5": setMode("3d"); break;
        case "KeyF": toggleFS(); break;
        case "KeyS": if (!e.ctrlKey && !e.metaKey) snap(); break;
        case "KeyZ": if (!e.ctrlKey && !e.metaKey) undoShape(); break;
        case "Slash": e.preventDefault(); setShowKeys(k => !k); break;
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [resetSolver, toggleFS, snap, undoShape]);

  const fpsF = useRef(0), fpsT = useRef(0);

  /* ── RENDER LOOP ── */
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const imgData = ctx.createImageData(SIM_W, SIM_H);
    imgRef.current = imgData;
    const buf32 = new Uint32Array(imgData.data.buffer);
    buf32Ref.current = buf32;
    const DX = SIM_W / COLS, DY = SIM_H / ROWS;
    fpsT.current = performance.now();

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const solver = solverRef.current; if (!solver) return;
      const p = P.current;
      const inV = p.vel;

      if (p.running) {
        for (let s = 0; s < p.simSpd; s++) solver.step(inV, p.turb);
      }

      frameRef.current++; fpsF.current++;
      const now = performance.now();
      if (now - fpsT.current >= 1000) { setFps(fpsF.current); fpsF.current = 0; fpsT.current = now; }

      const vm = p.mode;
      const solidC = (255<<24)|(44<<16)|(44<<8)|52;
      const bgC = (255<<24)|(3<<16)|(3<<8)|5;

      if (vm === "streamlines" || vm === "3d") {
        buf32.fill(bgC);
        for (let k = 0; k < solver.N; k++) {
          if (!solver.solid[k]) continue;
          const i = k % COLS, j = (k/COLS)|0;
          const x0 = (i*DX)|0, y0 = (j*DY)|0;
          const x1 = Math.min(((i+1)*DX)|0, SIM_W), y1 = Math.min(((j+1)*DY)|0, SIM_H);
          for (let py = y0; py < y1; py++)
            for (let px = x0; px < x1; px++) buf32[py*SIM_W+px] = solidC;
        }
      } else {
        const lut = vm === "pressure" ? COOLWARM : TURBO;
        const field = vm === "velocity" ? solver.spd : vm === "pressure" ? solver.rho : solver.curl;
        let fMn = 1e9, fMx = -1e9;
        for (let k = 0; k < solver.N; k++) {
          if (solver.solid[k]) continue;
          const v = field[k]; if (v < fMn) fMn = v; if (v > fMx) fMx = v;
        }
        const fR = fMx - fMn;
        if (fR < 1e-10) { buf32.fill(lut[128]); }
        else {
          const invR = 255/fR, invDX = COLS/SIM_W, invDY = ROWS/SIM_H;
          for (let py = 0; py < SIM_H; py++) {
            const j = Math.min(ROWS-1, (py*invDY)|0), ro = py*SIM_W;
            for (let px = 0; px < SIM_W; px++) {
              const i = Math.min(COLS-1, (px*invDX)|0), k = j*COLS+i;
              buf32[ro+px] = solver.solid[k] ? solidC : lut[Math.max(0, Math.min(255, ((field[k]-fMn)*invR)|0))];
            }
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);

      const parts = partsRef.current, pC = p.pCount, tO = p.trailOp;
      for (let pi = 0; pi < pC && pi < parts.length; pi++) parts[pi].update(solver);
      if ((vm==="streamlines"||vm==="velocity"||vm==="vorticity"||vm==="3d") && tO > 0) {
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        const isStr = vm==="streamlines" || vm==="3d";
        const alphas = isStr ? [.15,.4,.8] : [.07,.18,.32];
        const widths = isStr ? [.5,.8,1.2] : [.3,.5,.65];
        const cols = ["rgba(0,180,255,","rgba(0,212,106,","rgba(240,240,248,"];
        for (let band = 0; band < 3; band++) {
          const a = alphas[band]*tO;
          ctx.strokeStyle = cols[band]+a+")"; ctx.lineWidth = widths[band];
          ctx.beginPath();
          const sS = band===0?0:band===1?Math.floor(TRAIL_LEN*.33):Math.floor(TRAIL_LEN*.66);
          const sE = band===0?Math.floor(TRAIL_LEN*.33):band===1?Math.floor(TRAIL_LEN*.66):TRAIL_LEN;
          for (let pi = 0; pi < pC && pi < parts.length; pi++) {
            const pt = parts[pi]; if (!pt.active || pt.tl < 3) continue;
            const st = pt.ti-pt.tl;
            const from = st+Math.floor(sS*pt.tl/TRAIL_LEN);
            const to = st+Math.floor(sE*pt.tl/TRAIL_LEN);
            let started = false;
            for (let ti = from; ti < to && ti < pt.ti; ti++) {
              const idx = ((ti%TRAIL_LEN)+TRAIL_LEN)%TRAIL_LEN;
              if (!started) { ctx.moveTo(pt.tx[idx], pt.ty[idx]); started = true; }
              else ctx.lineTo(pt.tx[idx], pt.ty[idx]);
            }
          }
          ctx.stroke();
        }
      }

      const outline = p._outline;
      if (outline) {
        ctx.beginPath();
        outline.forEach(([gx, gy], i) => {
          const px = gx*DX, py = gy*DY;
          i===0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
        });
        ctx.closePath();
        ctx.strokeStyle = "#e8000d"; ctx.lineWidth = 2;
        ctx.shadowColor = "#e8000d"; ctx.shadowBlur = 12;
        ctx.stroke(); ctx.shadowBlur = 0;
      }

      if (p.running && frameRef.current % 15 === 0) {
        let mV=0, tFy=0, tFx=0, cnt=0;
        for (let k = 0; k < solver.N; k++) {
          if (solver.solid[k]) continue;
          const sp = solver.spd[k]; if (!isFinite(sp)) continue;
          cnt++; if (sp > mV) mV = sp;
          tFy += solver.uy[k]; tFx += Math.abs(solver.ux[k]-inV);
        }
        const re = (inV*p.sx)/(p.nu+1e-6)*10;
        const cl = cnt>0 ? Math.abs(tFy/cnt*2*(1+p.aoa*0.06)) : 0;
        const cd = cnt>0 ? tFx/cnt*0.5+0.008 : 0;
        const ns = { cl:+cl.toFixed(4), cd:+cd.toFixed(4), re:Math.round(re), maxV: inV>0?+(mV/inV).toFixed(3):0 };
        setStats(ns); pushHist(ns);
      }

      const mc = miniRef.current;
      if (mc) mc.getContext("2d").drawImage(canvas, 0, 0, mc.width, mc.height);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [pushHist]);

  /* ── File handling ── */
  const handleFile = useCallback((file) => {
    if (!file) return; setError("");
    const n = file.name.toLowerCase();
    const load = (readMode, parser) => {
      const r = new FileReader();
      r.onload = ev => { const p = parser(ev.target.result); if (!p) { setError(`Parse failed: ${n.split(".").pop().toUpperCase()}`); return; } applyPoly(p); };
      readMode === "text" ? r.readAsText(file) : r.readAsArrayBuffer(file);
    };
    if (n.endsWith(".svg")) load("text", parseSVG);
    else if (n.endsWith(".stl")) load("buf", parseSTL);
    else if (n.endsWith(".dxf")) load("text", parseDXF);
    else if (file.type?.startsWith("image/")) {
      const u = URL.createObjectURL(file); const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas"); const W = Math.min(img.width,200), H = Math.min(img.height,200);
        c.width = W; c.height = H; c.getContext("2d").drawImage(img,0,0,W,H);
        const p = traceImg(c.getContext("2d").getImageData(0,0,W,H), W, H);
        URL.revokeObjectURL(u); if (!p) { setError("Edge trace failed."); return; } applyPoly(p);
      };
      img.src = u;
    } else setError("Use SVG, STL, DXF, PNG, JPG");
  }, [applyPoly]);

  const hDrop = useCallback(e => { e.preventDefault(); handleFile(e.dataTransfer?.files?.[0]); }, [handleFile]);
  const hFile = useCallback(e => { handleFile(e.target.files[0]); e.target.value = ""; }, [handleFile]);

  const getDP = e => {
    const dc = drawRef.current, r = dc.getBoundingClientRect();
    const cx2 = e.touches?e.touches[0].clientX:e.clientX;
    const cy2 = e.touches?e.touches[0].clientY:e.clientY;
    return [(cx2-r.left)*(dc.width/r.width), (cy2-r.top)*(dc.height/r.height)];
  };
  const startDraw = e => { e.preventDefault(); drawingRef.current = true; drawRef.current.getContext("2d").clearRect(0,0,drawRef.current.width,drawRef.current.height); dptsRef.current = [getDP(e)]; };
  const moveDraw = e => {
    e.preventDefault(); if (!drawingRef.current) return;
    const [x,y] = getDP(e); dptsRef.current.push([x,y]);
    const c = drawRef.current.getContext("2d"); c.strokeStyle="#e8000d"; c.lineWidth=2; c.lineCap="round";
    const pts = dptsRef.current;
    if (pts.length > 1) { c.beginPath(); c.moveTo(pts[pts.length-2][0],pts[pts.length-2][1]); c.lineTo(x,y); c.stroke(); }
  };
  const endDraw = () => { drawingRef.current = false; const pts = dptsRef.current; if (pts.length < 5) return; const p = normPoly(pts); if (p) applyPoly(p); };

  const regime = useMemo(() => {
    if (stats.re < 2300) return { label:"LAMINAR", col:"var(--f1-green)" };
    if (stats.re < 4000) return { label:"TRANS.", col:"var(--f1-amber)" };
    return { label:"TURB.", col:"var(--f1-red)" };
  }, [stats.re]);
  const ldRatio = useMemo(() => stats.cd > 0 ? (stats.cl/stats.cd).toFixed(2) : "—", [stats.cl, stats.cd]);
  const currentMode = MODES.find(m => m.id === mode) || MODES[0];
  const currentPreset = PRESET_GROUPS.flatMap(g => g.items).find(i => i.id === preset);
  const is3D = mode === "3d";

  useEffect(() => { const iv = setInterval(() => setHistSnap([...histRef.current]), 500); return () => clearInterval(iv); }, [histRef]);

  const renderImport = () => {
    if (tab === "preset") return PRESET_GROUPS.map(g => (
      <div className="preset-group" key={g.label}>
        <div className="preset-group-label">{g.label}</div>
        <div className="preset-grid">
          {g.items.map(item => (
            <button key={item.id} className={`preset-btn ${preset===item.id?"is-active":""}`}
              onClick={() => { setPreset(item.id); applyPoly(genPreset(item.id)); }}>
              <span className="preset-btn__name">{item.label}</span>
              <small className="preset-btn__desc">{item.desc}</small>
            </button>
          ))}
        </div>
      </div>
    ));
    if (tab === "draw") return (
      <div>
        <canvas ref={drawRef} width={232} height={130} className="sketch-canvas"
          onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={moveDraw} onTouchEnd={endDraw} />
        <div className="sketch-hint">SKETCH CONTOUR → RELEASE TO BUILD</div>
      </div>
    );
    const accept = tab==="svg"?".svg":tab==="stl"?".stl":tab==="dxf"?".dxf":"image/*";
    return (
      <label className="dropzone">
        <span>{tab==="image"?"Load PNG / JPG":`Load ${tab.toUpperCase()} file`}</span>
        <small>Drag & drop or browse</small>
        <input type="file" accept={accept} hidden onChange={hFile} />
      </label>
    );
  };

  const metrics = [
    { label:"CL",   value:hasRun?stats.cl:"—",  note:"Lift",       tone:"var(--f1-green)" },
    { label:"CD",   value:hasRun?stats.cd:"—",  note:"Drag",       tone:"var(--f1-red)" },
    { label:"L/D",  value:hasRun?ldRatio:"—",   note:"Efficiency", tone:"var(--f1-blue)" },
    { label:"Re",   value:hasRun?(stats.re>999?`${(stats.re/1000).toFixed(1)}k`:stats.re):"—", note:"Reynolds", tone:"var(--f1-amber)" },
    { label:"U/U₀", value:hasRun?stats.maxV:"—", note:"Peak vel.",  tone:"var(--f1-blue)" },
    { label:"FLOW", value:hasRun?regime.label:"—", note:"Regime",   tone:hasRun?regime.col:"var(--f1-dim)" },
  ];

  const controlPanelContent = (
    <>
      <SidebarSection title="GARAGE — SELECT PACKAGE" defaultOpen={true}>
        <div className="import-tabs">
          {IMPORT_TABS.map(t => (
            <button key={t.id} className={`import-tab ${tab===t.id?"is-active":""}`}
              onClick={() => { setTab(t.id); setError(""); }}>{t.label}</button>
          ))}
        </div>
        <div onDrop={hDrop} onDragOver={e => e.preventDefault()}>{renderImport()}</div>
        {error && <div className="error-callout">{error}</div>}
      </SidebarSection>
      <SidebarSection title="SETUP SHEET — TRANSFORM" defaultOpen={true}>
        <div className="slider-stack">
          <Sl label="Position X" value={cx} display={cx.toFixed(0)} min={10} max={COLS-10} step={1} onChange={setCx} tone="var(--f1-blue)" />
          <Sl label="Position Y" value={cy} display={cy.toFixed(0)} min={4} max={ROWS-4} step={1} onChange={setCy} tone="var(--f1-blue)" />
          <Sl label="Scale X" value={sx} display={sx.toFixed(0)} min={10} max={COLS*.5} step={1} onChange={setSx} tone="var(--f1-green)" />
          <Sl label="Scale Y" value={sy} display={sy.toFixed(0)} min={5} max={ROWS*.7} step={1} onChange={setSy} tone="var(--f1-green)" />
          <Sl label="Angle of Attack" value={aoa} display={`${aoa}°`} min={-25} max={35} step={1} onChange={setAoa} tone="var(--f1-amber)" />
          <Sl label="Simplify" value={simplify} display={simplify} min={0} max={20} step={1} onChange={setSimplify} tone="var(--f1-dim)" />
        </div>
      </SidebarSection>
      <SidebarSection title="RACE CONTROL — FLOW" defaultOpen={true}>
        <div className="slider-stack">
          <Sl label="Inlet Velocity" value={vel} display={vel.toFixed(3)} min={.02} max={.18} step={.005} onChange={setVel} tone="var(--f1-blue)" />
          <Sl label="Turbulence" value={turb} display={turb.toFixed(1)} min={0} max={3} step={.1} onChange={setTurb} tone="var(--f1-amber)" />
          <Sl label="Viscosity ν" value={nu} display={nu.toFixed(3)} min={.005} max={.1} step={.001} onChange={setNu} tone="var(--f1-green)" />
        </div>
      </SidebarSection>
      <SidebarSection title="VISUALIZATION" defaultOpen={false}>
        <div className="slider-stack">
          <Sl label="Particles" value={pCount} display={pCount} min={0} max={MAX_PARTICLES} step={10} onChange={setPCount} tone="var(--f1-blue)" />
          <Sl label="Trail Opacity" value={trailOp} display={trailOp.toFixed(2)} min={0} max={1} step={.05} onChange={setTrailOp} tone="var(--f1-amber)" />
          <Sl label="Sim Speed" value={simSpd} display={`${simSpd}×`} min={1} max={8} step={1} onChange={setSimSpd} tone="var(--f1-red)" />
        </div>
        <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:4}}>
          <label className={`toggle-chip ${autoRun?"is-active":""}`}>
            <input type="checkbox" checked={autoRun} onChange={() => setAutoRun(a => !a)} />
            AUTO GREEN-FLAG
          </label>
        </div>
      </SidebarSection>
      <div style={{marginTop:"auto",padding:"12px 14px",borderTop:"1px solid var(--f1-border)",display:"flex",alignItems:"center",gap:8}}>
        <F1Logo size={14} />
        <a href="https://f1stories.gr" target="_blank" rel="noopener noreferrer"
          style={{fontFamily:"var(--font-mono)",fontSize:9,letterSpacing:"0.18em",color:"var(--f1-red)",textDecoration:"none",textTransform:"uppercase"}}>f1stories.gr</a>
      </div>
    </>
  );

  const controlSections = [
    { id:"shape", label:"Shape", icon:"⊙" },
    { id:"flow", label:"Flow", icon:"⚙" },
    { id:"visual", label:"Visual", icon:"◈" },
    { id:"transform", label:"Transform", icon:"↗" },
  ];
  const activeControlTitle = controlSections.find(s => s.id === activeSection)?.label || "Controls";
  const openControlPanel = section => {
    setActiveSection(section);
    setView("tunnel");
    setPanelOpen(true);
  };

  return (
    <div className="lab-shell" ref={wrapRef}>
      <div className="lab-shell__scanline" />

      <header className="command-bar">
        <div className="command-bar__left">
          <button
            className="command-menu-button"
            aria-label={panelOpen ? "Close control panel" : "Open control panel"}
            onClick={() => {
              setView("tunnel");
              setPanelOpen(open => !open);
            }}
          >
            {panelOpen ? "×" : "≡"}
          </button>
          <div className="brand-logo-mark"><F1Logo size={16} /></div>
          <div className="brand-text">
            <div className="brand-name">AeroLab</div>
            <div className="brand-sub">CFD Terminal</div>
          </div>
        </div>

        <div className="command-bar__center" aria-label="Session telemetry">
          <div className="command-chip">
            <span className="command-chip__key">Session</span>
            {editingName ? (
              <input className="session-name-input" autoFocus value={sessionName}
                onChange={e => setSessionName(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={e => { if (e.key==="Enter") setEditingName(false); }} />
            ) : (
              <button className="command-chip__value session-name-editable" onClick={() => setEditingName(true)} title="Click to rename">
                {sessionName}
              </button>
            )}
          </div>
          <div className="command-chip"><span className="command-chip__key">Pkg</span><span className="command-chip__value">{currentPreset?.label||"CUSTOM"}</span></div>
          <div className="command-chip"><span className="command-chip__key">AoA</span><span className="command-chip__value">{aoa}°</span></div>
          <div className="command-chip"><span className="command-chip__key">Re</span><span className="command-chip__value">{hasRun?(stats.re>999?`${(stats.re/1000).toFixed(1)}K`:stats.re||"—"):"—"}</span></div>
        </div>

        <div className="command-bar__right">
          <button className="command-icon-button" aria-label="Toggle live metrics column" onClick={() => setMetricsOpen(open => !open)}>◧</button>
          <div className={`status-pill ${running?"is-live":"is-hold"}`}>
            <span className={`status-dot ${running?"is-live":"is-red"}`} />
            {running?"GREEN FLAG":"SESSION HOLD"}
          </div>
          <span className="fps-readout">{fps}<span style={{opacity:.4,fontSize:9}}> FPS</span></span>
          <ThemeToggle />
        </div>
      </header>

      <div className="lab-body">
        <nav className="icon-rail" aria-label="AeroLab rail navigation">
          <div className="icon-rail__group">
            {controlSections.map(section => (
              <button
                key={section.id}
                className={`rail-btn ${view==="tunnel" && panelOpen && activeSection===section.id ? "is-active" : ""}`}
                aria-label={`Open ${section.label} controls`}
                data-tooltip={section.label}
                onClick={() => openControlPanel(section.id)}
              >
                <span>{section.icon}</span>
              </button>
            ))}
          </div>
          <div className="icon-rail__separator" />
          <div className="icon-rail__group">
            <button
              className={`rail-btn ${view==="analysis"?"is-active":""}`}
              aria-label="Open analysis view"
              data-tooltip="Analysis"
              onClick={() => { setView("analysis"); setPanelOpen(false); }}
            >
              <span>▦</span>
            </button>
            <button
              className={`rail-btn ${view==="about"?"is-active":""}`}
              aria-label="Open about view"
              data-tooltip="About"
              onClick={() => { setView("about"); setPanelOpen(false); }}
            >
              <span>i</span>
            </button>
          </div>
          <div className="icon-rail__actions">
            <button
              className={`rail-action rail-action--run ${running?"is-running":"is-paused"}`}
              aria-label={running ? "Hold simulation" : "Run simulation"}
              onClick={() => setRunning(r => !r)}
            >
              <span>{running ? "Ⅱ" : "▶"}</span>
            </button>
            <button className="rail-btn" aria-label="Reset solver" data-tooltip="Reset" onClick={resetSolver}>
              <span>↺</span>
            </button>
          </div>
        </nav>

        {view==="tunnel" && (
          <aside className={`control-panel ${panelOpen?"is-open":""}`} aria-hidden={!panelOpen}>
            <div className="control-panel__header">
              <span>{activeControlTitle}</span>
              <button aria-label="Close control panel" onClick={() => setPanelOpen(false)}>×</button>
            </div>
            <div className="control-panel__body">
              {controlPanelContent}
            </div>
          </aside>
        )}

        <main className={`lab-canvas-zone lab-canvas-zone--${view}`}>
          {view==="tunnel" && (
            <>
              <section className="canvas-area" aria-label="Simulation canvas area">
                <div className="canvas-toolbar">
                  <div className="canvas-mode-list" aria-label="Visualization modes">
                    {MODES.map((m,i) => (
                      <button key={m.id} className={`mode-chip ${mode===m.id?"is-active":""}`}
                        style={{"--tone":m.tone}} title={`${m.label} [${i+1}]`} onClick={() => setMode(m.id)}>
                        <span className="mode-chip__dot" style={{background:m.color}} />
                        {IS_MOBILE?m.short:m.label}
                      </button>
                    ))}
                  </div>
                  <div className="canvas-toolbar-actions">
                    <button className={`btn-primary ${running?"":"is-paused"}`} onClick={() => setRunning(r => !r)}>
                      {running?"⏸ HOLD":"▶ RUN"}
                    </button>
                    <button className="btn-ghost" onClick={resetSolver} title="Reset [R]">↺</button>
                    {!IS_MOBILE && <>
                      <button className="btn-ghost" onClick={snap} title="Snapshot [S]">📷</button>
                      <button className="btn-ghost" onClick={toggleFS} title="Fullscreen [F]">{isFS?"⊖":"⊕"}</button>
                      <button className="btn-ghost" onClick={exportCSV} disabled={!histSnap.length}>CSV ↓</button>
                      {prevPoly && <button className="btn-ghost" onClick={undoShape} title="Undo shape [Z]">↩ Undo</button>}
                      <button className="btn-ghost" onClick={resetAll}>RESET</button>
                      <button className="btn-ghost" onClick={() => setShowKeys(k => !k)} title="[/]">⌨</button>
                    </>}
                  </div>
                </div>

                {showKeys && !IS_MOBILE && (
                  <div className="shortcut-overlay">
                    <div className="shortcut-grid">
                      {SHORTCUTS.map(([k,d]) => (
                        <div className="shortcut-item" key={k}><kbd>{k}</kbd><span>{d}</span></div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="canvas-wrapper">
                  <canvas ref={canvasRef} width={SIM_W} height={SIM_H} className="stage-canvas"
                    style={{display:is3D?"none":"block",position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"fill"}} />
                  {is3D && <View3D poly={poly} solverRef={solverRef} cx={cx} cy={cy} sx={sx} sy={sy} aoa={aoa} />}
                  <div className="canvas-hud">
                    <div className="hud-corner hud-corner--tl" /><div className="hud-corner hud-corner--tr" />
                    <div className="hud-corner hud-corner--bl" /><div className="hud-corner hud-corner--br" />
                    <div className="hud-top-bar">
                      <div className="hud-label"><F1Logo size={10} /> AIR IN →</div>
                      <div className="hud-label" style={{color:currentMode.color}}>{currentMode.label.toUpperCase()} · LBM D2Q9 · {COLS}×{ROWS}</div>
                      <div className="hud-label">→ OUT</div>
                    </div>
                    <div className="hud-bottom-bar">
                      <div className="hud-label" style={{opacity:.4,fontSize:8}}>f1stories.gr</div>
                      <div className="colorbar">
                        <span className="colorbar__label">HI</span>
                        <div className="colorbar__bar" style={{background:mode==="pressure"?"linear-gradient(to bottom,#ff9500,#555,#00b4ff)":"linear-gradient(to bottom,#ff2200,#ffff00,#00ff88,#0088ff)"}} />
                        <span className="colorbar__label">LO</span>
                      </div>
                    </div>
                    {!hasRun && !running && (
                      <div className="hud-waiting"><span>▶ Press RUN or Space to start simulation</span></div>
                    )}
                  </div>
                </div>
              </section>

              {!IS_MOBILE && (
                <aside className={`live-metrics-col ${metricsOpen?"is-open":""}`}>
                  <div className="live-section">
                    <div className="live-section__title">ONBOARD</div>
                    <canvas ref={miniRef} width={200} height={110} className="mini-canvas" />
                    <div style={{marginTop:8}}>
                      {[
                        {label:"Inlet velocity",note:`${vel.toFixed(3)}`,value:vel/.18,tone:"var(--f1-blue)"},
                        {label:"Turbulence",note:`${turb.toFixed(1)}`,value:turb/3,tone:"var(--f1-amber)"},
                        {label:"Viscosity ν",note:`${nu.toFixed(3)}`,value:nu/.1,tone:"var(--f1-green)"},
                        {label:"Particles",note:`${pCount}/${MAX_PARTICLES}`,value:pCount/MAX_PARTICLES,tone:"var(--f1-red)"},
                      ].map(s => <SigRow key={s.label} {...s} />)}
                    </div>
                  </div>
                  <div className="live-section">
                    <div className="live-section__title">PACKAGE</div>
                    <div className="tele-highlight">
                      <div className="tele-highlight__key">Profile</div>
                      <div className="tele-highlight__val">{currentPreset?.label||"CUSTOM"}</div>
                      <div className="tele-highlight__note">{currentPreset?.desc||"Imported / sketched"}</div>
                    </div>
                    <div className="tele-highlight">
                      <div className="tele-highlight__key">Flow Regime</div>
                      <div className="tele-highlight__val" style={{color:hasRun?regime.col:"var(--f1-dim)"}}>{hasRun?regime.label:"—"}</div>
                      <div className="tele-highlight__note">Re = {hasRun?stats.re||"—":"—"}</div>
                    </div>
                  </div>
                  <div className="live-section">
                    <div className="live-section__title">ENGINEER NOTES</div>
                    {[
                      {title:"One variable at a time",body:"Isolate package from flow changes between runs for clean deltas."},
                      {title:"Pressure = loading",body:"Fastest read for suction zones, load peaks, stall pockets."},
                      {title:"Streamlines = dirty air",body:"Trail bundles show wake length, recirculation, reattachment."},
                    ].map(r => (
                      <div className="ref-item" key={r.title}><strong>{r.title}</strong><span>{r.body}</span></div>
                    ))}
                  </div>
                </aside>
              )}
            </>
          )}
          {view==="analysis" && <AnalysisPanel hSnap={histSnap} miniRef={miniRef} running={running} exportCSV={exportCSV} stats={stats} ldRatio={ldRatio} regime={regime} />}
          {view==="about" && <AboutPanel />}
        </main>
      </div>

      {view==="tunnel" && (
        <div className={`metrics-ribbon ${!hasRun?"is-waiting":""}`}>
          {metrics.map(m => (
            <div className="metric-card" style={{"--tone":m.tone}} key={m.label}>
              <div className="metric-label">{m.label}</div>
              <div className="metric-value">{m.value}</div>
              <div className="metric-note">{m.note}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
