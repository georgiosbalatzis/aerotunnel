# Phase 08 — Editorial engineering analysis

Completed 17 October 2026. Scope: Analysis only, building on the uncommitted Phase 07 workspace. No commit, push, deployment or PR. Phase 09 has not started.

## Result

Analysis is now a structured F1 Stories report: title/context → aerodynamic indicators → flow and convergence → recorded history → parameter sweeps → saved sessions → exports and method documentation. It uses the existing IBM Plex Sans assets, canonical theme tokens, tabular figures, open surfaces and restrained rules. Scientific canvas colors remain independent.

The report scrolls as a document instead of inside the former terminal panel. Four metric columns become two on mobile; interpretation and plots stack. Figures and tables retain readable dimensions and keyboard-accessible horizontal scrolling. Controls have 44px minimum heights; numeric inputs use 16px text. Analysis fullscreen has its own shell scroll container. Simulation and About retain their existing layout.

### Before / after

| Before | After |
| --- | --- |
| Disconnected terminal cards and animated dual-axis trace | Ordered report sections, neutral metric strip, separate explicitly labeled CL/CD axes |
| Valid zero CL displayed as `-`; initial default metrics looked measured | Actual sampling provenance, valid zeros, unavailable values and explicit not-started/running/paused states |
| Default/stale convergence and metrics could look current | First measured sample required; setup changes marked stale; restored records distinguished from live solver state |
| Last 80 history rows exposed | All retained records accessible in 25-row pages, newest first; no source records removed |
| Sweep results disappeared after automatic export | Retained complete/partial results, progress, reference comparisons and compatible manual CSV download |
| Recording cap left captured frames without an export action | Export captured frames remains reachable at 300; delayed PNG completion has a retry |
| Save failures silently reported success | Storage failures are visible; unreadable storage is left untouched; JSON remains available |

The Analysis component keeps form, session-name, reference-row and history-page state across navigation. Its inactive render omits charts and gallery work. A new Open simulation action returns keyboard focus to the workspace. The existing canvas, particle pool and solver continue to live in CFDLab.

## Independent investigations

The registered read-only agents ran concurrently, and all three returned file-specific findings before implementation. Only the lead modified application files.

| Agent / actual registered configuration | Findings integrated |
| --- | --- |
| `regression_reviewer` — GPT-6.1 Sol / high; scientific metrics audit | Traced live and sweep formulas in `src/CFDLab.jsx`, solver convergence and historical fallbacks. Identified zero-value suppression, initial/stale measurements, nonfinite values, invalid ratios, missing-history gaps, fractional sweep counts and inherited viscosity-sweep Re* inconsistency. |
| `design_auditor` — GPT-6 Luna / high; editorial research | Extracted ruled ledgers, quiet figure/caption hierarchy, independent chart scales, responsive report structure and coarse-pointer controls from the canonical applications. |
| `code_mapper` — GPT-6 Luna / high; workflow inventory | Mapped Analysis callbacks, 1000/200/500 history limits, gallery schemas, CSV/JSON exports, recording and queued-frame sweep restoration. Correctly confirmed that cancelling restores the original parameter on the next queued frame. |

The registered `code_mapper` configuration is fixed to Luna/high, so the workflow investigator did not use the separately requested Sol/medium configuration. No simulated roles or concurrent application edits were used.

Exact design reference paths inspected:

- `../f1StoriesPage/standings/standings-editorial.css` — figure/ledger rules and responsive report spacing, particularly lines 91–149 and 315–389.
- `../ghostcar/src/features/analysis/analysis.css`, `Workspace.jsx`, `AnalysisFigures.jsx`, `figures.css` — report heading/context, facts, traces, captions and subordinate export tools.
- `../Tyres/src/styles/bench.css` — figure boundaries, focus and coarse-pointer treatment.
- AeroTunnel `src/styles/tokens.css` — existing canonical typography, surfaces, readable accents, borders and spacing. No new palette or font request.

The regression reviewer also inspected the completed code and desktop/mobile screenshots. The verdict was **ship at the reviewed Phase 08 scope**. One Impeccable detector scan across eight Phase 08 source/test targets returned `[]`, exit 0. No second scan ran. Its four source findings and the lead's browser-discovered cancellation/fullscreen defects were resolved. Refreshed full-report screenshots were confirmed free of the initial capture-only skip-link artifact.

Skills applied: Impeccable for the existing-system Analysis extension, Ponytail for bounded changes, and Chrome DevTools CLI guidance for local browser verification. Existing project design-system files were preserved; this phase adds no independent design world.

## Numerical integrity and interpretation

