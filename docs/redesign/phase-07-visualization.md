# Phase 07 — Scientific visualization art direction

Completed 2026-10-17 from the completed, uncommitted Phase 06 workspace. Phase 07 only; no commit, push, deployment or PR.

## Result

The scientific viewport now has a quiet state strip, readable mode controls and field-specific legends below the image. Legends no longer cover the geometry. The seven existing modes remain: Velocity, Pressure, Streamlines, Vorticity, Vectors, Schlieren and 3D View. Native buttons expose selected state; arrows/Home/End reveal and focus modes, Enter/Space activate, and the existing 1–7 shortcuts remain available. Narrow mode bars scroll without abbreviating labels.

The plot retains its independent dark scientific surface in both themes. Ordinary UI retains F1 Stories theme surfaces, including in 3D; an inherited forced-black 3D shell was overriding the light theme and has been neutralized. Flow direction, body angle, 2D solver state and convergence remain visible at mobile widths. Existing solver and geometry warnings remain exposed.

The 3D view now defaults to a faithful, centered extrusion of the selected contour. Its camera stays still until operated; Reset view, Front, Above, zoom, optional Auto orbit, keyboard controls and existing drag/wheel/pinch gestures are available. The full-car asset remains an explicit **Car reference** option for F1 Car, with an illustrative label. It can no longer replace Front Wing or Rear Wing geometry.

## Independent investigations and review

Three registered read-only agents investigated concurrently before implementation. The lead made all edits.

| Registered agent | Actual configuration | Findings integrated |
| --- | --- | --- |
| `design_auditor` | GPT-6 Luna / high, fixed role | Audited JS/Rust solver, README, field mappings and 3D approximations. Identified density-as-pressure, mismatched palettes, stale ranges, unsupported coefficient claims, scaled Re and 3D geometry/AoA distortion. |
| `code_mapper` | GPT-6 Luna / high | Mapped backing raster/lattice sizes, fixed rendering lifecycle, particle/vector colors, independent comparison normalization, CSS containment, 3D caching, camera and resource dependencies. |
| `regression_reviewer` | GPT-6.1 Sol / high, fixed role | Designed the benchmark and browser matrix; reviewed completed source and evidence. Identified exact-coordinate cache collisions, reference-flow cache invalidation, failed/pending resource retry and partial initialization cleanup. |

The registered roles fix the first agent to Luna/high and the reviewer to Sol/high, rather than the requested Sol/high and Sol/medium configurations for those tasks. All three returned file-specific findings. No agent edited files.

The final reviewer closed with no remaining actionable findings. One Impeccable scan returned zero findings across ten scanned Phase 07 source/test files. The later one-line shell-background fix was separately reviewed and verified with computed styles/contrast; the completed detector was not repeatedly rerun.

## Scientific quantities and units audit

Primary sources are local implementation: `src/engine/solver.js`, `solver-wrapper.js`, `solver-wasm/src/lib.rs`, `lut.js`, `particles.js`, `geometry.js`, the rendering branches in `src/CFDLab.jsx`, and the independent illustration in `src/components/View3D.jsx`. README explanations were corrected where they contradicted these sources.

