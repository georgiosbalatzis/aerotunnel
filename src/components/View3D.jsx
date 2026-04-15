import { useEffect, useRef } from "react";

const THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
const DESKTOP_STREAMLINE_COUNT = 220;
const MOBILE_STREAMLINE_COUNT = 140;
const STREAMLINE_POINTS = 128;
const HERO_TUBE_COUNT_DESKTOP = 26;
const HERO_TUBE_COUNT_MOBILE = 10;
const PARTICLE_COUNT_DESKTOP = 500;
const PARTICLE_COUNT_MOBILE = 200;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/* ── Jet colormap: velocity [0,1] → RGB ── */
function jetColormap(t) {
  t = clamp(t, 0, 1);
  let r, g, b;
  if (t < 0.15) {
    // deep blue → royal blue
    const s = t / 0.15;
    r = 0.04 + s * 0.08;
    g = 0.1 + s * 0.32;
    b = 1.0;
  } else if (t < 0.35) {
    // royal blue → cyan
    const s = (t - 0.15) / 0.2;
    r = 0.12 * (1 - s);
    g = 0.42 + s * 0.41;
    b = 1.0 - s * 0.17;
  } else if (t < 0.5) {
    // cyan → green
    const s = (t - 0.35) / 0.15;
    r = s * 0.13;
    g = 0.83 + s * 0.17;
    b = 0.83 - s * 0.5;
  } else if (t < 0.7) {
    // green → yellow
    const s = (t - 0.5) / 0.2;
    r = 0.13 + s * 0.8;
    g = 1.0;
    b = 0.33 - s * 0.2;
  } else if (t < 0.85) {
    // yellow → orange
    const s = (t - 0.7) / 0.15;
    r = 0.93 + s * 0.07;
    g = 1.0 - s * 0.6;
    b = 0.13 - s * 0.05;
  } else {
    // orange → red
    const s = (t - 0.85) / 0.15;
    r = 1.0;
    g = 0.4 - s * 0.32;
    b = 0.08 - s * 0.07;
  }
  return [clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1)];
}

function disposeMaterial(material) {
  if (!material) return;
  const materials = Array.isArray(material) ? material : [material];
  materials.forEach(item => {
    if (item.map) item.map.dispose();
    item.dispose?.();
  });
}

function disposeObject(object) {
  object.traverse(child => {
    child.geometry?.dispose();
    disposeMaterial(child.material);
  });
}

/* ── Potential flow solver for physics-based streamlines ── */

function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

function solveFlowField(bodyPts, xMin, xMax, yMin, yMax, gridW, gridH) {
  const dx = (xMax - xMin) / (gridW - 1);
  const dy = (yMax - yMin) / (gridH - 1);
  const N = gridW * gridH;
  const psi = new Float64Array(N);
  const solid = new Uint8Array(N);

  let sumY = 0, cnt = 0;
  for (let j = 0; j < gridH; j++) {
    const y = yMin + j * dy;
    for (let i = 0; i < gridW; i++) {
      const x = xMin + i * dx;
      const idx = j * gridW + i;
      if (pointInPoly(x, y, bodyPts)) { solid[idx] = 1; sumY += y; cnt++; }
    }
  }
  const psiBody = cnt > 0 ? sumY / cnt : 0;

  for (let j = 0; j < gridH; j++) {
    const y = yMin + j * dy;
    for (let i = 0; i < gridW; i++) {
      psi[j * gridW + i] = solid[j * gridW + i] ? psiBody : y;
    }
  }

  const dx2 = dx * dx, dy2 = dy * dy, denom = 2 * (dx2 + dy2);
  const rhoJ = 0.5 * (Math.cos(Math.PI / (gridW - 1)) + Math.cos(Math.PI / (gridH - 1)));
  const omega = 2 / (1 + Math.sqrt(1 - rhoJ * rhoJ));
  for (let iter = 0; iter < 800; iter++) {
    for (let j = 1; j < gridH - 1; j++) {
      for (let i = 1; i < gridW - 1; i++) {
        const idx = j * gridW + i;
        if (solid[idx]) continue;
        const avg = (dy2 * (psi[idx - 1] + psi[idx + 1]) +
                     dx2 * (psi[idx - gridW] + psi[idx + gridW])) / denom;
        psi[idx] += omega * (avg - psi[idx]);
      }
    }
    for (let j = 0; j < gridH; j++) psi[j * gridW + gridW - 1] = psi[j * gridW + gridW - 2];
  }

  const vx = new Float32Array(N), vy = new Float32Array(N);
  let velMin = 1e9, velMax = -1e9;
  for (let j = 1; j < gridH - 1; j++) {
    for (let i = 1; i < gridW - 1; i++) {
      const idx = j * gridW + i;
      if (solid[idx]) continue;
      vx[idx] = (psi[(j + 1) * gridW + i] - psi[(j - 1) * gridW + i]) / (2 * dy);
      vy[idx] = -(psi[j * gridW + i + 1] - psi[j * gridW + i - 1]) / (2 * dx);
      const spd = Math.sqrt(vx[idx] * vx[idx] + vy[idx] * vy[idx]);
      if (spd < velMin) velMin = spd;
      if (spd > velMax) velMax = spd;
    }
  }
  for (let j = 0; j < gridH; j++) {
    vx[j * gridW] = 1; vy[j * gridW] = 0;
    vx[j * gridW + gridW - 1] = vx[j * gridW + gridW - 2];
    vy[j * gridW + gridW - 1] = vy[j * gridW + gridW - 2];
  }
  for (let i = 0; i < gridW; i++) {
    vx[i] = vx[gridW + i]; vy[i] = vy[gridW + i];
    vx[(gridH - 1) * gridW + i] = vx[(gridH - 2) * gridW + i];
    vy[(gridH - 1) * gridW + i] = vy[(gridH - 2) * gridW + i];
  }
  return { vx, vy, solid, gridW, gridH, xMin, yMin, dx, dy, velMin: velMin || 0, velMax: velMax || 1 };
}

function sampleVel(field, x, y) {
  const fi = (x - field.xMin) / field.dx, fj = (y - field.yMin) / field.dy;
  const i = Math.floor(fi), j = Math.floor(fj);
  if (i < 0 || i >= field.gridW - 1 || j < 0 || j >= field.gridH - 1) return [1, 0];
  const s = fi - i, t = fj - j;
  const idx = j * field.gridW + i, i01 = idx + 1, i10 = idx + field.gridW, i11 = i10 + 1;
  return [
    (1 - s) * (1 - t) * field.vx[idx] + s * (1 - t) * field.vx[i01] + (1 - s) * t * field.vx[i10] + s * t * field.vx[i11],
    (1 - s) * (1 - t) * field.vy[idx] + s * (1 - t) * field.vy[i01] + (1 - s) * t * field.vy[i10] + s * t * field.vy[i11],
  ];
}

