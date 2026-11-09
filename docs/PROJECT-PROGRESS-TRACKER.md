# LEGEND OF ELDORIA — Project Progress Tracker

**Updated:** 2026-11-09  
**Branch:** `feature/battle-system-foundation`  
**Related PR:** #16 — Draft / Open / Not merged  
**Purpose:** Single working snapshot of implemented, tested, in-progress, and not-started project work. This tracker deliberately avoids a single completion percentage until every work package has an agreed scope and measurable acceptance criteria.

## Status definitions

- **COMPLETED** — implementation exists and the relevant acceptance tests pass.
- **IMPLEMENTED / NEEDS MORE QA** — implementation exists, but coverage or end-to-end validation is incomplete.
- **IN PROGRESS** — active work is underway.
- **NOT STARTED** — no implementation evidence recorded yet.
- **DESIGN CONFIRMED** — game rule is approved, but implementation may not exist.
- **DRAFT** — proposal or specification, not a confirmed game rule.

## Verified project snapshot

Latest verified commit at tracker creation: `ec70f96bb11c3a5608b7027c27aa073941e75669`.

Latest verified CI: GitHub Actions **Validate Prototype**, run **#296**, conclusion **success**. Steps passed: required-file verification, JavaScript syntax, save/battle unit tests, browser dependency installation, and browser smoke test including mobile forest canvas assertions.

PR #16 remains **open and Draft**. It has not been merged.

## Workstream status

| Workstream | Status | Evidence / remaining work |
|---|---|---|
| Character creation and selection | COMPLETED (prototype scope) | Browser smoke covers create, reload, continue, and mobile character preview. |
| Character identity and Save / Load | COMPLETED (prototype scope) | Save/reload regression and reward persistence are covered. Preserve schema and identity. |
| Greenvale Village overworld | COMPLETED (prototype scope) | Existing playable isometric map and world movement. Continue regression coverage. |
| Whispering Forest map transition | COMPLETED (prototype scope) | Portal entry/return and arrival beside exit are browser-tested. |
| Forest roaming encounters | COMPLETED (prototype scope) | Random group size 1–3 and group encounter handoff tested. |
| Forest visual environment | IMPLEMENTED / NEEDS MORE QA | Layered trees, ground foliage, stones, fireflies, light shafts, ancient landmark, roots/rune, drifting leaves. Mobile canvas smoke checks pass; visual review on real devices remains. |
| Battle Core v2 | IMPLEMENTED / NEEDS MORE QA | Separate core module and unit tests exist; verify complete live UI integration against all confirmed rules. |
| Battlefield UI | IMPLEMENTED / NEEDS MORE QA | 10x10 battlefield and multi-unit live adapter tested; complete targeting/range/effects remain. |
| Multi-enemy battle and rewards | COMPLETED (prototype scenario) | Live three-Poring battle, aggregate EXP, level-up and save persistence covered by browser smoke. |
| HP continuity / defeat handling | IMPLEMENTED / NEEDS MORE QA | Foundation documents and tests exist; continue edge-case regression and confirm no automatic heal. |
| Deck architecture | NOT STARTED / PARTIAL FOUNDATION | 20-card deck, 10-card hand, shuffle and duplicate validation have core foundations; full collection/deck editing UI not complete. |
| Card collection and inventory | NOT STARTED | Build inventory data/UI, item stacking, card collection and deck presets. |
| Card rarity and monster skill-card drops | DESIGN CONFIRMED | Chance and rarity are separate; monsters drop special/skill cards only. Full implementation and balancing remain. |
| Card stars and upgrade system | DESIGN CONFIRMED | Unique 2-star property and 3-star effect per card; full content and upgrade UI remain. |
| Gem system and crafting | DESIGN CONFIRMED | 1 Gem per card, 3 levels, craft/remove rules; implementation not started. |
| Character stats and status points | DESIGN CONFIRMED / PARTIAL FOUNDATION | Six primary stats, start at 5, +5 points per level; formulas and UI need implementation and balance tests. |
| Job / Class progression | DESIGN CONFIRMED | Novice path, Class 1/2, job levels, passives, active/ultimate and skill trees; implementation not started. |
| Job Card Awakening Core | DESIGN CONFIRMED | Class 2 grants one Core; Job Lv20 and 40 grant the other two; bound/non-tradable. Implementation not started. |
| Quests, NPCs and main story | NOT STARTED | No complete quest/story loop recorded in the current prototype evidence. |
| Additional monsters, bosses and regions | NOT STARTED / PARTIAL CONTENT | Poring prototype and forest region exist; Wolf, bosses, further regions and content remain. |
| Audio, settings, accessibility and release pipeline | NOT STARTED / NEEDS DEFINITION | Define requirements and acceptance criteria before release planning. |

## Next implementation priorities

1. **Stabilize the playable loop:** new character → village → forest → encounter → battle → rewards → save → reload.
2. **Review forest visuals on device sizes:** check readability, actor visibility, performance and touch controls; keep decoration non-blocking.
3. **Finish live battle foundation:** verify hand limit, Energy, draw/discard, block reset, enemy intent, multi-unit targeting, HP persistence and defeat penalty.
4. **Implement Inventory and Card Collection:** data model first, then mobile-first UI, then save migration tests.
5. **Implement deck editing and presets:** enforce 20-card deck and all duplicate rules; only allow edits in town/safe areas.
6. **Add card drop acquisition and rarity:** separate drop probability from rarity; do not introduce monster cards as drops.
7. **Expand job/stat systems only after card/inventory foundations are stable.**

## Measurement policy

Do not report a single project completion percentage from a subjective estimate. To calculate a defensible percentage later:
1. Break every workstream into small deliverables with explicit acceptance tests.
2. Assign weights based on agreed scope and complexity.
3. Count only completed deliverables whose tests pass.
4. Report both implementation completion and QA completion separately.
5. Keep design-confirmed items separate from implemented items.

Suggested formula once weights are approved:

`Implementation progress = sum(weight of completed deliverables) / sum(weight of all scoped deliverables) × 100`

`QA progress = sum(weight of deliverables with passing acceptance tests) / sum(weight of all scoped deliverables) × 100`

## Change log

- 2026-11-09 — Initial tracker created from verified repository files, current Draft PR #16, and successful CI run #296.
- 2026-11-09 — Whispering Forest visuals extended with landmark tree, roots/rune and drifting leaf motes; forest canvas smoke assertion added.
