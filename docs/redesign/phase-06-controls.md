# Phase 06 — Professional CFD control interface

Completed on 2026-10-16, starting from the uncommitted, completed Phase 05 workspace. Scope is Phase 06 only. No commit, push, deployment or PR was performed.

## Result

The settings interface now follows **Geometry → Flow → Visualization → Advanced**. Geometry starts with labeled F1 profiles; all benchmark profiles, generators, import formats and freehand drawing remain available. Transformation is a discoverable Geometry disclosure. Advanced contains execution settings, shortcut/reset guidance and a direct route to Analysis tools.

There is one primary simulation action at a time: **Start Simulation** in the initial opening, followed by the stateful **Run / Pause** button. Expanding the tool overview provides **Return to workspace**, which only collapses the introduction. Reset simulation, Reset geometry, Undo and Redo have distinct labels and explanations.

Numeric settings pair a labeled native slider with an editable value, bounds, actual units and inline validation. Controls use the existing F1 Stories tokens, readable labels, restrained selected rules and visible focus. Mobile controls have 44px targets; numeric text is 16px to avoid focus zoom. The task row scrolls when necessary and keeps every task accessible.

## Independent investigations and integrated findings

The three registered agents ran concurrent, read-only investigations before implementation. Only the lead edited files.

| Registered agent | Actual configuration | Responsibility and findings |
| --- | --- | --- |
| `code_mapper` | GPT-6 Luna, high | Inventoried `ControlPanel.jsx`, `IconRail.jsx`, `iconRailConfig.js`, callbacks in `CFDLab.jsx`, geometry/constants and Analysis controls. Identified the keyed ControlPanel remount that discarded generator/source/sketch state. Supplied defaults, ranges, imports, presets, shortcuts and downstream dependencies. |
| `regression_reviewer` | GPT-6.1 Sol, high, fixed registered role | Audited labels, native file browsing, tabs, focus, mobile controls, units and numeric compatibility. Recommended preserving precise/off-grid historical values. Completed separate reviews of the implementation and browser evidence. |
| `design_auditor` | GPT-6 Luna, high | Produced the behavior checklist and fixture strategy for geometry, imports, transformations, execution, history, fields and mobile interaction. |

The registered reviewer has a fixed high reasoning configuration, rather than the requested medium setting. All three completed their investigations; none edited files. Review findings corrected before delivery: discrete numeric fields could accept fractional counts/generator values; legacy task-row height clipped larger controls; collinearity validation could reject valid CAD contours with a near-duplicate first vertex. The final review found no remaining actionable defect. One completed Impeccable detector scan reported zero findings across the eight Phase 06 application files; it was not repeatedly rerun.

## Legacy functionality inventory and new locations

| Previous control | Phase 06 location | Preservation decision |
| --- | --- | --- |
| Shape | Geometry | Internal `shape` ID retained; clearer public label |
| Flow | Flow | Same parameters, defaults, ranges and callbacks |
| Transform | Geometry → Transform geometry | All six original settings retained; no standalone task needed |
| Visual | Visualization + Advanced | Particle/trail settings under Visualization; steps/frame and auto-run under Advanced |
| Icon settings shortcuts | Labeled workspace tools + task tabs | Geometry, Flow, Visualization and Advanced all directly accessible |
| Mode selector | Above the scientific viewport | All seven modes retained |
| Execution/history | Workspace tools | Run/Pause, Reset simulation, Undo and Redo remain distinct |
| Advanced workflows | Analysis & advanced tools | Existing sweeps, recording, gallery and export implementations retained |

### Geometry sources, presets and imports

