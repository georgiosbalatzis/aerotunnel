import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import View3D from "./components/View3D";
import AnalysisPanel from "./components/AnalysisPanel";
import AboutPanel from "./components/AboutPanel";
import CommandBar from "./components/CommandBar";
import ControlPanel from "./components/ControlPanel";
import IconRail from "./components/IconRail";
import "./cfdlab.css";

import {
  SIM_W, SIM_H, COLS, ROWS,
  DEFAULT_PARTICLES, TRAIL_LEN, IS_MOBILE,
  LBM, createPool, resizePool,
  xformPoly, simplPoly, genPreset,
  TURBO, COOLWARM,
} from "./engine/index.js";

/* ── Static config ── */
const MODES = [
  { id:"velocity",    label:"Velocity",    short:"VEL", color:"#00d4ff", tone:"var(--accent-flow)" },
  { id:"pressure",    label:"Pressure",    short:"PRS", color:"#ff6600", tone:"var(--accent-warn)" },
  { id:"streamlines", label:"Streamlines", short:"STR", color:"#22ff88", tone:"var(--accent-hi)" },
  { id:"vorticity",   label:"Vorticity",   short:"VRT", color:"#eeff22", tone:"var(--accent-mid)" },
  { id:"3d",          label:"3D View",     short:"3D",  color:"#00d4ff", tone:"var(--accent-flow)" },
];

const COLORBAR_TICKS = [0, 0.25, 0.5, 0.75, 1];
const CFD_JET_GRADIENT = "linear-gradient(to top,#001fff 0%,#00d4ff 32%,#22ff88 50%,#eeff22 68%,#ff6600 84%,#ff0022 100%)";
const FIELD_LEGENDS = {
  velocity: "VELOCITY\nm/s",
  pressure: "PRESSURE\nrho",
  streamlines: "VELOCITY\nm/s",
  vorticity: "VORTICITY\n1/s",
  "3d": "VELOCITY\nm/s",
};

function formatFieldValue(value) {
  if (!Number.isFinite(value)) return "0";
  const abs = Math.abs(value);
  if (abs >= 1000) return `${(value / 1000).toFixed(1)}k`;
  if (abs >= 10) return value.toFixed(1);
  if (abs >= 1) return value.toFixed(2);
  return value.toFixed(3);
}

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

