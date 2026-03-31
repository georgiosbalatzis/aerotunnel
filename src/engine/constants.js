/* ═══════════════════════════════════════════════════════════
   AEROLAB · Simulation Constants
   f1stories.gr
   ═══════════════════════════════════════════════════════════ */

const isMobile = typeof window !== "undefined" && window.innerWidth < 720;

export const SIM_W = isMobile ? 640 : 1000;
export const SIM_H = isMobile ? 320 : 450;
export const COLS = isMobile ? 208 : 300;
export const ROWS = isMobile ? 104 : 135;
export const DEFAULT_PARTICLES = isMobile ? 220 : 420;
export const MAX_PARTICLES = isMobile ? 900 : 2000;
export const TRAIL_LEN = isMobile ? 56 : 80;
export const IS_MOBILE = isMobile;

/* D2Q9 lattice constants */
export const CX = [0, 1, 0, -1, 0, 1, -1, -1, 1];
export const CY = [0, 0, 1, 0, -1, 1, 1, -1, -1];
export const WT = [4/9, 1/9, 1/9, 1/9, 1/9, 1/36, 1/36, 1/36, 1/36];
export const OPP = [0, 3, 4, 1, 2, 7, 8, 5, 6];
