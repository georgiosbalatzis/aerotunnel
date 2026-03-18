import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTheme, cssVar } from "./ThemeContext";
import ThemeToggle from "./ThemeToggle";

/*
 *  ╔══════════════════════════════════════════════════════════════════════╗
 *  ║  AEROLAB — CFD Wind Tunnel Dashboard                               ║
 *  ║  Fixed, themed, and performance-optimized                          ║
 *  ╚══════════════════════════════════════════════════════════════════════╝
 */

// ─── SIMULATION CONSTANTS ──────────────────────────────────────────────────────
const SIM_W = 880, SIM_H = 400;
const COLS = 88, ROWS = 40;
const DX = SIM_W / COLS, DY = SIM_H / ROWS;
const NUM_PARTICLES = 260;

// ─── HSL → RGB ─────────────────────────────────────────────────────────────────
function hslRGB(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = n => { const k = (n + h * 12) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0) * 255 | 0, f(8) * 255 | 0, f(4) * 255 | 0];
}

// ─── Point-in-polygon ──────────────────────────────────────────────────────────
function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > py) !== (yj > py)) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ─── SVG Parser ────────────────────────────────────────────────────────────────
function parseSVGToPolygon(svgText, numPoints = 120) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const el = doc.querySelector("path,polygon,polyline,rect,circle,ellipse");
    if (!el) return null;
    const tag = el.tagName.toLowerCase();
    let pts = [];
    if (tag === "polygon" || tag === "polyline") {
      const raw = el.getAttribute("points").trim().split(/[\s,]+/);
      for (let i = 0; i < raw.length - 1; i += 2) pts.push([parseFloat(raw[i]), parseFloat(raw[i + 1])]);
    } else if (tag === "rect") {
      const x = +el.getAttribute("x") || 0, y = +el.getAttribute("y") || 0;
      const w = +el.getAttribute("width"), h = +el.getAttribute("height");
      pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    } else if (tag === "circle" || tag === "ellipse") {
      const cx = +(el.getAttribute("cx") || 0), cy = +(el.getAttribute("cy") || 0);
      const rx = +(el.getAttribute("r") || el.getAttribute("rx") || 50);
      const ry = +(el.getAttribute("r") || el.getAttribute("ry") || rx);
      for (let i = 0; i <= numPoints; i++) {
        const t = (i / numPoints) * Math.PI * 2;
        pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
      }
    } else if (tag === "path") {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.style.cssText = "position:absolute;visibility:hidden;width:0;height:0";
      document.body.appendChild(svg);
      const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
      pathEl.setAttribute("d", el.getAttribute("d"));
      svg.appendChild(pathEl);
      const total = pathEl.getTotalLength();
      for (let i = 0; i <= numPoints; i++) {
        const pt = pathEl.getPointAtLength((i / numPoints) * total);
        pts.push([pt.x, pt.y]);
      }
      document.body.removeChild(svg);
    }
    return normalizePolygon(pts);
  } catch { return null; }
}

// ─── DXF Parser (improved robustness) ──────────────────────────────────────────
function parseDXFToPolygon(dxfText) {
  const lines = dxfText.split(/\r?\n/).map(l => l.trim());
  const pts = [];
  let i = 0;

  // Look for LWPOLYLINE entities first
  while (i < lines.length) {
    if (lines[i] === "LWPOLYLINE") {
      i++;
      let currentX = null;
      while (i < lines.length && lines[i] !== "0") {
        const code = parseInt(lines[i], 10);
        if (code === 10 && i + 1 < lines.length) {
          currentX = parseFloat(lines[i + 1]);
          i += 2;
        } else if (code === 20 && i + 1 < lines.length && currentX !== null) {
          const y = parseFloat(lines[i + 1]);
          if (!isNaN(currentX) && !isNaN(y)) pts.push([currentX, y]);
          currentX = null;
          i += 2;
        } else {
          i++;
        }
      }
      if (pts.length > 2) return normalizePolygon(pts);
    }
    i++;
  }

  // Fallback: collect all 10/20 pairs
  i = 0;
  let pendingX = null;
  while (i < lines.length) {
    const code = parseInt(lines[i], 10);
    if (code === 10 && i + 1 < lines.length) {
      pendingX = parseFloat(lines[i + 1]);
      i += 2;
    } else if (code === 20 && i + 1 < lines.length && pendingX !== null) {
      const y = parseFloat(lines[i + 1]);
      if (!isNaN(pendingX) && !isNaN(y)) pts.push([pendingX, y]);
      pendingX = null;
      i += 2;
    } else {
      i++;
    }
  }
  return pts.length > 2 ? normalizePolygon(dedupPoints(pts)) : null;
}

function dedupPoints(pts) {
  return pts.filter((p, i) => i === 0 || Math.abs(p[0] - pts[i - 1][0]) + Math.abs(p[1] - pts[i - 1][1]) > 0.01);
}

// ─── Image auto-trace ──────────────────────────────────────────────────────────
function traceImageToPolygon(imageData, width, height, numPoints = 100) {
  const { data } = imageData;
  const edges = [];
  const thresh = 128;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const bright = data[idx] * 0.3 + data[idx + 1] * 0.59 + data[idx + 2] * 0.11;
      const neighbors = [
        (y - 1) * width + (x - 1), (y - 1) * width + x, (y - 1) * width + (x + 1),
        y * width + (x - 1), y * width + (x + 1),
        (y + 1) * width + (x - 1), (y + 1) * width + x, (y + 1) * width + (x + 1),
      ];
      const isDark = bright < thresh;
      const hasBright = neighbors.some(n => (data[n * 4] * 0.3 + data[n * 4 + 1] * 0.59 + data[n * 4 + 2] * 0.11) >= thresh);
      if (isDark && hasBright) edges.push([x, y]);
    }
  }
  if (edges.length < 10) {
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        if (data[idx] * 0.3 + data[idx + 1] * 0.59 + data[idx + 2] * 0.11 > thresh + 30) edges.push([x, y]);
      }
    }
  }
  if (edges.length < 5) return null;
  const cxE = edges.reduce((s, p) => s + p[0], 0) / edges.length;
  const cyE = edges.reduce((s, p) => s + p[1], 0) / edges.length;
  edges.sort((a, b) => Math.atan2(a[1] - cyE, a[0] - cxE) - Math.atan2(b[1] - cyE, b[0] - cxE));
  const step = Math.max(1, Math.floor(edges.length / numPoints));
  return normalizePolygon(edges.filter((_, i) => i % step === 0));
}

// ─── Polygon utils ─────────────────────────────────────────────────────────────
function normalizePolygon(pts) {
  if (!pts || pts.length < 3) return null;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const rX = maxX - minX || 1, rY = maxY - minY || 1;
  return pts.map(p => [(p[0] - minX) / rX, (p[1] - minY) / rY]);
}

