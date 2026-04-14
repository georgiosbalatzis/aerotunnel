import { useEffect, useRef } from "react";

const THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
const DESKTOP_STREAMLINE_COUNT = 132;
const MOBILE_STREAMLINE_COUNT = 82;
const STREAMLINE_POINTS = 128;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
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

export default function View3D({ poly, solverRef, cx, cy, sx, sy, aoa }) {
  const mountRef = useRef(null);
  const threeRef = useRef(null);
  const latestConfigRef = useRef({ poly, cx, cy, sx, sy, aoa });

  useEffect(() => {
    latestConfigRef.current = { poly, cx, cy, sx, sy, aoa };
    const t = threeRef.current;
    if (t?.buildProfile) t.buildProfile(latestConfigRef.current);
  }, [poly, cx, cy, sx, sy, aoa]);

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
      renderer.setClearColor(0xf7f9fb, 1);
      if ("outputEncoding" in renderer && THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.domElement.style.touchAction = "none";
      el.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf7f9fb);
      scene.fog = new THREE.Fog(0xf7f9fb, 7.5, 14);

      const isCompact = typeof window !== "undefined" && window.innerWidth < 720;
      const camera = new THREE.PerspectiveCamera(isCompact ? 42 : 34, width / height, 0.1, 100);
      const orbit = { phi: 1.45, theta: 0.12, radius: isCompact ? 8.9 : 7.35 };
      const focus = new THREE.Vector3(0.25, 0, 0);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x8cc8ff, 0.58));
      const keyLight = new THREE.DirectionalLight(0xffffff, 0.95);
      keyLight.position.set(-3, 4, 5);
      scene.add(keyLight);
      const rimLight = new THREE.DirectionalLight(0x2bdcff, 0.55);
      rimLight.position.set(4, 0.6, 3);
      scene.add(rimLight);
      const warmLight = new THREE.PointLight(0xffb12d, 0.42, 7);
      warmLight.position.set(-1.6, 1.4, 2.4);
      scene.add(warmLight);

      const tunnelGroup = new THREE.Group();
      scene.add(tunnelGroup);

      const tunnelPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(10.4, 3.55, 1, 1),
        new THREE.MeshBasicMaterial({ color: 0xf7f9fb })
      );
      tunnelPlane.position.set(0.25, 0, -1.35);
      tunnelGroup.add(tunnelPlane);

      const centerGuide = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-4.75, 0, -1.34),
          new THREE.Vector3(4.85, 0, -1.34),
        ]),
        new THREE.LineBasicMaterial({ color: 0xdce8ef, transparent: true, opacity: 0.55 })
      );
      tunnelGroup.add(centerGuide);

      const profileGroup = new THREE.Group();
      scene.add(profileGroup);

      let profileMesh = null;
      let profileGlow = null;
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

      function surfaceColorAt(THREE, x, y, bounds) {
        const xT = clamp((x + bounds.width * 0.5) / bounds.width, 0, 1);
        const yT = clamp((y + bounds.height * 0.5) / bounds.height, 0, 1);
        const nose = 1 - smoothstep(0.05, 0.24, xT);
        const upper = smoothstep(0.5, 0.9, yT);
        const underside = 1 - smoothstep(0.22, 0.5, yT);
        const wake = smoothstep(0.58, 0.95, xT);
        const crown = upper * (1 - smoothstep(0.68, 0.98, xT));

        const color = new THREE.Color(0x08bce8);
        color.lerp(new THREE.Color(0x00d46a), clamp((1 - underside) * 0.3 + nose * 0.18, 0, 0.45));
        color.lerp(new THREE.Color(0xd4ec18), clamp(nose * 0.72 + crown * 0.18, 0, 0.82));
        color.lerp(new THREE.Color(0xff9500), clamp(crown * 0.72 + nose * 0.22, 0, 0.78));
        color.lerp(new THREE.Color(0xe8000d), clamp(crown * 0.42, 0, 0.48));
        color.lerp(new THREE.Color(0x0d61ff), clamp(underside * 0.5 + wake * 0.44, 0, 0.62));
        return color;
      }

      function buildProfile(config) {
        if (profileMesh) {
          profileGroup.remove(profileMesh);
          profileMesh.geometry.dispose();
          disposeMaterial(profileMesh.material);
          profileMesh = null;
        }
        if (profileGlow) {
          profileGroup.remove(profileGlow);
          profileGlow.geometry.dispose();
          disposeMaterial(profileGlow.material);
          profileGlow = null;
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

        const position = geometry.attributes.position;
        const colors = [];
        for (let i = 0; i < position.count; i++) {
          const color = surfaceColorAt(THREE, position.getX(i), position.getY(i), bounds);
          colors.push(color.r, color.g, color.b);
        }
        geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

        const material = new THREE.MeshPhongMaterial({
          vertexColors: true,
          shininess: 24,
          specular: new THREE.Color(0x1d2933),
          emissive: new THREE.Color(0x151d20),
          side: THREE.DoubleSide,
        });
        profileMesh = new THREE.Mesh(geometry, material);
        profileMesh.position.set(0.05, 0, 0.02);
        profileGroup.add(profileMesh);

        profileGlow = new THREE.Mesh(
          geometry.clone(),
          new THREE.MeshBasicMaterial({
            color: 0x18d8ff,
            transparent: true,
            opacity: 0.045,
            side: THREE.BackSide,
            depthWrite: false,
          })
        );
        profileGlow.scale.set(1.055, 1.065, 1.08);
        profileGlow.position.copy(profileMesh.position);
        profileGroup.add(profileGlow);
      }

      const streamGroup = new THREE.Group();
      scene.add(streamGroup);
      const lineCount = isCompact ? MOBILE_STREAMLINE_COUNT : DESKTOP_STREAMLINE_COUNT;
      const streamlines = [];
      const xStart = -4.75;
      const xEnd = 4.95;

      for (let i = 0; i < lineCount; i++) {
        const row = i % 33;
        const layer = Math.floor(i / 33);
        const rowT = row / 32;
        const layerT = ((layer % 5) - 2) / 2;
        const yBase = -1.38 + rowT * 2.76;
        const zBase = layerT * 0.52 + ((i % 2) ? 0.08 : -0.08);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(STREAMLINE_POINTS * 3), 3));
        const opacity = 0.14 + (1 - Math.abs(layerT)) * 0.2 + (i % 3) * 0.018;
        const material = new THREE.LineBasicMaterial({
          color: i % 5 === 0 ? 0x47f1ff : 0x10cdd7,
          transparent: true,
          opacity: clamp(opacity, 0.12, 0.42),
          depthWrite: false,
        });
        const line = new THREE.Line(geometry, material);
        streamGroup.add(line);
        streamlines.push({ line, yBase, zBase, phase: i * 0.39, rowT });
      }

      function updateStreamlines(time, solver) {
        const flow = solver?.ux ? clamp(Math.abs(solver.ux[(solver.ux.length / 2) | 0] || 0.12), 0.04, 0.24) : 0.12;
        const travel = (time * (0.22 + flow * 0.85)) % 1;
        const bodyH = Math.max(profileBounds.height, 0.52);
        const halfBodyH = bodyH * 0.5;

        streamlines.forEach(item => {
          const positions = item.line.geometry.attributes.position.array;
          const centerBand = Math.max(0, halfBodyH + 0.24 - Math.abs(item.yBase));
          const ySign = item.yBase >= 0 ? 1 : -1;
          const centerSign = ySign || (item.rowT > 0.5 ? 1 : -1);

          for (let point = 0; point < STREAMLINE_POINTS; point++) {
            const pointT = point / (STREAMLINE_POINTS - 1);
            const shiftedT = (pointT + travel + item.phase * 0.006) % 1;
            const x = xStart + pointT * (xEnd - xStart);
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
          }
          item.line.geometry.attributes.position.needsUpdate = true;
        });
      }

      let isDragging = false;
      let previousPointer = { x: 0, y: 0 };
      const domEl = renderer.domElement;

      const onPointerDown = event => {
        isDragging = true;
        previousPointer = { x: event.clientX, y: event.clientY };
        domEl.setPointerCapture?.(event.pointerId);
      };
      const onPointerMove = event => {
        if (!isDragging) return;
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
        orbit.radius = clamp(orbit.radius + event.deltaY * 0.004, 3.4, 9.2);
      };

      domEl.addEventListener("pointerdown", onPointerDown);
      domEl.addEventListener("pointermove", onPointerMove);
      domEl.addEventListener("pointerup", onPointerUp);
      domEl.addEventListener("pointercancel", onPointerUp);
      domEl.addEventListener("wheel", onWheel, { passive: true });

      let animId = 0;
      const clock = new THREE.Clock();

      function animate() {
        animId = requestAnimationFrame(animate);
        const elapsed = clock.getElapsedTime();
        if (!isDragging) orbit.theta += 0.0008;

        const sinPhi = Math.sin(orbit.phi);
        camera.position.set(
          orbit.radius * sinPhi * Math.sin(orbit.theta),
          orbit.radius * Math.cos(orbit.phi),
          orbit.radius * sinPhi * Math.cos(orbit.theta)
        );
        camera.lookAt(focus);

        profileGroup.rotation.y = Math.sin(elapsed * 0.28) * 0.035;
        warmLight.intensity = 0.36 + Math.sin(elapsed * 1.7) * 0.08;
        updateStreamlines(elapsed, solverRef?.current);
        renderer.render(scene, camera);
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
        renderer,
        scene,
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
        t.renderer?.dispose();
        if (el.contains(t.renderer?.domElement)) el.removeChild(t.renderer.domElement);
        threeRef.current = null;
      }

    };
  }, [solverRef]);

  return (
    <div ref={mountRef} className="view-3d-stage">
      <div className="view-3d-label">3D AERO TUNNEL · STREAMLINE FIELD</div>
      <div className="view-3d-hint">LBM D2Q9 · SURFACE MAP</div>
    </div>
  );
}
