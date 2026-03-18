import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTheme } from "./ThemeContext";
import ThemeToggle from "./ThemeToggle";

/* AEROLAB — LBM D2Q9 CFD Wind Tunnel · f1stories.gr */

const SIM_W = 1000, SIM_H = 450;
const COLS = 400, ROWS = 180;
const DEFAULT_PARTICLES = 400, MAX_PARTICLES = 3000, TRAIL_LEN = 32;

// ── Colormaps (256 ABGR) ──
function buildTurboLUT(){const l=new Uint32Array(256);for(let i=0;i<256;i++){const t=i/255,r=Math.max(0,Math.min(255,(34.61+t*(1172.33-t*(10793.56-t*(33300.12-t*(38394.49-t*14825.05)))))|0)),g=Math.max(0,Math.min(255,(23.31+t*(557.33+t*(1225.33-t*(3574.96-t*(1073.77+t*707.56)))))|0)),b=Math.max(0,Math.min(255,(27.2+t*(3211.1-t*(15327.97-t*(27814.0-t*(22569.18-t*6838.66)))))|0));l[i]=(255<<24)|(b<<16)|(g<<8)|r;}return l;}
function buildCoolWarmLUT(){const l=new Uint32Array(256);for(let i=0;i<256;i++){const t=i/255;let r,g,b;if(t<0.5){const s=t*2;r=(30+s*170)|0;g=(60+s*120)|0;b=(200-s*10)|0;}else{const s=(t-0.5)*2;r=(200+s*55)|0;g=(180-s*155)|0;b=(190-s*165)|0;}l[i]=(255<<24)|(Math.min(255,Math.max(0,b))<<16)|(Math.min(255,Math.max(0,g))<<8)|Math.min(255,Math.max(0,r));}return l;}
const TURBO=buildTurboLUT(),COOLWARM=buildCoolWarmLUT();

// ── Geometry helpers ──
function pointInPolygon(px,py,poly){let ins=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1];if(((yi>py)!==(yj>py))&&px<((xj-xi)*(py-yi))/(yj-yi)+xi)ins=!ins;}return ins;}
function normalizePolygon(pts){if(!pts||pts.length<3)return null;const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),rx=x1-x0||1,ry=y1-y0||1;return pts.map(p=>[(p[0]-x0)/rx,(p[1]-y0)/ry]);}
function transformPolygon(n,cx,cy,sx,sy,aoa){const r=aoa*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return n.map(([nx,ny])=>{const lx=(nx-.5)*sx,ly=(ny-.5)*sy;return[cx+c*lx-s*ly,cy+s*lx+c*ly];});}
function simplifyPolygon(pts,tol){if(pts.length<=4)return pts;const r=[pts[0]];for(let i=1;i<pts.length-1;i++){const p=r[r.length-1],n=pts[i+1],c=pts[i],dx=n[0]-p[0],dy=n[1]-p[1],l=Math.sqrt(dx*dx+dy*dy)||1;if(Math.abs(dy*c[0]-dx*c[1]+n[0]*p[1]-n[1]*p[0])/l>tol)r.push(c);}r.push(pts[pts.length-1]);return r;}
function generatePreset(type){const p=[];if(type==="airfoil"){for(let t=0;t<=Math.PI*2;t+=.04){const c=Math.cos(t),s=Math.sin(t);p.push([.5+.48*c*(.5+.5*c),.5+.18*s*(1+.3*c)]);}}else if(type==="cylinder"){for(let t=0;t<=Math.PI*2;t+=.05)p.push([.5+.45*Math.cos(t),.5+.45*Math.sin(t)]);}else if(type==="wedge"){p.push([.05,.25],[.95,.5],[.05,.75]);}else if(type==="bluff"){p.push([.1,.1],[.9,.1],[.9,.9],[.1,.9]);}return p;}

// Parsers (compact)
function parseSVGToPolygon(svg,np=120){try{const doc=new DOMParser().parseFromString(svg,"image/svg+xml"),el=doc.querySelector("path,polygon,polyline,rect,circle,ellipse");if(!el)return null;const tag=el.tagName.toLowerCase();let pts=[];if(tag==="polygon"||tag==="polyline"){const raw=el.getAttribute("points").trim().split(/[\s,]+/);for(let i=0;i<raw.length-1;i+=2)pts.push([parseFloat(raw[i]),parseFloat(raw[i+1])]);}else if(tag==="rect"){const x=+el.getAttribute("x")||0,y=+el.getAttribute("y")||0,w=+el.getAttribute("width"),h=+el.getAttribute("height");pts=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];}else if(tag==="circle"||tag==="ellipse"){const cx=+(el.getAttribute("cx")||0),cy=+(el.getAttribute("cy")||0),rx=+(el.getAttribute("r")||el.getAttribute("rx")||50),ry=+(el.getAttribute("r")||el.getAttribute("ry")||rx);for(let i=0;i<=np;i++){const t=(i/np)*Math.PI*2;pts.push([cx+rx*Math.cos(t),cy+ry*Math.sin(t)]);}}else if(tag==="path"){const s=document.createElementNS("http://www.w3.org/2000/svg","svg");s.style.cssText="position:absolute;visibility:hidden;width:0;height:0";document.body.appendChild(s);const p=document.createElementNS("http://www.w3.org/2000/svg","path");p.setAttribute("d",el.getAttribute("d"));s.appendChild(p);const tl=p.getTotalLength();for(let i=0;i<=np;i++){const pt=p.getPointAtLength((i/np)*tl);pts.push([pt.x,pt.y]);}document.body.removeChild(s);}return normalizePolygon(pts);}catch{return null;}}
function parseDXFToPolygon(t){const ls=t.split(/\r?\n/).map(l=>l.trim()),pts=[];let i=0,px=null;while(i<ls.length){const c=parseInt(ls[i],10);if(c===10&&i+1<ls.length){px=parseFloat(ls[i+1]);i+=2;}else if(c===20&&i+1<ls.length&&px!==null){const y=parseFloat(ls[i+1]);if(!isNaN(px)&&!isNaN(y))pts.push([px,y]);px=null;i+=2;}else i++;}return pts.length>2?normalizePolygon(pts):null;}
function traceImageToPolygon(id,w,h,np=100){const d=id.data,edges=[];for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=(y*w+x)*4,br=d[i]*.3+d[i+1]*.59+d[i+2]*.11;if(br<128){const nb=[(y-1)*w+(x-1),(y-1)*w+x,(y-1)*w+(x+1),y*w+(x-1),y*w+(x+1),(y+1)*w+(x-1),(y+1)*w+x,(y+1)*w+(x+1)];if(nb.some(n=>(d[n*4]*.3+d[n*4+1]*.59+d[n*4+2]*.11)>=128))edges.push([x,y]);}}if(edges.length<5)return null;const cx=edges.reduce((s,p)=>s+p[0],0)/edges.length,cy=edges.reduce((s,p)=>s+p[1],0)/edges.length;edges.sort((a,b)=>Math.atan2(a[1]-cy,a[0]-cx)-Math.atan2(b[1]-cy,b[0]-cx));const st=Math.max(1,Math.floor(edges.length/np));return normalizePolygon(edges.filter((_,i)=>i%st===0));}

// ═══════════════════════════════════════════════════════════════════════════════
//  LBM D2Q9 — COLLIDE-THEN-STREAM order, cell-major f[k*9+d]
// ═══════════════════════════════════════════════════════════════════════════════
const CX=[0,1,0,-1,0,1,-1,-1,1], CY=[0,0,1,0,-1,1,1,-1,-1];
const WT=[4/9,1/9,1/9,1/9,1/9,1/36,1/36,1/36,1/36], OPP=[0,3,4,1,2,7,8,5,6];

