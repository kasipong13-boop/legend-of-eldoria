# PR #30 — Failure Injection Verification Status

This report is deliberately conservative. A test is marked **PASS** only when the named behavior is exercised by an automated test or an observed CI result. Static source inspection is not reported as a runtime pass.

## Confirmed case definitions recovered from the current handoff

| FI | Scenario | Current evidence | Status |
|---|---|---|---|
| FI-05 | Crash after Journal PREPARED; reload must reuse the same payload | Browser smoke now creates PREPARED only, reloads, then verifies Sidecar/Save settlement and completed Journal | Pending latest CI |
| FI-10 | Sidecar pending reward without a corresponding Journal must be quarantined | Recovery path implemented; no dedicated runtime fixture yet | Not executed |
| FI-12 | Same Reward ID with a different payload must be rejected | Reward Journal unit test verifies conflict evidence while preserving the canonical record | PASS on verified CI head 844a9db |
| FI-20 | Save sequence and Journal identity mismatch must be quarantined | Recovery path implemented; no dedicated runtime fixture yet | Not executed |
| FI-22 | Save claim succeeds but Journal transition is interrupted; recovery must finish forward | Journal state recovery supports cardsClaimed -> saveClaimed -> completed; no dedicated Save-commit crash fixture yet | Not executed |
| FI-29 | Missing Sidecar stage for a Journal-backed reward must not be treated as legacy success | Browser smoke PREPARED-only fixture verifies Journal payload recreates Sidecar stage after reload | Pending latest CI |
| FI-35 | Two tabs cannot concurrently mutate the same character's reward state | Browser smoke holds the per-character Web Lock in one page and verifies the second page receives REWARD_LOCK_BUSY | PASS on verified CI head 844a9db |
| FI-38 | Journal deleted before COMPLETE must be detected and quarantined | Activation marker + missing-Journal quarantine path implemented; no dedicated runtime deletion fixture yet | Not executed |

## Remaining matrix

The complete original case-by-case definitions for FI-01..FI-38 were not found in the repository, PR discussion, or available project files during this continuation. The prior handoff preserves the group ranges but not the full definitions for the other 30 cases. They are therefore **not reconstructed or marked passed here**.

| Group | Cases | Status |
|---|---:|---|
| Journal / Identity | FI-01–06 | FI-05 identified above; remaining cases require original definitions |
| Sidecar / Orphan | FI-07–14 | FI-10 and FI-12 identified above; remaining cases require original definitions |
| Character Commit / Resume | FI-15–22 | FI-20 and FI-22 identified above; remaining cases require original definitions |
| Card / Character Claims | FI-23–30 | FI-29 identified above; remaining cases require original definitions |
| Retry / Reload / Collision | FI-31–38 | FI-35 and FI-38 identified above; remaining cases require original definitions |

## Verified CI evidence (exact head 844a9dbfec9f9dd00960d5cd9d068607159234c2)

- Full Verification run 42742476707: success.
- Validate Prototype run 42742476645: success.
- Unit / Save tests: 258 passed, 0 failed.
- World integration: 31 passed, 0 failed.
- UI contract: 15 passed, 0 failed.
- Monster Spawn integration: 6 passed, 0 failed.
- Regression: original 0.1 rules/cards/Poring data and 350 seeded battles unchanged.
- Mutation: 26/26 caught.
- Browser: real localStorage reload passed; desktop and iPhone-sized Chromium smoke passed; pageErrors = [].
- Browser smoke includes IndexedDB Journal recovery after PREPARED and a two-page Web Locks contention check.

**Important:** the evidence above belongs to the exact head shown. Subsequent changes to FI-38 quarantine handling and the PREPARED-only browser fixture require a fresh CI run before being treated as verified. Actual iPhone Safari remains untested.
