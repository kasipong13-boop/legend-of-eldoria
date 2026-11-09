# Combat Effect Integration — LEGEND OF ELDORIA

**Version:** 0.1  
**Status:** GAME_CONFIRMED rules implemented for prototype testing  
**Parent branch:** `feature/monster-special-skill-catalog`  
**Implementation branch:** `feature/combat-effect-integration`

## 1. Confirmed global status rules

- Status stacks add when reapplied.
- Reapplication resets the finite duration.
- Maximum status stacks: 99.
- Bleed triggers every time the affected target attacks.
- Bleed has no duration timer.
- Each Bleed stack deals 1 HP base damage at the start of the affected target's attack action. Damage is calculated from the stack count before consumption and is subject to Vulnerable's damage-taken multiplier.
- After Bleed damage resolves, remove exactly 1 Bleed stack. Remove the status at 0 stacks.
- If Bleed defeats the target, the target's attack is cancelled and the battle can end immediately.
- Vulnerable increases damage received by 50% (multiplier 1.5); it does not multiply the number of Vulnerable stacks.
- Damage is rounded to the nearest integer, then capped by the target's remaining HP.

## 2. Duration timing

Finite-duration effects on the enemy expire after the enemy completes its action. Finite-duration effects on the player expire at the end of the player's turn. Bleed is permanent until its stacks are consumed and is not decremented by duration processing.

Slime Splash applies Vulnerable for 1 turn. Savage Bite ★★★ also applies Vulnerable for 1 turn when its target already has Bleed before the card is played.

## 3. Approved Monster Special Skill Card execution

### MSC-POR-001 — Slime Splash
- ★: 1 Energy; deal 5 damage; apply 1 Vulnerable stack for 1 turn.
- ★★: damage property becomes Water element. This integration records the property in the card catalog; it does not add an elemental damage multiplier or change the global element rules.
- ★★★: if the target was already Vulnerable before the card is played, add one separate bonus hit for 3 base damage. Each hit is independently modified by Vulnerable and rounded to the nearest integer.

### MSC-WOLF-001 — Savage Bite
- ★: 1 Energy; deal 7 damage; apply 2 Bleed stacks.
- ★★: if target HP was at or below 50% of max HP immediately before card resolution, apply 1 additional Bleed stack.
- ★★★: if target already had Bleed immediately before card resolution, also apply 1 Vulnerable stack for 1 turn. This does not consume Bleed.

Card star levels are accepted as card-instance data `{ id, stars }`; existing string card IDs remain supported and default to ★. No save schema migration is introduced by this branch.

## 4. Scope and safeguards

- No Save schema or persistence flow changes.
- No changes to rewards, EXP, Gold, item drops, or monster stats.
- No new Wolf runtime encounter or monster definition.
- No card drop chance or crafting recipe is assigned.
- Approved cards remain catalog-only in the acquisition/drop pipeline; this combat integration does not activate drops.
- No Monster Cards are introduced.
- Existing draw, discard, energy, block, hand-size, turn, victory, and defeat behavior is retained.

## 5. Verification

Automated tests cover status stack addition and cap, finite-duration reset, Vulnerable damage scaling, Bleed trigger/consumption order, lethal Bleed cancellation, approved card base effects and star effects, and backward compatibility for string deck entries.