- **Built-in presets:** F1 Car, Front Wing, Rear Wing, Airfoil, Cylinder, Wedge and Bluff. F1 profiles appear first. The selected state checks the actual profile, so a restored or imported custom outline cannot be mislabeled as an F1 preset.
- **NACA:** the same 4-digit generator and six presets: 0012, 2412, 4412, 2324, 6409 and 0006. Editing a parameter immediately applies the generated profile, as before. The displayed preset selection only claims a currently applied matching profile.
- **F1 Tuner:** original generator and Low Drag `(5,10,35,60)`, High Downforce `(22,40,55,45)`, Balanced `(12,25,50,50)` and Rain Setup `(18,35,60,40)` configurations. Tuple order is front angle, rear angle, body height, nose length.
- **SVG:** existing parser's supported outline/shapes. **STL:** ASCII and binary, projected to a 2D profile. **DXF:** existing coordinate extraction, including code 10/20 vertices. Parser limitations are unchanged.
- **Image:** browser-decodable `image/*`, including tested PNG/JPEG; existing edge tracing at up to 200×200 pixels. Clear dark-silhouette guidance and decode/trace errors are provided.
- **Sketch:** retained 232×130 bitmap, scaled pointer mapping, contour normalization and immediate application. Captured Pointer Events support mouse/touch/pen; cancellation does not apply a partial stroke. Clear sketch clears the draft bitmap without resetting the applied geometry. Short or unusable contours produce an actionable error.
- **Session JSON:** a new explicit browse entry exposes the existing import operation. Previously exported sessions also remain droppable on the panel or application shell. Panel drops stop propagation to prevent duplicate imports. Other model files dropped outside the panel receive guidance to use Geometry.
- All supported files can be browsed using a visible, labeled native file input or dropped anywhere within the open panel. Read, parse, decode, unsupported-format and unusable-outline failures are announced and scrolled into view. Previous valid settings/geometry remain intact when validation fails.

Fixtures and manual reproduction notes: [tests/fixtures/controls/README.md](../../tests/fixtures/controls/README.md).

### Complete numeric inventory

`C` and `R` mean the unchanged solver's column/row counts. A fresh load below 720px uses `C=208, R=104`; otherwise `C=300, R=135`. Resizing does not silently recreate these constants or the solver. Defaults listed below apply to fresh storage; saved sessions retain their values.

| Task / editor | Setting | Default | Slider minimum…maximum | Slider increment / unit |
| --- | --- | --- | --- | --- |
| Geometry / NACA | Max Camber M | 2 | 0…9 | 1 / % |
| Geometry / NACA | Camber Position P | 40 | 10…90 | 10 / % |
| Geometry / NACA | Thickness T | 12 | 1…40 | 1 / % |
| Geometry / F1 Tuner | Front Wing Angle | 12 | 0…30 | 1 / ° |
| Geometry / F1 Tuner | Rear Wing Angle | 25 | 5…45 | 1 / ° |
| Geometry / F1 Tuner | Body Height | 50 | 20…80 | 1 / % |
| Geometry / F1 Tuner | Nose Length | 50 | 20…80 | 1 / % |
| Geometry / Transform | Position X | `C × .35` | 10…`C − 10` | 1 / cells |
| Geometry / Transform | Position Y | `R / 2` | 4…`R − 4` | 1 / cells |
| Geometry / Transform | Scale X | `C × .25` | 10…`C × .5` | 1 / cells |
| Geometry / Transform | Scale Y | `R × .45` | 5…`R × .7` | 1 / cells |
| Geometry / Transform | Angle of attack | 0 | −25…35 | 1 / ° |
| Geometry / Transform | Simplification | 0 | 0…20 | 1 / original simplification level |
| Flow | Inlet velocity | .12 | .02….18 | .005 / cells per solver step |
| Flow | Viscosity | .015 | .005….1 | .001 / cells² per solver step |
| Flow | Turbulence factor | .15 | 0…3 | .1 / dimensionless inlet perturbation factor |
| Visualization | Particles | 220 mobile / 420 desktop | 0…900 mobile / 2000 desktop | 10 / particles |
| Visualization | Trail opacity | 1 | 0…1 | .05 / opacity |
| Advanced | Simulation steps per frame | 1 | 1…8 | 1 / solver steps per rendered frame |

Native sliders retain their original increments. Number inputs for counts, simplification and generator fields enforce their original discrete increments. Continuous settings allow precise finite values within bounds. This preserves such existing values as turbulence `.15`, desktop Y position `67.5` and Y scale `60.75`, even where a slider's increment differs. Focusing/blurring an untouched value never commits, clamps or rounds it. Stored particle counts above the current device's slider maximum remain visible with an explanation; opening settings never normalizes them. Display formatting removes binary floating-point noise without changing the source number.

Enter or blur commits an edited valid value. Invalid drafts show an associated alert and leave the simulation parameter unchanged. Escape first cancels an active numeric draft; a subsequent Escape closes the panel. Native slider arrows/Home/End remain available. Flow guidance and velocity/vorticity legend text now identify lattice units consistently with the existing README; no SI conversion, range, LUT or numerical interpretation was changed.

