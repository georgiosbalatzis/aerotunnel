# Phase 05 — Editorial CFD workspace

Completed 2026-10-16 from the completed, uncommitted Phases 01–04 on HEAD `6116886`. Read `AGENTS.md`, earlier phase reports and the current implementation; recorded git status and source snapshots before editing. Preserved all earlier and unrelated work. Only the lead edited application files.

Phase 05 only. No commit, push, deployment, PR or sibling-repository modification was performed.

## Workspace hierarchy

The unchanged F1 STORIES masthead and Race Desk lead into a product opening with **AEROTUNNEL.**, **Aerodynamics & Flow Simulation**, a short explanation and **Start Simulation**. The initial page can scroll naturally so the introduction does not squeeze the field into an unusable area. Start minimizes the introduction to a compact identity/status strip and gives the active workspace the remaining viewport. A desktop Tool overview control can reopen the explanation.

Fresh sessions now wait for explicit Start or Run/Space. This is an intentional entry-flow change: the existing auto-green-flag preference still controls automatic running on subsequent profile changes after entering the workspace. Its stored representation and numerical parameter meanings are unchanged. Restored sessions still begin paused. Starting changes the run/presentation state and focuses the workspace; it does not recreate the canvas or solver.

The workspace separates four operational roles:

1. **Application navigation:** labeled Simulation, Analysis and About views, separate from the global site/product navigation.
2. **Simulation tools:** Shape, Flow, Visual, Comparison, reset and history controls; Run/Pause stays reachable beside the view navigation.
3. **Scientific stage:** a normal-flow visualization selector above the flexible canvas, with field legend and angle information confined to the viewport. Comparison selectors/difference action also sit outside the rendered field.
4. **Results and output:** a ruled live readout and contextual Screenshot, Fullscreen, Export session and Export CSV controls. Historical analysis, session gallery, sweeps and recording remain in the existing Analysis view.

Surfaces, typography, spacing, borders, accents and focus colors use Phase 02 tokens. Main display uses Barlow Condensed; ordinary interface text uses IBM Plex Sans. Numerical readouts use tabular figures. No font, palette, dependency or decorative effect was introduced.

## Before / after structure

| Area | Phase 04 | Phase 05 |
| --- | --- | --- |
| Product opening | Small floating product/status chip | Editorial introduction; compact identity/status after Start |
| Local navigation | Floating icon rail, vertical or bottom-aligned | Labeled, normal-flow views/tools with persistent Run/Pause |
| Desktop controls | Drawer floating over the field | Docked 280px settings region at wide desktop; 260px at 1024px |
| Scientific viewport | Occupies all remaining space under floating UI | Flexible central grid cell with its own toolbar and bounded overlays |
| 2D presentation | Stretches bitmap to arbitrary wrapper ratio | Contains the same bitmap at its actual aspect ratio, with technical letterboxing |
| Live metrics | Floating pills over the field | Compact 184px right column at ≥1280px; ruled row beneath the stage below that |
| Capture/export | Keyboard shortcuts and Analysis actions | Explicit contextual action row plus existing shortcuts/Analysis workflows |
| Mobile controls | Fixed rail, metrics bar and sheet with coordinated offsets | Normal-flow navigation/readout/actions and one contextual sheet inside the workspace |
| Short landscape | Dense fixed overlays | Scrollable page with a usable minimum stage height |

The former full-width field rectangle included overlapping controls. The new central stage reserves those roles outside its drawing area. At 1440×900 with controls open, the active stage is **846×554 CSS pixels**; the left region is 280px and the right readout is 184px. Numerical canvas backing size remains **1000×450** for a desktop-initialized session. CSS resizing never changes the solver grid.

### Responsive layout

| Width | Settings | Results | Active stage, representative CSS size |
| --- | --- | --- | --- |
| 1440px | Docked 280px left region | Right readout | 846×554 |
| 1024px | Docked 260px left region | Row below stage | 686×487 |
| 768px | Collapsible 290px contextual drawer | Row below stage | 702×450 with drawer closed |
| 375px | Bottom sheet within workspace | Compact ruled row | 329×372 |
| 320px | Bottom sheet within workspace | Compact ruled row | 284×200 |

