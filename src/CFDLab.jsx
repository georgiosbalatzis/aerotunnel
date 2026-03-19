import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTheme } from "./ThemeContext";
import ThemeToggle from "./ThemeToggle";

/* AEROLAB — LBM D2Q9 CFD · f1stories.gr · Performance + Mobile build */

// ── Device-adaptive resolution ──
const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
const SIM_W = isMobile ? 600 : 1000;
const SIM_H = isMobile ? 270 : 450;
const COLS = isMobile ? 200 : 300;  // reduced from 400 — biggest perf win
const ROWS = isMobile ? 90 : 135;
const DEFAULT_PARTICLES = isMobile ? 200 : 400;
const MAX_PARTICLES = isMobile ? 800 : 2000;
const TRAIL_LEN = isMobile ? 50 : 80;

// ── Colormaps (256 ABGR) ──
function buildTurbo(){const l=new Uint32Array(256);for(let i=0;i<256;i++){const t=i/255,r=Math.max(0,Math.min(255,(34.61+t*(1172.33-t*(10793.56-t*(33300.12-t*(38394.49-t*14825.05)))))|0)),g=Math.max(0,Math.min(255,(23.31+t*(557.33+t*(1225.33-t*(3574.96-t*(1073.77+t*707.56)))))|0)),b=Math.max(0,Math.min(255,(27.2+t*(3211.1-t*(15327.97-t*(27814.0-t*(22569.18-t*6838.66)))))|0));l[i]=(255<<24)|(b<<16)|(g<<8)|r;}return l;}
function buildCW(){const l=new Uint32Array(256);for(let i=0;i<256;i++){const t=i/255;let r,g,b;if(t<.5){const s=t*2;r=(30+s*170)|0;g=(60+s*120)|0;b=(200-s*10)|0}else{const s=(t-.5)*2;r=(200+s*55)|0;g=(180-s*155)|0;b=(190-s*165)|0}l[i]=(255<<24)|(Math.min(255,Math.max(0,b))<<16)|(Math.min(255,Math.max(0,g))<<8)|Math.min(255,Math.max(0,r));}return l;}
const TURBO=buildTurbo(),COOLWARM=buildCW();

// ── Geometry ──
function pip(px,py,poly){let ins=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1];if(((yi>py)!==(yj>py))&&px<((xj-xi)*(py-yi))/(yj-yi)+xi)ins=!ins;}return ins;}
function normPoly(pts){if(!pts||pts.length<3)return null;const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),rx=x1-x0||1,ry=y1-y0||1;return pts.map(p=>[(p[0]-x0)/rx,(p[1]-y0)/ry]);}
function xformPoly(n,cx,cy,sx,sy,aoa){const r=aoa*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return n.map(([nx,ny])=>{const lx=(nx-.5)*sx,ly=(ny-.5)*sy;return[cx+c*lx-s*ly,cy+s*lx+c*ly];});}
function simplPoly(pts,tol){if(pts.length<=4)return pts;const r=[pts[0]];for(let i=1;i<pts.length-1;i++){const p=r[r.length-1],n=pts[i+1],c=pts[i],dx=n[0]-p[0],dy=n[1]-p[1],l=Math.sqrt(dx*dx+dy*dy)||1;if(Math.abs(dy*c[0]-dx*c[1]+n[0]*p[1]-n[1]*p[0])/l>tol)r.push(c);}r.push(pts[pts.length-1]);return r;}

function genPreset(type){const p=[];
  if(type==="airfoil"){for(let t=0;t<=Math.PI*2;t+=.04){const c=Math.cos(t),s=Math.sin(t);p.push([.5+.48*c*(.5+.5*c),.5+.18*s*(1+.3*c)]);}}
  else if(type==="cylinder"){for(let t=0;t<=Math.PI*2;t+=.05)p.push([.5+.45*Math.cos(t),.5+.45*Math.sin(t)]);}
  else if(type==="wedge"){p.push([.05,.25],[.95,.5],[.05,.75]);}
  else if(type==="bluff"){p.push([.1,.1],[.9,.1],[.9,.9],[.1,.9]);}
  else if(type==="f1car"){
    [[0,.58],[.01,.55],[.03,.49],[.05,.43],[.07,.40],[.09,.41],[.12,.39],[.15,.35],[.17,.33],[.20,.31],[.24,.29],[.28,.27],[.30,.25],[.32,.22],[.34,.21],[.36,.23],[.38,.24],[.40,.22],[.42,.23],[.44,.27],[.47,.25],[.50,.23],[.54,.22],[.58,.22],[.62,.23],[.66,.24],[.70,.26],[.74,.28],[.78,.30],[.80,.27],[.82,.22],[.84,.18],[.86,.17],[.88,.18],[.90,.20],[.92,.25],[.94,.32],[.96,.38],[.98,.42],[1,.46],
    [1,.50],[.98,.54],[.96,.58],[.94,.62],[.90,.65],[.86,.66],[.80,.66],[.70,.66],[.60,.66],[.50,.66],[.40,.66],[.30,.64],[.24,.64],[.18,.66],[.12,.67],[.08,.67],[.06,.64],[.04,.61],[.02,.59],[0,.58]].forEach(v=>p.push(v));}
  else if(type==="frontwing"){
    [[0,.55],[.04,.42],[.10,.33],[.18,.27],[.30,.24],[.45,.24],[.60,.27],[.75,.33],[.88,.44],[.95,.58],[1,.62],[1,.65],[.90,.66],[.75,.63],[.60,.62],[.45,.63],[.30,.65],[.15,.67],[.06,.63],[0,.57]].forEach(v=>p.push(v));}
  else if(type==="rearwing"){
    [[0,.50],[.06,.34],[.13,.24],[.25,.19],[.40,.18],[.55,.20],[.70,.25],[.85,.37],[.95,.52],[1,.54],[1,.58],[.92,.65],[.75,.68],[.55,.68],[.35,.68],[.20,.65],[.10,.60],[.04,.54],[0,.50]].forEach(v=>p.push(v));}
  return p;}

