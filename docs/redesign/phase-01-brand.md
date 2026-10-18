# Phase 01 — AeroTunnel brand identity

Completed 2026-10-16. Scope: public identity only. Phase 02 has not started.

## Repository and ownership

- `git fetch origin` confirmed local `main` and `origin/main` both at `6116886` (0 ahead / 0 behind).
- Initial tracked worktree was clean. Existing untracked `.codex/`, `AGENTS.md`, and `f1car/` were preserved.
- The lead agent made all application and documentation changes. Three registered subagents performed independent read-only investigations in parallel; all returned before implementation.
- No commit, push, deployment or PR was performed.

## Public identity

| Role | Name |
| --- | --- |
| Parent | F1 STORIES |
| Product | AEROTUNNEL |
| Descriptor | Aerodynamics & Flow Simulation |

`src/components/BrandWordmark.jsx` is a small text-only lockup reused by the existing title chip and About heading. The parent wordmark uses the reference site's terminal dot (`F1 STORIES.`); the product remains `AEROTUNNEL`. It uses the already-loaded Barlow Condensed at weight 700. The title chip keeps its existing position and height; the descriptor appears in its title and visibly in About.

No application-wide font, palette, layout, navigation, theme, simulation or capture behavior was redesigned. The longer About title uses a bounded font size to fit mobile.

## Reference research and asset provenance

The design auditor identified these first-party sources:

