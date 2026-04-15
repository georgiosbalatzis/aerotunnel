// ═══════════════════════════════════════════════════════════
// AEROLAB · Lattice Boltzmann D2Q9 Solver (WebAssembly)
// BGK collision, Zou-He inlet, bounce-back walls
// 1:1 port of solver.js
// ═══════════════════════════════════════════════════════════

use wasm_bindgen::prelude::*;

// D2Q9 lattice constants
const CX: [i32; 9] = [0, 1, 0, -1, 0, 1, -1, -1, 1];
const CY: [i32; 9] = [0, 0, 1, 0, -1, 1, 1, -1, -1];
const WT: [f32; 9] = [
    4.0 / 9.0,
    1.0 / 9.0, 1.0 / 9.0, 1.0 / 9.0, 1.0 / 9.0,
    1.0 / 36.0, 1.0 / 36.0, 1.0 / 36.0, 1.0 / 36.0,
];
const OPP: [usize; 9] = [0, 3, 4, 1, 2, 7, 8, 5, 6];
const MAX_U: f32 = 0.25;

#[wasm_bindgen]
pub struct LBM {
    cols: usize,
    rows: usize,
    n: usize,
    f0: Vec<f32>,
    f1: Vec<f32>,
    rho: Vec<f32>,
    ux: Vec<f32>,
    uy: Vec<f32>,
    solid: Vec<u8>,
    spd: Vec<f32>,
    curl: Vec<f32>,
    prev_ux: Vec<f32>,
    prev_uy: Vec<f32>,
    omega: f32,
    diverged: bool,
    overflow_count: u32,
    convergence_delta: f32,
    spd_min: f32,
    spd_max: f32,
    rho_min: f32,
    rho_max: f32,
    curl_min: f32,
    curl_max: f32,
}

#[wasm_bindgen]
impl LBM {
    #[wasm_bindgen(constructor)]
    pub fn new(cols: usize, rows: usize) -> LBM {
        let n = cols * rows;
        let mut solver = LBM {
            cols,
            rows,
            n,
            f0: vec![0.0; 9 * n],
            f1: vec![0.0; 9 * n],
            rho: vec![1.0; n],
            ux: vec![0.0; n],
            uy: vec![0.0; n],
            solid: vec![0; n],
            spd: vec![0.0; n],
            curl: vec![0.0; n],
            prev_ux: vec![0.0; n],
            prev_uy: vec![0.0; n],
            omega: 1.85,
            diverged: false,
            overflow_count: 0,
            convergence_delta: 1.0,
            spd_min: 0.0,
            spd_max: 0.0,
            rho_min: 1.0,
            rho_max: 1.0,
            curl_min: 0.0,
            curl_max: 0.0,
        };
        solver.init(0.12);
        solver
    }

    fn init(&mut self, u0: f32) {
        let usq = u0 * u0;
        for k in 0..self.n {
            self.rho[k] = 1.0;
            self.ux[k] = u0;
            self.uy[k] = 0.0;
            let b = k * 9;
            for d in 0..9 {
                let cu = CX[d] as f32 * u0;
                self.f0[b + d] = WT[d] * (1.0 + 3.0 * cu + 4.5 * cu * cu - 1.5 * usq);
            }
        }
    }

    pub fn set_nu(&mut self, nu: f32) {
        self.omega = (1.0 / (3.0 * nu + 0.5)).clamp(0.5, 1.95);
    }

    pub fn build_solid(&mut self, poly: &[f32], poly_len: usize) {
        self.solid.fill(0);
        if poly_len < 6 { return; } // need at least 3 points (x,y pairs)
        let npts = poly_len / 2;
        for j in 0..self.rows {
            for i in 0..self.cols {
                let px = i as f32 + 0.5;
                let py = j as f32 + 0.5;
                if pip(px, py, poly, npts) {
                    self.solid[j * self.cols + i] = 1;
                }
            }
        }
    }

