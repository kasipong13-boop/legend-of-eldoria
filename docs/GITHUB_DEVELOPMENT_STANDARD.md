# LEGEND OF ELDORIA — GitHub Development Standard v1.0

## Branch model
- `main`: integrated, deployable source of truth.
- `feature/<name>`: new gameplay or content work.
- `fix/<name>`: defect fixes.
- `docs/<name>`: documentation-only changes.
- `chore/<name>`: tooling and collaboration infrastructure.
- `qa/<name>`: test-only work.

Start every branch from the latest appropriate base. Never assume a branch is current; compare it with `main` before opening a PR.

## Pull Request policy
All code and project-document changes enter `main` through a PR. AI agents may prepare branches and PRs but may not merge them. The Game Owner makes the final merge decision.

PR template checklist:
- [ ] Task ID and objective
- [ ] Scope and non-goals
- [ ] Confirmed rules preserved
- [ ] Files changed and reason
- [ ] Tests run with exact command and result
- [ ] Tests skipped and reason
- [ ] Save schema/data compatibility statement
- [ ] Mobile/desktop impact
- [ ] Security and asset-license review (if applicable)
- [ ] Rollback plan
- [ ] Documentation / changelog updated where appropriate

## Commit policy
Use short, descriptive imperative messages, for example:
- `feat: add forest monster encounter`
- `fix: preserve player hp after battle`
- `test: cover save recovery edge case`
- `docs: define AI collaboration protocol`

Keep commits focused. Do not include credentials, local files, build caches, unrelated assets, or user save data.

## CI policy
- Keep required validation read-only and deterministic where possible.
- Use Node.js 20+ as defined by the current project.
- Run focused tests first and the full relevant suite before PR completion.
- A failed required check blocks merge until fixed or explicitly dispositioned by the owner.
- Do not treat skipped tests as passed.
- AI workflows must use minimal permissions and explicit inputs; avoid automatic write/merge/deploy privileges.

## Deployment
GitHub Pages deployment is a release concern. Do not alter deployment settings or deploy workflow as part of unrelated development. Verify the deployed build after a release and keep the last known good main commit available for rollback.

## Current repository note
The repository is currently public. Source and committed assets are publicly readable. API keys must only be stored as GitHub Actions Secrets and must never be committed. Repository visibility changes are a separate Game Owner decision.
