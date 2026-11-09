# Monster Special Skill Card Catalog — LEGEND OF ELDORIA

**Document:** Monster Special Skill Card Catalog  
**Version:** 0.2  
**Status:** GAME_CONFIRMED — Slime Splash and Savage Bite approved  
**Parent foundation:** Card Acquisition Foundation  
**Branch:** `feature/monster-special-skill-catalog`

The player approved MSC-POR-001 Slime Splash and MSC-WOLF-001 Savage Bite from Draft 0.1. Their card identities, rarities, energy costs, base effects, star evolutions, and monster eligibility are GAME_CONFIRMED. Drop chances and crafting recipes remain unassigned.

## 1. Binding rules

1. Monsters drop only Monster Special Skill Cards. Monster Cards are not monster drops.
2. Each monster has its own defined list of eligible Monster Special Skill Cards. A card is randomly selected only from that monster's list.
3. Card rarity is one of Common, Uncommon, Rare, Epic, or Legendary.
4. Rarity and drop chance are independent. Rarity does not calculate, multiply, or otherwise determine drop chance.
5. Duplicate Monster Special Skill Cards accumulate. They can be used later as upgrade materials.
6. Monster Special Skill Cards have a deck-copy limit of 2 per card name. Different star levels count as separate variants under the confirmed deck rules.
7. Card upgrades have three stars. ★★ changes a card's property in its own predefined way. ★★★ unlocks a unique card-specific effect. Stars do not directly increase base damage or stats.
8. A ★★★ result does not automatically mean a Gem Slot. Gem Slot is only used where that individual card's design explicitly provides it.
9. The existing eight-element system is preserved. Elemental damage multipliers belong to Element only; Race does not provide a damage multiplier.
10. Crafting is a valid card acquisition channel, but recipes, costs, and which cards are craftable are not defined by this catalog.

## 2. Card design schema

Every catalog entry should define:

- Stable card ID
- Display name and source monster
- Card family: Monster Special Skill
- Rarity
- Energy cost
- Base effect at ★
- Element at ★ and ★★ property change
- ★★★ unique effect
- Targeting and timing
- Status interactions, including stack and duration behavior where applicable
- Monster-specific drop eligibility
- Drop chance (separate field, intentionally unassigned until balanced)
- Crafting availability (unassigned until a recipe is approved)
- Deck-copy limit and star-variant identity

## 3. Initial candidate catalog

The two candidates below continue earlier concept exploration for Poring and Wolf. They are proposals, not approved final content.

### MSC-POR-001 — Slime Splash

**Status: GAME_CONFIRMED**

| Field | Proposed value |
|---|---|
| Source monster | Poring |
| Card family | Monster Special Skill |
| Rarity | Uncommon |
| Energy | 1 |
| ★ Base effect | Deal 5 damage and apply Vulnerable for 1 turn |
| ★ Element | Neutral / no elemental multiplier |
| ★★ Property change | Damage becomes Water element |
| ★★★ Unique effect | If the target is already Vulnerable when played, Slime Splash hits one additional time for 3 damage |
| Monster drop eligibility | Poring only |
| Drop chance | UNASSIGNED |
| Crafting | UNASSIGNED |
| Gem Slot at ★★★ | No slot proposed in this draft |

**Design intent:** An accessible Poring skill that introduces Vulnerable synergy. The ★★ change adds an Element property rather than a flat stat increase. The ★★★ effect rewards timing against an already Vulnerable target.

**Rules note:** Vulnerable uses the confirmed damage-taken multiplier (+50%). The duration and stacking behavior must use the existing global status rules; this card does not create a separate status implementation.

### MSC-WOLF-001 — Savage Bite

<badge>GAME_CONFIRMED</badge>

| Field | Proposed value |
|---|---|
| Source monster | Wolf |
| Card family | Monster Special Skill |
| Rarity | Rare |
| Energy | 1 |
| ★ Base effect | Deal 7 damage and apply 2 Bleed stacks |
| ★ Element | Neutral / no elemental multiplier |
| ★★ Property change | If the target is at or below 50% HP, apply 1 additional Bleed stack |
| ★★★ Unique effect | If the target has Bleed when Savage Bite is played, also apply Vulnerable for 1 turn |
| Monster drop eligibility | Wolf only |
| Drop chance | UNASSIGNED |
| Crafting | UNASSIGNED |
| Gem Slot at ★★★ | No slot proposed in this draft |

