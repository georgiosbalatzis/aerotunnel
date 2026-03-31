import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTheme } from "./ThemeContext";
import ThemeToggle from "./ThemeToggle";
import "./cfdlab.css";

const isMobile = typeof window !== "undefined" && window.innerWidth < 960;
const SIM_W = isMobile ? 640 : 1000;
const SIM_H = isMobile ? 320 : 450;
const COLS = isMobile ? 208 : 300;
const ROWS = isMobile ? 104 : 135;
const DEFAULT_PARTICLES = isMobile ? 220 : 420;
const MAX_PARTICLES = isMobile ? 900 : 2000;
const TRAIL_LEN = isMobile ? 56 : 80;

const VIEW_OPTIONS = [
  { id: "tunnel", label: "Pit Wall", eyebrow: "01" },
  { id: "analysis", label: "Timing Tower", eyebrow: "02" },
  { id: "about", label: "Garage Notes", eyebrow: "03" },
];

const MODE_OPTIONS = [
  {
    id: "velocity",
    label: "Velocity",
    shortLabel: "VEL",
    accent: "var(--accent-cyan)",
    description: "Read top-speed build-up through the tunnel like a sector-speed strip.",
    legend: "Freestream entry to peak local acceleration",
  },
  {
    id: "pressure",
    label: "Pressure",
    shortLabel: "PRS",
    accent: "var(--accent-orange)",
    description: "Spot loading, suction, and stall-prone pockets across the package.",
    legend: "High-load stagnation to low-pressure suction",
  },
  {
    id: "streamlines",
    label: "Streamlines",
    shortLabel: "STR",
    accent: "var(--accent-green)",
    description: "Follow wake paths the way a race engineer reads on-track flow attachment.",
    legend: "Particle traces, separation length, and wake direction",
  },
  {
    id: "vorticity",
    label: "Vorticity",
    shortLabel: "VRT",
    accent: "var(--accent-red)",
    description: "Expose the dirty air behind the section and the strength of shed structures.",
    legend: "Low to high rotational intensity",
  },
];

const IMPORT_TABS = [
  { id: "preset", label: "Presets" },
  { id: "svg", label: "SVG" },
  { id: "stl", label: "STL" },
  { id: "dxf", label: "DXF" },
  { id: "draw", label: "Sketch" },
  { id: "image", label: "Image" },
];

const PRESET_GROUPS = [
  {
    label: "Wind-tunnel benchmarks",
    items: [
      { id: "airfoil", label: "Airfoil", description: "Balanced cambered section" },
      { id: "cylinder", label: "Cylinder", description: "Wake shedding benchmark" },
      { id: "wedge", label: "Wedge", description: "Sharp leading-edge study" },
      { id: "bluff", label: "Bluff body", description: "Boxy separation case" },
    ],
  },
  {
    label: "Single-seater aero parts",
    items: [
      { id: "f1car", label: "F1 silhouette", description: "Whole car side profile" },
      { id: "frontwing", label: "Front wing", description: "Forward aero element" },
      { id: "rearwing", label: "Rear wing", description: "High downforce rear section" },
    ],
  },
];

const PRESET_LOOKUP = Object.fromEntries(
  PRESET_GROUPS.flatMap((group) =>
    group.items.map((item) => [item.id, { ...item, group: group.label }])
  )
);

const SHORTCUTS = [
  ["Space", "Run or pause the solver"],
  ["R", "Reset solver state"],
  ["1-4", "Switch the visualization mode"],
  ["F", "Toggle fullscreen"],
  ["S", "Capture a snapshot"],
  ["/", "Show or hide shortcut help"],
];

const ABOUT_FEATURES = [
  {
    title: "Pit wall layout",
    body: "The main session screen is organized like a race control stack: track feed, setup sheet, timing tower, and engineer notes.",
  },
  {
    title: "Package pipeline",
    body: "Swap from benchmark sections to wings, import custom geometry, or rough a silhouette directly into the garage pad.",
  },
  {
    title: "Timing export",
    body: "CL, CD, Reynolds number, and peak velocity stay live throughout the run and can be exported as a lap sheet CSV.",
  },
  {
    title: "Fast setup changes",
    body: "Update ride attitude, flow conditions, and visual density without losing the live canvas or telemetry context.",
  },
];

const METHOD_STEPS = [
  "Roll out a benchmark or import a custom aero package.",
  "Place the body in the tunnel like a setup change between runs.",
  "Tune inlet speed, turbulence, and viscosity before a fresh stint.",
  "Swap between pressure, velocity, wake, and vorticity reads.",
  "Compare the timing trace before committing to the next package change.",
];

function buildTurbo() {
  const lut = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    const t = index / 255;
    const red = Math.max(
      0,
      Math.min(255, (34.61 + t * (1172.33 - t * (10793.56 - t * (33300.12 - t * (38394.49 - t * 14825.05))))) | 0)
    );
    const green = Math.max(
      0,
      Math.min(255, (23.31 + t * (557.33 + t * (1225.33 - t * (3574.96 - t * (1073.77 + t * 707.56))))) | 0)
    );
    const blue = Math.max(
      0,
      Math.min(255, (27.2 + t * (3211.1 - t * (15327.97 - t * (27814.0 - t * (22569.18 - t * 6838.66))))) | 0)
    );
    lut[index] = (255 << 24) | (blue << 16) | (green << 8) | red;
  }
  return lut;
}

function buildCoolWarm() {
  const lut = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    const t = index / 255;
    let red;
    let green;
    let blue;
    if (t < 0.5) {
      const scaled = t * 2;
      red = (30 + scaled * 170) | 0;
      green = (60 + scaled * 120) | 0;
      blue = (200 - scaled * 10) | 0;
    } else {
      const scaled = (t - 0.5) * 2;
      red = (200 + scaled * 55) | 0;
      green = (180 - scaled * 155) | 0;
      blue = (190 - scaled * 165) | 0;
    }
    lut[index] =
      (255 << 24) |
      (Math.min(255, Math.max(0, blue)) << 16) |
      (Math.min(255, Math.max(0, green)) << 8) |
      Math.min(255, Math.max(0, red));
  }
  return lut;
}

const TURBO = buildTurbo();
const COOLWARM = buildCoolWarm();