No solver calculation, lattice equation, LUT, geometry transform, coefficient producer or sweep result formula changed. All 199 baseline files under `src/engine/` (including build artifacts) are byte-identical; the reviewer independently compared the 18 engine source/package files. Of 247 baseline source/public files, only `src/CFDLab.jsx` and `src/components/AnalysisPanel.jsx` changed. New components/helpers/styles contain presentation work.

| Field | Existing meaning, retained exactly | Report treatment |
| --- | --- | --- |
| CL | `abs(mean(uy) × 2 × (1 + .06 × AoA))`, over non-solid cells with finite speed | Heuristic lift magnitude, not integrated force or a validated lift coefficient. Absolute value loses lift sign. |
| CD | `mean(abs(ux − inlet)) × .5 + .008` | Bulk-velocity drag proxy with an additive floor; not validated aerodynamic drag. |
| Re* | `inlet × sx / (nu + 1e-6) × 10`, rounded in live statistics | Scaled lattice estimate. `sx` and the extra factor are inherited conventions, not a validated physical characteristic length/conversion. |
| L/D | Recorded CL divided by recorded CD | Display only; missing/nonfinite CL/CD, nonpositive CD and overflowing ratios are unavailable. A valid zero numerator displays `0.00`. |
| `maxV` | `max(speed) / inlet` when inlet is positive; otherwise producer fallback `0` | Dimensionless maximum speed ratio, never m/s. Live zero/nonpositive-inlet fallback is unavailable. Historical rows lack inlet provenance and are explicitly qualified. |
| Δu | Solver RMS velocity-change diagnostic | Not an accuracy certificate. Initial, restored, stale-setup, invalid and no-valid-fluid samples do not present it as measured convergence. The `<1e-4` sweep stop threshold is labeled heuristic. |
| Flow band | Existing Re* thresholds 2300/4000 | Legacy threshold band, not a validated laminar/turbulent transition diagnosis. Invalid/negative Re* has no band. |

No valid finite speed cells: CL/CD/speed display as unavailable while raw stored values remain intact; Re* still describes the configured estimate. Nonfinite values use em dashes and chart gaps. Negative historical values remain visible; plots include zero. UI formatting never rewrites source records.

Live statistics acquire nonpersisted presentation metadata at the existing telemetry update: sampling time, setup reference and finite-fluid count. Settings changes mark the previous sample stale. Reset/import/gallery load clear live provenance, retaining the existing history behavior. Recorded history has no per-row setup or convergence metadata; none is invented. Loading a session with no history continues to retain existing history, as before, and this is explained in the gallery.

The method panel explicitly identifies a simplified educational **two-dimensional D2Q9 LBM simulation in lattice units**. The 3D extrusion/potential-flow view is qualitative and does not constitute validated full 3D CFD or a prediction for a complete F1 car.

### Unchanged reference cases

Baseline Phase 07 and Phase 08 were served simultaneously. Browser fixtures temporarily held `solver.step` and set known actual solver arrays; the unchanged CFDLab telemetry path performed the calculation. These are numerical regression fixtures, not physical validation or fabricated application defaults.

- Two fluid cells: `(speed, ux, uy) = (.15, .10, .02)` and `(.20, .14, -.01)`. A solid cell and a nonfinite-speed cell were excluded. Inlet `.12`, `sx=75`, `nu=.015`, AoA `5°`.
- Uniform reference: speed/ux `.12`, uy `0`, same setup.

| Case | Baseline | Phase 08 |
| --- | --- | --- |
| Two-cell `{cl, cd, re, maxV}` | `{0.013, 0.018, 6000, 1.667}` | Exact match; L/D `0.72` |
| Uniform `{cl, cd, re, maxV}` | `{0, 0.008, 6000, 1}` | Exact match; CL `0`, L/D `0.00` |

Normal mobile and desktop screenshots can have different Re* because the existing device-dependent lattice/default geometry scale is unchanged. These are not presented as identical physical simulations.

## Charts and sweeps

History figures show the original retained CL and CD records with independent axes, zero baselines, finite tick precision and labeled sample order. Solid versus dashed traces supplement their titles. Sample spacing is explicitly **not physical simulation time**. Missing values split paths at their original positions; isolated finite values receive markers. There is no interpolation, fabricated data, smoothing or sample filtering. Sparklines retain the original last-60-record scope. Tables provide the original recording timestamps and all available metrics; CSV retains every row.

Sweep controls preserve angle of attack, inlet velocity and viscosity; their original defaults and parameter meanings remain intact. Finite descending/equal endpoints are supported. The UI now enforces its advertised 2–100 whole points and rejects nonfinite/unrepresentable intervals; it does not round parameters or change the sweep equation.

