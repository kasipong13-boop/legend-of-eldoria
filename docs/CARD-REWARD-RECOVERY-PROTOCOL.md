# Card Reward Recovery Protocol — PR #30 Remediation

Status: implementation specification for PR #30; Draft only; no merge authorization.

## Invariants
- The character Save Engine (\`js/save.js\`) and Save Schema v1 are immutable in this work.
- A victory reward is not safely staged until the complete intent exists in the Card Collection Sidecar.
- Reward ID is the character's monotonic \`nextRewardSeq\` rendered as a decimal string.
- Monster rewards preserve zero Gold. Existing EXP and item reward behavior is unchanged.
- Card copies are keyed by \`cardId + stars\`; ownership mutation and receipt are committed in one sidecar revision.
- No new monster card identities or drop rates are introduced.

## Durable records
- Primary: \`eldoria.cards.<characterId>\`
- Backup: \`eldoria.cards.<characterId>.backup\`
- Activation marker: \`eldoria.cards.v3.active.<characterId>\` = \`1\`
- Sidecar schema v3 includes \`revision\`, collection/preset data, \`pendingRewards\`, \`claimedRewardIds\`, and \`rewardJournal\`.
- Journal fields: \`rewardId, monsterId, exp, gold, drops, cards, createdAt, status\`.
- Status values: \`staged -> cardsClaimed -> completed\`.

## Write / recovery strategy
1. Read and validate both copies. Select the highest valid revision; equal revision with different checksums is a conflict.
2. Reject stale writes when the caller revision does not match the latest durable revision.
3. Seal revision N+1, write and verify backup first, then write and verify primary. If primary write fails after backup verification, backup remains the durable latest copy and is reported as degraded success.
4. Stage the complete battle intent and pending card reward in one sidecar write. Set activation marker before creating the Save Engine pending reward.
5. Commit the existing Save Engine pending reward with the unchanged v1 API.
6. Claim cards and receipt atomically in sidecar.
7. Claim EXP/items using the existing Save Engine transaction and \`lastClaimedSeq\`.
8. Mark journal completed. A failure here is safe: reload sees the incomplete journal plus advanced Save sequence and finalizes without granting again.

## Crash matrix

| Interruption point | Durable state | Recovery action |
|---|---|---|
| Before sidecar stage | No durable reward intent | Cannot guarantee recovery if storage rejects the first durable write; current session stays locked for retry |
| After backup journal write, before primary | Newer valid backup revision | Select backup and reconstruct Save pending reward |
| After journal write, before Save pending | Journal staged | Create original Save Schema v1 pending reward from journal |
| After Save pending, before card claim | Journal staged + Save pending | Claim cards, then Save reward |
| After card claim, before Save claim | Receipt + owned cards + Save pending | Receipt prevents duplicate cards; claim EXP/items |
| After Save claim, before journal complete | \`lastClaimedSeq\` advanced + journal incomplete | Finalize journal only; do not reapply rewards |
| Corrupt primary, valid backup | Backup valid | Recover highest valid revision |
| Both copies missing after activation | Activation marker remains | Fail closed; never create starter data over missing collection |
| Missing stage in pre-v3 legacy save | No activation marker | Allow legacy Save pending settlement |
| Missing stage after activation | Marker present | Block settlement and preserve save for recovery |

## Sequence and consistency checks
- More than one incomplete journal entry blocks gameplay.
- Journal entry ahead of \`nextRewardSeq\` blocks.
- Journal entry behind \`lastClaimedSeq\` is finalized only after verifying/repairing its card receipt.
- Save pending reward must match journal sequence, monster ID, EXP, zero Gold and ordered item drops.
- Completed journal entry may not be ahead of \`lastClaimedSeq\`.
- Retry and Return to Title cannot bypass unresolved recovery.

## Multi-runtime / browser scope
- Sidecar revision checks reject stale collection snapshots and protect sequential multi-runtime writes sharing localStorage.
- localStorage remains browser/device-local; no cloud sync or cross-device lock service is added.
- CI mobile coverage is iPhone-sized Chromium with touch events, not real Safari iOS certification.

## Acceptance criteria
- v1/v2 sidecars remain readable without mutation on read; first write upgrades to v3.
- Crash after journal staging and before Save pending is recovered after a fresh page runtime.
- Crash after card claim or Save claim never duplicates cards, EXP or items.
- Primary corruption recovers from a newer valid backup; equal-revision checksum conflict and loss of both active copies fail closed.
- Legacy pending rewards without activation marker still settle.
- Save Schema v1, \`js/save.js\` blob, character Main/Backup/Guard, Gold, EXP formulas, item definitions and confirmed rules remain unchanged.
- Full unit, integration, regression, mutation, syntax and browser workflows pass on the exact PR head.
- PR remains Draft and is not merged.
