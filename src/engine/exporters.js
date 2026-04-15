/* ═══════════════════════════════════════════════════════════
   AEROLAB · Export Utilities
   JSON session, binary STL, minimal ZIP builder
   ═══════════════════════════════════════════════════════════ */

import { xformPoly, simplPoly } from "./geometry.js";

/* ── CRC-32 (used by ZIP) ── */
const crc32Tab = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  crc32Tab[i] = c;
}
function crc32(data) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) c = crc32Tab[(c ^ data[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* ── 29.1 — JSON Session Export ── */
export function exportSessionJSON(state) {
  const session = {
    version: 2,
    app: "aerolab",
    geometry: {
      poly: state.poly,
      preset: state.preset,
      cx: state.cx, cy: state.cy,
      sx: state.sx, sy: state.sy,
      aoa: state.aoa,
      simplify: state.simplify,
    },
    solver: { vel: state.vel, turb: state.turb, nu: state.nu },
    display: { mode: state.mode, pCount: state.pCount, trailOp: state.trailOp, simSpd: state.simSpd },
    history: state.history || [],
    metadata: {
      created: new Date().toISOString(),
      name: state.name || `${state.preset || "custom"} session`,
    },
  };
  const blob = new Blob([JSON.stringify(session, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aerolab-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseSessionJSON(text) {
  try {
    const data = JSON.parse(text);
    if (data.app !== "aerolab" || !data.version) return null;
    return data;
  } catch (_) {
    return null;
  }
}

/* ── 29.2 — Binary STL Export ── */
export function exportBinarySTL(poly, cx, cy, sx, sy, aoa, simplifyAmt = 0) {
  const shape = simplifyAmt > 0 ? simplPoly(poly, simplifyAmt * 0.005) : poly;
  const pts = xformPoly(
    shape.map(([x, y]) => [x, y]),
    cx, cy, sx, sy, aoa,
  );
  const depth = sx * 0.3;
  const zTop = depth / 2, zBot = -depth / 2;
  const n = pts.length;

  // Centroid for fan triangulation
  let cxSum = 0, cySum = 0;
  for (const [x, y] of pts) { cxSum += x; cySum += y; }
  const centX = cxSum / n, centY = cySum / n;

  // Count triangles: top cap (n) + bottom cap (n) + sides (2*n)
  const numTri = n * 4;
  const buf = new ArrayBuffer(84 + numTri * 50);
  const view = new DataView(buf);
  const header = new Uint8Array(buf, 0, 80);
  const enc = new TextEncoder();
  header.set(enc.encode("AeroLab STL Export").slice(0, 80));
  view.setUint32(80, numTri, true);

  let off = 84;
  const writeTri = (nx, ny, nz, v1, v2, v3) => {
    view.setFloat32(off, nx, true); view.setFloat32(off + 4, ny, true); view.setFloat32(off + 8, nz, true);
    view.setFloat32(off + 12, v1[0], true); view.setFloat32(off + 16, v1[1], true); view.setFloat32(off + 20, v1[2], true);
    view.setFloat32(off + 24, v2[0], true); view.setFloat32(off + 28, v2[1], true); view.setFloat32(off + 32, v2[2], true);
    view.setFloat32(off + 36, v3[0], true); view.setFloat32(off + 40, v3[1], true); view.setFloat32(off + 44, v3[2], true);
    view.setUint16(off + 48, 0, true);
    off += 50;
  };

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [x0, y0] = pts[i], [x1, y1] = pts[j];
    // Top cap (normal = 0,0,1)
    writeTri(0, 0, 1, [centX, centY, zTop], [x0, y0, zTop], [x1, y1, zTop]);
    // Bottom cap (normal = 0,0,-1, reversed winding)
    writeTri(0, 0, -1, [centX, centY, zBot], [x1, y1, zBot], [x0, y0, zBot]);
    // Side wall — two triangles per edge
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const snx = dy / len, sny = -dx / len;
    writeTri(snx, sny, 0, [x0, y0, zTop], [x1, y1, zTop], [x1, y1, zBot]);
    writeTri(snx, sny, 0, [x0, y0, zTop], [x1, y1, zBot], [x0, y0, zBot]);
  }

  const blob = new Blob([buf], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "aerolab-profile.stl";
  a.click();
  URL.revokeObjectURL(url);
}

/* ── 29.4 — Minimal ZIP Builder (store-only, no compression) ── */
export function buildZip(files) {
  const enc = new TextEncoder();
  const localParts = [];
  const cdEntries = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
    const chk = crc32(data);

    // Local file header (30 + name)
    const lh = new ArrayBuffer(30 + nameBytes.length);
    const lv = new DataView(lh);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, 0, true);       // stored
    lv.setUint32(14, chk, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    new Uint8Array(lh, 30).set(nameBytes);

    localParts.push(new Uint8Array(lh), data);

    // Central directory entry (46 + name)
    const cd = new ArrayBuffer(46 + nameBytes.length);
    const cv = new DataView(cd);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, chk, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(38, 0x20, true);    // external attr
    cv.setUint32(42, offset, true);
    new Uint8Array(cd, 46).set(nameBytes);
    cdEntries.push(new Uint8Array(cd));

    offset += 30 + nameBytes.length + data.length;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const e of cdEntries) cdSize += e.length;

  // End of central directory (22 bytes)
  const eocd = new ArrayBuffer(22);
  const ev = new DataView(eocd);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, cdOffset, true);

  return new Blob([...localParts, ...cdEntries, new Uint8Array(eocd)], { type: "application/zip" });
}