Each point still advances the **same solver** for at most 200 steps or until Δu `<1e-4`. Original parameter restoration and automatic CSV are unchanged. A cancelled run keeps its actual partial results and restores the parameter on the next queued frame, without an automatic CSV. Retained results are ephemeral presentation state, not a new storage schema. Radio-selected comparisons calculate display-only ΔCL/ΔCD; exports keep raw original columns.

**Inherited limitation:** viscosity sweeps can classify Re* using the previous viscosity because the original calculation reads the shared params reference immediately after a state update. This phase describes the limitation beside the sweep and does not change its numerical result. Successive points also inherit solver state; neither the stopping rule nor the bands establish physical convergence.

Browser testing found a React/native form-default race when Cancel changed back to a submit button during its click. Cancel now prevents that default before calling the unchanged cancellation callback; it no longer restarts the sweep.

## Export and persistence compatibility

| Contract | Outcome |
| --- | --- |
| `aerolab-session`, version 2 | Same key, fields, five-second cadence, history tail 200 and paused reload behavior. No migration or new persisted metadata. |
| `aerolab-sessions` | Same array/entry schema, maximum ten, history tail 200. Save/delete now report failed writes honestly. Unreadable storage is preserved; invalid gallery profiles cannot be loaded. |
| JSON sessions | Same `app: "aerolab"`, version 2, geometry/solver/display/history/metadata fields, history tail 500 and `aerotunnel-*.json` filenames. Zero-history setup export remains available. |
| History CSV | Exact existing `timestamp,cl,cd,re,maxV` header, row ordering, ISO timestamps and raw number serialization. UI rounding never reaches CSV. |
| Sweep CSV | Exact `${param},cl,cd,ld_ratio,regime` header, original values/order and filename pattern. Manual retained-result CSV equals the automatic CSV byte for byte. |
| Recording | Same native 2D canvas, asynchronous `toBlob`, 300-request cap, PNG names and ZIP structure. Completed frames can be exported after the cap or retried after an initially empty Stop. |
| Solver/session state | Analysis navigation and theme switching preserve solver/canvas/pool identity and all six inspected field arrays while paused; no reload or remount of the solver. |
| Routes/base/assets | Unchanged `/aerotunnel/` base, public assets, URLs, theme persistence, dependency manifests and package lock. |

A 65-record fixture was exported from baseline and current builds: history CSV matched byte for byte (3352 bytes); parsed JSON matched exactly after removing only `metadata.created`. The evidence's baseline `exactCSVandJSONMatch: false` is the original harness's **reference-only marker before any comparison existed**, not a failed comparison. The current entry's `true` records the actual successful assertions.

Malformed timestamps/null rows previously could crash CSV generation. CSV now explains why it cannot encode their time reliably; JSON preserves those original records. Non-array JSON history is rejected before state changes. Valid historical schemas and precision remain accepted.

Recording counter values count capture requests; Stop packages completed PNG blobs. Pending asynchronous encoding remains an inherited timing limitation. No new rendering loop or recording data format was introduced, and this phase claims no new capture guarantee for an abruptly stopped encoding request.

## Verification

Dependencies were already installed; no `npm ci` was needed. Chromium ran through local CDP with isolated browser contexts, testing the built Vite app and a separately served baseline. No remote deployment was used.