// Parsers
function parseSVG(svg,np=200){try{const doc=new DOMParser().parseFromString(svg,"image/svg+xml"),els=doc.querySelectorAll("path,polygon,polyline,rect,circle,ellipse");if(!els.length)return null;const all=[],ts=document.createElementNS("http://www.w3.org/2000/svg","svg");ts.style.cssText="position:absolute;visibility:hidden;width:0;height:0";document.body.appendChild(ts);els.forEach(el=>{const tag=el.tagName.toLowerCase();let pts=[];const pp=Math.max(20,Math.floor(np/els.length));if(tag==="polygon"||tag==="polyline"){const raw=(el.getAttribute("points")||"").trim().split(/[\s,]+/);for(let i=0;i<raw.length-1;i+=2){const x=parseFloat(raw[i]),y=parseFloat(raw[i+1]);if(!isNaN(x)&&!isNaN(y))pts.push([x,y]);}}else if(tag==="rect"){const x=+el.getAttribute("x")||0,y=+el.getAttribute("y")||0,w=+el.getAttribute("width"),h=+el.getAttribute("height");if(w&&h)pts=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];}else if(tag==="circle"||tag==="ellipse"){const cx=+(el.getAttribute("cx")||0),cy=+(el.getAttribute("cy")||0),rx=+(el.getAttribute("r")||el.getAttribute("rx")||50),ry=+(el.getAttribute("r")||el.getAttribute("ry")||rx);for(let i=0;i<=pp;i++){const t=(i/pp)*Math.PI*2;pts.push([cx+rx*Math.cos(t),cy+ry*Math.sin(t)]);}}else if(tag==="path"){const d=el.getAttribute("d");if(d){const pe=document.createElementNS("http://www.w3.org/2000/svg","path");pe.setAttribute("d",d);ts.appendChild(pe);try{const tl=pe.getTotalLength();for(let i=0;i<=pp;i++){const pt=pe.getPointAtLength((i/pp)*tl);pts.push([pt.x,pt.y]);}}catch{}pe.remove();}}if(pts.length>=3)all.push(...pts);});document.body.removeChild(ts);if(all.length<3)return null;const cx=all.reduce((s,p)=>s+p[0],0)/all.length,cy=all.reduce((s,p)=>s+p[1],0)/all.length;all.sort((a,b)=>Math.atan2(a[1]-cy,a[0]-cx)-Math.atan2(b[1]-cy,b[0]-cx));if(all.length>300){const st=Math.ceil(all.length/300);return normPoly(all.filter((_,i)=>i%st===0));}return normPoly(all);}catch{return null;}}
function parseDXF(t){const ls=t.split(/\r?\n/).map(l=>l.trim()),pts=[];let i=0,px=null;while(i<ls.length){const c=parseInt(ls[i],10);if(c===10&&i+1<ls.length){px=parseFloat(ls[i+1]);i+=2;}else if(c===20&&i+1<ls.length&&px!==null){const y=parseFloat(ls[i+1]);if(!isNaN(px)&&!isNaN(y))pts.push([px,y]);px=null;i+=2;}else i++;}return pts.length>2?normPoly(pts):null;}
function parseSTL(data){try{const text=typeof data==="string"?data:new TextDecoder().decode(data.slice(0,1000));const verts=[];if(text.trim().startsWith("solid")){const full=typeof data==="string"?data:new TextDecoder().decode(data);const re=/vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;let m;while((m=re.exec(full)))verts.push([parseFloat(m[1]),parseFloat(m[2]),parseFloat(m[3])]);}else{const dv=new DataView(data instanceof ArrayBuffer?data:data.buffer);const nt=dv.getUint32(80,true);for(let i=0;i<nt;i++){const o=84+i*50;for(let v=0;v<3;v++){const vo=o+12+v*12;verts.push([dv.getFloat32(vo,true),dv.getFloat32(vo+4,true),dv.getFloat32(vo+8,true)]);}}}if(verts.length<3)return null;const zs=verts.map(v=>v[2]),zMid=(Math.min(...zs)+Math.max(...zs))/2,tol=(Math.max(...zs)-Math.min(...zs))*.05||1;const pts2d=[];verts.forEach(([x,y,z])=>{if(Math.abs(z-zMid)<tol)pts2d.push([x,y]);});if(pts2d.length<5)verts.forEach(([x,y])=>pts2d.push([x,y]));const cx=pts2d.reduce((s,p)=>s+p[0],0)/pts2d.length,cy=pts2d.reduce((s,p)=>s+p[1],0)/pts2d.length;pts2d.sort((a,b)=>Math.atan2(a[1]-cy,a[0]-cx)-Math.atan2(b[1]-cy,b[0]-cx));if(pts2d.length>250){const st=Math.ceil(pts2d.length/250);return normPoly(pts2d.filter((_,i)=>i%st===0));}return normPoly(pts2d);}catch{return null;}}
function traceImg(id,w,h,np=100){const d=id.data,edges=[];for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=(y*w+x)*4,br=d[i]*.3+d[i+1]*.59+d[i+2]*.11;if(br<128){const nb=[(y-1)*w+(x-1),(y-1)*w+x,(y-1)*w+(x+1),y*w+(x-1),y*w+(x+1),(y+1)*w+(x-1),(y+1)*w+x,(y+1)*w+(x+1)];if(nb.some(n=>(d[n*4]*.3+d[n*4+1]*.59+d[n*4+2]*.11)>=128))edges.push([x,y]);}}if(edges.length<5)return null;const cx=edges.reduce((s,p)=>s+p[0],0)/edges.length,cy=edges.reduce((s,p)=>s+p[1],0)/edges.length;edges.sort((a,b)=>Math.atan2(a[1]-cy,a[0]-cx)-Math.atan2(b[1]-cy,b[0]-cx));const st=Math.max(1,Math.floor(edges.length/np));return normPoly(edges.filter((_,i)=>i%st===0));}

// ═══ LBM D2Q9 — Float32, optimized inner loops ═══
const CX=[0,1,0,-1,0,1,-1,-1,1],CY=[0,0,1,0,-1,1,1,-1,-1];
const WT=[4/9,1/9,1/9,1/9,1/9,1/36,1/36,1/36,1/36],OPP=[0,3,4,1,2,7,8,5,6];

class LBM {
  constructor(c,r){
    this.C=c;this.R=r;this.N=c*r;
    // Float32 — 2× faster than Float64, sufficient precision for LBM
    this.f0=new Float32Array(9*this.N);this.f1=new Float32Array(9*this.N);
    this.rho=new Float32Array(this.N);this.ux=new Float32Array(this.N);this.uy=new Float32Array(this.N);
    this.solid=new Uint8Array(this.N);this.spd=new Float32Array(this.N);this.curl=new Float32Array(this.N);
    this.omega=1.85;this._init(.12);
  }
  _init(u0){for(let k=0;k<this.N;k++){this.rho[k]=1;this.ux[k]=u0;this.uy[k]=0;const b=k*9,usq=u0*u0;for(let d=0;d<9;d++){const cu=CX[d]*u0;this.f0[b+d]=WT[d]*(1+3*cu+4.5*cu*cu-1.5*usq);}}}
  setNu(nu){this.omega=Math.min(1.95,Math.max(.5,1/(3*nu+.5)));}
  buildSolid(poly){this.solid.fill(0);if(!poly)return;const{C,R}=this;for(let j=0;j<R;j++)for(let i=0;i<C;i++)if(pip(i+.5,j+.5,poly))this.solid[j*C+i]=1;}

