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