These are measured stage rectangles, not changes to numerical resolution. Opening docked controls reserves width; closing them gives that width to the stage. Below 1024px, temporary controls overlay the workspace and dismiss from the exposed stage. Desktop docked controls remain open when interacting with the field. Mobile bottom padding respects `env(safe-area-inset-bottom)`; there are no competing fixed bottom bars. Secondary tools/exports can scroll horizontally, with normal keyboard access. At short landscape heights the page scrolls vertically instead of clipping the stage.

## Rendering and interaction preservation

The 2D canvas stays at the same React/DOM position throughout Start, panel toggling, resizing, theme changes and local-view transitions. Analysis/About hide its section while preserving the captured render-loop reference. View3D remains mounted only while visible in Simulation. Its stage/gizmo positioning changes through scoped CSS to absolute positioning within the canvas wrapper; its renderer, camera logic, ResizeObserver and numerical inputs are unchanged.

Canvas `object-fit: contain` preserves the profile's proportions. It does not resample solver arrays, change the LUT or alter the image buffer generated by the renderer. Scientific gradients, field values, colors and units remain independent of the ordinary UI theme.

Settings retain their existing content, importers, sketch bitmap and parameter callbacks. Closed controls remain inert. Escape closes them, and closing from within the panel returns focus to the corresponding settings button. Native Tab access and arrow/Home/End navigation follow the visible control order and skip disabled history buttons. Pause and Compare have accessible names containing their visible labels; selected views/tools expose pressed state.

The visualization selector displays complete labels and scrolls when necessary. On an overflowing selector, a horizontal gesture scrolls the labels; the existing swipe-to-next-mode gesture applies when the row fits. This prevents scrolling from unexpectedly changing scientific mode.

### Two capture/gesture corrections found during verification

- **Sheet release outside its handle:** the previous mouse/touch handlers could miss release after a drag left the handle. Pointer capture now delivers the release; short drags restore position, drags over the existing 80px threshold dismiss, and cancellation restores styles without dismissing. Parameter/geometry callbacks are unchanged.
- **Blank 3D PNG:** the previous timeout could read WebGL after its drawing buffer had cleared. Capture now runs in a requestAnimationFrame callback after rendering and before clear. A baseline PNG decoded to one sampled color; the corrected native-resolution PNG contained 4,791 sampled colors. View3D itself is byte-identical. Capture remains canvas-only; DOM legends and watermarks are not composited into downloads. Screenshot is disabled outside Simulation, where a 3D canvas is intentionally unmounted.

## Actual parallel investigations and review

All three registered agents ran independent, read-only investigations concurrently and returned file-specific findings before implementation.

| Agent | Findings integrated |
| --- | --- |
| `code_mapper` — layout architecture | Mapped normal-flow global navigation, transformed workspace containment, fixed overlays, stacking, fixed backing dimensions, sketch mapping and responsive offsets in `src/CFDLab.jsx`, `src/cfdlab.css`, `src/styles/navigation.css`, `IconRail.jsx`, `CommandBar.jsx`, `ControlPanel.jsx` and `View3D.jsx`. These findings defined the stable canvas position and scoped positioning migration. The lead verified the current Phase 04 Simulation/About controls directly where a stale reachability note conflicted with the implementation. |
| `design_auditor` — composition | Proposed state-dependent introduction, 280–300px desktop controls, central stage, compact results and responsive collapse. Sources: `f1StoriesPage/standings/standings-editorial.css`, `ghostcar/src/app/DeskHero.jsx`, `ghostcar/src/app/app.css`, `Tyres/index.html`, `Tyres/src/styles/shell.css`. Existing parent navigation supplies brand context above the product opening. |
| `regression_reviewer` — simulation interactions | Traced canvas capture, module-load dimensions, sketch coordinates, 3D pointers/resize, fullscreen root, comparison split, screenshot timing, keyboard guards, imports and sheet dismissal. Supplied the workflow/continuity test plan. |

The registered profiles enforce Luna/high for design_auditor/code_mapper and GPT-6.1 Sol/high for regression_reviewer. Those profiles differ from the requested GPT-6.1 Sol composition model and medium reviewer effort; lead model selection remains session-controlled.

The regression reviewer also inspected completed changes. It identified arrow-order, Pause label, off-view Screenshot and hover-focus contrast issues; all were corrected. Its final check accepted the pointer-capture and render-frame capture fixes. Independent theme tests and diff checks passed. The design detector returned **zero findings** across the Phase 05 files. No agent edited files.