  step(inU,turb){
    const{C,R,N,f0,f1,rho,ux,uy,solid,omega}=this;
    // STREAM (pull)
    for(let j=0;j<R;j++){for(let i=0;i<C;i++){const k=j*C+i,dst=k*9;for(let d=0;d<9;d++){const si=i-CX[d],sj=j-CY[d];f1[dst+d]=(si>=0&&si<C&&sj>=0&&sj<R)?f0[(sj*C+si)*9+d]:f0[k*9+OPP[d]];}}}
    // BOUNCE-BACK solid
    for(let k=0;k<N;k++){if(!solid[k])continue;const b=k*9;const t1=f1[b+1],t2=f1[b+2],t3=f1[b+3],t4=f1[b+4],t5=f1[b+5],t6=f1[b+6],t7=f1[b+7],t8=f1[b+8];f1[b+1]=t3;f1[b+3]=t1;f1[b+2]=t4;f1[b+4]=t2;f1[b+5]=t7;f1[b+7]=t5;f1[b+6]=t8;f1[b+8]=t6;}
    // MACROSCOPIC
    for(let k=0;k<N;k++){if(solid[k]){ux[k]=0;uy[k]=0;rho[k]=1;this.spd[k]=0;continue;}const b=k*9;let r=0,vx=0,vy=0;for(let d=0;d<9;d++){const fv=f1[b+d];r+=fv;vx+=CX[d]*fv;vy+=CY[d]*fv;}if(r<.01)r=1;rho[k]=r;ux[k]=vx/r;uy[k]=vy/r;this.spd[k]=Math.sqrt(vx*vx+vy*vy)/r;}
    // INLET (Zou-He)
    const ps=turb*.004;
    for(let j=1;j<R-1;j++){const k=j*C,b=k*9,v0=(Math.random()-.5)*ps;const ri=(f1[b]+f1[b+2]+f1[b+4]+2*(f1[b+3]+f1[b+6]+f1[b+7]))/(1-inU);f1[b+1]=f1[b+3]+(2/3)*ri*inU;f1[b+5]=f1[b+7]+(1/6)*ri*inU+.5*ri*v0-.5*(f1[b+2]-f1[b+4]);f1[b+8]=f1[b+6]+(1/6)*ri*inU-.5*ri*v0+.5*(f1[b+2]-f1[b+4]);rho[k]=ri;ux[k]=inU;uy[k]=v0;}
    // OUTLET
    for(let j=1;j<R-1;j++){const ke=j*C+(C-1),kp=ke-1,be=ke*9,bp=kp*9;for(let d=0;d<9;d++)f1[be+d]=f1[bp+d];rho[ke]=rho[kp];ux[ke]=ux[kp];uy[ke]=uy[kp];this.spd[ke]=this.spd[kp];}
    // TOP/BOTTOM walls
    for(let i=0;i<C;i++){const kt=i,bt=kt*9;f1[bt+4]=f1[bt+2];f1[bt+7]=f1[bt+5];f1[bt+8]=f1[bt+6];ux[kt]=0;uy[kt]=0;const kb=(R-1)*C+i,bb=kb*9;f1[bb+2]=f1[bb+4];f1[bb+5]=f1[bb+7];f1[bb+6]=f1[bb+8];ux[kb]=0;uy[kb]=0;}
    // COLLIDE (BGK) → f0
    for(let k=0;k<N;k++){const b=k*9;if(solid[k]){for(let d=0;d<9;d++)f0[b+d]=f1[b+d];continue;}const r=rho[k],vx=ux[k],vy=uy[k],usq=vx*vx+vy*vy;for(let d=0;d<9;d++){const cu=CX[d]*vx+CY[d]*vy;f0[b+d]=f1[b+d]+omega*(WT[d]*r*(1+3*cu+4.5*cu*cu-1.5*usq)-f1[b+d]);}}
    // CURL
    for(let j=1;j<R-1;j++)for(let i=1;i<C-1;i++){const k=j*C+i;this.curl[k]=(uy[k+1]-uy[k-1])*.5-(ux[k+C]-ux[k-C])*.5;}
  }
}

// ── Particles ──
class Particle{
  constructor(laneY){this.x=0;this.y=0;this.age=0;this.tx=new Float32Array(TRAIL_LEN);this.ty=new Float32Array(TRAIL_LEN);this.tl=0;this.ti=0;this.active=true;this.laneY=laneY||0;this.reset();}
  reset(){this.x=Math.random()*2;this.y=this.laneY>0?this.laneY+(Math.random()-.5)*2:2+Math.random()*(ROWS-4);this.age=0;this.tl=0;this.ti=0;}
  static v(s,x,y){const i0=Math.max(0,Math.min(COLS-2,x|0)),j0=Math.max(0,Math.min(ROWS-2,y|0)),tx=x-i0,ty=y-j0,k00=j0*COLS+i0,k10=k00+1,k01=k00+COLS,k11=k01+1;if(s.solid[k00]||s.solid[k10]||s.solid[k01]||s.solid[k11])return[0,0];return[(1-tx)*(1-ty)*s.ux[k00]+tx*(1-ty)*s.ux[k10]+(1-tx)*ty*s.ux[k01]+tx*ty*s.ux[k11],(1-tx)*(1-ty)*s.uy[k00]+tx*(1-ty)*s.uy[k10]+(1-tx)*ty*s.uy[k01]+tx*ty*s.uy[k11]];}
  update(s){if(!this.active)return;if(this.x<0||this.x>=COLS-1||this.y<1||this.y>=ROWS-1){this.reset();return;}if(s.solid[(this.y|0)*COLS+(this.x|0)]){this.reset();return;}const idx=this.ti%TRAIL_LEN;this.tx[idx]=this.x*(SIM_W/COLS);this.ty[idx]=this.y*(SIM_H/ROWS);this.ti++;if(this.tl<TRAIL_LEN)this.tl++;const[a,b]=Particle.v(s,this.x,this.y),[c,d]=Particle.v(s,this.x+a*.5,this.y+b*.5);this.x+=c;this.y+=d;this.age+=.016;if(this.x>=COLS-2||this.x<0||this.y<1||this.y>=ROWS-1)this.reset();}
}
function mkPool(){const pool=[];const nL=Math.min(MAX_PARTICLES,50);for(let i=0;i<MAX_PARTICLES;i++){const p=new Particle(3+((i%nL)/nL)*(ROWS-6));p.active=i<DEFAULT_PARTICLES;pool.push(p);}return pool;}
function resPool(pool,n){const t=Math.min(n,MAX_PARTICLES);for(let i=0;i<pool.length;i++){if(i<t){if(!pool[i].active){pool[i].active=true;pool[i].reset();}}else pool[i].active=false;}}

// Icons
const IconPlay=()=><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>;
const IconPause=()=><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>;
const IconReset=()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.17"/></svg>;
const IconUpload=()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const IconWind=()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17.7 7.7A2.5 2.5 0 1 1 19 12H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>;
const IconChart=()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>;
const IconGear=()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>;
const IconLayers=()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>;

function useHist(ml=100){const r=useRef([]);const p=useCallback(e=>{r.current.push({...e,t:Date.now()});if(r.current.length>ml)r.current.shift();},[ml]);return[r,p];}