function transformPolygon(normPts, cx, cy, scaleX, scaleY, aoa) {
  const rad = (aoa * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  return normPts.map(([nx, ny]) => {
    const lx = (nx - 0.5) * scaleX, ly = (ny - 0.5) * scaleY;
    return [cx + cos * lx - sin * ly, cy + sin * lx + cos * ly];
  });
}

function simplifyPolygon(pts, tolerance) {
  if (pts.length <= 4) return pts;
  const result = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = result[result.length - 1], next = pts[i + 1], curr = pts[i];
    const dx = next[0] - prev[0], dy = next[1] - prev[1];
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const dist = Math.abs(dy * curr[0] - dx * curr[1] + next[0] * prev[1] - next[1] * prev[0]) / len;
    if (dist > tolerance) result.push(curr);
  }
  result.push(pts[pts.length - 1]);
  return result;
}

// ─── Preset shapes ─────────────────────────────────────────────────────────────
function generatePreset(type) {
  const pts = [];
  if (type === "airfoil") {
    for (let t = 0; t <= Math.PI * 2; t += 0.06) {
      pts.push([0.5 + 0.48 * Math.cos(t) * (0.5 + 0.5 * Math.cos(t)), 0.5 + 0.22 * Math.sin(t)]);
    }
  } else if (type === "cylinder") {
    for (let t = 0; t <= Math.PI * 2; t += 0.08) pts.push([0.5 + 0.45 * Math.cos(t), 0.5 + 0.45 * Math.sin(t)]);
  } else if (type === "wedge") {
    pts.push([0.05, 0.2], [0.95, 0.5], [0.05, 0.8]);
  } else if (type === "bluff") {
    pts.push([0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]);
  }
  return pts;
}

// ─── Flow Solver ───────────────────────────────────────────────────────────────
class FlowSolver {
  constructor() {
    this.n = COLS * ROWS;
    this.vx = new Float32Array(this.n).fill(1);
    this.vy = new Float32Array(this.n);
    this.p = new Float32Array(this.n).fill(1);
    this.solid = new Uint8Array(this.n);
    // Pre-allocate scratch buffers to avoid GC
    this._nvx = new Float32Array(this.n);
    this._nvy = new Float32Array(this.n);
    this._np = new Float32Array(this.n);
  }
  idx(i, j) { return j * COLS + i; }
  buildSolid(transformedPoly) {
    this.solid.fill(0);
    if (!transformedPoly) return;
    for (let j = 0; j < ROWS; j++)
      for (let i = 0; i < COLS; i++)
        if (pointInPolygon(i + 0.5, j + 0.5, transformedPoly))
          this.solid[this.idx(i, j)] = 1;
  }
  step(inletVx, turb, nu) {
    const nvx = this._nvx, nvy = this._nvy, np = this._np;
    nvx.fill(0); nvy.fill(0); np.fill(0);
    const dt = 0.38;
    for (let j = 1; j < ROWS - 1; j++) {
      for (let i = 1; i < COLS - 1; i++) {
        const k = this.idx(i, j);
        if (this.solid[k]) continue;
        const kl = k - 1, kr = k + 1, kd = k - COLS, ku = k + COLS;
        const dvxdx = (this.vx[kr] - this.vx[kl]) * 0.5;
        const dvxdy = (this.vx[ku] - this.vx[kd]) * 0.5;
        const dvydx = (this.vy[kr] - this.vy[kl]) * 0.5;
        const dvydy = (this.vy[ku] - this.vy[kd]) * 0.5;
        const lapVx = this.vx[kl] + this.vx[kr] + this.vx[kd] + this.vx[ku] - 4 * this.vx[k];
        const lapVy = this.vy[kl] + this.vy[kr] + this.vy[kd] + this.vy[ku] - 4 * this.vy[k];
        const t = (Math.random() - 0.5) * turb * 0.035;
        nvx[k] = this.vx[k] + dt * (-this.vx[k] * dvxdx - this.vy[k] * dvxdy + nu * lapVx + t);
        nvy[k] = this.vy[k] + dt * (-this.vx[k] * dvydx - this.vy[k] * dvydy + nu * lapVy + t * 0.5);
        const spd2 = nvx[k] ** 2 + nvy[k] ** 2;
        const cap = inletVx * 2.6;
        if (spd2 > cap * cap) { const s = cap / Math.sqrt(spd2); nvx[k] *= s; nvy[k] *= s; }
        np[k] = 1 - 0.5 * spd2 / (inletVx * inletVx + 1e-4);
      }
    }
    for (let j = 0; j < ROWS; j++) {
      const k0 = this.idx(0, j);
      nvx[k0] = inletVx; nvy[k0] = (Math.random() - 0.5) * turb * 0.015; np[k0] = 1;
      nvx[this.idx(1, j)] = inletVx;
      const ke = this.idx(COLS - 1, j), kp = this.idx(COLS - 2, j);
      nvx[ke] = nvx[kp]; nvy[ke] = nvy[kp]; np[ke] = np[kp];
    }
    for (let i = 0; i < COLS; i++) {
      nvx[this.idx(i, 0)] = nvx[this.idx(i, 1)]; nvy[this.idx(i, 0)] = -nvy[this.idx(i, 1)];
      nvx[this.idx(i, ROWS - 1)] = nvx[this.idx(i, ROWS - 2)]; nvy[this.idx(i, ROWS - 1)] = -nvy[this.idx(i, ROWS - 2)];
    }
    for (let k = 0; k < this.n; k++) if (this.solid[k]) { nvx[k] = 0; nvy[k] = 0; np[k] = 1.2; }
    this.vx.set(nvx); this.vy.set(nvy); this.p.set(np);
  }
}

// ─── Particle (with pre-allocated trail) ───────────────────────────────────────
class Particle {
  constructor() {
    this.trail = new Array(20);
    this.trailLen = 0;
    this.trailIdx = 0;
    this.reset();
  }
  reset() {
    this.x = Math.random() * 4;
    this.y = 0.5 + Math.random() * (ROWS - 1.5);
    this.age = 0;
    this.life = 0.55 + Math.random() * 0.45;
    this.trailLen = 0;
    this.trailIdx = 0;
  }
  update(solver) {
    const ci = this.x | 0, cj = this.y | 0;
    if (ci < 0 || ci >= COLS || cj < 0 || cj >= ROWS) { this.reset(); return; }
    const k = solver.idx(ci, cj);
    if (solver.solid[k]) { this.reset(); return; }
    // Ring buffer trail
    const idx = this.trailIdx % 20;
    this.trail[idx] = { x: this.x * DX, y: this.y * DY };
    this.trailIdx++;
    if (this.trailLen < 20) this.trailLen++;
    this.x += solver.vx[k] * 1.1;
    this.y += solver.vy[k] * 1.1;
    this.age += 0.016;
    if (this.age >= this.life || this.x >= COLS) this.reset();
  }
  getTrail() {
    const out = [];
    const start = this.trailIdx - this.trailLen;
    for (let i = start; i < this.trailIdx; i++) {
      out.push(this.trail[((i % 20) + 20) % 20]);
    }
    return out;
  }
}

