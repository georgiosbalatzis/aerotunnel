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

/* ── 26.1 — NACA 4-digit airfoil generator ── */
export function generateNACA4(maxCamber, camberPos, thickness, numPoints = 40) {
  const m = maxCamber / 100;  // max camber as fraction of chord
  const p = camberPos / 100;  // camber position as fraction of chord
  const t = thickness / 100;  // thickness as fraction of chord

  const upper = [];
  const lower = [];

  for (let i = 0; i <= numPoints; i++) {
    // Cosine spacing for better leading edge resolution
    const beta = (i / numPoints) * Math.PI;
    const x = 0.5 * (1 - Math.cos(beta));

    // Thickness distribution (NACA standard)
    const yt = 5 * t * (
      0.2969 * Math.sqrt(x)
      - 0.1260 * x
      - 0.3516 * x * x
      + 0.2843 * x * x * x
      - 0.1015 * x * x * x * x
    );

    // Camber line
    let yc = 0, dycdx = 0;
    if (m > 0 && p > 0) {
      if (x <= p) {
        yc = (m / (p * p)) * (2 * p * x - x * x);
        dycdx = (2 * m / (p * p)) * (p - x);
      } else {
        yc = (m / ((1 - p) * (1 - p))) * (1 - 2 * p + 2 * p * x - x * x);
        dycdx = (2 * m / ((1 - p) * (1 - p))) * (p - x);
      }
    }

    const theta = Math.atan(dycdx);
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    upper.push([x - yt * sinT, yc + yt * cosT]);
    lower.push([x + yt * sinT, yc - yt * cosT]);
  }

  // Build closed polygon: upper surface (TE→LE) + lower surface (LE→TE)
  const poly = [];
  for (let i = upper.length - 1; i >= 0; i--) {
    poly.push([upper[i][0], 0.5 - upper[i][1]]);  // flip Y for screen coords, center at 0.5
  }
  for (let i = 1; i < lower.length; i++) {
    poly.push([lower[i][0], 0.5 - lower[i][1]]);
  }

  return poly;
}

export function nacaDesignation(maxCamber, camberPos, thickness) {
  const d1 = Math.round(maxCamber);
  const d2 = Math.round(camberPos / 10);
  const d34 = String(Math.round(thickness)).padStart(2, "0");
  return `NACA ${d1}${d2}${d34}`;
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
    [[0,.893],[.013,.82],[.034,.754],[.094,.633],[.161,.53],[.174,.466],[.208,.413],[.228,.406],[.255,.435],[.269,.439],[.315,.405],[.356,.392],[.389,.231],[.403,.192],[.416,.179],[.45,.198],[.51,.257],[.517,.259],[.523,.253],[.537,.228],[.557,.029],[.571,.007],[.597,.039],[.664,.058],[.705,.097],[.725,.132],[.758,.219],[.778,.308],[.799,.335],[.819,.387],[.852,.412],[.866,.436],[.873,.439],[.886,.289],[.899,.231],[.913,.224],[.973,.224],[.98,.246],[.987,.353],[1,.693],[.98,.738],[.966,.748],[.96,.766],[.94,.928],[.933,.939],[.879,.944],[.859,.982],[.839,.998],[.805,.981],[.45,.991],[.322,.986],[.309,.965],[.289,.798],[.255,.957],[.242,.986],[.222,.998],[.201,.979],[.188,.942],[.154,.777],[.134,.867],[.067,.871],[0,.893]].forEach(v => p.push(v));
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
