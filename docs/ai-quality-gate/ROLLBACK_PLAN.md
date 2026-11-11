# Eldoria AI Quality Gate — Rollback and Recovery Plan v0.1

Status: PROPOSED / NOT EXECUTED.

## Documentation-only pilot
Create six new Markdown files on a dedicated branch only after specific Owner authorization and fresh HEAD preflight. Do not modify existing governance, workflow, source, tests or save files. If rejected before merge, close the draft PR and optionally delete the isolated branch only with authorization. `main` remains untouched.

## Agent/Skill pilot
Use a disposable branch/sandbox with read-only tools by default. Record installed file list, upstream revision and test fixtures. On failure, disable/remove only the pilot artifacts on its branch, stop task dispatch and report evidence. Do not assume third-party hooks enforce policy.

## Automation/enforcement changes (future, separate approval)
Before changing GitHub Rulesets, workflows, permissions or secrets, capture current settings, required checks, owner approvals, trigger conditions, budget limits and an independent recovery procedure. Define rollback operator and authorization. Never automatically revert security controls or reopen unsafe access.

## Save-aware rollback
A Git revert is insufficient if a new build has already written an incompatible save format. Require forward/backward compatibility plan, synthetic fixture tests and Owner decision before release. Never delete user saves to recover from a deployment.

## Abort conditions
Unexpected diff, SHA mismatch, new high/critical security issue, paid API request without approved budget, unauthorized write/merge/dispatch, unverified backup or recovery risk. Stop and preserve evidence.

## Post-rollback checks
Verify branch/PR state, absence of unintended changed paths, no unexpected workflow dispatch, test status tied to exact SHA, and unchanged Save Engine/Schema. Record all remaining uncertainties as NOT VERIFIED.
