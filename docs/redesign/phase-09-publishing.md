# Phase 09 — Publishable results and suite integration

Completed 17 October 2026, from the completed, uncommitted Phase 08 state. Phase 09 only. No commit, push, deployment, PR or changes to another repository. Phase 10 has not started.

## Publishing interface

**Share & Export** opens a native, keyboard-accessible dialog from Simulation or Analysis. It groups publication images, technical files, recorded frames and article embeds. Analysis retains its direct data/session tools and recording controls through shared components.

Available actions:

- **Save Image** — a publication figure or the original native canvas PNG.
- **Export Data (CSV)** — the unchanged historical numerical columns and values.
- **Save Simulation Session (JSON)** — existing version-2 configuration and sampled history.
- **Load Session** — explicit local JSON file selection, with repeated-file support and visible success/failure messages inside the dialog.
- **Export STL** — the existing profile extrusion, now discoverable alongside other exports whenever a profile is present.
- **Recorded Frames** — the existing native 2D PNG sequence and ZIP workflow, including Stop/export and retained-frame retry.

Controls use the existing canonical surfaces, IBM Plex Sans, readable accents, boundaries and 44px minimum targets. The dialog traps focus natively and closes with Escape. The existing S shortcut saves a publication image; errors are visible even when the dialog is closed. Image capture requires Simulation so an absent 3D view or hidden stale viewport is not silently published. Data, session and STL actions remain available in Analysis.

### Publication PNG

A publication sheet is 2400px wide and includes:

- AEROTUNNEL / F1 STORIES credit, editable title and captured preset/setup.
- Angle of attack, inlet velocity in cells/step and viscosity in cells²/step.
- The frozen scientific image at its original aspect ratio, without application controls.
- Field name, actual range, applicable lattice units and normalization interpretation.
- Optional color bars and method paragraph; essential field/units/3D caveats remain even with those options off.
- Current warnings, capture time, running/paused status and original canvas pixel dimensions.

Light and dark sheet styles derive from the existing canonical core: paper `#f2eee4` / ink `#20251f`, charcoal `#1b1a19` / text `#eee8db`, with the existing supporting text/borders and a restrained `#ed4c32` rule. Changing the figure style does not change the application theme or its preference.

The 2D capture request is serviced immediately after the existing render completes. Exact per-frame fields/ranges are passed with the pixels, independently of the throttled on-screen legend. 3D services the request immediately after `renderer.render`, before WebGL can clear its drawing buffer. A detached canvas freezes the pixels before asynchronous font loading or PNG encoding. This avoids a moving image with an older scale. It does not pause, reset or remount the solver.

The compositor uses the existing self-hosted Barlow Condensed and IBM Plex Sans, loading the needed Greek glyphs. It fits the source uniformly and disables image smoothing; it does not recolor or invert heatmap pixels. Enlarging a source canvas to a 2400px sheet adds no simulation detail, which the dialog explains. Native layout preserves the old backing dimensions and excludes publication text; it remains a technical output.

Scientific interpretation remains explicit:

| View | Published interpretation |
| --- | --- |
| Velocity | Speed magnitude, cells/step; actual automatic range |
| Pressure | Raw lattice density ρ, a pressure proxy, **not Pa** |
| Streamlines | Particle pathlines; trail bands encode age, not speed; no fabricated scalar bar |
| Vorticity | Signed ωz in inverse lattice steps; automatic range, no fixed zero color |
| Vectors | Speed-colored arrows plus dimmed scalar background; capped arrow length |
| Schlieren | Vertical density gradient magnitude in lattice density/cell, normalized contrast |
| 3D | Qualitative extrusion/potential-flow illustration; not a 3D LBM solution |
| Comparison | Actual A/B fields, independently normalized legends; optional red normalized difference is dimensionless, not a physical subtraction |

Default comparison titles name the captured A/B fields rather than an inactive base mode. A 3D reference-model caption is added only when the GLB model is actually loaded and visible. No historical CL/CD values or other unrelated numerical indicators are stamped onto the image. The method note does not present this simplified 2D model as validated full-car CFD.

