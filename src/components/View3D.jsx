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

export default function View3D({ poly, solverRef, cx, cy, sx, sy, aoa, mode = "3d" }) {
  const mountRef = useRef(null);
  const threeRef = useRef(null);
  const latestConfigRef = useRef({ poly, cx, cy, sx, sy, aoa, mode });

  const prevPolyRef = useRef(poly);
  useEffect(() => {
    latestConfigRef.current = { poly, cx, cy, sx, sy, aoa, mode };
    const t = threeRef.current;
    if (t?.buildProfile) t.buildProfile(latestConfigRef.current);
    // 20.3 — Camera auto-framing on shape change
    if (t?.animateToTarget && poly !== prevPolyRef.current) {
      t.animateToTarget(0.12, 1.45, 7.35);
    }
    prevPolyRef.current = poly;
  }, [poly, cx, cy, sx, sy, aoa, mode]);

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

      const gizmoRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      gizmoRenderer.setSize(64, 64);
      gizmoRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      gizmoRenderer.setClearColor(0x000000, 0);
      gizmoRenderer.domElement.className = "view-3d-axis-gizmo";
      gizmoRenderer.domElement.setAttribute("aria-hidden", "true");
      el.appendChild(gizmoRenderer.domElement);

      const gizmoScene = new THREE.Scene();
      const gizmoCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 10);
      gizmoCamera.position.set(0, 0, 3);
      const gizmoGroup = new THREE.Group();
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

      function buildProfile(config) {
        if (profileMesh) {
          profileGroup.remove(profileMesh);
          profileMesh.geometry.dispose();
          disposeMaterial(profileMesh.material);
          profileMesh = null;
        }
        if (pressureShellMesh) {
          profileGroup.remove(pressureShellMesh);
          pressureShellMesh.geometry.dispose();
          disposeMaterial(pressureShellMesh.material);
          pressureShellMesh = null;
        }
        if (edgeMesh) {
          profileGroup.remove(edgeMesh);
          edgeMesh.geometry.dispose();
          disposeMaterial(edgeMesh.material);
          edgeMesh = null;
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

        const shape = new THREE.Shape();
        shape.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
        shape.closePath();

        const geometry = new THREE.ExtrudeGeometry(shape, {
          depth: bounds.depth,
          bevelEnabled: true,
          bevelThickness: 0.09,
          bevelSize: 0.075,
          bevelSegments: 9,
          curveSegments: 14,
        });
        geometry.center();
        geometry.computeVertexNormals();

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
          new THREE.EdgesGeometry(geometry, 15),
          new THREE.LineBasicMaterial({
            color: 0x00e5ff,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
          })
        );
        edgeMesh.position.copy(profileMesh.position);
        profileGroup.add(edgeMesh);
      }

      /* ════════════════════════════════════════════════════════════════
         PHASE 12.1 + 12.2 — VELOCITY-COLORED STREAMLINES (INCREASED DENSITY)
         ════════════════════════════════════════════════════════════════ */
      const streamGroup = new THREE.Group();
      scene.add(streamGroup);
      const lineCount = isCompact ? MOBILE_STREAMLINE_COUNT : DESKTOP_STREAMLINE_COUNT;
      const streamlines = [];
      const xStart = -4.75;
      const xEnd = 4.95;

      // Distribution buckets per 12.2 spec:
      // 40% uniform, 35% clustered near profile, 25% wake-concentrated
      const uniformCount = Math.floor(lineCount * 0.40);
      const clusterCount = Math.floor(lineCount * 0.35);
      const wakeCount = lineCount - uniformCount - clusterCount;

      for (let i = 0; i < lineCount; i++) {
        let yBase, zBase, xStartLocal, isHeroCandidate;

        if (i < uniformCount) {
          // Uniform vertical spread — full domain
          const row = i % 33;
          const layer = Math.floor(i / 33);
          const rowT = row / 32;
          const layerT = ((layer % 5) - 2) / 2;
          yBase = -1.38 + rowT * 2.76;
          zBase = layerT * 0.52 + ((i % 2) ? 0.08 : -0.08);
          xStartLocal = xStart;
          isHeroCandidate = false;
        } else if (i < uniformCount + clusterCount) {
          // Clustered near profile center (within ±0.6)
          const ci = i - uniformCount;
          const t = ci / (clusterCount - 1);
          yBase = -0.6 + t * 1.2;
          const layer = ci % 5;
          zBase = ((layer - 2) / 2) * 0.42 + ((ci % 2) ? 0.06 : -0.06);
          xStartLocal = xStart;
          isHeroCandidate = true;
        } else {
          // Wake-concentrated: start at x=0.3, more vertical spread
          const wi = i - uniformCount - clusterCount;
          const t = wi / (wakeCount - 1);
          yBase = -1.0 + t * 2.0;
          const layer = wi % 4;
          zBase = ((layer - 1.5) / 1.5) * 0.38;
          xStartLocal = 0.3;
          isHeroCandidate = false;
        }

        const geometry = new THREE.BufferGeometry();
        const posArr = new Float32Array(STREAMLINE_POINTS * 3);
        const colArr = new Float32Array(STREAMLINE_POINTS * 3);
        geometry.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
        geometry.setAttribute("color", new THREE.BufferAttribute(colArr, 3));

        const material = new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        });
        const line = new THREE.Line(geometry, material);
        streamGroup.add(line);
        streamlines.push({
          line,
          yBase,
          zBase,
          xStartLocal,
          phase: i * 0.39,
          rowT: (yBase + 1.38) / 2.76,
          isHeroCandidate,
        });
      }

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
            const vz = tubePosAttr.getZ(v);
            const vel = localVelocity(vx, vy, vz, profileBounds, null);
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

      function updateStreamlines(time, solver) {
        const flow = solver?.ux ? clamp(Math.abs(solver.ux[(solver.ux.length / 2) | 0] || 0.12), 0.04, 0.24) : 0.12;
        const travel = (time * (0.22 + flow * 0.85)) % 1;
        const bodyH = Math.max(profileBounds.height, 0.52);
        const halfBodyH = bodyH * 0.5;

        // Update regular streamlines with per-vertex velocity coloring
        streamlines.forEach(item => {
          const positions = item.line.geometry.attributes.position.array;
          const colors = item.line.geometry.attributes.color.array;
          const centerBand = Math.max(0, halfBodyH + 0.24 - Math.abs(item.yBase));
          const ySign = item.yBase >= 0 ? 1 : -1;
          const centerSign = ySign || (item.rowT > 0.5 ? 1 : -1);
          const lineXStart = item.xStartLocal;
          const lineXEnd = xEnd;

          for (let point = 0; point < STREAMLINE_POINTS; point++) {
            const pointT = point / (STREAMLINE_POINTS - 1);
            const shiftedT = (pointT + travel + item.phase * 0.006) % 1;
            const x = lineXStart + pointT * (lineXEnd - lineXStart);
            const localX = x - 0.05;
            const noseInfluence = Math.exp(-((localX + 0.42) * (localX + 0.42)) / 1.8);
            const bodyInfluence = Math.exp(-(localX * localX) / 1.25);
            const wakeInfluence = smoothstep(-0.15, 2.85, localX) * Math.exp(-Math.max(localX, 0) * 0.22);
            const wrap = centerBand * centerSign * (0.52 * bodyInfluence + 0.26 * noseInfluence);
            const wake = Math.sin(localX * 4.3 - time * 2.3 + item.phase) * wakeInfluence * (0.02 + centerBand * 0.11);
            const ripple = Math.sin(shiftedT * Math.PI * 2 + item.phase) * 0.018;
            const y = item.yBase + wrap + wake + ripple;
            const zWrap = (item.zBase >= 0 ? 1 : -1) * centerBand * 0.24 * bodyInfluence;
            const zWake = Math.cos(localX * 3.1 - time * 1.65 + item.phase) * wakeInfluence * 0.035;
            const z = item.zBase + zWrap + zWake;

            positions[point * 3] = x;
            positions[point * 3 + 1] = y;
            positions[point * 3 + 2] = z;

            // 12.1 — Velocity-mapped coloring per vertex
            const vel = localVelocity(x, y, z, profileBounds, solver);
            const [r, g, b] = jetColormap(vel);
            colors[point * 3] = r;
            colors[point * 3 + 1] = g;
            colors[point * 3 + 2] = b;
          }
          item.line.geometry.attributes.position.needsUpdate = true;
          item.line.geometry.attributes.color.needsUpdate = true;
        });

        // Update hero tube positions (same physics, different yBase range)
        heroLines.forEach(hero => {
          const centerBand = Math.max(0, halfBodyH + 0.24 - Math.abs(hero.yBase));
          const ySign = hero.yBase >= 0 ? 1 : -1;
          const centerSign = ySign || (hero.rowT > 0.5 ? 1 : -1);

          for (let point = 0; point < STREAMLINE_POINTS; point++) {
            const pointT = point / (STREAMLINE_POINTS - 1);
            const shiftedT = (pointT + travel + hero.phase * 0.006) % 1;
            const x = xStart + pointT * (xEnd - xStart);
            const localX = x - 0.05;
            const noseInfluence = Math.exp(-((localX + 0.42) * (localX + 0.42)) / 1.8);
            const bodyInfluence = Math.exp(-(localX * localX) / 1.25);
            const wakeInfluence = smoothstep(-0.15, 2.85, localX) * Math.exp(-Math.max(localX, 0) * 0.22);
            const wrap = centerBand * centerSign * (0.52 * bodyInfluence + 0.26 * noseInfluence);
            const wake = Math.sin(localX * 4.3 - time * 2.3 + hero.phase) * wakeInfluence * (0.02 + centerBand * 0.11);
            const ripple = Math.sin(shiftedT * Math.PI * 2 + hero.phase) * 0.018;
            const y = hero.yBase + wrap + wake + ripple;
            const zWrap = (hero.zBase >= 0 ? 1 : -1) * centerBand * 0.24 * bodyInfluence;
            const zWake = Math.cos(localX * 3.1 - time * 1.65 + hero.phase) * wakeInfluence * 0.035;
            const z = hero.zBase + zWrap + zWake;

            hero.points[point].set(x, y, z);
          }
        });

        // Rebuild hero tube geometry periodically (every ~6 frames for perf)
        heroRebuildTimer++;
        if (heroRebuildTimer >= 6) {
          heroRebuildTimer = 0;
          rebuildHeroTubes(THREE);
        }

        // 12.5 — Update flow particles
        const pPositions = particleSystem.geometry.attributes.position.array;
        const pColors = particleSystem.geometry.attributes.color.array;

        for (let i = 0; i < particleCount; i++) {
          const ps = particleState[i];
          const stream = streamlines[ps.streamIdx];
          if (!stream) continue;

          // Advance particle along its streamline based on local velocity
          const sPos = stream.line.geometry.attributes.position.array;
          const idx = Math.floor(ps.t * (STREAMLINE_POINTS - 1));
          const safeIdx = Math.min(idx, STREAMLINE_POINTS - 1);
          const px = sPos[safeIdx * 3];
          const py = sPos[safeIdx * 3 + 1];
          const pz = sPos[safeIdx * 3 + 2];

          const vel = localVelocity(px, py, pz, profileBounds, solver);
          ps.t += (0.003 + vel * 0.008);

          if (ps.t >= 1.0) {
            ps.t = 0.0;
            ps.streamIdx = Math.floor(Math.random() * lineCount);
          }

          // Interpolate position on streamline
          const frac = ps.t * (STREAMLINE_POINTS - 1);
          const i0 = Math.min(Math.floor(frac), STREAMLINE_POINTS - 2);
          const i1 = i0 + 1;
          const blend = frac - i0;
          const sP = stream.line.geometry.attributes.position.array;

          pPositions[i * 3] = sP[i0 * 3] * (1 - blend) + sP[i1 * 3] * blend;
          pPositions[i * 3 + 1] = sP[i0 * 3 + 1] * (1 - blend) + sP[i1 * 3 + 1] * blend;
          pPositions[i * 3 + 2] = sP[i0 * 3 + 2] * (1 - blend) + sP[i1 * 3 + 2] * blend;

          // Particle color — white-tinted version of local velocity color
          const [cr, cg, cb] = jetColormap(vel);
          pColors[i * 3] = 0.5 + cr * 0.5;
          pColors[i * 3 + 1] = 0.5 + cg * 0.5;
          pColors[i * 3 + 2] = 0.5 + cb * 0.5;
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

      domEl.addEventListener("pointerdown", onPointerDown);
      domEl.addEventListener("pointermove", onPointerMove);
      domEl.addEventListener("pointerup", onPointerUp);
      domEl.addEventListener("pointercancel", onPointerUp);
      domEl.addEventListener("wheel", onWheel, { passive: true });

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
        updateStreamlines(elapsed, solverRef?.current);
        renderer.render(scene, camera);
        gizmoGroup.quaternion.copy(camera.quaternion).invert();
        gizmoRenderer.render(gizmoScene, gizmoCamera);
      }

      buildProfile(latestConfigRef.current);
      updateStreamlines(0, solverRef?.current);
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
        get animId() { return animId; },
        cleanupControls: () => {
          domEl.removeEventListener("pointerdown", onPointerDown);
          domEl.removeEventListener("pointermove", onPointerMove);
          domEl.removeEventListener("pointerup", onPointerUp);
          domEl.removeEventListener("pointercancel", onPointerUp);
          domEl.removeEventListener("wheel", onWheel);
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
        disposeObject(t.scene);
        disposeObject(t.gizmoScene);
        t.backgroundTexture?.dispose();
        t.metalEnvMap?.dispose();
        t.renderer?.dispose();
        t.gizmoRenderer?.dispose();
        if (el.contains(t.renderer?.domElement)) el.removeChild(t.renderer.domElement);
        if (el.contains(t.gizmoRenderer?.domElement)) el.removeChild(t.gizmoRenderer.domElement);
        threeRef.current = null;
      }

    };
  }, [solverRef]);

  return (
    <div ref={mountRef} className="view-3d-stage" />
  );
}