class LBMSolver {
  constructor(cols, rows) {
    this.cols = cols; this.rows = rows; this.n = cols * rows;
    // Two buffers for double-buffering stream step
    this.f0 = new Float64Array(9 * this.n);
    this.f1 = new Float64Array(9 * this.n);
    this.rho = new Float64Array(this.n);
    this.ux  = new Float64Array(this.n);
    this.uy  = new Float64Array(this.n);
    this.solid = new Uint8Array(this.n);
    this.curl = new Float32Array(this.n);
    this.speed = new Float32Array(this.n);
    this.omega = 1.85;
    this._initEq(0.1);
  }

  _initEq(u0) {
    for (let k = 0; k < this.n; k++) {
      this.rho[k] = 1.0; this.ux[k] = u0; this.uy[k] = 0;
      for (let d = 0; d < 9; d++) {
        const cu = CX[d] * u0;
        this.f0[k * 9 + d] = WT[d] * (1.0 + 3.0 * cu + 4.5 * cu * cu - 1.5 * u0 * u0);
      }
    }
  }

  setViscosity(nu) {
    this.omega = Math.min(1.95, Math.max(0.5, 1.0 / (3.0 * nu + 0.5)));
  }

  buildSolid(poly) {
    this.solid.fill(0);
    if (!poly) return;
    for (let j = 0; j < this.rows; j++)
      for (let i = 0; i < this.cols; i++)
        if (pointInPolygon(i + 0.5, j + 0.5, poly))
          this.solid[j * this.cols + i] = 1;
  }

  step(inletU, turb) {
    const { cols, rows, n, f0, f1, rho, ux, uy, solid, omega } = this;

    // ═══ STREAM (pull scheme into f1) ═══
    // Each cell (i,j) pulls from neighbor (i-cx, j-cy) for direction d
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        const dst = k * 9;
        for (let d = 0; d < 9; d++) {
          const si = i - CX[d], sj = j - CY[d];
          if (si >= 0 && si < cols && sj >= 0 && sj < rows) {
            f1[dst + d] = f0[(sj * cols + si) * 9 + d];
          } else {
            // Wall: bounce back (reflect direction)
            f1[dst + d] = f0[k * 9 + OPP[d]];
          }
        }
      }
    }

    // ═══ BOUNCE-BACK on solid cells ═══
    // For solid cells, the streamed-in distributions get reflected
    for (let k = 0; k < n; k++) {
      if (!solid[k]) continue;
      const base = k * 9;
      // Read what was streamed in (from fluid neighbors), reflect back
      const t0=f1[base],t1=f1[base+1],t2=f1[base+2],t3=f1[base+3],t4=f1[base+4],t5=f1[base+5],t6=f1[base+6],t7=f1[base+7],t8=f1[base+8];
      f1[base+0]=t0;
      f1[base+1]=t3; f1[base+3]=t1;
      f1[base+2]=t4; f1[base+4]=t2;
      f1[base+5]=t7; f1[base+7]=t5;
      f1[base+6]=t8; f1[base+8]=t6;
    }

    // ═══ MACROSCOPIC (from f1) ═══
    for (let k = 0; k < n; k++) {
      if (solid[k]) { ux[k] = 0; uy[k] = 0; rho[k] = 1; this.speed[k] = 0; continue; }
      const base = k * 9;
      let r = 0, vx = 0, vy = 0;
      for (let d = 0; d < 9; d++) {
        const fv = f1[base + d];
        r += fv; vx += CX[d] * fv; vy += CY[d] * fv;
      }
      if (r < 0.01) r = 1.0; // safety clamp
      rho[k] = r;
      ux[k] = vx / r;
      uy[k] = vy / r;
      this.speed[k] = Math.sqrt(vx * vx + vy * vy) / r;
    }

    // ═══ INLET BC (Zou-He: prescribed velocity at i=0) ═══
    const pertScale = turb * 0.004;
    for (let j = 1; j < rows - 1; j++) {
      const k = j * cols; // i=0
      const base = k * 9;
      const v0 = (Math.random() - 0.5) * pertScale;
      // Known post-stream: f1[0], f1[2], f1[4], f1[3], f1[6], f1[7]
      // Unknown: f1[1], f1[5], f1[8]
      const rhoIn = (f1[base+0] + f1[base+2] + f1[base+4] + 2.0*(f1[base+3] + f1[base+6] + f1[base+7])) / (1.0 - inletU);
      f1[base+1] = f1[base+3] + (2.0/3.0) * rhoIn * inletU;
      f1[base+5] = f1[base+7] + (1.0/6.0) * rhoIn * inletU + 0.5 * rhoIn * v0 - 0.5 * (f1[base+2] - f1[base+4]);
      f1[base+8] = f1[base+6] + (1.0/6.0) * rhoIn * inletU - 0.5 * rhoIn * v0 + 0.5 * (f1[base+2] - f1[base+4]);
      rho[k] = rhoIn; ux[k] = inletU; uy[k] = v0;
    }

    // ═══ OUTLET BC (zero-gradient: copy from second-to-last column) ═══
    for (let j = 1; j < rows - 1; j++) {
      const ke = j * cols + (cols - 1), kp = ke - 1;
      for (let d = 0; d < 9; d++) f1[ke * 9 + d] = f1[kp * 9 + d];
      rho[ke] = rho[kp]; ux[ke] = ux[kp]; uy[ke] = uy[kp]; this.speed[ke] = this.speed[kp];
    }

    // ═══ TOP/BOTTOM wall (bounce-back specific directions) ═══
    for (let i = 0; i < cols; i++) {
      // Top wall (j=0): reflect upward-going into downward
      const kt = i, bt = kt * 9;
      f1[bt+4] = f1[bt+2]; // south <- north
      f1[bt+7] = f1[bt+5]; // SW <- NE
      f1[bt+8] = f1[bt+6]; // SE <- NW
      ux[kt] = 0; uy[kt] = 0; rho[kt] = 1;

      // Bottom wall (j=rows-1): reflect downward-going into upward
      const kb = (rows-1)*cols+i, bb = kb * 9;
      f1[bb+2] = f1[bb+4]; // north <- south
      f1[bb+5] = f1[bb+7]; // NE <- SW
      f1[bb+6] = f1[bb+8]; // NW <- SE
      ux[kb] = 0; uy[kb] = 0; rho[kb] = 1;
    }

    // ═══ COLLIDE (BGK: relax f1 toward equilibrium, write to f0) ═══
    for (let k = 0; k < n; k++) {
      const base = k * 9;
      if (solid[k]) {
        // Just copy reflected distributions
        for (let d = 0; d < 9; d++) f0[base + d] = f1[base + d];
        continue;
      }
      const r = rho[k], vx = ux[k], vy = uy[k];
      const usq = vx * vx + vy * vy;
      for (let d = 0; d < 9; d++) {
        const cu = CX[d] * vx + CY[d] * vy;
        const feq = WT[d] * r * (1.0 + 3.0 * cu + 4.5 * cu * cu - 1.5 * usq);
        f0[base + d] = f1[base + d] + omega * (feq - f1[base + d]);
      }
    }

    // ═══ CURL (vorticity) ═══
    for (let j = 1; j < rows - 1; j++)
      for (let i = 1; i < cols - 1; i++) {
        const k = j * cols + i;
        this.curl[k] = (uy[k+1] - uy[k-1]) * 0.5 - (ux[k+cols] - ux[k-cols]) * 0.5;
      }
  }
}