| View / output | Actual represented quantity | Units and normalization | Presentation decision |
| --- | --- | --- | --- |
| Velocity | `sqrt(ux² + uy²)` from LBM | Cells per solver step; cached min/max automatic scaling | Turbo legend derived from the exact 256 LUT entries |
| Pressure | Raw `rho = Σf_i` | Lattice density; min/max automatic scaling | **Density ρ**, “Pressure proxy · raw density, not Pa”; actual CoolWarm legend |
| Relative pressure | Not currently rendered | Lattice EOS is `p = rho/3`; no subtraction of reference pressure or validated SI conversion exists | No claim to display Pa, Cp or relative pressure |
| Streamlines | RK2 particle pathlines through the time-dependent 2D velocity field | Fixed cyan/green/white age bands, not scalar speed colors | Age-band key and explanation; no fabricated numeric velocity bar |
| Vorticity | Signed `∂uy/∂x − ∂ux/∂y`, central differences | `1/step` with unit lattice spacing/time; min/max automatic scaling | Retains Turbo and signed ticks. Explicitly notes that zero has no fixed color; no new diverging normalization introduced |
| Vectors | Velocity components; background colors encode speed | Cells/step; arrow length is capped, arrows and background use different colors | Separate arrow-color and 30%-brightness Turbo bars sharing the displayed range |
| Schlieren | Vertical density derivative `abs(rho[j+1] − rho[j−1])/2`, not full gradient magnitude | Lattice density/cell; contrast divided by the frame maximum | Light-to-dark sepia legend, zero→maximum ticks, explicit per-frame normalization |
| 3D View | Separate coarse Laplace/SOR potential-flow paths and illustrative surface coloring | Qualitative; extrusion depth is illustrative, surface colors are not solver pressure | Explicit qualitative description; no stale LBM numeric scale |
| CL/CD and L/D | Existing bulk-velocity heuristics, not integrated forces | Educational proxies; no dynamic-pressure/reference-area force normalization | Public labels and About/Analysis/README describe proxies; numerical formulas and historical keys unchanged |
| Re* / legacy regime | `(inlet × sx)/(nu + 1e-6) × 10`; thresholds 2300/4000 | Scaled lattice estimate; not validated geometry-dependent transition criteria | Re* in live indicators; Analysis labels the old classification as a heuristic threshold tag |
| Exported `maxV` | `max(speed)/inlet` in recorded statistics | Dimensionless ratio, despite historical field name | Export format unchanged; do not interpret as m/s |
| Turbulence factor | Random transverse inlet perturbation `(random−.5) × turb × .004` | Dimensionless amplitude, not a calibrated turbulence closure | Existing control retained; helper text makes the limitation explicit |
| Δu | RMS change of the velocity vector between solver steps | Cells/step; an iterative-change indicator, not an accuracy guarantee | Readable state-strip value with an accurate explanatory title |

CL remains `abs(mean(uy) × 2 × (1 + aoa × .06))`; CD remains `mean(abs(ux−inlet)) × .5 + .008`, over fluid cells. Their ratio remains unchanged. Neither is a validated aerodynamic coefficient. Export columns such as `cl`, `cd`, `re`, `ld_ratio` and `regime` remain compatible.

## Legends and comparison

The previous single decorative Jet gradient was wrong for Pressure, Schlieren and several non-scalar modes. The new legend uses exact Turbo/CoolWarm LUT stops, the existing vector arrow equation, the actual dimmed vector background, and the existing sepia endpoints. Fixed scientific colors remain independent of brand red and UI theme.

Range publication now follows the active rendered field even while paused. It updates on a mode/comparison-field change and at the existing 15-frame cadence, without the old 5% suppression threshold. No new animation loop or field scan was added. Numeric labels retain enough significant digits to distinguish neighboring Float32 density values. Uniform comparison fields show a flat color and uniform value; existing initial scalar fallback scales are identified.

A/B comparisons retain their original independently normalized fields and split image. Each side has its own field name, units, palette and limits. **Normalized Δ** retains the original red tint calculated from `|normalized(A) − normalized(B)|`; the UI explicitly states that this is dimensionless and is not a physical subtraction or error estimate. Base scales describe the underlying fields before tinting. Comparison controls disable in Streamlines/Vectors and wait in 3D, while retaining the selected fields for a compatible scalar view.

The only 2D sampling correction is the Schlieren lower boundary: the central-difference lookup now clamps to the last valid interior row, matching the existing top-edge strategy. Previously it read past the density array and painted an undefined/black edge. The interior derivative, maximum calculation, palette and solver arrays are unchanged.

## Geometry, layout and 3D fidelity

- The 2D backing raster remains **1000×450** / **640×320** and the lattice remains **300×135** / **208×104**, chosen at initial load as before. No engine resolution, particle/trail count or solver parameter changed.
- Investigation and pixel measurements confirmed the existing `object-fit: contain` keeps the actual 2D image undistorted even when its CSS box has a different ratio. It was retained. Cylinder solid-pixel bounds in displayed screenshots differed from the same backing raster’s aspect ratio by only **0.08–0.28%** after changes, attributable to pixel rounding. Baseline measurements were also below 0.2%; no unsupported claim of a prior 2D stretching defect is made.
- The former 3D mapping independently normalized axes, clamped thickness and reversed the screen-space AoA sense. The new mapping uses the same simplified contour and `xformPoly` as the 2D solid, followed by one uniform world scale and a Y-up conversion. Positive/negative angles and all four tested geometries are covered by unit tests. Translation is intentionally centered for scene inspection; depth is illustrative.
- Extrusion bevels are disabled to preserve the contour rather than rounding its silhouette. Exact coordinate/transform/simplification cache keys replace three-decimal rounding. The qualitative flow cache also responds to reference-model availability.
- Background decoration and the reference grid are subdued. The 2D boundary uses one crisp cyan stroke instead of a halo. All field/particle/arrow colors and interpretation remain independent of UI branding.
- Default camera/profile drift was removed. Auto orbit is explicit. Pointer interaction cancels a pending camera transition. Camera interpolation now uses the actual frame delta; Above accurately names an elevated perspective rather than claiming an orthographic top view.
- The 3D ResizeObserver still updates renderer size and camera projection. Pointer capture, wheel/pinch gestures, capture timing, fullscreen and off-view cleanup remain functional.
- Missing Three.js resources expose a return-to-2D action. Failed or abandoned loader tags are removed so reentry can retry. Partially initialized renderers are disposed. Failed car-reference loading keeps the simulated contour visible. Late model responses after unmount are disposed.

