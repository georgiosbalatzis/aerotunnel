/* ═══════════════════════════════════════════════════════════
   AEROLAB · Solver Wrapper (WASM + JS fallback)
   Feature-detects WebAssembly, uses Rust LBM when available.
   Zero-copy rendering via Float32Array views over WASM memory.
   ═══════════════════════════════════════════════════════════ */

import { LBM as JsLBM } from "./solver.js";

let wasmExports = null;
let wasmMemory  = null;
let WasmLBMInner = null;

/**
 * Initialise the WASM solver module (call once at startup).
 * Returns true if WASM loaded, false for JS fallback.
 */
export async function initWasmSolver() {
  if (wasmExports) return true;
  if (typeof WebAssembly === "undefined") return false;

  try {
    const pkg = await import("./solver-wasm-pkg/aerolab_lbm.js");
    wasmExports = await pkg.default();
    wasmMemory  = wasmExports.memory;
    WasmLBMInner = pkg.LBM;
    console.log("[AeroLab] WASM solver loaded");
    return true;
  } catch (e) {
    console.warn("[AeroLab] WASM solver unavailable, using JS fallback:", e.message);
    return false;
  }
}

/* ── WASM-backed LBM with identical API to the JS solver ── */
class WasmLBM {
  constructor(cols, rows) {
    this._inner = new WasmLBMInner(cols, rows);
    this.C = cols;
    this.R = rows;
    this.N = cols * rows;
    this._buf = null;
    this._refreshViews();
  }

  /** Re-create typed-array views when WASM memory grows. */
  _refreshViews() {
    const buf = wasmMemory.buffer;
    if (this._buf === buf) return;
    const n = this.N;
    this.rho   = new Float32Array(buf, this._inner.get_rho_ptr(),  n);
    this.ux    = new Float32Array(buf, this._inner.get_ux_ptr(),   n);
    this.uy    = new Float32Array(buf, this._inner.get_uy_ptr(),   n);
    this.spd   = new Float32Array(buf, this._inner.get_spd_ptr(),  n);
    this.curl  = new Float32Array(buf, this._inner.get_curl_ptr(), n);
    this.solid = new Uint8Array(buf,   this._inner.get_solid_ptr(), n);
    this._buf  = buf;
  }

  setNu(nu) { this._inner.set_nu(nu); }

  buildSolid(poly) {
    if (!poly || poly.length < 3) {
      this._inner.build_solid(new Float32Array(0), 0);
    } else {
      const flat = new Float32Array(poly.length * 2);
      for (let i = 0; i < poly.length; i++) {
        flat[i * 2]     = poly[i][0];
        flat[i * 2 + 1] = poly[i][1];
      }
      this._inner.build_solid(flat, flat.length);
    }
    this._buf = null;          // force view refresh (malloc may have grown memory)
    this._refreshViews();
  }

  step(inU, turb) {
    this._inner.step(inU, turb);
    this._refreshViews();      // views valid unless memory grew
  }

  /* ── Scalar getters — match JS solver property names ── */
  get diverged()         { return this._inner.get_diverged(); }
  set diverged(v)        { if (!v) this._inner.clear_diverged(); }
  get overflowCount()    { return this._inner.get_overflow_count(); }
  get convergenceDelta() { return this._inner.get_convergence_delta(); }
  get spdMin()           { return this._inner.get_spd_min(); }
  get spdMax()           { return this._inner.get_spd_max(); }
  get rhoMin()           { return this._inner.get_rho_min(); }
  get rhoMax()           { return this._inner.get_rho_max(); }
  get curlMin()          { return this._inner.get_curl_min(); }
  get curlMax()          { return this._inner.get_curl_max(); }
}

/**
 * Create a solver instance.  Uses WASM if initWasmSolver() succeeded.
 */
export function createSolver(cols, rows) {
  if (wasmExports) return new WasmLBM(cols, rows);
  return new JsLBM(cols, rows);
}

export function isWasmAvailable() {
  return wasmExports !== null;
}
