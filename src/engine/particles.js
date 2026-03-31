/* ═══════════════════════════════════════════════════════════
   AEROLAB · Particle System
   RK2 midpoint integration with bilinear interpolation
   f1stories.gr
   ═══════════════════════════════════════════════════════════ */

import { COLS, ROWS, SIM_W, SIM_H, TRAIL_LEN, MAX_PARTICLES, DEFAULT_PARTICLES } from "./constants.js";

export class Particle {
  constructor(lY) {
    this.x = 0;
    this.y = 0;
    this.age = 0;
    this.tx = new Float32Array(TRAIL_LEN);
    this.ty = new Float32Array(TRAIL_LEN);
    this.tl = 0;
    this.ti = 0;
    this.active = true;
    this.lY = lY || 0;
    this.reset();
  }

  reset() {
    this.x = Math.random() * 2;
    this.y = this.lY > 0
      ? this.lY + (Math.random() - 0.5) * 2
      : 2 + Math.random() * (ROWS - 4);
    this.age = 0;
    this.tl = 0;
    this.ti = 0;
  }

  static vel(s, x, y) {
    const i0 = Math.max(0, Math.min(COLS-2, x|0));
    const j0 = Math.max(0, Math.min(ROWS-2, y|0));
    const tx = x - i0, ty = y - j0;
    const k00 = j0*COLS+i0, k10 = k00+1, k01 = k00+COLS, k11 = k01+1;
    if (s.solid[k00]||s.solid[k10]||s.solid[k01]||s.solid[k11]) return [0, 0];
    return [
      (1-tx)*(1-ty)*s.ux[k00] + tx*(1-ty)*s.ux[k10] + (1-tx)*ty*s.ux[k01] + tx*ty*s.ux[k11],
      (1-tx)*(1-ty)*s.uy[k00] + tx*(1-ty)*s.uy[k10] + (1-tx)*ty*s.uy[k01] + tx*ty*s.uy[k11],
    ];
  }

  update(s) {
    if (!this.active) return;
    if (this.x < 0 || this.x >= COLS-1 || this.y < 1 || this.y >= ROWS-1) { this.reset(); return; }
    if (s.solid[(this.y|0)*COLS + (this.x|0)]) { this.reset(); return; }

    const idx = this.ti % TRAIL_LEN;
    this.tx[idx] = this.x * (SIM_W / COLS);
    this.ty[idx] = this.y * (SIM_H / ROWS);
    this.ti++;
    if (this.tl < TRAIL_LEN) this.tl++;

    // RK2 midpoint
    const [a, b] = Particle.vel(s, this.x, this.y);
    const [c, d] = Particle.vel(s, this.x + a*0.5, this.y + b*0.5);
    this.x += c;
    this.y += d;
    this.age += 0.016;

    if (this.x >= COLS-2 || this.x < 0 || this.y < 1 || this.y >= ROWS-1) this.reset();
  }
}

export function createPool() {
  const pool = [];
  const nL = Math.min(MAX_PARTICLES, 50);
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const p = new Particle(3 + ((i % nL) / nL) * (ROWS - 6));
    p.active = i < DEFAULT_PARTICLES;
    pool.push(p);
  }
  return pool;
}

export function resizePool(pool, n) {
  const t = Math.min(n, MAX_PARTICLES);
  for (let i = 0; i < pool.length; i++) {
    if (i < t) {
      if (!pool[i].active) { pool[i].active = true; pool[i].reset(); }
    } else {
      pool[i].active = false;
    }
  }
}
