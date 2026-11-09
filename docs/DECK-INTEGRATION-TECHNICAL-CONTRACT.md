# LEGEND OF ELDORIA — Deck Integration Technical Contract

**Status:** Technical proposal for implementation; does not alter confirmed game rules.
**Branch:** `feature/battle-system-foundation`
**Scope:** Define safe integration boundaries for the 20-card deck, card ownership, presets, validation, and Save compatibility.

## 1. Current implementation facts

- `js/save.js` creates schema version 1 character payloads with `deckId: "starter"`; it currently does not persist an owned-card collection or editable deck contents.
- `js/data.js` defines five card definitions and a 10-entry `E.STARTER_DECK`.
- `js/battle-ui.js` passes `E.STARTER_DECK` directly to the battle engine when creating a battle.
- `js/battle-core.js` exposes a deck validator that expects exactly 20 cards by default and checks copy limits using card metadata.
- Therefore, the 20-card rule exists in the engine foundation but is not yet enforced through the complete live player deck lifecycle.

## 2. Non-negotiable invariants

1. Do not delete, rename, or reinterpret existing character identity fields, `characterId`, revision, checksum, or Save schema version 1 fields.
2. Existing schema version 1 characters must remain loadable and must not lose level, EXP, HP, Gold, items, map position, appearance, or pending reward state.
3. Keep the confirmed deck size at 20 cards, hand limit at 10, auto-shuffle behavior, and the confirmed duplicate limits.
4. Same-name Common cards: maximum 3 copies. Monster Special Skill Cards: maximum 2 copies per name. Legendary cards: maximum 1 copy per name.
5. Different star levels of the same card are distinct deck entries for copy-limit purposes.
6. Monster drops may grant Monster Special Skill Cards only; never introduce monster cards as collectible drops.
7. Deck editing is allowed only in town or safe areas. Cards may be reused across multiple presets.
8. Do not create or balance a new starter-card lineup as part of technical integration. The complete 20-card content list requires an explicit content decision.

## 3. Proposed data model (additive; not yet implemented)

Keep schemaVersion 1 readable. Add optional fields to the character payload only after migration tests exist:

```js
{
  deckCollection: {
    owned: [
      { cardId: "<stable-card-id>", stars: 1, quantity: 1 }
    ]
  },
  deckPresets: [
    { id: "preset-1", name: "Preset 1", cardRefs: [
      { cardId: "<stable-card-id>", stars: 1 }
    ] }
  ],
  activeDeckPresetId: "preset-1"
}
```

Rules for this proposal:
- Ownership is quantity-based; a deck references a card identity and star level, not a copied mutable card object.
- A deck contains 20 references. Repeated references are allowed only within the applicable copy cap.
- A preset may reference only cards in the owned collection, with aggregate use across that preset not exceeding owned quantity.
- The same owned card may be referenced by multiple presets; preset membership does not consume ownership globally.
- Preserve the legacy `deckId` field during the transition. Do not remove it until all readers/writers have been migrated and compatibility is demonstrated.
- No default 20-card list is specified here. A legacy character with only `deckId: "starter"` must not be silently padded with invented cards.

## 4. Card definition contract

Before enabling deck editing, each playable card definition must provide stable metadata:

| Field | Requirement |
|---|---|
| `id` | Stable unique identifier; never reuse an ID for a different card |
| `name` | Display name |
| `rarity` | One of Common, Uncommon, Rare, Epic, Legendary |
| `category` | Must distinguish Monster Special Skill Cards from other categories |
| `stars` | Integer 1–3 for a specific owned/deck instance; definition may declare its base star |
| `cost`, `kind`, effects | Existing battle fields retained and validated by card-specific rules |

Rarity and drop chance are independent concepts. Drop probability belongs to the acquisition/drop table, not the rarity field.

## 5. Validation contract

Create one shared pure validation path used by deck editing, save/equip, and battle start:

1. Input must be an array of exactly 20 card references.
2. Every card ID must resolve to a known playable card definition.
3. Every star value must be an integer in the supported range and correspond to an owned card instance.
4. Enforce copy limits by card identity plus star level, using the confirmed category/rarity precedence: Legendary max 1; Monster Special Skill max 2; other Common max 3. The rule owner must resolve any future overlap between categories before adding content that creates one.
5. The preset's card counts must not exceed owned quantities.
6. Return structured errors suitable for mobile UI; do not mutate the deck while validating.
7. Battle start must reject invalid decks safely and show a recoverable message rather than silently falling back to a different deck.

## 6. Save compatibility and migration

- Migration must be additive and idempotent: running it twice produces the same result.
- A legacy character without collection/preset fields remains loadable.
- Until an approved 20-card starter list exists, legacy characters may continue using the existing 10-card prototype battle path; do not claim that path satisfies the final 20-card rule.
- When a valid starter collection is approved, migration may initialize it only for eligible legacy characters and must be covered by backup/reload tests.
- Preserve checksum, backup, guard, revision ordering, and pending-reward recovery semantics in `js/save.js`.
- Never overwrite a valid existing collection or preset during migration.

## 7. Safe implementation sequence

1. Add card metadata schema and pure card/deck validators; keep current battle behavior unchanged.
2. Add unit tests for 20-card size, unknown IDs, rarity/category copy caps, star-level distinction, ownership quantity, and malformed input.
3. Add additive collection/preset fields and migration helpers with schema-v1 fixtures; test create, save, reload, backup recovery, and interrupted reward recovery.
4. Add town/safe-area-only Deck Builder UI for mobile and desktop; validate before save.
5. Change battle start to load the selected valid preset through one deck-provider API; retain a clearly isolated legacy adapter until the approved 20-card content is ready.
6. Add browser tests for editing restrictions, preset switching, save/reload persistence, and battle start using the selected deck.
7. Only then remove direct live dependence on `E.STARTER_DECK`.

## 8. Acceptance criteria

- Existing schema-v1 characters load without data loss.
- A new character can acquire and own card quantities without duplicating ownership through preset reuse.
- Invalid deck sizes, unknown cards, illegal copy counts, and unowned cards are rejected with actionable errors.
- A valid 20-card deck can be saved, reloaded, selected, and used to start battle.
- Deck edits are blocked outside town/safe areas.
- Multiple presets can reuse the same owned cards.
- Mobile browser smoke tests cover the full edit → save → reload → equip → battle path.
- Existing village/forest movement, encounter flow, rewards, HP, Gold, and character identity regression tests remain green.

## 9. Explicitly out of scope

- Choosing the 20 starter cards or their balance.
- Creating additional card effects, rarities, drop percentages, or star-upgrade outcomes.
- Implementing Inventory visuals, Gem crafting, Job progression, or new monsters in this integration milestone.
- Changing Save schema version or removing legacy fields.

## Change log

- 2026-11-09 — Initial technical contract drafted from current `save.js`, `data.js`, `main.js`, `battle-core.js`, and `battle-ui.js` source review.