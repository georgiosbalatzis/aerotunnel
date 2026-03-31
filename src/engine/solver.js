/* ═══════════════════════════════════════════════════════════
   AEROLAB · Lattice Boltzmann D2Q9 Solver
   BGK collision, Zou-He inlet, bounce-back walls
   f1stories.gr
   ═══════════════════════════════════════════════════════════ */

import { CX, CY, WT, OPP } from "./constants.js";

export class LBM {
  constructor(c, r) {
    this.C = c;
    this.R = r;
    this.N = c * r;
    this.f0 = new Float32Array(9 * this.N);
    this.f1 = new Float32Array(9 * this.N);
    this.rho = new Float32Array(this.N);
    this.ux = new Float32Array(this.N);
    this.uy = new Float32Array(this.N);
    this.solid = new Uint8Array(this.N);
    this.spd = new Float32Array(this.N);
    this.curl = new Float32Array(this.N);
    this.omega = 1.85;
    this._init(0.12);
  }

  _init(u0) {
    for (let k = 0; k < this.N; k++) {
      this.rho[k] = 1;
      this.ux[k] = u0;
      this.uy[k] = 0;
      const b = k * 9, usq = u0 * u0;
      for (let d = 0; d < 9; d++) {
        const cu = CX[d] * u0;
        this.f0[b + d] = WT[d] * (1 + 3 * cu + 4.5 * cu * cu - 1.5 * usq);
      }
    }
  }

  setNu(nu) {
    this.omega = Math.min(1.95, Math.max(0.5, 1 / (3 * nu + 0.5)));
  }

  buildSolid(poly) {
    this.solid.fill(0);
    if (!poly) return;
    for (let j = 0; j < this.R; j++)
      for (let i = 0; i < this.C; i++)
        if (pip(i + 0.5, j + 0.5, poly)) this.solid[j * this.C + i] = 1;
  }

  step(inU, turb) {
    const { C, R, N, f0, f1, rho, ux, uy, solid, omega } = this;

    // Streaming
    for (let j = 0; j < R; j++) {
      for (let i = 0; i < C; i++) {
        const k = j * C + i, dst = k * 9;
        for (let d = 0; d < 9; d++) {
          const si = i - CX[d], sj = j - CY[d];
          f1[dst + d] = (si >= 0 && si < C && sj >= 0 && sj < R)
            ? f0[(sj * C + si) * 9 + d]
            : f0[k * 9 + OPP[d]];
        }
      }
    }

    // Bounce-back on solids
    for (let k = 0; k < N; k++) {
      if (!solid[k]) continue;
      const b = k * 9;
      const t1=f1[b+1], t2=f1[b+2], t3=f1[b+3], t4=f1[b+4];
      const t5=f1[b+5], t6=f1[b+6], t7=f1[b+7], t8=f1[b+8];
      f1[b+1]=t3; f1[b+3]=t1;
      f1[b+2]=t4; f1[b+4]=t2;
      f1[b+5]=t7; f1[b+7]=t5;
      f1[b+6]=t8; f1[b+8]=t6;
    }

    // Macroscopic quantities
    for (let k = 0; k < N; k++) {
      if (solid[k]) { ux[k]=0; uy[k]=0; rho[k]=1; this.spd[k]=0; continue; }
      const b = k * 9;
      let r = 0, vx = 0, vy = 0;
      for (let d = 0; d < 9; d++) {
        const fv = f1[b + d]; r += fv; vx += CX[d] * fv; vy += CY[d] * fv;
      }
      if (r < 0.01) r = 1;
      rho[k] = r; ux[k] = vx / r; uy[k] = vy / r;
      this.spd[k] = Math.sqrt(vx * vx + vy * vy) / r;
    }

    // Zou-He inlet BC with turbulence perturbation
    const ps = turb * 0.004;
    for (let j = 1; j < R - 1; j++) {
      const k = j * C, b = k * 9;
      const v0 = (Math.random() - 0.5) * ps;
      const ri = (f1[b]+f1[b+2]+f1[b+4]+2*(f1[b+3]+f1[b+6]+f1[b+7])) / (1 - inU);
      f1[b+1] = f1[b+3] + (2/3)*ri*inU;
      f1[b+5] = f1[b+7] + (1/6)*ri*inU + 0.5*ri*v0 - 0.5*(f1[b+2]-f1[b+4]);
      f1[b+8] = f1[b+6] + (1/6)*ri*inU - 0.5*ri*v0 + 0.5*(f1[b+2]-f1[b+4]);
      rho[k] = ri; ux[k] = inU; uy[k] = v0;
    }

    // Outlet (copy)
    for (let j = 1; j < R - 1; j++) {
      const ke = j*C+(C-1), kp = ke-1, be = ke*9, bp = kp*9;
      for (let d = 0; d < 9; d++) f1[be+d] = f1[bp+d];
      rho[ke]=rho[kp]; ux[ke]=ux[kp]; uy[ke]=uy[kp]; this.spd[ke]=this.spd[kp];
    }

    // Top/bottom walls
    for (let i = 0; i < C; i++) {
      const kt = i, bt = kt*9;
      f1[bt+4]=f1[bt+2]; f1[bt+7]=f1[bt+5]; f1[bt+8]=f1[bt+6]; ux[kt]=0; uy[kt]=0;
      const kb = (R-1)*C+i, bb = kb*9;
      f1[bb+2]=f1[bb+4]; f1[bb+5]=f1[bb+7]; f1[bb+6]=f1[bb+8]; ux[kb]=0; uy[kb]=0;
    }

    // BGK collision
    for (let k = 0; k < N; k++) {
      const b = k * 9;
      if (solid[k]) { for (let d=0;d<9;d++) f0[b+d]=f1[b+d]; continue; }
      const r=rho[k], vx=ux[k], vy=uy[k], usq=vx*vx+vy*vy;
      for (let d = 0; d < 9; d++) {
        const cu = CX[d]*vx + CY[d]*vy;
        f0[b+d] = f1[b+d] + omega*(WT[d]*r*(1+3*cu+4.5*cu*cu-1.5*usq) - f1[b+d]);
      }
    }

    // Curl (vorticity)
    for (let j = 1; j < R-1; j++)
      for (let i = 1; i < C-1; i++) {
        const k = j*C+i;
        this.curl[k] = (uy[k+1]-uy[k-1])*0.5 - (ux[k+C]-ux[k-C])*0.5;
      }
  }
}

/* Point-in-polygon (ray casting) */
function pip(px, py, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (((yi > py) !== (yj > py)) && px < ((xj-xi)*(py-yi))/(yj-yi) + xi) ins = !ins;
  }
  return ins;
}
