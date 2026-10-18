# Phase 02 — Canonical F1 STORIES design foundation

Completed 2026-10-16, starting from the uncommitted completed Phase 01 state. Phase 03 has not started. No commit, push, deploy or PR was performed.

## Scope and starting state

Read `AGENTS.md` and `phase-01-brand.md`, inspected git status, and preserved all Phase 01 changes. Existing `.codex/`, `AGENTS.md` and `f1car/` remain untouched. The lead alone edited application files. The three registered subagents investigated concurrently, returned before implementation, and the regression reviewer inspected completed changes afterward.

This phase introduces a CSS token owner and migrates presentation declarations without replacing the application stylesheet, component structure or simulation behavior. The default remains dark; light tokens are available through `data-theme="light"` for verification and Phase 03. Theme storage, the no-op toggle, provider state, and initial `data-theme` / color-scheme behavior remain unchanged.

## Canonical sources

- Authority: [f1StoriesPage/styles/editorial.css](https://github.com/georgiosbalatzis/f1StoriesPage/blob/main/styles/editorial.css) and [docs/design-tokens.md](https://github.com/georgiosbalatzis/f1StoriesPage/blob/main/docs/design-tokens.md), core themes rather than homepage or article overrides.
- Sibling comparison: [ghostcar/src/styles/tokens.css](https://github.com/georgiosbalatzis/ghostcar/blob/main/src/styles/tokens.css) and [Tyres/src/styles/tokens.css](https://github.com/georgiosbalatzis/Tyres/blob/main/src/styles/tokens.css). Tyres supplies the separate accessible control-boundary values; they are not a replacement for the canonical structural border.
- Typography assets and exact metric fallbacks were copied from the clean, tracked local F1 Stories checkout `/Users/giorgos/WebstormProjects/f1StoriesPage`, revision `dd1671e07eddc4ee06ec3ef667b8b8f00c500206`: `assets/fonts/`, `styles/home-fonts.css`, and the fallback declarations at the beginning of `styles/editorial.css`. Five WOFF2 files match that checkout byte-for-byte. See [font provenance and licenses](../../src/assets/fonts/README.md) and the hashes in [verification evidence](phase-02-verification.json).

No runtime stylesheet, font CDN, token package or new dependency was introduced.

## Token source and mapping table

`src/styles/tokens.css` owns the following contract. Dark is defined on `:root`; light overrides on `:root[data-theme='light']`.

| Token / role | Light | Dark | Source |
| --- | --- | --- | --- |
| `--bg-base` page | `#f2eee4` | `#1b1a19` | Canonical core |
| `--bg-surface` panels | `#e9e3d6` | `#242321` | Canonical core |
| `--bg-surface-alt` raised surface | `#dfd9ca` | `#2e2c29` | Canonical core |
| `--text-primary` | `#20251f` | `#eee8db` | Canonical core |
| `--text-secondary`, tertiary alias | `#5b6256` | `#b6bbac` | Canonical core |
| `--border` structural rule | `#c8c8b9` | `#4b5146` | Canonical core |
| `--border-control` interactive boundary | `#73766a` | `#7d8275` | Tyres control role |
| `--accent`, `--accent-readable` | `#a82e1c` | `#ff775f` | Canonical core |
| `--accent-hover` | `#8e281a` | `#ff947f` | Canonical core |
| `--accent-contrast` text on accent fill | `#f2eee4` | `#20251f` | Canonical core |
| `--accent-muted` decorative wash | `#ed4c3214` | Same | Canonical core |
| `--signal` fixed brand emphasis | `#ed4c32` | Same | Canonical core |
| `--signal-ink` text/focus on signal | `#17191b` | Same | Canonical core |
| `--paper`, `--ink` fixed inverse pair | `#e9e3d6`, `#20251f` | Same | Canonical core |
| `--text-inverse-secondary` | `#c0bfb2` | Same | Canonical core |
| `--border-inverse` | `rgba(233,227,214,.18)` | Same | Canonical core |

Readable accent drives links, tabs, selections and ordinary controls. Fixed signal marks running/recording states and small brand rules. Signal is not used as ordinary small text. Structural borders divide content; interactive control boundaries use the stronger sibling token.

## Typography and primitives

- IBM Plex Sans 400–600 for body, UI, labels, numbers and Greek. `--font-display` and `--font-editorial` correctly mean Plex.
- `--font-brand` explicitly selects Barlow Condensed 700, with Plex fallback, for the Phase 01 parent/product wordmark and Latin product heading.
- Five self-hosted subsets: Plex Latin, Latin-ext, Greek and arrows; Barlow Latin 700. Both SIL OFL license files and source notes are included. `src/styles/fonts.css` preserves the source's weight/subset-specific metric-matched Arial/Helvetica fallbacks.
- Removed the redundant Google requests for DM Sans, Space Mono, Barlow and Share Tech Mono. No remote font requests remain.
- Meaningful CSS UI labels now have a 12px floor; normal body text is 14px. Controls use supported weights 500/600 rather than synthesized 800/900. Character spacing is restrained to `.02em` (tabs use zero).
- Scientific DOM values and timing use `tabular-nums lining-nums`. Canvas chart and 3D-axis font families now name Plex with a generic fallback; axis-label weight is 600, supported by the hosted asset. Canvas annotation geometry and numerical formatting are retained.
- Existing practical spacing aliases are 4/8/12/16/24/36/56px. Reused 12/16px gaps and canonical responsive gutters of 48/32/22/17px for Analysis/About. Floating-tool geometry otherwise remains the existing shell.
- Controls are flat, with a 2px control radius. Important mobile text inputs/selects use 16px text and a 44px target. Dense desktop buttons retain compact sizing.
- Focus is a complete 2px inset ring with a -3px offset inside clipped controls. Accent/signal fills locally select their contrasting ink so the ring cannot disappear against its own fill. Invisible toggle inputs expose focus on the visible wrapper.
- Restrained state transitions remain; delayed startup fades, repeated decorative pulses, neon shadows, clipped neon button corners, saturated glass blurs, scanlines and the large decorative About watermark were neutralized. The scientific field is no longer covered by a scanline layer.
- The readable mobile mode bar moves to 48px below the identity chip, resolving overlap exposed by the font/size migration. This is a local typography-fit correction, not a header redesign.

## Compatibility aliases retained

These are CSS `var()` relationships rather than independent literal palettes:

| Legacy consumers | Canonical destination |
| --- | --- |
| `--bg-void`, `--bg-root` | `--bg-base` |
| `--bg-glass`, `--bg-glass-hi` | Opaque `--bg-surface` |
| `--border-glass` | `--border` |
| `--border-hover` | `--border-control` |
| `--text-dim`, `--text-muted`, `--text-faint` | `--text-secondary` |
| `--text-heading` | `--text-primary` |
| `--accent-flow`, `--accent-hi`, `--accent-mid`, `--accent-warn`, `--accent-crit` | Readable `--accent` for remaining UI consumers |
| `--f1-void`, `--f1-base`, `--f1-dark`, `--f1-black` | `--bg-base` |
| `--f1-carbon`, `--f1-slate` | `--bg-surface` |
| `--f1-border`, `--f1-edge` | `--border` |
| `--f1-border-hi`, `--f1-ghost` | `--border-control` (track/structure; helper text explicitly uses secondary) |
| `--f1-white` | `--text-primary` |
| `--f1-silver`, `--f1-dim` | `--text-secondary` |
| `--f1-red` | `--accent-readable` |
| `--f1-red-dim` | `--accent-muted` |
| `--f1-green`, `--f1-blue`, `--f1-amber` | Readable `--accent` for remaining UI consumers |
| `--font-mono` | Plex body family; number alignment uses tabular figures |

`--f1-dark` was previously referenced but undefined; it now resolves correctly. Removed unused injected background, glow, gradient, border, text and shadow duplicates have no remaining consumers according to the mapper and independent completed-diff review. Dynamic `--tone`, `--fill`, `--tick`, and `--aoa` remain per-element inputs; they are not missing root tokens.

## Scientific palette boundary

| Technical token | Fixed value | Meaning |
| --- | --- | --- |
| `--cfd-flow` | `#00d4ff` | Existing flow / L/D category |
| `--cfd-lift` | `#22ff88` | Existing CL category |
| `--cfd-drag` | `#ff6600` | Existing CD category |
| `--cfd-reynolds` | `#eeff22` | Existing Re category |
| `--cfd-critical` | `#ff0022` | Existing technical critical state |
| `--cfd-bg` | `#06080c` | Fixed technical surface |
| `--cfd-text`, secondary | `#eee8db`, `#c0bfb2` | Legible technical overlays |

CFDLab, AnalysisPanel and CommandBar now name technical tones explicitly. This prevents the ordinary action aliases from recoloring traces or making CL/CD legend swatches disagree with them. The numeric calculations, thresholds, formatting and data are unchanged. Existing chart trace hex values and all field/particle/vector/geometry/3D material colors remain intact.

The color legend keeps its exact six-stop CFD gradient. Chart surfaces and overlays remain dark in either theme, including KPI sparkline canvases; ordinary metric numbers use canonical text. These technical colors do not become the brand palette.

## Actual subagent findings and integration

- **design_auditor / Agent A:** verified exact core theme values against both sibling copies, distinguished brand signal from readable accents and data inks, and located licensed self-hosted Greek/Latin assets. Its findings determined the token contract and font roles.
- **code_mapper / Agent B:** identified inline root token injection overriding CSS, duplicate font requests, alias families, the undefined `--f1-dark`, high-specificity screenshot/focus rules, and renderer boundaries. The lead removed only palette injection, retained behavior and aliases, and left drawing code isolated.
- **regression_reviewer / Agent C:** calculated contrast risks, flagged surface-alt secondary text, weak structural control borders, suppressed focus, Greek coverage, and fixed-dark scientific surfaces. In completed-diff review it caught two issues that were corrected: focus rings matching filled buttons and canvas labels still naming the removed terminal font. Its final review found no remaining actionable new regression.

All investigations were read-only. Registered role profiles enforce Luna/high for Agents A/B and GPT-6.1 Sol/high for Agent C, overriding the requested medium effort for Agent C. The lead model is controlled by the session and cannot be switched with these tools.

## Validation and evidence

Dependencies were already installed. There is no existing npm test script or automated test suite.

| Check | Result |
| --- | --- |
| `npm run lint` baseline | 19 errors, 0 warnings |
| `npm run lint` updated | Same 19 errors, 0 warnings; normalized diagnostic files/rules/messages identical |
| `npm run build` | Pass before and after; final 38 modules; no unresolved font warnings |
| `git diff --check` | Pass |
| Canonical computed values | Exact dark/light page, panel, primary text and accent values verified in the browser |
| Inline palette | No inline custom-property palette remains on the root |
| Theme persistence | Startup remains dark; `aerotunnel-theme` stays `dark` even while CSS-only light tokens are inspected |
| Focus | Real keyboard modality: preset and filled-action rings are visible, solid 2px; contrasting fill-aware ink verified |
| Typography | Plex body and tabular numerical values computed; Chromium reports all 22 Greek/probe glyphs from the custom IBM Plex Sans font, including `Δ ρ ν → ×` |
| Network | Font resource URLs are local under the existing `/aerotunnel/` base |
| Scientific legend | Inline gradient equals the Phase 01 baseline exactly; CL/CD swatches resolve to the existing green/orange trace colors |
| 2D / 3D | 2D browser checks have no page errors; selecting 3D mounts two canvases with no page errors |
| Protected application code | Solver, wrapper, LUT, parser, geometry, particles and deployment config unchanged; exporter diff remains exactly Phase 01 |
| Numerical metrics | CFDLab matches the Phase 01 snapshot after normalizing equivalent technical token references |
| Mobile | 390×844: wordmark and mode bar fit without overlap; existing bottom sheet remains usable |

Measured contrast ratios from the browser's token values:

| Pair | Light | Dark |
| --- | --- | --- |
| Primary / base | 13.468:1 | 14.235:1 |
| Secondary / surface | 4.937:1 | 7.995:1 |
| Accent / surface-alt | 4.854:1 | 5.341:1 |
| Accent-fill text / fill | 5.899:1 | 5.986:1 |
| Signal-fill text / fill | 4.768:1 | 4.768:1 |
| Control boundary / surface | 3.627:1 | 3.979:1 |
| Focus / surface | 5.345:1 | 6.024:1 |

The completed mechanical detector reported three retained side-border warnings: warning HUD, scientific KPI category stripe, and session toast. These functional status/category markers are documented exceptions. All previously reported layout-property animation warnings were removed.

Evidence: [computed styles, contrast, font/platform, network, mobile bounds and static results](phase-02-verification.json).

Screenshots use local Chrome via the already-installed Playwright package, with reduced motion and fresh storage. Light is forced only in browser test state; no switching feature was added. Live CFD frames differ over time, so these are UI verification evidence rather than pixel-equality tests.

| View | Evidence |
| --- | --- |
| Phase 01 starting state, desktop | [Before](screenshots/phase-02-before-desktop.png) |
| Dark desktop, keyboard focus | [Updated](screenshots/phase-02-dark-desktop.png) |
| Light desktop, keyboard focus | [Updated](screenshots/phase-02-light-desktop.png) |
| Dark mobile | [Updated](screenshots/phase-02-dark-mobile.png) |
| Light mobile | [Updated](screenshots/phase-02-light-mobile.png) |
| Light Analysis with fixed technical charts | [Updated](screenshots/phase-02-light-analysis-desktop.png) |

## Files changed in this phase

- New `src/styles/tokens.css`: canonical themes, primitives, scientific colors and compatibility bridge.
- New `src/styles/fonts.css`; five fonts, two OFL license files and provenance README under `src/assets/fonts/`.
- `src/ThemeContext.jsx`: removed presentation token injection; preserved all theme behavior/persistence.
- `src/cfdlab.css`: migrated font/color/focus/control declarations, removed decorative effects, retained structural selectors and functional screenshot rules.
- `index.html`: removed redundant remote fonts and aligned the initial body fallback; Phase 01 metadata retained.
- `src/CFDLab.jsx`: equivalent technical token references only relative to Phase 01.
- `src/components/AnalysisPanel.jsx`, `CommandBar.jsx`: dedicated technical colors and readable convergence text; chart font family aligned.
- `src/components/View3D.jsx`: axis-label font family/weight only.
- This report, `phase-02-verification.json` and six `phase-02-*.png` screenshots.

Phase 01 files unrelated to this phase remain as they were at the start.

## Remaining exceptions and risks

- Complete theme switching and persistence migration are intentionally absent until Phase 03. CSS-only light inspection does not demonstrate an implemented user-facing light-mode feature.
- Light secondary text on `--bg-surface-alt` is 4.484:1. Current content surfaces use base/surface; future small text on surface-alt must use primary or another verified pairing.
- Fixed scientific stripes/swatch hues can have low contrast on paper; they supplement explicitly labeled canonical-text values and are not control boundaries. Chart drawing stays on dark surfaces. Some existing canvas annotations are 10–12px with fixed alpha; they were not comprehensively recolored or resized in this phase.
- Existing compact rail targets are 34–38px and some existing controls have smaller hit areas than the canonical 44px important-target guidance. A full navigation/control layout pass remains separate.
- Existing charts/canvases retain their accessibility limitations. This is not a full accessibility certification.
- Phase 01's existing development-mode WASM memory-access errors remain unresolved. Production-preview checks here were clean, but do not constitute a numerical benchmark or exhaust every solver path.
- The same 19 existing lint errors remain in CFDLab, several components, export utilities and generated WASM glue. They were not repaired in this design foundation phase.

Stopped after Phase 02.
