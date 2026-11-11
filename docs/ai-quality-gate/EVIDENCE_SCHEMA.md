# Eldoria AI Quality Gate — Evidence Schema v0.1

Status: PROPOSED / NOT ACTIVE.

## Required fields
- report_id, task_id, generated_at_utc, reviewer_identity, review_mode (read-only/implementation).
- repository, PR number/url, base_branch, base_sha, head_branch, head_sha, SHA verification method/time.
- approved_task_scope, non_goals, Owner authorization reference, active governance version.
- changed_paths, protected_paths_touched, dependencies and upstream prompt/skill revisions.
- gate_results G1–G6, each with status, mandatory criteria, findings, evidence URLs/paths, evidence SHA, observed time, reviewer.
- CI runs: workflow name, run ID, run URL, run head SHA, conclusion, job names and log references.
- test environment: OS, runtime, browser/version, physical-device vs emulated, commands, execution outcome.
- security findings: ID, severity, exploitability/impact, mitigation, Owner decision.
- budget: provider, model, approval, expected ceiling, actual measured spend or NOT VERIFIED.
- rollback plan, open blockers, overall decision, Owner decision/date/reference.

## Example (illustrative; never actual test evidence)
```yaml
report_id: EAQG-EXAMPLE-001
task_id: EXAMPLE-001
review_mode: read-only
repository: kasipong13-boop/legend-of-eldoria
pr: null
base_sha: NOT_VERIFIED
head_sha: NOT_VERIFIED
active_governance: v1.0
gates:
  G1: NOT_ASSESSED
  G2: NOT_ASSESSED
  G3: NOT_ASSESSED
  G4: NOT_ASSESSED
  G5: NOT_ASSESSED
  G6: NOT_ASSESSED
ci_runs: []
owner_decision: PENDING
overall: NO_MERGE
```

## Provenance rules
A file blob SHA is not the branch HEAD SHA. A PR base SHA is not necessarily the current main HEAD. CI conclusions must match the reviewed head SHA and relevant workflow version. Never infer an unrun test from a test definition. A GitHub permission field does not prove Ruleset enforcement. A draft PR body is not a verified diff. If a check is inaccessible, mark NOT ASSESSED. If head SHA changes, dependent evidence becomes STALE; reassess and rerun only when authorized.

## Reporting and privacy
Redact secrets, credentials, personal identifiers and save payloads. Prefer minimal log excerpts and stable GitHub links. Preserve failure findings and Owner decisions; do not fabricate PASS, timestamps, URLs or costs.