## Preserved-behavior checklist

| Workflow | Evidence / outcome |
| --- | --- |
| Initial / Start | Fresh UI Ready; explicit Start compacts the introduction and runs; same actual solver/canvas identities |
| Tunnel / Analysis / About | All reached across the five requested widths; returning retains the 2D canvas and live field |
| Paused continuity | Same solver, canvas, particle pool, intrinsic dimensions, parameters, legend and page origin; all six numerical arrays identical after resize/theme/panel/view operations |
| Live simulation | Numerical field continues evolving across theme and local-view changes with the same solver |
| 2D modes | Velocity, Pressure, Streamlines, Vorticity, Vectors and Schlieren selected with digits 1–6; pressed state follows selection |
| 3D | Digit 7, live rendering, actual orbit displacement, wheel radius change, synthesized pinch/pan, parent resize and theme preservation; no context loss |
| 3D off-view | Canvases disposed, no additional renderer calls across 12 hidden frames, rendering restored on return |
| Comparison | Both fields selected and difference toggled; accessible names/states correct; existing fixed midpoint split preserved |
| Fullscreen | Actual native full-shell fullscreen entered and exited in 2D and 3D; F exits; canvas remains intact |
| Historical restoration | Existing `aerolab-session`, version 2, geometry/flow/mode values restored; paused until explicit Start |
| JSON import | Historical `app: "aerolab"` files imported through the real root drop handler and settings file browser |
| Geometry drop | SVG imported through the settings drop target; existing parser/callback path exercised |
| Sketch | A 21-point finite contour built after drawing through a resized 254×143 CSS rectangle backed by the unchanged 232×130 bitmap |
| Screenshots | Real 2D PNG 1000×450 and 3D PNG 702×450 downloaded; corrected 3D pixels decoded and inspected separately |
| Data exports | Real JSON retains `app: "aerolab"`, version 2 and geometry/solver/display/history structure; CSV header unchanged |
| History / shortcuts | Undo, redo and Ctrl+Z restore expected profiles; R replaces the solver through the existing reset path; S downloads PNG; Space toggles run; theme Space does not also pause |
| Drawer | Short/long mouse drag, real CDP touch drag, pointer cancellation, Escape, focus return and exposed-stage dismissal pass |

No storage key, session schema, deployment path, solver mathematics, WASM implementation or numerical parameter definition changed. Hash/section comparisons verify unchanged engine files, LUTs, exporters, View3D, theme controller/tokens, session helpers, WASM initialization/restoration and the complete numerical render-loop region. Earlier source work outside the four edited existing files remains byte-identical to the Phase 05 starting snapshot.

## Validation results and performance

Dependencies were already installed. No dependency or package-script change was needed.

| Check | Result |
| --- | --- |
| `npm run build` | **Pass**, 44 modules, no warnings; baseline also passed |
| `npm run lint` | Baseline **19 errors**, updated **18 errors**, zero warnings; no new diagnostics. Removed unused CommandBar `solverWarning` prop accounts for the improvement. |
| `node --test tests/theme.test.mjs` | **8/8 pass** |
| `git diff --check` | Pass |
| Responsive matrix | **20 combinations**: 320/375/768/1024/1440px × light/dark × initial/active; no horizontal document overflow, active document exactly viewport height |
| Short landscape | 568×320; stage remains 275px high in a vertically scrollable page; no horizontal overflow |
| Production browser errors | None in completed matrix and interaction runs |
| Independent review | No remaining actionable new regression |

Browser automation uses the already-installed Playwright package and a dedicated headless Chrome profile. The working CDP connection bypasses the previously documented Chrome CLI page-creation limitation. Tests use the actual application, browser fullscreen/download/drop/pointer APIs and inspected existing React refs; no application test hooks or project dependencies were added. Captures wait for fonts, UI settlement and a nonzero active FPS reading. Browser-only assertions were run from temporary harnesses; results are retained in [phase-05-verification.json](phase-05-verification.json).

A local before/after frame-cadence sample used the same 1440×900 light, running Velocity mode, fresh storage, WASM resource readiness, 60-frame warm-up and 180 measured requestAnimationFrame intervals. Only the dedicated browser's blank page existed before the comparison.