    pub fn step(&mut self, in_u: f32, turb: f32) {
        let (c, r, n) = (self.cols, self.rows, self.n);

        // Streaming
        for j in 0..r {
            for i in 0..c {
                let k = j * c + i;
                let dst = k * 9;
                for d in 0..9 {
                    let si = i as i32 - CX[d];
                    let sj = j as i32 - CY[d];
                    self.f1[dst + d] = if si >= 0 && si < c as i32 && sj >= 0 && sj < r as i32 {
                        self.f0[(sj as usize * c + si as usize) * 9 + d]
                    } else {
                        self.f0[k * 9 + OPP[d]]
                    };
                }
            }
        }

        // Bounce-back on solids
        for k in 0..n {
            if self.solid[k] == 0 { continue; }
            let b = k * 9;
            let (t1, t2, t3, t4) = (self.f1[b+1], self.f1[b+2], self.f1[b+3], self.f1[b+4]);
            let (t5, t6, t7, t8) = (self.f1[b+5], self.f1[b+6], self.f1[b+7], self.f1[b+8]);
            self.f1[b+1] = t3; self.f1[b+3] = t1;
            self.f1[b+2] = t4; self.f1[b+4] = t2;
            self.f1[b+5] = t7; self.f1[b+7] = t5;
            self.f1[b+6] = t8; self.f1[b+8] = t6;
        }

        // Macroscopic quantities
        let mut overflow: u32 = 0;
        let (mut spd_mn, mut spd_mx) = (f32::MAX, f32::MIN);
        let (mut rho_mn, mut rho_mx) = (f32::MAX, f32::MIN);

        for k in 0..n {
            if self.solid[k] != 0 {
                self.ux[k] = 0.0; self.uy[k] = 0.0;
                self.rho[k] = 1.0; self.spd[k] = 0.0;
                continue;
            }
            let b = k * 9;
            let (mut rr, mut vx, mut vy) = (0.0f32, 0.0f32, 0.0f32);
            for d in 0..9 {
                let fv = self.f1[b + d];
                rr += fv;
                vx += CX[d] as f32 * fv;
                vy += CY[d] as f32 * fv;
            }
            if rr.is_nan() || vx.is_nan() || vy.is_nan() || !rr.is_finite() {
                self.diverged = true;
                self.rho[k] = 1.0; self.ux[k] = 0.0; self.uy[k] = 0.0; self.spd[k] = 0.0;
                continue;
            }
            if rr < 0.01 { rr = 1.0; }
            let mut uvx = vx / rr;
            let mut uvy = vy / rr;
            let mag = (uvx * uvx + uvy * uvy).sqrt();
            if mag > MAX_U {
                let scale = MAX_U / mag;
                uvx *= scale; uvy *= scale;
                overflow += 1;
            }
            self.rho[k] = rr; self.ux[k] = uvx; self.uy[k] = uvy;
            let sp = (uvx * uvx + uvy * uvy).sqrt();
            self.spd[k] = sp;
            if sp < spd_mn { spd_mn = sp; }
            if sp > spd_mx { spd_mx = sp; }
            if rr < rho_mn { rho_mn = rr; }
            if rr > rho_mx { rho_mx = rr; }
        }
        self.overflow_count = overflow;
        self.spd_min = spd_mn; self.spd_max = spd_mx;
        self.rho_min = rho_mn; self.rho_max = rho_mx;

        // Zou-He inlet BC with turbulence perturbation
        let ps = turb * 0.004;
        for j in 1..(r - 1) {
            let k = j * c;
            let b = k * 9;
            let v0 = (js_random() - 0.5) * ps;
            let ri = (self.f1[b] + self.f1[b+2] + self.f1[b+4]
                      + 2.0 * (self.f1[b+3] + self.f1[b+6] + self.f1[b+7]))
                     / (1.0 - in_u);
            self.f1[b+1] = self.f1[b+3] + (2.0/3.0) * ri * in_u;
            self.f1[b+5] = self.f1[b+7] + (1.0/6.0) * ri * in_u
                           + 0.5 * ri * v0 - 0.5 * (self.f1[b+2] - self.f1[b+4]);
            self.f1[b+8] = self.f1[b+6] + (1.0/6.0) * ri * in_u
                           - 0.5 * ri * v0 + 0.5 * (self.f1[b+2] - self.f1[b+4]);
            self.rho[k] = ri; self.ux[k] = in_u; self.uy[k] = v0;
        }

        // Outlet (copy)
        for j in 1..(r - 1) {
            let ke = j * c + (c - 1);
            let kp = ke - 1;
            let (be, bp) = (ke * 9, kp * 9);
            for d in 0..9 { self.f1[be + d] = self.f1[bp + d]; }
            self.rho[ke] = self.rho[kp];
            self.ux[ke] = self.ux[kp];
            self.uy[ke] = self.uy[kp];
            self.spd[ke] = self.spd[kp];
        }

        // Top/bottom walls
        for i in 0..c {
            let kt = i;
            let bt = kt * 9;
            self.f1[bt+4] = self.f1[bt+2];
            self.f1[bt+7] = self.f1[bt+5];
            self.f1[bt+8] = self.f1[bt+6];
            self.ux[kt] = 0.0; self.uy[kt] = 0.0;

            let kb = (r - 1) * c + i;
            let bb = kb * 9;
            self.f1[bb+2] = self.f1[bb+4];
            self.f1[bb+5] = self.f1[bb+7];
            self.f1[bb+6] = self.f1[bb+8];
            self.ux[kb] = 0.0; self.uy[kb] = 0.0;
        }

        // BGK collision
        let omega = self.omega;
        for k in 0..n {
            let b = k * 9;
            if self.solid[k] != 0 {
                for d in 0..9 { self.f0[b + d] = self.f1[b + d]; }
                continue;
            }
            let (rr, vx, vy) = (self.rho[k], self.ux[k], self.uy[k]);
            let usq = vx * vx + vy * vy;
            for d in 0..9 {
                let cu = CX[d] as f32 * vx + CY[d] as f32 * vy;
                let feq = WT[d] * rr * (1.0 + 3.0 * cu + 4.5 * cu * cu - 1.5 * usq);
                self.f0[b + d] = self.f1[b + d] + omega * (feq - self.f1[b + d]);
            }
        }

        // Convergence delta
        let mut sum_delta_sq: f32 = 0.0;
        let mut fluid_cells: u32 = 0;
        for k in 0..n {
            if self.solid[k] != 0 { continue; }
            let dux = self.ux[k] - self.prev_ux[k];
            let duy = self.uy[k] - self.prev_uy[k];
            sum_delta_sq += dux * dux + duy * duy;
            fluid_cells += 1;
        }
        self.convergence_delta = if fluid_cells > 0 {
            (sum_delta_sq / fluid_cells as f32).sqrt()
        } else { 0.0 };
        self.prev_ux.copy_from_slice(&self.ux);
        self.prev_uy.copy_from_slice(&self.uy);

        // Curl (vorticity)
        let (mut curl_mn, mut curl_mx) = (f32::MAX, f32::MIN);
        for j in 1..(r - 1) {
            for i in 1..(c - 1) {
                let k = j * c + i;
                let cv = (self.uy[k + 1] - self.uy[k - 1]) * 0.5
                       - (self.ux[k + c] - self.ux[k - c]) * 0.5;
                self.curl[k] = cv;
                if cv < curl_mn { curl_mn = cv; }
                if cv > curl_mx { curl_mx = cv; }
            }
        }
        self.curl_min = curl_mn; self.curl_max = curl_mx;
    }

