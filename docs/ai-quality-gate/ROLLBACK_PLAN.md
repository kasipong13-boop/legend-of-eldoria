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

## Pilot rollback runbook (QG05-M04)
1. Record failure, affected environment, PR/head SHA, time and evidence.
2. Stop task dispatch and paid retries with the previously approved stop mechanism; advisory prompts are not kill switches.
3. Notify Owner and identify authorized rollback operator.
4. Preserve redacted audit logs, configuration baseline and failure evidence.
5. Revert only authorized isolated pilot artifacts; never silently change main, security settings, workflows, production data or user saves.
6. Verify no unintended writes, dispatches, spending or protected-file changes remain.
7. Record outcome, unresolved risks, escalation and Owner decisions.

## Rollback readiness and security controls (QG05-H03)
Before activation, document operator, authorization reference, configuration baseline, safe-stop procedure, recovery objective, validation checklist and escalation contact. Recovery-time objectives require Owner approval; no unverified time guarantee is implied.
Never disable branch protection, required checks or reviews to expedite rollback. Settings, permission, workflow, deployment or production-save changes need separate authorization. If safe rollback cannot be verified, HOLD and escalate.