At 375×812, active plot heights in the final selected-mode layout pass are about **222–269px**, depending on legend content. A 320×640 phone uses a vertically scrollable workspace rather than compressing the plot; horizontal overflow is absent. Short landscape behaves similarly. Comparison legends take additional height in exchange for readable independent scales; the plot remains accessible.

## Numerical-preservation checklist

- [x] Engine JS/Rust/WASM, constants, parsers, LUTs, particle implementation and exporters unchanged from the Phase 06 working-tree snapshot.
- [x] Solver stepping, divergence/overflow handling, field-array mapping, vector/particle rendering calculations and CL/CD/Re formulas compared against required source markers.
- [x] Parameter synchronization, WASM swap, session restore/save, export and action callback block unchanged.
- [x] Existing `aerolab-session`, `aerolab-sessions`, `f1stories-theme`, session version and JSON marker preserved.
- [x] Actual paused `ux`, `uy`, `rho`, `spd`, `curl` and `solid` arrays unchanged through all mode/camera/view operations; canvas, solver, particle pool, polygon and page identities retained where applicable.
- [x] Before/after **SHA-256 matches for all six arrays after 30 controlled solver steps**, both JS and WASM, both initial grid sizes. Test contexts use Cylinder, inlet .12, disturbance 0 and RNG reset seed 12345 immediately before stepping. Seeding avoids random signed-zero differences at the inlet; it is confined to the temporary test harness and restored afterward.
- [x] Actual 3D renderers stop rendering and are disposed when Analysis/About replaces the scene; only one primary WebGL canvas exists on return.

## Browser and automated verification

Evidence: [phase-07-verification.json](phase-07-verification.json). Performance raw data: [phase-07-performance.json](phase-07-performance.json).

| Check | Execution and result |
| --- | --- |
| All views / geometry | **112 checks**: seven modes × F1 Car/Front Wing/Rear Wing/Cylinder × light/dark × fresh 375/1440 contexts; selected state, legends, visible scene, actual arrays and identities pass |
| Legend values | Paused limits checked against actual solver extrema; Schlieren maximum independently recomputed from density; vector dual scales and pathline/3D nonnumeric descriptions pass |
| Keyboard | Mode arrows/Home/End and native activation; retained digit shortcuts from prior control contract; 3D arrows/zoom/Home and focus indication pass |
| Comparison | Four theme/width cases; A/B fields, two scales, normalized tint, suspension/resumption in unsupported views pass |
| Camera | Reset/Front/Above/zoom, static default, explicit Auto orbit, mouse drag/wheel, actual mobile CDP pinch pass |
| Resize / fullscreen | 320/375/568 landscape/768/1024/1440; DPR 1/2; camera aspect and renderer backing sizes match actual client dimensions; initial grid remains intact |
| Captures | Real 2D PNG downloads; decoded 3D PNGs contain nonblank scene pixels; both fullscreen cases pass |
| Resources / fallback | Failed-CDN retry, exit while load pending then retry, injected second-renderer failure cleanup, missing GLB fallback, JS backend with WASM blocked pass |
| Important warning | An actual self-crossing sketch exposes the existing self-intersection warning; warning screenshot retained |
| Theme / contrast | Final 3D shell background checked in both themes at 375/1440. UI primary contrast 13.47/14.23:1; secondary 5.45/8.85:1. Plot legend primary 16.42:1, secondary/scene controls 10.82:1 on their fixed dark surface |
| Browser exceptions | Zero unexpected page exceptions in completed runs; intentionally blocked-resource/network failures are expected test inputs |
| Build | `npm run build` **passes**, 52 modules, no warnings; baseline passed |
| Lint | `npm run lint`: **15 existing errors, zero warnings**, baseline 17. No new normalized file/rule/message diagnostics. Moving the mode touch handler removed an unused catch binding and empty-block diagnostic |
| Existing/new tests | `node --test tests/*.test.mjs`: **22/22 pass** (7 visualization tests plus 15 earlier tests) |
| Whitespace / review | `git diff --check` passes; final independent review has no outstanding findings |

