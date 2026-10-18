# Phase 04 — F1 STORIES masthead + Race Desk

Completed 2026-10-16, starting from the completed, uncommitted Phases 01–03 on repository HEAD `6116886`. Read `AGENTS.md`, the three phase reports and the current implementation before editing. Inspected git status and preserved earlier work, including the existing untracked `.codex/`, `AGENTS.md` and `f1car/` paths.

Phase 04 only. No commit, push, deployment, PR or changes to sibling repositories were made.

## Implementation

`SiteMasthead.jsx` provides the global F1 STORIES identity, verified main-site navigation, existing functional theme control and mobile navigation. It reuses the sourced parent icon from Phase 01 and the canonical Barlow Condensed wordmark treatment; no replacement logo or font request was introduced. Main-site links use IBM Plex Sans, including Greek text.

`RaceDeskNav.jsx` provides five ordinary links in canonical order: **THE GRID, TELEMETRY, GHOST CAR, TYRES, AEROTUNNEL**. Only AEROTUNNEL has `aria-current="page"`, primary text emphasis and the canonical 3px signal-red top rule. Main-site navigation does not falsely mark an unrelated section current.

Global navigation stays above the workspace in normal document flow. The local identity chip now contains the product name and existing simulation status; the theme button moved into the masthead through the reusable `ThemeToggle.jsx`. Its accessible name, pressed state, keyboard behavior and preference controller remain intact.

The application workspace takes the remaining viewport height. A containing block confines the existing fixed simulation overlays to that area. The canvas backing dimensions, solver and visualizations are unchanged. The local mobile rail scrolls rather than clipping its additional view controls; the settings sheet stays above it. Panels continue to scroll inside the workspace rather than adding a second whole-page scrollbar.

### Desktop and mobile behavior

- Desktop masthead: 76px, canonical logo/wordmark and all seven main-site links. Below 992px: 68px masthead, theme button and 44px menu button.
- Mobile navigation uses a native auto popover with exposed `aria-expanded`/`aria-controls`, seven 52px link rows, Escape dismissal and outside-click dismissal. Selecting a link, moving keyboard focus outside the header, or resizing to desktop closes it. It is nonmodal navigation, with no artificial menu-item roles or focus trap.
- Race Desk links retain 15px Barlow Condensed, readable labels and at least 44px height. On narrow screens the row scrolls horizontally with a visible scrollbar and **“5 apps · scroll to explore”** hint. No product is removed or compressed into an illegible label.
- The active product is initially scrolled into view by changing only the strip's `scrollLeft`. Using startup `scrollIntoView` changed Chrome's sequential-focus starting point; the replacement preserves the skip link as the first Tab stop. Focused products use nearest scrolling so their entire link is visible, including TYRES at 375px.
- The skip link focuses the named, focusable `#aerotunnel-main` workspace. Global, product and local navigation have distinct labels.

### Local application navigation and rendering

The rail retains settings, comparison, Analysis, run/pause, reset and history controls. Explicit Simulation and About buttons make all local views reachable and provide a clear return to the canvas. Selected view/settings buttons expose `aria-pressed`; the existing arrow/Home/End navigation includes the new buttons. Closed settings panels are now inert as well as `aria-hidden`.

The application's global shortcuts now ignore interactive targets and already-handled keyboard events. Space/Enter on navigation and theme controls therefore cannot also run or pause the solver; workspace shortcuts remain available.

The original render effect captures its 2D canvas at initialization. Unmounting that canvas during local view changes could leave the loop drawing to a detached node after returning. The 2D canvas now remains mounted in a hidden section while Analysis/About are shown. **View3D still unmounts when leaving Simulation**, preserving its prior cleanup and avoiding hidden streamline/WebGL work. Returning remounts the 3D renderer as before; it does not replace the solver. Theme switching while viewing 3D preserves the renderer itself.

## Canonical sources and actual delegation

The three registered agents investigated independently and concurrently, read-only, and returned file-specific findings before lead implementation. Only the lead modified application files.

| Agent | Research and findings integrated |
| --- | --- |
| `design_auditor` — Agent A, site navigation | Established the seven actual labels/destinations, logo sizes, 992px breakpoint, canonical wordmark and separation from product navigation. Sources: `f1StoriesPage/partials/nav.html`, `f1StoriesPage/scripts/shared-nav.js`, `ghostcar/src/app/SiteMasthead.jsx`, `ghostcar/src/app/siteNav.js`, `Tyres/src/styles/shell.css`. |
| `regression_reviewer` — Agent B, product switcher | Compared THE GRID, GhostCar and Tyres; proposed five readable, nonshrinking links, horizontal scrolling with an explicit hint, 44px targets, 15px Barlow labels and the canonical top rule. Sources: `f1StoriesPage/standings/index.html`, `f1StoriesPage/docs/race-desk-architecture.md`, `ghostcar/src/app/siteNav.js`, `Tyres/src/styles/shell.css`. Verified standalone product destinations. |
| `code_mapper` — Agent C, routing/accessibility | Confirmed `/aerotunnel/` Vite base, state-based local views, fixed overlay positioning, canvas lifecycle risk, 3D resize behavior, closed-panel focus risk and global shortcut collisions. Sources: `vite.config.js`, `src/CFDLab.jsx`, `src/cfdlab.css`, `src/components/IconRail.jsx`, `ControlPanel.jsx`, `View3D.jsx`. |

