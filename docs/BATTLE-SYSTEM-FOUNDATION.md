# LEGEND OF ELDORIA — Battle System Foundation
Status: DRAFT / implementation baseline
Branch: feature/battle-system-foundation
Parent: feature/prototype-0.2-character-save

## Purpose
Build the separate-screen, turn-based deck-building battle system without changing the overworld movement, character identity, or save schema unnecessarily.

## GAME_CONFIRMED rules to preserve
- One main character explores the isometric overworld. Touching/clicking a monster opens a separate battle screen.
- Battle is stationary: units do not move during combat.
- Battlefield is a visual 10x10 grid split into two 5x10 sides. Each side supports at most 5 units; at most 10 units total. Unit positions are fixed for the battle.
- Range categories matter: near / middle / far. Exact per-card range values and range-to-cell mapping remain to be specified.
- Monster groups are supported. Summons occupy a unit slot.
- Deck size: 20 cards. Hand limit: 10. Draw pile auto-shuffles discard when needed.
- Initial turn draw: 5 cards. Initial Energy: 3 per player turn.
- Deck editing only in town or safe areas. Cards may be shared across presets.
- Common same-name card maximum 3 copies; Monster Special Skill Card maximum 2 copies per name; Legendary maximum 1 copy per name. Different star levels count as different cards.
- Multi-Hit means multiple hits against the same target. Multi-Target means hits/attacks against multiple different targets.
- If enemy count exceeds a card's target count, player selects targets. If enemy count is at or below target count, automatically target all eligible enemies; unused target slots are wasted. All Enemies targets every eligible enemy.
- Status Effects: stacks add; duration resets on reapplication; stack cap 99. Stun prevents card use and attacks. Bleed triggers whenever its target attacks. Boss A has a resistance trait.
- Block resets at the start of each side's turn.
- HP persists between battles; do not automatically restore HP after victory or defeat.
- Defeat returns the player to the village and removes 10% of current Gold.
- Monster rewards include EXP, Gold, materials/items, and possible Monster Special Skill Card drops. Monsters do not drop monster cards.
- Monster card drops are chance-based; rarity is a separate axis (Common, Uncommon, Rare, Epic, Legendary).
- Level-up increases Max HP by 5 under the current prototype rule.
- Character Status architecture: Primary Stats -> Secondary Stats -> final battle calculations. Six Primary Stats start at 5; +5 Status Points per character level. Each card has its own scaling formula. Damage rounds to nearest integer. Keep decimal precision until display/final damage.
- Primary stat roles: STR -> Physical Attack; AGI -> Evasion + Battle Initiative (not overworld movement); VIT -> Max HP + Defense; INT -> Magic Attack; DEX -> Accuracy + small Critical Rate; LUK -> Critical Damage + Lucky Effect Chance.
- Accuracy/Evasion hybrid model: ratings from stats/equipment, percentage-point modifiers from cards/Buffs. Proposed Hit Chance clamp 10–95% is a selected recommendation, but conversion formula still needs numerical balance validation.
- Critical is checked only after a hit. Healing/support cards do not check Evasion. Multi-Hit checks Evasion per hit. Guaranteed Hit skips Evasion.
- Buff rules are per-Buff: stacking, duplicate duration, duration start/decrement, effect scope, charges and duplicate-charge handling are individually configured. Buff can add Flat or Percentage Secondary bonuses; Card Buff cannot directly add Primary Stats.
- Existing Status Effects rules are separate from Card Buff rules.
- Equipment may add Primary and Secondary Stats. Selected initial equipment layout recommendation: six slots (Weapon, Head, Body, Legs, Shoes, Accessory); treat as a proposed initial layout until item catalog is authored.
- Equipment Set Bonus recommendation: thresholds such as 2/4/full set.
- Initiative recommendation: compare player and enemy Initiative for first actor; tie random; then fixed side turn order. AGI changes from Buff/Debuff apply next round.
- Lucky Effect recommendation: combat and reward scope, separate roll from Critical, three presentation tiers. Exact effects/chances are not yet balanced.
- UI recommendation: show overview with drill-down for Secondary Stats, preview status-point changes, show status icons/stacks/duration with tap descriptions, and show bonus sources on demand.

## Implementation constraints
- Preserve existing Save module and character identity records. Add fields only through safe defaults/migration.
- Keep world.js movement and map logic untouched unless an integration defect requires a narrowly scoped change.
- Battle result handling must not heal the player automatically. Victory keeps remaining HP; defeat applies 10% Gold penalty and respawns in Greenvale.
- Do not mark a feature TESTED unless a reproducible test has passed. Distinguish DRAFT / IMPLEMENTED / TESTED.
- No numerical conversion rates, critical multipliers, status durations, resistance values, or card scaling formulas are final unless explicitly promoted to GAME_CONFIRMED.

## Battle phase plan
1. Battle Core: deterministic turn transitions, draw/discard/shuffle, hand and Energy limits, block reset, battle result.
2. Battlefield: 10x10 presentation, two fixed 5x10 sides, unit slots and groups.
3. Targeting and range: near/middle/far, manual target selection, All Enemies, Multi-Hit/Multi-Target.
4. Effects: Status Effects, Card Buffs, resistance, elemental modifiers, Accuracy/Evasion/Critical/Lucky.
5. Persistence and rewards: HP continuity, defeat penalty, pending reward transaction, drops and card acquisition.
6. UI and QA: mobile-first layout, desktop input, battle log, enemy intent, test coverage and regression.