// ═══ MAIN ═══
export default function CFDLab(){
  const{isDark}=useTheme();
  const[view,setView]=useState("tunnel"),[sideOpen,setSideOpen]=useState(!isMobile),[mobilePanel,setMobilePanel]=useState(null);
  const solverRef=useRef(null),partsRef=useRef(mkPool());
  const canvasRef=useRef(null),drawRef=useRef(null),miniRef=useRef(null),rafRef=useRef(null),frameRef=useRef(0),imgRef=useRef(null);
  const drawingRef=useRef(false),dptsRef=useRef([]);
  const[tab,setTab]=useState("preset"),[running,setRunning]=useState(false),[vm,setVm]=useState("velocity");
  const[poly,setPoly]=useState(()=>genPreset("f1car")),[preset,setPreset]=useState("f1car");
  const[shapeOk,setShapeOk]=useState(true),[err,setErr]=useState(""),[simplify,setSimplify]=useState(0);
  const[stats,setStats]=useState({cl:0,cd:0,re:0,maxV:0}),[dFrame,setDFrame]=useState(0);
  const[pCount,setPCount]=useState(DEFAULT_PARTICLES),[tOpacity,setTOpacity]=useState(1),[simSpd,setSimSpd]=useState(1),[fps,setFps]=useState(0);
  const fpsF=useRef(0),fpsT=useRef(performance.now());
  const[cx,setCx]=useState(COLS*.35),[cy,setCy]=useState(ROWS/2),[sx,setSx]=useState(COLS*.25),[sy,setSy]=useState(ROWS*.45),[aoa,setAoa]=useState(0);
  const[vel,setVel]=useState(.12),[turb,setTurb]=useState(.15),[nu,setNu]=useState(.015);
  const[hRef,pushH]=useHist(200),[hSnap,setHSnap]=useState([]);
  // Refs
  const rR=useRef(false),vmR=useRef("velocity"),pR=useRef(null),cxR=useRef(0),cyR=useRef(0),sxR=useRef(0),syR=useRef(0),aoR=useRef(0),siR=useRef(0),vR=useRef(.12),tR=useRef(.15),nR=useRef(.015),thR=useRef(true),pcR=useRef(DEFAULT_PARTICLES),toR=useRef(1),ssR=useRef(1);

  useEffect(()=>{if(!solverRef.current){const s=new LBM(COLS,ROWS);s.setNu(.015);solverRef.current=s;}},[]);
  useEffect(()=>{thR.current=isDark},[isDark]);useEffect(()=>{rR.current=running},[running]);useEffect(()=>{vmR.current=vm},[vm]);
  useEffect(()=>{vR.current=vel},[vel]);useEffect(()=>{tR.current=turb},[turb]);useEffect(()=>{nR.current=nu;if(solverRef.current)solverRef.current.setNu(nu)},[nu]);
  useEffect(()=>{pcR.current=pCount;resPool(partsRef.current,pCount)},[pCount]);useEffect(()=>{toR.current=tOpacity},[tOpacity]);useEffect(()=>{ssR.current=simSpd},[simSpd]);

  const rebuild=useCallback(()=>{const raw=pR.current;if(!raw||!solverRef.current)return;const s=siR.current>0?simplPoly(raw,siR.current*.005):raw;solverRef.current.buildSolid(xformPoly(s,cxR.current,cyR.current,sxR.current,syR.current,aoR.current));},[]);
  useEffect(()=>{aoR.current=aoa;cxR.current=cx;cyR.current=cy;sxR.current=sx;syR.current=sy;rebuild()},[aoa,cx,cy,sx,sy,rebuild]);
  useEffect(()=>{pR.current=poly;siR.current=simplify;rebuild()},[poly,simplify,rebuild]);

  useEffect(()=>{const h=e=>{if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA")return;switch(e.code){case"Space":e.preventDefault();setRunning(r=>!r);break;case"KeyR":{const s=new LBM(COLS,ROWS);s.setNu(nR.current);solverRef.current=s;rebuild();}break;case"Digit1":setVm("velocity");break;case"Digit2":setVm("pressure");break;case"Digit3":setVm("streamlines");break;case"Digit4":setVm("vorticity");break;}};window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h)},[rebuild]);

  // ── RENDER LOOP ──
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext("2d");imgRef.current=ctx.createImageData(SIM_W,SIM_H);
    const DX=SIM_W/COLS,DY=SIM_H/ROWS;
    const loop=()=>{
      rafRef.current=requestAnimationFrame(loop);
      const solver=solverRef.current;if(!solver)return;
      const inV=vR.current;
      if(rR.current){const steps=ssR.current;for(let s=0;s<steps;s++)solver.step(inV,tR.current);}
      frameRef.current++;fpsF.current++;const now=performance.now();if(now-fpsT.current>=1000){setFps(fpsF.current);fpsF.current=0;fpsT.current=now;}
      const dark=thR.current,vmode=vmR.current,img=imgRef.current,buf32=new Uint32Array(img.data.buffer);
      const solidC=dark?((255<<24)|(80<<16)|(65<<8)|45):((255<<24)|(195<<16)|(178<<8)|155);
      const bgC=dark?((255<<24)|(18<<16)|(10<<8)|3):((255<<24)|(244<<16)|(238<<8)|230);

      if(vmode==="streamlines"){
        buf32.fill(bgC);
        for(let k=0;k<solver.N;k++)if(solver.solid[k]){const i=k%COLS,j=(k/COLS)|0,x0=(i*DX)|0,y0=(j*DY)|0,x1=Math.min(((i+1)*DX)|0,SIM_W),y1=Math.min(((j+1)*DY)|0,SIM_H);for(let py=y0;py<y1;py++)for(let px=x0;px<x1;px++)buf32[py*SIM_W+px]=solidC;}
      } else {
        // Optimized: nearest-neighbor with field lookup (skip bilinear for speed)
        const lut=vmode==="pressure"?COOLWARM:TURBO;
        const field=vmode==="velocity"?solver.spd:vmode==="pressure"?solver.rho:solver.curl;
        let fMin=1e9,fMax=-1e9;
        for(let k=0;k<solver.N;k++){if(solver.solid[k])continue;const v=field[k];if(v<fMin)fMin=v;if(v>fMax)fMax=v;}
        const fR=fMax-fMin;
        if(fR<1e-10){buf32.fill(lut[128]);}else{
          const invR=255/fR,invDX=COLS/SIM_W,invDY=ROWS/SIM_H;
          for(let py=0;py<SIM_H;py++){
            const j=Math.min(ROWS-1,(py*invDY)|0),ro=py*SIM_W;
            for(let px=0;px<SIM_W;px++){
              const i=Math.min(COLS-1,(px*invDX)|0),k=j*COLS+i;
              if(solver.solid[k]){buf32[ro+px]=solidC;}
              else{buf32[ro+px]=lut[Math.max(0,Math.min(255,((field[k]-fMin)*invR)|0))];}
            }
          }
        }
      }
      ctx.putImageData(img,0,0);

      // Particles — batched drawing (single path per opacity band)
      const parts=partsRef.current,pC=pcR.current,tO=toR.current;
      for(let pi=0;pi<pC&&pi<parts.length;pi++)parts[pi].update(solver);
      if((vmode==="streamlines"||vmode==="velocity"||vmode==="vorticity")&&tO>0){
        ctx.lineCap="round";ctx.lineJoin="round";
        const isStr=vmode==="streamlines";
        // Batch: draw all trails at 3 opacity levels
        const alphas=isStr?[.2,.5,.85]:[.1,.25,.4];
        const widths=isStr?[.5,.8,1.2]:[.3,.5,.6];
        const colors=isStr?(dark?["rgba(100,200,240,","rgba(140,225,255,","rgba(200,245,255,"]:["rgba(10,60,140,","rgba(10,80,160,","rgba(30,100,180,"]):
          (dark?["rgba(255,255,255,","rgba(255,255,255,","rgba(255,255,255,"]:["rgba(0,0,0,","rgba(0,0,0,","rgba(0,0,0,"]);
        for(let band=0;band<3;band++){
          const a=alphas[band]*tO;
          ctx.strokeStyle=colors[band]+a+")";ctx.lineWidth=widths[band];
          ctx.beginPath();
          const segStart=band===0?0:band===1?Math.floor(TRAIL_LEN*.33):Math.floor(TRAIL_LEN*.66);
          const segEnd=band===0?Math.floor(TRAIL_LEN*.33):band===1?Math.floor(TRAIL_LEN*.66):TRAIL_LEN;
          for(let pi=0;pi<pC&&pi<parts.length;pi++){
            const p=parts[pi];if(!p.active||p.tl<3)continue;
            const st=p.ti-p.tl;
            const from=st+Math.floor(segStart*p.tl/TRAIL_LEN);
            const to=st+Math.floor(segEnd*p.tl/TRAIL_LEN);
            let started=false;
            for(let ti=from;ti<to&&ti<p.ti;ti++){
              const idx=((ti%TRAIL_LEN)+TRAIL_LEN)%TRAIL_LEN;
              if(!started){ctx.moveTo(p.tx[idx],p.ty[idx]);started=true;}
              else ctx.lineTo(p.tx[idx],p.ty[idx]);
            }
          }
          ctx.stroke();
        }
      }
      // Outline
      const raw=pR.current;if(raw){const s=siR.current>0?simplPoly(raw,siR.current*.005):raw;const tp=xformPoly(s,cxR.current,cyR.current,sxR.current,syR.current,aoR.current);const oc=dark?"#40e8ff":"#0a7ea4";ctx.beginPath();tp.forEach(([gx,gy],i)=>{const px=gx*DX,py=gy*DY;i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);});ctx.closePath();ctx.strokeStyle=oc;ctx.lineWidth=1.2;ctx.shadowColor=oc;ctx.shadowBlur=dark?6:3;ctx.stroke();ctx.shadowBlur=0;}
      // Stats
      if(rR.current&&frameRef.current%15===0){let mV=0,tFy=0,tFx=0,cnt=0;for(let k=0;k<solver.N;k++){if(solver.solid[k])continue;const sp=solver.spd[k];if(!isFinite(sp))continue;cnt++;if(sp>mV)mV=sp;tFy+=solver.uy[k];tFx+=Math.abs(solver.ux[k]-inV);}const re=(inV*sxR.current)/(nR.current+1e-6)*10;const cl=cnt>0?Math.abs(tFy/cnt*2*(1+aoR.current*.06)):0;const cd=cnt>0?tFx/cnt*.5+.008:0;setStats({cl:+cl.toFixed(4),cd:+cd.toFixed(4),re:Math.round(re),maxV:inV>0?+(mV/inV).toFixed(3):0});pushH({cl:+cl.toFixed(4),cd:+cd.toFixed(4),re:Math.round(re),maxV:inV>0?+(mV/inV).toFixed(3):0});}
      if(frameRef.current%30===0)setDFrame(frameRef.current);
      const mc=miniRef.current;if(mc)mc.getContext("2d").drawImage(canvas,0,0,mc.width,mc.height);
    };rafRef.current=requestAnimationFrame(loop);return()=>cancelAnimationFrame(rafRef.current);
  },[pushH]);

  // Handlers
  const hSVG=e=>{const f=e.target.files[0];if(!f)return;setErr("");setShapeOk(false);const r=new FileReader();r.onload=ev=>{const p=parseSVG(ev.target.result);if(!p){setErr("Could not parse SVG.");setShapeOk(true);return;}setPoly(p);setShapeOk(true);};r.readAsText(f);};
  const hDXF=e=>{const f=e.target.files[0];if(!f)return;setErr("");setShapeOk(false);const r=new FileReader();r.onload=ev=>{const p=parseDXF(ev.target.result);if(!p){setErr("Could not parse DXF.");setShapeOk(true);return;}setPoly(p);setShapeOk(true);};r.readAsText(f);};
  const hSTL=e=>{const f=e.target.files[0];if(!f)return;setErr("");setShapeOk(false);const r=new FileReader();r.onload=ev=>{const p=parseSTL(ev.target.result);if(!p){setErr("Could not parse STL.");setShapeOk(true);return;}setPoly(p);setShapeOk(true);};r.readAsArrayBuffer(f);};
  const hImg=e=>{const f=e.target.files[0];if(!f)return;setErr("");setShapeOk(false);const u=URL.createObjectURL(f);const img=new Image();img.onload=()=>{const c=document.createElement("canvas"),W=Math.min(img.width,200),H=Math.min(img.height,200);c.width=W;c.height=H;c.getContext("2d").drawImage(img,0,0,W,H);const p=traceImg(c.getContext("2d").getImageData(0,0,W,H),W,H);URL.revokeObjectURL(u);if(!p){setErr("Could not trace.");setShapeOk(true);return;}setPoly(p);setShapeOk(true);};img.src=u;};
  const hDrop=useCallback(e=>{e.preventDefault();const file=e.dataTransfer?.files?.[0];if(!file)return;setErr("");setShapeOk(false);const n=file.name.toLowerCase();if(n.endsWith(".svg")){const r=new FileReader();r.onload=ev=>{const p=parseSVG(ev.target.result);if(!p){setErr("SVG parse failed.");setShapeOk(true);return;}setPoly(p);setShapeOk(true);};r.readAsText(file);}else if(n.endsWith(".stl")){const r=new FileReader();r.onload=ev=>{const p=parseSTL(ev.target.result);if(!p){setErr("STL parse failed.");setShapeOk(true);return;}setPoly(p);setShapeOk(true);};r.readAsArrayBuffer(file);}else if(n.endsWith(".dxf")){const r=new FileReader();r.onload=ev=>{const p=parseDXF(ev.target.result);if(!p){setErr("DXF parse failed.");setShapeOk(true);return;}setPoly(p);setShapeOk(true);};r.readAsText(file);}else if(file.type?.startsWith("image/")){const u=URL.createObjectURL(file);const img=new Image();img.onload=()=>{const c=document.createElement("canvas"),W=Math.min(img.width,200),H=Math.min(img.height,200);c.width=W;c.height=H;c.getContext("2d").drawImage(img,0,0,W,H);const p=traceImg(c.getContext("2d").getImageData(0,0,W,H),W,H);URL.revokeObjectURL(u);if(!p){setErr("Trace failed.");setShapeOk(true);return;}setPoly(p);setShapeOk(true);};img.src=u;}else{setErr("Unsupported format. Use SVG, STL, DXF, PNG, JPG.");setShapeOk(true);}},[]);
  const getDP=e=>{const dc=drawRef.current,r=dc.getBoundingClientRect(),cx=e.touches?e.touches[0].clientX:e.clientX,cy=e.touches?e.touches[0].clientY:e.clientY;return[(cx-r.left)*(dc.width/r.width),(cy-r.top)*(dc.height/r.height)];};
  const startDraw=e=>{e.preventDefault();drawingRef.current=true;drawRef.current.getContext("2d").clearRect(0,0,drawRef.current.width,drawRef.current.height);dptsRef.current=[getDP(e)];};
  const moveDraw=e=>{e.preventDefault();if(!drawingRef.current)return;const[x,y]=getDP(e);dptsRef.current.push([x,y]);const c=drawRef.current.getContext("2d");c.strokeStyle=isDark?"#40e8ff":"#0a7ea4";c.lineWidth=2;c.lineCap="round";const pts=dptsRef.current;if(pts.length>1){c.beginPath();c.moveTo(pts[pts.length-2][0],pts[pts.length-2][1]);c.lineTo(x,y);c.stroke();}};
  const endDraw=()=>{drawingRef.current=false;const pts=dptsRef.current;if(pts.length<5)return;const p=normPoly(pts);if(p){setPoly(p);setErr("");setShapeOk(true);}};

  const regime=useMemo(()=>{if(stats.re<2300)return{label:"Laminar",col:"var(--accent-green)"};if(stats.re<4000)return{label:"Trans.",col:"var(--accent-orange)"};return{label:"Turbulent",col:"var(--accent-red-stat)"};},[stats.re]);
  useEffect(()=>{const iv=setInterval(()=>setHSnap([...hRef.current]),500);return()=>clearInterval(iv);},[hRef]);
  const exportCSV=useCallback(()=>{const d=hRef.current;if(!d.length)return;const b=new Blob(["t,cl,cd,re,maxV\n"+d.map(r=>`${r.t},${r.cl},${r.cd},${r.re},${r.maxV}`).join("\n")],{type:"text/csv"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`aerolab-${Date.now()}.csv`;a.click();URL.revokeObjectURL(u);},[hRef]);
  const resetAll=useCallback(()=>{setRunning(false);setVel(.12);setTurb(.15);setNu(.015);setCx(COLS*.35);setCy(ROWS/2);setSx(COLS*.25);setSy(ROWS*.45);setAoa(0);setSimplify(0);setPCount(DEFAULT_PARTICLES);setTOpacity(1);setSimSpd(1);setPreset("f1car");setPoly(genPreset("f1car"));const s=new LBM(COLS,ROWS);s.setNu(.015);solverRef.current=s;},[]);

  // ── Slider ──
  const Sl=({l,v,min,max,step,set,u="",col="var(--accent-cyan)"})=>(
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
        <span style={{fontSize:9,color:"var(--text-muted)",letterSpacing:1}}>{l}</span>
        <span style={{fontSize:10,color:col,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{v}{u}</span>
      </div>
      <div style={{position:"relative",height:3,background:"var(--bg-input)",borderRadius:2}}>
        <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${((v-min)/(max-min))*100}%`,background:col,borderRadius:2}}/>
        <input type="range" min={min} max={max} step={step} value={v} onChange={e=>set(+e.target.value)} style={{position:"absolute",inset:0,opacity:0,width:"100%",cursor:"pointer",margin:0}}/>
      </div>
    </div>
  );

  const P={bg:"var(--bg-panel)",border:"1px solid var(--border-primary)",borderRadius:10,padding:isMobile?12:16,transition:"background .4s"};
  const SH={fontSize:9,color:"var(--text-muted)",letterSpacing:3,textTransform:"uppercase",marginBottom:12,display:"flex",alignItems:"center",gap:8,fontWeight:600};
  const Btn=a=>({padding:"7px 12px",fontSize:9,letterSpacing:1.5,fontFamily:"'JetBrains Mono',monospace",background:a?"var(--accent-cyan-glow)":"transparent",border:`1px solid ${a?"var(--accent-cyan)":"var(--border-primary)"}`,color:a?"var(--accent-cyan)":"var(--text-dim)",borderRadius:6,cursor:"pointer"});
  const TBtn=a=>({padding:"5px 8px",fontSize:8,letterSpacing:1,fontFamily:"'JetBrains Mono',monospace",background:a?"var(--accent-cyan-glow)":"transparent",border:`1px solid ${a?"var(--border-accent)":"var(--border-primary)"}`,color:a?"var(--accent-cyan)":"var(--text-dim)",borderRadius:5,cursor:"pointer"});
  const FB={display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"var(--accent-cyan-glow)",border:"1px dashed var(--border-accent)",borderRadius:8,cursor:"pointer",color:"var(--text-muted)",fontSize:10,letterSpacing:1.5,justifyContent:"center",width:"100%"};

  // ── Sidebar content (shared between desktop sidebar and mobile bottom sheet) ──
  const sidebarContent=(
    <div style={{padding:isMobile?12:16,display:"flex",flexDirection:"column",gap:10,overflowY:"auto",flex:1}}>
      <div style={P} onDrop={hDrop} onDragOver={e=>e.preventDefault()}>
        <div style={SH}><IconGear/> Import</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:10}}>{["preset","svg","stl","dxf","draw","image"].map(id=><button key={id} onClick={()=>{setTab(id);setErr("")}} style={TBtn(tab===id)}>{id.toUpperCase()}</button>)}</div>
        {tab==="preset"&&<div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>{["airfoil","cylinder","wedge","bluff"].map(p=><button key={p} onClick={()=>{setPreset(p);setPoly(genPreset(p))}} style={Btn(preset===p)}>{p}</button>)}</div><div style={{fontSize:8,color:"var(--accent-cyan)",letterSpacing:2,marginTop:8,fontWeight:600}}>⬡ F1STORIES.GR</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,marginTop:4}}>{[["f1car","F1 Car"],["frontwing","F.Wing"],["rearwing","R.Wing"]].map(([id,l])=><button key={id} onClick={()=>{setPreset(id);setPoly(genPreset(id))}} style={Btn(preset===id)}>{l}</button>)}</div></div>}
        {tab==="svg"&&<label style={FB}><IconUpload/> .svg<input type="file" accept=".svg" style={{display:"none"}} onChange={hSVG}/></label>}
        {tab==="stl"&&<label style={FB}><IconUpload/> .stl<input type="file" accept=".stl" style={{display:"none"}} onChange={hSTL}/></label>}
        {tab==="dxf"&&<label style={FB}><IconUpload/> .dxf<input type="file" accept=".dxf" style={{display:"none"}} onChange={hDXF}/></label>}
        {tab==="draw"&&<canvas ref={drawRef} width={208} height={120} style={{background:"var(--bg-canvas)",border:"1px solid var(--border-subtle)",borderRadius:6,cursor:"crosshair",display:"block",width:"100%",touchAction:"none"}} onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={endDraw} onMouseLeave={endDraw} onTouchStart={startDraw} onTouchMove={moveDraw} onTouchEnd={endDraw}/>}
        {tab==="image"&&<label style={FB}><IconUpload/> PNG/JPG<input type="file" accept="image/*" style={{display:"none"}} onChange={hImg}/></label>}
        <div style={{marginTop:6,padding:"8px",border:"1px dashed var(--border-subtle)",borderRadius:6,textAlign:"center",fontSize:7,color:"var(--text-faint)",letterSpacing:1}}>DROP FILE HERE</div>
        {err&&<div style={{marginTop:6,fontSize:9,color:"var(--accent-red-stat)",background:"var(--accent-red-glow)",borderRadius:6,padding:"6px 10px"}}>{err}</div>}
      </div>
      <div style={P}><div style={SH}><IconLayers/> Transform</div>
        <Sl l="Pos X" v={cx.toFixed(0)} min={10} max={COLS-10} step={1} set={setCx} col="var(--accent-cyan)"/>
        <Sl l="Pos Y" v={cy.toFixed(0)} min={4} max={ROWS-4} step={1} set={setCy} col="var(--accent-cyan)"/>
        <Sl l="Scale X" v={sx.toFixed(0)} min={10} max={COLS*.5} step={1} set={setSx} col="var(--accent-purple)"/>
        <Sl l="Scale Y" v={sy.toFixed(0)} min={5} max={ROWS*.7} step={1} set={setSy} col="var(--accent-purple)"/>
        <Sl l="AoA" v={aoa} min={-25} max={35} step={1} set={setAoa} u="°" col="var(--accent-green)"/>
      </div>
      <div style={P}><div style={SH}><IconWind/> Flow</div>
        <Sl l="Velocity" v={vel.toFixed(3)} min={.02} max={.18} step={.005} set={setVel} u=" U" col="var(--accent-cyan)"/>
        <Sl l="Turbulence" v={turb.toFixed(1)} min={0} max={3} step={.1} set={setTurb} col="var(--accent-orange)"/>
        <Sl l="Viscosity ν" v={nu.toFixed(3)} min={.005} max={.1} step={.001} set={setNu} col="var(--accent-purple)"/>
      </div>
      <div style={P}><div style={SH}><IconWind/> Particles</div>
        <Sl l="Count" v={pCount} min={0} max={MAX_PARTICLES} step={10} set={setPCount} col="var(--accent-cyan)"/>
        <Sl l="Opacity" v={tOpacity.toFixed(2)} min={0} max={1} step={.05} set={setTOpacity} col="var(--accent-purple)"/>
        <Sl l={`Speed (${simSpd}×)`} v={simSpd} min={1} max={8} step={1} set={setSimSpd} u="×" col="var(--accent-orange)"/>
      </div>
      <div style={{textAlign:"center",padding:"8px 0"}}><a href="https://f1stories.gr" target="_blank" rel="noopener noreferrer" style={{fontSize:10,fontWeight:700,color:"var(--accent-cyan)",textDecoration:"none",letterSpacing:2,fontFamily:"'Outfit',sans-serif"}}>f1stories.gr</a><div style={{fontSize:7,color:"var(--text-faint)",marginTop:3,letterSpacing:1.5}}>AEROLAB · LBM D2Q9 · {COLS}×{ROWS}</div></div>
    </div>
  );

  return(<div style={{background:"var(--bg-root)",minHeight:"100vh",fontFamily:"'JetBrains Mono','SF Mono',monospace",color:"var(--text-primary)",display:"flex",flexDirection:"column"}}>
    {/* TOPBAR */}
    <div style={{display:"flex",alignItems:"center",gap:isMobile?8:16,padding:isMobile?"10px 12px":"14px 24px",background:"var(--bg-topbar)",borderBottom:"1px solid var(--border-primary)",position:"sticky",top:0,zIndex:100,backdropFilter:"var(--topbar-blur)"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:isMobile?28:36,height:isMobile?28:36,borderRadius:8,background:isDark?"linear-gradient(135deg,#0a2a4a,#0d3a60)":"linear-gradient(135deg,#dce8f4,#c8d8ec)",border:"1px solid var(--border-accent)",display:"flex",alignItems:"center",justifyContent:"center"}}><IconWind/></div>
        <div><div style={{fontFamily:"'Outfit',sans-serif",fontSize:isMobile?14:18,fontWeight:800,background:isDark?"linear-gradient(90deg,#40e8ff,#80f0ff)":"linear-gradient(90deg,#0a6e94,#0a9ec4)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:2}}>AEROLAB</div>{!isMobile&&<div style={{fontSize:8,color:"var(--text-faint)",letterSpacing:3,marginTop:-2}}>BY <a href="https://f1stories.gr" target="_blank" rel="noopener noreferrer" style={{color:"var(--text-faint)",textDecoration:"none"}}>F1STORIES.GR</a></div>}</div>
      </div>
      {!isMobile&&<div style={{display:"flex",gap:4,marginLeft:24}}>{[{id:"tunnel",l:"Wind Tunnel",ic:<IconWind/>},{id:"analysis",l:"Analysis",ic:<IconChart/>},{id:"about",l:"About",ic:<IconLayers/>}].map(({id,l,ic})=><button key={id} onClick={()=>setView(id)} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 16px",fontSize:10,letterSpacing:1.5,fontFamily:"inherit",fontWeight:view===id?600:400,background:view===id?"var(--accent-cyan-glow)":"transparent",border:`1px solid ${view===id?"var(--border-accent)":"transparent"}`,color:view===id?"var(--accent-cyan)":"var(--text-muted)",borderRadius:8,cursor:"pointer"}}>{ic}{l}</button>)}</div>}
      <div style={{flex:1}}/>
      <ThemeToggle/>
      <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:16,background:running?"var(--accent-green-glow)":"var(--accent-red-glow)"}}>
        <div style={{width:6,height:6,borderRadius:"50%",background:running?"var(--accent-green)":"var(--accent-red)",animation:running?"pulse 1.5s infinite":"none"}}/>
        <span style={{fontSize:8,letterSpacing:2,color:running?"var(--accent-green)":"var(--accent-red)"}}>{running?"LIVE":"IDLE"}</span>
      </div>
      <div style={{fontSize:8,color:"var(--text-faint)"}}>{fps}fps</div>
    </div>

    {/* MAIN */}
    <div style={{display:"flex",flex:1,overflow:"hidden",flexDirection:isMobile?"column":"row"}}>
      {/* Desktop sidebar */}
      {!isMobile&&view==="tunnel"&&<div style={{width:sideOpen?256:0,minWidth:sideOpen?256:0,transition:"all .3s",overflow:"hidden",borderRight:"1px solid var(--border-primary)",background:isDark?"rgba(3,10,20,.6)":"rgba(245,248,252,.8)",display:"flex",flexDirection:"column"}}>{sidebarContent}</div>}

      <div style={{flex:1,display:"flex",flexDirection:"column",padding:isMobile?10:20,gap:isMobile?8:14,overflowY:"auto"}}>
        {view==="tunnel"&&<>
          {/* Controls */}
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            {!isMobile&&<button onClick={()=>setSideOpen(v=>!v)} style={{...Btn(false),padding:"7px 10px",fontSize:10}}>☰</button>}
            <div style={{display:"flex",gap:3,background:isDark?"rgba(4,14,26,.7)":"rgba(255,255,255,.7)",borderRadius:8,padding:2,border:"1px solid var(--border-primary)"}}>
              {["velocity","pressure","streamlines","vorticity"].map(m=><button key={m} onClick={()=>setVm(m)} style={{padding:isMobile?"5px 8px":"7px 14px",fontSize:isMobile?8:9,letterSpacing:1,fontFamily:"inherit",background:vm===m?"var(--accent-cyan-glow)":"transparent",border:"none",color:vm===m?"var(--accent-cyan)":"var(--text-dim)",borderRadius:6,cursor:"pointer",fontWeight:vm===m?600:400}}>{isMobile?m.slice(0,3).toUpperCase():m.toUpperCase()}</button>)}
            </div>
            <div style={{flex:1}}/>
            <button onClick={()=>setRunning(r=>!r)} style={{display:"flex",alignItems:"center",gap:5,padding:isMobile?"6px 14px":"8px 20px",fontSize:10,letterSpacing:1.5,fontFamily:"inherit",background:running?"var(--accent-red-glow)":"var(--accent-green-glow)",border:`1px solid ${running?"var(--accent-red)":"var(--accent-green)"}`,color:running?"var(--accent-red)":"var(--accent-green)",borderRadius:8,cursor:"pointer",fontWeight:600}}>{running?<><IconPause/> {isMobile?"":"PAUSE"}</>:<><IconPlay/> {isMobile?"":"RUN"}</>}</button>
            <button onClick={()=>{const s=new LBM(COLS,ROWS);s.setNu(nR.current);solverRef.current=s;rebuild()}} style={{...Btn(false),padding:"7px 12px"}}><IconReset/></button>
            {!isMobile&&<><button onClick={resetAll} style={{...Btn(false),padding:"7px 10px",fontSize:8}}>↺</button><button onClick={exportCSV} style={{...Btn(false),padding:"7px 10px",fontSize:8}}>⬇</button></>}
          </div>
          {/* Canvas */}
          <div style={{position:"relative",borderRadius:10,overflow:"hidden",border:"1px solid var(--border-primary)",boxShadow:"var(--shadow-canvas)"}}>
            <div style={{position:"absolute",top:6,left:10,fontSize:8,color:"var(--text-faint)",zIndex:10,letterSpacing:2,opacity:.6}}>INLET →</div>
            <div style={{position:"absolute",top:6,right:10,fontSize:8,color:"var(--text-faint)",zIndex:10,letterSpacing:2,opacity:.6}}>→ OUT</div>
            <div style={{position:"absolute",bottom:6,left:10,fontSize:7,color:"var(--text-faint)",zIndex:10,letterSpacing:2,opacity:.4}}>f1stories.gr</div>
            {!isMobile&&<div style={{position:"absolute",top:6,left:"50%",transform:"translateX(-50%)",fontSize:7,color:"var(--text-faint)",zIndex:10,letterSpacing:2,opacity:.3,textTransform:"uppercase"}}>{vm} · LBM · {COLS}×{ROWS}</div>}
            <canvas ref={canvasRef} width={SIM_W} height={SIM_H} style={{display:"block",width:"100%",height:"auto"}}/>
          </div>
          {/* Stats */}
          <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(3,1fr)":"repeat(auto-fit,minmax(130px,1fr))",gap:isMobile?6:10}}>
            {[{l:"CL",v:stats.cl,c:"var(--accent-green)"},{l:"CD",v:stats.cd,c:"var(--accent-orange)"},{l:"Re",v:stats.re>999?(stats.re/1000).toFixed(1)+"k":stats.re,c:"var(--accent-purple)"},{l:"U/U₀",v:stats.maxV,c:"var(--accent-cyan)"},{l:"Regime",v:regime.label,c:regime.col},{l:"Particles",v:pCount,c:"var(--text-muted)"}].map(({l,v,c})=><div key={l} style={{background:"var(--bg-panel)",borderRadius:8,border:"1px solid var(--border-primary)",padding:isMobile?"8px 10px":"12px 14px",position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${c},transparent)`,opacity:.4}}/><div style={{fontSize:7,color:"var(--text-muted)",letterSpacing:2,marginBottom:4}}>{l}</div><div style={{fontSize:isMobile?16:20,fontWeight:800,color:c,fontFamily:"'Outfit',sans-serif"}}>{v}</div></div>)}
          </div>
        </>}
        {view==="analysis"&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><div><div style={{fontFamily:"'Outfit',sans-serif",fontSize:isMobile?18:24,fontWeight:800,color:"var(--accent-cyan)",letterSpacing:2}}>Analysis</div><div style={{fontSize:8,color:"var(--text-faint)",letterSpacing:2}}>f1stories.gr · LBM D2Q9</div></div><button onClick={exportCSV} style={{padding:"6px 12px",fontSize:9,background:"var(--accent-cyan-glow)",border:"1px solid var(--accent-cyan)",color:"var(--accent-cyan)",borderRadius:6,cursor:"pointer",fontFamily:"inherit"}}>⬇ CSV</button></div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14}}>
            <div style={P}><div style={SH}><IconChart/> Coefficients</div><AnalysisChart hist={hSnap}/></div>
            <div style={P}><div style={SH}><IconWind/> Preview</div><canvas ref={miniRef} width={400} height={180} style={{width:"100%",height:isMobile?120:180,borderRadius:6,background:"var(--bg-canvas)"}}/><div style={{marginTop:6,fontSize:9,color:running?"var(--accent-green)":"var(--accent-red)"}}>{running?"● Running":"○ Paused"}</div></div>
          </div>
        </div>}
        {view==="about"&&<div style={{maxWidth:700,display:"flex",flexDirection:"column",gap:16}}>
          <div><div style={{fontFamily:"'Outfit',sans-serif",fontSize:isMobile?24:32,fontWeight:900,background:isDark?"linear-gradient(90deg,#40e8ff,#a080ff)":"linear-gradient(90deg,#0a7ea4,#7050cc)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:2}}>AEROLAB</div><div style={{fontSize:10,color:"var(--text-dim)"}}>LBM D2Q9 CFD · <a href="https://f1stories.gr" target="_blank" rel="noopener noreferrer" style={{color:"var(--accent-cyan)",textDecoration:"none",fontWeight:600}}>f1stories.gr</a></div></div>
          <div style={P}><p style={{fontSize:12,lineHeight:1.9,color:"var(--text-secondary)",margin:0}}>Real-time Lattice Boltzmann wind tunnel with {COLS}×{ROWS} grid, Float32 solver, Zou-He BCs, bounce-back walls. Import SVG, STL, DXF, or use built-in F1 profiles. RK2 particle tracer with bilinear interpolation.</p></div>
          <div style={{textAlign:"center",padding:"20px 0 8px",borderTop:"1px solid var(--border-primary)"}}><a href="https://f1stories.gr" target="_blank" rel="noopener noreferrer" style={{fontFamily:"'Outfit',sans-serif",fontSize:14,fontWeight:700,color:"var(--accent-cyan)",textDecoration:"none",letterSpacing:2}}>f1stories.gr</a><div style={{fontSize:9,color:"var(--text-faint)",marginTop:4,letterSpacing:1.5}}>AERODYNAMICS • MOTORSPORT • ENGINEERING</div></div>
        </div>}
      </div>
    </div>

    {/* MOBILE BOTTOM NAV */}
    {isMobile&&<div style={{display:"flex",borderTop:"1px solid var(--border-primary)",background:"var(--bg-topbar)",padding:"6px 0",position:"sticky",bottom:0,zIndex:100}}>
      {[{id:"tunnel",l:"Tunnel",ic:<IconWind/>},{id:"analysis",l:"Analysis",ic:<IconChart/>},{id:"settings",l:"Settings",ic:<IconGear/>},{id:"about",l:"About",ic:<IconLayers/>}].map(({id,l,ic})=>
        <button key={id} onClick={()=>{if(id==="settings")setMobilePanel(mobilePanel?"":id);else{setView(id==="settings"?"tunnel":id);setMobilePanel(null);}}} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"4px 0",background:"none",border:"none",color:(view===id||(id==="settings"&&mobilePanel))?"var(--accent-cyan)":"var(--text-muted)",cursor:"pointer",fontSize:8,letterSpacing:1,fontFamily:"inherit"}}>{ic}{l}</button>
      )}
    </div>}

    {/* MOBILE SETTINGS SHEET */}
    {isMobile&&mobilePanel&&<div style={{position:"fixed",bottom:44,left:0,right:0,maxHeight:"60vh",overflowY:"auto",background:"var(--bg-panel)",borderTop:"1px solid var(--border-primary)",borderRadius:"16px 16px 0 0",zIndex:200,boxShadow:"0 -4px 30px rgba(0,0,0,.3)"}}>
      <div style={{textAlign:"center",padding:"8px 0"}}><div style={{width:32,height:3,borderRadius:2,background:"var(--text-faint)",margin:"0 auto",opacity:.4}}/></div>
      {sidebarContent}
    </div>}

    <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}input[type=range]{-webkit-appearance:none;appearance:none;height:3px;background:var(--bg-input);border-radius:2px;outline:none}input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:currentColor;cursor:pointer}button:hover{opacity:.88}*::-webkit-scrollbar{width:4px}*::-webkit-scrollbar-track{background:transparent}*::-webkit-scrollbar-thumb{background:var(--scrollbar-thumb);border-radius:2px}`}</style>
  </div>);
}

function AnalysisChart({hist}){const ref=useRef(null);const{isDark}=useTheme();
  useEffect(()=>{const c=ref.current;if(!c||hist.length<2)return;const ctx=c.getContext("2d"),w=c.width,h=c.height;ctx.clearRect(0,0,w,h);ctx.strokeStyle=isDark?"#0a1e34":"#c8d8e8";ctx.lineWidth=.5;for(let i=0;i<6;i++){const y=(i/5)*h;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}const draw=(d,col,mx)=>{if(d.length<2)return;const m=mx||Math.max(...d,.01);ctx.beginPath();ctx.strokeStyle=col;ctx.lineWidth=1.8;ctx.lineCap="round";d.forEach((v,i)=>{const x=(i/(d.length-1))*w,y=h-(v/m)*h*.85-h*.05;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});ctx.stroke();};const cl=hist.map(s=>s.cl),cd=hist.map(s=>s.cd),mx=Math.max(...cl,...cd,.1);draw(cl,isDark?"#00ff88":"#0a8a4a",mx);draw(cd,isDark?"#ffaa44":"#c07820",mx);},[hist,isDark]);
  return<canvas ref={ref} width={400} height={160} style={{width:"100%",height:isMobile?100:160,borderRadius:6,background:"var(--bg-canvas)"}}/>;
}
