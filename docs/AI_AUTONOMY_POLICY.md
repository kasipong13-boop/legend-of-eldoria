# LEGEND OF ELDORIA — Autonomous AI Development Policy v1.0

## Model A Governance Amendment v1.1 — Proposed for Owner Review

**Status: PROPOSED, NOT ACTIVE.** This section documents the requested role migration for review. It does not authorize workflow activation, API spending, implementation dispatch, settings changes, or merging. Upon separate owner approval and merge, the Model A roles below supersede v1.0 references to Claude as the implementation engineer.

- **Game Owner:** sole final authority for product decisions, budget, GitHub settings, secrets, deployments, and each merge.
- **ChatGPT Director:** prepares task packets, coordinates handoffs, checks evidence and acceptance criteria; cannot self-authorize spending or merge.
- **Codex:** proposed primary implementation agent on an owner-authorized, task-specific non-main branch; must verify repository identity, approved base branch and SHA, and clean workspace before any edits.
- **Claude Code:** proposed independent **read-only reviewer**; reports findings bound to the exact PR head SHA, with no Edit/Write, push, commit, PR merge, or deployment permission.
- **GitHub:** source of truth for Issues, PRs, CI evidence, task audit trail and branch protections; workflow automation requires separate approval.

**Proposed lifecycle:** DIRECTOR TASK PACKET → OWNER EXECUTION AUTHORIZATION → CODEX PREFLIGHT/IMPLEMENTATION → PR → CLAUDE READ-ONLY REVIEW + CI → DIRECTOR ACCEPTANCE → OWNER SHA-SPECIFIC MERGE AUTHORIZATION → OWNER MERGE.

**Fail-closed requirements:** stop on missing approval, unexpected repository/branch/SHA, dirty workspace, protected-file scope expansion, stale review/CI evidence, missing budget controls, or uncertain task identity. A new PR commit invalidates prior SHA-bound review and merge approval. No automatic paid retries or merges. Existing player saves, save schema, confirmed game rules, regression baselines and historical archives remain protected.

**Activation boundary:** Existing workflows, including `.github/workflows/claude-task-handoff.yml`, remain unchanged and must not be enabled as part of C1. Future implementation, provider billing limits, secrets, GitHub permissions, and pilot runs require separate owner decisions.

---


**Mode:** C — High autonomy within bounded, owner-approved goals  
**Owner:** Game Owner  
**Director:** ChatGPT  
**Implementation:** Claude Code  
**Control plane:** GitHub Issues, Actions, branches, PRs and CI

## 1. Operating objective
The Game Owner gives the Development Director a high-level objective. The Director decomposes it into a prioritized, dependency-aware backlog. Claude executes eligible tasks sequentially through owner-authored GitHub Issues. The Director reviews implementation evidence and PRs, coordinates bounded fixes, and reports progress to the Game Owner. This is autonomous execution of an approved plan, not permission to invent product direction or expand scope indefinitely.

## 2. Authority boundaries
- Game Owner: final authority over product direction, new game rules, critical-risk changes, secrets/permissions, spending, deployment, and all merges.
- ChatGPT Director: owns backlog ordering, task packets, handoffs, review, QA coordination, and progress reporting.
- Claude: implements only the assigned issue and explicitly authorized subtasks.
- GitHub Actions: invokes Claude only for newly opened `[AI TASK]` issues authored by the repository owner.
- No AI may merge to `main`, deploy, alter repository settings, or grant permissions.

## 3. Autonomy within a task
Claude may inspect, plan, implement, test, and fix defects introduced by its own implementation. It may perform at most two fix-and-retest cycles per task execution. The Director may create the next task when the prior task has been reviewed and dependencies are satisfied. Claude must not create unrelated follow-up tasks, change priorities, or broaden the approved backlog.

## 4. Protected project invariants
- Existing player saves must remain readable and intact.
- No save deletion, reset, schema migration, or destructive recovery operation without explicit Game Owner approval.
- Confirmed game rules, card limits, combat rules, class/job progression, monster rules, and approved art direction are immutable unless the owner explicitly changes them.
- Protected/high-risk paths: `js/save.js`, `js/data.js`, `js/battle.js`, `js/world.js`, `verification/tests/baseline/`, and all persistence/recovery/transaction logic.
- High-risk path changes require a task that names the exact intended change, explains compatibility, and has explicit owner authorization before editing.
- Existing open PRs remain isolated unless explicitly assigned.

## 5. Stop conditions requiring owner input
Stop and report rather than guessing if a task requires a new/conflicting game-design decision; save schema/migration change, data deletion, or recovery behavior change; changing repository permissions, GitHub secrets, paid services, API budgets, or model access; deployment/release/production data operations; scope beyond the approved objective; or a security incident / suspected data corruption.

## 6. Task lifecycle
`OWNER GOAL → DIRECTOR BACKLOG → OWNER-AUTHORED [AI TASK] ISSUE → CLAUDE BRANCH/IMPLEMENT/TEST → DIRECTOR REVIEW → CI/QA → OWNER MERGE APPROVAL`
- One issue represents one bounded task.
- Every task packet includes scope, non-goals, confirmed rules, dependencies, acceptance criteria, tests, risk level, and rollback.
- Claude pushes a task branch and reports its exact name. The Claude Code Action does not necessarily create a PR; the Director creates or updates a PR after verifying the branch.
- The Director reviews the full diff and test evidence before presenting the PR to the owner.
- Failed checks may be routed back to Claude for bounded correction, but no automatic merge is allowed.

## 7. Resource and runaway controls
- One Claude execution per task issue; no unbounded self-triggering loop.
- GitHub Actions job timeout: 45 minutes.
- Claude turn limit: 20.
- Maximum two fix-and-retest cycles per task.
- No automatic recurring task creation or open-ended scheduled coding.
- API usage is metered by Anthropic. The Game Owner controls API key and spending limits in the provider console.
- The Director batches related work and prioritizes by dependency, value, and risk.

## 8. Verification and reporting
Every completed task reports task ID, issue URL, branch and PR URL (only if created); exact files changed; exact test commands and actual results; skipped checks; save/schema compatibility; confirmed-rule compliance; known risks and rollback; next eligible backlog task or explicit blocker.

## 9. Activation requirements
1. This policy and the AI collaboration foundation are merged into `main` by the Game Owner.
2. The official Claude Code GitHub Action is installed/authorized for this repository.
3. `ANTHROPIC_API_KEY` is configured as a GitHub Actions repository secret.
4. The owner-approved test task succeeds on a non-main branch.
5. The Director verifies branch, diff, test evidence, and PR handoff.

Never store API keys in repository files, issue bodies, comments, artifacts, or logs.