function traceStreamPath(field, x0, y0, ds, maxSteps) {
  const coords = [];
  let x = x0, y = y0;
  const [vx0, vy0] = sampleVel(field, x, y);
  coords.push(x, y, Math.sqrt(vx0 * vx0 + vy0 * vy0));
  const xMax = field.xMin + (field.gridW - 1) * field.dx;
  const yMax = field.yMin + (field.gridH - 1) * field.dy;
  const hasSolid = !!field.solid;

  const isSolid = (px, py) => {
    if (!hasSolid) return false;
    const gi = Math.round((px - field.xMin) / field.dx);
    const gj = Math.round((py - field.yMin) / field.dy);
    return gi >= 0 && gi < field.gridW && gj >= 0 && gj < field.gridH &&
           field.solid[gj * field.gridW + gi] === 1;
  };

  for (let step = 0; step < maxSteps; step++) {
    const [vx1, vy1] = sampleVel(field, x, y);
    const spd1 = Math.sqrt(vx1 * vx1 + vy1 * vy1);
    if (spd1 < 0.003) break;

    // Adaptive step size — smaller steps near body where velocity is low
    const localDs = ds * clamp(spd1 * 2.5, 0.2, 1.0);

    // RK2 midpoint integration
    const hx = localDs * vx1 / spd1, hy = localDs * vy1 / spd1;
    const [vx2, vy2] = sampleVel(field, x + 0.5 * hx, y + 0.5 * hy);
    const spd2 = Math.sqrt(vx2 * vx2 + vy2 * vy2);
    if (spd2 < 0.003) break;

    let nx = x + localDs * vx2 / spd2;
    let ny = y + localDs * vy2 / spd2;

    // Body collision — binary search to find surface contact point
    if (isSolid(nx, ny)) {
      let validX = x, validY = y;
      let testX = nx, testY = ny;
      for (let bs = 0; bs < 8; bs++) {
        const midX = (validX + testX) * 0.5, midY = (validY + testY) * 0.5;
        if (isSolid(midX, midY)) { testX = midX; testY = midY; }
        else { validX = midX; validY = midY; }
      }
      nx = validX; ny = validY;
    }

    if (nx < field.xMin || nx > xMax || ny < field.yMin + 0.05 || ny > yMax - 0.05) break;
    x = nx;
    y = ny;
    const [vxf, vyf] = sampleVel(field, x, y);
    coords.push(x, y, Math.sqrt(vxf * vxf + vyf * vyf));
  }
  return new Float32Array(coords);
}

function buildBackgroundTexture(THREE) {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#06080c");
  gradient.addColorStop(0.48, "#0c0e14");
  gradient.addColorStop(1, "#06080c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function buildMetalEnvMap(THREE) {
  const faceColors = [
    "#0c1420",
    "#0c1420",
    "#0a1428",
    "#050810",
    "#0c1420",
    "#0c1420",
  ];
  const faces = faceColors.map(color => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 64, 64);
    return canvas;
  });

  const texture = new THREE.CubeTexture(faces);
  texture.needsUpdate = true;
  return texture;
}

function buildAxisLabel(THREE, text, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "700 28px Share Tech Mono, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, 32, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  }));
  sprite.scale.set(0.28, 0.28, 1);
  return sprite;
}

/* ── Compute local velocity magnitude at a world-space streamline point ──
   Uses analytical approximation based on profile proximity & wake effects.
   When solver data is available, samples from the LBM grid. */
function localVelocity(x, y, z, profileBounds, solver) {
  const localX = x - 0.05;
  const bodyW = profileBounds.width * 0.5 || 1;
  const bodyH = profileBounds.height * 0.5 || 0.45;
  const distFromCenter = Math.sqrt((y * y) / (bodyH * bodyH) + (z * z) / (0.44 * 0.44));

  // stagnation near nose
  const noseProx = Math.exp(-((localX + bodyW * 0.5) ** 2) / 0.6);
  // acceleration over upper/lower surface
  const surfaceAccel = Math.exp(-(localX * localX) / 1.0) * Math.max(0, 1.2 - distFromCenter);
  // wake deceleration
  const wakeDecel = smoothstep(0.0, 2.5, localX) * Math.exp(-Math.max(localX, 0) * 0.3);
  // freestream baseline
  let vel = 0.5;
  vel -= noseProx * 0.4;                      // slow down at nose
  vel += surfaceAccel * 0.45;                  // speed up over body
  vel -= wakeDecel * 0.25 * (1 / (1 + distFromCenter * 0.8)); // slow in wake core
  if (solver?.ux?.length) {
    const centerFlow = Math.abs(solver.ux[(solver.ux.length / 2) | 0] || 0);
    vel += clamp((centerFlow - 0.12) * 1.8, -0.08, 0.12);
  }

  return clamp(vel, 0.0, 1.0);
}

function pressureCoefficient(x, y, bounds) {
  const xT = clamp((x + bounds.width * 0.5) / bounds.width, 0, 1);
  const yT = clamp((y + bounds.height * 0.5) / bounds.height, 0, 1);
  const nose = Math.exp(-((xT - 0.08) * (xT - 0.08)) / 0.012);
  const upperAccel = smoothstep(0.5, 0.92, yT) * (1 - smoothstep(0.62, 0.96, xT));
  const lowerLoad = (1 - smoothstep(0.12, 0.5, yT)) * (1 - smoothstep(0.35, 0.88, xT));
  const wake = smoothstep(0.58, 0.96, xT);
  return clamp(0.38 + nose * 0.52 + lowerLoad * 0.18 - upperAccel * 0.28 - wake * 0.18, 0, 1);
}

const GLTF_LOADER_URL = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js";
const DRACO_LOADER_URL = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/DRACOLoader.js";
const DRACO_DECODER_PATH = "https://www.gstatic.com/draco/versioned/decoders/1.5.6/";
const F1_MODEL_URL = import.meta.env.BASE_URL + "f1car.glb";
const F1_PRESETS = new Set(["f1car", "frontwing", "rearwing"]);

