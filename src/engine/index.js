export { SIM_W, SIM_H, COLS, ROWS, DEFAULT_PARTICLES, MAX_PARTICLES, TRAIL_LEN, IS_MOBILE } from "./constants.js";
export { LBM } from "./solver.js";
export { initWasmSolver, createSolver, isWasmAvailable } from "./solver-wrapper.js";
export { Particle, createPool, resizePool } from "./particles.js";
export { normPoly, xformPoly, simplPoly, genPreset, PRESET_GROUPS, generateNACA4, nacaDesignation } from "./geometry.js";
export { parseSVG, parseDXF, parseSTL, traceImg } from "./parsers.js";
export { TURBO, COOLWARM } from "./lut.js";
export { exportSessionJSON, parseSessionJSON, exportBinarySTL, buildZip } from "./exporters.js";
