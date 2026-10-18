import SiteMasthead from "./components/SiteMasthead.jsx";
import RaceDeskNav from "./components/RaceDeskNav.jsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FieldLegend from "./components/FieldLegend.jsx";
import VisualizationModes from "./components/VisualizationModes.jsx";
import { comparisonAvailable } from "./visualization/fields.js";
import View3D from "./components/View3D";
import AnalysisPanel from "./components/AnalysisPanel";
import PublishingDialog from "./components/PublishingDialog.jsx";
import ExportActions from "./components/ExportActions.jsx";
import { canvasBlob, composeFigure, downloadImage, freezeCanvas } from "./publishing/figure.js";
import AboutPanel from "./components/AboutPanel";
import CommandBar from "./components/CommandBar";
import ControlPanel from "./components/ControlPanel";
import IconRail from "./components/IconRail";
import "./cfdlab.css";
import "./styles/workspace.css";
import "./styles/controls.css";
import "./styles/visualization.css";
import "./styles/analysis.css";
import "./styles/publishing.css";
import { SETUP_FIELDS, csvIssue, sameSetup, proxyRatio, formatRatio } from "./analysis/presentation.js";
import { geometryIssue, GEOMETRY_ERRORS, sessionIssue } from "./controls/validation.js";

import {
  SIM_W, SIM_H, COLS, ROWS,
  DEFAULT_PARTICLES, TRAIL_LEN,
  LBM, createPool, resizePool,
  xformPoly, simplPoly, genPreset,
  TURBO, COOLWARM,
  initWasmSolver, createSolver,
  exportSessionJSON, parseSessionJSON, exportBinarySTL, buildZip,
} from "./engine/index.js";

/* ── 25.1 — Session persistence ── */
const SESSION_KEY = "aerolab-session";
const SESSIONS_KEY = "aerolab-sessions";
const SESSION_VERSION = 2;
const EMBED_MODE = new URLSearchParams(window.location.search).get("embed") === "1";

function saveSession(state) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ version: SESSION_VERSION, timestamp: Date.now(), ...state }));
  } catch { /* quota exceeded — silently skip */ }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== SESSION_VERSION) return null;
    return data;
  } catch { return null; }
}

function loadSavedSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSessions(sessions) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, 10)));
    return true;
  } catch { return false; }
}

/* ── Static config ── */
const MODES = [
  { id:"velocity",    label:"Velocity",    short:"VEL", color:"#00d4ff", tone:"var(--cfd-flow)" },
  { id:"pressure",    label:"Pressure",    short:"PRS", color:"#ff6600", tone:"var(--cfd-drag)" },
  { id:"streamlines", label:"Streamlines", short:"STR", color:"#22ff88", tone:"var(--cfd-lift)" },
  { id:"vorticity",   label:"Vorticity",   short:"VRT", color:"#eeff22", tone:"var(--cfd-reynolds)" },
  { id:"vectors",     label:"Vectors",     short:"VEC", color:"#ff44aa", tone:"var(--cfd-critical)" },
  { id:"schlieren",   label:"Schlieren",   short:"SCH", color:"#d4a050", tone:"var(--cfd-drag)" },
  { id:"3d",          label:"3D View",     short:"3D",  color:"#00d4ff", tone:"var(--cfd-flow)" },
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

/* ── 21.4 — Self-intersection check ── */
function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1x = bx - ax, d1y = by - ay, d2x = dx - cx, d2y = dy - cy;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-12) return false;
  const t = ((cx - ax) * d2y - (cy - ay) * d2x) / denom;
  const u = ((cx - ax) * d1y - (cy - ay) * d1x) / denom;
  return t > 0.01 && t < 0.99 && u > 0.01 && u < 0.99;
}

function checkSelfIntersection(poly) {
  const n = poly.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const ax = a[0] ?? a.x ?? 0, ay = a[1] ?? a.y ?? 0;
    const bx = b[0] ?? b.x ?? 0, by = b[1] ?? b.y ?? 0;
    for (let j = i + 2; j < n; j++) {
      if (j === (i + n - 1) % n) continue; // skip adjacent
      const c = poly[j], d = poly[(j + 1) % n];
      const cx = c[0] ?? c.x ?? 0, cy = c[1] ?? c.y ?? 0;
      const dx = d[0] ?? d.x ?? 0, dy = d[1] ?? d.y ?? 0;
      if (segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy)) return true;
    }
  }
  return false;
}