Range text deliberately retains Phase 07's eight-significant-digit formatter. Some floating-point tails remain visible; rounding density fields aggressively could erase small but meaningful differences. No LUT, normalization, numerical metric or solver equation changed.

## Reproducibility and format compatibility

| Output | Preserved contract / limits |
| --- | --- |
| Native PNG | Original canvas pixels/dimensions; same `aerotunnel-<timestamp>.png` filename pattern. No DOM overlays. |
| Publication PNG | New contextual presentation of a frozen displayed frame; same PNG filename prefix. The image is not a serialized solver state. |
| History CSV | Exact `timestamp,cl,cd,re,maxV` header, ISO timestamps, row order and raw numeric serialization. UI formatting does not alter data. |
| JSON | Same `app: "aerolab"`, version 2, geometry/solver/display/history/metadata schema and history-tail behavior. Existing parser/exporter are reused. |
| STL | Same binary writer, geometry inputs, lattice-coordinate extrusion, header and `aerotunnel-profile.stl` name. Not validated 3D flow or a manufacturing guarantee. |
| Recorded frames | Same native 2D canvas, asynchronous PNG capture, 300-request cap, ordered PNG names and store-only ZIP builder. No 3D or publication wrapper. |
| Sweep CSV | Existing automatic and retained-result exports unchanged, including header, values, ordering and parameter restoration. |
| Browser persistence | Standalone `aerolab-session`, `aerolab-sessions`, version 2 and shared `f1stories-theme` semantics retained. No migration or new persisted publishing preferences. |

JSON contains setup and sampled history; it does **not** contain LBM distribution arrays, current velocity/density fields, particle state, random state or complete execution/environment context. It must not be advertised as deterministic replay. Recording preserves image sequence order, not a synchronized per-frame numerical timeline. A saved figure plus JSON documents the display/setup but does not reconstruct that exact running solver state.

A baseline/candidate browser fixture containing twelve actual test records produced byte-identical CSV (603 bytes) and STL (12,484 bytes, 248 triangles). Parsed JSON matched exactly after excluding only `metadata.created`. The baseline check is labeled a reference capture, not a failed comparison. The candidate is the actual equality assertion. Native canvas dimensions also match the original backing buffers: 640×320 in the tested mobile context and 1000×450 on desktop.

All 199 snapshotted files under `src/engine/` are byte-identical to Phase 08; the reviewer independently checked the 18 engine source/package files. `engine/exporters.js`, solver/WASM, LUTs, geometry math, recording capture loop and CSV/JSON/STL payload generation were preserved. Main-loop additions only service explicit image-capture requests and attach presentation metadata. Recording's request counter is mirrored through the existing 500ms UI update rather than read during rendering.

PNG object URLs are revoked after a short download delay; capture timers/requests are cleared on completion, timeout or unmount. Existing technical download callbacks retain their cleanup. Failed encoding/loading shows a visible error and releases the busy state for retry. Native recordings retain their inherited asynchronous encoding limitation: Stop packages completed blobs, and initially empty captures can be retried once encoding completes.

## Input and privacy boundary

The integration/security investigation found imported text could reach raw CSV cells. A history value such as `cl: "=1+1"` is now rejected for CSV, without executing it, escaping/rewriting it or changing valid numeric CSV. Raw JSON remains available. Nonfinite metrics likewise block CSV. Existing missing-timestamp protection remains intact. This closes the spreadsheet-formula/text-cell route while preserving source records.

Malformed preset types and unsupported visualization IDs are rejected before React state changes. Normal historical preset names, finite settings, JSON markers and numerical precision remain accepted. Tests include invalid JSON/session identity, malformed preset data, unsupported modes, formula-like history, empty data and repeated re-import of the same file.

Local files are processed client-side. No backend, upload, account service, remote session fetch or new dependency was added. The existing 3D renderer still requests pinned third-party Three.js/loader/Draco resources; the application is not claimed to be fully offline. Manual geometry/session imports retain inherited local-resource risks, including whole-file decoding and very large finite execution settings. This phase does not expose that import boundary through URL parameters or messages, or claim a comprehensive import-security audit.

## Lightweight article embed

Implemented URL after this version is manually deployed:

`https://georgiosbalatzis.github.io/aerotunnel/?embed=1`

