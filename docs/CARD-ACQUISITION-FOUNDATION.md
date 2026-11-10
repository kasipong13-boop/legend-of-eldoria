# Card Acquisition Foundation — Current Save Engine Port

Status: draft implementation; no merge authorization.
Base: `main` after PR #29 merge (`c79744071f9b6ea78b3f21b669aaeaffae4633a9`).
Legacy source reviewed: PR #23 (`feature/card-acquisition-foundation`).

## Confirmed rules preserved
- Monsters may drop only Monster Special Skill Cards, never Monster Cards.
- Rarity tiers: Common, Uncommon, Rare, Epic, Legendary.
- Rarity and drop chance are independent. Only the configured numeric chance is used for rolls.
- Card duplicates stack by `cardId + stars`; different star levels remain separate.
- Poring, Forest Wolf, and Ancient Wolf card-drop tables remain empty until specific cards, rarities, and rates are approved.
- Card crafting can later use the same source-neutral collection grant path; recipe requirements and costs are not part of this port.

## Current-main architecture
- `js/card-acquisition.js` owns rarity labels, the empty monster drop table, and fail-closed monster drop validation.
- `js/card-collection.js` remains the collection sidecar under `eldoria.cards.<characterId>`.
- Sidecar schema v2 adds pending card rewards and claimed reward receipts. Schema v1 sidecars remain readable and are upgraded only on a later write.
- A card reward is staged before the character's existing pending reward is committed. The card grant and receipt are written together in one verified sidecar write.
- The character pending reward remains the existing Save Schema v1 shape: `seq, characterId, monsterId, exp, gold, drops, createdAt`. Card rewards are not inserted into character Main / Backup / Guard records.
- On settlement, the sidecar receipt is claimed first; the existing Save Engine then claims EXP and item rewards. A retry sees the receipt and cannot duplicate cards.
- Missing staged data is treated as a legacy pre-acquisition pending reward, preserving the ability to settle older saves.

## Protected systems
- `js/save.js` is unchanged.
- Save Schema remains version 1.
- Main / Backup / Guard records, checksum, recovery, commit/resume transaction flow, reward sequence fields, and existing character data remain unchanged.
- `js/data.js`, `js/battle.js`, `js/world.js`, Gold, EXP, and item drop definitions are unchanged.
- No live Monster Special Skill Card identities or numeric drop rates are added.

## Verification
- Unit tests cover rarity/chance independence, rejection of ineligible cards, invalid data, sidecar migration, duplicate stacking, idempotent staging/claiming, and storage failure.
- Existing full regression, mutation, UI contract, and desktop/iPhone-sized Chromium browser smoke workflows remain required.
- Actual iPhone Safari is not claimed as tested.