/* ═══════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════ */
export default function CFDLab() {
  const solverRef  = useRef(null);
  // Keep the live pool stable; telemetry renders must not allocate discarded trails.
  const [particlePool] = useState(createPool);
  const partsRef   = useRef(particlePool);
  const canvasRef  = useRef(null);
  const wrapRef    = useRef(null);
  const miniRef    = useRef(null);
  const captureRequestRef = useRef(null);
  const cancelCaptureRef = useRef(null);
  const imageBusyRef = useRef(false);
  const publicationWarningRef = useRef(null);
  const publishingRef = useRef(null);
  const sessionInputRef = useRef(null);
  const rafRef     = useRef(null);
  const frameRef   = useRef(0);
  const imgRef     = useRef(null);
  const buf32Ref   = useRef(null);
  const fieldRangeRef = useRef({ key: "", fields: [] });

  /* ── State ── */
  const [workspaceStarted, setWorkspaceStarted] = useState(false);
  const [introExpanded, setIntroExpanded] = useState(false);
  const [view,      setView]      = useState("tunnel");
  const [running,   setRunning]   = useState(false);
  const [mode,      setMode]      = useState("velocity");
  const [preset,    setPreset]    = useState("f1car");
  const [poly,      setPoly]      = useState(() => genPreset("f1car"));
  /* 30.2 — Undo/Redo stacks */
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const [simplify,  setSimplify]  = useState(0);
  const [stats,     setStats]     = useState({ cl: 0, cd: 0, re: 0, maxV: 0 });
  const [analysisSample, setAnalysisSample] = useState(null);
  const [legendFrame, setLegendFrame] = useState({ mode: null, fields: [] });
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
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 1024);
  const [activeSection, setActiveSection] = useState("shape");
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState("");
  const [solverWarning, setSolverWarning] = useState(null);
  const [convergenceDelta, setConvergenceDelta] = useState(1);
  const [sessionToast, setSessionToast] = useState(null);
  useEffect(() => { publicationWarningRef.current = solverWarning; }, [solverWarning]);
  const solverWarningTimer = useRef(null);
  const panelOpenRef = useRef(panelOpen);
  const activeSectionRef = useRef(activeSection);
  const sessionRestored = useRef(false);

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
    p.simplify = simplify; p.poly = poly; p.preset = preset;
    if (solverRef.current) solverRef.current.setNu(nu);
    resizePool(partsRef.current, pCount);
    if (poly) {
      const s = simplify > 0 ? simplPoly(poly, simplify * 0.005) : poly;
      p._outline = xformPoly(s, cx, cy, sx, sy, aoa);
    } else {
      p._outline = null;
    }
  }, [running, mode, vel, turb, nu, pCount, trailOp, simSpd, cx, cy, sx, sy, aoa, simplify, poly, preset]);

  useEffect(() => {
    let cancelled = false;
    initWasmSolver().then(ok => {
      if (cancelled) return;
      if (ok) {
        const s = createSolver(COLS, ROWS);
        s.setNu(P.current.nu);
        solverRef.current = s;
        // Rebuild solid geometry on the new WASM solver
        const p = P.current;
        if (p.poly) {
          const sh = p.simplify > 0 ? simplPoly(p.poly, p.simplify * 0.005) : p.poly;
          s.buildSolid(xformPoly(sh, p.cx, p.cy, p.sx, p.sy, p.aoa));
        }
        console.log("[AeroLab] Using WASM solver");
      }
    });
    // Immediate JS fallback so rendering starts without waiting for WASM
    if (!solverRef.current) {
      const s = new LBM(COLS, ROWS); s.setNu(0.015); solverRef.current = s;
    }
    return () => { cancelled = true; };
  }, []);

  // 25.1 — Restore session on mount
  useEffect(() => {
    if (EMBED_MODE || sessionRestored.current) return;
    sessionRestored.current = true;
    const saved = loadSession();
    if (!saved) return;
    if (saved.mode) setMode(saved.mode);
    if (saved.preset) setPreset(saved.preset);
    if (saved.poly) setPoly(saved.poly);
    if (saved.cx != null) setCx(saved.cx);
    if (saved.cy != null) setCy(saved.cy);
    if (saved.sx != null) setSx(saved.sx);
    if (saved.sy != null) setSy(saved.sy);
    if (saved.aoa != null) setAoa(saved.aoa);
    if (saved.vel != null) setVel(saved.vel);
    if (saved.turb != null) setTurb(saved.turb);
    if (saved.nu != null) setNu(saved.nu);
    if (saved.simplify != null) setSimplify(saved.simplify);
    if (saved.pCount != null) setPCount(saved.pCount);
    if (saved.trailOp != null) setTrailOp(saved.trailOp);
    if (saved.simSpd != null) setSimSpd(saved.simSpd);
    // Restore history
    if (saved.history?.length) {
      histRef.current = saved.history;
      setHistSnap([...saved.history]);
    }
    // Don't auto-run — let user review state
    setAutoRun(false);
    const timeStr = new Date(saved.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setSessionToast(`Session restored · ${timeStr}`);
    setTimeout(() => setSessionToast(null), 3000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 25.1 — Auto-save every 5 seconds; article embeds are ephemeral.
  useEffect(() => {
    if (EMBED_MODE) return;
    const id = setInterval(() => {
      saveSession({
        mode, preset, poly, cx, cy, sx, sy, aoa,
        vel, turb, nu, simplify,
        pCount, trailOp, simSpd,
        history: histRef.current.slice(-200),
      });
    }, 5000);
    return () => clearInterval(id);
  }, [mode, preset, poly, cx, cy, sx, sy, aoa, vel, turb, nu, simplify, pCount, trailOp, simSpd, histRef]);

  const rebuild = useCallback(() => {
    const p = P.current;
    if (!p.poly || !solverRef.current) return;
    const s = p.simplify > 0 ? simplPoly(p.poly, p.simplify * 0.005) : p.poly;
    solverRef.current.buildSolid(xformPoly(s, p.cx, p.cy, p.sx, p.sy, p.aoa));
  }, []);

  useEffect(() => { rebuild(); }, [cx, cy, sx, sy, aoa, simplify, poly, rebuild]);
  useEffect(() => {
    if (!poly || !autoRun || !workspaceStarted) return;
    const frame = requestAnimationFrame(() => setRunning(true));
    return () => cancelAnimationFrame(frame);
  }, [poly, autoRun, workspaceStarted]);
  useEffect(() => {
    if (!running || hasRun) return;
    const frame = requestAnimationFrame(() => setHasRun(true));
    return () => cancelAnimationFrame(frame);
  }, [running, hasRun]);

  const resetSolver = useCallback(() => {
    setAnalysisSample(null);
    const s = createSolver(COLS, ROWS); s.setNu(P.current.nu); solverRef.current = s; rebuild();
  }, [rebuild]);

  const toggleFS = useCallback(() => {
    const el = wrapRef.current; if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  }, []);

  const snap = useCallback(async (options = { format: "publication", theme: "light", legend: true, method: true }) => {
    if (imageBusyRef.current) return;
    if (view !== "tunnel") { setImageError("Open Simulation to capture the selected visualization."); setSessionToast("Image export failed: Open Simulation to capture the selected visualization."); return; }
    imageBusyRef.current = true; setImageBusy(true); setImageError("");
    try {
      const captured = await new Promise((resolve, reject) => {
        const cancel = () => { captureRequestRef.current = null; cancelCaptureRef.current = null; clearTimeout(timer); reject(new Error("The visualization is not ready. Wait for it to load and try again.")); };
        const timer = setTimeout(cancel, 8000);
        cancelCaptureRef.current = cancel;
        captureRequestRef.current = (source, frame) => {
          captureRequestRef.current = null; cancelCaptureRef.current = null; clearTimeout(timer);
          try {
            const p = P.current;
            resolve({ canvas: freezeCanvas(source), frame: { preset, aoa: p.aoa, vel: p.vel, nu: p.nu, running: p.running, at: Date.now(), warning: GEOMETRY_ERRORS[publicationWarningRef.current] || ({ diverged: "Solver diverged — reduce velocity or increase viscosity", overflow: "Velocity overflow — review solver settings", "geom-intersect": "Self-intersecting profile — results may be inaccurate" })[publicationWarningRef.current] || publicationWarningRef.current, ...frame } });
          } catch (error) { reject(error); }
        };
      });
      const canvas = options.format === "native" ? captured.canvas : await composeFigure(captured.canvas, captured.frame, options);
      downloadImage(await canvasBlob(canvas));
      setSessionToast("Image download requested.");
      setTimeout(() => setSessionToast(null), 3000);
    } catch (error) { const message = error.message || "Try again."; setImageError(message); setSessionToast(`Image export failed: ${message}`); }
    finally { imageBusyRef.current = false; setImageBusy(false); }
  }, [view, preset]);

  useEffect(() => () => cancelCaptureRef.current?.(), []);
  const openPublishing = () => {
    if (!publishingRef.current?.open) publishingRef.current?.showModal();
  };

  const exportCSV = useCallback(() => {
    const d = histRef.current;
    const issue = csvIssue(d);
    if (issue) { setSessionToast(issue); return; }
    const header = "timestamp,cl,cd,re,maxV\n";
    const rows = d.map(r => `${new Date(r.t).toISOString()},${r.cl},${r.cd},${r.re},${r.maxV}`).join("\n");
    const b = new Blob([header + rows], { type: "text/csv" });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a"); a.href = u; a.download = `aerotunnel-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(u);
  }, [histRef]);

  // 25.2 — Session gallery callbacks
  const saveCurrentSession = useCallback((name) => {
    const sessions = loadSavedSessions();
    const entry = {
      name: name || `${preset} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      timestamp: Date.now(),
      preset, mode, poly, cx, cy, sx, sy, aoa,
      vel, turb, nu, simplify,
      pCount, trailOp, simSpd,
      stats: { cl: stats.cl, cd: stats.cd, re: stats.re },
      history: histRef.current.slice(-200),
    };
    if (!Array.isArray(sessions)) return false;
    sessions.unshift(entry);
    if (!saveSessions(sessions)) return false;
    setSessionToast("Session saved");
    setTimeout(() => setSessionToast(null), 2000);
    return true;
  }, [preset, mode, poly, cx, cy, sx, sy, aoa, vel, turb, nu, simplify, pCount, trailOp, simSpd, stats, histRef]);

  const loadSavedSession = useCallback((session) => {
    setAnalysisSample(null);
    if (session.mode) setMode(session.mode);
    if (session.preset) setPreset(session.preset);
    if (session.poly) setPoly(session.poly);
    if (session.cx != null) setCx(session.cx);
    if (session.cy != null) setCy(session.cy);
    if (session.sx != null) setSx(session.sx);
    if (session.sy != null) setSy(session.sy);
    if (session.aoa != null) setAoa(session.aoa);
    if (session.vel != null) setVel(session.vel);
    if (session.turb != null) setTurb(session.turb);
    if (session.nu != null) setNu(session.nu);
    if (session.simplify != null) setSimplify(session.simplify);
    if (session.pCount != null) setPCount(session.pCount);
    if (session.trailOp != null) setTrailOp(session.trailOp);
    if (session.simSpd != null) setSimSpd(session.simSpd);
    if (session.history?.length) {
      histRef.current = session.history;
      setHistSnap([...session.history]);
    }
    setAutoRun(false);
    setSessionToast(`Loaded: ${session.name}`);
    setTimeout(() => setSessionToast(null), 2000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteSavedSession = useCallback((index) => {
    const sessions = loadSavedSessions();
    if (!Array.isArray(sessions)) return false;
    sessions.splice(index, 1);
    return saveSessions(sessions);
  }, []);

  /* ── 29.1 — JSON Session Export ── */
  const exportSession = useCallback(() => {
    exportSessionJSON({
      poly, preset, cx, cy, sx, sy, aoa, simplify,
      vel, turb, nu, mode, pCount, trailOp, simSpd,
      history: histRef.current.slice(-500),
      name: `${preset || "custom"} @ ${aoa}° AoA`,
    });
  }, [poly, preset, cx, cy, sx, sy, aoa, simplify, vel, turb, nu, mode, pCount, trailOp, simSpd, histRef]);

  /* ── 29.1 — JSON Session Import (drag & drop) ── */
  const importSession = useCallback((data) => {
    const issue = sessionIssue(data);
    if (issue) { setSessionToast(`Import failed: ${issue}`); return false; }
    if (data.history !== undefined && !Array.isArray(data.history)) { setSessionToast("Import failed: session history must be an array."); return false; }
    setAnalysisSample(null);
    if (data.geometry) {
      if (data.geometry.poly) setPoly(data.geometry.poly);
      if (data.geometry.preset) setPreset(data.geometry.preset);
      if (data.geometry.cx != null) setCx(data.geometry.cx);
      if (data.geometry.cy != null) setCy(data.geometry.cy);
      if (data.geometry.sx != null) setSx(data.geometry.sx);
      if (data.geometry.sy != null) setSy(data.geometry.sy);
      if (data.geometry.aoa != null) setAoa(data.geometry.aoa);
      if (data.geometry.simplify != null) setSimplify(data.geometry.simplify);
    }
    if (data.solver) {
      if (data.solver.vel != null) setVel(data.solver.vel);
      if (data.solver.turb != null) setTurb(data.solver.turb);
      if (data.solver.nu != null) setNu(data.solver.nu);
    }
    if (data.display) {
      if (data.display.mode) setMode(data.display.mode);
      if (data.display.pCount != null) setPCount(data.display.pCount);
      if (data.display.trailOp != null) setTrailOp(data.display.trailOp);
      if (data.display.simSpd != null) setSimSpd(data.display.simSpd);
    }
    if (data.history?.length) {
      histRef.current = data.history;
      setHistSnap([...data.history]);
    }
    setAutoRun(false);
    setSessionToast(`Imported: ${data.metadata?.name || "session"}`);
    setTimeout(() => setSessionToast(null), 3000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const readSessionFile = useCallback((file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      setSessionToast("Use Geometry to import SVG, STL, DXF or images. Drop a JSON session here.");
      return;
    }
    if (file.name.toLowerCase().endsWith(".json")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const data = parseSessionJSON(ev.target.result);
        if (data) importSession(data);
        else setSessionToast("Import failed: choose a valid AeroTunnel JSON session.");
      };
      reader.onerror = () => setSessionToast("Import failed: the session file could not be read. Choose it again.");
      reader.readAsText(file);
    }
  }, [importSession]);

  const handleAppDrop = useCallback(e => {
    e.preventDefault();
    if (!EMBED_MODE) readSessionFile(e.dataTransfer?.files?.[0]);
  }, [readSessionFile]);

  /* ── 29.2 — STL Export ── */
  const exportSTL = useCallback(() => {
    if (!poly) return;
    exportBinarySTL(poly, cx, cy, sx, sy, aoa, simplify);
  }, [poly, cx, cy, sx, sy, aoa, simplify]);

  /* ── 29.3 — Parametric Sweep ── */
  const [sweepState, setSweepState] = useState(null); // { param, min, max, steps, current, results }
  const [sweepReport, setSweepReport] = useState(null);
  const sweepRef = useRef(null);

  const startSweep = useCallback((param, min, max, steps) => {
    const state = { param, min, max, steps, current: 0, results: [] };
    setSweepReport(null);
    setSweepState(state);
    sweepRef.current = state;

    const solver = solverRef.current;
    if (!solver) return;
    const origAoa = aoa, origVel = vel, origNu = nu;
    const P_cur = P.current;

    const runStep = () => {
      const sw = sweepRef.current;
      if (!sw || sw.current >= sw.steps) {
        // Done — export CSV and restore original values
        if (sw && sw.results.length) {
          setSweepReport({ ...sw, results: sw.results.slice(), status: "complete" });
          const header = `${sw.param},cl,cd,ld_ratio,regime\n`;
          const rows = sw.results.map(r => `${r.value},${r.cl},${r.cd},${r.ld},${r.regime}`).join("\n");
          const blob = new Blob([header + rows], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = `aerotunnel-sweep-${sw.param}-${Date.now()}.csv`; a.click();
          URL.revokeObjectURL(url);
        }
        // Restore
        if (param === "aoa") setAoa(origAoa);
        else if (param === "velocity") setVel(origVel);
        else if (param === "viscosity") setNu(origNu);
        setSweepState(null);
        sweepRef.current = null;
        return;
      }

      const value = sw.min + (sw.max - sw.min) * (sw.current / Math.max(1, sw.steps - 1));

      // Apply parameter
      if (param === "aoa") {
        setAoa(value);
        const shape = P_cur.simplify > 0 ? simplPoly(P_cur.poly, P_cur.simplify * 0.005) : P_cur.poly;
        if (shape) solver.buildSolid(xformPoly(shape, P_cur.cx, P_cur.cy, P_cur.sx, P_cur.sy, value));
      } else if (param === "velocity") {
        setVel(value);
      } else if (param === "viscosity") {
        setNu(value);
        solver.setNu(value);
      }

      const inV = param === "velocity" ? value : P_cur.vel;

      // Run solver for up to 200 steps or until convergence
      for (let s = 0; s < 200; s++) {
        solver.step(inV, P_cur.turb);
        if (solver.convergenceDelta < 1e-4) break;
      }

      // Collect results
      let mV = 0, tFy = 0, tFx = 0, cnt = 0;
      for (let k = 0; k < solver.N; k++) {
        if (solver.solid[k]) continue;
        const sp = solver.spd[k]; if (!isFinite(sp)) continue;
        cnt++; if (sp > mV) mV = sp;
        tFy += solver.uy[k]; tFx += Math.abs(solver.ux[k] - inV);
      }
      const re = (inV * P_cur.sx) / (P_cur.nu + 1e-6) * 10;
      const curAoa = param === "aoa" ? value : P_cur.aoa;
      const cl = cnt > 0 ? +Math.abs(tFy / cnt * 2 * (1 + curAoa * 0.06)).toFixed(4) : 0;
      const cd = cnt > 0 ? +(tFx / cnt * 0.5 + 0.008).toFixed(4) : 0;
      const ld = cd > 0 ? +(cl / cd).toFixed(2) : 0;
      const regime = re < 2300 ? "laminar" : re < 4000 ? "transitional" : "turbulent";

      sw.results.push({ value: +value.toFixed(4), cl, cd, ld, regime });
      sw.current++;
      setSweepState({ ...sw });

      requestAnimationFrame(runStep);
    };

    requestAnimationFrame(runStep);
  }, [aoa, vel, nu]);

  const cancelSweep = useCallback(() => {
    const sw = sweepRef.current;
    if (sw) setSweepReport({ ...sw, results: sw.results.slice(), status: "cancelled" });
    sweepRef.current = null;
    setSweepState(null);
  }, []);

  /* ── 29.4 — PNG Sequence Recording ── */
  const [recording, setRecording] = useState(false);
  const [recordFrameCount, setRecordFrameCount] = useState(0);
  const [recordingExport, setRecordingExport] = useState({ status: "ready", frames: 0 });
  const recordingRef = useRef(false);
  const recordFrames = useRef([]);
  const recordCount = useRef(0);
  const MAX_RECORD_FRAMES = 300;

  /* ── 30.1 — Split-screen comparison mode ── */
  const [compareMode, setCompareMode] = useState(false);
  const [compareFieldA, setCompareFieldA] = useState("velocity");
  const [compareFieldB, setCompareFieldB] = useState("pressure");
  const [showDiff, setShowDiff] = useState(false);
  const compareDivider = useRef(0.5);
  const compareModeRef = useRef(false);
  const compareFieldsRef = useRef({ a: "velocity", b: "pressure", diff: false, div: 0.5 });

  const toggleCompare = useCallback(() => {
    setCompareMode(v => {
      const next = !v;
      compareModeRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    compareFieldsRef.current = { a: compareFieldA, b: compareFieldB, diff: showDiff, div: compareDivider.current };
  }, [compareFieldA, compareFieldB, showDiff]);

  const startRecording = useCallback(() => {
    setRecordingExport({ status: "ready", frames: 0 });
    recordFrames.current = [];
    recordCount.current = 0;
    setRecordFrameCount(0);
    recordingRef.current = true;
    setRecording(true);
  }, []);

  const stopRecording = useCallback(async () => {
    recordingRef.current = false;
    setRecording(false);
    const frames = recordFrames.current;
    if (!frames.length) { setRecordingExport({ status: "empty", frames: 0 }); return; }
    setRecordingExport({ status: "packaging", frames: frames.length });
    try {
      setSessionToast(`Packaging ${frames.length} frames...`);

      // Convert blobs to zip entries
      const files = [];
      for (let i = 0; i < frames.length; i++) {
        const data = new Uint8Array(await frames[i].arrayBuffer());
        files.push({ name: `aerotunnel-${String(i + 1).padStart(4, "0")}.png`, data });
      }
      const zip = buildZip(files);
      const url = URL.createObjectURL(zip);
      const a = document.createElement("a");
      a.href = url; a.download = `aerotunnel-frames-${Date.now()}.zip`; a.click();
      URL.revokeObjectURL(url);
      recordFrames.current = [];
      setRecordingExport({ status: "exported", frames: frames.length });
      setSessionToast(`Exported ${frames.length} frames`);
      setTimeout(() => setSessionToast(null), 3000);
    } catch { setRecordingExport({ status: "error", frames: frames.length }); }
  }, []);

  /* 30.2 — Undo / Redo */
  const undoShape = useCallback(() => {
    if (!undoStack.current.length) return;
    const prev = undoStack.current.pop();
    redoStack.current.push({ poly, preset, cx, cy, sx, sy, aoa, simplify });
    if (redoStack.current.length > 20) redoStack.current.shift();
    setPoly(prev.poly); setPreset(prev.preset);
    setCx(prev.cx); setCy(prev.cy); setSx(prev.sx); setSy(prev.sy);
    setAoa(prev.aoa); setSimplify(prev.simplify);
  }, [poly, preset, cx, cy, sx, sy, aoa, simplify]);

  const redoShape = useCallback(() => {
    if (!redoStack.current.length) return;
    const next = redoStack.current.pop();
    undoStack.current.push({ poly, preset, cx, cy, sx, sy, aoa, simplify });
    if (undoStack.current.length > 20) undoStack.current.shift();
    setPoly(next.poly); setPreset(next.preset);
    setCx(next.cx); setCy(next.cy); setSx(next.sx); setSy(next.sy);
    setAoa(next.aoa); setSimplify(next.simplify);
  }, [poly, preset, cx, cy, sx, sy, aoa, simplify]);

  const applyPoly = useCallback((p) => {
    const issue = geometryIssue(p);
    if (issue) {
      setSolverWarning(issue);
      if (solverWarningTimer.current) clearTimeout(solverWarningTimer.current);
      solverWarningTimer.current = setTimeout(() => { setSolverWarning(null); solverWarningTimer.current = null; }, 4000);
      return false;
    }
    setSolverWarning(current => current?.startsWith("geom-") ? null : current);
    // Self-intersection check (O(n²) edge pairs)
    const selfIntersects = checkSelfIntersection(p);
    if (selfIntersects) {
      setSolverWarning("geom-intersect");
      if (solverWarningTimer.current) clearTimeout(solverWarningTimer.current);
      solverWarningTimer.current = setTimeout(() => { setSolverWarning(null); solverWarningTimer.current = null; }, 5000);
      // Warn but don't block — still apply the geometry
    }
    // 30.2 — Push to undo stack
    undoStack.current.push({ poly, preset, cx, cy, sx, sy, aoa, simplify });
    if (undoStack.current.length > 20) undoStack.current.shift();
    redoStack.current = [];
    setPoly(p);
    return true;
  }, [poly, preset, cx, cy, sx, sy, aoa, simplify]);

  const resetGeometry = useCallback(() => {
    if (!applyPoly(genPreset("f1car"))) return;
    setPreset("f1car");
    setCx(COLS * .35); setCy(ROWS / 2); setSx(COLS * .25); setSy(ROWS * .45);
    setAoa(0); setSimplify(0);
  }, [applyPoly]);

  const closeControlPanel = useCallback(() => {
    if (document.querySelector('.control-panel')?.contains(document.activeElement)) {
      document.querySelector(`[data-control-section="${activeSectionRef.current}"]`)?.focus();
    }
    panelOpenRef.current = false;
    setPanelOpen(false);
  }, []);

  const changeActiveSection = useCallback(section => {
    activeSectionRef.current = section;
    setActiveSection(section);
  }, []);

  const changeMode = useCallback(nextMode => {
    setMode(nextMode);
    if (nextMode === "3d") closeControlPanel();
  }, [closeControlPanel]);

  useEffect(() => {
    const h = e => {
      if (EMBED_MODE && !["Space", "KeyF"].includes(e.code)) return;
      if (publishingRef.current?.open || e.defaultPrevented || e.target.closest?.("a, button, input, select, textarea, summary, dialog, [role=dialog], [contenteditable]:not([contenteditable='false'])")) return;
      switch (e.code) {
        case "Space": e.preventDefault(); setWorkspaceStarted(true); setIntroExpanded(false); setRunning(r => !r); break;
        case "KeyR": resetSolver(); break;
        case "Digit1": changeMode("velocity"); break;
        case "Digit2": changeMode("pressure"); break;
        case "Digit3": changeMode("streamlines"); break;
        case "Digit4": changeMode("vorticity"); break;
        case "Digit5": changeMode("vectors"); break;
        case "Digit6": changeMode("schlieren"); break;
        case "Digit7": changeMode("3d"); break;
        case "KeyF": toggleFS(); break;
        case "KeyS": if (!e.ctrlKey && !e.metaKey) snap(); break;
        case "KeyZ":
          if (e.ctrlKey || e.metaKey) { e.shiftKey ? redoShape() : undoShape(); e.preventDefault(); }
          else undoShape();
          break;
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [resetSolver, changeMode, toggleFS, snap, undoShape, redoShape]);

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

    /* 30.1 — Helper: resolve field data for a given mode string */
    const getFieldInfo = (solver, modeStr) => {
      if (modeStr === "velocity") return { field: solver.spd, fMn: solver.spdMin, fMx: solver.spdMax, lut: TURBO };
      if (modeStr === "pressure") return { field: solver.rho, fMn: solver.rhoMin, fMx: solver.rhoMax, lut: COOLWARM };
      if (modeStr === "vorticity") return { field: solver.curl, fMn: solver.curlMin, fMx: solver.curlMax, lut: TURBO };
      return { field: solver.spd, fMn: solver.spdMin, fMx: solver.spdMax, lut: TURBO };
    };

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const solver = solverRef.current; if (!solver) return;
      const p = P.current;
      const inV = p.vel;

      if (p.running) {
        for (let s = 0; s < p.simSpd; s++) solver.step(inV, p.turb);

        // 21.1 — Divergence detection
        if (solver.diverged) {
          solver.diverged = false;
          setRunning(false);
          publicationWarningRef.current = "diverged";
          setSolverWarning("diverged");
          if (solverWarningTimer.current) clearTimeout(solverWarningTimer.current);
          solverWarningTimer.current = setTimeout(() => setSolverWarning(null), 5000);
        }
        // 21.2 — Overflow warning (>5% of fluid cells clamped)
        else if (solver.overflowCount > solver.N * 0.05) {
          if (!solverWarningTimer.current) {
            publicationWarningRef.current = "overflow";
            setSolverWarning("overflow");
            solverWarningTimer.current = setTimeout(() => { setSolverWarning(null); solverWarningTimer.current = null; }, 3000);
          }
        }
      }

      // 21.3 — Update convergence delta (throttled)
      if (frameRef.current % 10 === 0 && solver.convergenceDelta !== undefined) {
        setConvergenceDelta(solver.convergenceDelta);
      }

      frameRef.current++; fpsF.current++;
      const now = performance.now();
      if (now - fpsT.current >= 1000) { setFps(fpsF.current); fpsF.current = 0; fpsT.current = now; }

      const vm = p.mode;
      let frameFieldMin = null, frameFieldMax = null;
      let comparisonFields = null, fallbackScale = false;
      const solidC = (255<<24)|(44<<16)|(44<<8)|52;
      const bgC = (255<<24)|(3<<16)|(3<<8)|5;

      /* ── 30.1 — Split-screen comparison render ── */
      if (compareModeRef.current && vm !== "streamlines" && vm !== "3d" && vm !== "vectors") {
        const cf = compareFieldsRef.current;
        const splitX = Math.round(SIM_W * cf.div);
        const a = getFieldInfo(solver, cf.a);
        const b = getFieldInfo(solver, cf.b);
        const fRA = (a.fMx - a.fMn) || 1, fRB = (b.fMx - b.fMn) || 1;
        const invRA = 255 / fRA, invRB = 255 / fRB;
        const invDX = COLS / SIM_W, invDY = ROWS / SIM_H;

        for (let py = 0; py < SIM_H; py++) {
          const j = Math.min(ROWS - 1, (py * invDY) | 0), ro = py * SIM_W;
          for (let px = 0; px < SIM_W; px++) {
            const i = Math.min(COLS - 1, (px * invDX) | 0), k = j * COLS + i;
            if (solver.solid[k]) { buf32[ro + px] = solidC; continue; }
            if (px < splitX) {
              buf32[ro + px] = a.lut[Math.max(0, Math.min(255, ((a.field[k] - a.fMn) * invRA) | 0))];
            } else {
              buf32[ro + px] = b.lut[Math.max(0, Math.min(255, ((b.field[k] - b.fMn) * invRB) | 0))];
            }
          }
        }

        // 30.3 — Diff overlay (semi-transparent red)
        if (cf.diff) {
          for (let py = 0; py < SIM_H; py++) {
            const j = Math.min(ROWS - 1, (py * invDY) | 0), ro = py * SIM_W;
            for (let px = 0; px < SIM_W; px++) {
              const i = Math.min(COLS - 1, (px * invDX) | 0), k = j * COLS + i;
              if (solver.solid[k]) continue;
              const va = (a.field[k] - a.fMn) / fRA;
              const vb = (b.field[k] - b.fMn) / fRB;
              const diff = Math.abs(va - vb);
              if (diff < 0.02) continue;
              const alpha = Math.min(0.6, diff * 1.5);
              const c = buf32[ro + px];
              const cr = c & 0xFF, cg = (c >> 8) & 0xFF, cb = (c >> 16) & 0xFF;
              const nr = Math.min(255, cr + (255 - cr) * alpha | 0);
              const ng = Math.max(0, cg - cg * alpha * 0.7 | 0);
              const nb = Math.max(0, cb - cb * alpha * 0.7 | 0);
              buf32[ro + px] = (255 << 24) | (nb << 16) | (ng << 8) | nr;
            }
          }
        }

        // Divider line
        for (let py = 0; py < SIM_H; py++) {
          const ro = py * SIM_W;
          if (splitX > 0 && splitX < SIM_W) buf32[ro + splitX] = 0xFFFFFFFF;
          if (splitX > 1) buf32[ro + splitX - 1] = 0xFF888888;
          if (splitX < SIM_W - 1) buf32[ro + splitX + 1] = 0xFF888888;
        }

        frameFieldMin = a.fMn; frameFieldMax = a.fMx;
        comparisonFields = [{ mode: cf.a, min: a.fMn, max: a.fMx }, { mode: cf.b, min: b.fMn, max: b.fMx }];
      }
      else if (vm === "streamlines" || vm === "3d") {
        buf32.fill(bgC);
        for (let k = 0; k < solver.N; k++) {
          if (!solver.solid[k]) continue;
          const i = k % COLS, j = (k/COLS)|0;
          const x0 = (i*DX)|0, y0 = (j*DY)|0;
          const x1 = Math.min(((i+1)*DX)|0, SIM_W), y1 = Math.min(((j+1)*DY)|0, SIM_H);
          for (let py = y0; py < y1; py++)
            for (let px = x0; px < x1; px++) buf32[py*SIM_W+px] = solidC;
        }
      } else if (vm === "schlieren") {
        // 27.3 — Schlieren: density gradient |∂ρ/∂y| mapped to warm grayscale
        const invDX = COLS/SIM_W, invDY = ROWS/SIM_H;
        let gMx = 0;
        for (let j = 1; j < ROWS-1; j++)
          for (let i = 0; i < COLS; i++) {
            const g = Math.abs(solver.rho[(j+1)*COLS+i] - solver.rho[(j-1)*COLS+i]) * 0.5;
            if (g > gMx) gMx = g;
          }
        if (gMx < 1e-10) { gMx = 1; fallbackScale = true; }
        const invG = 1 / gMx;
        for (let py = 0; py < SIM_H; py++) {
          const j = Math.min(ROWS-2, Math.max(1, (py*invDY)|0)), ro = py*SIM_W;
          for (let px = 0; px < SIM_W; px++) {
            const i = Math.min(COLS-1, (px*invDX)|0), k = j*COLS+i;
            if (solver.solid[k]) { buf32[ro+px] = solidC; continue; }
            const grad = Math.abs(solver.rho[(j+1)*COLS+i] - solver.rho[(j-1)*COLS+i]) * 0.5;
            const t = Math.min(1, grad * invG);
            const v = 1 - t; // invert: high gradient = dark
            // Warm shadowgraph palette: sepia-tinted
            const r = Math.max(0, Math.min(255, (v * 240 + t * 40)|0));
            const g = Math.max(0, Math.min(255, (v * 230 + t * 25)|0));
            const b = Math.max(0, Math.min(255, (v * 200 + t * 15)|0));
            buf32[ro+px] = (255<<24)|(b<<16)|(g<<8)|r;
          }
        }
        frameFieldMin = 0; frameFieldMax = gMx;
      } else if (vm === "vectors") {
        // 27.2 — Vector field: render field as velocity background + arrows drawn after putImageData
        const lut = TURBO;
        let fMn = solver.spdMin, fMx = solver.spdMax;
        if (fMn === undefined || fMx === undefined || fMn >= fMx) { fMn = 0; fMx = 1; fallbackScale = true; }
        frameFieldMin = fMn; frameFieldMax = fMx;
        const fR = fMx - fMn;
        if (fR < 1e-10) { buf32.fill(lut[128]); }
        else {
          // Dimmed velocity background
          const invR = 255/fR, invDX = COLS/SIM_W, invDY = ROWS/SIM_H;
          for (let py = 0; py < SIM_H; py++) {
            const j = Math.min(ROWS-1, (py*invDY)|0), ro = py*SIM_W;
            for (let px = 0; px < SIM_W; px++) {
              const i = Math.min(COLS-1, (px*invDX)|0), k = j*COLS+i;
              if (solver.solid[k]) { buf32[ro+px] = solidC; continue; }
              const c = lut[Math.max(0, Math.min(255, ((solver.spd[k]-fMn)*invR)|0))];
              // Dim the background to 30% opacity
              const cr = (c & 0xff), cg = ((c>>8) & 0xff), cb = ((c>>16) & 0xff);
              buf32[ro+px] = (255<<24)|((cb*0.3|0)<<16)|((cg*0.3|0)<<8)|(cr*0.3|0);
            }
          }
        }
      } else {
        const lut = vm === "pressure" ? COOLWARM : TURBO;
        const field = vm === "velocity" ? solver.spd : vm === "pressure" ? solver.rho : solver.curl;
        // 23.2 — Use cached field ranges from solver (no per-frame scan)
        let fMn, fMx;
        if (vm === "velocity") { fMn = solver.spdMin; fMx = solver.spdMax; }
        else if (vm === "pressure") { fMn = solver.rhoMin; fMx = solver.rhoMax; }
        else { fMn = solver.curlMin; fMx = solver.curlMax; }
        // Fallback if solver hasn't computed ranges yet
        if (fMn === undefined || fMx === undefined || fMn >= fMx) {
          fMn = 0; fMx = 1; fallbackScale = true;
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

      // 27.2 — Draw velocity vector arrows on top of the image
      if (vm === "vectors") {
        const step = 8; // sample every 8th cell
        const arrowScale = DX * 28;
        const maxLen = DX * 6;
        ctx.lineWidth = 1;
        ctx.lineCap = "round";
        for (let j = step; j < ROWS - step; j += step) {
          for (let i = step; i < COLS - step; i += step) {
            const k = j * COLS + i;
            if (solver.solid[k]) continue;
            const ux = solver.ux[k], uy = solver.uy[k];
            const mag = Math.sqrt(ux * ux + uy * uy);
            if (mag < 1e-6) continue;
            const px = i * DX, py = j * DY;
            let dx = ux * arrowScale, dy = uy * arrowScale;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > maxLen) { const s = maxLen / len; dx *= s; dy *= s; }
            // Color by velocity magnitude
            const fMn = solver.spdMin || 0, fMx = solver.spdMax || 1;
            const t = Math.max(0, Math.min(1, (mag - fMn) / (fMx - fMn || 1)));
            const r = t < 0.5 ? (t * 2 * 255)|0 : 255;
            const g = t < 0.5 ? 255 : ((1 - (t - 0.5) * 2) * 255)|0;
            const b = t < 0.3 ? ((1 - t / 0.3) * 200)|0 : 0;
            ctx.strokeStyle = `rgb(${r},${g},${b})`;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + dx, py + dy);
            ctx.stroke();
            // Arrowhead
            if (len > 2) {
              const angle = Math.atan2(dy, dx);
              const headLen = Math.min(3, len * 0.3);
              ctx.beginPath();
              ctx.moveTo(px + dx, py + dy);
              ctx.lineTo(px + dx - headLen * Math.cos(angle - 0.5), py + dy - headLen * Math.sin(angle - 0.5));
              ctx.moveTo(px + dx, py + dy);
              ctx.lineTo(px + dx - headLen * Math.cos(angle + 0.5), py + dy - headLen * Math.sin(angle + 0.5));
              ctx.stroke();
            }
          }
        }
      }

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

      // Geometry boundary, independent of field normalization.
      const outline = p._outline;
      if (outline) {
        ctx.beginPath();
        outline.forEach(([gx, gy], i) => {
          const px = gx*DX, py = gy*DY;
          i===0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
        });
        ctx.closePath();
        ctx.strokeStyle = "#00d4ff"; ctx.lineWidth = 1.25;
        ctx.stroke();
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
        setAnalysisSample({ values: ns, fluidCells: cnt, at: histRef.current.at(-1)?.t, setup: Object.fromEntries(SETUP_FIELDS.map(key => [key, p[key]])) });

      }

      const comparing = comparisonFields !== null;
      const key = comparing ? `${vm}/${comparisonFields.map(field => field.mode).join("/")}` : vm;
      if (frameRef.current % 15 === 0 || fieldRangeRef.current.key !== key) {
        const fields = comparisonFields || (Number.isFinite(frameFieldMin) && Number.isFinite(frameFieldMax) ? [{ mode: vm, min: frameFieldMin, max: frameFieldMax, fallback: fallbackScale }] : []);
        const previous = fieldRangeRef.current;
        if (previous.key !== key || fields.some((field, index) => field.min !== previous.fields[index]?.min || field.max !== previous.fields[index]?.max || field.fallback !== previous.fields[index]?.fallback)) {
          const next = { key, mode: vm, comparing, fields };
          fieldRangeRef.current = next;
          setLegendFrame(next);
        }
      }

      if (p.mode !== "3d" && captureRequestRef.current) {
        captureRequestRef.current(canvas, { preset: p.preset, mode: vm, comparing, difference: comparing && compareFieldsRef.current.diff,
          fields: comparisonFields || (Number.isFinite(frameFieldMin) && Number.isFinite(frameFieldMax) ? [{ mode: vm, min: frameFieldMin, max: frameFieldMax, fallback: fallbackScale }] : []) });
      }

      const mc = miniRef.current;
      if (mc) mc.getContext("2d").drawImage(canvas, 0, 0, mc.width, mc.height);

      // 29.4 — Capture frame for recording
      if (recordingRef.current && recordCount.current < MAX_RECORD_FRAMES) {
        canvas.toBlob(blob => {
          if (blob) recordFrames.current.push(blob);
        }, "image/png");
        recordCount.current++;
        if (recordCount.current >= MAX_RECORD_FRAMES) {
          recordingRef.current = false;
          setRecording(false);
        }
      }
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [pushHist, histRef]);

  const ldRatio = useMemo(() => formatRatio(proxyRatio(stats)), [stats]);
  const is3D = mode === "3d";

  useEffect(() => { const iv = setInterval(() => { setHistSnap([...histRef.current]); setRecordFrameCount(recordCount.current); }, 500); return () => clearInterval(iv); }, [histRef]);

  const metricsFresh = sameSetup(analysisSample?.setup, { poly, cx, cy, sx, sy, aoa, simplify, vel, turb, nu });
  const fluidMetricsReady = metricsFresh && analysisSample.fluidCells > 0;
  const metrics = [
    { label:"CL proxy",   value:fluidMetricsReady && Number.isFinite(stats.cl)?stats.cl:"—",  tone:"var(--cfd-lift)" },
    { label:"CD proxy",   value:fluidMetricsReady && Number.isFinite(stats.cd)?stats.cd:"—",  tone:"var(--cfd-drag)" },
    { label:"L/D proxy",  value:fluidMetricsReady?ldRatio:"—",   tone:"var(--cfd-flow)" },
    { label:"Re*", value:metricsFresh && Number.isFinite(stats.re)?stats.re.toLocaleString():"—", tone:"var(--cfd-reynolds)" },
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
  const toggleRunning = useCallback(() => {
    setWorkspaceStarted(true);
    setIntroExpanded(false);
    setRunning(r => !r);
  }, []);
  const startWorkspace = () => {
    setWorkspaceStarted(true);
    setIntroExpanded(false);
    setView("tunnel");
    setRunning(true);
    requestAnimationFrame(() => document.getElementById("aerotunnel-main")?.focus({ preventScroll: true }));
  };

  const exportActions = { onCSV: exportCSV, onJSON: exportSession, onLoad: () => sessionInputRef.current?.click(), onSTL: exportSTL, csvProblem: csvIssue(histSnap), hasGeometry: !!poly };
  const frameActions = { recording, count: recordFrameCount, state: recordingExport, onStart: startRecording, onStop: stopRecording };
  return (
    <div className={`lab-shell ${is3D ? "is-3d-takeover" : ""} ${EMBED_MODE ? "is-embed" : ""}`} ref={wrapRef}
      onDrop={handleAppDrop} onDragOver={e => e.preventDefault()}>
      {!EMBED_MODE ? <><SiteMasthead /><RaceDeskNav /></> : <header className="embed-header">
        <a href="https://f1-stories.gr/" target="_blank" rel="noopener noreferrer">F1 STORIES · <strong>AEROTUNNEL</strong></a>
        <button type="button" onClick={toggleRunning}>{running ? "Pause" : workspaceStarted ? "Resume" : "Start Simulation"}</button>
        <button type="button" onClick={toggleFS}>Fullscreen</button>
        <a href={import.meta.env.BASE_URL} target="_blank" rel="noopener noreferrer">Open full workspace</a>
      </header>}
      <div className="app-workspace editorial-workspace" data-view={view} data-started={workspaceStarted || hasRun}>
      {!EMBED_MODE && <CommandBar started={(workspaceStarted || hasRun) && !introExpanded} running={running} fps={fps}
        convergenceDelta={convergenceDelta} onStart={startWorkspace} onShowIntro={() => setIntroExpanded(true)} hasStarted={workspaceStarted || hasRun} onMinimizeIntro={() => setIntroExpanded(false)} />}
      {!EMBED_MODE && <IconRail
        activeSection={activeSection}
        onSectionChange={openControlPanel}
        running={running}
        started={workspaceStarted || hasRun}
        onRunToggle={toggleRunning}
        onReset={resetSolver}
        currentView={view}
        panelOpen={panelOpen}
        onViewChange={changeRailView}
        onCompareToggle={toggleCompare}
        compareMode={compareMode}
        onUndo={undoShape}
        onRedo={redoShape}
        canUndo={undoStack.current.length > 0}
        canRedo={redoStack.current.length > 0}
      />}

      <div className={`workspace-grid ${view==="tunnel" && panelOpen && !EMBED_MODE ? "has-controls" : ""}`}>
        <ControlPanel
          isOpen={!EMBED_MODE && view === "tunnel" && panelOpen}
          section={activeSection}
          onSectionChange={changeActiveSection}
          onClose={closeControlPanel}
          preset={preset} poly={poly} onResetGeometry={resetGeometry} onOpenAnalysis={() => changeRailView("analysis")}
          onPresetSelect={(nextPreset, nextPoly) => { if (applyPoly(nextPoly)) setPreset(nextPreset); }}
          onShapeImport={nextPoly => { if (!applyPoly(nextPoly)) return false; setPreset("custom"); return true; }}
          cx={cx} setCx={setCx} cy={cy} setCy={setCy}
          sx={sx} setSx={setSx} sy={sy} setSy={setSy}
          aoa={aoa} setAoa={setAoa} simplify={simplify} setSimplify={setSimplify}
          vel={vel} setVel={setVel} turb={turb} setTurb={setTurb}
          nu={nu} setNu={setNu} pCount={pCount} setPCount={setPCount}
          trailOp={trailOp} setTrailOp={setTrailOp} simSpd={simSpd} setSimSpd={setSimSpd}
          autoRun={autoRun} setAutoRun={setAutoRun}
          mode={mode} onExportSTL={exportSTL} onImportSession={importSession}
        />

      <main id="aerotunnel-main" tabIndex={-1} aria-label="AeroTunnel workspace" className={`lab-canvas-zone lab-canvas-zone--${view}`}>
          <section className="canvas-area" hidden={view!=="tunnel"} aria-label="Simulation canvas area">
            <div className="viewport-toolbar">
              {EMBED_MODE && <p className="embed-mode-hint">Modes · scroll horizontally to see all seven</p>}
              <VisualizationModes modes={MODES} value={mode} onChange={changeMode} />
              {/* 30.1 — Compare mode controls */}
              {compareMode && !is3D && (
                <div className="compare-bar">
                  <div className="compare-bar__side">
                    <span className="compare-bar__label">A</span>
                    <select disabled={!comparisonAvailable(mode)} aria-label="Comparison field A" className="compare-bar__select" value={compareFieldA} onChange={e => setCompareFieldA(e.target.value)}>
                      <option value="velocity">Velocity</option>
                      <option value="pressure">Pressure</option>
                      <option value="vorticity">Vorticity</option>
                    </select>
                  </div>
                  <button type="button" disabled={!comparisonAvailable(mode)} title="Absolute difference between independently normalized fields; dimensionless, not a physical subtraction." aria-pressed={showDiff} className={`compare-bar__diff ${showDiff ? "is-active" : ""}`} onClick={() => setShowDiff(d => !d)}>
                    Normalized &Delta;
                  </button>
                  <div className="compare-bar__side">
                    <select disabled={!comparisonAvailable(mode)} aria-label="Comparison field B" className="compare-bar__select" value={compareFieldB} onChange={e => setCompareFieldB(e.target.value)}>
                      <option value="velocity">Velocity</option>
                      <option value="pressure">Pressure</option>
                      <option value="vorticity">Vorticity</option>
                    </select>
                    <span className="compare-bar__label">B</span>
                  </div>
                </div>
              )}
            </div>
            <div className="plot-status" aria-label="Plot state">
              <span>Flow <svg viewBox="0 0 32 12" aria-hidden="true"><path d="M1 6h28m-5-4 5 4-5 4" /></svg></span>
              <span>AoA {aoa.toFixed(1)}°</span>
              <span>{running ? "LBM running" : "LBM paused"}</span>
              <span title="RMS change in lattice velocity between solver steps, in cells/step; not a validated accuracy criterion.">Δu {convergenceDelta == null ? "—" : convergenceDelta.toExponential(1)}</span>
            </div>
            <div className={`canvas-wrapper ${running ? "is-live" : ""}`} onPointerDown={() => { if (window.matchMedia("(max-width: 1023px)").matches) closeControlPanel(); }}>
              <canvas
                ref={canvasRef}
                width={SIM_W}
                height={SIM_H}
                className="stage-canvas"
                role="img"
                aria-label={`2D LBM ${MODES.find(item => item.id === mode)?.label || mode} field in lattice units. Geometry aspect ratio preserved.`}
                style={{display:is3D?"none":"block",position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"contain"}} />
              {is3D && view==="tunnel" && <View3D captureRequestRef={captureRequestRef} poly={poly} solverRef={solverRef} cx={cx} cy={cy} sx={sx} sy={sy} aoa={aoa} mode={mode} preset={preset} simplify={simplify} onExit={() => changeMode("velocity")} />}

              <div className="canvas-hud">
                {!hasRun && !running && (
                  <div className="hud-waiting"><span>Ready to simulate</span></div>
                )}
              </div>

            </div>
            <FieldLegend mode={mode} frame={legendFrame} comparison={compareMode} difference={showDiff} />
          </section>
        <AnalysisPanel isActive={view === "analysis"} hSnap={histSnap} sample={analysisSample}
          setup={{ preset, poly, cx, cy, sx, sy, aoa, simplify, vel, turb, nu }}
          convergenceDelta={convergenceDelta} running={running} started={workspaceStarted || hasRun}
          exportTools={<ExportActions {...exportActions} />} onPublish={openPublishing}
          onSaveSession={saveCurrentSession} onLoadSession={loadSavedSession} onDeleteSession={deleteSavedSession}
          sweepState={sweepState} sweepReport={sweepReport} onStartSweep={startSweep} onCancelSweep={cancelSweep}
          recording={recording} onStartRecording={startRecording} onStopRecording={stopRecording}
          recordFrameCount={recordFrameCount} recordingExport={recordingExport}
          onReturn={() => { changeRailView("tunnel"); requestAnimationFrame(() => document.getElementById("aerotunnel-main")?.focus({ preventScroll: true })); }} onFullscreen={toggleFS} />
        {view==="about" && <AboutPanel />}
      </main>

      {!EMBED_MODE && view==="tunnel" && (
        <aside className="workspace-metrics" aria-label="Live aerodynamic metrics">
          <h2>Live indicators</h2>
          <dl>
            {metrics.map(m => <div key={m.label} style={{"--tone":m.tone}}>
              <dt>{m.label}</dt><dd>{m.value}</dd>
            </div>)}
          </dl>
          <p className="metric-caveat">{!metricsFresh && "Awaiting a sample for this setup. "}Heuristic proxies, not validated force coefficients. Re* is a scaled lattice estimate.</p>
          <button type="button" className="workspace-text-action" onClick={() => changeRailView("analysis")}>Analysis &amp; exports <span aria-hidden="true">→</span></button>
        </aside>
      )}
      </div>
      {!EMBED_MODE && view !== "analysis" && <div className="workspace-context-actions" role="group" aria-label="Publishing and exports">
        <button type="button" onClick={openPublishing}>Share &amp; Export</button>
        <button type="button" onClick={toggleFS}>Fullscreen</button>
        <button type="button" onClick={exportSession}>Save Simulation Session (JSON)</button>
        <button type="button" onClick={() => sessionInputRef.current?.click()}>Load Session</button>
        <span className="workspace-shortcuts">Space: run / pause · S: save image · F: fullscreen</span>
      </div>}
      {EMBED_MODE && <p className="embed-note">Interactive default F1 model · educational 2D LBM in lattice units. No saved session loaded. 3D is qualitative, not full 3D CFD.</p>}
      {!EMBED_MODE && <>
        <input ref={sessionInputRef} hidden type="file" accept=".json,application/json" aria-label="Load AeroTunnel session file" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; readSessionFile(file); }} />
        <PublishingDialog dialogRef={publishingRef} busy={imageBusy} error={imageError} onImage={snap} actions={exportActions} frames={frameActions} canCapture={view === "tunnel"} notice={sessionToast} />
      </>}
      {/* 21.1/21.2/21.4 — Solver warning HUD */}
      {solverWarning && (
        <div className={`solver-warning solver-warning--${solverWarning}`} role="alert">
          <span className="solver-warning__icon">&#9888;</span>
          <span className="solver-warning__text">
            {solverWarning === "diverged" && "SOLVER DIVERGED — Reduce velocity or increase viscosity"}
            {solverWarning === "overflow" && "VELOCITY OVERFLOW — Solver struggling, consider adjusting parameters"}
            {GEOMETRY_ERRORS[solverWarning]}
            {solverWarning === "geom-intersect" && "SELF-INTERSECTING GEOMETRY — Results may be inaccurate"}
          </span>
        </div>
      )}

      {/* 25.1 — Session restore toast */}
      {sessionToast && (
        <div className="session-toast" role={/^(Import|Image export) failed/.test(sessionToast) ? "alert" : "status"}><span>{sessionToast}</span><button type="button" aria-label="Dismiss notice" onClick={() => setSessionToast(null)}>&times;</button></div>
      )}


      </div>
    </div>
  );
}