| Sample | Mean frame interval | Median | P95 | App FPS |
| --- | --- | --- | --- | --- |
| Phase 04 baseline | 16.6661ms | 16.7000ms | 16.7000ms | 60 |
| Phase 05 | 16.6660ms | 16.6650ms | 16.6700ms | 60 |

No frame-cadence regression was observed in this sample. The refresh-limited headless test does not measure CPU headroom, every mode/device or numerical accuracy. The stylesheet bundle grew from 55.57 to 68.95kB (gzip 13.58 to 15.70kB); JS grew from 299.01 to 300.57kB (gzip 96.67 to 97.33kB). Existing legacy CSS remains beneath the scoped workspace layer to avoid an unrelated all-at-once stylesheet rewrite.

## Screenshots

| Width | Initial light | Initial dark | Active light | Active dark |
| --- | --- | --- | --- | --- |
| 320 | [View](screenshots/phase-05-light-initial-320.png) | [View](screenshots/phase-05-dark-initial-320.png) | [View](screenshots/phase-05-light-active-320.png) | [View](screenshots/phase-05-dark-active-320.png) |
| 375 | [View](screenshots/phase-05-light-initial-375.png) | [View](screenshots/phase-05-dark-initial-375.png) | [View](screenshots/phase-05-light-active-375.png) | [View](screenshots/phase-05-dark-active-375.png) |
| 768 | [View](screenshots/phase-05-light-initial-768.png) | [View](screenshots/phase-05-dark-initial-768.png) | [View](screenshots/phase-05-light-active-768.png) | [View](screenshots/phase-05-dark-active-768.png) |
| 1024 | [View](screenshots/phase-05-light-initial-1024.png) | [View](screenshots/phase-05-dark-initial-1024.png) | [View](screenshots/phase-05-light-active-1024.png) | [View](screenshots/phase-05-dark-active-1024.png) |
| 1440 | [View](screenshots/phase-05-light-initial-1440.png) | [View](screenshots/phase-05-dark-initial-1440.png) | [View](screenshots/phase-05-light-active-1440.png) | [View](screenshots/phase-05-dark-active-1440.png) |

Phase 04 baseline before changes: [desktop](screenshots/phase-05-before-1440.png), [mobile](screenshots/phase-05-before-375.png).

Other workflows: [comparison](screenshots/phase-05-comparison-desktop.png), [3D fullscreen](screenshots/phase-05-3d-fullscreen.png), [Analysis](screenshots/phase-05-analysis-tablet.png), [About](screenshots/phase-05-about-tablet.png), [mobile controls](screenshots/phase-05-controls-mobile.png), [short landscape](screenshots/phase-05-landscape-mobile.png).

Initial captures show the scrollable introduction and stage; active captures fit the viewport. Live CFD images vary over time and are not deterministic pixel-equality benchmarks.

## Changed files

- `src/CFDLab.jsx`: presentation entry state, grid composition, stable canvas placement, contextual output controls, viewport-scoped comparison/overlays, panel focus return and capture timing.
- `src/components/CommandBar.jsx`: editorial opening and compact identity/status strip.
- `src/components/IconRail.jsx`: labeled normal-flow navigation/tools, accessible run/comparison state, ordered keyboard movement and disabled history controls.
- `src/components/ControlPanel.jsx`: Escape semantics and pointer-captured sheet dismissal/cancellation.
- New `src/styles/workspace.css`: scoped responsive layout and control presentation using canonical tokens; imported after legacy CSS.
- This report, `phase-05-verification.json` and 28 `phase-05-*.png` screenshots.

## Limitations and unresolved risks

- Eighteen pre-existing lint errors remain. They include existing render-time ref access and generated WASM glue diagnostics; a clean lint run is not claimed.
- Browser verification covers local production preview in Chromium. Safari, Firefox, assistive-technology announcements and physical-device safe-area behavior were not independently tested. Native popover support remains the Phase 04 browser requirement.
- Earlier phases documented development-mode WASM memory-access errors. Engine work remains outside this phase; production verification here had no page errors. Source/identity checks are not a complete numerical benchmark.
- Existing scientific annotations and some settings controls retain their earlier compact sizing/accessibility limitations. The new shell does not provide an accessible alternative representation for every canvas visualization.
- 3D still depends on existing external Three.js/model loader resources. Capture requires the visualization to have finished loading and continues exporting the canvas rather than the whole interface.

Stopped after Phase 05. Phase 06 has not started.