function pointInPolygon(px, py, polygon) {
  let inside = false;
  for (let index = 0, prev = polygon.length - 1; index < polygon.length; prev = index, index += 1) {
    const xi = polygon[index][0];
    const yi = polygon[index][1];
    const xj = polygon[prev][0];
    const yj = polygon[prev][1];
    if (((yi > py) !== (yj > py)) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function normalizePolygon(points) {
  if (!points || points.length < 3) return null;
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const rangeX = x1 - x0 || 1;
  const rangeY = y1 - y0 || 1;
  return points.map((point) => [(point[0] - x0) / rangeX, (point[1] - y0) / rangeY]);
}

function transformPolygon(normalizedPolygon, centerX, centerY, scaleX, scaleY, angleOfAttack) {
  const radians = (angleOfAttack * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return normalizedPolygon.map(([nx, ny]) => {
    const localX = (nx - 0.5) * scaleX;
    const localY = (ny - 0.5) * scaleY;
    return [centerX + cos * localX - sin * localY, centerY + sin * localX + cos * localY];
  });
}

function simplifyPolygon(points, tolerance) {
  if (points.length <= 4) return points;
  const result = [points[0]];
  for (let index = 1; index < points.length - 1; index += 1) {
    const prev = result[result.length - 1];
    const next = points[index + 1];
    const current = points[index];
    const dx = next[0] - prev[0];
    const dy = next[1] - prev[1];
    const length = Math.sqrt(dx * dx + dy * dy) || 1;
    const distance = Math.abs(dy * current[0] - dx * current[1] + next[0] * prev[1] - next[1] * prev[0]) / length;
    if (distance > tolerance) result.push(current);
  }
  result.push(points[points.length - 1]);
  return result;
}

function generatePreset(type) {
  const points = [];
  if (type === "airfoil") {
    for (let t = 0; t <= Math.PI * 2; t += 0.04) {
      const cos = Math.cos(t);
      const sin = Math.sin(t);
      points.push([0.5 + 0.48 * cos * (0.5 + 0.5 * cos), 0.5 + 0.18 * sin * (1 + 0.3 * cos)]);
    }
  } else if (type === "cylinder") {
    for (let t = 0; t <= Math.PI * 2; t += 0.05) points.push([0.5 + 0.45 * Math.cos(t), 0.5 + 0.45 * Math.sin(t)]);
  } else if (type === "wedge") {
    points.push([0.05, 0.25], [0.95, 0.5], [0.05, 0.75]);
  } else if (type === "bluff") {
    points.push([0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]);
  } else if (type === "f1car") {
    [
      [0, 0.58],
      [0.01, 0.55],
      [0.03, 0.49],
      [0.05, 0.43],
      [0.07, 0.4],
      [0.09, 0.41],
      [0.12, 0.39],
      [0.15, 0.35],
      [0.17, 0.33],
      [0.2, 0.31],
      [0.24, 0.29],
      [0.28, 0.27],
      [0.3, 0.25],
      [0.32, 0.22],
      [0.34, 0.21],
      [0.36, 0.23],
      [0.38, 0.24],
      [0.4, 0.22],
      [0.42, 0.23],
      [0.44, 0.27],
      [0.47, 0.25],
      [0.5, 0.23],
      [0.54, 0.22],
      [0.58, 0.22],
      [0.62, 0.23],
      [0.66, 0.24],
      [0.7, 0.26],
      [0.74, 0.28],
      [0.78, 0.3],
      [0.8, 0.27],
      [0.82, 0.22],
      [0.84, 0.18],
      [0.86, 0.17],
      [0.88, 0.18],
      [0.9, 0.2],
      [0.92, 0.25],
      [0.94, 0.32],
      [0.96, 0.38],
      [0.98, 0.42],
      [1, 0.46],
      [1, 0.5],
      [0.98, 0.54],
      [0.96, 0.58],
      [0.94, 0.62],
      [0.9, 0.65],
      [0.86, 0.66],
      [0.8, 0.66],
      [0.7, 0.66],
      [0.6, 0.66],
      [0.5, 0.66],
      [0.4, 0.66],
      [0.3, 0.64],
      [0.24, 0.64],
      [0.18, 0.66],
      [0.12, 0.67],
      [0.08, 0.67],
      [0.06, 0.64],
      [0.04, 0.61],
      [0.02, 0.59],
      [0, 0.58],
    ].forEach((value) => points.push(value));
  } else if (type === "frontwing") {
    [
      [0, 0.55],
      [0.04, 0.42],
      [0.1, 0.33],
      [0.18, 0.27],
      [0.3, 0.24],
      [0.45, 0.24],
      [0.6, 0.27],
      [0.75, 0.33],
      [0.88, 0.44],
      [0.95, 0.58],
      [1, 0.62],
      [1, 0.65],
      [0.9, 0.66],
      [0.75, 0.63],
      [0.6, 0.62],
      [0.45, 0.63],
      [0.3, 0.65],
      [0.15, 0.67],
      [0.06, 0.63],
      [0, 0.57],
    ].forEach((value) => points.push(value));
  } else if (type === "rearwing") {
    [
      [0, 0.5],
      [0.06, 0.34],
      [0.13, 0.24],
      [0.25, 0.19],
      [0.4, 0.18],
      [0.55, 0.2],
      [0.7, 0.25],
      [0.85, 0.37],
      [0.95, 0.52],
      [1, 0.54],
      [1, 0.58],
      [0.92, 0.65],
      [0.75, 0.68],
      [0.55, 0.68],
      [0.35, 0.68],
      [0.2, 0.65],
      [0.1, 0.6],
      [0.04, 0.54],
      [0, 0.5],
    ].forEach((value) => points.push(value));
  }
  return points;
}

function parseSVG(svgText, maxPoints = 200) {
  try {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const elements = doc.querySelectorAll("path,polygon,polyline,rect,circle,ellipse");
    if (!elements.length) return null;
    const allPoints = [];
    const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    tempSvg.style.cssText = "position:absolute;visibility:hidden;width:0;height:0";
    document.body.appendChild(tempSvg);
    elements.forEach((element) => {
      const tag = element.tagName.toLowerCase();
      let points = [];
      const pointsPerElement = Math.max(20, Math.floor(maxPoints / elements.length));
      if (tag === "polygon" || tag === "polyline") {
        const raw = (element.getAttribute("points") || "").trim().split(/[\s,]+/);
        for (let index = 0; index < raw.length - 1; index += 2) {
          const x = parseFloat(raw[index]);
          const y = parseFloat(raw[index + 1]);
          if (!Number.isNaN(x) && !Number.isNaN(y)) points.push([x, y]);
        }
      } else if (tag === "rect") {
        const x = +element.getAttribute("x") || 0;
        const y = +element.getAttribute("y") || 0;
        const width = +element.getAttribute("width");
        const height = +element.getAttribute("height");
        if (width && height) points = [[x, y], [x + width, y], [x + width, y + height], [x, y + height]];
      } else if (tag === "circle" || tag === "ellipse") {
        const cx = +(element.getAttribute("cx") || 0);
        const cy = +(element.getAttribute("cy") || 0);
        const rx = +(element.getAttribute("r") || element.getAttribute("rx") || 50);
        const ry = +(element.getAttribute("r") || element.getAttribute("ry") || rx);
        for (let index = 0; index <= pointsPerElement; index += 1) {
          const t = (index / pointsPerElement) * Math.PI * 2;
          points.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
        }
      } else if (tag === "path") {
        const d = element.getAttribute("d");
        if (d) {
          const pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
          pathElement.setAttribute("d", d);
          tempSvg.appendChild(pathElement);
          try {
            const totalLength = pathElement.getTotalLength();
            for (let index = 0; index <= pointsPerElement; index += 1) {
              const point = pathElement.getPointAtLength((index / pointsPerElement) * totalLength);
              points.push([point.x, point.y]);
            }
          } catch {
            pathElement.remove();
            return;
          }
          pathElement.remove();
        }
      }
      if (points.length >= 3) allPoints.push(...points);
    });
    document.body.removeChild(tempSvg);
    if (allPoints.length < 3) return null;
    const centerX = allPoints.reduce((sum, point) => sum + point[0], 0) / allPoints.length;
    const centerY = allPoints.reduce((sum, point) => sum + point[1], 0) / allPoints.length;
    allPoints.sort(
      (a, b) => Math.atan2(a[1] - centerY, a[0] - centerX) - Math.atan2(b[1] - centerY, b[0] - centerX)
    );
    if (allPoints.length > 300) {
      const stride = Math.ceil(allPoints.length / 300);
      return normalizePolygon(allPoints.filter((_, index) => index % stride === 0));
    }
    return normalizePolygon(allPoints);
  } catch {
    return null;
  }
}

function parseDXF(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const points = [];
  let index = 0;
  let pendingX = null;
  while (index < lines.length) {
    const code = parseInt(lines[index], 10);
    if (code === 10 && index + 1 < lines.length) {
      pendingX = parseFloat(lines[index + 1]);
      index += 2;
    } else if (code === 20 && index + 1 < lines.length && pendingX !== null) {
      const y = parseFloat(lines[index + 1]);
      if (!Number.isNaN(pendingX) && !Number.isNaN(y)) points.push([pendingX, y]);
      pendingX = null;
      index += 2;
    } else {
      index += 1;
    }
  }
  return points.length > 2 ? normalizePolygon(points) : null;
}

function parseSTL(data) {
  try {
    const previewText = typeof data === "string" ? data : new TextDecoder().decode(data.slice(0, 1000));
    const vertices = [];
    if (previewText.trim().startsWith("solid")) {
      const fullText = typeof data === "string" ? data : new TextDecoder().decode(data);
      const regex = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
      let match;
      while ((match = regex.exec(fullText))) vertices.push([parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])]);
    } else {
      const view = new DataView(data instanceof ArrayBuffer ? data : data.buffer);
      const triangleCount = view.getUint32(80, true);
      for (let triangle = 0; triangle < triangleCount; triangle += 1) {
        const offset = 84 + triangle * 50;
        for (let vertex = 0; vertex < 3; vertex += 1) {
          const vertexOffset = offset + 12 + vertex * 12;
          vertices.push([
            view.getFloat32(vertexOffset, true),
            view.getFloat32(vertexOffset + 4, true),
            view.getFloat32(vertexOffset + 8, true),
          ]);
        }
      }
    }
    if (vertices.length < 3) return null;
    const zs = vertices.map((vertex) => vertex[2]);
    const midZ = (Math.min(...zs) + Math.max(...zs)) / 2;
    const tolerance = (Math.max(...zs) - Math.min(...zs)) * 0.05 || 1;
    const points2d = [];
    vertices.forEach(([x, y, z]) => {
      if (Math.abs(z - midZ) < tolerance) points2d.push([x, y]);
    });
    if (points2d.length < 5) vertices.forEach(([x, y]) => points2d.push([x, y]));
    const centerX = points2d.reduce((sum, point) => sum + point[0], 0) / points2d.length;
    const centerY = points2d.reduce((sum, point) => sum + point[1], 0) / points2d.length;
    points2d.sort(
      (a, b) => Math.atan2(a[1] - centerY, a[0] - centerX) - Math.atan2(b[1] - centerY, b[0] - centerX)
    );
    if (points2d.length > 250) {
      const stride = Math.ceil(points2d.length / 250);
      return normalizePolygon(points2d.filter((_, index) => index % stride === 0));
    }
    return normalizePolygon(points2d);
  } catch {
    return null;
  }
}

function traceImage(imageData, width, height, maxPoints = 100) {
  const { data } = imageData;
  const edges = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const offset = (y * width + x) * 4;
      const brightness = data[offset] * 0.3 + data[offset + 1] * 0.59 + data[offset + 2] * 0.11;
      if (brightness < 128) {
        const neighbors = [
          (y - 1) * width + (x - 1),
          (y - 1) * width + x,
          (y - 1) * width + (x + 1),
          y * width + (x - 1),
          y * width + (x + 1),
          (y + 1) * width + (x - 1),
          (y + 1) * width + x,
          (y + 1) * width + (x + 1),
        ];
        if (
          neighbors.some((neighbor) => {
            const index = neighbor * 4;
            return data[index] * 0.3 + data[index + 1] * 0.59 + data[index + 2] * 0.11 >= 128;
          })
        ) {
          edges.push([x, y]);
        }
      }
    }
  }
  if (edges.length < 5) return null;
  const centerX = edges.reduce((sum, point) => sum + point[0], 0) / edges.length;
  const centerY = edges.reduce((sum, point) => sum + point[1], 0) / edges.length;
  edges.sort((a, b) => Math.atan2(a[1] - centerY, a[0] - centerX) - Math.atan2(b[1] - centerY, b[0] - centerX));
  const stride = Math.max(1, Math.floor(edges.length / maxPoints));
  return normalizePolygon(edges.filter((_, index) => index % stride === 0));
}