Only the exact `embed=1` presentation flag is read. There are no URL geometry/history/session parameters, remote import URLs, parent-state messages or wildcard `postMessage` responses. Additional query data and dropped files are ignored in embed mode.

The embed has minimal attribution/navigation, explicit Start/Pause, fullscreen, all seven visualization modes, field interpretation and a standalone link. Global site navigation, editing panels, analysis/gallery and export controls are absent from the active interface. A narrow-width hint makes horizontal mode scrolling discoverable, and keyboard focus scrolls the last of all seven buttons into view.

Embeds start with the default F1 model and skip both private session restoration and the five-second autosave. They never share the current workspace. The code-copy interface explicitly says that it contains none of the user's geometry, parameters, history or saved-session names. The full-workspace link opens the ordinary application, which may restore its own local state after that explicit user action; it does not transfer the embedded run.

Canonical theme preference remains child-origin behavior with OS fallback. There is no parent theme/resize handshake, cross-origin storage access or automatic iframe height negotiation. GitHub Pages sibling projects share an origin; `f1-stories.gr` does not share that storage. Browser partitioning/blocking can change third-party theme behavior without making sessions part of the URL.

Copyable markup (also available in the publishing dialog):

```html
<iframe
  src="https://georgiosbalatzis.github.io/aerotunnel/?embed=1"
  title="AeroTunnel — educational 2D flow simulation"
  width="100%" height="640" loading="lazy"
  referrerpolicy="strict-origin-when-cross-origin"
  sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
  allow="fullscreen"></iframe>
```

Use a responsive block container and at least 560px height on narrow screens; retain an ordinary open-tool link in the article. Script/origin permissions support WASM and existing resources. Popup permissions support only user-activated return links; no top-navigation, download, clipboard or unrelated device permission is granted to the embed. This sandbox is intended for the verified trusted app on a different origin, not an untrusted same-origin upload.

Validation used a parent at `http://localhost:5176` and child at `http://127.0.0.1:5174`, with a restrictive parent CSP allowing only the child frame and inline host styling. Browser checks exercised the actual sandbox, external-resource/WASM loading, private-storage isolation, explicit keyboard Start, focus, fullscreen, 3D and the new-tab return link. Six width/theme cases checked layout/storage; fullscreen/3D/return were exercised specifically in the 1440px dark case. Narrow 560px-height checks retain at least 130px of visible canvas with no document width overflow.

**Unsupported / pending hosting checks:** a host must allow the iframe in `frame-src`; restrictive frame-ancestor/X-Frame-Options, COEP/CORP, Permissions Policy or blocked CDN resources may prevent it. Vite's development COOP/COEP settings are not a production guarantee. The new version has not been deployed, so hosted-version checks remain a release task. Do not proxy the app, add wildcard messaging, disable host protections or claim a managed resize/theme protocol to work around these constraints.

## Metadata and real destinations

HTML description, Open Graph/Twitter descriptions and WebApplication JSON-LD now identify educational 2D D2Q9 LBM in lattice units, qualitative 3D and client-side figure/data exports. Canonical/OG URLs point to the existing GitHub Pages path. A summary card uses the existing F1 Stories parent-brand asset; it does not publish a private simulation image or imply a new `f1-stories.gr` app deployment.

On 17 October, read-only HTTP HEAD checks returned 200 for AeroTunnel, F1 Stories, THE GRID, Telemetry, GhostCar and Tyres. All destinations retain their real standalone URLs. No frame-restricting headers were returned by those HEAD responses; this observation is not a guarantee of future/embedded production behavior. See the verification JSON for exact URLs and returned headers. The web browsing tool could not open these sites, so direct HTTP checks supplied the evidence.

## Main F1 Stories integration checklist — documentation only

No main-site file was modified. After an authorized AeroTunnel deployment and hosted embed check:

