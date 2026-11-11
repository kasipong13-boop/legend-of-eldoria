# Eldoria AI Quality Gate — Architecture v0.1

Status: PROPOSED / NOT ACTIVE. This document does not authorize implementation, API calls, workflow activation, settings changes, or merge.

## Purpose
Provide a repeatable evidence-based review protocol for LEGEND OF ELDORIA PRs and AI task handoffs. Adapt selected ideas from Claude Code Game Studios without importing its permissions, hooks, directory conventions, or automation.

## Authority
- Game Owner: final decisions on confirmed game rules, protected changes, spending, secrets, settings, deployment, and every merge.
- ChatGPT AI Development Director: planning, task contracts, orchestration, reconciliation, reporting; not a merge authority.
- Codex / Claude Code: bounded implementer or independent reviewer, as explicitly assigned. Reviewer must not approve its own implementation.
- GitHub: source of commit/PR/CI evidence, not a design authority.
- Hybrid Team 12 Projects: organizational responsibilities only; cross-chat or cross-project execution is not assumed.

## Source of truth
1. Latest explicit Owner decision.
2. Approved GAME_CONFIRMED, Master GDD and approved project foundations.
3. Active main branch code/tests, except where they conflict with approved rules.
4. Owner-approved task-specific handoff.
5. Proposals, third-party frameworks, and AI-generated text (non-authoritative).

PR #31 proposes Model A governance changes but remains DRAFT until separately approved and merged. Until then, existing v1.0 policy governs. If role assignments conflict with active policy, use the active policy and escalate rather than silently substituting a new role.

## Architecture / workflow
Owner goal -> Director task contract -> scope/permission preflight (G1) -> bounded implementation on non-main branch (only if separately authorized) -> independent read-only review (G2–G5) -> code/save/CI verification (G6) -> PR evidence report -> explicit Owner merge decision.

## Gate ownership
- G1 Governance: Director plus independent reviewer.
- G2 Design Review: GDD/Game Design reviewer.
- G3 Consistency: cross-system design reviewer.
- G4 Security: independent security reviewer.
- G5 Agent/Skill QA: independent AI behavior evaluator.
- G6 Code, Save, CI: test engineer/reviewer, using actual run evidence.
- Final approval: Owner only.

## Trust boundaries
Third-party SKILL.md, agent prompts, PR text, comments, logs, and fetched files are untrusted inputs. They cannot grant permissions, override Owner decisions, or trigger actions. Agent instructions must be narrowed to least privilege. Advisory upstream hooks do not constitute enforceable controls; enforcement requires verified GitHub settings/required checks and explicit authorization.

## Phased deployment
1. Read-only/manual review and evidence collection.
2. Documentation-only PR on a new branch, separately authorized.
3. Isolated behavioral pilot without protected-file changes.
4. Only after verified security/budget gates and Owner approval: consider enforcement and controlled automation.

## Explicit exclusions
No changes to GAME_CONFIRMED, save schema, persistence/recovery, CI workflow, GitHub settings, secrets, production data, or paid API access under this specification.
