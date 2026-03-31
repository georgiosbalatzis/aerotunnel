import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTheme } from "./ThemeContext";
import ThemeToggle from "./ThemeToggle";
import "./cfdlab.css";

/* ═══════════════════════════════════════════════════════════════
   AEROLAB · F1 TELEMETRY TERMINAL
   Lattice Boltzmann D2Q9 · Three.js 3D · f1stories.gr
   ═══════════════════════════════════════════════════════════════ */

const isMobile = typeof window !== "undefined" && window.innerWidth < 720;
const SIM_W = isMobile ? 640 : 1000;
const SIM_H = isMobile ? 320 : 450;
const COLS = isMobile ? 208 : 300;
const ROWS = isMobile ? 104 : 135;
const DEFAULT_PARTICLES = isMobile ? 220 : 420;
const MAX_PARTICLES = isMobile ? 900 : 2000;
const TRAIL_LEN = isMobile ? 56 : 80;

/* ── Mode definitions ── */
const MODES = [
  { id: "velocity",    label: "Velocity",    short: "VEL", color: "#00b4ff", tone: "var(--f1-blue)"   },
  { id: "pressure",   label: "Pressure",    short: "PRS", color: "#ff9500", tone: "var(--f1-amber)"  },
  { id: "streamlines",label: "Streamlines", short: "STR", color: "#00d46a", tone: "var(--f1-green)"  },
  { id: "vorticity",  label: "Vorticity",   short: "VRT", color: "#e8000d", tone: "var(--f1-red)"    },
  { id: "3d",         label: "3D View",     short: "3D",  color: "#ff9500", tone: "var(--f1-amber)"  },
];

const PRESET_GROUPS = [
  {
    label: "Benchmark",
    items: [
      { id: "airfoil",  label: "Airfoil",     desc: "Cambered section" },
      { id: "cylinder", label: "Cylinder",    desc: "Wake benchmark"   },
      { id: "wedge",    label: "Wedge",       desc: "Sharp L.E. study" },
      { id: "bluff",    label: "Bluff",       desc: "Separation case"  },
    ],
  },
  {
    label: "F1 Profiles",
    items: [
      { id: "f1car",     label: "F1 Car",      desc: "Full silhouette" },
      { id: "frontwing", label: "Front Wing",  desc: "Forward element" },
      { id: "rearwing",  label: "Rear Wing",   desc: "High downforce"  },
    ],
  },
];

const IMPORT_TABS = [
  { id: "preset", label: "Presets" },
  { id: "svg",    label: "SVG" },
  { id: "stl",    label: "STL" },
  { id: "dxf",    label: "DXF" },
  { id: "draw",   label: "Sketch" },
  { id: "image",  label: "Image" },
];

const SHORTCUTS = [
  ["Space", "Run / Pause"],
  ["R",     "Reset solver"],
  ["1-5",   "Switch view mode"],
  ["F",     "Fullscreen"],
  ["S",     "Snapshot"],
  ["/",     "Keyboard help"],
];

/* ── LUT builders ── */
function buildTurbo() {
  const lut = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const r = Math.max(0, Math.min(255, (34.61 + t*(1172.33-t*(10793.56-t*(33300.12-t*(38394.49-t*14825.05))))) | 0));
    const g = Math.max(0, Math.min(255, (23.31 + t*(557.33+t*(1225.33-t*(3574.96-t*(1073.77+t*707.56))))) | 0));
    const b = Math.max(0, Math.min(255, (27.2 + t*(3211.1-t*(15327.97-t*(27814.0-t*(22569.18-t*6838.66))))) | 0));
    lut[i] = (255<<24)|(b<<16)|(g<<8)|r;
  }
  return lut;
}
function buildCoolWarm() {
  const lut = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let r, g, b;
    if (t < 0.5) { const s=t*2; r=(30+s*170)|0; g=(60+s*120)|0; b=(200-s*10)|0; }
    else { const s=(t-.5)*2; r=(200+s*55)|0; g=(180-s*155)|0; b=(190-s*165)|0; }
    lut[i] = (255<<24)|(Math.min(255,Math.max(0,b))<<16)|(Math.min(255,Math.max(0,g))<<8)|Math.min(255,Math.max(0,r));
  }
  return lut;
}
const TURBO = buildTurbo(), COOLWARM = buildCoolWarm();

/* ── Geometry helpers ── */
function pip(px, py, poly) {
  let ins = false;
  for (let i = 0, j = poly.length-1; i < poly.length; j=i++) {
    const [xi,yi]= poly[i], [xj,yj]= poly[j];
    if (((yi>py)!==(yj>py)) && px<((xj-xi)*(py-yi))/(yj-yi)+xi) ins=!ins;
  }
  return ins;
}
function normPoly(pts) {
  if (!pts||pts.length<3) return null;
  const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]);
  const x0=Math.min(...xs), x1=Math.max(...xs), y0=Math.min(...ys), y1=Math.max(...ys);
  const rx=x1-x0||1, ry=y1-y0||1;
  return pts.map(p=>[(p[0]-x0)/rx,(p[1]-y0)/ry]);
}
function xformPoly(n, cx, cy, sx, sy, aoa) {
  const r=aoa*Math.PI/180, c=Math.cos(r), s=Math.sin(r);
  return n.map(([nx,ny])=>{
    const lx=(nx-.5)*sx, ly=(ny-.5)*sy;
    return [cx+c*lx-s*ly, cy+s*lx+c*ly];
  });
}
function simplPoly(pts, tol) {
  if (pts.length<=4) return pts;
  const res=[pts[0]];
  for (let i=1;i<pts.length-1;i++) {
    const p=res[res.length-1], n=pts[i+1], c=pts[i];
    const dx=n[0]-p[0], dy=n[1]-p[1], l=Math.sqrt(dx*dx+dy*dy)||1;
    if (Math.abs(dy*c[0]-dx*c[1]+n[0]*p[1]-n[1]*p[0])/l>tol) res.push(c);
  }
  res.push(pts[pts.length-1]);
  return res;
}

/* ── Preset generator ── */
function genPreset(type) {
  const p = [];
  if (type==="airfoil") {
    for (let t=0;t<=Math.PI*2;t+=.04){const c=Math.cos(t),s=Math.sin(t);p.push([.5+.48*c*(.5+.5*c),.5+.18*s*(1+.3*c)]);}
  } else if (type==="cylinder") {
    for (let t=0;t<=Math.PI*2;t+=.05) p.push([.5+.45*Math.cos(t),.5+.45*Math.sin(t)]);
  } else if (type==="wedge") {
    p.push([.05,.25],[.95,.5],[.05,.75]);
  } else if (type==="bluff") {
    p.push([.1,.1],[.9,.1],[.9,.9],[.1,.9]);
  } else if (type==="f1car") {
    [[0,.58],[.01,.55],[.03,.49],[.05,.43],[.07,.4],[.09,.41],[.12,.39],[.15,.35],[.17,.33],[.2,.31],[.24,.29],[.28,.27],[.3,.25],[.32,.22],[.34,.21],[.36,.23],[.38,.24],[.4,.22],[.42,.23],[.44,.27],[.47,.25],[.5,.23],[.54,.22],[.58,.22],[.62,.23],[.66,.24],[.7,.26],[.74,.28],[.78,.3],[.8,.27],[.82,.22],[.84,.18],[.86,.17],[.88,.18],[.9,.2],[.92,.25],[.94,.32],[.96,.38],[.98,.42],[1,.46],[1,.5],[.98,.54],[.96,.58],[.94,.62],[.9,.65],[.86,.66],[.8,.66],[.7,.66],[.6,.66],[.5,.66],[.4,.66],[.3,.64],[.24,.64],[.18,.66],[.12,.67],[.08,.67],[.06,.64],[.04,.61],[.02,.59],[0,.58]].forEach(v=>p.push(v));
  } else if (type==="frontwing") {
    [[0,.55],[.04,.42],[.1,.33],[.18,.27],[.3,.24],[.45,.24],[.6,.27],[.75,.33],[.88,.44],[.95,.58],[1,.62],[1,.65],[.9,.66],[.75,.63],[.6,.62],[.45,.63],[.3,.65],[.15,.67],[.06,.63],[0,.57]].forEach(v=>p.push(v));
  } else if (type==="rearwing") {
    [[0,.5],[.06,.34],[.13,.24],[.25,.19],[.4,.18],[.55,.2],[.7,.25],[.85,.37],[.95,.52],[1,.54],[1,.58],[.92,.65],[.75,.68],[.55,.68],[.35,.68],[.2,.65],[.1,.6],[.04,.54],[0,.5]].forEach(v=>p.push(v));
  }
  return p;
}