**Design intent:** A higher-rarity damage-over-time skill that rewards attacking enemies already under pressure. The ★★ property is conditional and does not directly raise base damage. The ★★★ effect creates synergy between Bleed and Vulnerable without consuming existing Bleed stacks.

**Rules note:** Bleed triggers each time the affected target attacks. It deals 1 HP per current stack, then consumes exactly 1 stack. Bleed has no duration timer; it remains until stacks are consumed. Status stack cap is 99.

## 4. Monster-to-card eligibility matrix

| Monster | Candidate card | Rarity | Eligible drop |
|---|---|---|---|
| Poring | Slime Splash | Uncommon | Yes — proposed |
| Wolf | Savage Bite | Rare | Yes — proposed |

No other monster or card pair is added in this draft. A monster must not drop a card that is absent from its own eligibility list.

## 5. Rarity policy

Rarity communicates collection tier and deck-copy restrictions; it does not set drop probability.

| Rarity | Confirmed deck-copy limit | Catalog status |
|---|---:|---|
| Common | 3 per name | Tier confirmed; candidates not assigned |
| Uncommon | 2 per name for Monster Special Skill Cards | Tier confirmed |
| Rare | 2 per name for Monster Special Skill Cards | Tier confirmed |
| Epic | 2 per name for Monster Special Skill Cards | Tier confirmed |
| Legendary | 1 per name | Tier confirmed |

The specific monster-skill copy cap of 2 applies to Monster Special Skill Cards regardless of rarity, except where the confirmed Legendary limit of 1 is stricter.

No probability percentages, rarity weights, pity rules, or guaranteed-drop schedules are introduced here.

## 6. Implementation mapping

After catalog approval, each approved entry can be represented in `E.CARDS` with fields such as:

- `id`
- `name`
- `kind`
- `cost`
- `damage` and status-effect fields
- `acquisitionType: 'monster-special-skill'`
- `rarity`
- `sourceMonsterId`
- `element`
- `starUpgrades`

The monster-specific card-drop table in `js/card-acquisition.js` should reference only approved card IDs. Each entry's `chance` remains a separate numeric value to be decided in the Drop Rate & Balance task.

Both approved card definitions are now registered in `E.CARDS` as catalog content with stable IDs `msc-por-001` and `msc-wolf-001`. They carry `implementationStatus: 'catalog-only'` while combat execution for these status effects and star evolutions is pending. Neither card is active in the live drop table because no numeric drop chance has been approved. The Wolf monster's runtime encounter definition is also not added by this catalog task.

## 7. Open decisions before content activation

The following are intentionally unresolved:

- Numeric drop chance for each eligible card.
- Crafting recipes and which Monster Special Skill Cards can be crafted.
- Combat execution and UI support for these catalog-defined effects and star evolutions.
- Additional monster-specific cards beyond Poring and Wolf.
- Drop chance for each eligible card.
- Crafting recipes and which Monster Special Skill Cards can be crafted.

## 8. Out of scope

- Monster Cards or monster-card drops.
- Drop-rate implementation or rarity weighting.
- New global status effects.
- Changes to the confirmed 20-card deck, hand limit, energy rules, or duplicate limits.
- Direct base-stat increases from star upgrades.
- Gem balance, recipes, material costs, or Gold costs.
- Changes to existing item drops, EXP, Gold, monster HP, or save schema.


## 9. Approval record

- Approval: both initial entries approved by the player.
- Approved content: card IDs, names, source-monster eligibility, rarity, Energy cost, ★ base effects, ★★ property/effect changes, and ★★★ unique effects exactly as listed above.
- Not approved / not assigned: numeric drop chances, crafting recipes/costs, new monster runtime stats or encounters, and changes to global combat rules.
- Runtime definitions are catalog-only until their effect execution is implemented and tested.
