# Card Reward Recovery Protocol — PR #30

Status: implementation specification; TDR-030 approved (IndexedDB / Web Locks); PR remains Draft and unmerged.

## Invariants

- `js/save.js` and Character Save Schema v1 are unchanged.
- Card Collection Sidecar remains schema v2. Its only reward responsibilities are pending card payloads, ownership and claimed receipts.
- Companion reward payloads and lifecycle state live in IndexedDB, not in the Card Collection Sidecar or Character Save.
- Reward identity is the character's monotonic `nextRewardSeq` rendered as a decimal string.
- Encounter identity is a separate cryptographically random 128-bit hex ID generated when a battle begins and bound to one reward identity.
- Monster rewards preserve zero Gold. EXP and item reward behavior is unchanged.
- Card copies are keyed by `cardId + stars`; sidecar ownership mutation and receipt remain one verified write.
- Retries reuse the first durable payload. Reusing a reward or encounter identity with a different payload is a conflict.
- Recovery is forward-only. Mismatches are quarantined; no recovery evidence is deleted.

## Approved storage and lock decisions

### Companion Journal — IndexedDB (TDR-030-A: B)

- Database: `eldoria-reward-recovery`, version 1.
- Object stores: `journal` and `quarantine`.
- Journal records are keyed by `characterId:rewardId` and include a separate `encounterId`, full immutable payload, status and timestamps.
- Completed and quarantined records are retained; normal settlement does not prune them.
- A small localStorage activation marker (`eldoria.reward.v1.active.<characterId>`) is only a fail-closed indicator that the Journal has been activated. It does not contain reward payload or lifecycle state. It survives IndexedDB database loss so a missing Journal cannot be misclassified as a legacy reward.

### Multi-tab lock — Web Locks API (TDR-030-B: A)

- Lock name: `eldoria:reward:<characterId>`.
- Request: exclusive mode with `ifAvailable: true`.
- Lock is held across the full reward operation: Journal prepare, Sidecar stage/claim, Save Engine commit/resume, Journal transitions and recovery.
- Missing Web Locks, denied/busy locks, or lock request failures fail closed. No localStorage or IndexedDB pseudo-lock fallback is permitted.
- This requires a secure context and a browser implementing Web Locks. Unsupported browsers cannot process reward mutations until a supported browser is used.

## Journal lifecycle

`prepared -> sidecarStaged -> savePending -> cardsClaimed -> saveClaimed -> completed`

Any nonterminal state may move to `quarantined`. The protocol never moves backward.

## Reward settlement

1. Generate an encounter ID at battle start.
2. On victory, create the immutable reward payload using the current Save sequence; do not reroll on retry.
3. Under the Web Lock, write/verify the IndexedDB Journal PREPARED record. Identity reuse with a different payload or encounter is quarantined.
4. Stage the card payload in the unchanged Sidecar v2 using `stageReward`.
5. Transition Journal to `sidecarStaged`.
6. Create/commit the existing Save Schema v1 pending reward using `Save.withPendingReward` and `saveSystem.commit/resume`.
7. Transition Journal to `savePending`.
8. Claim Sidecar cards and receipt together using `CardCollection.claimReward`; a missing stage is a failure when a Journal record exists.
9. Transition Journal to `cardsClaimed`.
10. Claim EXP/items using `Save.withClaim` and `saveSystem.commit/resume`.
11. Transition Journal to `saveClaimed`, then `completed`.

The IndexedDB, localStorage Sidecar and Character Save are separate stores; this is a forward-recovery protocol, not a distributed atomic transaction.

## Recovery and quarantine

- On Continue and before a new encounter, acquire the Web Lock and reconcile Journal, Sidecar and Save.
- A Journal entry can reconstruct a missing Save pending reward only when its sequence exactly equals `nextRewardSeq`.
- A Save pending reward must match Journal sequence, monster, EXP, zero Gold and ordered item drops.
- Sidecar pending rewards without a corresponding Journal record are orphaned and quarantined.
- More than one incomplete reward, sequence gaps, identity/payload mismatches, missing activated Journal data, or completed Journal records ahead of Save are quarantined and block gameplay.
- A legacy pending reward may settle only when no Journal activation marker exists and no matching Sidecar stage exists. Once activated, missing Journal data is never treated as legacy success.
- Quarantine preserves both the original record and conflict evidence. No automatic data deletion or reset occurs.

## Verification requirements

- Unit: IndexedDB transaction/error behavior, immutable identity, legal transitions, quarantine retention, Web Lock unavailable/busy/failure.
- Integration: all cross-store crash boundaries and legacy compatibility.
- Failure Injection: FI-01..FI-38 individually reported as passed, failed, blocked or not executed.
- Browser: real IndexedDB reload recovery, two-tab lock contention and lock denial.
- Mobile: iPhone-sized Chromium is not equivalent to real iPhone Safari; actual Safari results must be separately identified.
- Save compatibility: compare `js/save.js` SHA and assert Character Save Schema v1 and pending reward shape unchanged.
- PR remains Draft and unmerged until separate Game Owner authorization.
