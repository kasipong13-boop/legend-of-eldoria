# WF41-P3 — Verification and iPhone Preview Gate

Status: **STATIC / GRAPH DATA CHECK PASS; BROWSER / SAFARI NOT EXECUTED**

## Verified against GitHub experimental branch
- Branch: `experiment/wf41-expanded-playable-preview`
- Preview: `experiments/wf41-expanded-preview/index.html`
- Fixture: `verification/fixtures/wf41-surface-graph.json` (read-only)
- Graph nodes: 337; unique IDs: 337; edges: 416
- Dangling edges: 0; out-of-bounds nodes (128×128): 0; isolated nodes: 0
- Edges with Manhattan distance != 1: 0; cross-surface edges: 12
- First node (47,119) GROUND-H0 has two cardinal neighbors; arrow controls can start walking
- Preview fetch path resolves to `verification/fixtures/wf41-surface-graph.json` when hosted from repository root.
- Source inspection: pointer drag and tap, arrow buttons, zoom, camera recenter, UNKNOWN messaging; no localStorage / Save Engine writes.

## Critical distinction
- This is **graph-only walking**, not physical terrain collision or a rendered isometric forest.
- Fixture is **337-node original**, not 347-node local Proposal v2. R02/R04 proposal not silently integrated.
- Cross-surface edges are preserved as source graph data, but same-XY surface selection, height-based visual rendering, and physical clearance are **NOT VERIFIED**.
- This HTML requires HTTP(S) hosting. Opening GitHub's source viewer is NOT equivalent to playing.
- GitHub Pages hosting and Safari on a physical iPhone are **NOT VERIFIED**.
- No GitHub Actions, workflow dispatch, paid API, or Merge.

## iPhone verification plan (owner action only after a hosted URL is confirmed)
1. Open hosted `experiments/wf41-expanded-preview/` in Safari, not the GitHub source viewer.
2. Confirm status shows `Loaded 337 nodes / 416 edges`.
3. Tap LEFT from start (47,119) and confirm (46,119).
4. Use CENTER, +/- zoom, drag map and tap a directly connected node.
5. Tap an UNKNOWN location; confirm no teleport/walking into unknown.
6. Rotate iPhone portrait/landscape; check canvas and controls remain usable.
7. Send screenshot / screen recording and any errors.

## Gate
- GitHub branch and file integrity: PASS.
- Graph schema and adjacency structural checks: PASS.
- JS execution in browser: NOT EXECUTED.
- Safari iPhone: NOT EXECUTED.
- Hosting / playable URL: NOT VERIFIED.
- Runtime integration / Save regression: NOT EXECUTED; no game files modified.