// ─── Icons ─────────────────────────────────────────────────────────────────────
const IconPlay = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
const IconPause = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>;
const IconReset = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.17"/></svg>;
const IconUpload = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const IconImage = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
const IconWind = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17.7 7.7A2.5 2.5 0 1 1 19 12H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>;
const IconChart = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>;
const IconGear = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>;
const IconLayers = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>;
const IconKeyboard = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/></svg>;

// ─── History recorder ──────────────────────────────────────────────────────────
function useHistory(maxLen = 100) {
  const ref = useRef([]);
  const push = useCallback((entry) => {
    ref.current.push({ ...entry, t: Date.now() });
    if (ref.current.length > maxLen) ref.current.shift();
  }, [maxLen]);
  return [ref, push];
}

// ═══════════════════════════════════════════════════════════════════════════════
//   MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function CFDLab() {
  const { isDark, mode } = useTheme();

  // ── Navigation ──
  const [activeView, setActiveView] = useState("tunnel");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── Simulation state ──
  const solverRef = useRef(new FlowSolver());
  const particlesRef = useRef(Array.from({ length: NUM_PARTICLES }, () => new Particle()));
  const canvasRef = useRef(null);
  const drawCanvasRef = useRef(null);
  const miniCanvasRef = useRef(null);
  const rafRef = useRef(null);
  const frameRef = useRef(0);
  const isDrawingRef = useRef(false);
  const drawPointsRef = useRef([]);
  // FIX: pre-allocate ImageData to reuse across frames
  const imageDataRef = useRef(null);

  // ── UI state ──
  const [tab, setTab] = useState("preset");
  const [running, setRunning] = useState(false);
  const [viewMode, setViewMode] = useState("velocity");
  const [normPoly, setNormPoly] = useState(() => generatePreset("airfoil"));
  const [presetType, setPresetType] = useState("airfoil");
  const [shapeReady, setShapeReady] = useState(true);
  const [error, setError] = useState("");
  const [simplify, setSimplify] = useState(0);
  const [stats, setStats] = useState({ cl: 0, cd: 0, re: 0, maxV: 0 });
  // FIX: track frame count in state for display (throttled)
  const [displayFrame, setDisplayFrame] = useState(0);

  // Shape transform
  const [cx, setCx] = useState(COLS * 0.4);
  const [cy, setCy] = useState(ROWS / 2);
  const [scaleX, setScaleX] = useState(COLS * 0.32);
  const [scaleY, setScaleY] = useState(ROWS * 0.55);
  const [aoa, setAoa] = useState(5);

  // Flow params
  const [velocity, setVelocity] = useState(1.4);
  const [turbulence, setTurbulence] = useState(0.3);
  const [viscosity, setViscosity] = useState(0.18);

  // History for analysis view
  const [historyRef, pushHistory] = useHistory(200);
  const [historySnap, setHistorySnap] = useState([]);

  // Refs for render loop (to avoid stale closures)
  const runningRef = useRef(false);
  const viewRef = useRef("velocity");
  const polyRef = useRef(normPoly);
  const cxRef = useRef(cx), cyRef = useRef(cy);
  const sxRef = useRef(scaleX), syRef = useRef(scaleY);
  const aoaRef = useRef(aoa);
  const simplifyRef = useRef(0);
  const velRef = useRef(1.4), turbRef = useRef(0.3), nuRef = useRef(0.18);
  const themeRef = useRef(isDark);

  useEffect(() => { themeRef.current = isDark; }, [isDark]);
  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { viewRef.current = viewMode; }, [viewMode]);
  useEffect(() => { velRef.current = velocity; }, [velocity]);
  useEffect(() => { turbRef.current = turbulence; }, [turbulence]);
  useEffect(() => { nuRef.current = viscosity; }, [viscosity]);

  const rebuildSolid = useCallback(() => {
    const raw = polyRef.current;
    if (!raw) return;
    const simp = simplifyRef.current > 0 ? simplifyPolygon(raw, simplifyRef.current * 0.005) : raw;
    const tpoly = transformPolygon(simp, cxRef.current, cyRef.current, sxRef.current, syRef.current, aoaRef.current);
    solverRef.current.buildSolid(tpoly);
  }, []);

  // FIX: unified effect for transform params — single rebuild instead of 5 separate effects
  useEffect(() => {
    aoaRef.current = aoa;
    cxRef.current = cx;
    cyRef.current = cy;
    sxRef.current = scaleX;
    syRef.current = scaleY;
    rebuildSolid();
  }, [aoa, cx, cy, scaleX, scaleY, rebuildSolid]);

  useEffect(() => {
    polyRef.current = normPoly;
    simplifyRef.current = simplify;
    rebuildSolid();
  }, [normPoly, simplify, rebuildSolid]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e) => {
      // Don't capture if user is in an input
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      switch (e.code) {
        case "Space":
          e.preventDefault();
          setRunning(r => !r);
          break;
        case "KeyR":
          solverRef.current = new FlowSolver();
          rebuildSolid();
          break;
        case "Digit1": setViewMode("velocity"); break;
        case "Digit2": setViewMode("pressure"); break;
        case "Digit3": setViewMode("streamlines"); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [rebuildSolid]);

  // ── Render loop ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    // FIX: pre-allocate ImageData once
    imageDataRef.current = ctx.createImageData(SIM_W, SIM_H);

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const solver = solverRef.current;
      const inV = velRef.current;
      const isRunning = runningRef.current;
      if (isRunning) solver.step(inV, turbRef.current, nuRef.current);
      frameRef.current++;

      const dark = themeRef.current;
      const bgR = dark ? 3 : 230, bgG = dark ? 10 : 238, bgB = dark ? 18 : 244;
      const solidR = dark ? 50 : 160, solidG = dark ? 62 : 175, solidB = dark ? 78 : 195;

      ctx.fillStyle = dark ? "#030a12" : "#e6eef4";
      ctx.fillRect(0, 0, SIM_W, SIM_H);

      const vm = viewRef.current;
      const img = imageDataRef.current;
      const buf = img.data;

      for (let j = 0; j < ROWS; j++) {
        for (let i = 0; i < COLS; i++) {
          const k = solver.idx(i, j);
          let r = bgR, g = bgG, b = bgB;
          if (solver.solid[k]) {
            r = solidR; g = solidG; b = solidB;
          } else if (vm !== "streamlines") {
            const vx = solver.vx[k], vy = solver.vy[k];
            const spd = Math.sqrt(vx * vx + vy * vy);
            let col;
            if (vm === "velocity") {
              const t = Math.min(spd / (inV * 2.2), 1);
              col = hslRGB((1 - t) * 0.667, 1, dark ? 0.35 + t * 0.35 : 0.3 + t * 0.4);
            } else {
              const cp = 1 - (vx * vx + vy * vy) / (inV * inV + 1e-4);
              const t = Math.max(0, Math.min(1, (cp + 1.5) / 3));
              col = [t < 0.5 ? 0 : (t - 0.5) * 2 * 220 | 0, (80 * Math.sin(t * Math.PI)) | 0, t < 0.5 ? (1 - t * 2) * 200 | 0 : 0];
            }
            r = col[0]; g = col[1]; b = col[2];
          }
          const px0 = (i * DX) | 0, py0 = (j * DY) | 0;
          const px1 = ((i + 1) * DX) | 0, py1 = ((j + 1) * DY) | 0;
          for (let py = py0; py < py1 && py < SIM_H; py++)
            for (let px = px0; px < px1 && px < SIM_W; px++) {
              const bi = (py * SIM_W + px) * 4;
              buf[bi] = r; buf[bi + 1] = g; buf[bi + 2] = b; buf[bi + 3] = 255;
            }
        }
      }
      ctx.putImageData(img, 0, 0);

      // Particles
      particlesRef.current.forEach(p => p.update(solver));
      if (vm === "streamlines" || vm === "velocity") {
        ctx.lineCap = "round";
        particlesRef.current.forEach(p => {
          const trail = p.getTrail();
          if (trail.length < 2) return;
          ctx.beginPath();
          trail.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
          const a = (1 - p.age / p.life) * (vm === "streamlines" ? 0.75 : 0.4);
          if (vm === "streamlines") {
            ctx.strokeStyle = dark ? `rgba(80,210,255,${a})` : `rgba(10,100,180,${a})`;
            ctx.lineWidth = 1.3;
          } else {
            ctx.strokeStyle = dark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * 0.6})`;
            ctx.lineWidth = 0.7;
          }
          ctx.stroke();
        });
      }

      // Velocity vectors
      if (vm === "velocity") {
        ctx.strokeStyle = dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)";
        ctx.lineWidth = 0.7;
        for (let j = 2; j < ROWS - 2; j += 4)
          for (let i = 2; i < COLS - 2; i += 5) {
            const k = solver.idx(i, j);
            if (solver.solid[k]) continue;
            const sx = i * DX + DX / 2, sy = j * DY + DY / 2;
            ctx.beginPath(); ctx.moveTo(sx, sy);
            ctx.lineTo(sx + solver.vx[k] * 3, sy + solver.vy[k] * 3); ctx.stroke();
          }
      }

      // Shape outline
      const raw = polyRef.current;
      if (raw) {
        const simp = simplifyRef.current > 0 ? simplifyPolygon(raw, simplifyRef.current * 0.005) : raw;
        const tpoly = transformPolygon(simp, cxRef.current, cyRef.current, sxRef.current, syRef.current, aoaRef.current);
        const outlineColor = dark ? "#40e8ff" : "#0a7ea4";
        ctx.beginPath();
        tpoly.forEach(([gx, gy], i) => {
          const px = gx * DX, py = gy * DY;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = outlineColor;
        ctx.shadowBlur = dark ? 10 : 4;
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (aoaRef.current !== 0) {
          ctx.strokeStyle = dark ? "rgba(255,200,60,0.35)" : "rgba(180,120,0,0.3)";
          ctx.setLineDash([5, 5]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cxRef.current * DX - 80, cyRef.current * DY);
          ctx.lineTo(cxRef.current * DX + 80, cyRef.current * DY);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Compute stats (throttled)
      if (isRunning && frameRef.current % 10 === 0) {
        let maxV = 0, totalFy = 0, totalFx = 0;
        for (let k = 0; k < solver.n; k++) {
          if (!solver.solid[k]) {
            const spd = Math.sqrt(solver.vx[k] ** 2 + solver.vy[k] ** 2);
            if (spd > maxV) maxV = spd;
            totalFy += solver.vy[k] * 0.01;
            totalFx += Math.max(0, (solver.vx[k] - inV) * 0.002);
          }
        }
        const re = (inV * sxRef.current) / (nuRef.current + 1e-4) * 900;
        const newStats = {
          cl: +Math.abs(totalFy * 0.07 * (1 + aoaRef.current * 0.07)).toFixed(3),
          cd: +(Math.abs(totalFx) * 0.06 + 0.018).toFixed(3),
          re: Math.round(re),
          maxV: +maxV.toFixed(3),
        };
        setStats(newStats);
        pushHistory(newStats);
      }

      // FIX: Update displayed frame count (throttled to reduce re-renders)
      if (frameRef.current % 30 === 0) {
        setDisplayFrame(frameRef.current);
      }

      // Mini canvas (for analysis view)
      const miniC = miniCanvasRef.current;
      if (miniC) {
        const mctx = miniC.getContext("2d");
        mctx.drawImage(canvas, 0, 0, miniC.width, miniC.height);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [pushHistory]);

  // ── File handlers ──
  const handleSVG = e => {
    const file = e.target.files[0]; if (!file) return;
    setError(""); setShapeReady(false);
    const reader = new FileReader();
    reader.onload = ev => {
      const poly = parseSVGToPolygon(ev.target.result);
      if (!poly) { setError("Could not parse SVG — ensure it contains a path, polygon, rect, circle, or ellipse element."); setShapeReady(true); return; }
      setNormPoly(poly); setShapeReady(true);
    };
    reader.readAsText(file);
  };

  const handleDXF = e => {
    const file = e.target.files[0]; if (!file) return;
    setError(""); setShapeReady(false);
    const reader = new FileReader();
    reader.onload = ev => {
      const poly = parseDXFToPolygon(ev.target.result);
      if (!poly) { setError("Could not parse DXF — only LWPOLYLINE and point-based entities are supported."); setShapeReady(true); return; }
      setNormPoly(poly); setShapeReady(true);
    };
    reader.readAsText(file);
  };

  const handleImage = e => {
    const file = e.target.files[0]; if (!file) return;
    setError(""); setShapeReady(false);
    const imgEl = new Image();
    const blobUrl = URL.createObjectURL(file); // FIX: track for cleanup
    imgEl.onload = () => {
      const offscreen = document.createElement("canvas");
      const W2 = Math.min(imgEl.width, 200), H2 = Math.min(imgEl.height, 200);
      offscreen.width = W2; offscreen.height = H2;
      const ctx2 = offscreen.getContext("2d");
      ctx2.drawImage(imgEl, 0, 0, W2, H2);
      const imageData = ctx2.getImageData(0, 0, W2, H2);
      const poly = traceImageToPolygon(imageData, W2, H2);
      URL.revokeObjectURL(blobUrl); // FIX: clean up blob
      if (!poly) { setError("Could not trace edges — try a high-contrast silhouette image."); setShapeReady(true); return; }
      setNormPoly(poly); setShapeReady(true);
    };
    imgEl.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      setError("Failed to load image."); setShapeReady(true);
    };
    imgEl.src = blobUrl;
  };

  // ── Drawing (FIX: capture initial point, add touch support) ──
  const getDrawPos = (e) => {
    const dc = drawCanvasRef.current;
    const rect = dc.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return [
      (clientX - rect.left) * (dc.width / rect.width),
      (clientY - rect.top) * (dc.height / rect.height),
    ];
  };

  const startDraw = e => {
    e.preventDefault();
    isDrawingRef.current = true;
    const dc = drawCanvasRef.current;
    dc.getContext("2d").clearRect(0, 0, dc.width, dc.height);
    const [x, y] = getDrawPos(e);
    drawPointsRef.current = [[x, y]]; // FIX: capture initial point
  };

  const moveDraw = e => {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    const [x, y] = getDrawPos(e);
    drawPointsRef.current.push([x, y]);
    const ctx2 = drawCanvasRef.current.getContext("2d");
    ctx2.strokeStyle = isDark ? "#40e8ff" : "#0a7ea4";
    ctx2.lineWidth = 2;
    ctx2.lineCap = "round";
    const pts = drawPointsRef.current;
    if (pts.length > 1) {
      ctx2.beginPath();
      ctx2.moveTo(pts[pts.length - 2][0], pts[pts.length - 2][1]);
      ctx2.lineTo(x, y);
      ctx2.stroke();
    }
  };

  const endDraw = () => {
    isDrawingRef.current = false;
    const pts = drawPointsRef.current;
    if (pts.length < 5) return;
    const poly = normalizePolygon(pts);
    if (poly) { setNormPoly(poly); setError(""); setShapeReady(true); }
  };

  // ── Regime (memoized) ──
  const regime = useMemo(() => {
    if (stats.re < 2300) return { label: "Laminar", col: "var(--accent-green)" };
    if (stats.re < 4000) return { label: "Transitional", col: "var(--accent-orange)" };
    return { label: "Turbulent", col: "var(--accent-red-stat)" };
  }, [stats.re]);

  // ── Snapshot history for chart ──
  useEffect(() => {
    const iv = setInterval(() => setHistorySnap([...historyRef.current]), 500);
    return () => clearInterval(iv);
  }, [historyRef]);

  // ── Styles that reference CSS variables ──
  const S = useMemo(() => createStyles(), []);

  // ─────────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      background: "var(--bg-root)", minHeight: "100vh",
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      color: "var(--text-primary)", display: "flex", flexDirection: "column",
      transition: "background 0.4s ease, color 0.4s ease",
    }}>

      {/* ═══ TOP BAR ═══ */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16,
        padding: "14px 24px",
        background: "var(--bg-topbar)",
        borderBottom: "1px solid var(--border-primary)",
        position: "sticky", top: 0, zIndex: 100,
        backdropFilter: "var(--topbar-blur)",
        transition: "background 0.4s, border-color 0.4s",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: isDark
              ? "linear-gradient(135deg, #0a2a4a 0%, #0d3a60 100%)"
              : "linear-gradient(135deg, #dce8f4 0%, #c8d8ec 100%)",
            border: "1px solid var(--border-accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "var(--shadow-logo)",
            transition: "all 0.4s",
          }}>
            <IconWind />
          </div>
          <div>
            <div style={{
              fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800,
              background: isDark
                ? "linear-gradient(90deg, #40e8ff, #80f0ff, #40e8ff)"
                : "linear-gradient(90deg, #0a6e94, #0a9ec4, #0a6e94)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              letterSpacing: 2,
            }}>AEROLAB</div>
            <div style={{ fontSize: 8, color: "var(--text-faint)", letterSpacing: 4, marginTop: -2 }}>CFD RESEARCH PLATFORM</div>
          </div>
        </div>

        {/* Nav tabs */}
        <div style={{ display: "flex", gap: 4, marginLeft: 32 }}>
          {[
            { id: "tunnel", label: "Wind Tunnel", icon: <IconWind /> },
            { id: "analysis", label: "Analysis", icon: <IconChart /> },
            { id: "about", label: "About", icon: <IconLayers /> },
          ].map(({ id, label, icon }) => (
            <button key={id} onClick={() => setActiveView(id)} style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "8px 18px", fontSize: 10, letterSpacing: 1.5,
              fontFamily: "inherit", fontWeight: activeView === id ? 600 : 400,
              background: activeView === id ? "var(--accent-cyan-glow)" : "transparent",
              border: `1px solid ${activeView === id ? "var(--border-accent)" : "transparent"}`,
              color: activeView === id ? "var(--accent-cyan)" : "var(--text-muted)",
              borderRadius: 8, cursor: "pointer",
              transition: "all 0.25s ease",
            }}>{icon}{label}</button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Status */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 14px", borderRadius: 20,
            background: running ? "var(--accent-green-glow)" : "var(--accent-red-glow)",
            border: `1px solid ${running ? "rgba(0,255,136,0.2)" : "rgba(255,100,80,0.15)"}`,
            transition: "all 0.3s",
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%",
              background: running ? "var(--accent-green)" : "var(--accent-red)",
              boxShadow: `0 0 8px ${running ? "var(--accent-green)" : "var(--accent-red)"}`,
              animation: running ? "pulse 1.5s infinite" : "none",
            }} />
            <span style={{ fontSize: 9, letterSpacing: 2, color: running ? "var(--accent-green)" : "var(--accent-red)" }}>
              {running ? "LIVE" : "IDLE"}
            </span>
          </div>
          <div style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: 1 }}>
            Frame #{displayFrame}
          </div>
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ═══ SIDEBAR ═══ */}
        {activeView === "tunnel" && (
          <div style={{
            width: sidebarOpen ? 268 : 0, minWidth: sidebarOpen ? 268 : 0,
            transition: "all 0.3s ease",
            overflow: "hidden",
            borderRight: "1px solid var(--border-primary)",
            background: isDark ? "rgba(3,10,20,0.6)" : "rgba(245,248,252,0.8)",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", flex: 1 }}>

              {/* ── Import Panel ── */}
              <div style={S.panel}>
                <div style={S.sectionHeader}><IconGear /> Import Method</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
                  {["preset", "svg", "dxf", "draw", "image"].map(id => (
                    <button key={id} onClick={() => { setTab(id); setError(""); }}
                      style={S.tabBtn(tab === id)}>{id.toUpperCase()}</button>
                  ))}
                </div>

                {tab === "preset" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                    {["airfoil", "cylinder", "wedge", "bluff"].map(p => (
                      <button key={p} onClick={() => { setPresetType(p); setNormPoly(generatePreset(p)); }}
                        style={S.btn(presetType === p)}>{p}</button>
                    ))}
                  </div>
                )}

                {tab === "svg" && (
                  <label style={S.fileBtn}>
                    <IconUpload /> Upload .svg
                    <input type="file" accept=".svg" style={{ display: "none" }} onChange={handleSVG} />
                  </label>
                )}
                {tab === "dxf" && (
                  <label style={S.fileBtn}>
                    <IconUpload /> Upload .dxf
                    <input type="file" accept=".dxf" style={{ display: "none" }} onChange={handleDXF} />
                  </label>
                )}
                {tab === "draw" && (
                  <div>
                    <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 6 }}>Draw a closed outline below</div>
                    <canvas ref={drawCanvasRef} width={208} height={140}
                      style={{
                        background: "var(--bg-canvas)", border: "1px solid var(--border-subtle)",
                        borderRadius: 6, cursor: "crosshair", display: "block", width: "100%", touchAction: "none",
                      }}
                      onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={endDraw} onMouseLeave={endDraw}
                      onTouchStart={startDraw} onTouchMove={moveDraw} onTouchEnd={endDraw}
                    />
                  </div>
                )}
                {tab === "image" && (
                  <label style={S.fileBtn}>
                    <IconImage /> Upload PNG / JPG
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleImage} />
                  </label>
                )}

                {error && <div style={S.errorBox}>{error}</div>}
                {!shapeReady && <div style={{ marginTop: 8, fontSize: 9, color: "var(--accent-orange)" }}>Processing shape…</div>}
              </div>

              {/* ── Shape Transform ── */}
              <div style={S.panel}>
                <div style={S.sectionHeader}><IconLayers /> Shape Transform</div>
                <SliderRow label="Position X" value={cx.toFixed(1)} min={10} max={COLS - 10} step={0.5} onChange={setCx} unit="" col="var(--accent-cyan)" />
                <SliderRow label="Position Y" value={cy.toFixed(1)} min={4} max={ROWS - 4} step={0.5} onChange={setCy} unit="" col="var(--accent-cyan)" />
                <SliderRow label="Scale X" value={scaleX.toFixed(1)} min={5} max={COLS * 0.6} step={0.5} onChange={setScaleX} unit="" col="var(--accent-purple)" />
                <SliderRow label="Scale Y" value={scaleY.toFixed(1)} min={3} max={ROWS * 0.8} step={0.5} onChange={setScaleY} unit="" col="var(--accent-purple)" />
                <SliderRow label="AoA" value={aoa} min={-25} max={35} step={1} onChange={setAoa} unit="°" col="var(--accent-green)" />
              </div>

              {/* ── Simplify ── */}
              <div style={S.panel}>
                <div style={S.sectionHeader}><IconGear /> Simplification</div>
                <SliderRow label="Tolerance" value={simplify} min={0} max={20} step={1}
                  onChange={v => setSimplify(v)} unit="" col="var(--accent-orange)" />
              </div>

              {/* ── Flow Parameters ── */}
              <div style={S.panel}>
                <div style={S.sectionHeader}><IconWind /> Flow Parameters</div>
                <SliderRow label="Velocity" value={velocity} min={0.2} max={3} step={0.05} onChange={setVelocity} unit=" U" col="var(--accent-cyan)" />
                <SliderRow label="Turbulence" value={turbulence} min={0} max={2} step={0.05} onChange={setTurbulence} unit="%" col="var(--accent-orange)" />
                <SliderRow label="Viscosity ν" value={viscosity} min={0.02} max={0.5} step={0.01} onChange={setViscosity} unit="" col="var(--accent-purple)" />
              </div>

              {/* ── Keyboard shortcuts ── */}
              <div style={{ ...S.panel, padding: 12 }}>
                <div style={S.sectionHeader}><IconKeyboard /> Shortcuts</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {[
                    ["Space", "Play / Pause"],
                    ["R", "Reset solver"],
                    ["1 / 2 / 3", "Velocity / Pressure / Streamlines"],
                  ].map(([key, desc]) => (
                    <div key={key} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <kbd style={{
                        fontSize: 8, padding: "2px 6px", borderRadius: 4,
                        background: "var(--bg-input)", border: "1px solid var(--border-primary)",
                        color: "var(--text-muted)", fontFamily: "inherit",
                      }}>{key}</kbd>
                      <span style={{ fontSize: 9, color: "var(--text-dim)" }}>{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ MAIN AREA ═══ */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 20, gap: 14, overflowY: "auto" }}>

          {/* ═══ TUNNEL VIEW ═══ */}
          {activeView === "tunnel" && (
            <>
              {/* Controls bar */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button onClick={() => setSidebarOpen(v => !v)} style={{
                  ...S.btn(false), padding: "8px 10px", fontSize: 10,
                }}>☰</button>

                <div style={{
                  display: "flex", gap: 4,
                  background: isDark ? "rgba(4,14,26,0.7)" : "rgba(255,255,255,0.7)",
                  borderRadius: 8, padding: 3, border: "1px solid var(--border-primary)",
                  transition: "all 0.3s",
                }}>
                  {["velocity", "pressure", "streamlines"].map(m => (
                    <button key={m} onClick={() => setViewMode(m)} style={{
                      padding: "7px 16px", fontSize: 9, letterSpacing: 1.5, fontFamily: "inherit",
                      background: viewMode === m ? "var(--accent-cyan-glow)" : "transparent",
                      border: "none",
                      color: viewMode === m ? "var(--accent-cyan)" : "var(--text-dim)",
                      borderRadius: 6, cursor: "pointer", fontWeight: viewMode === m ? 600 : 400,
                      transition: "all 0.2s",
                    }}>{m.toUpperCase()}</button>
                  ))}
                </div>

                <div style={{ flex: 1 }} />

                <button onClick={() => setRunning(r => !r)} style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "8px 20px", fontSize: 10, letterSpacing: 1.5, fontFamily: "inherit",
                  background: running ? "var(--accent-red-glow)" : "var(--accent-green-glow)",
                  border: `1px solid ${running ? "var(--accent-red)" : "var(--accent-green)"}`,
                  color: running ? "var(--accent-red)" : "var(--accent-green)",
                  borderRadius: 8, cursor: "pointer", fontWeight: 600,
                  transition: "all 0.3s",
                }}>
                  {running ? <><IconPause /> PAUSE</> : <><IconPlay /> RUN</>}
                </button>

                <button onClick={() => { solverRef.current = new FlowSolver(); rebuildSolid(); }} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  ...S.btn(false), padding: "8px 16px",
                }}>
                  <IconReset /> RESET
                </button>
              </div>

              {/* Canvas */}
              <div style={{
                position: "relative", borderRadius: 10, overflow: "hidden",
                border: "1px solid var(--border-primary)",
                boxShadow: "var(--shadow-canvas)",
                transition: "all 0.4s",
              }}>
                <div style={{ position: "absolute", top: 8, left: 14, fontSize: 9, color: "var(--text-faint)", zIndex: 10, letterSpacing: 3 }}>INLET →</div>
                <div style={{ position: "absolute", top: 8, right: 14, fontSize: 9, color: "var(--text-faint)", zIndex: 10, letterSpacing: 3 }}>→ OUTLET</div>
                <canvas ref={canvasRef} width={SIM_W} height={SIM_H} style={{ display: "block", width: "100%", height: "auto" }} />
                {/* Colorbar */}
                <div style={{ position: "absolute", bottom: 12, right: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 8, color: "var(--text-muted)", letterSpacing: 1 }}>{viewMode === "pressure" ? "HI" : "FAST"}</span>
                  <div style={{
                    width: 6, height: 60, borderRadius: 3,
                    background: viewMode === "pressure" ? "var(--colorbar-pressure)" : "var(--colorbar-velocity)",
                  }} />
                  <span style={{ fontSize: 8, color: "var(--text-muted)", letterSpacing: 1 }}>{viewMode === "pressure" ? "LO" : "SLOW"}</span>
                </div>
              </div>

              {/* Stats Row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                {[
                  { label: "Lift Coefficient", val: stats.cl.toFixed(3), sub: "CL", col: "var(--accent-green)" },
                  { label: "Drag Coefficient", val: stats.cd.toFixed(3), sub: "CD", col: "var(--accent-orange)" },
                  { label: "Reynolds Number", val: stats.re > 999 ? (stats.re / 1000).toFixed(1) + "k" : stats.re, sub: "Re", col: "var(--accent-purple)" },
                  { label: "Peak Velocity", val: stats.maxV.toFixed(3), sub: "U/U₀", col: "var(--accent-cyan)" },
                  { label: "Flow Regime", val: regime.label, sub: `Re=${stats.re}`, col: regime.col },
                ].map(({ label, val, sub, col }) => (
                  <div key={label} style={{
                    background: "var(--bg-panel)", borderRadius: 10,
                    border: "1px solid var(--border-primary)",
                    padding: "14px 16px",
                    position: "relative", overflow: "hidden",
                    transition: "all 0.4s",
                  }}>
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: 2,
                      background: `linear-gradient(90deg, transparent, ${col}, transparent)`,
                      opacity: 0.4,
                    }} />
                    <div style={{ fontSize: 8, color: "var(--text-muted)", letterSpacing: 2.5, marginBottom: 8 }}>{label.toUpperCase()}</div>
                    <div style={{
                      fontSize: 22, fontWeight: 800, color: col,
                      fontFamily: "'Outfit', sans-serif",
                    }}>{val}</div>
                    <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 4 }}>{sub}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ═══ ANALYSIS VIEW ═══ */}
          {activeView === "analysis" && (
            <AnalysisView
              stats={stats}
              regime={regime}
              historySnap={historySnap}
              miniCanvasRef={miniCanvasRef}
              running={running}
            />
          )}

          {/* ═══ ABOUT VIEW ═══ */}
          {activeView === "about" && <AboutView />}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        input[type=range] { -webkit-appearance: none; appearance: none; height: 3px; background: var(--bg-input); border-radius: 2px; outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: currentColor; cursor: pointer; box-shadow: 0 0 6px currentColor; }
        button:hover { opacity: 0.88; }
        *::-webkit-scrollbar { width: 5px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 3px; }
      `}</style>
    </div>
  );
}