const CX = [0, 1, 0, -1, 0, 1, -1, -1, 1];
const CY = [0, 0, 1, 0, -1, 1, 1, -1, -1];
const WT = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36];
const OPP = [0, 3, 4, 1, 2, 7, 8, 5, 6];

class LBM {
  constructor(cols, rows) {
    this.C = cols;
    this.R = rows;
    this.N = cols * rows;
    this.f0 = new Float32Array(9 * this.N);
    this.f1 = new Float32Array(9 * this.N);
    this.rho = new Float32Array(this.N);
    this.ux = new Float32Array(this.N);
    this.uy = new Float32Array(this.N);
    this.solid = new Uint8Array(this.N);
    this.spd = new Float32Array(this.N);
    this.curl = new Float32Array(this.N);
    this.omega = 1.85;
    this.init(0.12);
  }

  init(inletVelocity) {
    for (let cell = 0; cell < this.N; cell += 1) {
      this.rho[cell] = 1;
      this.ux[cell] = inletVelocity;
      this.uy[cell] = 0;
      const base = cell * 9;
      const uSquared = inletVelocity * inletVelocity;
      for (let dir = 0; dir < 9; dir += 1) {
        const cu = CX[dir] * inletVelocity;
        this.f0[base + dir] = WT[dir] * (1 + 3 * cu + 4.5 * cu * cu - 1.5 * uSquared);
      }
    }
  }

  setNu(nu) {
    this.omega = Math.min(1.95, Math.max(0.5, 1 / (3 * nu + 0.5)));
  }

  buildSolid(polygon) {
    this.solid.fill(0);
    if (!polygon) return;
    for (let row = 0; row < this.R; row += 1) {
      for (let col = 0; col < this.C; col += 1) {
        if (pointInPolygon(col + 0.5, row + 0.5, polygon)) this.solid[row * this.C + col] = 1;
      }
    }
  }

  step(inletVelocity, turbulence) {
    const { C, R, N, f0, f1, rho, ux, uy, solid, omega } = this;

    for (let row = 0; row < R; row += 1) {
      for (let col = 0; col < C; col += 1) {
        const cell = row * C + col;
        const dest = cell * 9;
        for (let dir = 0; dir < 9; dir += 1) {
          const sourceCol = col - CX[dir];
          const sourceRow = row - CY[dir];
          f1[dest + dir] =
            sourceCol >= 0 && sourceCol < C && sourceRow >= 0 && sourceRow < R
              ? f0[(sourceRow * C + sourceCol) * 9 + dir]
              : f0[cell * 9 + OPP[dir]];
        }
      }
    }

    for (let cell = 0; cell < N; cell += 1) {
      if (!solid[cell]) continue;
      const base = cell * 9;
      const t1 = f1[base + 1];
      const t2 = f1[base + 2];
      const t3 = f1[base + 3];
      const t4 = f1[base + 4];
      const t5 = f1[base + 5];
      const t6 = f1[base + 6];
      const t7 = f1[base + 7];
      const t8 = f1[base + 8];
      f1[base + 1] = t3;
      f1[base + 3] = t1;
      f1[base + 2] = t4;
      f1[base + 4] = t2;
      f1[base + 5] = t7;
      f1[base + 7] = t5;
      f1[base + 6] = t8;
      f1[base + 8] = t6;
    }

    for (let cell = 0; cell < N; cell += 1) {
      if (solid[cell]) {
        ux[cell] = 0;
        uy[cell] = 0;
        rho[cell] = 1;
        this.spd[cell] = 0;
        continue;
      }
      const base = cell * 9;
      let density = 0;
      let velX = 0;
      let velY = 0;
      for (let dir = 0; dir < 9; dir += 1) {
        const value = f1[base + dir];
        density += value;
        velX += CX[dir] * value;
        velY += CY[dir] * value;
      }
      if (density < 0.01) density = 1;
      rho[cell] = density;
      ux[cell] = velX / density;
      uy[cell] = velY / density;
      this.spd[cell] = Math.sqrt(velX * velX + velY * velY) / density;
    }

    const perturbationScale = turbulence * 0.004;
    for (let row = 1; row < R - 1; row += 1) {
      const cell = row * C;
      const base = cell * 9;
      const noise = (Math.random() - 0.5) * perturbationScale;
      const inletDensity =
        (f1[base] + f1[base + 2] + f1[base + 4] + 2 * (f1[base + 3] + f1[base + 6] + f1[base + 7])) /
        (1 - inletVelocity);
      f1[base + 1] = f1[base + 3] + (2 / 3) * inletDensity * inletVelocity;
      f1[base + 5] = f1[base + 7] + (1 / 6) * inletDensity * inletVelocity + 0.5 * inletDensity * noise - 0.5 * (f1[base + 2] - f1[base + 4]);
      f1[base + 8] = f1[base + 6] + (1 / 6) * inletDensity * inletVelocity - 0.5 * inletDensity * noise + 0.5 * (f1[base + 2] - f1[base + 4]);
      rho[cell] = inletDensity;
      ux[cell] = inletVelocity;
      uy[cell] = noise;
    }

    for (let row = 1; row < R - 1; row += 1) {
      const edgeCell = row * C + (C - 1);
      const prevCell = edgeCell - 1;
      const edgeBase = edgeCell * 9;
      const prevBase = prevCell * 9;
      for (let dir = 0; dir < 9; dir += 1) f1[edgeBase + dir] = f1[prevBase + dir];
      rho[edgeCell] = rho[prevCell];
      ux[edgeCell] = ux[prevCell];
      uy[edgeCell] = uy[prevCell];
      this.spd[edgeCell] = this.spd[prevCell];
    }

    for (let col = 0; col < C; col += 1) {
      const topCell = col;
      const topBase = topCell * 9;
      f1[topBase + 4] = f1[topBase + 2];
      f1[topBase + 7] = f1[topBase + 5];
      f1[topBase + 8] = f1[topBase + 6];
      ux[topCell] = 0;
      uy[topCell] = 0;

      const bottomCell = (R - 1) * C + col;
      const bottomBase = bottomCell * 9;
      f1[bottomBase + 2] = f1[bottomBase + 4];
      f1[bottomBase + 5] = f1[bottomBase + 7];
      f1[bottomBase + 6] = f1[bottomBase + 8];
      ux[bottomCell] = 0;
      uy[bottomCell] = 0;
    }

    for (let cell = 0; cell < N; cell += 1) {
      const base = cell * 9;
      if (solid[cell]) {
        for (let dir = 0; dir < 9; dir += 1) f0[base + dir] = f1[base + dir];
        continue;
      }
      const density = rho[cell];
      const velX = ux[cell];
      const velY = uy[cell];
      const uSquared = velX * velX + velY * velY;
      for (let dir = 0; dir < 9; dir += 1) {
        const cu = CX[dir] * velX + CY[dir] * velY;
        f0[base + dir] = f1[base + dir] + omega * (WT[dir] * density * (1 + 3 * cu + 4.5 * cu * cu - 1.5 * uSquared) - f1[base + dir]);
      }
    }

    for (let row = 1; row < R - 1; row += 1) {
      for (let col = 1; col < C - 1; col += 1) {
        const cell = row * C + col;
        this.curl[cell] = (uy[cell + 1] - uy[cell - 1]) * 0.5 - (ux[cell + C] - ux[cell - C]) * 0.5;
      }
    }
  }
}

class Particle {
  constructor(laneY) {
    this.x = 0;
    this.y = 0;
    this.age = 0;
    this.tx = new Float32Array(TRAIL_LEN);
    this.ty = new Float32Array(TRAIL_LEN);
    this.tl = 0;
    this.ti = 0;
    this.active = true;
    this.laneY = laneY || 0;
    this.reset();
  }

  reset() {
    this.x = Math.random() * 2;
    this.y = this.laneY > 0 ? this.laneY + (Math.random() - 0.5) * 2 : 2 + Math.random() * (ROWS - 4);
    this.age = 0;
    this.tl = 0;
    this.ti = 0;
  }

  static velocity(solver, x, y) {
    const i0 = Math.max(0, Math.min(COLS - 2, x | 0));
    const j0 = Math.max(0, Math.min(ROWS - 2, y | 0));
    const tx = x - i0;
    const ty = y - j0;
    const k00 = j0 * COLS + i0;
    const k10 = k00 + 1;
    const k01 = k00 + COLS;
    const k11 = k01 + 1;
    if (solver.solid[k00] || solver.solid[k10] || solver.solid[k01] || solver.solid[k11]) return [0, 0];
    return [
      (1 - tx) * (1 - ty) * solver.ux[k00] +
        tx * (1 - ty) * solver.ux[k10] +
        (1 - tx) * ty * solver.ux[k01] +
        tx * ty * solver.ux[k11],
      (1 - tx) * (1 - ty) * solver.uy[k00] +
        tx * (1 - ty) * solver.uy[k10] +
        (1 - tx) * ty * solver.uy[k01] +
        tx * ty * solver.uy[k11],
    ];
  }

