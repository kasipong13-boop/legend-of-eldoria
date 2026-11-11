# LEGEND OF ELDORIA — AI Collaboration Protocol v1.0

## Model A Collaboration Amendment v1.1 — Proposed for Owner Review

**Status: PROPOSED, NOT ACTIVE.** This proposed Model A workflow supersedes the v1.0 Claude-implementation lifecycle only after owner approval and merge; legacy content below is preserved for traceability.

**Proposed roles:** ChatGPT = Development Director and acceptance coordinator; Codex = primary implementation agent; Claude Code = independent read-only PR reviewer; GitHub = issue/PR/CI evidence hub; Game Owner = exclusive final merge and spending authority.

**Proposed lifecycle:** DIRECTOR PLAN → OWNER EXECUTION GATE → CODEX PREFLIGHT → CODEX BRANCH/IMPLEMENT/TEST → PR → CLAUDE READ-ONLY REVIEW + REQUIRED CI → DIRECTOR ACCEPTANCE → OWNER SHA-BOUND MERGE GATE → OWNER MERGE.

**Task packet contract:** task ID, GitHub issue, owner approval reference, base branch, exact expected base SHA, target branch, allowed and protected paths, non-goals, acceptance tests, save compatibility, risk, budget authorization, max attempts, and idempotency key. Missing or conflicting fields BLOCK dispatch.

**Review contract:** Claude may inspect diff, relevant code and CI evidence, and produce severity-ranked findings with file/line, impact and recommendation. Claude must not edit, commit, push, merge, deploy, alter settings, or invoke paid services without authorization. Review results are advisory, must name the exact PR head SHA, and become STALE if that SHA changes.

**Evidence and approval:** record issue/PR URLs, dispatch and run IDs, base/head/reviewed SHAs, CI conclusions, findings, approval references, cost and audit events. Owner execution authorization is distinct from owner merge authorization. No automated merge, automatic paid retry, workflow activation or settings changes are authorized by this amendment.

**Preservation:** protect `js/save.js`, `js/data.js`, `js/battle.js`, `js/world.js`, `verification/tests/baseline/`, save/recovery behavior, confirmed rules, existing PRs, and historical project records. Any high-risk changes require a separately approved scope.

---


**Status:** Adopted operating protocol  
**Applies to:** ChatGPT, Claude/Claude Code, GitHub Actions and the Game Owner  
**Project:** Existing HTML/CSS/JavaScript browser RPG

## 1. Team roles

| Role | Responsibility | Authority |
|---|---|---|
| Game Owner | Product direction, final design decisions, final merge/release approval | Final authority |
| ChatGPT — AI Development Director | Master planning, task decomposition, GDD consistency, handoffs, independent code/PR review, QA coordination and change-log oversight | May prepare and review; does not silently change confirmed rules |
| Claude — AI Implementation Engineer | Repository inspection, code implementation, focused tests, bug fixes and Pull Request preparation | May change only assigned scope on a non-main branch |
| GitHub — Source Control & CI | Version history, branches, pull requests, review evidence, automated verification and deployment | Enforces traceability; not a design authority |
| GitHub Actions — Automation | Repeatable checks and explicitly configured AI workflows | Least privilege; no implicit approval or merge authority |

## 2. Source-of-truth hierarchy

Resolve conflicts in this order:
1. Explicit latest decision from the Game Owner.
2. Current approved project foundation / confirmed rules and approved design documents.
3. Current `main` branch implementation and tests, where not in conflict with approved rules.
4. Task-specific handoff approved by the Game Owner.
5. AI suggestions, assumptions and exploratory drafts (never authoritative until approved).

Never turn an AI suggestion into a confirmed game rule without owner approval. Record resolved conflicts in the appropriate project document and change log.

## 3. Standard task lifecycle

`DIRECTOR PLAN → OWNER GATE (when required) → CLAUDE IMPLEMENT → PULL REQUEST → CHATGPT REVIEW → CI / QA → OWNER APPROVAL → MERGE`

For routine tasks already authorized by the owner, planning and implementation may proceed without asking for approval at every small step. Ask before a genuinely new design/product decision, ambiguous behavior, high-risk save change, or scope expansion.

### Task packet required
Every handoff to Claude must include:
- Task ID and concise goal.
- Context and source documents.
- Confirmed rules that must remain unchanged.
- Scope and explicit non-goals.
- Expected files / modules (mark uncertain paths as hypotheses).
- Acceptance criteria written as observable outcomes.
- Required tests and commands, based on current repository scripts.
- Save compatibility / migration impact.
- Risk classification and approval gates.
- Expected PR title and reporting format.

