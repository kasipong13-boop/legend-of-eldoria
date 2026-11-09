# LEGEND OF ELDORIA — AI Code Review & QA Standard v1.0

## Review outcomes
- **APPROVE:** No blocking issue found within the reviewed scope; owner may decide to merge.
- **REQUEST CHANGES:** Correctable issues remain; author should update the PR.
- **BLOCK:** Scope, evidence, safety, confirmed-rule conflict, or data integrity issue makes the change unsafe to merge.

AI review is advisory. Only the Game Owner authorizes merge/release.

## Review sequence
1. Read the task packet and applicable approved design documents.
2. Inspect PR description, changed files and complete diff.
3. Trace changed behavior into callers, state ownership, save/load paths and UI.
4. Compare behavior against existing tests and Prototype 0.1 regression expectations.
5. Check mobile touch behavior, desktop input and responsive layout where relevant.
6. Inspect security: secrets, unsafe HTML, external requests, dependency changes and workflow permissions.
7. Verify tests actually ran and that outputs correspond to the PR head.
8. Return findings ordered by severity, with file/path and line references where available.

## Severity
- **P0 Critical:** data loss, credential leak, destructive deployment, unrecoverable save corruption.
- **P1 High:** confirmed gameplay rule broken, major progression/combat defect, severe exploit or blocker.
- **P2 Medium:** feature behavior incorrect, important edge case missing, regression in mobile/desktop UX.
- **P3 Low:** minor polish, maintainability, non-blocking documentation issue.

Any P0/P1 blocks merge. P2 blocks when it violates acceptance criteria or affects core gameplay. P3 may be recorded for follow-up.

## Required test evidence
Use the current scripts from `verification/package.json`, not remembered commands. Depending on changed scope, require:
- JavaScript syntax checks.
- Unit and integration tests.
- Prototype regression suite.
- Mutation suite for critical logic where applicable.
- Browser smoke/save tests for UI, world or persistence changes.
- Manual real-device testing for iOS Safari / Android browser changes when emulation is insufficient.

Report exact command, pass/fail/skip, environment and any limitations. Do not claim device testing based only on viewport emulation.

## Save-system review checklist
For any code that reads or writes persistent state:
- Existing saves remain readable.
- No silent destructive reset or data loss path.
- Transaction, recovery and pending-reward behavior remain safe.
- Save lock and failure states are handled.
- Tests cover success, interrupted writes, malformed data and recovery.
- Schema changes include an approved migration and rollback strategy.

## Final review report
1. Verdict.
2. Blocking findings (P0/P1).
3. Non-blocking findings (P2/P3).
4. Confirmed-rule compliance.
5. Save / regression / mobile impact.
6. Test evidence and skipped checks.
7. Recommended next action.