1. Update `../f1StoriesPage/docs/race-desk-architecture.md` to add the fifth product/order and its actual GitHub Pages URL. Preserve F1 STORIES → RACE DESK → application hierarchy.
2. Add an AEROTUNNEL item after TYRES in `../f1StoriesPage/partials/race-desk-index.html`. Suggested Greek description: “Εκπαιδευτική προσομοίωση δισδιάστατης ροής με LBM.” Identify the method as `2D LBM · lattice units`; do not invent an external data source or validated F1-car accuracy claim.
3. Append the ordinary same-tab product link in `../f1StoriesPage/standings/index.html`'s Race Desk switcher. THE GRID retains `aria-current="page"` there. Preserve AeroTunnel's already active fifth entry in this repository. Do not add a product to the global editorial masthead by default.
4. Update the exact-four registry/order/count expectations in `../f1StoriesPage/scripts/build/__tests__/race-desk-index.test.mjs`. Run that repository's normal include/build/stamping pipeline (`scripts/build/include.mjs`) so generated homepage and THE GRID copies stay synchronized; run its tests. Do not hand-edit only the built copies.
5. For an article, follow the open-tool link plus lazy `.embed-container.embed-iframe` convention demonstrated by `blog-module/blog-entries/20260329G/article.html`. Use the fixed-height attributed default embed above and verify it at the actual article width.
6. `scripts/build/security-policy.mjs` already permits the GitHub host, but confirm the final article's CSP and frame behavior after building. Keep required permissions narrow.
7. The managed bridge in `blog-module/blog/article-embeds.js` has a strict app/path allowlist. Related selectors live in `blog-module/blog/article-script.js` and markers in `scripts/build/stamp-html.mjs`. AeroTunnel has no message/resize/theme protocol. Do not add it to that managed bridge and promise automatic sizing until a separate, origin-validated protocol is explicitly implemented and tested. Fixed-height embedding needs no such claim.
8. Recheck the live `.../aerotunnel/?embed=1`, all five suite links, keyboard/focus, return link, 2D/3D/WASM, blocked-storage fallback and target browser/host policies. The Race Desk switcher remains navigation, not an iframe/proxy.

## Independent research and verification

Three registered agents ran concurrently, read-only; all initial findings returned before implementation. The lead owned all edits.

| Actual registered agent | Investigation / result |
| --- | --- |
| `code_mapper` — GPT-6 Luna/high | Export callbacks, schemas, cleanup, recording and STL. Later mapped exact main-site integration files. |
| `design_auditor` — GPT-6 Luna/high | GhostCar figure export (`src/features/analysis/exportFigure.js`, `ComparisonFigure.jsx`, `AnalysisFigures.jsx`), telemetry `src/embeds/exportFigure.tsx` / `EmbedComposer.tsx`, and THE GRID embed conventions. Fixed role configuration is high, despite the brief's medium preference. Its initially stale Phase 08 report/line references were explicitly corrected against the current checkout. |
| `regression_reviewer` — GPT-6.1 Sol/high | Base/origin/storage/file boundaries, CSV issue and completed-source review. All source findings resolved. |

The final visual review found no blocking publication-image issue; its narrow embed scroll-cue finding was resolved and rechecked. The final regression verdict was **ship at the reviewed Phase 09 scope**, with no outstanding actionable findings. One Impeccable detector scan across twelve changed source/test/HTML targets returned `[]`, exit 0. No second scan ran. Impeccable, Ponytail and existing Chrome automation guidance supported the bounded implementation; no new design system was invented.

| Validation | Actual result |
| --- | --- |
| Baseline | Build passes; 29 tests; lint 14 errors / 0 warnings |
| Final `npm run build` | Pass, 62 modules; JS 346.19 kB / 112.88 kB gzip, CSS 95.49 kB / 19.75 kB gzip |
| `node --test tests/*.test.mjs` | **36 pass**, including seven new publishing/compatibility tests |
| Final `npm run lint` | **11 existing errors / 0 warnings; no new finding signatures. Not a clean lint pass.** |
| `git diff --check` | Pass |
| Native/publication image downloads | All seven modes, mobile/desktop, light/dark sheets and native dimensions; real PNGs opened and inspected |
| Scientific pixel fidelity | 120/120 sampled source pixels match the enlarged publication plot, including comparison; smoothing disabled and aspect fit checked |
| Capture lifecycle | Paused solver/canvas/pool/field identities preserved; a real running capture retains running solver and prints the captured running state |
| Error recovery | Long Greek title bounds, optional legend/method, encoding failure, retry and unavailable-3D timeout checked; no page errors |
| Formats/imports | CSV/JSON/STL baseline equivalence; repeated open-dialog file picker re-import; malformed identity/preset/mode rejected; empty data; formula-like CSV blocked with raw JSON retained |
| Frames and sweeps | Actual PNG ZIP entries and names; existing AoA sweep CSV still downloads; core implementations unchanged |
| Resources | Repeated technical downloads leave no live object URLs in the measured workflow; new PNG path has explicit delayed revocation; failed capture clears pending work |
| Embed | Six cross-origin width/theme cases at 320/375/768/1440px; private keys not read/written beyond the autosave interval; 560px-height confirmation, keyboard/focus, no horizontal page overflow |
| Clipboard / metadata | Actual copied code contains only fixed presentation flag, no run/session data; static metadata reviewed; six destination HEAD checks pass |