| Repository / source | Finding |
| --- | --- |
| [f1StoriesPage/index.html](https://github.com/georgiosbalatzis/f1StoriesPage/blob/7752e95c28b63824e307b3e204c503d497e24a3a/index.html) | Text `F1 STORIES.` wordmark, `home-nav-wordmark`, and `images/logo-nav.webp` navigation icon |
| [f1StoriesPage/docs/design-tokens.md](https://github.com/georgiosbalatzis/f1StoriesPage/blob/7752e95c28b63824e307b3e204c503d497e24a3a/docs/design-tokens.md) | Canonical authority is `styles/editorial.css`; IBM Plex Sans for UI and Barlow Condensed 700 for brand/product labels |
| [ghostcar/index.html](https://github.com/georgiosbalatzis/ghostcar/blob/272ed822b7895b54a15164442eca618369dccaf5/index.html) | Parent/product title pattern and `og:site_name`; font provenance in `src/assets/fonts/README.md` |
| [Tyres/index.html](https://github.com/georgiosbalatzis/Tyres/blob/4ca0e9e090e81d3977e9c9ae3998a03ad360d3ae/index.html) | Parent wordmark, product title and descriptor hierarchy; supporting `src/styles/tokens.css` and `docs/DESIGN-SYSTEM.md` |

Adopted assets:

- `public/brand/f1-stories-logo.webp` is an unmodified byte copy of [f1StoriesPage/images/logo-nav.webp](https://github.com/georgiosbalatzis/f1StoriesPage/blob/7752e95c28b63824e307b3e204c503d497e24a3a/images/logo-nav.webp). SHA-256: `015151f5f0faef773204c8c563f885f1fa4ca0f7ca96683ec96fdf211970e679`.
- `public/favicon.svg` retains its existing public path and embeds the unmodified PNG bytes from [f1StoriesPage/images/icons/favicon-32.png](https://github.com/georgiosbalatzis/f1StoriesPage/blob/7752e95c28b63824e307b3e204c503d497e24a3a/images/icons/favicon-32.png). Embedded PNG SHA-256: `de7626891fec5a7ee7bfb7809bfe29edf4a9d3ec07ee37a5dbfb3f7c4c359282`.
- `F1Logo.jsx` retains its component name/API but now displays the sourced icon beside the parent-brand link. Its empty alt avoids repeating that link's accessible name. Vite's `BASE_URL` makes the new local asset resolve under `/aerotunnel/`.

These are the owner's first-party ecosystem assets, used for the requested ecosystem identity. No separate open redistribution license was established; no such license is claimed. No unrelated Formula 1 logo or hand-drawn approximation was adopted. GhostCar's `public/f1-stories-logo.svg` was rejected as a canonical source because its locally authored treatment differs from the actual parent navbar. Unused React/Vite template assets remain untouched.

## Old-name / new-name audit

| Surface / files | Before | After |
| --- | --- | --- |
| `index.html` title, description, OG and Twitter titles/descriptions | AeroLab / f1stories.gr; missing Twitter description | AEROTUNNEL, exact descriptor, F1 STORIES; Twitter description added |
| `index.html` author and OG site name | f1stories.gr | F1 STORIES |
| `components/CommandBar.jsx` | AEROLAB | Reusable parent/product wordmark |
| `components/AboutPanel.jsx` | Aero / Lab heading, AeroLab prose, domain tag | Shared AEROTUNNEL heading, descriptor, F1 STORIES and corrected prose |
| `cfdlab.css` About decoration | AEROLAB | AEROTUNNEL |
| `components/IconRail.jsx` accessible navigation label | AeroLab rail navigation | AEROTUNNEL rail navigation |
| `CFDLab.jsx`, `components/ControlPanel.jsx` import error | Not a valid AeroLab session file | Not a valid AEROTUNNEL session file |
| `CFDLab.jsx` screenshot-mode DOM watermark | AEROLAB | F1 STORIES · AEROTUNNEL |
| `CFDLab.jsx` PNG/CSV/sweep/recording ZIP and frame names | aerolab-* | aerotunnel-* |
| `engine/exporters.js` JSON and STL filenames | aerolab-* | aerotunnel-* |
| `engine/exporters.js` descriptive STL header | AeroLab STL Export | AEROTUNNEL STL Export |
| `components/F1Logo.jsx`, `public/favicon.svg` | Unsourced decorative mark / template favicon | Actual first-party parent-brand icon / favicon |
| `components/ControlPanel.jsx` footer link text | f1stories.gr | F1 STORIES (destination unchanged) |
| `README.md` public title/prose/credit | AeroTunnel / domain credit | AEROTUNNEL, descriptor and F1 STORIES; technical sections and application URLs retained |

Remaining old-name occurrences are intentional internal compatibility identifiers, developer comments or the developer-console solver message. They are not product labels. No internal component/function renames were needed.

## Compatibility decisions

| Contract | Decision / exact location |
| --- | --- |
| Autosave key | Keep `aerolab-session`, `SESSION_VERSION = 2` in `src/CFDLab.jsx` |
| Saved-session gallery | Keep `aerolab-sessions` in `src/CFDLab.jsx` and independent reader `src/components/AnalysisPanel.jsx` |
| JSON format | Keep `app: "aerolab"`, version, fields, defaults and values in `src/engine/exporters.js` |
| Historical JSON imports | Keep the discriminator in `parseSessionJSON` and the separate `src/components/ControlPanel.jsx` importer |
| Theme storage | Keep `aerotunnel-theme` and existing theme behavior in `src/ThemeContext.jsx` |
| Solver / WASM | Keep all engine imports, `aerolab-lbm`, generated `aerolab_lbm.*` files and package names |
| Three.js marker | Keep `dataset.aerolabThree` in `src/components/View3D.jsx` |
| Deployment | Keep repository URLs, GitHub Pages path and Vite `base: '/aerotunnel/'` |
| Export contents | Keep CSV columns, ZIP construction and STL triangle bytes; only filenames and the nonstructural STL header text change |

JSON imports dispatch by file extension and payload identity, not the filename prefix. Existing downloads remain importable. External automation that explicitly matches `aerolab-*` filenames must allow the new `aerotunnel-*` prefix for future downloads.

## Actual subagent findings and review

- **design_auditor — Agent A:** researched parent and sibling sources, canonical wordmark/icon/font/title conventions; rejected the GhostCar approximation and recorded provenance limits. Those findings informed the text lockup and sourced assets.
- **code_mapper — Agent B:** enumerated the public identity surfaces above and distinguished them from storage/schema/module identifiers. Its audit informed the complete label and export-name pass.
- **regression_reviewer — Agent C:** traced both session import paths, independent gallery reader, export formats, deployment base and JS/WASM names. It returned a compatibility checklist, then inspected the completed diff in a second read-only pass and found no actionable regression.
- The registered profiles prescribe Luna/high for design_auditor and code_mapper, and GPT-6.1 Sol/high for regression_reviewer. Those fixed role settings take precedence over the requested medium effort. The lead's runtime model is session-controlled and cannot be switched by these tools.

## Validation

Dependencies were already installed; `npm ci` was unnecessary. No test script or existing automated test files were found.

| Check | Baseline | Updated |
| --- | --- | --- |
| `npm run build` | Pass | Pass; 38 transformed modules |
| `npm run lint` | Fail: 19 errors, 0 warnings | Same 19 errors, 0 warnings; diagnostic files/rules/messages compared after normalizing line shifts |
| `git diff --check` | — | Pass |
| Session JSON equivalence, fixed time | HEAD export reference | Reviewer: byte-identical exported JSON; historical/new parser accepts both versions of the export |
| Binary STL equivalence | HEAD export reference | Reviewer: bytes from offset 80 onward identical; only branding header differs |
| Persisted contracts | Existing keys/version/discriminators | Reviewer: unchanged |
| Browser 2D / 3D | Baseline screenshots | 2D renders; selecting 3D mounts both stage canvases; no page errors in updated desktop/mobile 2D checks |
| Local brand assets | — | Logo loads; built favicon URL uses `/aerotunnel/`, returns 200 and decodes successfully |
| Mobile identity | — | Title chip fits 390px viewport; About wordmark also fits |

Final development-server log inspection exposed repeated WASM `RuntimeError: memory access out of bounds` in `LBM.step` / `WasmLBM.step` during browser/viewport experiments. The same errors appeared in the isolated unchanged `git archive HEAD` development baseline. They did not appear in the successful production-preview 2D page-error check. This is an unresolved baseline development/WASM risk; the smoke results above must not be read as proof that every solver path is healthy. No solver code was changed. Early About harness attempts also failed because of harness module/ThemeProvider setup; the final successful harness mounted AboutPanel directly using the already-running page's theme.

The existing lint findings are in `src/CFDLab.jsx` (unused values, empty catch, refs during render), `AnalysisPanel.jsx`, `CommandBar.jsx`, `ControlPanel.jsx`, `View3D.jsx`, `engine/exporters.js`, and generated `engine/solver-wasm-pkg/aerolab_lbm.js`. They were not repaired in this identity phase.

The Impeccable mechanical detector reported eight warnings on existing CSS accent borders and layout-property transitions. None came from new brand rules; those unrelated styles remain unchanged.

### Screenshots and browser method

The shared Chrome DevTools CLI could list pages but repeatedly timed out creating a new page. Browser verification used an already-installed Playwright package and a separate local headless Chrome process; no project dependency was added.

Initial baseline captures were taken before application edits. Because those caught startup fades, the delivered baseline captures were refreshed from an isolated `git archive HEAD` copy of the unchanged baseline. Both delivered baseline and updated app captures use reduced motion, matching viewport sizes and fresh storage. The simulation runs in real time, so these are visual evidence, not deterministic pixel comparisons.

| View | Before | After |
| --- | --- | --- |
| Desktop 1440×900 | [Baseline](screenshots/phase-01-before-desktop.png) | [Updated](screenshots/phase-01-after-desktop.png) |
| Mobile 390×844 | [Baseline](screenshots/phase-01-before-mobile.png) | [Updated](screenshots/phase-01-after-mobile.png) |
| About component | — | [Desktop](screenshots/phase-01-about-desktop.png), [mobile](screenshots/phase-01-about-mobile.png) |

The existing rail does not expose About. Its screenshots therefore use a browser-only component harness, mounting the actual AboutPanel over the running page with its existing stylesheet and theme. No route or application navigation was added.

## Changed files

- `README.md`: public branding description and parent credit.
- `index.html`: page and social metadata.
- `public/favicon.svg`: first-party embedded favicon, existing path retained.
- `public/brand/f1-stories-logo.webp`: sourced parent icon.
- `src/components/BrandWordmark.jsx`: reusable parent/product text treatment.
- `src/components/CommandBar.jsx`, `AboutPanel.jsx`: wordmark and descriptor.
- `src/components/F1Logo.jsx`, `ControlPanel.jsx`: sourced parent icon/link; corrected import error.
- `src/components/IconRail.jsx`: accessible public product label.
- `src/CFDLab.jsx`: public error, watermark and export filenames.
- `src/engine/exporters.js`: download names and descriptive STL header only.
- `src/cfdlab.css`: wordmark styles, bounded About title, corrected decoration.
- `docs/redesign/phase-01-brand.md` and six PNGs under `docs/redesign/screenshots/`: audit, decisions, findings and evidence.

## Limitations and unresolved risks

- Existing lint failures remain. No numerical benchmark suite exists; preservation is supported by the scoped diff, compatibility assertions and 2D/3D smoke checks, not a full CFD benchmark.
- Development browser runs logged WASM memory-access errors in both the unchanged baseline and modified application. This pre-existing issue remains unresolved and needs a separate engine investigation; production-preview smoke checks have narrower coverage.
- The current ThemeProvider forces dark mode. Light-mode behavior and full IBM Plex Sans/UI token migration remain outside Phase 01; new brand text inherits the existing semantic colors.
- The existing snapshot action exports the canvas alone; its DOM watermark is not composited into downloaded PNGs. This phase corrects the existing watermark label without changing capture behavior.
- About remains absent from the current rail; it was checked in isolation rather than through a newly added navigation path.
- Parent asset provenance is recorded above; a separate permissive asset license was not established.
- Export filename consumers may need the new prefix. Persisted sessions and data formats require no migration.

Stopped after Phase 01.
