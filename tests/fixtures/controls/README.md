# Control import fixtures

Small synthetic fixtures created for Phase 06; no third-party assets or model licensing is involved.

| File | Purpose |
| --- | --- |
| `profile.svg` | Closed five-point polygon in a 100×100 SVG viewbox |
| `profile.dxf` | Closed LWPOLYLINE with DXF code 10/20 vertices |
| `profile-ascii.stl` | Two triangular facets forming a planar square |
| `profile-binary.stl` | Equivalent two-facet binary STL (184 bytes) |
| `profile.png`, `profile.jpg` | 32×32 dark silhouette on a white background for image tracing |
| `session.json` | Version-2 exported-session shape, historical `app: "aerolab"` marker, finite custom polygon and solver/display values |
| `invalid.svg` | SVG with no usable outline |
| `blank.png` | White image with no silhouette edges |

For each valid format, open Geometry, select its source, and browse the file. Repeat by dropping it anywhere inside the open panel. Begin with a different preset to confirm a real geometry change. Use both STL fixtures. JSON should restore angle 7°, inlet velocity .095, viscosity .02 and Pressure mode. Drop that JSON on the application shell as well.

Invalid SVG and blank image must announce an error and retain the current model. Corrupt PNG, malformed JSON, a JSON numeric value of null, and a collinear SVG can also be supplied to verify error handling. A valid polygon beginning with almost duplicate vertices must remain accepted; the unit tests cover that CAD edge case.

Run the dependency-free automated validation suite with `node --test tests/*.test.mjs`. The full browser coverage/results are documented in `docs/redesign/phase-06-controls.md` and `phase-06-verification.json`.
