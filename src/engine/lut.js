/* ═══════════════════════════════════════════════════════════
   AEROLAB · Color Look-Up Tables
   Turbo + CoolWarm colormaps for heatmap rendering
   f1stories.gr
   ═══════════════════════════════════════════════════════════ */

function buildTurbo() {
  const lut = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const r = Math.max(0, Math.min(255, (34.61 + t*(1172.33-t*(10793.56-t*(33300.12-t*(38394.49-t*14825.05))))) | 0));
    const g = Math.max(0, Math.min(255, (23.31 + t*(557.33+t*(1225.33-t*(3574.96-t*(1073.77+t*707.56))))) | 0));
    const b = Math.max(0, Math.min(255, (27.2 + t*(3211.1-t*(15327.97-t*(27814.0-t*(22569.18-t*6838.66))))) | 0));
    lut[i] = (255<<24) | (b<<16) | (g<<8) | r;
  }
  return lut;
}

function buildCoolWarm() {
  const lut = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let r, g, b;
    if (t < 0.5) {
      const s = t * 2;
      r = (30 + s*170) | 0; g = (60 + s*120) | 0; b = (200 - s*10) | 0;
    } else {
      const s = (t - 0.5) * 2;
      r = (200 + s*55) | 0; g = (180 - s*155) | 0; b = (190 - s*165) | 0;
    }
    lut[i] = (255<<24) | (Math.min(255,Math.max(0,b))<<16) | (Math.min(255,Math.max(0,g))<<8) | Math.min(255,Math.max(0,r));
  }
  return lut;
}

export const TURBO = buildTurbo();
export const COOLWARM = buildCoolWarm();
