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
- Sidecar schema v3 adds a durable full-battle reward journal, monotonic revision and verified backup. Schema v1/v2 remain readable and migrate in memory; the next write upgrades to v3.
- `stageBattleReward()` persists Monster ID, EXP, zero Gold, item drops, card drops, timestamp and status before creating the character Save Engine pending reward. In-memory intent is only a retry convenience.
- Sidecar keys: `eldoria.cards.<characterId>` (primary), `eldoria.cards.<characterId>.backup` (backup), and `eldoria.cards.v3.active.<characterId>` (activation marker).
- Each write increments `revision`, writes/verifies backup first, then primary. Reads validate both checksums and select the highest valid revision; equal-revision checksum conflicts fail closed.
- The activation marker prevents a missing v3 sidecar from silently reverting to starter collection data after journal activation.
- Recovery reconstructs a missing Save Schema v1 Pending Reward from the journal, or resumes a matching pending reward. The original pending shape remains `seq, characterId, monsterId, exp, gold, drops, createdAt`.
- Settlement claims cards + receipt first, then EXP/items through the existing Save Engine, then marks the journal completed. Each boundary is idempotent and retried after reload.
- Missing card stage is accepted only for pre-journal legacy data when the activation marker is absent. Missing stage after activation blocks recovery.
- Retry controls cannot dismiss a reward-recovery block by merely saving world state or returning to title.
- Optimistic revision checks reject stale collection snapshots from another runtime/tab. This is a same-browser localStorage safeguard, not cloud sync.

## Protected systems
- `js/save.js` is unchanged.
- Save Schema remains version 1.
- Main / Backup / Guard records, checksum, recovery, commit/resume transaction flow, reward sequence fields, and existing character data remain unchanged.
- `js/data.js`, `js/battle.js`, `js/world.js`, Gold, EXP, and item drop definitions are unchanged.
- No live Monster Special Skill Card identities or numeric drop rates are added.

## Recovery and verification
- Journal states: `staged -> cardsClaimed -> completed`.
- If journal exists but Save pending does not, recovery creates the original v1 pending reward from the journal.
- If card receipt exists but Save pending remains, recovery claims EXP/items without granting cards again.
- If Save sequence advanced but journal is incomplete, recovery finalizes the journal without applying rewards again.
- More than one incomplete journal entry, sequence gaps, payload mismatch, corrupt copies, or missing activated sidecar block gameplay rather than guessing.
- Unit tests cover v1/v2 migration, revision/backup recovery, stale writes, multi-runtime idempotency, journal state transitions and missing-sidecar protection.
- Browser smoke includes simulated reload after durable journal staging but before Save pending creation, plus mobile touch taps in iPhone-sized Chromium.
- Actual iPhone Safari is not claimed as CI-tested.