// ── Particle: RK2 + bilinear interp ──
class Particle {
  constructor(){this.x=0;this.y=0;this.age=0;this.life=0;this.tx=new Float32Array(TRAIL_LEN);this.ty=new Float32Array(TRAIL_LEN);this.tl=0;this.ti=0;this.active=true;this.reset();}
  reset(){this.x=Math.random()*3;this.y=1+Math.random()*(ROWS-2);this.age=0;this.life=.8+Math.random()*1.2;this.tl=0;this.ti=0;}
  static vel(s,x,y){const i0=Math.max(0,Math.min(COLS-2,x|0)),j0=Math.max(0,Math.min(ROWS-2,y|0)),tx=x-i0,ty=y-j0,k00=j0*COLS+i0,k10=k00+1,k01=k00+COLS,k11=k01+1;if(s.solid[k00]||s.solid[k10]||s.solid[k01]||s.solid[k11])return[0,0];return[(1-tx)*(1-ty)*s.ux[k00]+tx*(1-ty)*s.ux[k10]+(1-tx)*ty*s.ux[k01]+tx*ty*s.ux[k11],(1-tx)*(1-ty)*s.uy[k00]+tx*(1-ty)*s.uy[k10]+(1-tx)*ty*s.uy[k01]+tx*ty*s.uy[k11]];}
  update(s){if(!this.active)return;if(this.x<0||this.x>=COLS-1||this.y<1||this.y>=ROWS-1){this.reset();return;}if(s.solid[(this.y|0)*COLS+(this.x|0)]){this.reset();return;}const i=this.ti%TRAIL_LEN;this.tx[i]=this.x*(SIM_W/COLS);this.ty[i]=this.y*(SIM_H/ROWS);this.ti++;if(this.tl<TRAIL_LEN)this.tl++;const[a,b]=Particle.vel(s,this.x,this.y),[c,d]=Particle.vel(s,this.x+a*.5,this.y+b*.5);this.x+=c;this.y+=d;this.age+=.016;if(this.age>=this.life||this.x>=COLS-1||this.x<0)this.reset();}
}
function mkPool(){return Array.from({length:MAX_PARTICLES},(_,i)=>{const p=new Particle();p.active=i<DEFAULT_PARTICLES;return p;});}
function resPool(pool,n){const t=Math.min(n,MAX_PARTICLES);for(let i=0;i<pool.length;i++){if(i<t){if(!pool[i].active){pool[i].active=true;pool[i].reset();}}else pool[i].active=false;}}

// ── Icons ──
const IconPlay=()=><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>;
const IconPause=()=><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>;
const IconReset=()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.17"/></svg>;
const IconUpload=()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const IconImage=()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
const IconWind=()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17.7 7.7A2.5 2.5 0 1 1 19 12H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>;
const IconChart=()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>;
const IconGear=()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>;
const IconLayers=()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>;
const IconKeyboard=()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/></svg>;
const IconParticles=()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="5" cy="8" r="2"/><circle cx="12" cy="5" r="2.5"/><circle cx="19" cy="9" r="1.5"/><circle cx="8" cy="16" r="1.8"/><circle cx="16" cy="17" r="2.2"/></svg>;
function useHistory(ml=100){const r=useRef([]);const p=useCallback(e=>{r.current.push({...e,t:Date.now()});if(r.current.length>ml)r.current.shift();},[ml]);return[r,p];}

