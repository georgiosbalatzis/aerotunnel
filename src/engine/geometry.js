/* ═══════════════════════════════════════════════════════════
   AEROLAB · Geometry Helpers
   Polygon transforms, presets, simplification
   f1stories.gr
   ═══════════════════════════════════════════════════════════ */

export function normPoly(pts) {
  if (!pts || pts.length < 3) return null;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const rx = x1 - x0 || 1, ry = y1 - y0 || 1;
  return pts.map(p => [(p[0]-x0)/rx, (p[1]-y0)/ry]);
}

export function xformPoly(n, cx, cy, sx, sy, aoa) {
  const r = aoa * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  return n.map(([nx, ny]) => {
    const lx = (nx - 0.5) * sx, ly = (ny - 0.5) * sy;
    return [cx + c*lx - s*ly, cy + s*lx + c*ly];
  });
}

export function simplPoly(pts, tol) {
  if (pts.length <= 4) return pts;
  const res = [pts[0]];
  for (let i = 1; i < pts.length-1; i++) {
    const p = res[res.length-1], n = pts[i+1], c = pts[i];
    const dx = n[0]-p[0], dy = n[1]-p[1], l = Math.sqrt(dx*dx+dy*dy) || 1;
    if (Math.abs(dy*c[0] - dx*c[1] + n[0]*p[1] - n[1]*p[0]) / l > tol) res.push(c);
  }
  res.push(pts[pts.length-1]);
  return res;
}

/* ── Preset profiles ── */
export function genPreset(type) {
  const p = [];
  if (type === "airfoil") {
    for (let t = 0; t <= Math.PI*2; t += 0.04) {
      const c = Math.cos(t), s = Math.sin(t);
      p.push([0.5 + 0.48*c*(0.5+0.5*c), 0.5 + 0.18*s*(1+0.3*c)]);
    }
  } else if (type === "cylinder") {
    for (let t = 0; t <= Math.PI*2; t += 0.05)
      p.push([0.5 + 0.45*Math.cos(t), 0.5 + 0.45*Math.sin(t)]);
  } else if (type === "wedge") {
    p.push([0.05, 0.25], [0.95, 0.5], [0.05, 0.75]);
  } else if (type === "bluff") {
    p.push([0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]);
  } else if (type === "f1car") {
    [[0,.58],[.01,.55],[.03,.49],[.05,.43],[.07,.4],[.09,.41],[.12,.39],[.15,.35],[.17,.33],[.2,.31],[.24,.29],[.28,.27],[.3,.25],[.32,.22],[.34,.21],[.36,.23],[.38,.24],[.4,.22],[.42,.23],[.44,.27],[.47,.25],[.5,.23],[.54,.22],[.58,.22],[.62,.23],[.66,.24],[.7,.26],[.74,.28],[.78,.3],[.8,.27],[.82,.22],[.84,.18],[.86,.17],[.88,.18],[.9,.2],[.92,.25],[.94,.32],[.96,.38],[.98,.42],[1,.46],[1,.5],[.98,.54],[.96,.58],[.94,.62],[.9,.65],[.86,.66],[.8,.66],[.7,.66],[.6,.66],[.5,.66],[.4,.66],[.3,.64],[.24,.64],[.18,.66],[.12,.67],[.08,.67],[.06,.64],[.04,.61],[.02,.59],[0,.58]].forEach(v => p.push(v));
  } else if (type === "frontwing") {
    [[0,.55],[.04,.42],[.1,.33],[.18,.27],[.3,.24],[.45,.24],[.6,.27],[.75,.33],[.88,.44],[.95,.58],[1,.62],[1,.65],[.9,.66],[.75,.63],[.6,.62],[.45,.63],[.3,.65],[.15,.67],[.06,.63],[0,.57]].forEach(v => p.push(v));
  } else if (type === "rearwing") {
    [[0,.5],[.06,.34],[.13,.24],[.25,.19],[.4,.18],[.55,.2],[.7,.25],[.85,.37],[.95,.52],[1,.54],[1,.58],[.92,.65],[.75,.68],[.55,.68],[.35,.68],[.2,.65],[.1,.6],[.04,.54],[0,.5]].forEach(v => p.push(v));
  }
  return p;
}

export const PRESET_GROUPS = [
  {
    label: "Benchmark",
    items: [
      { id: "airfoil",  label: "Airfoil",  desc: "Cambered section" },
      { id: "cylinder", label: "Cylinder", desc: "Wake benchmark" },
      { id: "wedge",    label: "Wedge",    desc: "Sharp L.E. study" },
      { id: "bluff",    label: "Bluff",    desc: "Separation case" },
    ],
  },
  {
    label: "F1 Profiles",
    items: [
      { id: "f1car",     label: "F1 Car",     desc: "Full silhouette" },
      { id: "frontwing", label: "Front Wing", desc: "Forward element" },
      { id: "rearwing",  label: "Rear Wing",  desc: "High downforce" },
    ],
  },
];
