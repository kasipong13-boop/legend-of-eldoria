# TDR-030 — Approved Implementation Plan (PR #30)

Status: APPROVED by Game Owner — Companion Journal B / Multi-tab Lock A.
Repository: kasipong13-boop/legend-of-eldoria
Branch: port/card-acquisition-current-save-engine
PR: #30 (Draft; do not merge).

## Approved decisions

- Companion Recovery Journal: IndexedDB, separate from the Card Collection Sidecar.
- Multi-tab serialization: Web Locks API exclusive lock, fail-closed when unavailable, denied, or unsupported.
- The approval does not authorize merge, release, gameplay-rule changes, Save Schema changes, or Gold Economy work.

## Non-negotiable compatibility boundaries

1. Keep `js/save.js` byte-for-byte unchanged; Character Save Schema remains v1.
2. Keep Card Collection Sidecar schema v2 and its existing data contract. The recovery journal must not be embedded in that sidecar.
3. Keep all existing character Main / Backup / Guard records and Save Engine APIs unchanged.
4. Keep current card acquisition eligibility, rarity, drop chance, duplicate, EXP, item and Gold rules unchanged.
5. Do not delete existing Save, sidecar, journal, quarantine, or recovery evidence.
6. Keep PR #30 Draft and unmerged.

## Target architecture

- IndexedDB database: `eldoria-reward-recovery`.
- Object stores:
  - `journal`: durable reward intents keyed by character + reward identity; retains completed receipts.
  - `quarantine`: immutable evidence for conflicting, orphaned, malformed, or sequence-inconsistent records.
- Journal record contains: characterId, rewardId, encounterId, monsterId, EXP, zero Gold, item drops, card payload, createdAt, payload digest, lifecycle status and timestamps.
- Lifecycle: `prepared -> sidecarStaged -> savePending -> cardsClaimed -> saveClaimed -> completed`.
- No journal record is physically deleted as part of normal settlement or recovery.
- Reward identity remains bound to the character's monotonic Save sequence; encounter identity is a separate unique identifier bound to exactly one reward.
- Reusing an identity with a different payload is a conflict and is quarantined; retries reuse the original durable payload and never reroll.
- A missing Sidecar stage for a journaled/new reward is not legacy success. Legacy compatibility is permitted only when no journal evidence or activated reward-system evidence exists and the pending reward is positively identified as pre-acquisition legacy data.
- Cross-store atomicity is implemented as a forward-only recovery protocol, not claimed as a distributed transaction.

## Lock protocol

- Acquire `navigator.locks.request("eldoria:reward:" + characterId, { mode: "exclusive", ifAvailable: true }, callback)`.
- If Web Locks is unavailable, the request is denied, or callback is not granted, stop the reward mutation and preserve all durable evidence.
- Hold the lock across the complete reward state transition, including IndexedDB operations, Sidecar operations, Save Engine commit/resume and finalization.
- Do not implement a localStorage or IndexedDB pseudo-lock fallback.
- Normal non-reward saves continue to use the existing Save Engine optimistic stale-write protection.

## Implementation sequence

1. Record this approved TDR and capture the exact current PR head.
2. Add an IndexedDB Journal module with schema versioning, deterministic payload comparison, durable transactions, list/get/transition, and quarantine operations.
3. Add a Web Locks coordinator with fail-closed behavior and injectable test adapters.
4. Restore Card Collection Sidecar to schema v2; retain only card ownership, pending card reward and claimed receipt responsibilities.
5. Refactor reward staging/settlement/recovery to async operations under the per-character Web Lock:
   - create durable encounter + reward intent;
   - stage card payload in Sidecar;
   - commit the unchanged Save Schema v1 pending reward;
   - claim Sidecar cards + receipt;
   - claim EXP/items via existing Save Engine;
   - mark Journal completed.
6. On startup/Continue, reconcile IndexedDB Journal, Sidecar receipts and Save sequence; quarantine any mismatch and block gameplay.
7. Add unit tests with fake IndexedDB and fake Web Locks; add failure injection at every transition boundary.
8. Add browser tests for reload recovery, two-tab lock exclusion, lock denial, missing API fail-closed, and Safari-compatible feature detection. Do not claim actual iOS Safari testing unless run on a real device.
9. Run the full CI suite on the exact PR head and publish the FI-01..FI-38 matrix with executed/not-executed status.
10. Update protocol/GDD/work log to match the implemented architecture and report remaining risks.

## Failure Injection coverage

- FI-01..06: journal creation, duplicate identities, payload mismatch, interrupted IndexedDB transactions, retry after reload.
- FI-07..14: orphaned Journal/Sidecar/Save records, corruption, missing stages, quarantine and evidence retention.
- FI-15..22: Save pending commit/resume interruptions and cross-store forward recovery.
- FI-23..30: sidecar card claim, receipt persistence, Save claim, duplicate replay and legacy compatibility.
- FI-31..38: encounter identity collisions, reload/crash, two-tab lock contention/denial, unavailable Web Locks, journal loss/corruption and quarantine.

## Acceptance gates

- IndexedDB Journal is the sole durable companion journal; no battle payload/journal state remains in localStorage Sidecar schema.
- Sidecar schema v2 remains compatible and no character Save schema changes.
- Web Locks is used for all reward transitions and fails closed when unsupported.
- No duplicate cards, EXP, or item rewards under any executed FI scenario.
- No reroll or identity rebinding on retry.
- All FI-01..FI-38 are individually reported; unexecuted cases are not represented as passed.
- Unit, integration, browser smoke, mobile compatibility, Save compatibility and current-head CI evidence are attached to PR #30.
- PR remains Draft and unmerged.