### Claude implementation
- Work only on a dedicated task branch, never directly on `main`.
- Inspect the current code and tests before editing.
- Keep the diff narrow and avoid unrelated formatting/refactoring.
- Do not modify other active task branches or existing PRs.
- Run and report real tests. Never fabricate test results.
- Open a PR; do not merge.

### ChatGPT review
Review the PR against:
- Task scope and acceptance criteria.
- Confirmed rules and project documents.
- Existing behavior and regression risk.
- Save compatibility and recovery guarantees.
- Code correctness, security, performance and mobile UX.
- Test quality and whether reported results are evidenced.
- Unrelated changes and completeness of documentation.

Use one of: **APPROVE**, **REQUEST CHANGES**, or **BLOCK**. A ChatGPT approval is advisory; the Game Owner retains merge authority.

## 4. Risk and approval gates

| Risk | Examples | Required handling |
|---|---|---|
| Low | Documentation, isolated visual polish, non-gameplay copy | Implement on branch, PR and review |
| Medium | New UI, isolated content, new non-critical module | Focused tests + full relevant regression |
| High | Combat, card rules, progression, world interaction, shared state | Explicit task authorization, design traceability, expanded regression |
| Critical | Save schema/migration/recovery, data deletion, deployment/security/credentials | Stop for explicit owner approval before implementation |

The protected/high-risk paths are listed in `CLAUDE.md`. Protection means additional review, not a permanent ban.

## 5. GitHub rules

- `main` is the integrated release branch.
- Use descriptive branches: `feature/<task>`, `fix/<task>`, `docs/<task>`, `chore/<task>`, or `qa/<task>`.
- One task or tightly coupled change per PR.
- PRs must state purpose, scope, files, tests, compatibility, risks and rollback.
- No direct main commits, force-push to shared branches, automatic merge, or automatic deployment approval by AI.
- Keep current open PRs isolated; do not rewrite or merge them as part of unrelated setup work.

## 6. Quality gates

Use the repository's actual scripts in `verification/package.json`. The standard full suite currently includes unit/integration, regression, mutation and browser checks. Run the applicable checks locally/CI and report any skipped check explicitly.

A green syntax check alone is not sufficient for gameplay, save, or UI changes. Browser emulation is not equivalent to testing Safari on a physical iPhone.

## 7. Save and prototype preservation

- Existing browser saves must remain readable unless an owner-approved migration explicitly changes this.
- Never clear, overwrite, or fabricate user saves to pass tests.
- Preserve the Prototype 0.1 regression baseline and historical archives.
- Maintain current localStorage limitations in user-facing documentation; do not imply cross-device sync.
- Do not silently change existing battle, monster, card or character progression behavior.

## 8. Secrets and privacy

- API keys belong only in GitHub Actions Secrets or the relevant provider's secure connection settings.
- Never put secrets in source files, workflow logs, task prompts, PR bodies or artifacts.
- Use least-privilege GitHub permissions; default to read-only for planning and review.
- Do not add a workflow that writes to the repository, opens/merges PRs, deploys, or spends API credits without a separately reviewed design and owner authorization.
- Repository visibility is currently public. Do not commit private credentials, personal data, unpublished sensitive material, or proprietary assets without confirming their distribution rights. Changing repository visibility requires a separate owner decision.

## 9. Handoff and change records

For every completed task:
- Claude posts a concise implementation report in the PR.
- ChatGPT records review findings and disposition.
- Update `CHANGELOG_TH.md` / `WORK_LOG_TH.md` when the task materially changes the game or project state.
- Update relevant design documents only when the task changes approved design.
- Keep unresolved issues explicit; never hide a failed or skipped test.

## 10. Current baseline at protocol adoption

- Repository: `kasipong13-boop/legend-of-eldoria`.
- Default branch: `main`.
- Game: Prototype 0.2.3, static HTML/CSS/JavaScript.
- Verification scripts: `verification/package.json`.
- Existing AI workflow: `.github/workflows/ai-collaboration.yml` is planning/review-only and requires repository secrets. It does not implement game code or create PRs.
- Existing open PR #16: Battle System Foundation. Keep it separate from AI-team bootstrap work.
- Current main commit at setup inspection: `0de2c0de807417b10bca47f48c6f8bbe02623c3c`.

This baseline is a point-in-time record. Re-check GitHub before each task.
