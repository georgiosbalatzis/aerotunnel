import BrandWordmark from "./BrandWordmark.jsx";
import { COLS, ROWS } from "../engine/constants.js";

export default function AboutPanel() {
  return (
    <div className="about-view">
      <div className="about-hero">
        <div>
          <h2 className="about-title"><BrandWordmark /></h2>
          <p className="about-descriptor">Aerodynamics &amp; Flow Simulation</p>
          <div className="about-tags">
            <span className="about-tag">LBM D2Q9</span>
            <span className="about-tag">Float32 Solver</span>
            <span className="about-tag">{COLS}×{ROWS} Grid</span>
            <span className="about-tag">Three.js 3D</span>
            <span className="about-tag">F1 STORIES</span>
          </div>
        </div>
        <div>
          <p className="about-body">
            AEROTUNNEL is an <strong>in-browser Lattice Boltzmann CFD wind tunnel</strong> built for Formula 1 aerodynamics education.
            It runs on a D2Q9 lattice with BGK collision, bounce-back solid walls, and Zou-He inlet boundary conditions.
            <br/><br/>
            The <strong>3D view</strong> renders the selected contour as a centered extrusion using Three.js. Its potential-flow paths and surface coloring are qualitative illustrations, independent of the 2D LBM field. An optional car reference is illustrative.
            <br/><br/>
            Import any <strong>SVG, STL, or DXF</strong> from your CAD toolchain, or hand-sketch a profile directly in the garage pad.
          </p>
          <p className="about-body" style={{ marginTop: "var(--space-md)" }}>
            Optional 3D car reference by Abu Saif, licensed under CC BY 4.0.{' '}
            <a href={`${import.meta.env.BASE_URL}licenses/README.txt`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-readable)" }}>Asset credits and licenses</a>.
          </p>
        </div>
      </div>
      <div className="about-features">
        {[
          {t:"D2Q9 Solver", b:"Float32 BGK with optimized streaming and inlet perturbations for qualitative 2D flow exploration. No calibrated turbulence closure."},
          {t:"Seven Views", b:"Velocity, density-based Pressure, particle pathlines, signed Vorticity, Vectors, Schlieren and a qualitative 3D view."},
          {t:"CAD Import", b:"Load SVG, STL, or DXF files from any toolchain. Also supports PNG/JPG edge trace and a freehand sketch pad."},
          {t:"Live Telemetry", b:"Heuristic CL/CD and L/D proxies with a scaled lattice Re* estimate. These are educational indicators, not validated force coefficients. CSV retains historical field names."},
          {t:"RK2 Particles", b:"Bilinear velocity interpolation with RK2 midpoint integration. Up to 2000 active streamline traces in 3-band batched rendering."},
          {t:"F1 Profiles", b:"Built-in F1 car silhouette, front wing, and rear wing cross-sections. Adjust angle of attack, position, and scale in real time."},
        ].map(f => (
          <div className="feature-card" key={f.t}>
            <h3>{f.t}</h3>
            <p>{f.b}</p>
          </div>
        ))}
      </div>
      <div className="a-panel">
        <h3 className="a-panel__title" style={{marginBottom:12}}>How to use</h3>
        <ol className="method-list">
          <li>Select a preset profile or import geometry in Geometry</li>
          <li>Adjust position, angle of attack, and scale under Transform geometry</li>
          <li>Tune inlet velocity, turbulence, and viscosity for the session conditions</li>
          <li>Switch between all seven visualization modes above the field</li>
          <li>Monitor heuristic CL/CD proxies; export CSV for post-session analysis</li>
        </ol>
      </div>
    </div>
  );
}