### Other controls, state and command behavior

| Control | Default / dependency | Retained behavior |
| --- | --- | --- |
| Run after geometry changes | Checked; workspace must have started | Existing auto-run effect. Enabling it after starting can itself resume flow, as before. |
| Start / Run / Pause | Initially paused, Velocity, F1 Car | One primary action; labels and icon reflect state. Pause retains solver and history. |
| Reset simulation | Existing callback / R | Recreates solver and rebuilds current geometry; retains parameters, history and run/pause state. |
| Reset geometry | New explicit, undoable action | Restores F1 Car and default position/scale/angle/simplification; retains flow and visualization settings. Existing auto-run policy applies. |
| Undo / Redo | Existing 20-entry geometry history | Restores profiles and placement; native disabled state when unavailable; does not claim to undo flow parameters. |
| Visualization | Velocity initially | Velocity, Pressure, Streamlines, Vorticity, Vectors, Schlieren, 3D View. Particle/trail controls apply to Streamlines. |
| Compare | Off initially | Velocity/Pressure/Vorticity fields A/B, divider and difference mode retained. |
| Fullscreen / Screenshot | Existing viewport lifecycle | Native fullscreen and PNG capture retained; no canvas or solver remount. |
| Export STL | Geometry footer while 3D mode is active | Original binary STL exporter and data semantics |
| Analysis, About, Simulation | Existing application navigation | Same views; switching views no longer destroys ControlPanel editing state. |
| Done / Close / Escape / stage dismissal | Open panel | Existing close/focus-return path; mobile opens on the selected task tab. |
| Mobile drag handle | Touch/pointer capture, >80px dismiss | Short drags retain, long drags dismiss, cancellation clears inline transforms. Content scrolling does not become sheet dismissal. |
| Task tabs | Geometry initially | Proper tablist/tab/tabpanel IDs, selected state and roving tab stop; Arrow Left/Right, Home/End activate and reveal tasks. |
| Workspace tools | Existing button navigation | Visible task names; arrows/Home/End navigate enabled controls and reveal scrolled buttons. |

Existing command shortcuts: **Space** Run/Pause; **R** Reset simulation; **1–7** fields; **F** fullscreen; **S** screenshot; **Z**, **Ctrl/Cmd+Z** undo; **Ctrl/Cmd+Shift+Z** redo. The existing Ctrl/Cmd+S browser-save guard remains. Interactive elements, text inputs, native disclosures and dialogs do not trigger global simulation shortcuts.

The unchanged Analysis interface retains CSV/session export, Save Current/Load/Delete gallery (up to ten sessions), frame recording/ZIP (up to 300 frames), history (up to 1000 samples), and sweeps. Sweep defaults remain AoA −10…20/31 steps, velocity .02….18/17 steps, viscosity .005….1/20 steps. Steps input retains its original minimum-two handling and displayed maximum 100. Sweep parameter/min/max/steps controls, Run Sweep and Cancel remain in Analysis; their implementation was not rewritten.

## Editing state and compatibility

Previously `key={activeSection}` remounted ControlPanel whenever the section changed. The panel is now mounted once, controlled by the selected section, and hidden/inert when closed or outside Simulation. All four task panels and source editors retain stable DOM positions. NACA/F1 values, source selection, numeric drafts, disclosure state and sketch bitmap survive task changes, dismissal and navigation through Analysis/About. They remain local editing state, rather than adding a new persisted format.

No `aerolab-session`, `aerolab-sessions` or `f1stories-theme` key was renamed. Exported JSON still uses `app: "aerolab"`, version 2; valid earlier markers/versions remain accepted. Validation rejects nonfinite numeric fields and unusable geometry before mutation, without clamping valid historical precision or applying device-specific limits to imported sessions. Source parsers, exporters, paths, routes and repository base remain unchanged.

Applying an imported/generated model now labels its preset `custom`, so preset identification and the existing 3D custom-extrusion path use the actual geometry. Built-ins retain their existing IDs. Undo/Redo retains the previous preset with the previous outline. No new data structure was introduced.

