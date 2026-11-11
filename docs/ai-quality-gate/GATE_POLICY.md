# Eldoria AI Quality Gate — Gate Policy v0.1

Status: PROPOSED / NOT ACTIVE. Manual specification; no enforcement is claimed.

## Status vocabulary
PASS: all mandatory criteria have current, verifiable evidence.
FAIL: a mandatory criterion is violated.
PENDING: a check is running or awaiting known evidence.
NOT ASSESSED: evidence/check absent, inaccessible, or out of scope.
WAIVED: a non-critical criterion has an explicit, recorded Owner exception with scope, expiry, and rationale; never equivalent to PASS.
STALE: evidence no longer matches the reviewed head/base SHA or relevant inputs.

## Decision algorithm
A required FAIL => NO-GO. A required PENDING, NOT ASSESSED, or STALE => HOLD/NO MERGE. A valid limited WAIVER may cover only an explicitly waivable criterion. All required gates PASS (or allowed documented waivers) => ELIGIBLE FOR OWNER REVIEW, not automatic merge. Owner decision must be separately recorded. A change to head SHA invalidates dependent checks until revalidated.

## G1 — Governance and scope
Inputs: task ID, approved scope/non-goals, Owner decision, branch/head/base SHA, changed paths, active policy version.
PASS: no unauthorized protected paths; no unapproved design, spend, secrets, deployment, workflow, settings, or merge action; PR isolation maintained.
STOP: scope expansion, unapproved protected file edit, missing Owner approval where required.

## G2 — Design Review
Inputs: approved Master GDD, GAME_CONFIRMED, task acceptance criteria, proposed behavior.
PASS: all changed behavior traceable to approved rules or separately approved new decisions; unresolved conflicts are reported, not silently resolved.

## G3 — Cross-system Consistency
Inputs: class/job, deck, rarity, status, monster, progression, reward and save contracts relevant to the change.
PASS: no unexplained contradiction across systems; dependencies and regression impact recorded.

## G4 — Security
Inputs: PR diff, permission scope, secrets exposure scan evidence, dependency changes, hook scripts, API cost and workflow triggers.
PASS: no unmitigated critical/high findings; no secret exposure; least privilege and budget controls verified before activation.
STOP: suspected secret exposure, unsafe write/push hook assumptions, unapproved paid API or GitHub setting change.

## G5 — Agent and Skill QA
Inputs: exact prompt/skill version, tool permissions, behavioral cases, evaluator and evidence.
PASS: all mandatory authorization, injection-resistance, truthful-reporting and protected-file cases pass; independent evaluation.

## G6 — Code / Save / CI
Inputs: exact head SHA, tests and run IDs, logs, save compatibility evidence, browser matrix.
PASS: all relevant required checks passed on the reviewed SHA; no unsupported claim of Safari coverage from Chromium-only tests; save invariants preserved.

## Non-waivable controls
Owner merge authorization; Owner authorization for protected/save/schema changes; no secret exposure; no unauthorized spending, deployment, workflow activation, or permission escalation; truthful evidence provenance. Waivers cannot override these.

## Review order
G1 preflight -> G2/G3 -> G4/G5 -> G6 -> aggregate decision -> Owner review. Read-only reviews may inspect in parallel; implementation remains separately authorized.
