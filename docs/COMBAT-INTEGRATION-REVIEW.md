# Combat Integration Review — LEGEND OF ELDORIA

**Review version:** 0.1  
**Review date:** 2026-11-09  
**Target:** `feature/combat-effect-integration` / PR #25  
**Review type:** Integration and regression boundary review  
**Decision:** Integration is partially verified; do not mark the overall combat milestone complete yet.

## 1. Systems inspected

- `js/main.js`: battle entry, result handling, reward transaction, card collection.
- `js/battle-ui.js`: battle screen, card hand rendering, status display, battle end callback.
- `js/battle.js`: deterministic combat engine, status processing, card effects.
- `js/data.js`: starter deck, monster definitions, approved special-skill card definitions.
- `js/card-acquisition.js`: monster special-skill card eligibility and drop validation.
- `js/save.js`: pending reward claim, owned-card accumulation, deck preset persistence.
- `index.html` and `css/style.css`: battle screen structure and presentation.
- Existing unit and browser smoke-test workflow.

## 2. Verified integration paths

### 2.1 Battle lifecycle
- World encounter pauses the world and opens the battle screen.
- Battle UI creates a battle engine instance and returns `{ won, monsterId }` to `main.js`.
- Victory uses a pending reward transaction, then claims and persists EXP, item drops, and card drops.
- Existing character snapshot and save flow remains in place.

### 2.2 Card reward persistence
- Card Acquisition returns Monster Special Skill Card reward objects with card ID, star, quantity, name, and rarity.
- Save pending-reward claim merges card copies into owned-card inventory.
- Duplicate copies of the same card ID and star level accumulate.
- The live Poring card drop table remains empty; no unapproved drop rate is activated.

### 2.3 Combat rules
- Bleed applies before the affected enemy's attack, deals damage based on current stacks, then consumes one stack.
- Vulnerable modifies incoming damage by 50%.
- Status stack cap and finite-duration reset are covered by unit tests.
- Approved Slime Splash and Savage Bite effects are covered by battle unit tests.

## 3. Integration gaps and conflicts

### REVIEW-01 — Saved Deck is not connected to Battle UI
**Severity:** High for playable deck-building milestone; not a regression in the current read-only collection milestone.

`main.js` calls `E.BattleUI.start(playerState, monsterId, callback)` without deck data. `battle-ui.js` always passes `E.STARTER_DECK` into `E.createBattle`.

Consequences:
- Saved active deck presets are not used in combat.
- Owned Monster Special Skill Cards cannot be played through the current game flow.
- Starred card instances can be tested by the engine but are not yet loaded from saved deck presets.

**Boundary:** Deck Collection is currently read-only and deck editing has not been authorized for this integration. Keep this as a follow-up task; do not silently enable deck editing.

### REVIEW-02 — Monster victory currently awards Gold
**Severity:** Critical rules conflict; pre-existing behavior, not introduced by Combat Effect Integration.

`E.MONSTERS.poring.gold` defines a Gold range and `E.rollRewards` rolls Gold on victory. `main.js` then persists and displays that Gold.

This conflicts with the latest confirmed economy rule: Gold is obtained only by selling materials to NPCs, not by defeating monsters.

**Boundary:** The Combat Effect Integration branch did not change reward logic. Resolve this in a dedicated Economy/Monster Reward integration task. Do not classify PR #25 as the source of this existing behavior.

### REVIEW-03 — Stun is not implemented in Battle Engine
**Severity:** Medium; confirmed global combat rule not yet supported by this engine.

The current battle engine does not block player card plays while stunned or skip the enemy attack while stunned. No current approved card applies Stun, but the global status rule requires this before a Stun-applying card or encounter is activated.

**Boundary:** No new Stun card or effect is introduced by PR #25. Implement and test Stun in a dedicated status-engine follow-up before using it in live content.

### REVIEW-04 — Browser battle flow is not covered by current smoke test
**Severity:** Medium.

The existing browser smoke test validates character creation and Continue. The current workflow does not drive a real battle screen through card play, End Turn, victory, reward claim, and return to village.

The 44 unit tests validate engine and Save behavior separately, not the complete browser integration.

**Recommendation:** Add a dedicated battle browser smoke test before declaring the full battle flow end-to-end verified.

### REVIEW-05 — Status indicator has no dedicated CSS rule
**Severity:** Low.

`battle-ui.js` creates `#enemy-statuses.battle-statuses` dynamically, but `css/style.css` has no `.battle-statuses` rule. The text is present in the DOM but relies on default styling.

**Recommendation:** Add compact, readable status chips in a UI-focused follow-up; no gameplay rule changes required.

## 4. Save and regression boundary

- No Save schema migration was added by Combat Effect Integration.
- Card reward claiming uses the existing pending-reward transaction and owned-card merge.
- Existing legacy string card IDs remain supported by the battle engine.
- No new Wolf runtime monster was added.
- No live Monster Special Skill Card drop chance was activated.
- No deck editing was enabled.

## 5. Review decision

**PR #25 can be reviewed as a scoped combat-engine implementation, but it is not a complete end-to-end combat/deck integration.**

Before calling the wider milestone complete:
1. Resolve the confirmed Gold-source conflict in a separate Economy task.
2. Add Stun support before any Stun content is activated.
3. Add a real browser battle-flow smoke test.
4. Connect saved Deck Presets to Battle UI only when the Deck Builder milestone is authorized.
5. Add dedicated status-indicator styling.

Do not merge automatically. Keep PR #25 as Draft until the owner reviews the scoped implementation and its known integration boundaries.