Snapshot comparisons show only five existing source files changed during Phase 06. The other 234 snapshotted source/public files, including engine, WASM, LUTs, exporters, View3D, theme controller, tokens, shell CSS and brand assets, are byte-identical. Separate comparisons confirm the complete numerical render loop, Reset simulation callback, screenshot callback and F1 tuner generator are unchanged.

## Interaction verification matrix

Machine-readable evidence: [phase-06-verification.json](phase-06-verification.json).

| Coverage | Execution | Result |
| --- | --- | --- |
| All presets/generators | 375 and 1440px, both themes: 7 built-ins, 6 NACA presets, 4 F1 configurations | Selected state, actual polygon changes and finite coordinates pass |
| All 19 numeric controls | Same four cases; native slider endpoints + editable values | Parameter/field assertions pass; exact `.15` turbulence retained |
| Numeric failure handling | Empty/out-of-range velocity, fractional particles/steps, Escape | Invalid drafts cannot mutate parameters; readable associated errors |
| Every import entry | Each case: SVG, DXF, ASCII STL, binary STL, PNG, JPEG, JSON × browse/drop = 14 successful imports | Actual polygon/settings changes pass; root JSON drop also passes |
| Import failures | Empty SVG, blank raster, corrupt PNG, malformed JSON, null numeric field; additional collinear SVG | Previous valid geometry/settings retained; errors exposed; root alert dismisses |
| Sketch | Applied contour, task changes, clear, short stroke | Bitmap and applied model preserved as appropriate |
| Editor/solver continuity | Task switches, close/reopen, Analysis/About/return | Same panel, sketch, stage, solver, polygon and paused density buffer |
| Reset/history | All four cases | Geometry reset is undoable/redoable and retains flow; simulation reset replaces solver with parameters retained |
| Fields/live flow | All four cases; digits 1–7, actual WebGL canvas in 3D | Fields selected; returning to Velocity and Run changes actual solver field; Pause works |
| Task keyboard semantics | Arrows/Home/End, IDs and selected state | Pass; active tab and focus fit within task row |
| Responsive task layouts | 320/375/768/1440px × two themes × four tasks = 32 cases | No document overflow in active state; panel fits, content scrolls, labels/values and range targets meet measured sizes |
| Mobile behavior | Real CDP touch at 320/375px | Short/long drag, cancel, Escape, focus on open/return, initial model choice before Start and canvas after close pass; Run remains unobscured |
| Historical restore | Fresh mobile context, existing saved key, desktop-sized particle count and fractional geometry values | Stored values survive open/focus/blur/task changes |
| Native keyboard file browsing | Enter on visible chooser, actual filechooser event | SVG import passes |
| Shortcut/output regressions | Four desktop/mobile/theme cases | Space, R, F, S, Z, Ctrl and Cmd undo/redo; real PNG downloads, fullscreen, compare fields/difference and input shortcut guard pass |
| Advanced handoff/exports | 1440px dark | Advanced opens Analysis; binary STL, CSV and legacy-format JSON downloads; gallery Save/Load/Delete pass |
| Analysis workflows | 1440px dark, unchanged interface | All three sweep parameter choices/defaults and numeric inputs; two-step sweep CSVs, cancellation, frame Record/Stop and ZIP download pass |

Assertions inspect existing React refs to distinguish real solver/parameter changes from merely changing labels. No application test hook or new browser dependency was added. Dedicated Chrome/CDP uses an already-installed Playwright package against the production preview. Browser harnesses were temporary; their measured results are retained in the verification artifact. All completed browser runs recorded zero page errors.

## Build, lint and source checks

Dependencies were already installed; no `npm ci` or dependency change was necessary.

| Check | Result |
| --- | --- |
| `npm run build` | **Pass**, 47 modules, no warnings; baseline also passed |
| `npm run lint` | **17 existing errors, zero warnings**, compared with baseline 18 errors; no new normalized file/rule/message diagnostics. Removing the old file-handler catch removed one unused `_` diagnostic. |
| `node --test tests/*.test.mjs` | **15/15 pass**: 7 control/validation tests + 8 existing theme tests |
| `git diff --check` | Pass |
| Independent final regression review | No remaining actionable findings |
| Protected source comparisons | Pass; engine/numerical behavior and previous-phase foundations preserved |