Browser work used dedicated headless Chromium/CDP and an already-installed Playwright package against production builds. No package, dependency, application test hook or new public route was added. Browser harnesses are temporary; results are retained in the linked artifacts. A test that initially expected an imported crossed SVG to warn was corrected to use an actual sketch: the unchanged legacy SVG parser sorts points around the centroid. No application failure was inferred from that harness assumption.

## Measured performance

The completed Phase 06 working tree, rather than old Git HEAD, was copied and served as the baseline. One application page was active at a time. Fresh 1440×900 and 375×812 contexts used DPR 1, light theme, the WASM backend, Cylinder, inlet .12, viscosity .015, disturbance 0, original particle defaults and one step/frame. Each sample waited for the renderer/fonts, warmed for 60 frames, and measured 180 frame intervals. Three sequential before/after pairs covered Velocity, Streamlines and 3D at each width; comparison plus tint had one pair per width: **40 samples** total.

| Width / workload | Frame mean before / after | Task time before, median [range] ms | Task time after, median [range] ms | Median change |
| --- | --- | --- | --- | --- |
| 1440 Velocity | 16.666 / 16.666ms | 980.8 [932.6–1004.6] | 945.5 [902.5–1013.4] | −3.6% |
| 1440 Streamlines | 16.666 / 16.666ms | 868.4 [856.4–900.0] | 889.3 [885.2–938.8] | +2.4% |
| 1440 3D | 16.666 / 16.666ms | 954.4 [941.9–1008.8] | 963.6 [955.1–963.8] | +1.0% |
| 1440 comparison | 16.666 / 16.666ms | 1095.1 [one sample] | 1073.0 [one sample] | −2.0% |
| 375 Velocity | 16.666 / 16.666ms | 846.3 [793.6–878.1] | 787.4 [660.3–826.6] | −7.0% |
| 375 Streamlines | 16.666 / 16.666ms | 638.9 [576.5–671.1] | 665.3 [634.3–669.0] | +4.1% |
| 375 3D | 16.666 / 16.666ms | 932.1 [928.4–939.6] | 905.3 [893.4–905.5] | −2.9% |
| 375 comparison | 16.666 / 16.666ms | 985.7 [one sample] | 1018.9 [one sample] | +3.4% |

Task time is the CDP main-thread `TaskDuration` delta over roughly three seconds, not milliseconds per frame. Script/layout/style deltas and actual primary 3D renderer cadence are retained in the raw artifact. App FPS is the main CFDLab loop and was not used as proof of 3D cadence. Every sample had **zero intervals over 25ms**; maximum P95 was 16.8ms before and approximately 16.67ms after.

No frame-cadence regression was observed. Both builds are refresh-limited; CPU medians vary in both directions and most repeated ranges overlap. The +2.4%/+4.1% Streamlines and +1.0% desktop 3D medians are reported, not hidden or claimed as statistically significant regressions. The comparison samples cannot establish variability. No general speedup, GPU headroom or mobile-device battery claim is supported.

The 3D presentation intentionally changes geometry fidelity/bevels and camera behavior, so this is a matched user-workflow comparison, not an identical-scene graphics microbenchmark. Samples precede the final explanatory-wording and shell-background corrections; those did not change numerical work, renderer loops or dimensions. A separate local car-reference readiness observation was 564ms in its test context, not a cold-network benchmark.

Final bundles: JS **315.64kB / 102.60kB gzip**; CSS **80.63kB / 17.42kB gzip**. Baseline: JS 309.17/100.23kB; CSS 75.53/16.61kB. There is no added blur/filter or animation loop competing with CFD.

## Screenshot comparisons