/* ═══════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════ */
export default function CFDLab() {
  const solverRef  = useRef(null);
  const partsRef   = useRef(createPool());
  const canvasRef  = useRef(null);
  const wrapRef    = useRef(null);
  const miniRef    = useRef(null);
  const rafRef     = useRef(null);
  const frameRef   = useRef(0);
  const imgRef     = useRef(null);
  const buf32Ref   = useRef(null);
  const fieldRangeRef = useRef({ min: 0, max: 1 });

  /* ── State ── */
  const [view,      setView]      = useState("tunnel");
  const [running,   setRunning]   = useState(false);
  const [mode,      setMode]      = useState("velocity");
  const [preset,    setPreset]    = useState("f1car");
  const [poly,      setPoly]      = useState(() => genPreset("f1car"));
  const [prevPoly,  setPrevPoly]  = useState(null);
  const [simplify,  setSimplify]  = useState(0);
  const [stats,     setStats]     = useState({ cl: 0, cd: 0, re: 0, maxV: 0 });
  const [fieldRange, setFieldRange] = useState({ min: 0, max: 1 });
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
  const [histRef, pushHist] = useHistory(1000);
  const [histSnap,  setHistSnap]  = useState([]);
  const [autoRun,   setAutoRun]   = useState(true);
  const [panelOpen, setPanelOpen] = useState(!IS_MOBILE);
  const [activeSection, setActiveSection] = useState("shape");
  const panelOpenRef = useRef(panelOpen);
  const activeSectionRef = useRef(activeSection);

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
    if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
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
  }, [poly]);

  const closeControlPanel = useCallback(() => {
    panelOpenRef.current = false;
    setPanelOpen(false);
  }, []);

  const changeActiveSection = useCallback(section => {
    activeSectionRef.current = section;
    setActiveSection(section);
  }, []);

  const changeMode = useCallback(nextMode => {
    setMode(nextMode);
    if (nextMode === "3d") {
      closeControlPanel();
    }
  }, [closeControlPanel]);

  useEffect(() => {
    const h = e => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      switch (e.code) {
        case "Space": e.preventDefault(); setRunning(r => !r); break;
        case "KeyR": resetSolver(); break;
        case "Digit1": changeMode("velocity"); break;
        case "Digit2": changeMode("pressure"); break;
        case "Digit3": changeMode("streamlines"); break;
        case "Digit4": changeMode("vorticity"); break;
        case "Digit5": changeMode("3d"); break;
        case "KeyF": toggleFS(); break;
        case "KeyS": if (!e.ctrlKey && !e.metaKey) snap(); break;
        case "KeyZ": if (!e.ctrlKey && !e.metaKey) undoShape(); break;
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [resetSolver, changeMode, toggleFS, snap, undoShape]);

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
      let frameFieldMin = null, frameFieldMax = null;
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
        frameFieldMin = fMn; frameFieldMax = fMx;
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
        const cols = ["rgba(0,212,255,","rgba(34,255,136,","rgba(255,255,255,"];
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
        ctx.strokeStyle = "#00d4ff"; ctx.lineWidth = 2;
        ctx.shadowColor = "#00d4ff"; ctx.shadowBlur = 12;
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
        if (Number.isFinite(frameFieldMin) && Number.isFinite(frameFieldMax)) {
          const current = fieldRangeRef.current;
          const currentSpan = Math.max(Math.abs(current.max - current.min), 1e-6);
          const nextSpan = Math.max(Math.abs(frameFieldMax - frameFieldMin), 1e-6);
          const shifted = Math.abs(frameFieldMin - current.min) / currentSpan > 0.05
            || Math.abs(frameFieldMax - current.max) / currentSpan > 0.05
            || Math.abs(nextSpan - currentSpan) / currentSpan > 0.05;
          if (shifted) {
            const nextRange = { min: frameFieldMin, max: frameFieldMax };
            fieldRangeRef.current = nextRange;
            setFieldRange(nextRange);
          }
        }
      }

      const mc = miniRef.current;
      if (mc) mc.getContext("2d").drawImage(canvas, 0, 0, mc.width, mc.height);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [pushHist]);

  const regime = useMemo(() => {
    if (stats.re < 2300) return { label:"LAMINAR", col:"var(--f1-green)" };
    if (stats.re < 4000) return { label:"TRANS.", col:"var(--f1-amber)" };
    return { label:"TURB.", col:"var(--accent-crit)" };
  }, [stats.re]);
  const ldRatio = useMemo(() => stats.cd > 0 ? (stats.cl/stats.cd).toFixed(2) : "—", [stats.cl, stats.cd]);
  const is3D = mode === "3d";
  const fieldLegendTitle = FIELD_LEGENDS[mode] || FIELD_LEGENDS.velocity;
  const colorbarTicks = useMemo(() => {
    const min = Number.isFinite(fieldRange.min) ? fieldRange.min : 0;
    const max = Number.isFinite(fieldRange.max) ? fieldRange.max : 1;
    const span = max - min || 1;
    return COLORBAR_TICKS.map(position => ({
      position: `${position * 100}%`,
      value: formatFieldValue(max - span * position),
    }));
  }, [fieldRange]);

  useEffect(() => { const iv = setInterval(() => setHistSnap([...histRef.current]), 500); return () => clearInterval(iv); }, [histRef]);

  const metrics = [
    { label:"CL",   value:hasRun?stats.cl:"—",  tone:"var(--accent-hi)" },
    { label:"CD",   value:hasRun?stats.cd:"—",  tone:"var(--accent-warn)" },
    { label:"L/D",  value:hasRun?ldRatio:"—",   tone:"var(--accent-flow)" },
    { label:"FLOW", value:hasRun?regime.label:"—", tone:hasRun?regime.col:"var(--f1-dim)" },
  ];

  const openControlPanel = useCallback(section => {
    setView("tunnel");
    const nextOpen = !(panelOpenRef.current && activeSectionRef.current === section);
    panelOpenRef.current = nextOpen;
    activeSectionRef.current = section;
    setPanelOpen(nextOpen);
    setActiveSection(section);
  }, []);
  const changeRailView = useCallback(nextView => {
    setView(nextView);
    closeControlPanel();
  }, [closeControlPanel]);
  const toggleRunning = useCallback(() => setRunning(r => !r), []);

  return (
    <div className={`lab-shell ${is3D ? "is-3d-takeover" : ""}`} ref={wrapRef}>
      <div className="lab-shell__scanline" />

      {/* 14.1 — Floating title chip */}
      <CommandBar running={running} fps={fps} />

      {/* 14.2 — Floating icon rail toolbar */}
      <IconRail
        activeSection={activeSection}
        onSectionChange={openControlPanel}
        running={running}
        onRunToggle={toggleRunning}
        onReset={resetSolver}
        currentView={view}
        panelOpen={panelOpen}
        onViewChange={changeRailView}
      />

      {/* 14.3 — Floating control panel drawer */}
      {view==="tunnel" && (
        <ControlPanel
          key={activeSection}
          isOpen={panelOpen}
          section={activeSection}
          onSectionChange={changeActiveSection}
          onClose={closeControlPanel}
          preset={preset}
          onPresetSelect={(nextPreset, nextPoly) => { setPreset(nextPreset); applyPoly(nextPoly); }}
          onShapeImport={applyPoly}
          cx={cx} setCx={setCx} cy={cy} setCy={setCy}
          sx={sx} setSx={setSx} sy={sy} setSy={setSy}
          aoa={aoa} setAoa={setAoa} simplify={simplify} setSimplify={setSimplify}
          vel={vel} setVel={setVel} turb={turb} setTurb={setTurb}
          nu={nu} setNu={setNu} pCount={pCount} setPCount={setPCount}
          trailOp={trailOp} setTrailOp={setTrailOp} simSpd={simSpd} setSimSpd={setSimSpd}
          autoRun={autoRun} setAutoRun={setAutoRun}
        />
      )}

      {/* Mode pills — floating top-center */}
      {view==="tunnel" && (
        <div className="floating-mode-bar" aria-label="Visualization modes">
          {MODES.map((m,i) => (
            <button key={m.id} className={`floating-mode-pill ${mode===m.id?"is-active":""}`}
              aria-label={`Switch visualization mode to ${m.label}`}
              style={{"--tone":m.tone}} title={`${m.label} [${i+1}]`} onClick={() => changeMode(m.id)}>
              <span className="floating-mode-pill__label">{IS_MOBILE?m.short:m.label}</span>
              <sup className="floating-mode-pill__key">{i+1}</sup>
            </button>
          ))}
        </div>
      )}

      {view==="tunnel" && (
        <>
          <aside className="cfd-colorbar" aria-label={`${fieldLegendTitle} field legend`}>
            <div className="cfd-colorbar__scale">
              <div className="cfd-colorbar__bar" style={{background: CFD_JET_GRADIENT}} />
              <div className="cfd-colorbar__ticks">
                {colorbarTicks.map(tick => (
                  <span className="cfd-colorbar__tick" style={{"--tick": tick.position}} key={tick.position}>
                    <b>{tick.value}</b><i />
                  </span>
                ))}
              </div>
            </div>
            <div className="cfd-colorbar__title">{fieldLegendTitle}</div>
          </aside>

          <aside className="wind-indicator" aria-label={`Freestream angle of attack ${aoa.toFixed(1)} degrees`}>
            <svg className="wind-indicator__arrow" viewBox="0 0 48 16" aria-hidden style={{"--aoa": `${-aoa}deg`}}>
              <path d="M4 8h34" />
              <path d="m33 3 7 5-7 5" />
            </svg>
            <span>AoA: {aoa.toFixed(1)}&deg;</span>
          </aside>
        </>
      )}

      {/* Main canvas area — full viewport */}
      <main className={`lab-canvas-zone lab-canvas-zone--${view}`}>
        {view==="tunnel" && (
          <section className="canvas-area" aria-label="Simulation canvas area">
            <div className={`canvas-wrapper ${running ? "is-live" : ""}`} onPointerDown={closeControlPanel}>
              <canvas
                ref={canvasRef}
                width={SIM_W}
                height={SIM_H}
                className="stage-canvas"
                role="img"
                aria-label="CFD wind tunnel simulation."
                style={{display:is3D?"none":"block",position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"fill"}} />
              {is3D && <View3D poly={poly} solverRef={solverRef} cx={cx} cy={cy} sx={sx} sy={sy} aoa={aoa} mode={mode} />}
              <div className="canvas-hud">
                {!hasRun && !running && (
                  <div className="hud-waiting"><span>&#9654; PRESS RUN &middot; SPACE</span></div>
                )}
              </div>
            </div>
          </section>
        )}
        {view==="analysis" && <AnalysisPanel hSnap={histSnap} miniRef={miniRef} running={running} exportCSV={exportCSV} stats={stats} ldRatio={ldRatio} regime={regime} />}
        {view==="about" && <AboutPanel />}
      </main>

      {/* 14.4 — Floating metric pills */}
      {view==="tunnel" && (
        <div className={`floating-metrics ${!hasRun?"is-waiting":""}`}>
          {metrics.map(m => (
            <div key={m.label} className="floating-metric-pill" style={{"--tone":m.tone}}>
              <span className="floating-metric-pill__label">{m.label}</span>
              <span className="floating-metric-pill__value">{m.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