The JS bundle is 309.17kB / 100.23kB gzip; CSS 75.53kB / 16.61kB gzip. No formal performance benchmark was rerun for this control phase.

## Screenshots

Before Phase 06: [desktop](screenshots/phase-06-before-1440.png), [mobile](screenshots/phase-06-before-375.png).

| Task | Desktop light | Desktop dark | Mobile light | Mobile dark |
| --- | --- | --- | --- | --- |
| Geometry | [1440](screenshots/phase-06-light-geometry-1440.png) | [1440](screenshots/phase-06-dark-geometry-1440.png) | [375](screenshots/phase-06-light-geometry-375.png) | [375](screenshots/phase-06-dark-geometry-375.png) |
| Flow | [1440](screenshots/phase-06-light-flow-1440.png) | [1440](screenshots/phase-06-dark-flow-1440.png) | [375](screenshots/phase-06-light-flow-375.png) | [375](screenshots/phase-06-dark-flow-375.png) |
| Visualization | [1440](screenshots/phase-06-light-visualization-1440.png) | [1440](screenshots/phase-06-dark-visualization-1440.png) | [375](screenshots/phase-06-light-visualization-375.png) | [375](screenshots/phase-06-dark-visualization-375.png) |
| Advanced | [1440](screenshots/phase-06-light-advanced-1440.png) | [1440](screenshots/phase-06-dark-advanced-1440.png) | [375](screenshots/phase-06-light-advanced-375.png) | [375](screenshots/phase-06-dark-advanced-375.png) |

Additional widths: [320 light](screenshots/phase-06-light-geometry-320.png), [320 dark](screenshots/phase-06-dark-geometry-320.png), [768 light](screenshots/phase-06-light-geometry-768.png), [768 dark](screenshots/phase-06-dark-geometry-768.png). Detail evidence: [Transform](screenshots/phase-06-transform-desktop.png), [visible import error](screenshots/phase-06-import-error-mobile.png).

These 24 captures include two baselines. Final task captures wait for a nonzero active FPS, then pause to expose the controls clearly. Scientific fields vary with time and are not deterministic image comparisons. At narrow widths, the sheet can cover the field while editing; Done, Close, Escape or a downward handle drag restore canvas space. Clicking the stage also dismisses the panel where the stage remains exposed.

## Changed files

- `src/CFDLab.jsx`: persistent panel, validated import entry points, accurate custom preset identity, explicit geometry reset, sole-primary-action handoff, lattice-unit annotations, disclosure/dialog shortcut guard and dismissible import notice.
- `src/components/ControlPanel.jsx`: task hierarchy, retained editors, preset selection, native import controls/errors, numeric controls, progressive disclosure, sketch Pointer Events and mobile focus.
- `src/components/IconRail.jsx`: all four labeled tasks, explicit reset/history labels, sole Run/Pause action after starting, scrolled focus visibility.
- `src/components/CommandBar.jsx`: Start/Run handoff and state-preserving Return to workspace action.
- `src/components/iconRailConfig.js`: shared semantic task list.
- New `src/components/NumericControl.jsx`, `src/controls/validation.js`, `src/styles/controls.css`.
- New `tests/controls.test.mjs`, nine import fixtures and fixture README.
- This report, verification JSON and 24 `phase-06-*.png` files.

Existing uncommitted work from Phases 01–05 and unrelated `.codex/`, `AGENTS.md` and `f1car/` content was preserved.

## Limitations and unresolved risks

- Lint remains blocked by the 17 baseline diagnostics, including existing render-time ref access and generated WASM glue. A clean lint run is not claimed.
- Browser verification used local production Chromium. Physical-device safe areas, Safari/Firefox, screen-reader announcements and native OS file-dialog presentation were not independently tested. Native chooser events, labels and keyboard operation were tested in Chromium.
- Analysis retains its separate existing input styling and sweep-editor remount behavior. This phase retains its workflows; it does not redesign Analysis or change sweep cancellation semantics. Freehand canvas drawing remains a pointer interaction; file imports/presets/generators provide keyboard-accessible alternatives.
- Existing parser/trace limitations and remote 3D-resource dependencies remain. No numerical accuracy benchmark is claimed. Earlier phases' development-only WASM issue remains outside scope; completed production browser runs here had no page errors.

Stopped after Phase 06. Phase 07 has not started.