  update(solver) {
    if (!this.active) return;
    if (this.x < 0 || this.x >= COLS - 1 || this.y < 1 || this.y >= ROWS - 1) {
      this.reset();
      return;
    }
    if (solver.solid[(this.y | 0) * COLS + (this.x | 0)]) {
      this.reset();
      return;
    }
    const trailIndex = this.ti % TRAIL_LEN;
    this.tx[trailIndex] = this.x * (SIM_W / COLS);
    this.ty[trailIndex] = this.y * (SIM_H / ROWS);
    this.ti += 1;
    if (this.tl < TRAIL_LEN) this.tl += 1;
    const [a, b] = Particle.velocity(solver, this.x, this.y);
    const [c, d] = Particle.velocity(solver, this.x + a * 0.5, this.y + b * 0.5);
    this.x += c;
    this.y += d;
    this.age += 0.016;
    if (this.x >= COLS - 2 || this.x < 0 || this.y < 1 || this.y >= ROWS - 1) this.reset();
  }
}

function makeParticlePool() {
  const pool = [];
  const lanes = Math.min(MAX_PARTICLES, 50);
  for (let index = 0; index < MAX_PARTICLES; index += 1) {
    const particle = new Particle(3 + ((index % lanes) / lanes) * (ROWS - 6));
    particle.active = index < DEFAULT_PARTICLES;
    pool.push(particle);
  }
  return pool;
}

function resizeParticlePool(pool, count) {
  const target = Math.min(count, MAX_PARTICLES);
  for (let index = 0; index < pool.length; index += 1) {
    if (index < target) {
      if (!pool[index].active) {
        pool[index].active = true;
        pool[index].reset();
      }
    } else {
      pool[index].active = false;
    }
  }
}

function useHistory(maxLength = 200) {
  const historyRef = useRef([]);
  const push = useCallback(
    (entry) => {
      historyRef.current.push({ ...entry, t: Date.now() });
      if (historyRef.current.length > maxLength) historyRef.current.shift();
    },
    [maxLength]
  );
  return [historyRef, push];
}