    // Pointer accessors for zero-copy rendering from JS
    pub fn get_rho_ptr(&self) -> *const f32 { self.rho.as_ptr() }
    pub fn get_ux_ptr(&self) -> *const f32 { self.ux.as_ptr() }
    pub fn get_uy_ptr(&self) -> *const f32 { self.uy.as_ptr() }
    pub fn get_spd_ptr(&self) -> *const f32 { self.spd.as_ptr() }
    pub fn get_curl_ptr(&self) -> *const f32 { self.curl.as_ptr() }
    pub fn get_solid_ptr(&self) -> *const u8 { self.solid.as_ptr() }

    pub fn get_cols(&self) -> usize { self.cols }
    pub fn get_rows(&self) -> usize { self.rows }
    pub fn get_n(&self) -> usize { self.n }
    pub fn get_diverged(&self) -> bool { self.diverged }
    pub fn get_overflow_count(&self) -> u32 { self.overflow_count }
    pub fn get_convergence_delta(&self) -> f32 { self.convergence_delta }
    pub fn get_spd_min(&self) -> f32 { self.spd_min }
    pub fn get_spd_max(&self) -> f32 { self.spd_max }
    pub fn get_rho_min(&self) -> f32 { self.rho_min }
    pub fn get_rho_max(&self) -> f32 { self.rho_max }
    pub fn get_curl_min(&self) -> f32 { self.curl_min }
    pub fn get_curl_max(&self) -> f32 { self.curl_max }
    pub fn clear_diverged(&mut self) { self.diverged = false; }
}

// Point-in-polygon (ray casting) — operates on flat [x0,y0,x1,y1,...] array
fn pip(px: f32, py: f32, poly: &[f32], npts: usize) -> bool {
    let mut inside = false;
    let mut j = npts - 1;
    for i in 0..npts {
        let (xi, yi) = (poly[i * 2], poly[i * 2 + 1]);
        let (xj, yj) = (poly[j * 2], poly[j * 2 + 1]);
        if ((yi > py) != (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
            inside = !inside;
        }
        j = i;
    }
    inside
}

// Import JS Math.random for turbulence perturbation
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = Math)]
    fn random() -> f32;
}

fn js_random() -> f32 {
    random()
}
