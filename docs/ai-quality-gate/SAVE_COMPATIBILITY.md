# Eldoria AI Quality Gate — Save Compatibility Contract v0.1

Status: PROPOSED / TESTS NOT EXECUTED. Applies to any PR that can affect persistence, rewards, recovery, gameplay state, or browser storage.

## Verified baseline from `js/save.js` static inspection
Browser/Node-compatible Save module, `SCHEMA_VERSION = 1`, localStorage index `eldoria.index`, character records `eldoria.char.<id>.main|backup|guard`, discarded records namespace, storage probe, write/readback validation and recovery behavior. `DEBUG_SAVE_HOOKS = false`. FNV-1a checksum detects accidental corruption only; it is not a security mechanism.

## Invariants
1. Existing v1 saves remain readable without destructive migration.
2. Character list/index, main/backup/guard recovery and intentional discard semantics are preserved.
3. No silent deletion/reset of real player data.
4. Partial writes, interrupted writes and corrupt records must not cause irreversible loss of recoverable valid records.
5. Reward acquisition and retry/recovery must not duplicate awards; test idempotency where applicable.
6. Schema migration, recovery behavior change or protected file modification requires explicit, task-specific Owner approval.
7. Tests must use synthetic isolated storage, never real player localStorage.
8. Rollback compatibility must be assessed bidirectionally if a future version writes new save structures.

## Required verification matrix
- Unit: serialization/canonicalization, validation, checksum handling, malformed input.
- Integration: index rebuild, multiple characters, main/backup/guard recovery, storage quota/failure, interrupted write.
- Regression: existing save fixtures and baseline suite, reward idempotency, battle/world/card collection interactions.
- Browser: real Chromium smoke on tested SHA; separate physical iPhone Safari evidence when mobile compatibility is asserted.
- Negative: corrupted backup, missing guard, stale index, unavailable storage, duplicate reward retry.

## Evidence requirements
Record fixture versions, test commands, actual exit status, run ID/URL, head SHA, browser/device identity and observed outcomes. Existing `validate.yml` has syntax-and-structure, full-regression-suite and browser-smoke (Chromium); that alone does not prove iPhone Safari compatibility. No tests were run for this specification.

## Stop conditions
Any legacy save regression, unapproved schema change, data loss, unproven recovery, or unexplained reward duplication => FAIL/NO-GO. Missing evidence => NOT ASSESSED/HOLD.

## Synthetic fixture inventory (QG05-M03)
| ID | Scenario | Required assertion |
|---|---|---|
| SV-01 | Valid legacy schema v1 save | Load without data loss |
| SV-02 | Corrupt main, recoverable backup | Recover per existing contract |
| SV-03 | Missing guard or stale index | Preserve valid records and recovery behavior |
| SV-04 | Interrupted or failed write | Preserve previously recoverable data |
| SV-05 | Unavailable storage or quota exceeded | Report failure, never fabricate success |
| SV-06 | Duplicate reward retry | No duplicate award |
| SV-07 | Multiple character records | Preserve index/character isolation |
| SV-08 | Future-schema rollback | Assess forward and backward compatibility |

## Fixture acceptance and provenance
Use synthetic isolated storage only. Record fixture version and SHA, test command, expected and observed result, environment, head SHA and CI run ID/URL. Lost recoverable saves, unapproved migrations and duplicate rewards are NO-GO. Missing evidence is NOT ASSESSED/HOLD. These fixtures are specifications, not executed tests; Chromium evidence does not prove physical iPhone Safari compatibility.