| View | Before desktop | After desktop | Before mobile | After mobile |
| --- | --- | --- | --- | --- |
| Velocity | [1440](screenshots/phase-07-before-velocity-1440.png) | [1440 light](screenshots/phase-07-light-velocity-1440.png) | [375](screenshots/phase-07-before-velocity-375.png) | [375 dark](screenshots/phase-07-dark-velocity-375.png) |
| Pressure | [1440](screenshots/phase-07-before-pressure-1440.png) | [1440 light](screenshots/phase-07-light-pressure-1440.png) | [375](screenshots/phase-07-before-pressure-375.png) | [375 dark](screenshots/phase-07-dark-pressure-375.png) |
| 3D | [1440](screenshots/phase-07-before-3d-1440.png) | [1440 light](screenshots/phase-07-light-3d-1440.png) | [375](screenshots/phase-07-before-3d-375.png) | [375 dark](screenshots/phase-07-dark-3d-375.png) |

Additional modes: [Streamlines desktop](screenshots/phase-07-light-streamlines-1440.png), [mobile](screenshots/phase-07-dark-streamlines-375.png); [Vorticity desktop](screenshots/phase-07-light-vorticity-1440.png), [mobile](screenshots/phase-07-dark-vorticity-375.png); [Vectors desktop](screenshots/phase-07-light-vectors-1440.png), [mobile](screenshots/phase-07-dark-vectors-375.png); [Schlieren desktop](screenshots/phase-07-light-schlieren-1440.png), [mobile](screenshots/phase-07-dark-schlieren-375.png).

Other evidence: [3D light mobile](screenshots/phase-07-light-3d-375.png), [3D dark desktop](screenshots/phase-07-dark-3d-1440.png), [Front Wing](screenshots/phase-07-frontwing-3d-1440.png), [Rear Wing](screenshots/phase-07-rearwing-3d-1440.png), [Cylinder](screenshots/phase-07-cylinder-3d-1440.png), [comparison desktop](screenshots/phase-07-light-comparison-1440.png), [comparison mobile](screenshots/phase-07-dark-comparison-375.png), [320px](screenshots/phase-07-light-vectors-320.png), [768px](screenshots/phase-07-dark-velocity-768.png), [3D fullscreen](screenshots/phase-07-3d-fullscreen-1440.png), [mobile fullscreen](screenshots/phase-07-3d-fullscreen-375.png), [visible warning](screenshots/phase-07-warning-mobile.png).

There are **38 Phase 07 captures**, including six baselines. Before/after pictures show presentation and interpretation changes; live fields differ with step count and are not numerical pixel-equality comparisons. Default 3D now shows the selected contour rather than the former automatic full-car illustration.

## Changed files

- `src/CFDLab.jsx`: explicit field interpretation, mode component, read-only legend publication, status strip, proxy labels, comparison guidance, crisp boundary and safe Schlieren boundary lookup. Numerical stepping/formulas remain intact.
- `src/components/View3D.jsx`: faithful contour mapping/cache keys, explicit car reference, controlled camera, subdued scene, loader/resource lifecycle and accessible controls.
- `src/components/AnalysisPanel.jsx`, `AboutPanel.jsx`: scientific terminology and limitations; algorithms/exports unchanged.
- `src/components/ControlPanel.jsx`: inlet-disturbance helper copy only.
- New `src/components/FieldLegend.jsx`, `VisualizationModes.jsx`, `src/visualization/fields.js`, `profile.js`, `src/styles/visualization.css`.
- `README.md`: corrected scientific descriptions, seven-mode inventory and limits.
- New `tests/visualization.test.mjs`, this report, verification/performance JSON and 38 screenshots.

All other snapshotted source/public files and previous-phase work remain unchanged. Unrelated `.codex/`, `AGENTS.md`, `f1car/` content was preserved.

## Limitations and unresolved risks

Fifteen baseline lint errors remain, including existing render-time ref access and generated WASM glue. Chromium production verification does not establish Safari/Firefox, physical-device safe areas, screen-reader announcement quality, GPU/battery cost or calibrated CFD accuracy. Headless performance is refresh-limited and subject to host variability.

3D remains a qualitative illustration with external Three.js/loader dependencies and an illustrative extrusion depth. Pressure remains raw lattice density; no validated SI conversion, force integration or turbulence closure was introduced. Legacy parser normalization/reordering and Analysis input styling remain outside this phase. The PNG action continues exporting the native visualization canvas rather than composing DOM legends into the image; session/CSV/STL formats are unchanged. Existing development-only WASM issues documented in earlier phases were not addressed.

Stopped after Phase 07. Phase 08 has not started.
