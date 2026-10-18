# Phase 03 — Complete light/dark theme support

Completed 2026-10-16, starting from completed Phases 01 and 02. Phase 04 has not started. No commit, push, deploy or PR was performed.

## Scope and implementation

Read project `AGENTS.md` and the earlier phase reports, inspected git status, and preserved their uncommitted work and the existing `.codex/`, `AGENTS.md`, and `f1car/` paths.

`public/theme.js` now owns theme resolution and the live preference state. It loads synchronously in the document head before the application module. The canonical token stylesheet also loads through the head; the initial HTML background, `data-theme`, native `color-scheme`, and browser `theme-color` metadata therefore agree before React renders. Vite retains the blocking bootstrap at `/aerotunnel/theme.js` in production. The token stylesheet is no longer redundantly imported by `cfdlab.css`.

`ThemeContext.jsx` subscribes to this controller with `useSyncExternalStore`. The forced-dark effect, old-key write and no-op toggle were removed. The existing context interface still supplies `mode`, `isDark`, and `toggle`.

The actual toggle lives in the existing global identity chip. It is a native 44×44px button with a stable accessible name, **Dark theme**, and `aria-pressed` reflecting whether dark is active. Its moon/sun icon reflects the current edition; its title describes the action. Enter and Space work. The button stops Space propagation so the application's existing global Space shortcut cannot also pause/run the solver. It retains the canonical visible focus ring.

The chip and mode-bar spacing were adjusted only as needed to keep this control usable at narrow and intermediate widths. The mode bar scrolls horizontally on narrow screens instead of covering the toggle. The separate scientific sketch surface stays dark. Fixed chart annotation neutrals now use readable technical ink; trace colors, values and formatting are unchanged.

## Verified F1 STORIES preference contract

Sources inspected by the researcher and lead:

- [Main site scripts/theme-init.js](https://github.com/georgiosbalatzis/f1StoriesPage/blob/main/scripts/theme-init.js): canonical key, explicit values, session fallback, OS resolution, blocking initialization and same-origin standings storage handling.
- [GhostCar useThemePreference.js](https://github.com/georgiosbalatzis/ghostcar/blob/main/src/hooks/useThemePreference.js) and [docs/theme.md](https://github.com/georgiosbalatzis/ghostcar/blob/main/docs/theme.md): shared key, user-triggered persistence, app-specific defaults and embed rules.
- [Tyres public/theme.js](https://github.com/georgiosbalatzis/Tyres/blob/main/public/theme.js): shared key, OS/default fallback, synchronous head script and explicit toggle writes.

AeroTunnel uses **`f1stories-theme`** with explicit **`light`** and **`dark`** values. It follows the main/Tyres OS/default precedence rather than GhostCar's historical paper default. A valid canonical sessionStorage fallback is promoted to localStorage when possible, matching the main site. No fresh OS-derived default is saved.

GhostCar's `auto` is preserved as stored text and treated as OS-following here. Invalid or empty values also fall through without rewriting them. Live OS tracking and same-origin storage synchronization extend the shared preference behavior to satisfy this phase's runtime requirements; they do not invent new stored values.

## Theme decision matrix

| Situation | Applied theme | Storage action |
| --- | --- | --- |
| Valid canonical local `light` / `dark` | Saved choice, regardless of OS | None at startup |
| No valid local choice, valid canonical session choice | Session choice | Attempt existing-choice promotion to local; remove session entry only after success |
| Missing, invalid, empty or `auto`, no valid session choice | OS light if available; otherwise dark | None |
| OS changes without explicit choice | Follow OS live | None |
| OS changes after explicit choice | Keep explicit choice | None |
| User clicks / presses Enter / Space on toggle | Opposite edition | Save canonical local choice; remove obsolete canonical session fallback after success |
| Local write fails | Apply immediately | Attempt canonical sessionStorage fallback |
| Both stores unavailable | Apply immediately in the current tab | Keep selection in memory |
| Same-origin shared-key change in another document | Resolve new saved choice | No new default write |
| Shared-key removal / storage clear | Re-resolve session/OS fallback | No OS-derived write |
| Reload | Resolve persisted canonical preference before React | No forced-dark overwrite |
| Only old `aerotunnel-theme` exists | Resolve canonical session/OS fallback | Leave old key unchanged |

### Historical compatibility decision

The old `aerotunnel-theme` key was automatically written as `dark` by the forced-dark provider even though the toggle was inert. It cannot reliably distinguish user intent from an automatic write. This phase therefore preserves that value in storage but does not promote or consult it as an explicit preference. Users with that obsolete value and a light OS now receive the light edition until they make a canonical selection. A valid shared choice always wins.

No session, preset, geometry, solver, import/export or deployment key/path was renamed. In particular, `aerolab-session`, `aerolab-sessions`, session version and JSON `app: "aerolab"` remain unchanged.

## Scientific visualization and simulation continuity

The Phase 02 token file is byte-identical. Ordinary surfaces, controls, notices and analysis areas select its theme edition. Scientific canvases, field/series colors, legend ramp, fixed technical foregrounds, 3D environment/material colors and numerical interpretation stay independent. There is no inversion/filter applied to the actual heatmap.

`CFDLab.jsx` and `IconRail.jsx` are byte-identical to their Phase 02 snapshots. Theme state was not added to solver/renderer effects, props or component keys. Only CommandBar consumes the context; switching does not replace the simulation tree.

The successful browser continuity checks used the existing React refs without adding application test hooks:

- Paused: same actual solver, canvas and particle-pool objects; all six `rho`, `ux`, `uy`, `spd`, `curl`, and `solid` arrays remain identical; parameters and navigation origin remain unchanged.
- Running: same solver and canvas persist, numerical arrays continue evolving, history is retained, and the run state remains running after keyboard toggle.
- 3D: the same two stage canvases and solver remain mounted across a theme switch; no WebGL context-loss event occurs.
- Saved session: a session created through the actual UI remains byte-identical in storage after both theme switches.

## Actual subagent work

All three registered agents investigated concurrently and returned before implementation. They made no edits.

- **design_auditor / Agent A:** established the exact shared-key/value contract, main-site session fallback, sibling differences, blocking first paint and origin/iframe boundaries. Findings determined the preference resolver and documented legacy-key decision.
- **code_mapper / Agent B:** mapped root tokens and technical surfaces, identified the chip as the least disruptive global toggle location, and traced solver/3D effect dependencies. Findings kept theme state out of simulation effects.
- **regression_reviewer / Agent C:** supplied the browser matrix, identified the global Space shortcut hazard and the initial JS-to-WASM solver replacement, and proposed object/array continuity evidence. Its completed-diff review independently passed the eight unit tests, checked preserved files and first-paint script order, and found no actionable defect.

The registered profiles enforce Luna/high for Agents A/B and GPT-6.1 Sol/high for Agent C, overriding the requested medium effort for Agent C. Lead runtime model selection remains session-controlled.

## Validation results

Dependencies were already installed. No dependency or package-script change was needed. The new logic has a focused test file runnable with `node --test tests/theme.test.mjs`.

| Check | Result |
| --- | --- |
| Theme unit tests | **8/8 pass**: fresh/explicit/invalid/auto preferences, legacy preservation, session promotion, subscribers, failures, OS/storage events and unavailable OS API |
| Browser preference cases | **12 pass**, including fresh OS light/dark, saved preferences, invalid/auto, legacy ambiguity, canonical precedence, session migration and storage failures |
| Reload | Saved light/dark retained; failed local writes retain a session fallback across reload |
| OS changes | Followed before selection; explicit current-tab choice retained afterward, including blocked storage |
| Cross-document | Same-origin preference changes and removal handled live |
| Pre-React light | React bundle deliberately held: root has zero React children, light attribute, `rgb(242,238,228)` background, light color-scheme and `#f2eee4` theme metadata |
| Pre-React dark | Same delayed-bundle check: dark attribute, `rgb(27,26,25)` background, dark color-scheme and `#1b1a19` metadata |
| Keyboard | Native Enter/Space activate once; paused/running simulation state unchanged; focus remains visible |
| Layout | Light/dark at **375, 900 and 1440px**; toggle fits, 44px target, no overlap with mode controls |
| Focus | Canonical 2px ring checked after focus/style settling in all six viewport/theme combinations |
| Analysis / inputs / notices | Both canonical surface/text editions verified; chart legend retains matching fixed CL/CD colors |
| Contrast | Toggle primary text / surface: 12.20:1 light, 12.86:1 dark; focus accent / surface: 5.35:1 light, 6.02:1 dark |
| CFD and 3D | Paused/running/3D continuity assertions above pass; no page errors in successful production-preview checks |
| `npm run build` | Pass, 39 modules, no warnings |
| `npm run lint` | Baseline 19 errors / 0 warnings; updated identical 19 errors / 0 warnings, no new diagnostics |
| `git diff --check` | Pass |
| Scope preservation | Scientific tokens, CFDLab and IconRail match Phase 02 byte-for-byte; unrelated prior diffs preserved |

Contrast detail: primary text on the actual panel surface is **12.20:1 light** and **12.86:1 dark**. The focus accent/surface pair is **5.35:1 light** and **6.02:1 dark**. Existing Phase 02 structural/control-boundary tokens are unchanged. No whole-application accessibility certification is claimed.

Browser automation used an already-installed Playwright package with a separate local Chrome profile and reduced motion. The harness waits for initial WASM readiness before capturing solver identity, and allows two animation frames after viewport/theme/focus changes before comparing computed styles. Successful results and precise values are recorded in [phase-03-verification.json](phase-03-verification.json).

The design detector retains the same three documented status/category side-border warnings from Phase 02. No new warning category was introduced.

## Screenshots

All screenshots show the actual functional controller, not a manually forced CSS theme.

| Width / view | Light | Dark |
| --- | --- | --- |
| 375px | [Light](screenshots/phase-03-light-375.png) | [Dark](screenshots/phase-03-dark-375.png) |
| 900px | [Light](screenshots/phase-03-light-900.png) | [Dark](screenshots/phase-03-dark-900.png) |
| 1440px | [Light](screenshots/phase-03-light-1440.png) | [Dark](screenshots/phase-03-dark-1440.png) |
| Analysis / saved-session notice | [Light](screenshots/phase-03-light-analysis.png) | [Dark](screenshots/phase-03-dark-analysis.png) |

## Files changed in Phase 03

- New `public/theme.js`: shared preference controller and blocking initialization.
- `index.html`: blocking bootstrap, early token stylesheet, initial background and theme metadata.
- `src/ThemeContext.jsx`: live external-store subscription; obsolete forced-dark code removed.
- `src/components/CommandBar.jsx`: real accessible toggle and scoped keyboard handling.
- `src/cfdlab.css`: toggle geometry, responsive clearance, dark scientific sketch surface; duplicate token import removed.
- `src/components/AnalysisPanel.jsx`: readable fixed neutral annotations only; scientific series/colors/data unchanged.
- New `tests/theme.test.mjs`: eight focused controller tests.
- This report, `phase-03-verification.json` and eight `phase-03-*.png` screenshots.

## Limits and remaining risks

- The shared key is origin-scoped. GitHub Pages sibling products can share it; `f1-stories.gr` and `georgiosbalatzis.github.io` cannot share localStorage directly. No iframe exists in AeroTunnel. Same-origin storage synchronization is supported; a future cross-origin host bridge would require a defined embedding contract and is outside this phase.
- When both storage mechanisms are blocked, an explicit choice lasts for the current tab runtime; durable reload persistence cannot be guaranteed. Rendering and toggling still work. The intentionally preserved old key does not restore a historical forced-dark state.
- Existing development-mode WASM memory-access failures documented in Phases 01/02 remain unresolved. The production-preview continuity checks were clean, but are not a full numerical benchmark.
- Existing compact navigation targets and some technical canvas accessibility limitations from Phase 02 remain. The newly added theme control meets the 44px target and focus checks.
- The same 19 pre-existing lint errors remain. No unrelated repairs or later redesign phases were attempted.

Stopped after Phase 03.