## Known Prototype 0.1 integration defects to address
- Current battle engine is 1v1, uses a 10-card starter deck, and does not enforce the confirmed 20-card deck / 10-card hand architecture.
- Current UI renders a single enemy and has no battlefield grid or target selection.
- Current main.js restores player HP to Max HP after every battle, contrary to the confirmed persistent-HP rule.
- Current defeat flow says no loss, contrary to the confirmed 10% Gold penalty.
- Existing battle cards do not yet implement the confirmed status, targeting, range, stat scaling, rarity, or card-star systems.

## Acceptance criteria for the first playable Battle foundation
- Encounter transitions from overworld to battle and back without losing character/save identity.
- Player HP after battle equals remaining battle HP; it is not auto-restored.
- Defeat removes exactly 10% of current Gold using a documented rounding rule before implementation.
- Player turn draws no more than the hand limit; draw pile recycles discard automatically.
- Energy resets to the confirmed amount at the start of the player's turn.
- Block resets at the start of each side's turn.
- Enemy intent is visible before enemy action.
- Battle is stationary and supports fixed unit slots on both sides.
- Mobile viewport has no horizontal overflow.
- Existing character creation, loading, world movement, and autosave regressions pass.


## Implementation update — Battle Core v2 (2026-11-09)
Status: IMPLEMENTED CORE MODULE / NOT YET INTEGRATED INTO THE LIVE BATTLE UI

Added `js/battle-core.js` as a separate, backward-compatible engine module and loaded it after the legacy engine. The legacy `E.createBattle` adapter remains active until the multi-unit battlefield UI and full regression path are ready.

Implemented in the v2 module:
- 10x10 coordinate validation, fixed unit positions, 5-unit side caps and 10-unit total cap.
- Multiple player/enemy units and summon slot/occupied-cell checks.
- 3 Energy, 5-card turn draw, 10-card hand cap and automatic discard-pile recycling.
- 20-card deck validator with Common / Monster Special / Legendary copy limits; card star level is part of the duplicate key.
- Target selection contract, All Enemies/AoE support, Multi-Hit, and configurable Near/Middle/Far band mapping. No unapproved range-to-cell distances are hardcoded.
- Status stack cap 99, additive stacks, Vulnerable +50%, Stun attack prevention, and Bleed after each attack action by the afflicted unit.
- Enemy intents are generated and exposed before enemy turns.


Buff lifecycle implementation update (2026-11-09):
- Added explicit per-Buff stacking policies: stack, refresh, replace, independent.
- Added per-Buff duration policies: reset, extend, keep, independent.
- Added explicit charge consumption and per-Buff zero-charge behavior: remove, keep, disable.
- Definitions missing required policies are rejected rather than silently receiving a universal default.
- Explicit effect channels now apply to combat actions: outgoing damage, incoming damage, Block, and Healing.
- Effect entries support Flat and Percentage values; flat modifiers are applied first, then percentages in the same channel are additive.
- These are generic configurable primitives, not final class/card balance values.
- Effect application is implemented for outgoing damage, incoming damage, Block, and Healing. Incoming-damage modifiers apply before Vulnerable and resistance; effect-specific stat filters are optional. Support-only Block/Healing cards target their source unit by default.
- Secondary Stat modifier application remains a separate implementation task; no unapproved balance values were introduced.

Important limitations still open:
- Existing 10-card legacy starter deck is intentionally not silently expanded to 20; the live adapter still uses legacy battle.js.
- Live battle UI is still single-enemy and does not yet render the 10x10 field, multiple units, target selection, range indicators, status/buff icons or summon placement.
- Buff lifecycle/effect application has implementation and unit-test coverage in progress; Accuracy/Evasion/Critical/Lucky, element multipliers, stat scaling, boss resistance data, multi-enemy AI target priorities, reward/card-drop integration and 500-seed simulation remain to implement/validate.
- Range bands remain configuration-only until the user-approved card/range data is authored.
- The module has automated tests, but must pass CI and browser integration before it is marked TESTED or exposed for user play.


Battlefield UI status display update (2026-11-09):
- The isolated 10x10 Battle Grid harness now renders compact status and Buff labels on occupied unit cells.
- Status labels include Vulnerable (VUL), Bleed (BLD), and Stun (STN); other IDs remain visible as uppercase labels.
- Each unit's status/Buff stack count is shown, and the tooltip provides the effect ID, stack count, and configured duration when present.
- Browser smoke coverage now applies Bash to a Poring and checks that the Vulnerable badge appears.
- This display is limited to the isolated Battle Grid test harness; the live legacy battle screen remains unchanged and still needs the full integration pass.
- Multi-target selection now rejects duplicate target IDs in the core and UI. The test fixture uses three eligible enemies to exercise the manual-selection path; when eligible enemy count is at or below targetCount, automatic targeting remains the intended rule.


Enemy intent presentation update (2026-11-09):
- The isolated Battle Grid harness displays each living enemy's currently revealed intent (move name and damage when supplied) directly on its battlefield cell.
- Browser smoke coverage checks that both test Porings show their revealed Bounce intent before the player ends the turn.
- This is a presentation of the existing intent data; it does not introduce new enemy AI behavior or alter target selection rules.


Live battle adapter integration update (2026-11-09):
- The production single-enemy battle screen now uses Battle Core v2 through the existing BattleUI.start interface.
- Existing world-to-battle navigation, result callback, reward transaction, defeat penalty and character Save flow remain owned by main.js and save.js.
- The live adapter maps the current monster definition and current starter deck into one player unit and one enemy unit. It does not claim that the 20-card deck builder or multi-enemy live presentation is complete.
- The legacy battle engine remains available as a compatibility module, but is no longer the active engine for the live battle screen.
- Browser smoke tests exercise the real world-to-battle route and existing reward persistence after this engine switch; CI must pass before this integration is considered verified.