// ═══════════════════════════════════════════════════════════════════════════════
export default function CFDLab(){
  const{isDark}=useTheme();
  const[activeView,setActiveView]=useState("tunnel"),[sidebarOpen,setSidebarOpen]=useState(true);
  const solverRef=useRef(null),particlesRef=useRef(mkPool());
  const canvasRef=useRef(null),drawCanvasRef=useRef(null),miniCanvasRef=useRef(null),rafRef=useRef(null),frameRef=useRef(0),isDrawingRef=useRef(false),drawPointsRef=useRef([]),imageDataRef=useRef(null);
  const[tab,setTab]=useState("preset"),[running,setRunning]=useState(false),[viewMode,setViewMode]=useState("velocity");
  const[normPoly,setNormPoly]=useState(()=>generatePreset("airfoil")),[presetType,setPresetType]=useState("airfoil");
  const[shapeReady,setShapeReady]=useState(true),[error,setError]=useState(""),[simplify,setSimplify]=useState(0);
  const[stats,setStats]=useState({cl:0,cd:0,re:0,maxV:0}),[displayFrame,setDisplayFrame]=useState(0);
  const[particleCount,setParticleCount]=useState(DEFAULT_PARTICLES),[trailOpacity,setTrailOpacity]=useState(1);
  const[simSpeed,setSimSpeed]=useState(1),[fps,setFps]=useState(0);
  const fpsF=useRef(0),fpsT=useRef(performance.now());
  const[cx,setCx]=useState(COLS*.35),[cy,setCy]=useState(ROWS/2),[scaleX,setScaleX]=useState(COLS*.25),[scaleY,setScaleY]=useState(ROWS*.45),[aoa,setAoa]=useState(5);
  const[velocity,setVelocity]=useState(.1),[turbulence,setTurbulence]=useState(.3),[viscosity,setViscosity]=useState(.02);
  const[historyRef,pushHistory]=useHistory(200),[historySnap,setHistorySnap]=useState([]);
  const rRef=useRef(false),vmRef=useRef("velocity"),pRef=useRef(null),cxR=useRef(0),cyR=useRef(0),sxR=useRef(0),syR=useRef(0),aoR=useRef(0),siR=useRef(0),vR=useRef(.1),tR=useRef(.3),nR=useRef(.02),thR=useRef(true),pcR=useRef(DEFAULT_PARTICLES),toR=useRef(1),ssR=useRef(1);

  // Init solver
  useEffect(()=>{if(!solverRef.current){const s=new LBMSolver(COLS,ROWS);s.setViscosity(.02);solverRef.current=s;}},[]);

  useEffect(()=>{thR.current=isDark},[isDark]);useEffect(()=>{rRef.current=running},[running]);useEffect(()=>{vmRef.current=viewMode},[viewMode]);
  useEffect(()=>{vR.current=velocity},[velocity]);useEffect(()=>{tR.current=turbulence},[turbulence]);
  useEffect(()=>{nR.current=viscosity;if(solverRef.current)solverRef.current.setViscosity(viscosity);},[viscosity]);
  useEffect(()=>{pcR.current=particleCount;resPool(particlesRef.current,particleCount)},[particleCount]);
  useEffect(()=>{toR.current=trailOpacity},[trailOpacity]);useEffect(()=>{ssR.current=simSpeed},[simSpeed]);

  const rebuildSolid=useCallback(()=>{const raw=pRef.current;if(!raw||!solverRef.current)return;const simp=siR.current>0?simplifyPolygon(raw,siR.current*.005):raw;solverRef.current.buildSolid(transformPolygon(simp,cxR.current,cyR.current,sxR.current,syR.current,aoR.current));},[]);
  useEffect(()=>{aoR.current=aoa;cxR.current=cx;cyR.current=cy;sxR.current=scaleX;syR.current=scaleY;rebuildSolid()},[aoa,cx,cy,scaleX,scaleY,rebuildSolid]);
  useEffect(()=>{pRef.current=normPoly;siR.current=simplify;rebuildSolid()},[normPoly,simplify,rebuildSolid]);

  useEffect(()=>{const h=e=>{if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA")return;switch(e.code){case"Space":e.preventDefault();setRunning(r=>!r);break;case"KeyR":{const s=new LBMSolver(COLS,ROWS);s.setViscosity(nR.current);solverRef.current=s;rebuildSolid();}break;case"Digit1":setViewMode("velocity");break;case"Digit2":setViewMode("pressure");break;case"Digit3":setViewMode("streamlines");break;case"Digit4":setViewMode("vorticity");break;case"BracketLeft":setParticleCount(c=>Math.max(0,c-50));break;case"BracketRight":setParticleCount(c=>Math.min(MAX_PARTICLES,c+50));break;}};window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h)},[rebuildSolid]);

  // ── RENDER LOOP ──
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext("2d");imageDataRef.current=ctx.createImageData(SIM_W,SIM_H);
    const DX=SIM_W/COLS,DY=SIM_H/ROWS;
    const loop=()=>{
      rafRef.current=requestAnimationFrame(loop);
      const solver=solverRef.current;if(!solver)return;
      const inV=vR.current;
      if(rRef.current){const steps=ssR.current;for(let s=0;s<steps;s++)solver.step(inV,tR.current);}
      frameRef.current++;fpsF.current++;const now=performance.now();if(now-fpsT.current>=1000){setFps(fpsF.current);fpsF.current=0;fpsT.current=now;}
      const dark=thR.current,vm=vmRef.current,img=imageDataRef.current,buf32=new Uint32Array(img.data.buffer);
      const solidCol=dark?((255<<24)|(80<<16)|(65<<8)|45):((255<<24)|(195<<16)|(178<<8)|155);
      const bgCol=dark?((255<<24)|(18<<16)|(10<<8)|3):((255<<24)|(244<<16)|(238<<8)|230);

      if(vm==="streamlines"){
        buf32.fill(bgCol);
        for(let k=0;k<solver.n;k++)if(solver.solid[k]){const i=k%COLS,j=(k/COLS)|0,x0=(i*DX)|0,y0=(j*DY)|0,x1=Math.min(((i+1)*DX)|0,SIM_W),y1=Math.min(((j+1)*DY)|0,SIM_H);for(let py=y0;py<y1;py++)for(let px=x0;px<x1;px++)buf32[py*SIM_W+px]=solidCol;}
      } else {
        const lut=vm==="pressure"?COOLWARM:TURBO;
        // Build scalar field
        let fMin=1e9,fMax=-1e9;
        const spd=solver.speed,rho=solver.rho,curl=solver.curl;
        for(let k=0;k<solver.n;k++){
          if(solver.solid[k])continue;
          let v;
          if(vm==="velocity")v=spd[k]; else if(vm==="pressure")v=rho[k]; else v=curl[k];
          if(v<fMin)fMin=v;if(v>fMax)fMax=v;
        }
        const fR=fMax-fMin;if(fR<1e-10){buf32.fill(lut[128]);} else {
        const invR=255/fR,invDX=1/DX,invDY=1/DY;
        // Bilinear per-pixel
        for(let py=0;py<SIM_H;py++){
          const fy=py*invDY-.5,j0=Math.max(0,Math.min(ROWS-2,fy|0)),j1=j0+1,ty=Math.max(0,Math.min(1,fy-j0)),ro=py*SIM_W;
          for(let px=0;px<SIM_W;px++){
            const fx=px*invDX-.5,i0=Math.max(0,Math.min(COLS-2,fx|0)),i1=i0+1,tx=Math.max(0,Math.min(1,fx-i0));
            const k00=j0*COLS+i0,k10=j0*COLS+i1,k01=j1*COLS+i0,k11=j1*COLS+i1;
            const sa=solver.solid[k00]+solver.solid[k10]+solver.solid[k01]+solver.solid[k11];
            if(sa>=3){buf32[ro+px]=solidCol;continue;}
            let val;
            if(sa>0){
              let best=NaN;
              if(!solver.solid[k00])best=vm==="velocity"?spd[k00]:vm==="pressure"?rho[k00]:curl[k00];
              else if(!solver.solid[k10])best=vm==="velocity"?spd[k10]:vm==="pressure"?rho[k10]:curl[k10];
              else if(!solver.solid[k01])best=vm==="velocity"?spd[k01]:vm==="pressure"?rho[k01]:curl[k01];
              else if(!solver.solid[k11])best=vm==="velocity"?spd[k11]:vm==="pressure"?rho[k11]:curl[k11];
              if(isNaN(best)){buf32[ro+px]=solidCol;continue;}
              val=best;
            } else {
              const g=vm==="velocity"?spd:vm==="pressure"?rho:curl;
              const top=g[k00]+(g[k10]-g[k00])*tx,bot=g[k01]+(g[k11]-g[k01])*tx;
              val=top+(bot-top)*ty;
            }
            buf32[ro+px]=lut[Math.max(0,Math.min(255,((val-fMin)*invR)|0))];
          }
        }}
      }
      ctx.putImageData(img,0,0);

      // Particles
      const parts=particlesRef.current,pC=pcR.current,tO=toR.current;
      for(let pi=0;pi<pC&&pi<parts.length;pi++)parts[pi].update(solver);
      if((vm==="streamlines"||vm==="velocity"||vm==="vorticity")&&tO>0){
        ctx.lineCap="round";ctx.lineJoin="round";
        for(let pi=0;pi<pC&&pi<parts.length;pi++){const p=parts[pi];if(!p.active||p.tl<2)continue;
          ctx.beginPath();const st=p.ti-p.tl;for(let ti=st;ti<p.ti;ti++){const idx=((ti%TRAIL_LEN)+TRAIL_LEN)%TRAIL_LEN;ti===st?ctx.moveTo(p.tx[idx],p.ty[idx]):ctx.lineTo(p.tx[idx],p.ty[idx]);}
          const a=(1-p.age/p.life)*(vm==="streamlines"?.8:.35)*tO;
          ctx.strokeStyle=vm==="streamlines"?(dark?`rgba(130,220,255,${a})`:`rgba(10,80,160,${a})`):(dark?`rgba(255,255,255,${a})`:`rgba(0,0,0,${a*.5})`);ctx.lineWidth=vm==="streamlines"?1.2:.6;ctx.stroke();}
      }
      // Outline
      const raw=pRef.current;if(raw){const simp=siR.current>0?simplifyPolygon(raw,siR.current*.005):raw;const tp=transformPolygon(simp,cxR.current,cyR.current,sxR.current,syR.current,aoR.current);const oc=dark?"#40e8ff":"#0a7ea4";ctx.beginPath();tp.forEach(([gx,gy],i)=>{const px=gx*DX,py=gy*DY;i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);});ctx.closePath();ctx.strokeStyle=oc;ctx.lineWidth=1.2;ctx.shadowColor=oc;ctx.shadowBlur=dark?8:3;ctx.stroke();ctx.shadowBlur=0;}
      // Stats
      if(rRef.current&&frameRef.current%12===0){let mV=0,tFy=0,tFx=0,cnt=0;for(let k=0;k<solver.n;k++){if(solver.solid[k])continue;const sp=solver.speed[k],vx=solver.ux[k],vy=solver.uy[k];if(!isFinite(sp))continue;cnt++;if(sp>mV)mV=sp;tFy+=vy;tFx+=Math.abs(vx-inV);}const re=(inV*sxR.current)/(nR.current+1e-6)*10;const cl=cnt>0?Math.abs(tFy/cnt*2*(1+aoR.current*.06)):0;const cd=cnt>0?tFx/cnt*0.5+0.008:0;const ns={cl:+cl.toFixed(4),cd:+cd.toFixed(4),re:Math.round(re),maxV:inV>0?+(mV/inV).toFixed(3):0};setStats(ns);pushHistory(ns);}
      if(frameRef.current%30===0)setDisplayFrame(frameRef.current);
      const mc=miniCanvasRef.current;if(mc)mc.getContext("2d").drawImage(canvas,0,0,mc.width,mc.height);
    };rafRef.current=requestAnimationFrame(loop);return()=>cancelAnimationFrame(rafRef.current);
  },[pushHistory]);

  // File handlers
  const handleSVG=e=>{const f=e.target.files[0];if(!f)return;setError("");setShapeReady(false);const r=new FileReader();r.onload=ev=>{const p=parseSVGToPolygon(ev.target.result);if(!p){setError("Could not parse SVG.");setShapeReady(true);return;}setNormPoly(p);setShapeReady(true);};r.readAsText(f);};
  const handleDXF=e=>{const f=e.target.files[0];if(!f)return;setError("");setShapeReady(false);const r=new FileReader();r.onload=ev=>{const p=parseDXFToPolygon(ev.target.result);if(!p){setError("Could not parse DXF.");setShapeReady(true);return;}setNormPoly(p);setShapeReady(true);};r.readAsText(f);};
  const handleImage=e=>{const f=e.target.files[0];if(!f)return;setError("");setShapeReady(false);const u=URL.createObjectURL(f);const img=new Image();img.onload=()=>{const c=document.createElement("canvas"),W=Math.min(img.width,200),H=Math.min(img.height,200);c.width=W;c.height=H;const x=c.getContext("2d");x.drawImage(img,0,0,W,H);const p=traceImageToPolygon(x.getImageData(0,0,W,H),W,H);URL.revokeObjectURL(u);if(!p){setError("Could not trace.");setShapeReady(true);return;}setNormPoly(p);setShapeReady(true);};img.onerror=()=>{URL.revokeObjectURL(u);setError("Failed.");setShapeReady(true);};img.src=u;};
  const getDP=e=>{const dc=drawCanvasRef.current,r=dc.getBoundingClientRect(),cx=e.touches?e.touches[0].clientX:e.clientX,cy=e.touches?e.touches[0].clientY:e.clientY;return[(cx-r.left)*(dc.width/r.width),(cy-r.top)*(dc.height/r.height)];};
  const startDraw=e=>{e.preventDefault();isDrawingRef.current=true;drawCanvasRef.current.getContext("2d").clearRect(0,0,drawCanvasRef.current.width,drawCanvasRef.current.height);drawPointsRef.current=[getDP(e)];};
  const moveDraw=e=>{e.preventDefault();if(!isDrawingRef.current)return;const[x,y]=getDP(e);drawPointsRef.current.push([x,y]);const c=drawCanvasRef.current.getContext("2d");c.strokeStyle=isDark?"#40e8ff":"#0a7ea4";c.lineWidth=2;c.lineCap="round";const pts=drawPointsRef.current;if(pts.length>1){c.beginPath();c.moveTo(pts[pts.length-2][0],pts[pts.length-2][1]);c.lineTo(x,y);c.stroke();}};
  const endDraw=()=>{isDrawingRef.current=false;const pts=drawPointsRef.current;if(pts.length<5)return;const p=normalizePolygon(pts);if(p){setNormPoly(p);setError("");setShapeReady(true);}};
  const regime=useMemo(()=>{if(stats.re<2300)return{label:"Laminar",col:"var(--accent-green)"};if(stats.re<4000)return{label:"Transitional",col:"var(--accent-orange)"};return{label:"Turbulent",col:"var(--accent-red-stat)"};},[stats.re]);
  useEffect(()=>{const iv=setInterval(()=>setHistorySnap([...historyRef.current]),500);return()=>clearInterval(iv);},[historyRef]);
  const exportCSV=useCallback(()=>{const d=historyRef.current;if(!d.length)return;const b=new Blob(["timestamp,cl,cd,re,maxV\n"+d.map(r=>`${r.t},${r.cl},${r.cd},${r.re},${r.maxV}`).join("\n")],{type:"text/csv"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`aerolab-${Date.now()}.csv`;a.click();URL.revokeObjectURL(u);},[historyRef]);
  const resetAll=useCallback(()=>{setRunning(false);setVelocity(.1);setTurbulence(.3);setViscosity(.02);setCx(COLS*.35);setCy(ROWS/2);setScaleX(COLS*.25);setScaleY(ROWS*.45);setAoa(5);setSimplify(0);setParticleCount(DEFAULT_PARTICLES);setTrailOpacity(1);setSimSpeed(1);setPresetType("airfoil");setNormPoly(generatePreset("airfoil"));const s=new LBMSolver(COLS,ROWS);s.setViscosity(.02);solverRef.current=s;},[]);

  const S=useMemo(()=>({panel:{background:"var(--bg-panel)",border:"1px solid var(--border-primary)",borderRadius:10,padding:16,transition:"background .4s,border-color .4s"},sh:{fontSize:9,color:"var(--text-muted)",letterSpacing:3,textTransform:"uppercase",marginBottom:14,display:"flex",alignItems:"center",gap:8,fontWeight:600},btn:a=>({padding:"7px 12px",fontSize:9,letterSpacing:1.5,fontFamily:"'JetBrains Mono',monospace",background:a?"var(--accent-cyan-glow)":"transparent",border:`1px solid ${a?"var(--accent-cyan)":"var(--border-primary)"}`,color:a?"var(--accent-cyan)":"var(--text-dim)",borderRadius:6,cursor:"pointer",transition:"all .2s"}),tab:a=>({padding:"5px 10px",fontSize:8,letterSpacing:1.5,fontFamily:"'JetBrains Mono',monospace",background:a?"var(--accent-cyan-glow)":"transparent",border:`1px solid ${a?"var(--border-accent)":"var(--border-primary)"}`,color:a?"var(--accent-cyan)":"var(--text-dim)",borderRadius:5,cursor:"pointer"}),fb:{display:"flex",alignItems:"center",gap:8,padding:"12px 14px",background:"var(--accent-cyan-glow)",border:"1px dashed var(--border-accent)",borderRadius:8,cursor:"pointer",color:"var(--text-muted)",fontSize:10,letterSpacing:1.5,justifyContent:"center",width:"100%"},err:{marginTop:10,fontSize:9,color:"var(--accent-red-stat)",background:"var(--accent-red-glow)",border:"1px solid var(--accent-red)",borderRadius:6,padding:"8px 12px"}}),[]);

  return(<div style={{background:"var(--bg-root)",minHeight:"100vh",fontFamily:"'JetBrains Mono','SF Mono','Fira Code',monospace",color:"var(--text-primary)",display:"flex",flexDirection:"column",transition:"background .4s,color .4s"}}>
    <div style={{display:"flex",alignItems:"center",gap:16,padding:"14px 24px",background:"var(--bg-topbar)",borderBottom:"1px solid var(--border-primary)",position:"sticky",top:0,zIndex:100,backdropFilter:"var(--topbar-blur)"}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:36,height:36,borderRadius:10,background:isDark?"linear-gradient(135deg,#0a2a4a,#0d3a60)":"linear-gradient(135deg,#dce8f4,#c8d8ec)",border:"1px solid var(--border-accent)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"var(--shadow-logo)"}}><IconWind/></div><div><div style={{fontFamily:"'Outfit',sans-serif",fontSize:18,fontWeight:800,background:isDark?"linear-gradient(90deg,#40e8ff,#80f0ff,#40e8ff)":"linear-gradient(90deg,#0a6e94,#0a9ec4,#0a6e94)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:2}}>AEROLAB</div><div style={{fontSize:8,color:"var(--text-faint)",letterSpacing:3,marginTop:-2}}>BY <a href="https://f1stories.gr" target="_blank" rel="noopener noreferrer" style={{color:"var(--text-faint)",textDecoration:"none",borderBottom:"1px dotted var(--text-faint)"}}>F1STORIES.GR</a></div></div></div>
      <div style={{display:"flex",gap:4,marginLeft:32}}>{[{id:"tunnel",l:"Wind Tunnel",ic:<IconWind/>},{id:"analysis",l:"Analysis",ic:<IconChart/>},{id:"about",l:"About",ic:<IconLayers/>}].map(({id,l,ic})=><button key={id} onClick={()=>setActiveView(id)} style={{display:"flex",alignItems:"center",gap:7,padding:"8px 18px",fontSize:10,letterSpacing:1.5,fontFamily:"inherit",fontWeight:activeView===id?600:400,background:activeView===id?"var(--accent-cyan-glow)":"transparent",border:`1px solid ${activeView===id?"var(--border-accent)":"transparent"}`,color:activeView===id?"var(--accent-cyan)":"var(--text-muted)",borderRadius:8,cursor:"pointer"}}>{ic}{l}</button>)}</div>
      <div style={{flex:1}}/><ThemeToggle/>
      <div style={{display:"flex",gap:12,alignItems:"center"}}><div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 14px",borderRadius:20,background:running?"var(--accent-green-glow)":"var(--accent-red-glow)",border:`1px solid ${running?"rgba(0,255,136,.2)":"rgba(255,100,80,.15)"}`}}><div style={{width:7,height:7,borderRadius:"50%",background:running?"var(--accent-green)":"var(--accent-red)",boxShadow:`0 0 8px ${running?"var(--accent-green)":"var(--accent-red)"}`,animation:running?"pulse 1.5s infinite":"none"}}/><span style={{fontSize:9,letterSpacing:2,color:running?"var(--accent-green)":"var(--accent-red)"}}>{running?"LIVE":"IDLE"}</span></div><div style={{fontSize:9,color:"var(--text-faint)",letterSpacing:1}}>#{displayFrame}</div></div>
    </div>
    <div style={{display:"flex",flex:1,overflow:"hidden"}}>
      {activeView==="tunnel"&&<div style={{width:sidebarOpen?268:0,minWidth:sidebarOpen?268:0,transition:"all .3s",overflow:"hidden",borderRight:"1px solid var(--border-primary)",background:isDark?"rgba(3,10,20,.6)":"rgba(245,248,252,.8)",display:"flex",flexDirection:"column"}}><div style={{padding:16,display:"flex",flexDirection:"column",gap:12,overflowY:"auto",flex:1}}>
        <div style={S.panel}><div style={S.sh}><IconGear/> Import</div><div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:12}}>{["preset","svg","dxf","draw","image"].map(id=><button key={id} onClick={()=>{setTab(id);setError("")}} style={S.tab(tab===id)}>{id.toUpperCase()}</button>)}</div>{tab==="preset"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>{["airfoil","cylinder","wedge","bluff"].map(p=><button key={p} onClick={()=>{setPresetType(p);setNormPoly(generatePreset(p))}} style={S.btn(presetType===p)}>{p}</button>)}</div>}{tab==="svg"&&<label style={S.fb}><IconUpload/> .svg<input type="file" accept=".svg" style={{display:"none"}} onChange={handleSVG}/></label>}{tab==="dxf"&&<label style={S.fb}><IconUpload/> .dxf<input type="file" accept=".dxf" style={{display:"none"}} onChange={handleDXF}/></label>}{tab==="draw"&&<div><div style={{fontSize:9,color:"var(--text-muted)",marginBottom:6}}>Draw outline</div><canvas ref={drawCanvasRef} width={208} height={140} style={{background:"var(--bg-canvas)",border:"1px solid var(--border-subtle)",borderRadius:6,cursor:"crosshair",display:"block",width:"100%",touchAction:"none"}} onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={endDraw} onMouseLeave={endDraw} onTouchStart={startDraw} onTouchMove={moveDraw} onTouchEnd={endDraw}/></div>}{tab==="image"&&<label style={S.fb}><IconImage/> PNG/JPG<input type="file" accept="image/*" style={{display:"none"}} onChange={handleImage}/></label>}{error&&<div style={S.err}>{error}</div>}{!shapeReady&&<div style={{marginTop:8,fontSize:9,color:"var(--accent-orange)"}}>Processing…</div>}</div>
        <div style={S.panel}><div style={S.sh}><IconLayers/> Transform</div><SliderRow l="Pos X" v={cx.toFixed(0)} min={10} max={COLS-10} step={1} set={setCx} col="var(--accent-cyan)"/><SliderRow l="Pos Y" v={cy.toFixed(0)} min={4} max={ROWS-4} step={1} set={setCy} col="var(--accent-cyan)"/><SliderRow l="Scale X" v={scaleX.toFixed(0)} min={10} max={COLS*.5} step={1} set={setScaleX} col="var(--accent-purple)"/><SliderRow l="Scale Y" v={scaleY.toFixed(0)} min={5} max={ROWS*.7} step={1} set={setScaleY} col="var(--accent-purple)"/><SliderRow l="AoA" v={aoa} min={-25} max={35} step={1} set={setAoa} u="°" col="var(--accent-green)"/></div>
        <div style={S.panel}><div style={S.sh}><IconWind/> Flow</div><SliderRow l="Velocity" v={velocity.toFixed(3)} min={.02} max={.18} step={.005} set={setVelocity} u=" U" col="var(--accent-cyan)"/><SliderRow l="Turbulence" v={turbulence.toFixed(1)} min={0} max={3} step={.1} set={setTurbulence} col="var(--accent-orange)"/><SliderRow l="Viscosity ν" v={viscosity.toFixed(3)} min={.005} max={.1} step={.001} set={setViscosity} col="var(--accent-purple)"/></div>
        <div style={S.panel}><div style={S.sh}><IconParticles/> Particles</div><SliderRow l="Count" v={particleCount} min={0} max={MAX_PARTICLES} step={10} set={setParticleCount} col="var(--accent-cyan)"/><SliderRow l="Opacity" v={trailOpacity.toFixed(2)} min={0} max={1} step={.05} set={setTrailOpacity} col="var(--accent-purple)"/><SliderRow l={`Speed (${simSpeed}×)`} v={simSpeed} min={1} max={10} step={1} set={setSimSpeed} u="×" col="var(--accent-orange)"/><div style={{display:"flex",gap:4,marginTop:6}}>{[{l:"OFF",v:0},{l:"LOW",v:100},{l:"MED",v:DEFAULT_PARTICLES},{l:"HIGH",v:1000},{l:"MAX",v:MAX_PARTICLES}].map(({l,v})=><button key={l} onClick={()=>setParticleCount(v)} style={{...S.tab(particleCount===v),flex:1,textAlign:"center",padding:"4px 2px",fontSize:7}}>{l}</button>)}</div></div>
        <div style={{...S.panel,padding:12}}><div style={S.sh}><IconKeyboard/> Keys</div><div style={{display:"flex",flexDirection:"column",gap:4}}>{[["Space","Play/Pause"],["R","Reset"],["1-4","Views"],["[ ]","±Particles"]].map(([k,d])=><div key={k} style={{display:"flex",gap:8,alignItems:"center"}}><kbd style={{fontSize:8,padding:"2px 6px",borderRadius:4,background:"var(--bg-input)",border:"1px solid var(--border-primary)",color:"var(--text-muted)",fontFamily:"inherit"}}>{k}</kbd><span style={{fontSize:9,color:"var(--text-dim)"}}>{d}</span></div>)}</div></div>
      </div></div>}
      <div style={{flex:1,display:"flex",flexDirection:"column",padding:20,gap:14,overflowY:"auto"}}>
        {activeView==="tunnel"&&<>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <button onClick={()=>setSidebarOpen(v=>!v)} style={{...S.btn(false),padding:"8px 10px",fontSize:10}}>☰</button>
            <div style={{display:"flex",gap:4,background:isDark?"rgba(4,14,26,.7)":"rgba(255,255,255,.7)",borderRadius:8,padding:3,border:"1px solid var(--border-primary)"}}>{["velocity","pressure","streamlines","vorticity"].map(m=><button key={m} onClick={()=>setViewMode(m)} style={{padding:"7px 14px",fontSize:9,letterSpacing:1.2,fontFamily:"inherit",background:viewMode===m?"var(--accent-cyan-glow)":"transparent",border:"none",color:viewMode===m?"var(--accent-cyan)":"var(--text-dim)",borderRadius:6,cursor:"pointer",fontWeight:viewMode===m?600:400}}>{m.toUpperCase()}</button>)}</div>
            <div style={{flex:1}}/>
            <button onClick={()=>setRunning(r=>!r)} style={{display:"flex",alignItems:"center",gap:7,padding:"8px 20px",fontSize:10,letterSpacing:1.5,fontFamily:"inherit",background:running?"var(--accent-red-glow)":"var(--accent-green-glow)",border:`1px solid ${running?"var(--accent-red)":"var(--accent-green)"}`,color:running?"var(--accent-red)":"var(--accent-green)",borderRadius:8,cursor:"pointer",fontWeight:600}}>{running?<><IconPause/> PAUSE</>:<><IconPlay/> RUN</>}</button>
            <button onClick={()=>{const s=new LBMSolver(COLS,ROWS);s.setViscosity(nR.current);solverRef.current=s;rebuildSolid()}} style={{display:"flex",alignItems:"center",gap:6,...S.btn(false),padding:"8px 16px"}}><IconReset/> RESET</button>
            <button onClick={resetAll} style={{...S.btn(false),padding:"8px 12px",fontSize:8}}>↺ ALL</button>
            <button onClick={exportCSV} style={{...S.btn(false),padding:"8px 12px",fontSize:8}}>⬇ CSV</button>
            <div style={{fontSize:9,color:"var(--text-faint)",padding:"5px 10px",borderRadius:6,background:isDark?"rgba(4,14,26,.5)":"rgba(230,238,244,.5)",border:"1px solid var(--border-primary)",fontVariantNumeric:"tabular-nums"}}>{fps} <span style={{fontSize:7,opacity:.6}}>FPS</span></div>
          </div>
          <div style={{position:"relative",borderRadius:10,overflow:"hidden",border:"1px solid var(--border-primary)",boxShadow:"var(--shadow-canvas)"}}>
            <div style={{position:"absolute",top:8,left:14,fontSize:9,color:"var(--text-faint)",zIndex:10,letterSpacing:3}}>INLET →</div>
            <div style={{position:"absolute",top:8,right:14,fontSize:9,color:"var(--text-faint)",zIndex:10,letterSpacing:3}}>→ OUTLET</div>
            <div style={{position:"absolute",bottom:8,left:14,fontSize:8,color:"var(--text-faint)",zIndex:10,letterSpacing:2,opacity:.5}}>f1stories.gr</div>
            <div style={{position:"absolute",top:8,left:"50%",transform:"translateX(-50%)",fontSize:8,color:"var(--text-faint)",zIndex:10,letterSpacing:2,opacity:.4,textTransform:"uppercase"}}>{viewMode} · LBM D2Q9 · {COLS}×{ROWS}</div>
            <canvas ref={canvasRef} width={SIM_W} height={SIM_H} style={{display:"block",width:"100%",height:"auto"}}/>
            <div style={{position:"absolute",bottom:12,right:16,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><span style={{fontSize:8,color:"var(--text-muted)",letterSpacing:1}}>HIGH</span><div style={{width:6,height:60,borderRadius:3,background:viewMode==="pressure"?"var(--colorbar-pressure)":"var(--colorbar-velocity)"}}/><span style={{fontSize:8,color:"var(--text-muted)",letterSpacing:1}}>LOW</span></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>{[{l:"Lift Coeff",v:stats.cl,s:"CL",c:"var(--accent-green)"},{l:"Drag Coeff",v:stats.cd,s:"CD",c:"var(--accent-orange)"},{l:"Reynolds",v:stats.re>999?(stats.re/1000).toFixed(1)+"k":stats.re,s:"Re",c:"var(--accent-purple)"},{l:"Peak Vel",v:stats.maxV,s:"U/U₀",c:"var(--accent-cyan)"},{l:"Regime",v:regime.label,s:`Re=${stats.re}`,c:regime.col},{l:"Particles",v:particleCount.toLocaleString(),s:`of ${MAX_PARTICLES}`,c:"var(--text-muted)"}].map(({l,v,s,c})=><div key={l} style={{background:"var(--bg-panel)",borderRadius:10,border:"1px solid var(--border-primary)",padding:"14px 16px",position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${c},transparent)`,opacity:.4}}/><div style={{fontSize:8,color:"var(--text-muted)",letterSpacing:2.5,marginBottom:8}}>{l.toUpperCase()}</div><div style={{fontSize:22,fontWeight:800,color:c,fontFamily:"'Outfit',sans-serif"}}>{v}</div><div style={{fontSize:9,color:"var(--text-dim)",marginTop:4}}>{s}</div></div>)}</div>
        </>}
        {activeView==="analysis"&&<AnalysisView stats={stats} regime={regime} hist={historySnap} miniRef={miniCanvasRef} running={running} exp={exportCSV}/>}
        {activeView==="about"&&<AboutView/>}
      </div>
    </div>
    <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}input[type=range]{-webkit-appearance:none;appearance:none;height:3px;background:var(--bg-input);border-radius:2px;outline:none}input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:currentColor;cursor:pointer;box-shadow:0 0 6px currentColor}button:hover{opacity:.88}*::-webkit-scrollbar{width:5px}*::-webkit-scrollbar-track{background:transparent}*::-webkit-scrollbar-thumb{background:var(--scrollbar-thumb);border-radius:3px}`}</style>
  </div>);
}

function SliderRow({l,v,min,max,step,set,u="",col="var(--accent-cyan)"}){return(<div style={{marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:9,color:"var(--text-muted)",letterSpacing:1.5}}>{l}</span><span style={{fontSize:10,fontFamily:"'JetBrains Mono',monospace",color:col,fontWeight:700}}>{v}{u}</span></div><div style={{position:"relative",height:3,background:"var(--bg-input)",borderRadius:2}}><div style={{position:"absolute",left:0,top:0,height:"100%",width:`${((v-min)/(max-min))*100}%`,background:col,borderRadius:2}}/><input type="range" min={min} max={max} step={step} value={v} onChange={e=>set(+e.target.value)} style={{position:"absolute",inset:0,opacity:0,width:"100%",cursor:"pointer",margin:0}}/></div></div>);}

function AnalysisView({stats,regime,hist,miniRef,running,exp}){const cRef=useRef(null);const{isDark}=useTheme();
  useEffect(()=>{const c=cRef.current;if(!c||hist.length<2)return;const ctx=c.getContext("2d"),w=c.width,h=c.height;ctx.clearRect(0,0,w,h);ctx.strokeStyle=isDark?"#0a1e34":"#c8d8e8";ctx.lineWidth=.5;for(let i=0;i<6;i++){const y=(i/5)*h;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}const draw=(d,col,mx)=>{if(d.length<2)return;const m=mx||Math.max(...d,.01);ctx.beginPath();ctx.strokeStyle=col;ctx.lineWidth=1.8;ctx.lineCap="round";d.forEach((v,i)=>{const x=(i/(d.length-1))*w,y=h-(v/m)*h*.85-h*.05;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});ctx.stroke();ctx.strokeStyle=col+"33";ctx.lineWidth=6;ctx.stroke();};const cl=hist.map(s=>s.cl),cd=hist.map(s=>s.cd),mx=Math.max(...cl,...cd,.1);draw(cl,isDark?"#00ff88":"#0a8a4a",mx);draw(cd,isDark?"#ffaa44":"#c07820",mx);},[hist,isDark]);
  return(<div style={{display:"flex",flexDirection:"column",gap:16}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><div><div style={{fontFamily:"'Outfit',sans-serif",fontSize:24,fontWeight:800,color:"var(--accent-cyan)",letterSpacing:2}}>Live Analysis</div><div style={{fontSize:8,color:"var(--text-faint)",letterSpacing:2,marginTop:2}}>AEROLAB by f1stories.gr · LBM D2Q9</div></div><button onClick={exp} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",fontSize:9,letterSpacing:1.5,fontFamily:"'JetBrains Mono',monospace",background:"var(--accent-cyan-glow)",border:"1px solid var(--accent-cyan)",color:"var(--accent-cyan)",borderRadius:6,cursor:"pointer"}}>⬇ CSV</button></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <div style={{background:"var(--bg-panel)",border:"1px solid var(--border-primary)",borderRadius:10,padding:16}}><div style={{fontSize:9,color:"var(--text-muted)",letterSpacing:3,marginBottom:14,fontWeight:600}}><IconChart/> COEFFICIENTS</div><canvas ref={cRef} width={500} height={200} style={{width:"100%",height:200,borderRadius:6,background:"var(--bg-canvas)"}}/><div style={{display:"flex",gap:20,marginTop:10}}><div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:12,height:3,background:"var(--accent-green)",borderRadius:2}}/><span style={{fontSize:9,color:"var(--text-muted)"}}>CL</span></div><div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:12,height:3,background:"var(--accent-orange)",borderRadius:2}}/><span style={{fontSize:9,color:"var(--text-muted)"}}>CD</span></div></div></div>
      <div style={{background:"var(--bg-panel)",border:"1px solid var(--border-primary)",borderRadius:10,padding:16}}><div style={{fontSize:9,color:"var(--text-muted)",letterSpacing:3,marginBottom:14,fontWeight:600}}><IconWind/> PREVIEW</div><canvas ref={miniRef} width={500} height={225} style={{width:"100%",height:200,borderRadius:6,background:"var(--bg-canvas)"}}/><div style={{marginTop:8,fontSize:9,color:running?"var(--accent-green)":"var(--accent-red)"}}>{running?"● Running":"○ Paused"}</div></div>
    </div>
  </div>);}

function AboutView(){const{isDark}=useTheme();return(<div style={{maxWidth:700,display:"flex",flexDirection:"column",gap:20}}>
  <div><div style={{fontFamily:"'Outfit',sans-serif",fontSize:32,fontWeight:900,background:isDark?"linear-gradient(90deg,#40e8ff,#a080ff)":"linear-gradient(90deg,#0a7ea4,#7050cc)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:2,marginBottom:8}}>AEROLAB</div><div style={{fontSize:11,color:"var(--text-muted)",letterSpacing:3,marginBottom:6}}>LATTICE BOLTZMANN CFD WIND TUNNEL</div><div style={{fontSize:10,color:"var(--text-dim)"}}>A project by <a href="https://f1stories.gr" target="_blank" rel="noopener noreferrer" style={{color:"var(--accent-cyan)",textDecoration:"none",fontWeight:600}}>f1stories.gr</a></div></div>
  <div style={{background:"var(--bg-panel)",border:"1px solid var(--border-primary)",borderRadius:10,padding:16}}><div style={{fontSize:9,color:"var(--text-muted)",letterSpacing:3,marginBottom:14,fontWeight:600}}><IconLayers/> OVERVIEW</div><p style={{fontSize:12,lineHeight:1.9,color:"var(--text-secondary)",margin:0}}>AeroLab uses a Lattice Boltzmann D2Q9 solver with BGK collision, Zou-He inlet BCs, and bounce-back walls on a {COLS}×{ROWS} grid ({(COLS*ROWS).toLocaleString()} cells). Particles trace pathlines via RK2 midpoint integration with bilinear velocity interpolation. Per-pixel bilinear heatmap rendering with Turbo and CoolWarm colormaps. Built by f1stories.gr.</p></div>
  <div style={{background:"var(--bg-panel)",border:"1px solid var(--border-primary)",borderRadius:10,padding:16}}><div style={{fontSize:9,color:"var(--text-muted)",letterSpacing:3,marginBottom:14,fontWeight:600}}><IconGear/> FEATURES</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{[{t:"LBM D2Q9",d:"Collide-stream with Float64 precision, omega-clamped stability"},{t:"4 View Modes",d:"Velocity, pressure, streamlines, vorticity"},{t:"RK2 Particles",d:"Midpoint integration + bilinear interpolation"},{t:"Zou-He BCs",d:"Proper inlet velocity, zero-gradient outlet"},{t:"Bilinear Heatmap",d:"Per-pixel smooth rendering, no cell edges"},{t:"Live Telemetry",d:"CL, CD, Re, regime, FPS, CSV export"}].map(({t,d})=><div key={t} style={{padding:"14px 16px",borderRadius:8,background:isDark?"rgba(10,30,52,.5)":"rgba(220,232,244,.5)",border:"1px solid var(--border-primary)"}}><div style={{fontSize:11,color:"var(--accent-cyan)",fontWeight:600,marginBottom:6}}>{t}</div><div style={{fontSize:10,color:"var(--text-muted)",lineHeight:1.7}}>{d}</div></div>)}</div></div>
  <div style={{textAlign:"center",padding:"24px 0 8px",borderTop:"1px solid var(--border-primary)"}}><a href="https://f1stories.gr" target="_blank" rel="noopener noreferrer" style={{fontFamily:"'Outfit',sans-serif",fontSize:14,fontWeight:700,color:"var(--accent-cyan)",textDecoration:"none",letterSpacing:2}}>f1stories.gr</a><div style={{fontSize:9,color:"var(--text-faint)",marginTop:6,letterSpacing:1.5}}>AERODYNAMICS • MOTORSPORT • ENGINEERING</div></div>
</div>);}