export default function View3D({ poly, solverRef, cx, cy, sx, sy, aoa, mode = "3d", preset }) {
  const mountRef = useRef(null);
  const threeRef = useRef(null);
  const latestConfigRef = useRef({ poly, cx, cy, sx, sy, aoa, mode, preset });

  const prevPolyRef = useRef(poly);
  useEffect(() => {
    latestConfigRef.current = { poly, cx, cy, sx, sy, aoa, mode, preset };
    const t = threeRef.current;
    if (t?.buildProfile) t.buildProfile(latestConfigRef.current);
    // 20.3 — Camera auto-framing on shape change
    if (t?.animateToTarget && poly !== prevPolyRef.current) {
      t.animateToTarget(0.12, 1.45, 7.35);
    }
    prevPolyRef.current = poly;
  }, [poly, cx, cy, sx, sy, aoa, mode, preset]);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    let disposed = false;
    let script = null;

    const initWhenReady = () => {
      if (disposed || threeRef.current) return;
      const THREE = window.THREE;
      if (!THREE) return;
      initThree(THREE);
    };

    if (window.THREE) {
      initWhenReady();
    } else {
      script = document.querySelector(`script[src="${THREE_URL}"]`);
      if (!script) {
        script = document.createElement("script");
        script.src = THREE_URL;
        script.async = true;
        script.dataset.aerolabThree = "true";
        document.head.appendChild(script);
      }
      script.addEventListener("load", initWhenReady);
    }

    function initThree(THREE) {
      const width = el.clientWidth || 900;
      const height = el.clientHeight || 520;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x0a0c12, 1);
      if ("outputEncoding" in renderer && THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.domElement.style.touchAction = "none";
      el.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const backgroundTexture = buildBackgroundTexture(THREE);
      const metalEnvMap = buildMetalEnvMap(THREE);
      scene.background = backgroundTexture;
      scene.fog = new THREE.Fog(0x050810, 6.5, 15);

      const isCompact = typeof window !== "undefined" && window.innerWidth < 720;
      const camera = new THREE.PerspectiveCamera(isCompact ? 42 : 34, width / height, 0.1, 100);
      const orbit = { phi: 1.45, theta: 0.12, radius: isCompact ? 8.9 : 7.35 };
      const focus = new THREE.Vector3(0.25, 0, 0);

      // 22.5 — Skip gizmo renderer on mobile to save a WebGL context + draw calls
      let gizmoRenderer = null, gizmoScene = null, gizmoCamera = null, gizmoGroup = null;
      if (!isCompact) {
        gizmoRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        gizmoRenderer.setSize(64, 64);
        gizmoRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        gizmoRenderer.setClearColor(0x000000, 0);
        gizmoRenderer.domElement.className = "view-3d-axis-gizmo";
        gizmoRenderer.domElement.setAttribute("aria-hidden", "true");
        el.appendChild(gizmoRenderer.domElement);

        gizmoScene = new THREE.Scene();
        gizmoCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 10);
        gizmoCamera.position.set(0, 0, 3);
        gizmoGroup = new THREE.Group();
        gizmoScene.add(gizmoGroup);

        const addGizmoAxis = (label, endpoint, color, textColor) => {
          const axis = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), endpoint]),
            new THREE.LineBasicMaterial({ color, depthTest: false, depthWrite: false })
          );
          const axisLabel = buildAxisLabel(THREE, label, textColor);
          axisLabel.position.copy(endpoint).multiplyScalar(1.15);
          gizmoGroup.add(axis, axisLabel);
        };
        addGizmoAxis("X", new THREE.Vector3(0.82, 0, 0), 0xff3344, "#ff3344");
        addGizmoAxis("Y", new THREE.Vector3(0, 0.82, 0), 0x33ff44, "#33ff44");
        addGizmoAxis("Z", new THREE.Vector3(0, 0, 0.82), 0x3344ff, "#3344ff");
      }

      scene.add(new THREE.HemisphereLight(0x1a2a3a, 0x050810, 0.25));
      const keyLight = new THREE.DirectionalLight(0x8ec8ff, 0.6);
      keyLight.position.set(-2, 3, 4);
      scene.add(keyLight);
      const rimLight = new THREE.DirectionalLight(0x00e5ff, 0.4);
      rimLight.position.set(3, 0.5, -2);
      scene.add(rimLight);
      const accentSpot = new THREE.SpotLight(0xff6622, 0.25, 0, 0.4, 0.7);
      accentSpot.position.set(-1.5, 2, 3);
      accentSpot.target.position.set(0, 0, 0);
      scene.add(accentSpot, accentSpot.target);

      const tunnelGroup = new THREE.Group();
      scene.add(tunnelGroup);

      const tunnelPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(10.4, 3.55, 1, 1),
        new THREE.MeshBasicMaterial({ color: 0x0d1118, transparent: true, opacity: 0.72 })
      );
      tunnelPlane.position.set(0.25, 0, -1.35);
      tunnelGroup.add(tunnelPlane);

      const centerGuide = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-4.75, 0, -1.34),
          new THREE.Vector3(4.85, 0, -1.34),
        ]),
        new THREE.LineBasicMaterial({ color: 0x2bdcff, transparent: true, opacity: 0.16 })
      );
      tunnelGroup.add(centerGuide);

      const floorFogPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(14, 6),
        new THREE.MeshBasicMaterial({
          color: 0x0e1420,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      floorFogPlane.position.set(0.25, -1.8, 0);
      floorFogPlane.rotation.x = -Math.PI / 2;
      scene.add(floorFogPlane);

      const gridPositions = [];
      const gridColors = [];
      const pushGridVertex = (x, z) => {
        const fade = clamp(1 - Math.sqrt((x / 6) ** 2 + (z / 4) ** 2), 0, 1);
        const intensity = 0.04 * fade;
        gridPositions.push(x + 0.25, -1.798, z);
        gridColors.push(intensity, intensity, intensity);
      };
      for (let x = -6; x <= 6.001; x += 0.5) {
        pushGridVertex(x, -4);
        pushGridVertex(x, 4);
      }
      for (let z = -4; z <= 4.001; z += 0.5) {
        pushGridVertex(-6, z);
        pushGridVertex(6, z);
      }
      const gridGeometry = new THREE.BufferGeometry();
      gridGeometry.setAttribute("position", new THREE.Float32BufferAttribute(gridPositions, 3));
      gridGeometry.setAttribute("color", new THREE.Float32BufferAttribute(gridColors, 3));
      const groundGrid = new THREE.LineSegments(
        gridGeometry,
        new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
        })
      );
      scene.add(groundGrid);

      const profileGroup = new THREE.Group();
      scene.add(profileGroup);

      let profileMesh = null;
      let pressureShellMesh = null;
      let edgeMesh = null;
      let profileBounds = { width: 2.4, height: 0.9, depth: 0.86 };

      /* ── F1 GLB model loading ── */
      let f1Model = null;
      let f1ModelLoading = false;
      let f1ModelGroup = new THREE.Group();
      f1ModelGroup.visible = false;
      scene.add(f1ModelGroup);

      function loadF1Model() {
        if (f1Model || f1ModelLoading) return;
        f1ModelLoading = true;

        function doLoad() {
          const loader = new THREE.GLTFLoader();
          if (THREE.DRACOLoader) {
            const draco = new THREE.DRACOLoader();
            draco.setDecoderPath(DRACO_DECODER_PATH);
            loader.setDRACOLoader(draco);
          }
          loader.load(F1_MODEL_URL, (gltf) => {
            f1Model = gltf.scene;
            // Compute bounding box and normalize to fit scene
            const box = new THREE.Box3().setFromObject(f1Model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 3.2 / maxDim;
            f1Model.scale.setScalar(scale);
            f1Model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
            // Apply dark carbon material to all meshes
            f1Model.traverse((child) => {
              if (child.isMesh) {
                child.material = new THREE.MeshPhysicalMaterial({
                  color: new THREE.Color(0x1a1e28),
                  metalness: 0.78,
                  roughness: 0.30,
                  envMap: metalEnvMap,
                  envMapIntensity: 0.5,
                  clearcoat: 0.5,
                  clearcoatRoughness: 0.15,
                  side: THREE.DoubleSide,
                });
              }
            });
            f1ModelGroup.add(f1Model);
            f1ModelLoading = false;
            // Trigger rebuild with current config
            buildProfile(latestConfigRef.current);
          }, undefined, (err) => {
            console.warn("F1 GLB load failed:", err);
            f1ModelLoading = false;
          });
        }

        // Load GLTFLoader + DRACOLoader from CDN if not available
        if (THREE.GLTFLoader) {
          doLoad();
        } else {
          const script1 = document.createElement("script");
          script1.src = DRACO_LOADER_URL;
          script1.onload = () => {
            const script2 = document.createElement("script");
            script2.src = GLTF_LOADER_URL;
            script2.onload = doLoad;
            document.head.appendChild(script2);
          };
          document.head.appendChild(script1);
        }
      }

      function normalizeProfile(rawPoly, config) {
        if (!rawPoly || rawPoly.length < 3) return null;

        const xs = rawPoly.map(point => point[0]);
        const ys = rawPoly.map(point => point[1]);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;
        const shapeWidth = isCompact ? 1.86 : 2.05;
        const requestedRatio = (config.sy || 1) / (config.sx || 1);
        const shapeHeight = shapeWidth * clamp(requestedRatio * 0.82, 0.28, 0.92);
        const angle = (config.aoa || 0) * Math.PI / 180;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        return rawPoly.map(([x, y]) => {
          const lx = ((x - minX) / rangeX - 0.5) * shapeWidth;
          const ly = (0.5 - (y - minY) / rangeY) * shapeHeight;
          return [
            lx * cosA - ly * sinA,
            lx * sinA + ly * cosA,
          ];
        });
      }

      // 22.3 — Geometry cache keyed on polygon hash
      let cachedPolyHash = null;
      let cachedExtrudeGeo = null;
      let cachedEdgeGeo = null;

      // Flow field cache for physics-based streamlines
      let cachedFlowField = null;
      let cachedStreamPaths = null;
      let cachedHeroPaths = null;
      let cachedVelRange = [0.5, 1.5];
      let cachedFlowHash = null;

      function hashPoly(poly) {
        if (!poly || !poly.length) return "";
        let h = "";
        for (let i = 0; i < poly.length; i++) {
          const p = poly[i];
          const x = (p[0] ?? p.x ?? 0).toFixed(3);
          const y = (p[1] ?? p.y ?? 0).toFixed(3);
          h += x + "," + y + ";";
        }
        return h;
      }

      function buildProfile(config) {
        if (profileMesh) {
          profileGroup.remove(profileMesh);
          disposeMaterial(profileMesh.material);
          profileMesh = null;
        }
        if (pressureShellMesh) {
          profileGroup.remove(pressureShellMesh);
          pressureShellMesh.geometry?.dispose();
          disposeMaterial(pressureShellMesh.material);
          pressureShellMesh = null;
        }
        if (edgeMesh) {
          profileGroup.remove(edgeMesh);
          disposeMaterial(edgeMesh.material);
          edgeMesh = null;
        }

        // Show F1 GLB model for F1 presets, hide extruded polygon
        const isF1 = F1_PRESETS.has(config.preset);
        if (isF1) {
          loadF1Model();
          if (f1Model) {
            f1ModelGroup.visible = true;
            // Car's length is along Z, rotate so nose faces into the flow (-X)
            f1ModelGroup.rotation.set(0, -Math.PI / 2, 0);
            f1ModelGroup.position.set(0.15, -0.15, 0);
            profileBounds = { width: 3.2, height: 1.0, depth: 1.6 };
          }
          // Still build the extruded polygon as fallback / for bounds
          // but hide it when GLB is showing
        } else {
          f1ModelGroup.visible = false;
        }

        const pts = normalizeProfile(config.poly, config);
        if (!pts) return;

        const xs = pts.map(point => point[0]);
        const ys = pts.map(point => point[1]);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const bounds = {
          width: maxX - minX || 1,
          height: maxY - minY || 1,
          depth: 0.88,
        };
        profileBounds = bounds;

        // 22.3 — Reuse cached geometry if polygon unchanged
        const polyHash = hashPoly(config.poly);
        let geometry, edgeGeometry;

        if (polyHash === cachedPolyHash && cachedExtrudeGeo) {
          geometry = cachedExtrudeGeo;
          edgeGeometry = cachedEdgeGeo;
        } else {
          // Dispose old cached geometry
          if (cachedExtrudeGeo) cachedExtrudeGeo.dispose();
          if (cachedEdgeGeo) cachedEdgeGeo.dispose();

          const shape = new THREE.Shape();
          shape.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
          shape.closePath();

          geometry = new THREE.ExtrudeGeometry(shape, {
            depth: bounds.depth,
            bevelEnabled: true,
            bevelThickness: 0.09,
            bevelSize: 0.075,
            bevelSegments: 9,
            curveSegments: 14,
          });
          geometry.center();
          geometry.computeVertexNormals();

          edgeGeometry = new THREE.EdgesGeometry(geometry, 15);

          cachedPolyHash = polyHash;
          cachedExtrudeGeo = geometry;
          cachedEdgeGeo = edgeGeometry;
        }

        const material = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(0x1a1e28),
          metalness: 0.72,
          roughness: 0.35,
          envMap: metalEnvMap,
          envMapIntensity: 0.4,
          clearcoat: 0.4,
          clearcoatRoughness: 0.2,
          side: THREE.DoubleSide,
        });
        profileMesh = new THREE.Mesh(geometry, material);
        profileMesh.position.set(0.05, 0, 0.02);
        profileGroup.add(profileMesh);

        const shellGeometry = geometry.clone();
        const shellPositions = shellGeometry.attributes.position;
        const shellNormals = shellGeometry.attributes.normal;
        const shellColors = new Float32Array(shellPositions.count * 3);
        for (let i = 0; i < shellPositions.count; i++) {
          const nx = shellNormals.getX(i);
          const ny = shellNormals.getY(i);
          const nz = shellNormals.getZ(i);
          shellPositions.setXYZ(
            i,
            shellPositions.getX(i) + nx * 0.005,
            shellPositions.getY(i) + ny * 0.005,
            shellPositions.getZ(i) + nz * 0.005
          );
          const cp = pressureCoefficient(shellPositions.getX(i), shellPositions.getY(i), bounds);
          const [r, g, b] = jetColormap(cp);
          shellColors[i * 3] = r;
          shellColors[i * 3 + 1] = g;
          shellColors[i * 3 + 2] = b;
        }
        shellGeometry.setAttribute("color", new THREE.Float32BufferAttribute(shellColors, 3));
        shellPositions.needsUpdate = true;

        pressureShellMesh = new THREE.Mesh(
          shellGeometry,
          new THREE.MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
            side: THREE.FrontSide,
            blending: THREE.NormalBlending,
          })
        );
        pressureShellMesh.position.copy(profileMesh.position);
        pressureShellMesh.visible = config.mode === "pressure" || config.mode === "3d";
        profileGroup.add(pressureShellMesh);

        edgeMesh = new THREE.LineSegments(
          edgeGeometry,
          new THREE.LineBasicMaterial({
            color: 0x00e5ff,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
          })
        );
        edgeMesh.position.copy(profileMesh.position);
        profileGroup.add(edgeMesh);

        // Hide extruded polygon when F1 GLB model is loaded and active
        if (isF1 && f1Model) {
          profileMesh.visible = false;
          pressureShellMesh.visible = false;
          edgeMesh.visible = false;
        }

        // Compute potential flow field and trace streamlines
        if (polyHash !== cachedFlowHash) {
          cachedFlowHash = polyHash;
          const bodyWorld = pts.map(([x, y]) => [x + 0.05, y]);
          const field = solveFlowField(bodyWorld, -5.2, 5.5, -1.9, 1.9, 280, 110);
          cachedFlowField = field;
          cachedVelRange = [field.velMin, field.velMax];

          cachedStreamPaths = [];
          for (let li = 0; li < lineCount; li++) {
            cachedStreamPaths.push(traceStreamPath(field, xStart, streamlines[li].yBase, 0.03, 600));
          }
          cachedHeroPaths = [];
          for (let hi = 0; hi < heroLines.length; hi++) {
            cachedHeroPaths.push(traceStreamPath(field, xStart, heroLines[hi].yBase, 0.03, 600));
          }
        }
      }

      /* ════════════════════════════════════════════════════════════════
         PHASE 12.1 + 12.2 — VELOCITY-COLORED STREAMLINES
         PHASE 22.1 — MERGED INTO SINGLE DRAW CALL
         ════════════════════════════════════════════════════════════════ */
      const lineCount = isCompact ? MOBILE_STREAMLINE_COUNT : DESKTOP_STREAMLINE_COUNT;
      const streamlines = [];
      const xStart = -4.75;
      const xEnd = 4.95;

      // Distribution buckets per 12.2 spec
      const uniformCount = Math.floor(lineCount * 0.40);
      const clusterCount = Math.floor(lineCount * 0.35);
      const wakeCount = lineCount - uniformCount - clusterCount;

      for (let i = 0; i < lineCount; i++) {
        let yBase, zBase, xStartLocal, isHeroCandidate;

        if (i < uniformCount) {
          const row = i % 33;
          const layer = Math.floor(i / 33);
          const rowT = row / 32;
          const layerT = ((layer % 5) - 2) / 2;
          yBase = -1.38 + rowT * 2.76;
          zBase = layerT * 0.52 + ((i % 2) ? 0.08 : -0.08);
          xStartLocal = xStart;
          isHeroCandidate = false;
        } else if (i < uniformCount + clusterCount) {
          const ci = i - uniformCount;
          const t = ci / (clusterCount - 1);
          yBase = -0.6 + t * 1.2;
          const layer = ci % 5;
          zBase = ((layer - 2) / 2) * 0.42 + ((ci % 2) ? 0.06 : -0.06);
          xStartLocal = xStart;
          isHeroCandidate = true;
        } else {
          const wi = i - uniformCount - clusterCount;
          const t = wi / (wakeCount - 1);
          yBase = -1.0 + t * 2.0;
          const layer = wi % 4;
          zBase = ((layer - 1.5) / 1.5) * 0.38;
          xStartLocal = 0.3;
          isHeroCandidate = false;
        }

        streamlines.push({
          yBase,
          zBase,
          xStartLocal,
          phase: i * 0.39,
          rowT: (yBase + 1.38) / 2.76,
          isHeroCandidate,
          // Per-line offset into the merged buffer
          offset: i * STREAMLINE_POINTS,
        });
      }

      // 22.1 — Single merged geometry for all streamlines
      // Use LineSegments with pairs of vertices (2 verts per segment)
      const segmentsPerLine = STREAMLINE_POINTS - 1;
      const totalSegments = lineCount * segmentsPerLine;
      const mergedPosArr = new Float32Array(totalSegments * 2 * 3);
      const mergedColArr = new Float32Array(totalSegments * 2 * 3);
      const mergedStreamGeo = new THREE.BufferGeometry();
      mergedStreamGeo.setAttribute("position", new THREE.BufferAttribute(mergedPosArr, 3));
      mergedStreamGeo.setAttribute("color", new THREE.BufferAttribute(mergedColArr, 3));

      const mergedStreamMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const mergedStreamMesh = new THREE.LineSegments(mergedStreamGeo, mergedStreamMat);
      scene.add(mergedStreamMesh);

      /* ════════════════════════════════════════════════════════════════
         PHASE 12.3 — HERO TUBE STREAMLINES (near-surface, thicker)
         ════════════════════════════════════════════════════════════════ */
      const heroGroup = new THREE.Group();
      scene.add(heroGroup);
      const heroCount = isCompact ? HERO_TUBE_COUNT_MOBILE : HERO_TUBE_COUNT_DESKTOP;
      const heroLines = [];

      for (let i = 0; i < heroCount; i++) {
        const t = i / (heroCount - 1);
        // Distribute hero tubes tightly around the profile
        const yBase = -0.42 + t * 0.84;
        const zLayer = ((i % 3) - 1) * 0.22;
        const curvePoints = [];
        for (let p = 0; p < STREAMLINE_POINTS; p++) {
          curvePoints.push(new THREE.Vector3(0, 0, 0));
        }

        heroLines.push({
          yBase,
          zBase: zLayer,
          phase: i * 0.71,
          rowT: t,
          points: curvePoints,
          mesh: null,
          glowMesh: null,
        });
      }

      function rebuildHeroTubes(THREE) {
        heroLines.forEach(hero => {
          if (hero.mesh) {
            heroGroup.remove(hero.mesh);
            hero.mesh.geometry.dispose();
            disposeMaterial(hero.mesh.material);
            hero.mesh = null;
          }
          if (hero.glowMesh) {
            heroGroup.remove(hero.glowMesh);
            hero.glowMesh.geometry.dispose();
            disposeMaterial(hero.glowMesh.material);
            hero.glowMesh = null;
          }

          const curve = new THREE.CatmullRomCurve3(hero.points);
          const tubeGeo = new THREE.TubeGeometry(curve, 96, 0.012, 4, false);

          // Per-vertex color for tube
          const tubePosAttr = tubeGeo.attributes.position;
          const tubeColors = new Float32Array(tubePosAttr.count * 3);
          for (let v = 0; v < tubePosAttr.count; v++) {
            const vx = tubePosAttr.getX(v);
            const vy = tubePosAttr.getY(v);
            let vel = 0.5;
            if (cachedFlowField) {
              const [fvx, fvy] = sampleVel(cachedFlowField, vx, vy);
              const spd = Math.sqrt(fvx * fvx + fvy * fvy);
              vel = clamp((spd - cachedVelRange[0]) / ((cachedVelRange[1] - cachedVelRange[0]) || 1), 0, 1);
            }
            const [r, g, b] = jetColormap(vel);
            tubeColors[v * 3] = r;
            tubeColors[v * 3 + 1] = g;
            tubeColors[v * 3 + 2] = b;
          }
          tubeGeo.setAttribute("color", new THREE.Float32BufferAttribute(tubeColors, 3));

          const tubeMat = new THREE.MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.82,
            depthWrite: false,
          });
          hero.mesh = new THREE.Mesh(tubeGeo, tubeMat);
          heroGroup.add(hero.mesh);

          // 12.4 — Glow shell for hero tubes (additive blend)
          // 19.3 — Glow pass disabled on mobile for performance
          if (!isCompact) {
            const glowGeo = tubeGeo.clone();
            const glowMat = new THREE.MeshBasicMaterial({
              vertexColors: true,
              transparent: true,
              opacity: 0.10,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            });
            hero.glowMesh = new THREE.Mesh(glowGeo, glowMat);
            hero.glowMesh.scale.set(2.2, 2.2, 1.0);
            heroGroup.add(hero.glowMesh);
          }
        });
      }

      /* ════════════════════════════════════════════════════════════════
         PHASE 12.5 — ANIMATED FLOW PARTICLES (tracer dots on streamlines)
         ════════════════════════════════════════════════════════════════ */
      const particleCount = isCompact ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP;
      const particlePositions = new Float32Array(particleCount * 3);
      const particleColors = new Float32Array(particleCount * 3);
      const particleGeo = new THREE.BufferGeometry();
      particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
      particleGeo.setAttribute("color", new THREE.BufferAttribute(particleColors, 3));

      const particleMat = new THREE.PointsMaterial({
        size: 0.04,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const particleSystem = new THREE.Points(particleGeo, particleMat);
      scene.add(particleSystem);

      // Each particle tracks a position along a streamline
      const particleState = [];
      for (let i = 0; i < particleCount; i++) {
        particleState.push({
          streamIdx: Math.floor(Math.random() * lineCount),
          t: Math.random(), // position along streamline [0,1]
        });
      }

      /* ═════════════════════════════════════════
         STREAMLINE UPDATE (with velocity coloring)
         ═════════════════════════════════════════ */
      let heroRebuildTimer = 0;

      // 22.1 — Shared position cache for particle lookups
      const streamPositions = new Float32Array(lineCount * STREAMLINE_POINTS * 3);
      // Temp buffer for computing per-line points before writing segments
      const tmpLinePosArr = new Float32Array(STREAMLINE_POINTS * 3);
      const tmpLineColArr = new Float32Array(STREAMLINE_POINTS * 3);

      function updateStreamlines(time) {
        const mPos = mergedStreamGeo.attributes.position.array;
        const mCol = mergedStreamGeo.attributes.color.array;
        const bodyHalfDepth = profileBounds.depth * 0.5;
        const flowSpeed = 15;
        const velRange = cachedVelRange;
        const velSpan = (velRange[1] - velRange[0]) || 1;

        for (let li = 0; li < lineCount; li++) {
          const item = streamlines[li];
          const path = cachedStreamPaths ? cachedStreamPaths[li] : null;

          if (!path || path.length < STREAMLINE_POINTS * 3) {
            for (let p = 0; p < STREAMLINE_POINTS; p++) {
              const t = p / (STREAMLINE_POINTS - 1);
              tmpLinePosArr[p * 3] = xStart + t * (xEnd - xStart);
              tmpLinePosArr[p * 3 + 1] = item.yBase;
              tmpLinePosArr[p * 3 + 2] = item.zBase;
              tmpLineColArr[p * 3] = 0.1; tmpLineColArr[p * 3 + 1] = 0.4; tmpLineColArr[p * 3 + 2] = 0.7;
            }
          } else {
            const pathLen = path.length / 3;
            const maxOffset = Math.max(0, pathLen - STREAMLINE_POINTS);
            const offset = Math.floor((time * flowSpeed + item.phase * 5) % (maxOffset + 1));

            const zAbs = Math.abs(item.zBase);
            const zFactor = bodyHalfDepth / Math.sqrt(item.zBase * item.zBase + bodyHalfDepth * bodyHalfDepth + 0.001);

            for (let p = 0; p < STREAMLINE_POINTS; p++) {
              const pi = Math.min(offset + p, pathLen - 1);
              const px = path[pi * 3];
              const deflectedY = path[pi * 3 + 1];
              const speed = path[pi * 3 + 2];

              const y = item.yBase + (deflectedY - item.yBase) * zFactor;
              const xRel = px - 0.05;
              const bodyInfl = Math.exp(-(xRel * xRel) / 1.2);
              const zSign = item.zBase > 0 ? 1 : item.zBase < 0 ? -1 : 0;
              const clearance = bodyHalfDepth + 0.06;
              const push = zAbs > 0.02 && zAbs < clearance ? (clearance - zAbs) * bodyInfl * zSign : 0;
              const z = item.zBase + push;

              tmpLinePosArr[p * 3] = px;
              tmpLinePosArr[p * 3 + 1] = y;
              tmpLinePosArr[p * 3 + 2] = z;

              const nv = clamp((speed - velRange[0]) / velSpan, 0, 1);
              const [r, g, b] = jetColormap(nv);
              tmpLineColArr[p * 3] = r;
              tmpLineColArr[p * 3 + 1] = g;
              tmpLineColArr[p * 3 + 2] = b;
            }
          }

          const spBase = li * STREAMLINE_POINTS * 3;
          streamPositions.set(tmpLinePosArr, spBase);

          const segBase = li * segmentsPerLine * 6;
          for (let s = 0; s < segmentsPerLine; s++) {
            const dst = segBase + s * 6;
            const s0 = s * 3, s1 = (s + 1) * 3;
            mPos[dst]     = tmpLinePosArr[s0];     mPos[dst + 1] = tmpLinePosArr[s0 + 1]; mPos[dst + 2] = tmpLinePosArr[s0 + 2];
            mPos[dst + 3] = tmpLinePosArr[s1];     mPos[dst + 4] = tmpLinePosArr[s1 + 1]; mPos[dst + 5] = tmpLinePosArr[s1 + 2];
            mCol[dst]     = tmpLineColArr[s0];     mCol[dst + 1] = tmpLineColArr[s0 + 1]; mCol[dst + 2] = tmpLineColArr[s0 + 2];
            mCol[dst + 3] = tmpLineColArr[s1];     mCol[dst + 4] = tmpLineColArr[s1 + 1]; mCol[dst + 5] = tmpLineColArr[s1 + 2];
          }
        }
        mergedStreamGeo.attributes.position.needsUpdate = true;
        mergedStreamGeo.attributes.color.needsUpdate = true;

        // Hero tube update from precomputed paths
        if (cachedHeroPaths) {
          heroLines.forEach((hero, hi) => {
            const path = cachedHeroPaths[hi];
            if (!path || path.length < STREAMLINE_POINTS * 3) return;
            const pathLen = path.length / 3;
            const maxOff = Math.max(0, pathLen - STREAMLINE_POINTS);
            const off = Math.floor((time * flowSpeed + hero.phase * 5) % (maxOff + 1));
            const zAbs = Math.abs(hero.zBase);
            const zF = bodyHalfDepth / Math.sqrt(hero.zBase * hero.zBase + bodyHalfDepth * bodyHalfDepth + 0.001);
            for (let p = 0; p < STREAMLINE_POINTS; p++) {
              const pi = Math.min(off + p, pathLen - 1);
              const px = path[pi * 3], dy = path[pi * 3 + 1];
              const y = hero.yBase + (dy - hero.yBase) * zF;
              const xR = px - 0.05;
              const bI = Math.exp(-(xR * xR) / 1.2);
              const zS = hero.zBase > 0 ? 1 : hero.zBase < 0 ? -1 : 0;
              const clZ = bodyHalfDepth + 0.06;
              const pushZ = zAbs > 0.02 && zAbs < clZ ? (clZ - zAbs) * bI * zS : 0;
              hero.points[p].set(px, y, hero.zBase + pushZ);
            }
          });
        }

        heroRebuildTimer++;
        if (heroRebuildTimer >= 12) {
          heroRebuildTimer = 0;
          rebuildHeroTubes(THREE);
        }

        // Flow particles
        const pPositions = particleSystem.geometry.attributes.position.array;
        const pColors = particleSystem.geometry.attributes.color.array;
        for (let i = 0; i < particleCount; i++) {
          const ps = particleState[i];
          if (ps.streamIdx >= lineCount) continue;
          const spBase = ps.streamIdx * STREAMLINE_POINTS * 3;
          ps.t += 0.006;
          if (ps.t >= 1.0) { ps.t = 0.0; ps.streamIdx = Math.floor(Math.random() * lineCount); }
          const frac = ps.t * (STREAMLINE_POINTS - 1);
          const i0 = Math.min(Math.floor(frac), STREAMLINE_POINTS - 2);
          const blend = frac - i0;
          const b0 = spBase + i0 * 3, b1 = spBase + (i0 + 1) * 3;
          pPositions[i * 3]     = streamPositions[b0]     * (1 - blend) + streamPositions[b1]     * blend;
          pPositions[i * 3 + 1] = streamPositions[b0 + 1] * (1 - blend) + streamPositions[b1 + 1] * blend;
          pPositions[i * 3 + 2] = streamPositions[b0 + 2] * (1 - blend) + streamPositions[b1 + 2] * blend;
          const vel = clamp(ps.t * 0.8 + 0.2, 0, 1);
          const [cr, cg, cb] = jetColormap(vel);
          pColors[i * 3] = 0.5 + cr * 0.5; pColors[i * 3 + 1] = 0.5 + cg * 0.5; pColors[i * 3 + 2] = 0.5 + cb * 0.5;
        }
        particleSystem.geometry.attributes.position.needsUpdate = true;
        particleSystem.geometry.attributes.color.needsUpdate = true;
      }

      let isDragging = false;
      let previousPointer = { x: 0, y: 0 };
      let lastInteractionTime = 0;
      const domEl = renderer.domElement;

      const onPointerDown = event => {
        isDragging = true;
        lastInteractionTime = performance.now() / 1000;
        previousPointer = { x: event.clientX, y: event.clientY };
        domEl.setPointerCapture?.(event.pointerId);
      };
      const onPointerMove = event => {
        if (!isDragging) return;
        lastInteractionTime = performance.now() / 1000;
        orbit.theta -= (event.clientX - previousPointer.x) * 0.006;
        orbit.phi -= (event.clientY - previousPointer.y) * 0.006;
        orbit.phi = clamp(orbit.phi, 0.45, Math.PI - 0.35);
        previousPointer = { x: event.clientX, y: event.clientY };
      };
      const onPointerUp = event => {
        isDragging = false;
        domEl.releasePointerCapture?.(event.pointerId);
      };
      const onWheel = event => {
        lastInteractionTime = performance.now() / 1000;
        orbit.radius = clamp(orbit.radius + event.deltaY * 0.004, 3.4, 9.2);
      };

      // 24.2 — Pinch-zoom + two-finger pan touch gestures
      let lastTouchDist = 0;
      let lastTouchMid = { x: 0, y: 0 };
      let isTouchPanning = false;

      const onTouchStart = event => {
        if (event.touches.length === 2) {
          event.preventDefault();
          isTouchPanning = true;
          const t0 = event.touches[0], t1 = event.touches[1];
          lastTouchDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
          lastTouchMid = { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };
          lastInteractionTime = performance.now() / 1000;
        }
      };
      const onTouchMove = event => {
        if (event.touches.length === 2 && isTouchPanning) {
          event.preventDefault();
          lastInteractionTime = performance.now() / 1000;
          const t0 = event.touches[0], t1 = event.touches[1];
          const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
          const mid = { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };
          // Pinch → zoom
          const dDist = dist - lastTouchDist;
          orbit.radius = clamp(orbit.radius - dDist * 0.01, 3.4, 9.2);
          // Two-finger pan → orbit
          orbit.theta -= (mid.x - lastTouchMid.x) * 0.004;
          orbit.phi -= (mid.y - lastTouchMid.y) * 0.004;
          orbit.phi = clamp(orbit.phi, 0.45, Math.PI - 0.35);
          lastTouchDist = dist;
          lastTouchMid = mid;
        }
      };
      const onTouchEnd = () => { isTouchPanning = false; };

      domEl.addEventListener("pointerdown", onPointerDown);
      domEl.addEventListener("pointermove", onPointerMove);
      domEl.addEventListener("pointerup", onPointerUp);
      domEl.addEventListener("pointercancel", onPointerUp);
      domEl.addEventListener("wheel", onWheel, { passive: true });
      domEl.addEventListener("touchstart", onTouchStart, { passive: false });
      domEl.addEventListener("touchmove", onTouchMove, { passive: false });
      domEl.addEventListener("touchend", onTouchEnd);

      let animId = 0;
      const clock = new THREE.Clock();

      // 20.3 — Camera auto-framing: smooth lerp targets
      let targetOrbit = { theta: orbit.theta, phi: orbit.phi, radius: orbit.radius };
      let isLerping = false;
      const LERP_SPEED = 3.5; // ~600ms to settle

      function animateToTarget(tTheta, tPhi, tRadius) {
        targetOrbit = { theta: tTheta, phi: tPhi, radius: tRadius };
        isLerping = true;
      }

      function animate() {
        animId = requestAnimationFrame(animate);
        const elapsed = clock.getElapsedTime();
        const dt = Math.min(clock.getDelta(), 0.05);

        // 20.3 — Smooth camera lerp for auto-framing
        if (isLerping) {
          const t = 1 - Math.exp(-LERP_SPEED * dt);
          orbit.theta += (targetOrbit.theta - orbit.theta) * t;
          orbit.phi += (targetOrbit.phi - orbit.phi) * t;
          orbit.radius += (targetOrbit.radius - orbit.radius) * t;
          if (Math.abs(orbit.theta - targetOrbit.theta) < 0.001 &&
              Math.abs(orbit.phi - targetOrbit.phi) < 0.001 &&
              Math.abs(orbit.radius - targetOrbit.radius) < 0.01) {
            isLerping = false;
          }
        }

        // 20.4 — Idle camera drift with vertical oscillation
        const idleTime = elapsed - lastInteractionTime;
        if (!isDragging && !isLerping && idleTime > 5) {
          orbit.theta += 0.0008;
          orbit.phi += Math.sin(elapsed * 0.15) * 0.0003;
          orbit.phi = clamp(orbit.phi, 0.45, Math.PI - 0.35);
        } else if (!isDragging && !isLerping) {
          orbit.theta += 0.0008;
        }

        const sinPhi = Math.sin(orbit.phi);
        camera.position.set(
          orbit.radius * sinPhi * Math.sin(orbit.theta),
          orbit.radius * Math.cos(orbit.phi),
          orbit.radius * sinPhi * Math.cos(orbit.theta)
        );
        camera.lookAt(focus);

        profileGroup.rotation.y = Math.sin(elapsed * 0.28) * 0.035;
        updateStreamlines(elapsed);
        renderer.render(scene, camera);
        if (gizmoGroup) {
          gizmoGroup.quaternion.copy(camera.quaternion).invert();
          gizmoRenderer.render(gizmoScene, gizmoCamera);
        }
      }

      buildProfile(latestConfigRef.current);
      updateStreamlines(0);
      animate();

      const ro = new ResizeObserver(() => {
        const nextWidth = el.clientWidth || 1;
        const nextHeight = el.clientHeight || 1;
        renderer.setSize(nextWidth, nextHeight);
        camera.aspect = nextWidth / nextHeight;
        camera.updateProjectionMatrix();
      });
      ro.observe(el);

      threeRef.current = {
        buildProfile,
        animateToTarget,
        renderer,
        scene,
        gizmoRenderer,
        gizmoScene,
        backgroundTexture,
        metalEnvMap,
        ro,
        // F1 GLB model group
        f1ModelGroup,
        // 22.1 — References for merged stream cleanup
        mergedStreamMesh,
        mergedStreamGeo,
        mergedStreamMat,
        // 22.3 — Cached geometry references
        getCachedGeo: () => ({ cachedExtrudeGeo, cachedEdgeGeo }),
        get animId() { return animId; },
        cleanupControls: () => {
          domEl.removeEventListener("pointerdown", onPointerDown);
          domEl.removeEventListener("pointermove", onPointerMove);
          domEl.removeEventListener("pointerup", onPointerUp);
          domEl.removeEventListener("pointercancel", onPointerUp);
          domEl.removeEventListener("wheel", onWheel);
          domEl.removeEventListener("touchstart", onTouchStart);
          domEl.removeEventListener("touchmove", onTouchMove);
          domEl.removeEventListener("touchend", onTouchEnd);
        },
      };
    }

    return () => {
      disposed = true;
      if (script) script.removeEventListener("load", initWhenReady);

      const t = threeRef.current;
      if (t) {
        cancelAnimationFrame(t.animId);
        t.cleanupControls?.();
        t.ro?.disconnect();
        // Dispose F1 GLB model
        if (t.f1ModelGroup) disposeObject(t.f1ModelGroup);
        // 22.1 — Dispose merged streamline resources
        t.mergedStreamGeo?.dispose();
        t.mergedStreamMat?.dispose();
        // 22.3 — Dispose cached geometry
        const cached = t.getCachedGeo?.();
        if (cached) {
          cached.cachedExtrudeGeo?.dispose();
          cached.cachedEdgeGeo?.dispose();
        }
        disposeObject(t.scene);
        if (t.gizmoScene) disposeObject(t.gizmoScene);
        t.backgroundTexture?.dispose();
        t.metalEnvMap?.dispose();
        t.renderer?.dispose();
        t.gizmoRenderer?.dispose();
        if (el.contains(t.renderer?.domElement)) el.removeChild(t.renderer.domElement);
        if (t.gizmoRenderer && el.contains(t.gizmoRenderer.domElement)) el.removeChild(t.gizmoRenderer.domElement);
        threeRef.current = null;
      }

    };
  }, [solverRef]);

  return (
    <div ref={mountRef} className="view-3d-stage" />
  );
}
