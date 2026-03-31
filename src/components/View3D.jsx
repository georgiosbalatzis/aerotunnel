/* ═══════════════════════════════════════════════════════════
   AEROLAB · 3D Extruded View
   Three.js r128 — orbit controls, vertex-colored surface
   Uses shared solverRef (no window global)
   f1stories.gr
   ═══════════════════════════════════════════════════════════ */

import { useEffect, useRef } from "react";
import { COLS, ROWS } from "../engine/constants.js";
import { xformPoly } from "../engine/geometry.js";

export default function View3D({ poly, solverRef, cx, cy, sx, sy, aoa }) {
  const mountRef = useRef(null);
  const threeRef = useRef(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    script.onload = () => initThree();
    document.head.appendChild(script);

    function initThree() {
      const THREE = window.THREE;
      if (!THREE || threeRef.current) return;

      const W = el.clientWidth || 800, H = el.clientHeight || 450;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(W, H);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x030305, 1);
      el.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, W/H, 0.1, 1000);
      camera.position.set(0, 0, 4);
      scene.fog = new THREE.FogExp2(0x030305, 0.08);

      scene.add(new THREE.AmbientLight(0xffffff, 0.3));
      const dir1 = new THREE.DirectionalLight(0xffeedd, 1.2); dir1.position.set(3,4,3); scene.add(dir1);
      const dir2 = new THREE.DirectionalLight(0x0088ff, 0.5); dir2.position.set(-3,-2,2); scene.add(dir2);
      const redPt = new THREE.PointLight(0xe8000d, 2, 8); redPt.position.set(-2,1,2); scene.add(redPt);

      const gridH = new THREE.GridHelper(10, 20, 0x252530, 0x1a1a28); gridH.position.y = -1.5; scene.add(gridH);

      let profileMesh = null, wireMesh = null;

      function buildProfile(rawPoly) {
        if (profileMesh) { scene.remove(profileMesh); profileMesh.geometry.dispose(); }
        if (wireMesh) { scene.remove(wireMesh); wireMesh.geometry.dispose(); }
        if (!rawPoly || rawPoly.length < 3) return;

        const xs = rawPoly.map(p=>p[0]), ys = rawPoly.map(p=>p[1]);
        const mnX=Math.min(...xs), mxX=Math.max(...xs), mnY=Math.min(...ys), mxY=Math.max(...ys);
        const rng = Math.max(mxX-mnX, mxY-mnY) || 1;
        const pts = rawPoly.map(([x,y])=>[((x-(mnX+mxX)/2)/rng)*3, ((y-(mnY+mxY)/2)/rng)*3]);
        const ang = (aoa||0)*Math.PI/180, cosA=Math.cos(ang), sinA=Math.sin(ang);
        const rotPts = pts.map(([x,y])=>[x*cosA-y*sinA, x*sinA+y*cosA]);

        const shape = new THREE.Shape();
        shape.moveTo(rotPts[0][0], rotPts[0][1]);
        for (let i = 1; i < rotPts.length; i++) shape.lineTo(rotPts[i][0], rotPts[i][1]);
        shape.closePath();

        const geo = new THREE.ExtrudeGeometry(shape, { depth:0.8, bevelEnabled:true, bevelThickness:0.04, bevelSize:0.03, bevelSegments:4 });
        const pos = geo.attributes.position;
        const colors = [];
        for (let i = 0; i < pos.count; i++) {
          const t = Math.max(0, Math.min(1, (pos.getX(i)+1.5)/3));
          let r, g, b;
          if (t < 0.33) { const s=t/0.33; r=0; g=s; b=1-s*0.5; }
          else if (t < 0.66) { const s=(t-0.33)/0.33; r=s; g=1; b=0.5-s*0.5; }
          else { const s=(t-0.66)/0.34; r=1; g=1-s; b=0; }
          colors.push(r, g, b);
        }
        geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

        const mat = new THREE.MeshPhongMaterial({ vertexColors:true, shininess:120, specular:new THREE.Color(0x445566), side:THREE.DoubleSide });
        profileMesh = new THREE.Mesh(geo, mat);
        profileMesh.position.set(0, 0, -0.4);
        scene.add(profileMesh);

        const wireMat = new THREE.MeshBasicMaterial({ color:0x252530, wireframe:true, transparent:true, opacity:0.15 });
        wireMesh = new THREE.Mesh(geo, wireMat);
        wireMesh.position.copy(profileMesh.position);
        scene.add(wireMesh);
      }

      // Streamlines
      const streamGroup = new THREE.Group(); scene.add(streamGroup);
      const lineMat = new THREE.LineBasicMaterial({ color:0x00b4ff, transparent:true, opacity:0.35 });
      const nLines = 12, lineObjs = [];
      for (let i = 0; i < nLines; i++) {
        const geo = new THREE.BufferGeometry();
        const pts = new Float32Array(60*3);
        geo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
        geo.setDrawRange(0, 0);
        const line = new THREE.Line(geo, lineMat.clone());
        streamGroup.add(line);
        lineObjs.push({ line, pts, geo });
      }

      // Manual orbit
      let isDragging = false, prevMouse = {x:0,y:0}, spherical = {phi:1.2, theta:0.4, r:4};
      const domEl = renderer.domElement;
      domEl.addEventListener("mousedown", e => { isDragging=true; prevMouse={x:e.clientX,y:e.clientY}; });
      domEl.addEventListener("mousemove", e => {
        if (!isDragging) return;
        spherical.theta -= (e.clientX-prevMouse.x)*0.008;
        spherical.phi -= (e.clientY-prevMouse.y)*0.008;
        spherical.phi = Math.max(0.1, Math.min(Math.PI-0.1, spherical.phi));
        prevMouse = {x:e.clientX, y:e.clientY};
      });
      domEl.addEventListener("mouseup", () => isDragging=false);
      domEl.addEventListener("mouseleave", () => isDragging=false);
      domEl.addEventListener("wheel", e => { spherical.r = Math.max(1.5, Math.min(10, spherical.r+e.deltaY*0.005)); }, {passive:true});

      let frame = 0, animId;
      function animate() {
        animId = requestAnimationFrame(animate);
        frame++;
        const sinPhi=Math.sin(spherical.phi), cosPhi=Math.cos(spherical.phi);
        const sinTh=Math.sin(spherical.theta), cosTh=Math.cos(spherical.theta);
        camera.position.set(spherical.r*sinPhi*sinTh, spherical.r*cosPhi, spherical.r*sinPhi*cosTh);
        camera.lookAt(0,0,0);

        // Feed from solver ref (no window global)
        const solver = solverRef?.current;
        if (solver && frame % 4 === 0) {
          for (let li = 0; li < nLines; li++) {
            const { pts, geo } = lineObjs[li];
            const yFrac = (li+0.5)/nLines;
            let px = 0, py = yFrac*ROWS, cnt = 0;
            for (let step = 0; step < 60; step++) {
              const ix = Math.max(0,Math.min(COLS-2,px|0)), iy = Math.max(0,Math.min(ROWS-2,py|0));
              if (solver.solid[iy*COLS+ix]) break;
              const vx = solver.ux[iy*COLS+ix], vy = solver.uy[iy*COLS+ix];
              pts[step*3] = ((px/COLS)-.5)*4;
              pts[step*3+1] = ((py/ROWS)-.5)*-3;
              pts[step*3+2] = (Math.random()-.5)*0.6;
              px += vx*3; py += vy*3;
              if (px >= COLS-2) break;
              cnt++;
            }
            geo.attributes.position.array.set(pts);
            geo.attributes.position.needsUpdate = true;
            geo.setDrawRange(0, cnt);
          }
        }
        redPt.intensity = 1.5 + Math.sin(frame*0.03)*0.5;
        renderer.render(scene, camera);
      }

      buildProfile(poly);
      animate();

      const ro = new ResizeObserver(() => {
        const w = el.clientWidth, h = el.clientHeight;
        renderer.setSize(w, h);
        camera.aspect = w/h;
        camera.updateProjectionMatrix();
      });
      ro.observe(el);

      threeRef.current = { scene, renderer, camera, buildProfile, animId, ro, script };
    }

    return () => {
      const t = threeRef.current;
      if (t) {
        cancelAnimationFrame(t.animId);
        t.ro?.disconnect();
        t.renderer?.dispose();
        if (el.contains(t.renderer?.domElement)) el.removeChild(t.renderer.domElement);
        threeRef.current = null;
      }
      if (document.head.contains(script)) document.head.removeChild(script);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = threeRef.current;
    if (t?.buildProfile && poly) {
      // Build with raw poly transformed
      t.buildProfile(xformPoly(poly, cx, cy, sx, sy, aoa));
    }
  }, [poly, cx, cy, sx, sy, aoa]);

  return (
    <div ref={mountRef} style={{position:"absolute",inset:0,background:"#030305"}}>
      <div className="view-3d-label">3D EXTRUDED VIEW · DRAG TO ORBIT · SCROLL ZOOM</div>
      <div className="view-3d-hint">WebGL · Three.js r128</div>
    </div>
  );
}
