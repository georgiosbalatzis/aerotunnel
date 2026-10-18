
# AeroTunnel — Codex Project Instructions

## Product
AeroTunnel is part of the F1 Stories ecosystem.

Reference applications:
- F1 Stories: https://f1-stories.gr
- THE GRID: https://f1-stories.gr/standings/
- GhostCar: https://georgiosbalatzis.github.io/ghostcar/
- Tyres: https://georgiosbalatzis.github.io/Tyres/

## Primary objective
Modernize AeroTunnel's visual interface so it
feels like a native F1 Stories application.

Preserve all working CFD capabilities.

## Multi-agent workflow
For substantial redesign tasks:

1. Delegate independent research to:
    - design_auditor
    - code_mapper
    - regression_reviewer

2. Start independent investigations in parallel.

3. Wait for the relevant findings.

4. The lead agent owns implementation.

5. Avoid concurrent edits to shared files.

6. Ask the regression reviewer to inspect
   meaningful completed changes.

7. Report actual delegation, not simulated roles.

If subagent tools are unavailable, explicitly
report the limitation and proceed safely.

## Engineering constraints
- Preserve CFD numerical behavior.
- Preserve JS/WASM solver compatibility.
- Preserve imports, exports and saved sessions.
- Preserve functioning 2D and 3D modes.
- Avoid unnecessary dependencies.
- Do not rewrite unrelated application code.

## Visual design
Use canonical F1 Stories design tokens.
Prefer IBM Plex Sans for interface typography.
Use Barlow Condensed for brand display typography.
Maintain separate scientific visualization colors.
Support light and dark modes.

## Verification
Inspect git status before modifications.
Run npm run lint and npm run build.
Run existing tests where available.
Do not invent test results.

For UI changes, use browser verification and
screenshots when tooling is available.

## Delivery
Work on one requested redesign phase only.

Report:
- Files changed
- Changes implemented
- Subagent findings
- Tests performed
- Known limitations
- Unresolved risks

Do not commit, push, deploy or open a PR
unless explicitly requested.
