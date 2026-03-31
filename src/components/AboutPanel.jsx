import { COLS, ROWS } from "../engine/constants.js";

export default function AboutPanel() {
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
          {t:"D2Q9 Solver", b:"Float32 BGK with optimized streaming. Captures vortex shedding, wake turbulence, and boundary layer separation."},
          {t:"4 + 3D Modes", b:"Velocity heatmap, pressure distribution, particle streamlines, vorticity field — plus a full 3D extruded view with orbit controls."},
          {t:"CAD Import", b:"Load SVG, STL, or DXF files from any toolchain. Also supports PNG/JPG edge trace and a freehand sketch pad."},
          {t:"Live Telemetry", b:"CL, CD, L/D ratio, Reynolds number, and flow regime estimated in real time. Full CSV export for further analysis."},
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