Dependencies were installed already; `npm ci` was not needed. Existing lint debt remains in CFDLab unused bindings, the View3D unused helper, exporter catch binding and generated WASM declarations. Moving the recording count out of render also changes the lint tool's ref analysis; no claim is made that unrelated undo/redo code was redesigned. No dependency, package-lock, Vite-base or deployment configuration change was made.

No physical-device, other-browser, production-host, deterministic-replay, full-3D-CFD or performance improvement claim is made. The inherited viscosity-sweep Re* limitation from Phase 08 remains unchanged.

## Evidence and changed files

[Verification and reproducibility evidence](phase-09-verification.json) contains exact checks, fixtures, dimensions, URL results, source protection and artifact inventory.

Publication examples from real simulation captures:

- [Light velocity with Greek title](exports/phase-09-velocity-light-1440.png), [dark velocity](exports/phase-09-velocity-dark-1440.png), [mobile-origin figure](exports/phase-09-velocity-light-375.png).
- [Pressure/density](exports/phase-09-pressure.png), [vorticity](exports/phase-09-vorticity.png), [pathlines](exports/phase-09-streamlines.png), [vectors](exports/phase-09-vectors.png), [Schlieren](exports/phase-09-schlieren.png).
- [Qualified 3D](exports/phase-09-3d-view.png), [A/B comparison](exports/phase-09-comparison.png), [capture during a live run](exports/phase-09-running.png).
- [Original native export before this phase](exports/phase-09-before-native.png) is an explicitly uncaptioned baseline reference; native technical examples remain available in the inventory.

Interface evidence: [desktop dialog](screenshots/phase-09-publishing-light-1440.png), [mobile dialog](screenshots/phase-09-publishing-dark-375.png), [320px embed with scroll cue](screenshots/phase-09-embed-active-light-320.png), [375px embed](screenshots/phase-09-embed-active-dark-375.png), [desktop embed](screenshots/phase-09-embed-active-dark-1440.png), [3D embed](screenshots/phase-09-embed-3d-dark-1440.png). Nine browser screenshots and fifteen PNG export artifacts are retained; redundant intermediate/stress-test images were removed. Numerical test fixtures were harness-only inputs, never added as product defaults.

Phase-specific application/test changes:

- `src/CFDLab.jsx` — capture requests/metadata, publishing callbacks, shared actions, explicit file picker, ephemeral embed shell and recording-count UI mirror.
- `src/components/View3D.jsx` — post-render capture hook and actual reference-model visibility metadata.
- `src/components/AnalysisPanel.jsx` — shared export/recording components; scientific report and sweeps retained.
- `src/analysis/presentation.js` — compatible CSV eligibility guard for unsafe/nonfinite metric cells.
- `src/controls/validation.js` — safe preset type and supported visualization validation.
- New `src/publishing/figure.js`, `PublishingDialog.jsx`, `ExportActions.jsx`, `RecordedFrames.jsx`, `src/styles/publishing.css` and `tests/publishing.test.mjs`.
- `index.html` — accurate public metadata/structured data.
- This report, verification JSON and documented artifacts.

All unrelated and Phase 01–08 work remains intact. README, manifests, Vite config, fonts, brand assets, routes, engine/export helpers and other repositories were preserved. The remaining limitations above are documented rather than hidden behind a claimed deployment or replay guarantee.