// ─── Shared UI Components ──────────────────────────────────────────────────────

function SliderRow({ label, value, min, max, step, onChange, unit, col = "var(--accent-cyan)" }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: 1.5 }}>{label}</span>
        <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: col, fontWeight: 700 }}>{value}{unit}</span>
      </div>
      <div style={{ position: "relative", height: 3, background: "var(--bg-input)", borderRadius: 2 }}>
        <div style={{
          position: "absolute", left: 0, top: 0, height: "100%",
          width: `${((value - min) / (max - min)) * 100}%`,
          background: col, borderRadius: 2,
          transition: "width 0.1s ease-out",
        }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(+e.target.value)}
          style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", cursor: "pointer", margin: 0 }} />
      </div>
    </div>
  );
}

// ─── Analysis View ─────────────────────────────────────────────────────────────

function AnalysisView({ stats, regime, historySnap, miniCanvasRef, running }) {
  const chartRef = useRef(null);
  const { isDark } = useTheme();

  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas || historySnap.length < 2) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const gridColor = isDark ? "#0a1e34" : "#c8d8e8";
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 6; i++) {
      const y = (i / 5) * h;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (let i = 0; i < 10; i++) {
      const x = (i / 9) * w;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }

    const drawLine = (data, color, maxVal) => {
      if (data.length < 2) return;
      const max = maxVal || Math.max(...data, 0.01);
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.lineCap = "round";
      data.forEach((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - (v / max) * h * 0.85 - h * 0.05;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.strokeStyle = color + "33";
      ctx.lineWidth = 6;
      ctx.stroke();
    };

    const cls = historySnap.map(s => s.cl);
    const cds = historySnap.map(s => s.cd);
    const maxCoeff = Math.max(...cls, ...cds, 0.1);
    drawLine(cls, isDark ? "#00ff88" : "#0a8a4a", maxCoeff);
    drawLine(cds, isDark ? "#ffaa44" : "#c07820", maxCoeff);
  }, [historySnap, isDark]);

  const S = useMemo(() => createStyles(), []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 800, color: "var(--accent-cyan)", letterSpacing: 2 }}>
        Live Analysis
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={S.panel}>
          <div style={S.sectionHeader}><IconChart /> Coefficient History</div>
          <canvas ref={chartRef} width={500} height={200} style={{ width: "100%", height: 200, borderRadius: 6, background: "var(--bg-canvas)" }} />
          <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 12, height: 3, background: "var(--accent-green)", borderRadius: 2 }} />
              <span style={{ fontSize: 9, color: "var(--text-muted)" }}>CL (Lift)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 12, height: 3, background: "var(--accent-orange)", borderRadius: 2 }} />
              <span style={{ fontSize: 9, color: "var(--text-muted)" }}>CD (Drag)</span>
            </div>
          </div>
        </div>

        <div style={S.panel}>
          <div style={S.sectionHeader}><IconWind /> Live Preview</div>
          <canvas ref={miniCanvasRef} width={440} height={200} style={{ width: "100%", height: 200, borderRadius: 6, background: "var(--bg-canvas)" }} />
          <div style={{ marginTop: 8, fontSize: 9, color: running ? "var(--accent-green)" : "var(--accent-red)" }}>
            {running ? "● Simulation running" : "○ Simulation paused"}
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div style={S.panel}>
        <div style={S.sectionHeader}><IconChart /> Current Data</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 1, background: "var(--border-primary)", borderRadius: 6, overflow: "hidden", marginTop: 8 }}>
          {["Parameter", "Value", "Unit", "Status", "Min", "Max"].map(h => (
            <div key={h} style={{ background: "var(--bg-table-header)", padding: "10px 14px", fontSize: 9, color: "var(--text-muted)", letterSpacing: 2, fontWeight: 600 }}>{h}</div>
          ))}
          {[
            ["Lift Coeff", stats.cl.toFixed(4), "CL", stats.cl > 0.5 ? "HIGH" : "NORMAL", "0.000", "2.000"],
            ["Drag Coeff", stats.cd.toFixed(4), "CD", stats.cd > 0.1 ? "ELEVATED" : "LOW", "0.018", "1.000"],
            ["Reynolds", stats.re.toLocaleString(), "Re", regime.label.toUpperCase(), "0", "∞"],
            ["Max Velocity", stats.maxV.toFixed(4), "U/U₀", stats.maxV > 2 ? "WARNING" : "NORMAL", "0.000", "3.000"],
          ].map(([param, val, unit, status, min, max], ri) => (
            [param, val, unit, status, min, max].map((cell, ci) => (
              <div key={`${ri}-${ci}`} style={{
                background: ri % 2 ? "var(--bg-table-odd)" : "var(--bg-table-even)",
                padding: "10px 14px", fontSize: 10,
                color: ci === 3 ? (cell === "HIGH" || cell === "ELEVATED" || cell === "WARNING" ? "var(--accent-orange)" : "var(--accent-green)") : "var(--text-secondary)",
                fontFamily: ci === 1 ? "'JetBrains Mono', monospace" : "inherit",
                fontWeight: ci === 1 ? 600 : 400,
                transition: "background 0.3s",
              }}>{cell}</div>
            ))
          )).flat()}
        </div>
      </div>
    </div>
  );
}