/* ── File parsers (same as before) ── */
function parseSVG(svgText, maxPoints=200) {
  try {
    const doc=new DOMParser().parseFromString(svgText,"image/svg+xml");
    const els=doc.querySelectorAll("path,polygon,polyline,rect,circle,ellipse");
    if (!els.length) return null;
    const all=[]; const ts=document.createElementNS("http://www.w3.org/2000/svg","svg");
    ts.style.cssText="position:absolute;visibility:hidden;width:0;height:0";
    document.body.appendChild(ts);
    els.forEach(el=>{
      const tag=el.tagName.toLowerCase(); let pts=[]; const pp=Math.max(20,Math.floor(maxPoints/els.length));
      if (tag==="polygon"||tag==="polyline"){const raw=(el.getAttribute("points")||"").trim().split(/[\s,]+/);for(let i=0;i<raw.length-1;i+=2){const x=parseFloat(raw[i]),y=parseFloat(raw[i+1]);if(!isNaN(x)&&!isNaN(y))pts.push([x,y]);}}
      else if (tag==="rect"){const x=+el.getAttribute("x")||0,y=+el.getAttribute("y")||0,w=+el.getAttribute("width"),h=+el.getAttribute("height");if(w&&h)pts=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];}
      else if (tag==="circle"||tag==="ellipse"){const cx=+(el.getAttribute("cx")||0),cy=+(el.getAttribute("cy")||0),rx=+(el.getAttribute("r")||el.getAttribute("rx")||50),ry=+(el.getAttribute("r")||el.getAttribute("ry")||rx);for(let i=0;i<=pp;i++){const t=(i/pp)*Math.PI*2;pts.push([cx+rx*Math.cos(t),cy+ry*Math.sin(t)]);}}
      else if (tag==="path"){const d=el.getAttribute("d");if(d){const pe=document.createElementNS("http://www.w3.org/2000/svg","path");pe.setAttribute("d",d);ts.appendChild(pe);try{const tl=pe.getTotalLength();for(let i=0;i<=pp;i++){const pt=pe.getPointAtLength((i/pp)*tl);pts.push([pt.x,pt.y]);}}catch{}pe.remove();}}
      if (pts.length>=3) all.push(...pts);
    });
    document.body.removeChild(ts);
    if (all.length<3) return null;
    const cx=all.reduce((s,p)=>s+p[0],0)/all.length, cy=all.reduce((s,p)=>s+p[1],0)/all.length;
    all.sort((a,b)=>Math.atan2(a[1]-cy,a[0]-cx)-Math.atan2(b[1]-cy,b[0]-cx));
    if (all.length>300){const st=Math.ceil(all.length/300);return normPoly(all.filter((_,i)=>i%st===0));}
    return normPoly(all);
  } catch { return null; }
}
function parseDXF(text) {
  const lines=text.split(/\r?\n/).map(l=>l.trim()); const pts=[]; let i=0, px=null;
  while(i<lines.length){const c=parseInt(lines[i],10);if(c===10&&i+1<lines.length){px=parseFloat(lines[i+1]);i+=2;}else if(c===20&&i+1<lines.length&&px!==null){const y=parseFloat(lines[i+1]);if(!isNaN(px)&&!isNaN(y))pts.push([px,y]);px=null;i+=2;}else i++;}
  return pts.length>2?normPoly(pts):null;
}
function parseSTL(data) {
  try {
    const preview=typeof data==="string"?data:new TextDecoder().decode(data.slice(0,1000)); const verts=[];
    if (preview.trim().startsWith("solid")){const full=typeof data==="string"?data:new TextDecoder().decode(data);const re=/vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;let m;while((m=re.exec(full)))verts.push([parseFloat(m[1]),parseFloat(m[2]),parseFloat(m[3])]);}
    else{const dv=new DataView(data instanceof ArrayBuffer?data:data.buffer);const nt=dv.getUint32(80,true);for(let i=0;i<nt;i++){const o=84+i*50;for(let v=0;v<3;v++){const vo=o+12+v*12;verts.push([dv.getFloat32(vo,true),dv.getFloat32(vo+4,true),dv.getFloat32(vo+8,true)]);}}}
    if (verts.length<3) return null;
    const zs=verts.map(v=>v[2]),zMid=(Math.min(...zs)+Math.max(...zs))/2,tol=(Math.max(...zs)-Math.min(...zs))*.05||1;
    const pts2d=[]; verts.forEach(([x,y,z])=>{if(Math.abs(z-zMid)<tol)pts2d.push([x,y]);});
    if (pts2d.length<5) verts.forEach(([x,y])=>pts2d.push([x,y]));
    const cx=pts2d.reduce((s,p)=>s+p[0],0)/pts2d.length, cy=pts2d.reduce((s,p)=>s+p[1],0)/pts2d.length;
    pts2d.sort((a,b)=>Math.atan2(a[1]-cy,a[0]-cx)-Math.atan2(b[1]-cy,b[0]-cx));
    if (pts2d.length>250){const st=Math.ceil(pts2d.length/250);return normPoly(pts2d.filter((_,i)=>i%st===0));}
    return normPoly(pts2d);
  } catch { return null; }
}
function traceImg(id, w, h, np=100) {
  const d=id.data, edges=[];
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=(y*w+x)*4,br=d[i]*.3+d[i+1]*.59+d[i+2]*.11;if(br<128){const nb=[(y-1)*w+(x-1),(y-1)*w+x,(y-1)*w+(x+1),y*w+(x-1),y*w+(x+1),(y+1)*w+(x-1),(y+1)*w+x,(y+1)*w+(x+1)];if(nb.some(n=>(d[n*4]*.3+d[n*4+1]*.59+d[n*4+2]*.11)>=128))edges.push([x,y]);}}
  if (edges.length<5) return null;
  const cx=edges.reduce((s,p)=>s+p[0],0)/edges.length, cy=edges.reduce((s,p)=>s+p[1],0)/edges.length;
  edges.sort((a,b)=>Math.atan2(a[1]-cy,a[0]-cx)-Math.atan2(b[1]-cy,b[0]-cx));
  const st=Math.max(1,Math.floor(edges.length/np));
  return normPoly(edges.filter((_,i)=>i%st===0));
}

/* ── LBM Solver ── */
const CX=[0,1,0,-1,0,1,-1,-1,1], CY=[0,0,1,0,-1,1,1,-1,-1];
const WT=[4/9,1/9,1/9,1/9,1/9,1/36,1/36,1/36,1/36], OPP=[0,3,4,1,2,7,8,5,6];

class LBM {
  constructor(c,r){this.C=c;this.R=r;this.N=c*r;this.f0=new Float32Array(9*this.N);this.f1=new Float32Array(9*this.N);this.rho=new Float32Array(this.N);this.ux=new Float32Array(this.N);this.uy=new Float32Array(this.N);this.solid=new Uint8Array(this.N);this.spd=new Float32Array(this.N);this.curl=new Float32Array(this.N);this.omega=1.85;this._init(.12);}
  _init(u0){for(let k=0;k<this.N;k++){this.rho[k]=1;this.ux[k]=u0;this.uy[k]=0;const b=k*9,usq=u0*u0;for(let d=0;d<9;d++){const cu=CX[d]*u0;this.f0[b+d]=WT[d]*(1+3*cu+4.5*cu*cu-1.5*usq);}}}
  setNu(nu){this.omega=Math.min(1.95,Math.max(.5,1/(3*nu+.5)));}
  buildSolid(poly){this.solid.fill(0);if(!poly)return;for(let j=0;j<this.R;j++)for(let i=0;i<this.C;i++)if(pip(i+.5,j+.5,poly))this.solid[j*this.C+i]=1;}
  step(inU,turb){
    const{C,R,N,f0,f1,rho,ux,uy,solid,omega}=this;
    for(let j=0;j<R;j++)for(let i=0;i<C;i++){const k=j*C+i,dst=k*9;for(let d=0;d<9;d++){const si=i-CX[d],sj=j-CY[d];f1[dst+d]=(si>=0&&si<C&&sj>=0&&sj<R)?f0[(sj*C+si)*9+d]:f0[k*9+OPP[d]];}}
    for(let k=0;k<N;k++){if(!solid[k])continue;const b=k*9;const t1=f1[b+1],t2=f1[b+2],t3=f1[b+3],t4=f1[b+4],t5=f1[b+5],t6=f1[b+6],t7=f1[b+7],t8=f1[b+8];f1[b+1]=t3;f1[b+3]=t1;f1[b+2]=t4;f1[b+4]=t2;f1[b+5]=t7;f1[b+7]=t5;f1[b+6]=t8;f1[b+8]=t6;}
    for(let k=0;k<N;k++){if(solid[k]){ux[k]=0;uy[k]=0;rho[k]=1;this.spd[k]=0;continue;}const b=k*9;let r=0,vx=0,vy=0;for(let d=0;d<9;d++){const fv=f1[b+d];r+=fv;vx+=CX[d]*fv;vy+=CY[d]*fv;}if(r<.01)r=1;rho[k]=r;ux[k]=vx/r;uy[k]=vy/r;this.spd[k]=Math.sqrt(vx*vx+vy*vy)/r;}
    const ps=turb*.004;
    for(let j=1;j<R-1;j++){const k=j*C,b=k*9,v0=(Math.random()-.5)*ps;const ri=(f1[b]+f1[b+2]+f1[b+4]+2*(f1[b+3]+f1[b+6]+f1[b+7]))/(1-inU);f1[b+1]=f1[b+3]+(2/3)*ri*inU;f1[b+5]=f1[b+7]+(1/6)*ri*inU+.5*ri*v0-.5*(f1[b+2]-f1[b+4]);f1[b+8]=f1[b+6]+(1/6)*ri*inU-.5*ri*v0+.5*(f1[b+2]-f1[b+4]);rho[k]=ri;ux[k]=inU;uy[k]=v0;}
    for(let j=1;j<R-1;j++){const ke=j*C+(C-1),kp=ke-1,be=ke*9,bp=kp*9;for(let d=0;d<9;d++)f1[be+d]=f1[bp+d];rho[ke]=rho[kp];ux[ke]=ux[kp];uy[ke]=uy[kp];this.spd[ke]=this.spd[kp];}
    for(let i=0;i<C;i++){const kt=i,bt=kt*9;f1[bt+4]=f1[bt+2];f1[bt+7]=f1[bt+5];f1[bt+8]=f1[bt+6];ux[kt]=0;uy[kt]=0;const kb=(R-1)*C+i,bb=kb*9;f1[bb+2]=f1[bb+4];f1[bb+5]=f1[bb+7];f1[bb+6]=f1[bb+8];ux[kb]=0;uy[kb]=0;}
    for(let k=0;k<N;k++){const b=k*9;if(solid[k]){for(let d=0;d<9;d++)f0[b+d]=f1[b+d];continue;}const r=rho[k],vx=ux[k],vy=uy[k],usq=vx*vx+vy*vy;for(let d=0;d<9;d++){const cu=CX[d]*vx+CY[d]*vy;f0[b+d]=f1[b+d]+omega*(WT[d]*r*(1+3*cu+4.5*cu*cu-1.5*usq)-f1[b+d]);}}
    for(let j=1;j<R-1;j++)for(let i=1;i<C-1;i++){const k=j*C+i;this.curl[k]=(uy[k+1]-uy[k-1])*.5-(ux[k+C]-ux[k-C])*.5;}
  }
}

