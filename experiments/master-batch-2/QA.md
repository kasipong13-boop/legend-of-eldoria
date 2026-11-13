# Master Batch 2 — Controlled Implementation (experimental only)

## Baseline evidence
- main: c79744071f9b6ea78b3f21b669aaeaffae4633a9
- Prior branches reviewed: feature/expanded-greenvale-capital (diverged 1 ahead/47 behind), feature/npc-material-sale-gold-economy (diverged 99 ahead/63 behind), demo/whispering-forest-safari-preview (2 ahead), experiment/wf41-expanded-playable-preview (14 ahead).
- Existing game main already has Greenvale/Whispering Forest map data, warp contracts, Save Engine, Wolf definitions, battle logic and inventory. Those files are not modified in this experiment.
- The experimental standalone page is an intentionally limited proof of user flow, **not** a replacement for the real game runtime or its save system.

## Scope and controls
- Added only experiments/master-batch-2/index.html and this evidence document.
- Standalone mobile canvas prototype: Greenvale -> Forest -> Wolf encounter -> collect loot -> return -> sell to Merchant.
- Session-only state, deliberately no persistence. It does not read/write browser localStorage or the game Save Engine.
- No game files, fixtures, workflows, secrets, world.js, save.js or schema changed.
- No PixelLab/Claude calls, paid generation, GitHub workflow dispatch, deploy or merge.

## Test matrix
| Check | Result | Evidence / limitation |
|---|---|---|
| Baseline main full SHA | PASS | GitHub branch read |
| Branch isolation | PASS | Created experiment/master-batch-2-vertical-slice from exact main SHA |
| Existing branches reviewed | PASS | Compare results inspected |
| Standalone demo committed | PASS | GitHub content commit |
| Game Save Engine unchanged | PASS | Only experiment files added |
| GitHub CI syntax/unit/integration | NOT EXECUTED | No workflow dispatch; pending checks |
| Standalone browser smoke | NOT EXECUTED | Requires browser run |
| Safari iPhone | NOT EXECUTED | Owner device not accessed |
| PixelLab assets | NOT EXECUTED | Not authorized |
| WF41 production security | NO-GO | No activation or permissions changes |

## iPhone owner acceptance steps (after preview is hosted)
1. Open the hosted experimental page, not GitHub's source viewer.
2. Walk to Merchant (6,5) and tap Talk/Explore.
3. Walk to east gate (10,6) to enter Whispering Forest.
4. Approach Wolf (8,7), tap Attack until battle ends.
5. Return through forest gate (1,6), approach Merchant, sell loot.
6. Rotate device; confirm controls and canvas remain readable.
7. Send screenshot and report any defects.

## Release gate
Draft PR only. No merge into main without separate review and authorization. Demo is not a full integration with production game Save/Load. WF41 Live Automation remains NO-GO.