function F1Logo({ size = 20 }) {
  const gradientId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 48 46" fill="none" aria-hidden="true">
      <path
        fill={`url(#${gradientId})`}
        d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"
      />
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="48" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--accent-red)" />
          <stop offset="0.56" stopColor="var(--accent-orange)" />
          <stop offset="1" stopColor="var(--accent-cyan)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Panel({ eyebrow, title, subtitle, actions, className = "", children }) {
  return (
    <section className={`panel ${className}`}>
      {(eyebrow || title || actions) && (
        <header className="panel-header">
          <div>
            {eyebrow && <div className="panel-eyebrow">{eyebrow}</div>}
            {title && <h2 className="panel-title">{title}</h2>}
            {subtitle && <p className="panel-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

function MetricCard({ label, value, note, tone }) {
  return (
    <article className="metric-card" style={{ "--tone": tone }}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-note">{note}</div>
    </article>
  );
}

function SliderControl({ label, value, display, min, max, step, onChange, tone, hint }) {
  const percent = ((value - min) / (max - min || 1)) * 100;
  return (
    <label className="slider-control" style={{ "--tone": tone, "--fill": `${percent}%` }}>
      <div className="slider-row">
        <span className="slider-label">{label}</span>
        <span className="slider-value">{display}</span>
      </div>
      {hint && <div className="slider-hint">{hint}</div>}
      <div className="slider-track">
        <input
          className="slider-input"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(+event.target.value)}
        />
      </div>
    </label>
  );
}

function SignalRow({ label, note, value, tone }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className="signal-row" style={{ "--tone": tone, "--fill": `${Math.max(4, clamped * 100)}%` }}>
      <div className="signal-copy">
        <span className="signal-label">{label}</span>
        <span className="signal-note">{note}</span>
      </div>
      <div className="signal-track">
        <span className="signal-fill" />
      </div>
    </div>
  );
}

function HistoryChart({ history }) {
  const canvasRef = useRef(null);
  const { isDark } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 24;
    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;

    context.clearRect(0, 0, width, height);
    context.fillStyle = isDark ? "rgba(6, 13, 15, 0.92)" : "rgba(255, 252, 247, 0.96)";
    context.fillRect(0, 0, width, height);

    context.strokeStyle = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
    context.lineWidth = 1;
    for (let line = 0; line <= 4; line += 1) {
      const y = padding + (innerHeight * line) / 4;
      context.beginPath();
      context.moveTo(padding, y);
      context.lineTo(width - padding, y);
      context.stroke();
    }

    if (history.length < 2) {
      context.fillStyle = isDark ? "rgba(232,243,240,0.56)" : "rgba(24,35,41,0.5)";
      context.font = "500 18px 'IBM Plex Sans', sans-serif";
      context.fillText("Run the simulation to build a telemetry trace.", padding, height / 2);
      return;
    }

    const clSeries = history.map((entry) => entry.cl);
    const cdSeries = history.map((entry) => entry.cd);
    const minValue = Math.min(0, ...clSeries, ...cdSeries);
    const maxValue = Math.max(0.1, ...clSeries, ...cdSeries);
    const range = maxValue - minValue || 1;

    const mapX = (index) => padding + (index / (history.length - 1)) * innerWidth;
    const mapY = (value) => padding + innerHeight - ((value - minValue) / range) * innerHeight;

    const zeroY = mapY(0);
    context.strokeStyle = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.15)";
    context.beginPath();
    context.moveTo(padding, zeroY);
    context.lineTo(width - padding, zeroY);
    context.stroke();

    const drawSeries = (series, color, fillColor) => {
      context.beginPath();
      series.forEach((value, index) => {
        const x = mapX(index);
        const y = mapY(value);
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.lineWidth = 2.5;
      context.strokeStyle = color;
      context.stroke();

      context.lineTo(mapX(series.length - 1), mapY(minValue));
      context.lineTo(mapX(0), mapY(minValue));
      context.closePath();
      context.fillStyle = fillColor;
      context.fill();
    };

    drawSeries(clSeries, isDark ? "#f7f7f7" : "#1b1b1d", isDark ? "rgba(247,247,247,0.08)" : "rgba(27,27,29,0.08)");
    drawSeries(cdSeries, isDark ? "#e10600" : "#d50a00", isDark ? "rgba(225,6,0,0.14)" : "rgba(213,10,0,0.12)");
  }, [history, isDark]);

  return <canvas ref={canvasRef} className="history-chart" width={720} height={320} />;
}

function AnalysisPanel({ history, miniRef, running, exportCSV, stats, ldRatio, regime, modeMeta }) {
  const recentRows = history.slice(-8).reverse();

  return (
    <div className="analysis-layout">
      <Panel
        eyebrow="Timing Tower"
        title="Session Trace"
        subtitle="Lift and drag stay live through the stint so you can compare packages like lap deltas."
        actions={
          <button className="ghost-button" type="button" onClick={exportCSV} disabled={!history.length}>
            Export CSV
          </button>
        }
      >
        <div className="analysis-hero">
          <div>
            <div className="analysis-lead">{modeMeta.label} mode is active</div>
            <p className="analysis-copy">
              Let the trace settle, export the lap sheet, then compare the next setup change against a stable run.
            </p>
          </div>
          <div className="analysis-kpis">
            <MetricCard label="CL" value={stats.cl} note="Latest lift" tone="var(--accent-green)" />
            <MetricCard label="CD" value={stats.cd} note="Latest drag" tone="var(--accent-orange)" />
            <MetricCard label="L/D" value={ldRatio} note="Current efficiency" tone="var(--accent-cyan)" />
            <MetricCard label="Flow" value={regime.label} note="Reynolds regime" tone={regime.col} />
          </div>
        </div>
        <HistoryChart history={history} />
      </Panel>

      <div className="analysis-grid">
        <Panel eyebrow="Track Feed" title="Trackside Monitor" subtitle="Live mirror of the active tunnel canvas.">
          <canvas ref={miniRef} width={420} height={220} className="preview-canvas preview-canvas--wide" />
          <div className={`status-pill status-pill--inline ${running ? "is-live" : ""}`}>
            <span className="status-dot" />
            <span>{running ? "Green flag" : "Session held"}</span>
          </div>
        </Panel>

        <Panel eyebrow="Recent Runs" title="Latest Timing Samples" subtitle="Newest rows first.">
          <div className="history-table">
            <div className="history-row history-row--head">
              <span>Time</span>
              <span>CL</span>
              <span>CD</span>
              <span>Re</span>
            </div>
            {recentRows.length ? (
              recentRows.map((entry) => (
                <div className="history-row" key={entry.t}>
                  <span>{new Date(entry.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                  <span>{entry.cl}</span>
                  <span>{entry.cd}</span>
                  <span>{entry.re}</span>
                </div>
              ))
            ) : (
              <div className="history-empty">No laps logged yet.</div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function AboutPanel() {
  return (
    <div className="about-layout">
      <Panel
        className="hero-panel"
        eyebrow="Garage Notes"
        title="A pit-wall style interface for quick aero stints"
        subtitle="AeroLab wraps a lightweight Lattice Boltzmann solver in a control surface modeled after timing screens, setup sheets, and trackside monitors."
      >
        <div className="about-hero">
          <p>
            The solver runs on a D2Q9 lattice with BGK collision, bounce-back solid walls, and inlet forcing. It is not a full
            production CFD environment, but it is fast enough to expose separation, wake structure, and directional changes in real
            time while you move geometry and tune flow conditions.
          </p>
          <div className="about-badges">
            <span className="tag">LBM D2Q9</span>
            <span className="tag">Float32 solver</span>
            <span className="tag">Import + sketch workflow</span>
            <span className="tag">CSV export</span>
          </div>
        </div>
      </Panel>

      <div className="about-grid">
        <Panel eyebrow="What Changed" title="The Formula 1 direction" subtitle="Sharper hierarchy, harder contrast, and a stronger race-weekend UI language.">
          <div className="feature-grid">
            {ABOUT_FEATURES.map((feature) => (
              <article className="feature-card" key={feature.title}>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </Panel>

        <Panel eyebrow="Weekend Loop" title="How to use it" subtitle="Treat the app like a fast pit-wall study tool, not a full production CFD stack.">
          <ol className="method-list">
            {METHOD_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="support-note">
            Grid: {COLS} x {ROWS} ({(COLS * ROWS).toLocaleString()} cells) · Files: SVG, STL, DXF, PNG, JPG
          </div>
        </Panel>
      </div>
    </div>
  );
}

export default function CFDLab() {
  const { isDark } = useTheme();

  const solverRef = useRef(null);
  const partsRef = useRef(makeParticlePool());
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const drawRef = useRef(null);
  const miniRef = useRef(null);
  const rafRef = useRef(null);
  const frameRef = useRef(0);
  const imageRef = useRef(null);
  const drawingRef = useRef(false);
  const drawnPointsRef = useRef([]);

  const [view, setView] = useState("tunnel");
  const [tab, setTab] = useState("preset");
  const [running, setRunning] = useState(false);
  const [visualMode, setVisualMode] = useState("velocity");
  const [preset, setPreset] = useState("f1car");
  const [polygon, setPolygon] = useState(() => generatePreset("f1car"));
  const [error, setError] = useState("");
  const [simplify, setSimplify] = useState(0);
  const [stats, setStats] = useState({ cl: 0, cd: 0, re: 0, maxV: 0 });
  const [particleCount, setParticleCount] = useState(DEFAULT_PARTICLES);
  const [trailOpacity, setTrailOpacity] = useState(1);
  const [simSpeed, setSimSpeed] = useState(1);
  const [fps, setFps] = useState(0);
  const [centerX, setCenterX] = useState(COLS * 0.35);
  const [centerY, setCenterY] = useState(ROWS / 2);
  const [scaleX, setScaleX] = useState(COLS * 0.25);
  const [scaleY, setScaleY] = useState(ROWS * 0.45);
  const [angleOfAttack, setAngleOfAttack] = useState(0);
  const [velocity, setVelocity] = useState(0.12);
  const [turbulence, setTurbulence] = useState(0.15);
  const [viscosity, setViscosity] = useState(0.015);
  const [historyRef, pushHistory] = useHistory(200);
  const [historySnap, setHistorySnap] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [autoRun, setAutoRun] = useState(true);

  const fpsFramesRef = useRef(0);
  const fpsTickRef = useRef(0);
  const runningRef = useRef(false);
  const visualModeRef = useRef("velocity");
  const polygonRef = useRef(null);
  const centerXRef = useRef(0);
  const centerYRef = useRef(0);
  const scaleXRef = useRef(0);
  const scaleYRef = useRef(0);
  const aoaRef = useRef(0);
  const simplifyRef = useRef(0);
  const velocityRef = useRef(0.12);
  const turbulenceRef = useRef(0.15);
  const viscosityRef = useRef(0.015);
  const themeRef = useRef(true);
  const particleCountRef = useRef(DEFAULT_PARTICLES);
  const trailOpacityRef = useRef(1);
  const simSpeedRef = useRef(1);

  useEffect(() => {
    if (!solverRef.current) {
      const solver = new LBM(COLS, ROWS);
      solver.setNu(0.015);
      solverRef.current = solver;
    }
    fpsTickRef.current = performance.now();
  }, []);

  useEffect(() => {
    themeRef.current = isDark;
  }, [isDark]);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    visualModeRef.current = visualMode;
  }, [visualMode]);

  useEffect(() => {
    velocityRef.current = velocity;
  }, [velocity]);

  useEffect(() => {
    turbulenceRef.current = turbulence;
  }, [turbulence]);

  useEffect(() => {
    viscosityRef.current = viscosity;
    if (solverRef.current) solverRef.current.setNu(viscosity);
  }, [viscosity]);

  useEffect(() => {
    particleCountRef.current = particleCount;
    resizeParticlePool(partsRef.current, particleCount);
  }, [particleCount]);

  useEffect(() => {
    trailOpacityRef.current = trailOpacity;
  }, [trailOpacity]);

  useEffect(() => {
    simSpeedRef.current = simSpeed;
  }, [simSpeed]);

  const rebuildSolid = useCallback(() => {
    const rawPolygon = polygonRef.current;
    if (!rawPolygon || !solverRef.current) return;
    const nextPolygon = simplifyRef.current > 0 ? simplifyPolygon(rawPolygon, simplifyRef.current * 0.005) : rawPolygon;
    solverRef.current.buildSolid(
      transformPolygon(nextPolygon, centerXRef.current, centerYRef.current, scaleXRef.current, scaleYRef.current, aoaRef.current)
    );
  }, []);

  useEffect(() => {
    aoaRef.current = angleOfAttack;
    centerXRef.current = centerX;
    centerYRef.current = centerY;
    scaleXRef.current = scaleX;
    scaleYRef.current = scaleY;
    rebuildSolid();
  }, [angleOfAttack, centerX, centerY, scaleX, scaleY, rebuildSolid]);

  useEffect(() => {
    polygonRef.current = polygon;
    simplifyRef.current = simplify;
    rebuildSolid();
  }, [polygon, simplify, rebuildSolid]);

  const resetSolver = useCallback(() => {
    const solver = new LBM(COLS, ROWS);
    solver.setNu(viscosityRef.current);
    solverRef.current = solver;
    rebuildSolid();
  }, [rebuildSolid]);

  const toggleFullscreen = useCallback(() => {
    const element = wrapRef.current;
    if (!element) return;
    if (!document.fullscreenElement) {
      element.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreen = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreen);
    return () => document.removeEventListener("fullscreenchange", handleFullscreen);
  }, []);

  const captureSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `aerolab-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, []);

  const exportCSV = useCallback(() => {
    const data = historyRef.current;
    if (!data.length) return;
    const blob = new Blob(
      ["t,cl,cd,re,maxV\n" + data.map((row) => `${row.t},${row.cl},${row.cd},${row.re},${row.maxV}`).join("\n")],
      { type: "text/csv" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `aerolab-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [historyRef]);

  const resetAll = useCallback(() => {
    setRunning(false);
    setVelocity(0.12);
    setTurbulence(0.15);
    setViscosity(0.015);
    setCenterX(COLS * 0.35);
    setCenterY(ROWS / 2);
    setScaleX(COLS * 0.25);
    setScaleY(ROWS * 0.45);
    setAngleOfAttack(0);
    setSimplify(0);
    setParticleCount(DEFAULT_PARTICLES);
    setTrailOpacity(1);
    setSimSpeed(1);
    setPreset("f1car");
    setTab("preset");
    setPolygon(generatePreset("f1car"));
    setStats({ cl: 0, cd: 0, re: 0, maxV: 0 });
    historyRef.current = [];
    setHistorySnap([]);
    const solver = new LBM(COLS, ROWS);
    solver.setNu(0.015);
    solverRef.current = solver;
    if (drawRef.current) {
      const context = drawRef.current.getContext("2d");
      context?.clearRect(0, 0, drawRef.current.width, drawRef.current.height);
    }
  }, [historyRef]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const tag = event.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      switch (event.code) {
        case "Space":
          event.preventDefault();
          setRunning((prev) => !prev);
          break;
        case "KeyR":
          resetSolver();
          break;
        case "Digit1":
          setVisualMode("velocity");
          break;
        case "Digit2":
          setVisualMode("pressure");
          break;
        case "Digit3":
          setVisualMode("streamlines");
          break;
        case "Digit4":
          setVisualMode("vorticity");
          break;
        case "KeyF":
          toggleFullscreen();
          break;
        case "KeyS":
          if (!event.ctrlKey && !event.metaKey) captureSnapshot();
          break;
        case "Slash":
          event.preventDefault();
          setShowKeys((prev) => !prev);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [captureSnapshot, resetSolver, toggleFullscreen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    imageRef.current = context.createImageData(SIM_W, SIM_H);
    const DX = SIM_W / COLS;
    const DY = SIM_H / ROWS;

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const solver = solverRef.current;
      if (!solver) return;

      const inletVelocity = velocityRef.current;
      if (runningRef.current) {
        const steps = simSpeedRef.current;
        for (let step = 0; step < steps; step += 1) solver.step(inletVelocity, turbulenceRef.current);
      }

      frameRef.current += 1;
      fpsFramesRef.current += 1;
      const now = performance.now();
      if (now - fpsTickRef.current >= 1000) {
        setFps(fpsFramesRef.current);
        fpsFramesRef.current = 0;
        fpsTickRef.current = now;
      }

      const dark = themeRef.current;
      const mode = visualModeRef.current;
      const image = imageRef.current;
      const buffer32 = new Uint32Array(image.data.buffer);
      const solidColor = dark ? (255 << 24) | (52 << 16) | (36 << 8) | 40 : (255 << 24) | (196 << 16) | (174 << 8) | 180;
      const backgroundColor = dark ? (255 << 24) | (13 << 16) | (8 << 8) | 10 : (255 << 24) | (244 << 16) | (232 << 8) | 236;

      if (mode === "streamlines") {
        buffer32.fill(backgroundColor);
        for (let cell = 0; cell < solver.N; cell += 1) {
          if (!solver.solid[cell]) continue;
          const col = cell % COLS;
          const row = (cell / COLS) | 0;
          const x0 = (col * DX) | 0;
          const y0 = (row * DY) | 0;
          const x1 = Math.min(((col + 1) * DX) | 0, SIM_W);
          const y1 = Math.min(((row + 1) * DY) | 0, SIM_H);
          for (let py = y0; py < y1; py += 1) {
            for (let px = x0; px < x1; px += 1) buffer32[py * SIM_W + px] = solidColor;
          }
        }
      } else {
        const lut = mode === "pressure" ? COOLWARM : TURBO;
        const field = mode === "velocity" ? solver.spd : mode === "pressure" ? solver.rho : solver.curl;
        let fieldMin = 1e9;
        let fieldMax = -1e9;
        for (let cell = 0; cell < solver.N; cell += 1) {
          if (solver.solid[cell]) continue;
          const value = field[cell];
          if (value < fieldMin) fieldMin = value;
          if (value > fieldMax) fieldMax = value;
        }
        const fieldRange = fieldMax - fieldMin;
        if (fieldRange < 1e-10) {
          buffer32.fill(lut[128]);
        } else {
          const invRange = 255 / fieldRange;
          const invDX = COLS / SIM_W;
          const invDY = ROWS / SIM_H;
          for (let py = 0; py < SIM_H; py += 1) {
            const row = Math.min(ROWS - 1, (py * invDY) | 0);
            const rowOffset = py * SIM_W;
            for (let px = 0; px < SIM_W; px += 1) {
              const col = Math.min(COLS - 1, (px * invDX) | 0);
              const cell = row * COLS + col;
              buffer32[rowOffset + px] = solver.solid[cell]
                ? solidColor
                : lut[Math.max(0, Math.min(255, ((field[cell] - fieldMin) * invRange) | 0))];
            }
          }
        }
      }

      context.putImageData(image, 0, 0);

      const particles = partsRef.current;
      const count = particleCountRef.current;
      const opacity = trailOpacityRef.current;
      for (let index = 0; index < count && index < particles.length; index += 1) particles[index].update(solver);

      if ((mode === "streamlines" || mode === "velocity" || mode === "vorticity") && opacity > 0) {
        context.lineCap = "round";
        context.lineJoin = "round";
        const streamlines = mode === "streamlines";
        const alphas = streamlines ? [0.15, 0.4, 0.8] : [0.08, 0.2, 0.35];
        const widths = streamlines ? [0.4, 0.7, 1.1] : [0.3, 0.5, 0.6];
        const colors = streamlines
          ? dark
            ? ["rgba(225,6,0,", "rgba(255,158,66,", "rgba(247,247,247,"]
            : ["rgba(145,18,15,", "rgba(169,94,22,", "rgba(27,27,29,"]
          : dark
            ? ["rgba(255,255,255,", "rgba(255,255,255,", "rgba(255,255,255,"]
            : ["rgba(0,0,0,", "rgba(0,0,0,", "rgba(0,0,0,"];

        for (let band = 0; band < 3; band += 1) {
          context.strokeStyle = colors[band] + alphas[band] * opacity + ")";
          context.lineWidth = widths[band];
          context.beginPath();
          const start = band === 0 ? 0 : band === 1 ? Math.floor(TRAIL_LEN * 0.33) : Math.floor(TRAIL_LEN * 0.66);
          const end = band === 0 ? Math.floor(TRAIL_LEN * 0.33) : band === 1 ? Math.floor(TRAIL_LEN * 0.66) : TRAIL_LEN;
          for (let index = 0; index < count && index < particles.length; index += 1) {
            const particle = particles[index];
            if (!particle.active || particle.tl < 3) continue;
            const trailStart = particle.ti - particle.tl;
            const from = trailStart + Math.floor((start * particle.tl) / TRAIL_LEN);
            const to = trailStart + Math.floor((end * particle.tl) / TRAIL_LEN);
            let started = false;
            for (let trailIndex = from; trailIndex < to && trailIndex < particle.ti; trailIndex += 1) {
              const wrapped = ((trailIndex % TRAIL_LEN) + TRAIL_LEN) % TRAIL_LEN;
              if (!started) {
                context.moveTo(particle.tx[wrapped], particle.ty[wrapped]);
                started = true;
              } else {
                context.lineTo(particle.tx[wrapped], particle.ty[wrapped]);
              }
            }
          }
          context.stroke();
        }
      }

      const rawPolygon = polygonRef.current;
      if (rawPolygon) {
        const simplified = simplifyRef.current > 0 ? simplifyPolygon(rawPolygon, simplifyRef.current * 0.005) : rawPolygon;
        const transformed = transformPolygon(
          simplified,
          centerXRef.current,
          centerYRef.current,
          scaleXRef.current,
          scaleYRef.current,
          aoaRef.current
        );
        const outlineColor = dark ? "#e10600" : "#d50a00";
        context.beginPath();
        transformed.forEach(([gx, gy], index) => {
          const px = gx * DX;
          const py = gy * DY;
          if (index === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        });
        context.closePath();
        context.strokeStyle = outlineColor;
        context.lineWidth = 1.6;
        context.shadowColor = outlineColor;
        context.shadowBlur = dark ? 10 : 5;
        context.stroke();
        context.shadowBlur = 0;
      }

      if (runningRef.current && frameRef.current % 15 === 0) {
        let maxVelocityRatio = 0;
        let totalLift = 0;
        let totalDrag = 0;
        let sampleCount = 0;
        for (let cell = 0; cell < solver.N; cell += 1) {
          if (solver.solid[cell]) continue;
          const speed = solver.spd[cell];
          if (!Number.isFinite(speed)) continue;
          sampleCount += 1;
          if (speed > maxVelocityRatio) maxVelocityRatio = speed;
          totalLift += solver.uy[cell];
          totalDrag += Math.abs(solver.ux[cell] - inletVelocity);
        }
        const reynolds = (inletVelocity * scaleXRef.current) / (viscosityRef.current + 1e-6) * 10;
        const cl = sampleCount > 0 ? Math.abs((totalLift / sampleCount) * 2 * (1 + aoaRef.current * 0.06)) : 0;
        const cd = sampleCount > 0 ? totalDrag / sampleCount * 0.5 + 0.008 : 0;
        const nextStats = {
          cl: +cl.toFixed(4),
          cd: +cd.toFixed(4),
          re: Math.round(reynolds),
          maxV: inletVelocity > 0 ? +(maxVelocityRatio / inletVelocity).toFixed(3) : 0,
        };
        setStats(nextStats);
        pushHistory(nextStats);
      }

      const miniCanvas = miniRef.current;
      const miniContext = miniCanvas?.getContext("2d");
      if (miniCanvas && miniContext) miniContext.drawImage(canvas, 0, 0, miniCanvas.width, miniCanvas.height);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [pushHistory]);

  const applyPolygon = useCallback(
    (nextPolygon) => {
      if (!nextPolygon) return;
      setPreset("custom");
      setPolygon(nextPolygon);
      setError("");
      setView("tunnel");
      if (autoRun) setRunning(true);
    },
    [autoRun]
  );

  const updateSimplify = useCallback(
    (value) => {
      setSimplify(value);
      if (autoRun) setRunning(true);
    },
    [autoRun]
  );

  const handleFile = useCallback(
    (file) => {
      if (!file) return;
      setError("");
      const name = file.name.toLowerCase();
      const load = (mode, parser) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const parsed = parser(event.target.result);
          if (!parsed) {
            setError(`Parse failed: ${name.split(".").pop().toUpperCase()}`);
            return;
          }
          applyPolygon(parsed);
        };
        if (mode === "text") reader.readAsText(file);
        else reader.readAsArrayBuffer(file);
      };

      if (name.endsWith(".svg")) {
        load("text", parseSVG);
      } else if (name.endsWith(".stl")) {
        load("buffer", parseSTL);
      } else if (name.endsWith(".dxf")) {
        load("text", parseDXF);
      } else if (file.type?.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement("canvas");
          const width = Math.min(image.width, 200);
          const height = Math.min(image.height, 200);
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          context?.drawImage(image, 0, 0, width, height);
          const parsed = traceImage(context.getImageData(0, 0, width, height), width, height);
          URL.revokeObjectURL(url);
          if (!parsed) {
            setError("Edge trace failed.");
            return;
          }
          applyPolygon(parsed);
        };
        image.src = url;
      } else {
        setError("Use SVG, STL, DXF, PNG, or JPG.");
      }
    },
    [applyPolygon]
  );

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      handleFile(event.dataTransfer?.files?.[0]);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (event) => {
      handleFile(event.target.files[0]);
      event.target.value = "";
    },
    [handleFile]
  );

  const getDrawPoint = (event) => {
    const drawCanvas = drawRef.current;
    const rect = drawCanvas.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    return [(clientX - rect.left) * (drawCanvas.width / rect.width), (clientY - rect.top) * (drawCanvas.height / rect.height)];
  };

  const startDraw = (event) => {
    event.preventDefault();
    drawingRef.current = true;
    const context = drawRef.current.getContext("2d");
    context?.clearRect(0, 0, drawRef.current.width, drawRef.current.height);
    drawnPointsRef.current = [getDrawPoint(event)];
  };

  const moveDraw = (event) => {
    event.preventDefault();
    if (!drawingRef.current) return;
    const [x, y] = getDrawPoint(event);
    drawnPointsRef.current.push([x, y]);
    const context = drawRef.current.getContext("2d");
    if (!context) return;
    context.strokeStyle = isDark ? "#e10600" : "#d50a00";
    context.lineWidth = 2;
    context.lineCap = "round";
    const points = drawnPointsRef.current;
    if (points.length > 1) {
      context.beginPath();
      context.moveTo(points[points.length - 2][0], points[points.length - 2][1]);
      context.lineTo(x, y);
      context.stroke();
    }
  };

  const endDraw = () => {
    drawingRef.current = false;
    const points = drawnPointsRef.current;
    if (points.length < 5) return;
    const parsed = normalizePolygon(points);
    if (parsed) {
      setTab("draw");
      applyPolygon(parsed);
    }
  };

  const regime = useMemo(() => {
    if (stats.re < 2300) return { label: "Laminar", col: "var(--accent-green)" };
    if (stats.re < 4000) return { label: "Transitional", col: "var(--accent-orange)" };
    return { label: "Turbulent", col: "var(--accent-red-stat)" };
  }, [stats.re]);

  const ldRatio = useMemo(() => (stats.cd > 0 ? (stats.cl / stats.cd).toFixed(2) : "-"), [stats.cl, stats.cd]);

  useEffect(() => {
    const interval = setInterval(() => setHistorySnap([...historyRef.current]), 500);
    return () => clearInterval(interval);
  }, [historyRef]);

  const currentMode = MODE_OPTIONS.find((option) => option.id === visualMode) ?? MODE_OPTIONS[0];
  const currentPreset = PRESET_LOOKUP[preset];
  const activeImport = IMPORT_TABS.find((option) => option.id === tab);
  const geometryLabel = currentPreset ? currentPreset.label : activeImport?.label ? `${activeImport.label} geometry` : "Custom geometry";
  const geometryNote = currentPreset ? currentPreset.description : "Imported or hand-sketched profile";
  const metrics = [
    { label: "CL", value: stats.cl, note: "Lift coefficient", tone: "var(--accent-green)" },
    { label: "CD", value: stats.cd, note: "Drag coefficient", tone: "var(--accent-orange)" },
    { label: "L/D", value: ldRatio, note: "Efficiency ratio", tone: "var(--accent-cyan)" },
    {
      label: "Re",
      value: stats.re > 999 ? `${(stats.re / 1000).toFixed(1)}k` : stats.re,
      note: "Reynolds number",
      tone: "var(--accent-orange)",
    },
    { label: "U/U0", value: stats.maxV, note: "Peak velocity ratio", tone: "var(--accent-cyan)" },
    { label: "Flow", value: regime.label, note: "Regime estimate", tone: regime.col },
  ];

  const diagnosticSignals = [
    { label: "Inlet speed", note: `${velocity.toFixed(3)} solver units`, value: velocity / 0.18, tone: "var(--accent-cyan)" },
    { label: "Turbulence", note: `${turbulence.toFixed(1)} injected noise`, value: turbulence / 3, tone: "var(--accent-orange)" },
    { label: "Viscosity", note: `${viscosity.toFixed(3)} nu`, value: viscosity / 0.1, tone: "var(--accent-green)" },
    { label: "Particles", note: `${particleCount}/${MAX_PARTICLES} active`, value: particleCount / MAX_PARTICLES, tone: "var(--accent-red)" },
  ];

  const renderImportSurface = () => {
    if (tab === "preset") {
      return PRESET_GROUPS.map((group) => (
        <div className="preset-group" key={group.label}>
          <div className="preset-group__label">{group.label}</div>
          <div className="preset-grid">
            {group.items.map((item) => (
              <button
                key={item.id}
                className={`preset-card ${preset === item.id ? "is-active" : ""}`}
                type="button"
                      onClick={() => {
                        setPreset(item.id);
                        setPolygon(generatePreset(item.id));
                        setTab("preset");
                        setView("tunnel");
                        setError("");
                        if (autoRun) setRunning(true);
                      }}
              >
                <span>{item.label}</span>
                <small>{item.description}</small>
              </button>
            ))}
          </div>
        </div>
      ));
    }

    if (tab === "draw") {
      return (
        <div className="sketch-surface">
          <canvas
            ref={drawRef}
            width={320}
            height={180}
            className="sketch-canvas"
            onMouseDown={startDraw}
            onMouseMove={moveDraw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={moveDraw}
            onTouchEnd={endDraw}
          />
          <p className="drop-help">Sketch a closed contour and release to normalize it into the tunnel.</p>
        </div>
      );
    }

    const accept =
      tab === "svg"
        ? ".svg"
        : tab === "stl"
          ? ".stl"
          : tab === "dxf"
            ? ".dxf"
            : "image/*";

    return (
      <label className="dropzone">
        <span>{tab === "image" ? "Load a PNG or JPG trace" : `Load a ${tab.toUpperCase()} file`}</span>
        <small>Drag a file here or browse from disk.</small>
        <input type="file" accept={accept} hidden onChange={handleFileInput} />
      </label>
    );
  };

  return (
    <div className="lab-shell" ref={wrapRef}>
      <div className="lab-shell__backdrop" />
      <header className="lab-header">
        <div className="brand-block">
          <div className="brand-mark">
            <F1Logo size={28} />
          </div>
          <div>
            <div className="brand-eyebrow">AeroLab // FP1</div>
            <h1 className="brand-title">Pit Wall Aero Session</h1>
            <p className="brand-copy">Single-seater inspired flow analysis with a race-weekend hierarchy: package sheet, track feed, timing tower.</p>
          </div>
        </div>

        <nav className="view-switch" aria-label="Views">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.id}
              className={`view-switch__button ${view === option.id ? "is-active" : ""}`}
              type="button"
              onClick={() => setView(option.id)}
            >
              <span>{option.eyebrow}</span>
              <strong>{option.label}</strong>
            </button>
          ))}
        </nav>

        <div className="header-tools">
          <div className={`start-lights ${running ? "is-live" : ""}`} aria-hidden="true">
            {[0, 1, 2, 3, 4].map((light) => (
              <span key={light} />
            ))}
          </div>
          <div className={`status-pill ${running ? "is-live" : ""}`}>
            <span className="status-dot" />
            <span>{running ? "Green Flag" : "Session Hold"}</span>
          </div>
          <div className="status-pill status-pill--quiet">{fps} FPS</div>
          <ThemeToggle />
        </div>
      </header>

      <div className="session-strip">
        <div className="session-cell">
          <span>Session</span>
          <strong>FP1 Aero Run</strong>
        </div>
        <div className="session-cell">
          <span>Package</span>
          <strong>{geometryLabel}</strong>
        </div>
        <div className="session-cell">
          <span>Mode</span>
          <strong>{currentMode.label}</strong>
        </div>
        <div className="session-cell">
          <span>Status</span>
          <strong>{running ? "Green Flag" : "Hold"}</strong>
        </div>
        <div className="session-cell">
          <span>Grid</span>
          <strong>{COLS} x {ROWS}</strong>
        </div>
      </div>

      <main className="lab-main">
        {view === "tunnel" && (
          <div className="tunnel-layout">
            <section className="stage-column">
              <Panel
                className="hero-panel"
                eyebrow="Pit Wall"
                title="Run the aero package like a live Formula 1 session"
                subtitle={currentMode.description}
              >
                <div className="hero-grid">
                  <div className="hero-copy">
                    <div className="hero-highlight">{geometryLabel}</div>
                    <p>
                      {geometryNote}. Use the left deck to alter geometry and solver behaviour, then inspect the live telemetry and
                      preview rail for trend changes.
                    </p>
                    <div className="hero-tags">
                      <span className="tag">{COLS} x {ROWS} cells</span>
                      <span className="tag">{currentMode.label} view</span>
                      <span className="tag">{autoRun ? "Auto green-flag" : "Manual release"}</span>
                    </div>
                  </div>

                  <div className="hero-actions">
                    <button className="primary-button" type="button" onClick={() => setRunning((prev) => !prev)}>
                      {running ? "Throw Red Flag" : "Green Flag Run"}
                    </button>
                    <button className="ghost-button" type="button" onClick={resetSolver}>
                      Reset Stint
                    </button>
                    <button className="ghost-button" type="button" onClick={captureSnapshot}>
                      Capture Frame
                    </button>
                    <button className="ghost-button" type="button" onClick={exportCSV} disabled={!historySnap.length}>
                      Export Lap Sheet
                    </button>
                    <button className="ghost-button" type="button" onClick={toggleFullscreen}>
                      {isFullscreen ? "Exit Feed" : "Full Feed"}
                    </button>
                    <button className="ghost-button" type="button" onClick={resetAll}>
                      Baseline Reset
                    </button>
                  </div>
                </div>
              </Panel>

              <Panel
                eyebrow="Track Feed"
                title="Session Canvas"
                subtitle={currentMode.legend}
                actions={
                  <button className="quiet-button" type="button" onClick={() => setShowKeys((prev) => !prev)}>
                    {showKeys ? "Hide controls" : "Show controls"}
                  </button>
                }
              >
                <div className="mode-toolbar">
                  <div className="mode-toolbar__list">
                    {MODE_OPTIONS.map((option, index) => (
                      <button
                        key={option.id}
                        className={`mode-chip ${visualMode === option.id ? "is-active" : ""}`}
                        style={{ "--tone": option.accent }}
                        type="button"
                        onClick={() => setVisualMode(option.id)}
                        title={`${option.label} [${index + 1}]`}
                      >
                        <span>{isMobile ? option.shortLabel : option.label}</span>
                      </button>
                    ))}
                  </div>

                  <label className={`toggle-chip ${autoRun ? "is-active" : ""}`}>
                    <input
                      type="checkbox"
                      checked={autoRun}
                      onChange={() => setAutoRun((prev) => !prev)}
                    />
                    <span>Auto-release each change</span>
                  </label>
                </div>

                {showKeys && (
                  <div className="shortcut-grid">
                    {SHORTCUTS.map(([key, description]) => (
                      <div className="shortcut-item" key={key}>
                        <kbd>{key}</kbd>
                        <span>{description}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="stage-panel">
                  <div className="stage-panel__hud">
                    <div className="hud-chip">
                      <F1Logo size={12} />
                      <span>Air in {"->"} dirty air out</span>
                    </div>
                    <div className="hud-chip">{currentMode.label}</div>
                  </div>
                  <canvas ref={canvasRef} width={SIM_W} height={SIM_H} className="stage-panel__canvas" />
                  <div className="stage-panel__legend">
                    <span>High</span>
                    <div
                      className="legend-bar"
                      style={{
                        background:
                          visualMode === "pressure" ? "var(--colorbar-pressure)" : "var(--colorbar-velocity)",
                      }}
                    />
                    <span>Low</span>
                  </div>
                  <div className="stage-panel__footer">
                    <div className="footer-stat">
                      <span>Package</span>
                      <strong>{geometryLabel}</strong>
                    </div>
                    <div className="footer-stat">
                      <span>AoA</span>
                      <strong>{angleOfAttack} deg</strong>
                    </div>
                    <div className="footer-stat">
                      <span>Wake Traces</span>
                      <strong>{particleCount}</strong>
                    </div>
                  </div>
                </div>
              </Panel>

              <div className="metrics-grid">
                {metrics.map((metric) => (
                  <MetricCard key={metric.label} label={metric.label} value={metric.value} note={metric.note} tone={metric.tone} />
                ))}
              </div>
            </section>

            <aside className="control-column">
              <Panel
                eyebrow="Garage"
                title="Select the aero package"
                subtitle="Benchmarks, imported sections, and a quick trace pad all feed the same session."
              >
                <div className="import-tabs">
                  {IMPORT_TABS.map((option) => (
                    <button
                      key={option.id}
                      className={`import-tab ${tab === option.id ? "is-active" : ""}`}
                      type="button"
                      onClick={() => {
                        setTab(option.id);
                        setError("");
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="import-surface" onDrop={handleDrop} onDragOver={(event) => event.preventDefault()}>
                  {renderImportSurface()}
                </div>

                <div className="drop-help">Current package: {geometryLabel}. Drag and drop is enabled across this garage card.</div>
                {error && <div className="error-callout">{error}</div>}
              </Panel>

              <Panel eyebrow="Setup Sheet" title="Position the package" subtitle="Adjust origin, scale, and angle before comparing one stint to the next.">
                <div className="slider-stack">
                  <SliderControl
                    label="Position X"
                    value={centerX}
                    display={centerX.toFixed(0)}
                    min={10}
                    max={COLS - 10}
                    step={1}
                    onChange={setCenterX}
                    tone="var(--accent-cyan)"
                  />
                  <SliderControl
                    label="Position Y"
                    value={centerY}
                    display={centerY.toFixed(0)}
                    min={4}
                    max={ROWS - 4}
                    step={1}
                    onChange={setCenterY}
                    tone="var(--accent-cyan)"
                  />
                  <SliderControl
                    label="Scale X"
                    value={scaleX}
                    display={scaleX.toFixed(0)}
                    min={10}
                    max={COLS * 0.5}
                    step={1}
                    onChange={setScaleX}
                    tone="var(--accent-green)"
                  />
                  <SliderControl
                    label="Scale Y"
                    value={scaleY}
                    display={scaleY.toFixed(0)}
                    min={5}
                    max={ROWS * 0.7}
                    step={1}
                    onChange={setScaleY}
                    tone="var(--accent-green)"
                  />
                  <SliderControl
                    label="Angle of attack"
                    value={angleOfAttack}
                    display={`${angleOfAttack} deg`}
                    min={-25}
                    max={35}
                    step={1}
                    onChange={setAngleOfAttack}
                    tone="var(--accent-orange)"
                  />
                  <SliderControl
                    label="Simplify"
                    value={simplify}
                    display={simplify}
                    min={0}
                    max={20}
                    step={1}
                    onChange={updateSimplify}
                    tone="var(--accent-red)"
                    hint="Higher values reduce point count before building the solid mask."
                  />
                </div>
              </Panel>

              <Panel eyebrow="Race Control" title="Tune the session" subtitle="Balance flow realism, pace, and wake readability from one control block.">
                <div className="slider-stack">
                  <SliderControl
                    label="Inlet velocity"
                    value={velocity}
                    display={velocity.toFixed(3)}
                    min={0.02}
                    max={0.18}
                    step={0.005}
                    onChange={setVelocity}
                    tone="var(--accent-cyan)"
                  />
                  <SliderControl
                    label="Turbulence"
                    value={turbulence}
                    display={turbulence.toFixed(1)}
                    min={0}
                    max={3}
                    step={0.1}
                    onChange={setTurbulence}
                    tone="var(--accent-orange)"
                  />
                  <SliderControl
                    label="Viscosity (nu)"
                    value={viscosity}
                    display={viscosity.toFixed(3)}
                    min={0.005}
                    max={0.1}
                    step={0.001}
                    onChange={setViscosity}
                    tone="var(--accent-green)"
                  />
                  <SliderControl
                    label="Particles"
                    value={particleCount}
                    display={particleCount}
                    min={0}
                    max={MAX_PARTICLES}
                    step={10}
                    onChange={setParticleCount}
                    tone="var(--accent-red)"
                  />
                  <SliderControl
                    label="Trail opacity"
                    value={trailOpacity}
                    display={trailOpacity.toFixed(2)}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={setTrailOpacity}
                    tone="var(--accent-cyan)"
                  />
                  <SliderControl
                    label="Simulation speed"
                    value={simSpeed}
                    display={`${simSpeed}x`}
                    min={1}
                    max={8}
                    step={1}
                    onChange={setSimSpeed}
                    tone="var(--accent-orange)"
                  />
                </div>
              </Panel>
            </aside>

            <aside className="info-column">
              <Panel eyebrow="Timing Tower" title="Live session summary" subtitle="A compact readout of the current package and tunnel state.">
                <div className="telemetry-stack">
                  <div className="telemetry-highlight">
                    <span>Current package</span>
                    <strong>{geometryLabel}</strong>
                    <small>{geometryNote}</small>
                  </div>
                  {diagnosticSignals.map((signal) => (
                    <SignalRow
                      key={signal.label}
                      label={signal.label}
                      note={signal.note}
                      value={signal.value}
                      tone={signal.tone}
                    />
                  ))}
                </div>
              </Panel>

              <Panel eyebrow="Onboard" title="Trackside monitor" subtitle="Secondary view for quick checks while the main canvas is moving.">
                <canvas ref={miniRef} width={420} height={220} className="preview-canvas" />
                <div className="preview-meta">
                  <div>
                    <span>View mode</span>
                    <strong>{currentMode.label}</strong>
                  </div>
                  <div>
                    <span>Flow regime</span>
                    <strong style={{ color: regime.col }}>{regime.label}</strong>
                  </div>
                </div>
              </Panel>

              <Panel eyebrow="Engineer Notes" title="Run discipline" subtitle="Keep changes clean so each package comparison stays readable.">
                <div className="reference-list">
                  <div className="reference-item">
                    <strong>Move one variable at a time</strong>
                    <span>Change package or flow, but not both, when you want a clear delta between runs.</span>
                  </div>
                  <div className="reference-item">
                    <strong>Read pressure like loading</strong>
                    <span>Pressure is the fastest way to spot suction zones, load peaks, and stall-prone pockets.</span>
                  </div>
                  <div className="reference-item">
                    <strong>Read streamlines like dirty air</strong>
                    <span>Trail bundles make wake length, recirculation, and reattachment much easier to judge.</span>
                  </div>
                </div>
              </Panel>
            </aside>
          </div>
        )}

        {view === "analysis" && (
          <AnalysisPanel
            history={historySnap}
            miniRef={miniRef}
            running={running}
            exportCSV={exportCSV}
            stats={stats}
            ldRatio={ldRatio}
            regime={regime}
            modeMeta={currentMode}
          />
        )}

        {view === "about" && <AboutPanel />}
      </main>
    </div>
  );
}