Sibling repositories were inspected locally under `/Users/giorgos/WebstormProjects/`; none was edited. Registered profiles enforce Luna/high for design_auditor and code_mapper, and GPT-6.1 Sol/high for regression_reviewer, overriding the requested medium effort for Agent B. Lead model selection remains controlled by the session.

The regression reviewer also inspected meaningful completed changes. It caught hidden 3D rendering after the initial retained-canvas change; the lead restored the off-view mount guard. Its final review verified that fix, the scroll/focus correction, preserved session/WASM/render-loop code and `git diff --check`. No remaining actionable finding was reported. Its mechanical design check found only the same three existing CSS status/category side-border warnings, with none in the new navigation.

## Route and link verification

All destination URLs below received HTTP **200** through direct GET requests. The live-link report records status, final URL, content type and verification time: [phase-04-links.json](phase-04-links.json). Browser checks also inspected the rendered destinations and link semantics. These checks establish reachability at verification time, not future service availability.

| Area / label | Destination |
| --- | --- |
| Logo, Αρχική, settings footer | https://f1-stories.gr/ |
| Άρθρα | https://f1-stories.gr/blog-module/blog/index.html |
| YouTube | https://www.youtube.com/@f1_stories_original |
| Βαθμολογία, THE GRID | https://f1-stories.gr/standings/ |
| Δεδομένα | https://f1-stories.gr/standings/?tab=tyre-pace |
| Συντάκτες | https://f1-stories.gr/authors/ |
| BetCast | https://georgiosbalatzis.github.io/BetCastVisualisation/ |
| TELEMETRY | https://georgiosbalatzis.github.io/f1-telemetry-dashboard/ |
| GHOST CAR | https://georgiosbalatzis.github.io/ghostcar/ |
| TYRES | https://georgiosbalatzis.github.io/Tyres/ |
| AEROTUNNEL standalone deployment | https://georgiosbalatzis.github.io/aerotunnel/ |

The existing settings-footer link incorrectly used the unhyphenated `f1stories.gr` domain; it now uses the verified `f1-stories.gr` destination. YouTube's GET redirected to its consent-parameter variant; navigation retains the canonical channel URL. YouTube and BetCast retain canonical new-tab behavior, `noopener noreferrer` and an accessible new-tab notice. Other navigation links use normal same-tab behavior.

The current AEROTUNNEL link uses **`import.meta.env.BASE_URL + '#aerotunnel-main'`**, resolving to `/aerotunnel/#aerotunnel-main`. It focuses the workspace without reloading the app. No unverified custom-domain deployment was assumed. Vite base, repository name, asset paths and GitHub Pages configuration are unchanged. No router dependency was added; Simulation/Analysis/About remain internal React state.

## Compatibility decisions

- No persisted key was renamed or migrated. `f1stories-theme`, its Phase 03 preference semantics, legacy theme-key handling, `aerolab-session` and `aerolab-sessions` are retained.
- No JSON version, `app: "aerolab"`, import/export format, filename convention from earlier phases, engine import or session helper changed.
- No solver, JS/WASM integration, numerical calculation, LUT, field gradient or scientific color token changed. Canonical Phase 02 tokens are byte-identical to the Phase 04 starting snapshot.
- No theme state was added to solver effects or component keys. Navigation and theme switching do not restart the simulation.
- Prior tracked diffs outside this phase's five existing files match the starting diff exactly, including README, metadata, favicon, ThemeContext, AboutPanel, AnalysisPanel, F1Logo, View3D and exporters. Existing fonts, assets, reports and unrelated untracked work were retained.

## Validation

Dependencies were already installed. No dependency or package-script change was required.

| Check | Result |
| --- | --- |
| `npm run build` | **Pass**, 43 modules, no warnings. Baseline build also passed. |
| `npm run lint` | **19 errors / 0 warnings**, identical to the baseline after normalizing diagnostic file/rule/message. No new diagnostic. |
| Existing tests: `node --test tests/theme.test.mjs` | **8/8 pass**. |
| `git diff --check` | Pass. |
| Layouts | Light and dark at **320×640, 375×812, 768×900, 1440×900**: correct canonical masthead backgrounds, loaded logo, no document overflow or accidental extra page scrollbar; stage and local controls fit below the header. |
| Desktop navigation | Seven main-site links visible; mobile button hidden; five Race Desk links with exactly one current state. |
| Mobile navigation | Six viewport/theme cases: Space opens, seven links visible, Escape closes/restores focus, outside click closes, simulation stays paused. Additional Enter/Tab test reaches all seven links in order and closes on leaving the header. Desktop resize closes the popover. |
| Product navigation | All five anchors keyboard reachable and fully scrolled into view; 15px labels; active rule computed as 3px `rgb(237,76,50)`. Local current-product click changes only the hash. |
| Focus and targets | Theme control 44×44px; visible canonical 2px keyboard outline in all eight layouts. First Tab reaches skip navigation; Enter focuses main. Main/product/mobile links retain 44/44/52px minimum row heights. |
| Settings | Closed panels inert; opened panels inside the available workspace and above the mobile rail. Verified in all eight layouts. |
| Local controls | Simulation, Analysis and About reachable; pressed view state correct; comparison opens/closes; rail Home/End focus movement works. |
| Theme persistence | Masthead toggle updates theme/pressed state and survives reload; Phase 03 controller and bootstrap are unchanged, and all existing preference tests pass. |
| Paused CFD continuity | Same actual solver, canvas, particle pool and parameters; all six `rho`, `ux`, `uy`, `spd`, `curl`, `solid` buffers unchanged across theme/local-view/current-product navigation. Legend unchanged and no page reload. |
| Running CFD continuity | Same solver/canvas/navigation origin; numerical field continues evolving after theme and local-view changes; canvas contains the field on return. |
| 3D | Theme switch retains the two canvases and rendering; off-view canvases disposed, **zero WebGL draw calls across 12 hidden frames**; returning resumes rendering with the same solver. |
| Production browser errors | None in the completed checks, including the final footer/menu/reload smoke test. |

