# Card Acquisition Foundation — Current Save Engine Port

Status: draft implementation; TDR-030 approved; no merge authorization.
Base: `main` after PR #29 merge (`c79744071f9b6ea78b3f21b669aaeaffae4633a9`).
Legacy source reviewed: PR #23 (`feature/card-acquisition-foundation`).

## Confirmed rules preserved

- Monsters may drop only Monster Special Skill Cards, never Monster Cards.
- Rarity tiers: Common, Uncommon, Rare, Epic, Legendary.
- Rarity and drop chance are independent. Only the configured numeric chance is used for rolls.
- Card duplicates stack by `cardId + stars`; different star levels remain separate.
- Poring, Forest Wolf, and Ancient Wolf card-drop tables remain empty until specific cards, rarities, and rates are approved.
- No card crafting recipes, material costs, Gold costs or unlock rules are introduced.

## Current architecture

- `js/card-acquisition.js` owns rarity labels, the empty monster drop table and fail-closed monster drop validation.
- `js/card-collection.js` remains Card Collection Sidecar schema v2 at `eldoria.cards.<characterId>`. It stores collection data, pending card rewards and claimed receipts only.
- `js/reward-recovery.js` implements the approved IndexedDB Companion Journal and Web Locks coordinator, including payload checksum/canonical validation, lock-required mutation methods and fault-injection checkpoints.
- IndexedDB database `eldoria-reward-recovery` stores full battle reward payloads and lifecycle states separately from both Save and Sidecar.
- Reward lifecycle: `prepared -> sidecarStaged -> savePending -> cardsClaimed -> saveClaimed -> completed`; conflicts move to `quarantined`.
- A localStorage activation marker stores only the fact that Journal-based rewards have been activated. It contains no reward payload and ensures loss of IndexedDB cannot be silently treated as legacy success.
- Every reward mutation and recovery is serialized by Web Locks exclusive lock `eldoria:reward:<characterId>`. Unsupported, busy or failed locks stop the operation.
- Reward ID uses the current monotonic Save sequence; a distinct secure encounter ID is generated at battle start.
- Retry reuses the first durable IndexedDB payload. It does not reroll card or item rewards.
- Recovery reconciles IndexedDB, Sidecar v2 and Save Schema v1; conflicts and orphan records fail closed and are quarantined.

## Protected systems

- `js/save.js` remains unchanged.
- Character Save Schema remains v1, including Main / Backup / Guard, checksum, recovery, transaction/resume and pending reward shape.
- `js/data.js`, `js/battle.js`, `js/world.js`, Gold, EXP formulas and item drop definitions remain unchanged.
- No live Monster Special Skill Card identities or numeric drop rates are added.
- Gold Economy remains ON HOLD.

## Verification

- Unit tests cover Sidecar v2 compatibility and the Journal/lock coordinator.
- Full FI-01..FI-38 execution is required; unexecuted scenarios must not be represented as passed.
- Browser testing must cover IndexedDB reload and multi-tab locking.
- Actual iPhone Safari is not claimed as tested unless run on a real device.
- PR #30 remains Draft and is not merged.