| Check | Result |
| --- | --- |
| Baseline `npm run build` | Pass, 52 modules |
| Final `npm run build` | Pass, 57 modules; JS 331.09 kB / 107.72 kB gzip, CSS 90.66 kB / 19.07 kB gzip |
| Baseline tests | 22 pass |
| `node --test tests/*.test.mjs` | 29 pass, including seven new Analysis presentation/compatibility tests |
| Baseline `npm run lint` | 15 errors, 0 warnings |
| Final `npm run lint` | **14 existing errors, 0 warnings; no new finding signatures. Not a clean lint pass.** |
| `git diff --check` | Pass |
| Source protection | Only two pre-existing source/public files modified; all engine files and package/README/HTML baseline content preserved |
| Responsive UI | 320, 375, 768, 1024, 1440px × both themes, initial and paused states; no document horizontal overflow or page errors |
| Active simulation | Running state and ongoing real history verified in Analysis, then paused without resetting the solver |
| Availability | Empty, restored, valid zero, nonfinite fields, no finite fluid cells, zero inlet, missing rows/timestamps and insufficient history |
| Provenance | Paused setup edit marks old sample stale; next real sample replaces it; Reset retains history and clears live convergence provenance |
| Keyboard | Labeled form controls, invalid sweep message, visible focus, native Space scrolling in focusable figure/table regions, retained drafts and focused workspace return |
| History | 65 rows, all three pages reachable; page retained across navigation; no history loss |
| Sweeps | All three variables, three actual points each, progress/result table, reference choice, automatic/manual CSV equality and original parameter restoration; cancellation verified at an explicitly gated real sweep frame |
| Sessions | Named save, legacy load, delete, original history/precision; blocked reads, quota writes, malformed gallery and invalid profile handled visibly |
| JSON / CSV | Actual browser downloads and baseline comparisons; malformed history preserved by JSON and protected from crashing CSV |
| Recording | Real ZIPs after Stop; delayed-PNG retry; real 300-frame cap exported and parsed as 300 ZIP entries |
| Fullscreen / 3D | Analysis fullscreen enters/exits via existing toggle with accessible report scrolling; 3D renders after return from Analysis |
| Theme | Switching twice while paused preserves solver/canvas/pool/field arrays; canonical computed fonts/colors confirmed |
| Final review | Registered regression reviewer ship verdict at reviewed scope; one detector scan, no findings |

Remaining lint findings are existing CFDLab unused bindings and render-time refs (undo/redo and frame counter), a View3D unused helper, exporter catch binding and generated WASM declarations. Removing the former Analysis catch binding accounts for the one-error improvement. Generated code and unrelated lint debt were left intact.

Calculated canonical contrast ratios (WCAG relative luminance): primary/page 13.47:1 light and 14.23:1 dark; supporting text/page 5.45:1 and 8.85:1; supporting text/surface 4.94:1 and 8.00:1; control boundaries/page 4.00:1 and 4.40:1; focus/page 5.90:1 and 6.67:1. A live keyboard scroll-region check confirmed a visible 3px inherited focus outline. Disabled controls remain semantically disabled and visually secondary.

No cross-browser, physical-mobile or screen-reader claim is made. These checks do not validate the physical model. No repeatable Analysis performance baseline existed; no performance improvement or timing claim is made. Rendering and solver loops retain their cadence; the report removes its former chart animation loop.

## Screenshots and evidence

Baseline: [desktop light](screenshots/phase-08-before-paused-light-1440.png), [mobile dark](screenshots/phase-08-before-paused-dark-375.png). Empty and paused baseline captures cover 375/1440px in both themes.

Final real simulation data: [desktop report](screenshots/phase-08-after-report-light-1440.png), [mobile report](screenshots/phase-08-after-report-dark-375.png), [desktop history](screenshots/phase-08-after-history-light-1440.png), [mobile sweep](screenshots/phase-08-after-sweep-dark-375.png), [running desktop](screenshots/phase-08-after-running-light-1440.png), [running mobile](screenshots/phase-08-after-running-dark-375.png). These show actual recorded simulation/sweep results, not design mock values. Full reports were recaptured from document top after a fixed skip-link capture artifact was noticed.

Additional paused screenshots cover all five widths and both themes. The complete inventory, measured styles, fixtures, field-identity checks, edge cases, contrast calculations and test summaries are in [phase-08-verification.json](phase-08-verification.json). Numerical/export fixtures were explicit harness-only test inputs; they were never added as product data. Duplicate fixture screenshots were removed from the final deliverables.

## Changed files in this phase

- `src/CFDLab.jsx` — presentation provenance, retained sweep results, recording-export status, storage/CSV error reporting, persistent Analysis mounting and callbacks. Numerical producers/rendering remain intact.
- `src/components/AnalysisPanel.jsx` — report hierarchy, states, history, gallery and export tools.
- `src/components/AnalysisMetric.jsx` — shared metric presentation.
- `src/components/AnalysisChart.jsx` — finite/gapped SVG figures and existing-scope sparklines.
- `src/components/AnalysisSweep.jsx` — sweep form, status, results, comparisons and compatible re-export.
- `src/analysis/presentation.js` — display-only formatting, provenance, safe plotting, validation and raw sweep CSV serialization.
- `src/styles/analysis.css` — scoped canonical report and responsive/fullscreen styling.
- `tests/analysis.test.mjs` — seven meaningful edge/compatibility tests.
- This report, `phase-08-verification.json` and 30 Phase 08 screenshots.

All pre-existing changes from Phases 01–07 and unrelated `.codex/`, `AGENTS.md` and `f1car/` work were preserved. No other repository was modified. Remaining scientific limitations and existing lint debt above are explicit; no unresolved Phase 08 regression was found in the tested workflows.