Detailed browser measurements, bounding rectangles, rendered destinations and continuity results: [phase-04-verification.json](phase-04-verification.json).

Browser automation used an already-installed Playwright package connected to a separate headless Chrome profile, with no project dependency added. The available Chrome CLI's page-creation limitation from earlier phases was bypassed through that working browser connection. Responsive captures used reduced motion and the functional theme toggle. Checks wait for React/style settlement and initial WASM readiness; early harness attempts that sampled transitioning styles or clicked under the open menu were corrected without application changes. Browser-discovered focus defects were fixed and the complete matrix then passed.

## Screenshots

| Viewport | Light | Dark |
| --- | --- | --- |
| 320px | [Light](screenshots/phase-04-light-320.png) | [Dark](screenshots/phase-04-dark-320.png) |
| 375px | [Light](screenshots/phase-04-light-375.png) | [Dark](screenshots/phase-04-dark-375.png) |
| 768px | [Light](screenshots/phase-04-light-768.png) | [Dark](screenshots/phase-04-dark-768.png) |
| 1440px | [Light](screenshots/phase-04-light-1440.png) | [Dark](screenshots/phase-04-dark-1440.png) |

Open mobile menus: [320 light](screenshots/phase-04-menu-light-320.png), [375 dark](screenshots/phase-04-menu-dark-375.png), [768 light](screenshots/phase-04-menu-light-768.png). [Desktop 3D](screenshots/phase-04-3d-desktop.png). Phase 03 screenshots remain the pre-masthead reference. CFD frames vary over time; these are layout evidence, not deterministic pixel comparisons.

## Files changed in Phase 04

| File | Change |
| --- | --- |
| `src/components/SiteMasthead.jsx` — new | Canonical global identity, main-site links, skip link and responsive popover. |
| `src/components/RaceDeskNav.jsx` — new | Five-product switcher, active state and accessible scrolling. |
| `src/components/siteNav.js` — new | Shared verified navigation labels/destinations. |
| `src/components/ThemeToggle.jsx` — new | Existing functional toggle extracted for masthead reuse. |
| `src/styles/navigation.css` — new | Responsive masthead, Race Desk and scoped workspace integration. |
| `src/CFDLab.jsx` | Shell integration, main target, interactive shortcut guard and safe local-view canvas lifecycle. |
| `src/components/CommandBar.jsx` | Compact local product/status identification; toggle moved to masthead. |
| `src/components/IconRail.jsx` | Explicit Simulation/About navigation and selected/group semantics. |
| `src/components/ControlPanel.jsx` | Closed-panel inert state and verified parent-domain footer link. |
| `src/cfdlab.css` | Navigation stylesheet import and removal of obsolete chip/toggle height rule. |
| `docs/redesign/phase-04-navigation.md` | This report, source mapping, compatibility and validation decisions. |
| `docs/redesign/phase-04-links.json`, `phase-04-verification.json` | Link and browser/static evidence. |
| `docs/redesign/screenshots/phase-04-*.png` | Twelve desktop/mobile/theme/menu/3D captures. |

## Remaining limitations and risks

- The same 19 pre-existing lint errors remain in application files and generated WASM glue. This phase does not claim a clean lint run.
- Browser testing covers local production preview in Chromium. Safari, Firefox, screen-reader announcements and older browsers without native Popover API support were not independently tested; native popovers require a supporting browser.
- Existing local rail controls retain their smaller hit areas; the new global navigation uses the larger target sizes above. Existing scientific canvas accessibility and annotation-size limitations remain. This is not a whole-application accessibility certification.
- Earlier phases documented a development-mode WASM memory-access issue. Numerical engine work was excluded here; completed production-preview checks had no page errors. Object/buffer continuity and scoped source checks are not a full numerical benchmark.
- External links and existing 3D CDN dependencies can change or become unavailable. Link status reflects the recorded verification time.

Stopped after Phase 04. Phase 05 has not started.
