/* ═══════════════════════════════════════════════════════════
   AEROLAB · File Parsers
   SVG, DXF, STL, Image edge-trace
   f1stories.gr
   ═══════════════════════════════════════════════════════════ */

import { normPoly } from "./geometry.js";

export function parseSVG(svgText, maxPoints = 200) {
  try {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const els = doc.querySelectorAll("path,polygon,polyline,rect,circle,ellipse");
    if (!els.length) return null;
    const all = [];
    const ts = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    ts.style.cssText = "position:absolute;visibility:hidden;width:0;height:0";
    document.body.appendChild(ts);
    els.forEach(el => {
      const tag = el.tagName.toLowerCase();
      let pts = [];
      const pp = Math.max(20, Math.floor(maxPoints / els.length));
      if (tag === "polygon" || tag === "polyline") {
        const raw = (el.getAttribute("points") || "").trim().split(/[\s,]+/);
        for (let i = 0; i < raw.length - 1; i += 2) {
          const x = parseFloat(raw[i]), y = parseFloat(raw[i+1]);
          if (!isNaN(x) && !isNaN(y)) pts.push([x, y]);
        }
      } else if (tag === "rect") {
        const x = +el.getAttribute("x")||0, y = +el.getAttribute("y")||0;
        const w = +el.getAttribute("width"), h = +el.getAttribute("height");
        if (w && h) pts = [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
      } else if (tag === "circle" || tag === "ellipse") {
        const cx = +(el.getAttribute("cx")||0), cy = +(el.getAttribute("cy")||0);
        const rx = +(el.getAttribute("r")||el.getAttribute("rx")||50);
        const ry = +(el.getAttribute("r")||el.getAttribute("ry")||rx);
        for (let i = 0; i <= pp; i++) {
          const t = (i/pp)*Math.PI*2;
          pts.push([cx + rx*Math.cos(t), cy + ry*Math.sin(t)]);
        }
      } else if (tag === "path") {
        const d = el.getAttribute("d");
        if (d) {
          const pe = document.createElementNS("http://www.w3.org/2000/svg", "path");
          pe.setAttribute("d", d); ts.appendChild(pe);
          try {
            const tl = pe.getTotalLength();
            for (let i = 0; i <= pp; i++) {
              const pt = pe.getPointAtLength((i/pp)*tl);
              pts.push([pt.x, pt.y]);
            }
          } catch { /* ignore */ }
          pe.remove();
        }
      }
      if (pts.length >= 3) all.push(...pts);
    });
    document.body.removeChild(ts);
    if (all.length < 3) return null;
    const cx = all.reduce((s,p) => s+p[0], 0) / all.length;
    const cy = all.reduce((s,p) => s+p[1], 0) / all.length;
    all.sort((a,b) => Math.atan2(a[1]-cy, a[0]-cx) - Math.atan2(b[1]-cy, b[0]-cx));
    if (all.length > 300) {
      const st = Math.ceil(all.length / 300);
      return normPoly(all.filter((_, i) => i % st === 0));
    }
    return normPoly(all);
  } catch { return null; }
}

export function parseDXF(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim());
  const pts = [];
  let i = 0, px = null;
  while (i < lines.length) {
    const c = parseInt(lines[i], 10);
    if (c === 10 && i+1 < lines.length) { px = parseFloat(lines[i+1]); i += 2; }
    else if (c === 20 && i+1 < lines.length && px !== null) {
      const y = parseFloat(lines[i+1]);
      if (!isNaN(px) && !isNaN(y)) pts.push([px, y]);
      px = null; i += 2;
    } else i++;
  }
  return pts.length > 2 ? normPoly(pts) : null;
}

export function parseSTL(data) {
  try {
    const preview = typeof data === "string" ? data : new TextDecoder().decode(data.slice(0, 1000));
    const verts = [];
    if (preview.trim().startsWith("solid")) {
      const full = typeof data === "string" ? data : new TextDecoder().decode(data);
      const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
      let m;
      while ((m = re.exec(full))) verts.push([parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]);
    } else {
      const dv = new DataView(data instanceof ArrayBuffer ? data : data.buffer);
      const nt = dv.getUint32(80, true);
      for (let i = 0; i < nt; i++) {
        const o = 84 + i*50;
        for (let v = 0; v < 3; v++) {
          const vo = o + 12 + v*12;
          verts.push([dv.getFloat32(vo,true), dv.getFloat32(vo+4,true), dv.getFloat32(vo+8,true)]);
        }
      }
    }
    if (verts.length < 3) return null;
    const zs = verts.map(v => v[2]);
    const zMid = (Math.min(...zs) + Math.max(...zs)) / 2;
    const tol = (Math.max(...zs) - Math.min(...zs)) * 0.05 || 1;
    const pts2d = [];
    verts.forEach(([x, y, z]) => { if (Math.abs(z-zMid) < tol) pts2d.push([x, y]); });
    if (pts2d.length < 5) verts.forEach(([x, y]) => pts2d.push([x, y]));
    const cx = pts2d.reduce((s,p) => s+p[0], 0) / pts2d.length;
    const cy = pts2d.reduce((s,p) => s+p[1], 0) / pts2d.length;
    pts2d.sort((a,b) => Math.atan2(a[1]-cy, a[0]-cx) - Math.atan2(b[1]-cy, b[0]-cx));
    if (pts2d.length > 250) {
      const st = Math.ceil(pts2d.length / 250);
      return normPoly(pts2d.filter((_, i) => i % st === 0));
    }
    return normPoly(pts2d);
  } catch { return null; }
}

export function traceImg(id, w, h, np = 100) {
  const d = id.data, edges = [];
  for (let y = 1; y < h-1; y++)
    for (let x = 1; x < w-1; x++) {
      const i = (y*w+x)*4, br = d[i]*0.3 + d[i+1]*0.59 + d[i+2]*0.11;
      if (br < 128) {
        const nb = [(y-1)*w+(x-1),(y-1)*w+x,(y-1)*w+(x+1),y*w+(x-1),y*w+(x+1),(y+1)*w+(x-1),(y+1)*w+x,(y+1)*w+(x+1)];
        if (nb.some(n => (d[n*4]*0.3+d[n*4+1]*0.59+d[n*4+2]*0.11) >= 128)) edges.push([x, y]);
      }
    }
  if (edges.length < 5) return null;
  const cx = edges.reduce((s,p) => s+p[0], 0) / edges.length;
  const cy = edges.reduce((s,p) => s+p[1], 0) / edges.length;
  edges.sort((a,b) => Math.atan2(a[1]-cy, a[0]-cx) - Math.atan2(b[1]-cy, b[0]-cx));
  const st = Math.max(1, Math.floor(edges.length / np));
  return normPoly(edges.filter((_, i) => i % st === 0));
}