/* ── Particles ── */
class Particle {
  constructor(lY){this.x=0;this.y=0;this.age=0;this.tx=new Float32Array(TRAIL_LEN);this.ty=new Float32Array(TRAIL_LEN);this.tl=0;this.ti=0;this.active=true;this.lY=lY||0;this.reset();}
  reset(){this.x=Math.random()*2;this.y=this.lY>0?this.lY+(Math.random()-.5)*2:2+Math.random()*(ROWS-4);this.age=0;this.tl=0;this.ti=0;}
  static vel(s,x,y){const i0=Math.max(0,Math.min(COLS-2,x|0)),j0=Math.max(0,Math.min(ROWS-2,y|0)),tx=x-i0,ty=y-j0,k00=j0*COLS+i0,k10=k00+1,k01=k00+COLS,k11=k01+1;if(s.solid[k00]||s.solid[k10]||s.solid[k01]||s.solid[k11])return[0,0];return[(1-tx)*(1-ty)*s.ux[k00]+tx*(1-ty)*s.ux[k10]+(1-tx)*ty*s.ux[k01]+tx*ty*s.ux[k11],(1-tx)*(1-ty)*s.uy[k00]+tx*(1-ty)*s.uy[k10]+(1-tx)*ty*s.uy[k01]+tx*ty*s.uy[k11]];}
  update(s){if(!this.active)return;if(this.x<0||this.x>=COLS-1||this.y<1||this.y>=ROWS-1){this.reset();return;}if(s.solid[(this.y|0)*COLS+(this.x|0)]){this.reset();return;}const idx=this.ti%TRAIL_LEN;this.tx[idx]=this.x*(SIM_W/COLS);this.ty[idx]=this.y*(SIM_H/ROWS);this.ti++;if(this.tl<TRAIL_LEN)this.tl++;const[a,b]=Particle.vel(s,this.x,this.y),[c,d]=Particle.vel(s,this.x+a*.5,this.y+b*.5);this.x+=c;this.y+=d;this.age+=.016;if(this.x>=COLS-2||this.x<0||this.y<1||this.y>=ROWS-1)this.reset();}
}

function mkPool(){const pool=[];const nL=Math.min(MAX_PARTICLES,50);for(let i=0;i<MAX_PARTICLES;i++){const p=new Particle(3+((i%nL)/nL)*(ROWS-6));p.active=i<DEFAULT_PARTICLES;pool.push(p);}return pool;}
function resPool(pool,n){const t=Math.min(n,MAX_PARTICLES);for(let i=0;i<pool.length;i++){if(i<t){if(!pool[i].active){pool[i].active=true;pool[i].reset();}}else pool[i].active=false;}}

function useHistory(ml=200){const r=useRef([]);const p=useCallback(e=>{r.current.push({...e,t:Date.now()});if(r.current.length>ml)r.current.shift();},[ml]);return[r,p];}

/* ── F1 Logo ── */
function F1Logo({ size=20 }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 48 46" fill="none" aria-hidden>
      <path fill={`url(#${id})`} d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/>
      <defs><linearGradient id={id} x1="0" y1="0" x2="48" y2="46" gradientUnits="userSpaceOnUse"><stop stopColor="#e8000d"/><stop offset="0.5" stopColor="#ff6600"/><stop offset="1" stopColor="#f0f0f8"/></linearGradient></defs>
    </svg>
  );
}

/* ── Collapsible sidebar section ── */
function SidebarSection({ title, defaultOpen=true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`sidebar-section ${open ? "is-open" : ""}`}>
      <button className="sidebar-section__header" onClick={()=>setOpen(o=>!o)}>
        <span className="sidebar-section__title">{title}</span>
        <span className="sidebar-section__toggle">▶</span>
      </button>
      <div className="sidebar-section__body">{children}</div>
    </div>
  );
}

/* ── Slider ── */
function Sl({ label, value, display, min, max, step, onChange, tone, hint }) {
  const pct = ((value-min)/(max-min||1))*100;
  return (
    <label className="slider-control" style={{"--tone": tone, "--fill": `${pct}%`}}>
      <div className="slider-row">
        <span className="slider-label">{label}</span>
        <span className="slider-value">{display}</span>
      </div>
      {hint && <div className="slider-hint">{hint}</div>}
      <div className="slider-track">
        <input className="slider-input" type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(+e.target.value)}/>
      </div>
    </label>
  );
}

/* ── Signal bar ── */
function SigRow({ label, note, value, tone }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className="signal-row" style={{"--tone": tone, "--fill": `${Math.max(4, clamped*100)}%`}}>
      <div className="signal-copy">
        <span className="signal-label">{label}</span>
        <span className="signal-note">{note}</span>
      </div>
      <div className="signal-track"><span className="signal-fill"/></div>
    </div>
  );
}

/* ── History chart ── */
function HistoryChart({ history }) {
  const ref = useRef(null);
  useEffect(()=>{
    const c=ref.current; if(!c||history.length<2) return;
    const ctx=c.getContext("2d"), w=c.width, h=c.height, pad=28;
    const iw=w-pad*2, ih=h-pad*2;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle="#030305"; ctx.fillRect(0,0,w,h);
    // Grid
    ctx.strokeStyle="rgba(255,255,255,0.05)"; ctx.lineWidth=1;
    for(let i=0;i<=4;i++){const y=pad+(ih*i)/4;ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(w-pad,y);ctx.stroke();}
    if(history.length<2){ctx.fillStyle="rgba(144,144,168,0.4)";ctx.font="500 14px 'Share Tech Mono'";ctx.fillText("Awaiting telemetry data...",pad+8,h/2);return;}
    const cl=history.map(s=>s.cl), cd=history.map(s=>s.cd);
    const mx=Math.max(...cl,...cd,.1), mn=Math.min(0,...cl,...cd);
    const rng=mx-mn||1;
    const mx2=(i)=>pad+(i/(history.length-1))*iw;
    const my2=(v)=>pad+ih-((v-mn)/rng)*ih;
    const draw=(ser,col,fill)=>{
      ctx.beginPath(); ser.forEach((v,i)=>{i===0?ctx.moveTo(mx2(i),my2(v)):ctx.lineTo(mx2(i),my2(v));});
      ctx.lineWidth=2; ctx.strokeStyle=col; ctx.stroke();
      ctx.lineTo(mx2(ser.length-1),my2(mn)); ctx.lineTo(mx2(0),my2(mn)); ctx.closePath();
      ctx.fillStyle=fill; ctx.fill();
    };
    draw(cl,"#00d46a","rgba(0,212,106,0.1)");
    draw(cd,"#e8000d","rgba(232,0,13,0.12)");
    // Labels
    ctx.fillStyle="rgba(144,144,168,0.6)"; ctx.font="10px 'Share Tech Mono'";
    ctx.fillText("CL",pad+4,pad+14); ctx.fillStyle="rgba(232,0,13,0.7)"; ctx.fillText("CD",pad+30,pad+14);
  },[history]);
  return <canvas ref={ref} className="history-chart" width={720} height={280}/>;
}

/* ═══════════════════════════════════════
   3D VIEW using Three.js
   Renders an extruded profile with surface speed colors
   ═══════════════════════════════════════ */