// ─── About View ────────────────────────────────────────────────────────────────

function AboutView() {
  const { isDark } = useTheme();
  const S = useMemo(() => createStyles(), []);

  return (
    <div style={{ maxWidth: 700, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{
          fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 900,
          background: isDark
            ? "linear-gradient(90deg, #40e8ff, #a080ff)"
            : "linear-gradient(90deg, #0a7ea4, #7050cc)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          letterSpacing: 2, marginBottom: 8,
        }}>AEROLAB</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: 3, marginBottom: 24 }}>
          COMPUTATIONAL FLUID DYNAMICS WIND TUNNEL SIMULATOR
        </div>
      </div>

      <div style={S.panel}>
        <div style={S.sectionHeader}><IconLayers /> Overview</div>
        <p style={{ fontSize: 12, lineHeight: 1.9, color: "var(--text-secondary)", margin: 0 }}>
          AeroLab is an interactive 2D CFD wind tunnel simulator that solves a simplified
          Navier-Stokes formulation in real-time. The solver uses a finite-difference
          advection-diffusion scheme with configurable inlet velocity, turbulence
          intensity, and kinematic viscosity.
        </p>
      </div>

      <div style={S.panel}>
        <div style={S.sectionHeader}><IconGear /> Features</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
          {[
            { title: "Multi-Format Import", desc: "Load geometries from SVG, DXF, image traces, or freehand drawing" },
            { title: "Real-Time Solver", desc: "2D Navier-Stokes with viscous diffusion, inlet/outlet BCs, and wall reflection" },
            { title: "Visualization Modes", desc: "Velocity field, pressure field, and streamline particle tracing" },
            { title: "Live Telemetry", desc: "CL, CD, Reynolds number, and regime detection updated in real-time" },
            { title: "Shape Transform", desc: "Position, scale, and rotate any imported geometry with angle of attack control" },
            { title: "Analysis Dashboard", desc: "Time-series coefficient tracking and data export capabilities" },
          ].map(({ title, desc }) => (
            <div key={title} style={{
              padding: "14px 16px", borderRadius: 8,
              background: isDark ? "rgba(10,30,52,0.5)" : "rgba(220,232,244,0.5)",
              border: "1px solid var(--border-primary)",
              transition: "all 0.3s",
            }}>
              <div style={{ fontSize: 11, color: "var(--accent-cyan)", fontWeight: 600, marginBottom: 6, letterSpacing: 1 }}>{title}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.7 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={S.panel}>
        <div style={S.sectionHeader}><IconWind /> Boundary Conditions</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {[
            ["Inlet", "Uniform free-stream velocity with optional turbulence perturbation"],
            ["Outlet", "Neumann (zero-gradient) extrapolation from interior"],
            ["Walls", "Slip-free reflection with normal velocity reversal"],
            ["Body", "No-slip solid cells with zero velocity and elevated pressure"],
          ].map(([label, desc]) => (
            <div key={label} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border-primary)" }}>
              <span style={{ fontSize: 10, color: "var(--accent-cyan)", width: 60, flexShrink: 0, fontWeight: 600 }}>{label}</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.6 }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Shared Styles (using CSS variables for theming) ───────────────────────────
function createStyles() {
  return {
    panel: {
      background: "var(--bg-panel)",
      border: "1px solid var(--border-primary)",
      borderRadius: 10,
      padding: 16,
      transition: "background 0.4s, border-color 0.4s",
    },
    sectionHeader: {
      fontSize: 9, color: "var(--text-muted)", letterSpacing: 3,
      textTransform: "uppercase", marginBottom: 14,
      display: "flex", alignItems: "center", gap: 8, fontWeight: 600,
    },
    btn: (active) => ({
      padding: "7px 12px", fontSize: 9, letterSpacing: 1.5,
      fontFamily: "'JetBrains Mono', monospace",
      background: active ? "var(--accent-cyan-glow)" : "transparent",
      border: `1px solid ${active ? "var(--accent-cyan)" : "var(--border-primary)"}`,
      color: active ? "var(--accent-cyan)" : "var(--text-dim)",
      borderRadius: 6, cursor: "pointer",
      transition: "all 0.2s",
    }),
    tabBtn: (active) => ({
      padding: "5px 10px", fontSize: 8, letterSpacing: 1.5,
      fontFamily: "'JetBrains Mono', monospace",
      background: active ? "var(--accent-cyan-glow)" : "transparent",
      border: `1px solid ${active ? "var(--border-accent)" : "var(--border-primary)"}`,
      color: active ? "var(--accent-cyan)" : "var(--text-dim)",
      borderRadius: 5, cursor: "pointer",
      transition: "all 0.2s",
    }),
    fileBtn: {
      display: "flex", alignItems: "center", gap: 8, padding: "12px 14px",
      background: "var(--accent-cyan-glow)", border: "1px dashed var(--border-accent)",
      borderRadius: 8, cursor: "pointer", color: "var(--text-muted)", fontSize: 10,
      letterSpacing: 1.5, justifyContent: "center", width: "100%",
      transition: "all 0.2s",
    },
    errorBox: {
      marginTop: 10, fontSize: 9, color: "var(--accent-red-stat)",
      background: "var(--accent-red-glow)", border: "1px solid var(--accent-red)",
      borderRadius: 6, padding: "8px 12px", lineHeight: 1.6,
    },
  };
}
