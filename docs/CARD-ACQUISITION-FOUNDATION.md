# Card Acquisition Foundation — Prototype 0.2

Status: implementation foundation; content rates and recipe economics remain unapproved.
Depends on: `feature/card-collection-foundation`.
This document preserves the confirmed game rules and does not authorize new drop-rate or rarity-balance values.

## 1. Confirmed rules

- Card acquisition channels include monster drops and crafting.
- Monsters may drop only Monster Special Skill Cards. They never drop Monster Cards.
- Card rarity has five tiers: Common, Uncommon, Rare, Epic, Legendary.
- Rarity and drop chance are independent properties. Rarity does not implicitly change or calculate drop chance.
- Duplicate cards accumulate as owned quantities and can be used for later star upgrades.
- Card variants with different star levels remain separate owned entries.
- Card Collection is the read-only display of owned cards; Deck editing remains out of scope for this foundation.

## 2. Runtime contract

`js/card-acquisition.js` is intentionally separate from `js/data.js` and `js/battle.js`.

- `E.CardAcquisition.rarities` exposes the five approved rarity labels.
- `E.MONSTER_CARD_DROP_TABLE` stores monster-specific card-drop entries.
- Each entry has `cardId` and `chance` (a number from 0 to 1).
- A referenced card must exist in `E.CARDS`, have `acquisitionType: 'monster-special-skill'`, and have one of the five valid rarity labels.
- Invalid or ineligible entries fail closed. Monster Cards and ordinary cards cannot be inserted into a monster drop table.
- `rollMonsterDrops(monsterId, rng)` returns card rewards at 1 star. Its chance check reads only the configured `chance`; it never reads rarity to calculate probability.
- Item drops continue through the existing item reward path and are not processed by the card acquisition module.

## 3. Save and reward contract

- Battle victory persists item rewards and card rewards together as one pending reward.
- Claiming a pending reward adds card quantities to `deckCollection.owned`.
- Matching `cardId + stars` entries stack quantities; different star levels remain separate variants.
- The claim reloads the latest character save before applying rewards, preserving newer collection data.
- Reward claim remains idempotent: after a successful claim, a reload cannot grant the same card reward again.
- `Save.grantCards(character, rewards)` is the source-neutral grant API. Future crafting can use this same persistence path after recipe requirements have been validated.

## 4. Deliberately unconfigured content

The Poring card-drop table is empty. No card definitions or numeric drop rates were invented for this foundation. A monster should not start dropping a card until its special-skill card identity, rarity, and drop chance are explicitly approved and added to content data.

Crafting recipes, required materials, Gold costs, unlock conditions, and crafting UI are not introduced here because their exact rules have not been confirmed. The shared card-grant API is ready for that later system.

## 5. Verification

- Rarity labels and default empty drop table.
- Equal drop chances behave independently of Common versus Legendary rarity.
- Monster Card and non-special card drops are rejected.
- Unknown cards, invalid rarities, and invalid chances fail closed.
- Duplicate card rewards stack.
- Card reward claims are idempotent and preserve newer grants.
- Browser smoke exercises a test-only Monster Special Skill Card through Poring victory, save, reload, and Card Collection display.

## 6. Scope boundaries

- No change to `js/data.js`, `js/battle.js`, `js/world.js`, starter deck, combat values, monster HP, EXP, Gold, or existing item drop rates.
- No new card skill effects, card identities, drop-rate values, crafting recipes, material costs, or rarity weights.
- No deck editing or star-upgrade implementation.
- No merge to `main`; deliver through a draft feature PR and retain the existing Card Collection PR dependency.