function View3D({ poly, solver, running, cx, cy, sx, sy, aoa }) {
  const mountRef = useRef(null);
  const threeRef = useRef(null);

  useEffect(()=>{
    const el = mountRef.current;
    if (!el) return;

    // Dynamically load Three.js from CDN
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    script.onload = () => initThree();
    document.head.appendChild(script);

    function initThree() {
      const THREE = window.THREE;
      if (!THREE || threeRef.current) return;

      const W = el.clientWidth || 800;
      const H = el.clientHeight || 450;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(W, H);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x030305, 1);
      el.appendChild(renderer.domElement);

      const scene = new THREE.Scene();

      // Camera
      const camera = new THREE.PerspectiveCamera(45, W/H, 0.1, 1000);
      camera.position.set(0, 0, 4);

      // Fog
      scene.fog = new THREE.FogExp2(0x030305, 0.08);

      // Lights
      const ambient = new THREE.AmbientLight(0xffffff, 0.3);
      scene.add(ambient);
      const dir1 = new THREE.DirectionalLight(0xffeedd, 1.2);
      dir1.position.set(3, 4, 3);
      scene.add(dir1);
      const dir2 = new THREE.DirectionalLight(0x0088ff, 0.5);
      dir2.position.set(-3, -2, 2);
      scene.add(dir2);
      const redPt = new THREE.PointLight(0xe8000d, 2, 8);
      redPt.position.set(-2, 1, 2);
      scene.add(redPt);

      // Grid floor
      const gridHelper = new THREE.GridHelper(10, 20, 0x252530, 0x1a1a28);
      gridHelper.position.y = -1.5;
      scene.add(gridHelper);

      // Profile mesh
      let profileMesh = null;
      let wireMesh = null;

      function buildProfile(rawPoly) {
        if (profileMesh) { scene.remove(profileMesh); profileMesh.geometry.dispose(); }
        if (wireMesh) { scene.remove(wireMesh); wireMesh.geometry.dispose(); }
        if (!rawPoly || rawPoly.length < 3) return;

        // Transform to world coords (center + normalize)
        const xs = rawPoly.map(p=>p[0]), ys = rawPoly.map(p=>p[1]);
        const mnX=Math.min(...xs), mxX=Math.max(...xs), mnY=Math.min(...ys), mxY=Math.max(...ys);
        const rng = Math.max(mxX-mnX, mxY-mnY)||1;
        const pts = rawPoly.map(([x,y])=>[((x-(mnX+mxX)/2)/rng)*3, ((y-(mnY+mxY)/2)/rng)*3]);

        // AoA rotation
        const ang = (aoa||0) * Math.PI/180;
        const cosA=Math.cos(ang), sinA=Math.sin(ang);
        const rotPts = pts.map(([x,y])=>[x*cosA-y*sinA, x*sinA+y*cosA]);

        const shape = new THREE.Shape();
        shape.moveTo(rotPts[0][0], rotPts[0][1]);
        for (let i=1; i<rotPts.length; i++) shape.lineTo(rotPts[i][0], rotPts[i][1]);
        shape.closePath();

        const extrudeSettings = { depth: 0.8, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 4 };
        const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);

        // Color vertices by X position (simulates speed gradient)
        const pos = geo.attributes.position;
        const colors = [];
        for (let i=0; i<pos.count; i++) {
          const x = pos.getX(i);
          // Map x to speed-like color: blue→red
          const t = Math.max(0, Math.min(1, (x + 1.5) / 3));
          // Turbo-like: blue, green, yellow, red
          let r, g, b;
          if (t < 0.33) { const s=t/0.33; r=0; g=s; b=1-s*0.5; }
          else if (t < 0.66) { const s=(t-0.33)/0.33; r=s; g=1; b=0.5-s*0.5; }
          else { const s=(t-0.66)/0.34; r=1; g=1-s; b=0; }
          colors.push(r, g, b);
        }
        geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

        const mat = new THREE.MeshPhongMaterial({
          vertexColors: true,
          shininess: 120,
          specular: new THREE.Color(0x445566),
          side: THREE.DoubleSide,
        });
        profileMesh = new THREE.Mesh(geo, mat);
        profileMesh.position.set(0, 0, -0.4);
        scene.add(profileMesh);

        // Wireframe overlay
        const wireMat = new THREE.MeshBasicMaterial({ color: 0x252530, wireframe: true, transparent: true, opacity: 0.15 });
        wireMesh = new THREE.Mesh(geo, wireMat);
        wireMesh.position.copy(profileMesh.position);
        scene.add(wireMesh);
      }

      // Particle streamlines in 3D (simplified lines)
      const streamGroup = new THREE.Group();
      scene.add(streamGroup);

      // Orbit controls (manual)
      let isDragging=false, prevMouse={x:0,y:0}, spherical={phi:1.2,theta:0.4,r:4};
      const domEl = renderer.domElement;
      domEl.addEventListener("mousedown", e=>{isDragging=true;prevMouse={x:e.clientX,y:e.clientY};});
      domEl.addEventListener("mousemove", e=>{
        if(!isDragging)return;
        spherical.theta -= (e.clientX-prevMouse.x)*0.008;
        spherical.phi   -= (e.clientY-prevMouse.y)*0.008;
        spherical.phi = Math.max(0.1, Math.min(Math.PI-0.1, spherical.phi));
        prevMouse={x:e.clientX,y:e.clientY};
      });
      domEl.addEventListener("mouseup",()=>isDragging=false);
      domEl.addEventListener("mouseleave",()=>isDragging=false);
      domEl.addEventListener("wheel",e=>{spherical.r=Math.max(1.5,Math.min(10,spherical.r+e.deltaY*0.005));},{passive:true});

      // Streamline threads
      const lineMat = new THREE.LineBasicMaterial({ color: 0x00b4ff, transparent: true, opacity: 0.35 });
      const nLines = 12;
      const lineObjs = [];
      for (let i=0; i<nLines; i++) {
        const geo = new THREE.BufferGeometry();
        const pts = new Float32Array(60*3);
        geo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
        geo.setDrawRange(0,0);
        const line = new THREE.Line(geo, lineMat.clone());
        streamGroup.add(line);
        lineObjs.push({ line, pts, geo });
      }

      let frame = 0;
      let animId;

      function animate() {
        animId = requestAnimationFrame(animate);
        frame++;

        // Update camera
        const sinPhi=Math.sin(spherical.phi), cosPhi=Math.cos(spherical.phi);
        const sinTh=Math.sin(spherical.theta), cosTh=Math.cos(spherical.theta);
        camera.position.set(spherical.r*sinPhi*sinTh, spherical.r*cosPhi, spherical.r*sinPhi*cosTh);
        camera.lookAt(0, 0, 0);

        // Animate streamlines using solver data if available
        const solverData = window.__aeroSolver;
        if (solverData && frame%4===0) {
          for (let li=0; li<nLines; li++) {
            const { pts, geo } = lineObjs[li];
            const yFrac = (li+0.5)/nLines;
            let px=0, py=yFrac*ROWS, cnt=0;
            for (let step=0; step<60; step++) {
              const ix=Math.max(0,Math.min(COLS-2,px|0)), iy=Math.max(0,Math.min(ROWS-2,py|0));
              if (solverData.solid[iy*COLS+ix]) break;
              const vx=solverData.ux[iy*COLS+ix], vy=solverData.uy[iy*COLS+ix];
              const wx=((px/COLS)-.5)*4, wy=((py/ROWS)-.5)*-3;
              pts[step*3]=wx; pts[step*3+1]=wy; pts[step*3+2]=(Math.random()-.5)*0.6;
              px+=vx*3; py+=vy*3;
              if (px>=COLS-2) break;
              cnt++;
            }
            geo.attributes.position.array.set(pts);
            geo.attributes.position.needsUpdate=true;
            geo.setDrawRange(0,cnt);
          }
        }

        // Slowly rotate when idle
        if (profileMesh && !isDragging) {
          // gentle pulse on glow light
          redPt.intensity = 1.5 + Math.sin(frame*0.03)*0.5;
        }

        renderer.render(scene, camera);
      }

      buildProfile(poly);
      animate();

      // Resize handler
      const ro = new ResizeObserver(()=>{
        const w=el.clientWidth, h=el.clientHeight;
        renderer.setSize(w,h);
        camera.aspect=w/h;
        camera.updateProjectionMatrix();
      });
      ro.observe(el);

      threeRef.current = { scene, renderer, camera, buildProfile, animId, ro, script };
    }

    return ()=>{
      const t=threeRef.current;
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

  // Re-build profile when poly/aoa changes
  useEffect(()=>{
    const t=threeRef.current;
    if (t?.buildProfile && poly) t.buildProfile(xformPoly(poly, cx, cy, sx, sy, aoa));
  },[poly, cx, cy, sx, sy, aoa]);

  // Expose solver to 3D loop
  useEffect(()=>{
    window.__aeroSolver = solver;
    return ()=>{ window.__aeroSolver = null; };
  },[solver]);

  return (
    <div ref={mountRef} style={{position:"absolute",inset:0,background:"#030305"}}>
      <div className="view-3d-label">3D EXTRUDED VIEW · DRAG TO ORBIT · SCROLL ZOOM</div>
      <div className="view-3d-hint">WebGL · Three.js r128</div>
    </div>
  );
}

/* ═══════════════════════════════════════
   ANALYSIS PANEL
   ═══════════════════════════════════════ */
function AnalysisPanel({ hSnap, miniRef, running, exportCSV, stats, ldRatio, regime }) {
  const recentRows = hSnap.slice(-8).reverse();
  return (
    <div className="analysis-view">
      <div className="analysis-grid">
        {/* Main chart panel */}
        <div className="a-panel">
          <div className="a-panel__header">
            <div>
              <div className="a-panel__title">Session Trace</div>
              <div className="a-panel__sub">Lift & drag telemetry · live during run</div>
            </div>
            <button className="btn-ghost" onClick={exportCSV} disabled={!hSnap.length}>Export CSV ↓</button>
          </div>
          <div className="analysis-kpis">
            {[
              {key:"CL", val:stats.cl, note:"Lift coefficient", tone:"var(--f1-green)"},
              {key:"CD", val:stats.cd, note:"Drag coefficient", tone:"var(--f1-red)"},
              {key:"L/D",val:ldRatio,   note:"Efficiency ratio", tone:"var(--f1-blue)"},
              {key:"Flow",val:regime.label,note:"Reynolds regime",tone:regime.col},
            ].map(m=>(
              <div className="a-metric" style={{"--tone":m.tone}} key={m.key}>
                <div className="a-metric__key">{m.key}</div>
                <div className="a-metric__val">{m.val}</div>
                <div className="a-metric__note">{m.note}</div>
              </div>
            ))}
          </div>
          <HistoryChart history={hSnap}/>
          <div style={{display:"flex",gap:16,marginTop:10}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:16,height:2,background:"var(--f1-green)"}}/>
              <span style={{fontFamily:"var(--font-mono)",fontSize:9,color:"var(--f1-dim)"}}>CL</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:16,height:2,background:"var(--f1-red)"}}/>
              <span style={{fontFamily:"var(--font-mono)",fontSize:9,color:"var(--f1-dim)"}}>CD</span>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{display:"grid",gap:16}}>
          {/* Trackside monitor */}
          <div className="a-panel">
            <div className="a-panel__header">
              <div>
                <div className="a-panel__title">Trackside Monitor</div>
                <div className="a-panel__sub">Live tunnel mirror</div>
              </div>
              <div className={`status-pill ${running?"is-live":"is-hold"}`}>
                <span className="status-dot is-live" style={{background:running?"var(--f1-green)":"var(--f1-red)"}}/>
                {running ? "GREEN FLAG" : "SESSION HOLD"}
              </div>
            </div>
            <canvas ref={miniRef} width={420} height={200} className="mini-canvas"/>
          </div>
          {/* Lap table */}
          <div className="a-panel">
            <div className="a-panel__header">
              <div>
                <div className="a-panel__title">Lap Samples</div>
                <div className="a-panel__sub">Latest {recentRows.length} rows</div>
              </div>
            </div>
            <div className="history-table">
              <div className="history-row is-head"><span>Time</span><span>CL</span><span>CD</span><span>Re</span></div>
              {recentRows.length ? recentRows.map(r=>(
                <div className="history-row" key={r.t}>
                  <span>{new Date(r.t).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</span>
                  <span>{r.cl}</span><span>{r.cd}</span><span>{r.re}</span>
                </div>
              )) : <div className="history-empty">No samples yet. Run the simulation.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   ABOUT PANEL
   ═══════════════════════════════════════ */
function AboutPanel() {
  return (
    <div className="about-view">
      <div className="about-hero">
        <div>
          <div className="about-title">Aero<br/><span>Lab</span></div>
          <div className="about-tags">
            <span className="about-tag">LBM D2Q9</span>
            <span className="about-tag">Float32 Solver</span>
            <span className="about-tag">{COLS}×{ROWS} Grid</span>
            <span className="about-tag">Three.js 3D</span>
            <span className="about-tag">f1stories.gr</span>
          </div>
        </div>
        <div>
          <p className="about-body">
            AeroLab is an <strong>in-browser Lattice Boltzmann CFD wind tunnel</strong> built for Formula 1 aerodynamics education.
            It runs on a D2Q9 lattice with BGK collision, bounce-back solid walls, and Zou-He inlet boundary conditions.
            <br/><br/>
            The <strong>3D view</strong> renders an extruded cross-section using Three.js, with vertex-colored surface speed mapping and live streamlines seeded from the solver velocity field.
            <br/><br/>
            Import any <strong>SVG, STL, or DXF</strong> from your CAD toolchain, or hand-sketch a profile directly in the garage pad.
          </p>
        </div>
      </div>
      <div className="about-features">
        {[
          {t:"D2Q9 Solver", b:"Float32 BGK with optimized streaming and BGK collision. Captures vortex shedding, wake turbulence, and boundary layer separation."},
          {t:"4 + 3D Modes", b:"Velocity heatmap, pressure distribution, particle streamlines, vorticity field — plus a full 3D extruded view with orbit controls."},
          {t:"CAD Import", b:"Load SVG, STL, or DXF files from any toolchain. Also supports PNG/JPG edge trace and a freehand sketch pad."},
          {t:"Live Telemetry", b:"CL, CD, L/D ratio, Reynolds number, and flow regime estimated in real time. Full CSV export for further analysis."},
          {t:"RK2 Particles", b:"Bilinear velocity interpolation with RK2 midpoint integration. Up to 2000 active streamline traces in 3-band batched rendering."},
          {t:"F1 Profiles", b:"Built-in F1 car silhouette, front wing, and rear wing cross-sections. Adjust angle of attack, position, and scale in real time."},
        ].map(f=>(
          <div className="feature-card" key={f.t}>
            <h3>{f.t}</h3>
            <p>{f.b}</p>
          </div>
        ))}
      </div>
      <div className="a-panel">
        <div className="a-panel__title" style={{marginBottom:12}}>How to use</div>
        <ol className="method-list">
          <li>Select a preset profile or import geometry from the Garage panel</li>
          <li>Adjust position, angle of attack, and scale in the Setup Sheet</li>
          <li>Tune inlet velocity, turbulence, and viscosity for the session conditions</li>
          <li>Switch between Velocity, Pressure, Streamlines, Vorticity, or 3D view</li>
          <li>Monitor CL and CD on the timing strip; export CSV for post-session analysis</li>
        </ol>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════ */
export default function CFDLab() {
  const { isDark, toggle: toggleTheme } = useTheme();
  const solverRef    = useRef(null);
  const partsRef     = useRef(mkPool());
  const canvasRef    = useRef(null);
  const wrapRef      = useRef(null);
  const drawRef      = useRef(null);
  const miniRef      = useRef(null);
  const rafRef       = useRef(null);
  const frameRef     = useRef(0);
  const imgRef       = useRef(null);
  const drawingRef   = useRef(false);
  const dptsRef      = useRef([]);

  // State
  const [view,    setView]    = useState("tunnel");
  const [tab,     setTab]     = useState("preset");
  const [running, setRunning] = useState(false);
  const [mode,    setMode]    = useState("velocity");
  const [preset,  setPreset]  = useState("f1car");
  const [poly,    setPoly]    = useState(()=>genPreset("f1car"));
  const [error,   setError]   = useState("");
  const [simplify,setSimplify]= useState(0);
  const [stats,   setStats]   = useState({cl:0,cd:0,re:0,maxV:0});
  const [pCount,  setPCount]  = useState(DEFAULT_PARTICLES);
  const [trailOp, setTrailOp] = useState(1);
  const [simSpd,  setSimSpd]  = useState(1);
  const [fps,     setFps]     = useState(0);
  const [cx,      setCx]      = useState(COLS*.35);
  const [cy,      setCy]      = useState(ROWS/2);
  const [sx,      setSx]      = useState(COLS*.25);
  const [sy,      setSy]      = useState(ROWS*.45);
  const [aoa,     setAoa]     = useState(0);
  const [vel,     setVel]     = useState(.12);
  const [turb,    setTurb]    = useState(.15);
  const [nu,      setNu]      = useState(.015);
  const [histRef, pushHist]   = useHistory(200);
  const [histSnap,setHistSnap]= useState([]);
  const [isFS,    setIsFS]    = useState(false);
  const [showKeys,setShowKeys]= useState(false);
  const [autoRun, setAutoRun] = useState(true);

  // Refs for render loop
  const runRef=useRef(false),modeRef=useRef("velocity"),polyRef=useRef(null),cxR=useRef(0),cyR=useRef(0),sxR=useRef(0),syR=useRef(0),aoaR=useRef(0),simpR=useRef(0),velR=useRef(.12),turbR=useRef(.15),nuR=useRef(.015),pcR=useRef(DEFAULT_PARTICLES),toR=useRef(1),ssR=useRef(1);

  useEffect(()=>{if(!solverRef.current){const s=new LBM(COLS,ROWS);s.setNu(.015);solverRef.current=s;}},[]);
  useEffect(()=>{runRef.current=running;},[running]);
  useEffect(()=>{modeRef.current=mode;},[mode]);
  useEffect(()=>{velR.current=vel;},[vel]);
  useEffect(()=>{turbR.current=turb;},[turb]);
  useEffect(()=>{nuR.current=nu;if(solverRef.current)solverRef.current.setNu(nu);},[nu]);
  useEffect(()=>{pcR.current=pCount;resPool(partsRef.current,pCount);},[pCount]);
  useEffect(()=>{toR.current=trailOp;},[trailOp]);
  useEffect(()=>{ssR.current=simSpd;},[simSpd]);

  const rebuild = useCallback(()=>{
    const raw=polyRef.current;
    if(!raw||!solverRef.current)return;
    const s=simpR.current>0?simplPoly(raw,simpR.current*.005):raw;
    solverRef.current.buildSolid(xformPoly(s,cxR.current,cyR.current,sxR.current,syR.current,aoaR.current));
  },[]);

  useEffect(()=>{aoaR.current=aoa;cxR.current=cx;cyR.current=cy;sxR.current=sx;syR.current=sy;rebuild();},[aoa,cx,cy,sx,sy,rebuild]);
  useEffect(()=>{polyRef.current=poly;simpR.current=simplify;rebuild();if(autoRun)setRunning(true);},[poly,simplify,rebuild,autoRun]);

  const resetSolver=useCallback(()=>{const s=new LBM(COLS,ROWS);s.setNu(nuR.current);solverRef.current=s;rebuild();},[rebuild]);
  const toggleFS=useCallback(()=>{const el=wrapRef.current;if(!el)return;if(!document.fullscreenElement)el.requestFullscreen?.().then(()=>setIsFS(true)).catch(()=>{});else{document.exitFullscreen?.();setIsFS(false);}},[]);
  useEffect(()=>{const h=()=>setIsFS(!!document.fullscreenElement);document.addEventListener("fullscreenchange",h);return()=>document.removeEventListener("fullscreenchange",h);},[]);
  const snap=useCallback(()=>{const c=canvasRef.current;if(!c)return;const a=document.createElement("a");a.download=`aerolab-${Date.now()}.png`;a.href=c.toDataURL("image/png");a.click();},[]);
  const exportCSV=useCallback(()=>{const d=histRef.current;if(!d.length)return;const b=new Blob(["t,cl,cd,re,maxV\n"+d.map(r=>`${r.t},${r.cl},${r.cd},${r.re},${r.maxV}`).join("\n")],{type:"text/csv"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`aerolab-${Date.now()}.csv`;a.click();URL.revokeObjectURL(u);},[histRef]);

  const resetAll=useCallback(()=>{setRunning(false);setVel(.12);setTurb(.15);setNu(.015);setCx(COLS*.35);setCy(ROWS/2);setSx(COLS*.25);setSy(ROWS*.45);setAoa(0);setSimplify(0);setPCount(DEFAULT_PARTICLES);setTrailOp(1);setSimSpd(1);setPreset("f1car");setTab("preset");setPoly(genPreset("f1car"));setStats({cl:0,cd:0,re:0,maxV:0});histRef.current=[];setHistSnap([]);const s=new LBM(COLS,ROWS);s.setNu(.015);solverRef.current=s;},[histRef]);

  // Keyboard
  useEffect(()=>{
    const h=e=>{if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA")return;
      switch(e.code){
        case"Space":e.preventDefault();setRunning(r=>!r);break;
        case"KeyR":resetSolver();break;
        case"Digit1":setMode("velocity");break;case"Digit2":setMode("pressure");break;
        case"Digit3":setMode("streamlines");break;case"Digit4":setMode("vorticity");break;
        case"Digit5":setMode("3d");break;
        case"KeyF":toggleFS();break;
        case"KeyS":if(!e.ctrlKey&&!e.metaKey)snap();break;
        case"Slash":e.preventDefault();setShowKeys(k=>!k);break;
      }};
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[resetSolver,toggleFS,snap]);

  // FPS
  const fpsF=useRef(0),fpsT=useRef(performance.now());

  // ── RENDER LOOP ──
  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas)return;
    const ctx=canvas.getContext("2d");
    imgRef.current=ctx.createImageData(SIM_W,SIM_H);
    const DX=SIM_W/COLS, DY=SIM_H/ROWS;
    const loop=()=>{
      rafRef.current=requestAnimationFrame(loop);
      const solver=solverRef.current; if(!solver)return;
      const inV=velR.current;
      if(runRef.current){const steps=ssR.current;for(let s=0;s<steps;s++)solver.step(inV,turbR.current);}
      frameRef.current++;fpsF.current++;
      const now=performance.now();
      if(now-fpsT.current>=1000){setFps(fpsF.current);fpsF.current=0;fpsT.current=now;}

      const vm=modeRef.current;
      const img=imgRef.current, buf32=new Uint32Array(img.data.buffer);
      const solidC=(255<<24)|(44<<16)|(44<<8)|52;
      const bgC=(255<<24)|(3<<16)|(3<<8)|5;

      if(vm==="streamlines"||vm==="3d"){
        buf32.fill(bgC);
        for(let k=0;k<solver.N;k++)if(solver.solid[k]){const i=k%COLS,j=(k/COLS)|0,x0=(i*DX)|0,y0=(j*DY)|0,x1=Math.min(((i+1)*DX)|0,SIM_W),y1=Math.min(((j+1)*DY)|0,SIM_H);for(let py=y0;py<y1;py++)for(let px=x0;px<x1;px++)buf32[py*SIM_W+px]=solidC;}
      } else {
        const lut=vm==="pressure"?COOLWARM:TURBO;
        const field=vm==="velocity"?solver.spd:vm==="pressure"?solver.rho:solver.curl;
        let fMn=1e9,fMx=-1e9;
        for(let k=0;k<solver.N;k++){if(solver.solid[k])continue;const v=field[k];if(v<fMn)fMn=v;if(v>fMx)fMx=v;}
        const fR=fMx-fMn;
        if(fR<1e-10){buf32.fill(lut[128]);}
        else{const invR=255/fR,invDX=COLS/SIM_W,invDY=ROWS/SIM_H;
          for(let py=0;py<SIM_H;py++){const j=Math.min(ROWS-1,(py*invDY)|0),ro=py*SIM_W;for(let px=0;px<SIM_W;px++){const i=Math.min(COLS-1,(px*invDX)|0),k=j*COLS+i;buf32[ro+px]=solver.solid[k]?solidC:lut[Math.max(0,Math.min(255,((field[k]-fMn)*invR)|0))];}}
        }
      }
      ctx.putImageData(img,0,0);

      // Particles
      const parts=partsRef.current,pC=pcR.current,tO=toR.current;
      for(let pi=0;pi<pC&&pi<parts.length;pi++)parts[pi].update(solver);
      if((vm==="streamlines"||vm==="velocity"||vm==="vorticity"||vm==="3d")&&tO>0){
        ctx.lineCap="round"; ctx.lineJoin="round";
        const isStr=vm==="streamlines"||vm==="3d";
        const alphas=isStr?[.15,.4,.8]:[.07,.18,.32];
        const widths=isStr?[.5,.8,1.2]:[.3,.5,.65];
        const cols=[`rgba(0,180,255,`,"rgba(0,212,106,","rgba(240,240,248,"];
        for(let band=0;band<3;band++){
          const a=alphas[band]*tO;
          ctx.strokeStyle=cols[band]+a+")"; ctx.lineWidth=widths[band];
          ctx.beginPath();
          const sS=band===0?0:band===1?Math.floor(TRAIL_LEN*.33):Math.floor(TRAIL_LEN*.66);
          const sE=band===0?Math.floor(TRAIL_LEN*.33):band===1?Math.floor(TRAIL_LEN*.66):TRAIL_LEN;
          for(let pi=0;pi<pC&&pi<parts.length;pi++){const p=parts[pi];if(!p.active||p.tl<3)continue;const st=p.ti-p.tl,from=st+Math.floor(sS*p.tl/TRAIL_LEN),to=st+Math.floor(sE*p.tl/TRAIL_LEN);let started=false;for(let ti=from;ti<to&&ti<p.ti;ti++){const idx=((ti%TRAIL_LEN)+TRAIL_LEN)%TRAIL_LEN;if(!started){ctx.moveTo(p.tx[idx],p.ty[idx]);started=true;}else ctx.lineTo(p.tx[idx],p.ty[idx]);}}
          ctx.stroke();
        }
      }
      // Outline
      const raw=polyRef.current;
      if(raw){
        const s=simpR.current>0?simplPoly(raw,simpR.current*.005):raw;
        const tp=xformPoly(s,cxR.current,cyR.current,sxR.current,syR.current,aoaR.current);
        ctx.beginPath();
        tp.forEach(([gx,gy],i)=>{const px=gx*DX,py=gy*DY;i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);});
        ctx.closePath();
        ctx.strokeStyle="#e8000d"; ctx.lineWidth=2;
        ctx.shadowColor="#e8000d"; ctx.shadowBlur=12;
        ctx.stroke(); ctx.shadowBlur=0;
      }
      // Stats
      if(runRef.current&&frameRef.current%15===0){
        let mV=0,tFy=0,tFx=0,cnt=0;
        for(let k=0;k<solver.N;k++){if(solver.solid[k])continue;const sp=solver.spd[k];if(!isFinite(sp))continue;cnt++;if(sp>mV)mV=sp;tFy+=solver.uy[k];tFx+=Math.abs(solver.ux[k]-inV);}
        const re=(inV*sxR.current)/(nuR.current+1e-6)*10;
        const cl=cnt>0?Math.abs(tFy/cnt*2*(1+aoaR.current*.06)):0;
        const cd=cnt>0?tFx/cnt*.5+.008:0;
        const ns={cl:+cl.toFixed(4),cd:+cd.toFixed(4),re:Math.round(re),maxV:inV>0?+(mV/inV).toFixed(3):0};
        setStats(ns); pushHist(ns);
      }
      const mc=miniRef.current;
      if(mc)mc.getContext("2d").drawImage(canvas,0,0,mc.width,mc.height);
    };
    rafRef.current=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(rafRef.current);
  },[pushHist]);

  // File handling
  const applyPoly=useCallback((p)=>{if(!p)return;setPoly(p);setError("");if(autoRun)setRunning(true);},[autoRun]);
  const handleFile=useCallback((file)=>{
    if(!file)return;setError("");const n=file.name.toLowerCase();
    const load=(mode,parser)=>{const r=new FileReader();r.onload=ev=>{const p=parser(ev.target.result);if(!p){setError(`Parse failed: ${n.split(".").pop().toUpperCase()}`);return;}applyPoly(p);};mode==="text"?r.readAsText(file):r.readAsArrayBuffer(file);};
    if(n.endsWith(".svg"))load("text",parseSVG);
    else if(n.endsWith(".stl"))load("buf",parseSTL);
    else if(n.endsWith(".dxf"))load("text",parseDXF);
    else if(file.type?.startsWith("image/")){const u=URL.createObjectURL(file);const img=new Image();img.onload=()=>{const c=document.createElement("canvas"),W=Math.min(img.width,200),H=Math.min(img.height,200);c.width=W;c.height=H;c.getContext("2d").drawImage(img,0,0,W,H);const p=traceImg(c.getContext("2d").getImageData(0,0,W,H),W,H);URL.revokeObjectURL(u);if(!p){setError("Edge trace failed.");return;}applyPoly(p);};img.src=u;}
    else setError("Use SVG, STL, DXF, PNG, JPG");
  },[applyPoly]);
  const hDrop=useCallback(e=>{e.preventDefault();handleFile(e.dataTransfer?.files?.[0]);},[handleFile]);
  const hFile=useCallback(e=>{handleFile(e.target.files[0]);e.target.value="";},[handleFile]);

  // Drawing
  const getDP=e=>{const dc=drawRef.current,r=dc.getBoundingClientRect(),cx2=e.touches?e.touches[0].clientX:e.clientX,cy2=e.touches?e.touches[0].clientY:e.clientY;return[(cx2-r.left)*(dc.width/r.width),(cy2-r.top)*(dc.height/r.height)];};
  const startDraw=e=>{e.preventDefault();drawingRef.current=true;drawRef.current.getContext("2d").clearRect(0,0,drawRef.current.width,drawRef.current.height);dptsRef.current=[getDP(e)];};
  const moveDraw=e=>{e.preventDefault();if(!drawingRef.current)return;const[x,y]=getDP(e);dptsRef.current.push([x,y]);const c=drawRef.current.getContext("2d");c.strokeStyle="#e8000d";c.lineWidth=2;c.lineCap="round";const pts=dptsRef.current;if(pts.length>1){c.beginPath();c.moveTo(pts[pts.length-2][0],pts[pts.length-2][1]);c.lineTo(x,y);c.stroke();}};
  const endDraw=()=>{drawingRef.current=false;const pts=dptsRef.current;if(pts.length<5)return;const p=normPoly(pts);if(p)applyPoly(p);};

  // Derived
  const regime=useMemo(()=>{if(stats.re<2300)return{label:"LAMINAR",col:"var(--f1-green)"};if(stats.re<4000)return{label:"TRANS.",col:"var(--f1-amber)"};return{label:"TURB.",col:"var(--f1-red)"};},[stats.re]);
  const ldRatio=useMemo(()=>stats.cd>0?(stats.cl/stats.cd).toFixed(2):"—",[stats.cl,stats.cd]);
  const currentMode=MODES.find(m=>m.id===mode)||MODES[0];
  const currentPreset=PRESET_GROUPS.flatMap(g=>g.items).find(i=>i.id===preset);

  useEffect(()=>{const iv=setInterval(()=>setHistSnap([...histRef.current]),500);return()=>clearInterval(iv);},[histRef]);

  // Sidebar import surface
  const renderImport=()=>{
    if(tab==="preset") return PRESET_GROUPS.map(g=>(
      <div className="preset-group" key={g.label}>
        <div className="preset-group-label">{g.label}</div>
        <div className="preset-grid">
          {g.items.map(item=>(
            <button key={item.id} className={`preset-btn ${preset===item.id?"is-active":""}`}
              onClick={()=>{setPreset(item.id);setPoly(genPreset(item.id));setError("");if(autoRun)setRunning(true);}}>
              <span className="preset-btn__name">{item.label}</span>
              <small className="preset-btn__desc">{item.desc}</small>
            </button>
          ))}
        </div>
      </div>
    ));
    if(tab==="draw") return (
      <div>
        <canvas ref={drawRef} width={232} height={130} className="sketch-canvas"
          onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={moveDraw} onTouchEnd={endDraw}/>
        <div style={{fontSize:9,color:"var(--f1-dim)",marginTop:6,fontFamily:"var(--font-mono)",letterSpacing:"0.1em"}}>
          SKETCH CONTOUR → RELEASE TO BUILD
        </div>
      </div>
    );
    const accept=tab==="svg"?".svg":tab==="stl"?".stl":tab==="dxf"?".dxf":"image/*";
    return (
      <label className="dropzone">
        <span>{tab==="image"?"Load PNG / JPG":`Load ${tab.toUpperCase()} file`}</span>
        <small>Drag & drop or browse</small>
        <input type="file" accept={accept} hidden onChange={hFile}/>
      </label>
    );
  };

  // 3D mode: show Three.js canvas instead of 2D
  const is3D = mode === "3d";

  const metrics = [
    {label:"CL",    value:stats.cl,  note:"Lift",        tone:"var(--f1-green)"},
    {label:"CD",    value:stats.cd,  note:"Drag",        tone:"var(--f1-red)"},
    {label:"L/D",   value:ldRatio,   note:"Efficiency",  tone:"var(--f1-blue)"},
    {label:"Re",    value:stats.re>999?`${(stats.re/1000).toFixed(1)}k`:stats.re, note:"Reynolds", tone:"var(--f1-amber)"},
    {label:"U/U₀",  value:stats.maxV,note:"Peak vel.",   tone:"var(--f1-blue)"},
    {label:"FLOW",  value:regime.label,note:"Regime",    tone:regime.col},
  ];

  return (
    <div className="lab-shell" ref={wrapRef}>
      <div className="lab-shell__scanline"/>

      {/* ── HEADER ── */}
      <header className="lab-header">
        <div className="brand-block">
          <div className="brand-logo-mark"><F1Logo size={18}/></div>
          <div className="brand-text">
            <div className="brand-name">AeroLab</div>
            <div className="brand-sub">f1stories.gr · CFD Terminal</div>
          </div>
        </div>

        <nav className="header-nav">
          {[{id:"tunnel",num:"01",label:"Wind Tunnel"},{id:"analysis",num:"02",label:"Analysis"},{id:"about",num:"03",label:"About"}].map(v=>(
            <button key={v.id} className={`nav-btn ${view===v.id?"is-active":""}`} onClick={()=>setView(v.id)}>
              <span className="nav-btn__num">{v.num}</span>
              <strong className="nav-btn__label">{v.label}</strong>
            </button>
          ))}
        </nav>

        <div className="header-status">
          <div className={`status-pill ${running?"is-live":"is-hold"}`}>
            <span className={`status-dot ${running?"is-live":"is-red"}`}/>
            {running ? "GREEN FLAG" : "SESSION HOLD"}
          </div>
          <span className="fps-readout">{fps}<span style={{opacity:.4,fontSize:9}}> FPS</span></span>
          <ThemeToggle/>
        </div>
      </header>

      {/* ── SESSION STRIP ── */}
      <div className="session-strip">
        <div className="session-cell">
          <span className="session-cell__key">Session</span>
          <span className="session-cell__val">FP1 AERO RUN</span>
        </div>
        <div className="session-cell">
          <span className="session-cell__key">Package</span>
          <span className="session-cell__val is-red">{currentPreset?.label || "CUSTOM"}</span>
        </div>
        <div className="session-cell">
          <span className="session-cell__key">Mode</span>
          <span className="session-cell__val" style={{color:currentMode.color}}>{currentMode.label}</span>
        </div>
        <div className="session-cell">
          <span className="session-cell__key">AoA</span>
          <span className="session-cell__val">{aoa}°</span>
        </div>
        <div className="session-cell">
          <span className="session-cell__key">Re</span>
          <span className="session-cell__val is-amber">{stats.re>999?`${(stats.re/1000).toFixed(1)}K`:stats.re||"—"}</span>
        </div>
        <div className="session-cell">
          <span className="session-cell__key">Grid</span>
          <span className="session-cell__val">{COLS}×{ROWS}</span>
        </div>
        <div className="session-cell">
          <span className="session-cell__key">CL</span>
          <span className="session-cell__val is-green">{stats.cl||"—"}</span>
        </div>
        <div className="session-cell">
          <span className="session-cell__key">CD</span>
          <span className="session-cell__val is-red">{stats.cd||"—"}</span>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div className="lab-main">
        {/* ── SIDEBAR ── */}
        {view==="tunnel" && (
          <aside className="lab-sidebar">
            {/* Garage */}
            <SidebarSection title="GARAGE — SELECT PACKAGE" defaultOpen={true}>
              <div className="import-tabs">
                {IMPORT_TABS.map(t=>(
                  <button key={t.id} className={`import-tab ${tab===t.id?"is-active":""}`}
                    onClick={()=>{setTab(t.id);setError("");}}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div onDrop={hDrop} onDragOver={e=>e.preventDefault()}>
                {renderImport()}
              </div>
              {error && <div className="error-callout">{error}</div>}
            </SidebarSection>

            {/* Setup sheet */}
            <SidebarSection title="SETUP SHEET — TRANSFORM" defaultOpen={true}>
              <div className="slider-stack">
                <Sl label="Position X" value={cx} display={cx.toFixed(0)} min={10} max={COLS-10} step={1} onChange={setCx} tone="var(--f1-blue)"/>
                <Sl label="Position Y" value={cy} display={cy.toFixed(0)} min={4} max={ROWS-4} step={1} onChange={setCy} tone="var(--f1-blue)"/>
                <Sl label="Scale X" value={sx} display={sx.toFixed(0)} min={10} max={COLS*.5} step={1} onChange={setSx} tone="var(--f1-green)"/>
                <Sl label="Scale Y" value={sy} display={sy.toFixed(0)} min={5} max={ROWS*.7} step={1} onChange={setSy} tone="var(--f1-green)"/>
                <Sl label="Angle of Attack" value={aoa} display={`${aoa}°`} min={-25} max={35} step={1} onChange={setAoa} tone="var(--f1-amber)"/>
                <Sl label="Simplify" value={simplify} display={simplify} min={0} max={20} step={1} onChange={setSimplify} tone="var(--f1-dim)"/>
              </div>
            </SidebarSection>

            {/* Race control */}
            <SidebarSection title="RACE CONTROL — FLOW" defaultOpen={true}>
              <div className="slider-stack">
                <Sl label="Inlet Velocity" value={vel} display={vel.toFixed(3)} min={.02} max={.18} step={.005} onChange={setVel} tone="var(--f1-blue)"/>
                <Sl label="Turbulence" value={turb} display={turb.toFixed(1)} min={0} max={3} step={.1} onChange={setTurb} tone="var(--f1-amber)"/>
                <Sl label="Viscosity ν" value={nu} display={nu.toFixed(3)} min={.005} max={.1} step={.001} onChange={setNu} tone="var(--f1-green)"/>
              </div>
            </SidebarSection>

            {/* Visualization */}
            <SidebarSection title="VISUALIZATION" defaultOpen={false}>
              <div className="slider-stack">
                <Sl label="Particles" value={pCount} display={pCount} min={0} max={MAX_PARTICLES} step={10} onChange={setPCount} tone="var(--f1-blue)"/>
                <Sl label="Trail Opacity" value={trailOp} display={trailOp.toFixed(2)} min={0} max={1} step={.05} onChange={setTrailOp} tone="var(--f1-amber)"/>
                <Sl label={`Sim Speed`} value={simSpd} display={`${simSpd}×`} min={1} max={8} step={1} onChange={setSimSpd} tone="var(--f1-red)"/>
              </div>
              <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:4}}>
                <label className={`toggle-chip ${autoRun?"is-active":""}`}>
                  <input type="checkbox" checked={autoRun} onChange={()=>setAutoRun(a=>!a)}/>
                  AUTO GREEN-FLAG
                </label>
              </div>
            </SidebarSection>

            {/* Footer */}
            <div style={{marginTop:"auto",padding:"12px 14px",borderTop:"1px solid var(--f1-border)",display:"flex",alignItems:"center",gap:8}}>
              <F1Logo size={14}/>
              <a href="https://f1stories.gr" target="_blank" rel="noopener noreferrer"
                style={{fontFamily:"var(--font-mono)",fontSize:9,letterSpacing:"0.18em",color:"var(--f1-red)",textDecoration:"none",textTransform:"uppercase"}}>
                f1stories.gr
              </a>
            </div>
          </aside>
        )}

        {/* ── CONTENT ── */}
        <div className="lab-content">
          {view==="tunnel" && (
            <div className="tunnel-view">
              {/* Mode bar */}
              <div className="mode-bar">
                {MODES.map((m,i)=>(
                  <button key={m.id} className={`mode-chip ${mode===m.id?"is-active":""}`}
                    style={{"--tone":m.tone}} title={`${m.label} [${i+1}]`}
                    onClick={()=>setMode(m.id)}>
                    <span className="mode-chip__dot" style={{background:m.color}}/>
                    {isMobile ? m.short : m.label}
                  </button>
                ))}
                <div className="mode-bar-actions">
                  <button className={`btn-primary ${running?"":"is-paused"}`} onClick={()=>setRunning(r=>!r)}>
                    {running ? "⏸ HOLD" : "▶ RUN"}
                  </button>
                  <button className="btn-ghost" onClick={resetSolver} title="Reset [R]">↺</button>
                  <button className="btn-ghost" onClick={snap} title="Snapshot [S]">📷</button>
                  <button className="btn-ghost" onClick={toggleFS} title="Fullscreen [F]">{isFS?"⊖":"⊕"}</button>
                  <button className="btn-ghost" onClick={exportCSV} disabled={!histSnap.length}>CSV ↓</button>
                  <button className="btn-ghost" onClick={resetAll}>RESET</button>
                  <button className="btn-ghost" onClick={()=>setShowKeys(k=>!k)} title="[/]">⌨</button>
                </div>
              </div>

              {/* Keyboard shortcuts */}
              {showKeys && (
                <div style={{padding:"0 0 0",borderBottom:"1px solid var(--f1-border)",background:"var(--f1-carbon)"}}>
                  <div className="shortcut-grid" style={{padding:"10px 12px"}}>
                    {SHORTCUTS.map(([k,d])=>(
                      <div className="shortcut-item" key={k}>
                        <kbd>{k}</kbd><span>{d}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Canvas */}
              <div className="canvas-wrapper">
                {/* 2D canvas — always rendered, hidden when in 3D */}
                <canvas ref={canvasRef} width={SIM_W} height={SIM_H}
                  className="stage-canvas"
                  style={{display:is3D?"none":"block", position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"fill"}}/>

                {/* 3D view */}
                {is3D && (
                  <View3D
                    poly={poly}
                    solver={solverRef.current}
                    running={running}
                    cx={cx} cy={cy} sx={sx} sy={sy} aoa={aoa}
                  />
                )}

                {/* HUD */}
                <div className="canvas-hud">
                  <div className="hud-corner hud-corner--tl"/>
                  <div className="hud-corner hud-corner--tr"/>
                  <div className="hud-corner hud-corner--bl"/>
                  <div className="hud-corner hud-corner--br"/>
                  <div className="hud-top-bar">
                    <div className="hud-label">
                      <F1Logo size={10}/>
                      AIR IN →
                    </div>
                    <div className="hud-label" style={{color:currentMode.color}}>
                      {currentMode.label.toUpperCase()} · LBM D2Q9 · {COLS}×{ROWS}
                    </div>
                    <div className="hud-label">→ OUT</div>
                  </div>
                  <div className="hud-bottom-bar">
                    <div className="hud-label" style={{opacity:.4,fontSize:8}}>f1stories.gr</div>
                    <div className="colorbar">
                      <span className="colorbar__label">HI</span>
                      <div className="colorbar__bar" style={{background:mode==="pressure"?"linear-gradient(to bottom,#ff9500,#555,#00b4ff)":"linear-gradient(to bottom,#ff2200,#ffff00,#00ff88,#0088ff)"}}/>
                      <span className="colorbar__label">LO</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Metrics bar */}
              <div className="metrics-bar">
                {metrics.map(m=>(
                  <div className="metric-card" style={{"--tone":m.tone}} key={m.label}>
                    <div className="metric-label">{m.label}</div>
                    <div className="metric-value">{m.value}</div>
                    <div className="metric-note">{m.note}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view==="analysis" && (
            <AnalysisPanel hSnap={histSnap} miniRef={miniRef} running={running} exportCSV={exportCSV} stats={stats} ldRatio={ldRatio} regime={regime}/>
          )}

          {view==="about" && <AboutPanel/>}
        </div>

        {/* ── RIGHT INFO COLUMN ── */}
        {view==="tunnel" && (
          <aside className="lab-info">
            <div className="info-section">
              <div className="info-section__title">ONBOARD</div>
              <canvas ref={miniRef} width={200} height={110} className="mini-canvas"/>
              <div style={{marginTop:8}}>
                {[
                  {label:"Inlet velocity", note:`${vel.toFixed(3)}`, value:vel/.18, tone:"var(--f1-blue)"},
                  {label:"Turbulence",     note:`${turb.toFixed(1)}`, value:turb/3, tone:"var(--f1-amber)"},
                  {label:"Viscosity ν",   note:`${nu.toFixed(3)}`, value:nu/.1, tone:"var(--f1-green)"},
                  {label:"Particles",     note:`${pCount}/${MAX_PARTICLES}`, value:pCount/MAX_PARTICLES, tone:"var(--f1-red)"},
                ].map(s=><SigRow key={s.label} {...s}/>)}
              </div>
            </div>

            <div className="info-section">
              <div className="info-section__title">PACKAGE</div>
              <div className="tele-highlight">
                <div className="tele-highlight__key">Profile</div>
                <div className="tele-highlight__val">{currentPreset?.label||"CUSTOM"}</div>
                <div className="tele-highlight__note">{currentPreset?.desc||"Imported / sketched"}</div>
              </div>
              <div className="tele-highlight">
                <div className="tele-highlight__key">Flow Regime</div>
                <div className="tele-highlight__val" style={{color:regime.col}}>{regime.label}</div>
                <div className="tele-highlight__note">Re = {stats.re||"—"}</div>
              </div>
            </div>

            <div className="info-section">
              <div className="info-section__title">ENGINEER NOTES</div>
              {[
                {title:"One variable at a time",body:"Isolate package from flow changes between runs for clean deltas."},
                {title:"Pressure = loading",body:"Fastest read for suction zones, load peaks, stall pockets."},
                {title:"Streamlines = dirty air",body:"Trail bundles show wake length, recirculation, reattachment."},
              ].map(r=>(
                <div className="ref-item" key={r.title}>
                  <strong>{r.title}</strong>
                  <span>{r.body}</span>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
