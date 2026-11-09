# LEGEND OF ELDORIA — Governance Framework v1.0

**Status:** APPROVED by Game Owner  
**Approval date:** 9 November 2026  
**Document class:** Project Governance / Operating Standard  
**Owner:** Game Owner  
**Director:** ChatGPT — AI Development Director & Lead Game Designer  
**Implementation Engineer:** Claude — Autonomous Implementation Engineer  
**Source control:** GitHub repository `kasipong13-boop/legend-of-eldoria`, branch `main`  
**Version note:** This document records approved governance decisions. It does not amend GAME_CONFIRMED, Game Core Identity, or gameplay specifications.

---

## 1. Purpose and scope

This framework defines decision authority, design governance, development workflow, verification, documentation control, AI coordination, project security, backup and recovery, release governance, and project completion criteria for LEGEND OF ELDORIA.

It applies to project documents, source code, assets, tests, builds, release artifacts, and player-save protection.

Governance approval authorizes the operating framework. It does not automatically authorize a new gameplay feature, balance change, save migration, deployment, purchase, paid service, repository-permission change, or any other separately gated operation.

## 2. Authority and responsibility

| Role | Responsibilities | Authority boundary |
|---|---|---|
| Game Owner | Product direction, priorities, approval of new/changed game rules, high-risk decisions, final PR merge and release decisions | Final decision authority |
| ChatGPT — AI Development Director / Lead Game Designer | Master planning, system design, dependency analysis, design quality review, task packets, handoffs, cross-system conflict review, PR/code review, QA coordination, reporting and change-log oversight | May propose, design, coordinate and review; cannot silently change approved rules or merge |
| Claude — Autonomous Implementation Engineer | Repository inspection, technical planning, implementation of assigned tasks, focused tests, defect correction and PR preparation | May make bounded technical decisions inside an approved task; cannot change game design or merge |
| GitHub | Source history, branches, PRs, issues, CI evidence and release traceability | Source-control platform; not a game-design authority |
| GitHub Actions / other AI agents | Execute explicitly configured, least-privilege workflows | No implicit product, merge, deployment, permission or spending authority |

### 2.1 Owner decision gates

Explicit Game Owner approval is required for:
- New game rules, changes to GAME_CONFIRMED, Game Core Identity, balance, progression, card/monster/job rules or approved art direction.
- Save schema changes, data migrations, destructive recovery, deletion or reset of player data.
- High-risk changes to protected files or persistence/recovery/transaction logic.
- Repository visibility/permissions, secrets, paid services, API budgets or model access.
- Production deployment/release operations and exceptional recovery of production data.
- Scope expansion beyond the approved project objective.

### 2.2 Claude autonomy

Claude may independently decide technical implementation details such as code organization, local refactoring that preserves behavior, bug-fix approach, performance improvements and test structure, provided they remain within the assigned scope and do not cross a high-risk gate.

If a specification is ambiguous, internally inconsistent or technically infeasible, Claude must stop the affected scope and raise a Technical Proposal. It must not invent a gameplay rule to unblock implementation.

## 3. Game design governance

### 3.1 Design workflow

`IDENTIFY NEED → DESIGN DRAFT → DESIGNER SELF-REVIEW → OWNER REVIEW → EXPLICIT APPROVAL → CONFIRMED SPECIFICATION → DEVELOPMENT PRIORITIZATION`

The Lead Game Designer is responsible for designing in-scope systems as complete, production-ready packages, including:
- Rules, values, formulas, triggers, conditions and state transitions.
- Examples, edge cases, failure cases and exploit considerations.
- Dependencies, integration contracts and temporary assumptions.
- Balance rationale and expected player impact.
- Implementation requirements and observable acceptance criteria.
- Test scenarios and unresolved risks.

Design work follows dependency-first ordering. Unblocked work may continue while dependencies are unresolved, but assumptions must be explicitly identified and cannot become confirmed rules automatically.

### 3.2 Design statuses

| Status | Meaning |
|---|---|
| `GAME_CONFIRMED` | Explicitly approved game rule; authoritative |
| `DESIGN_DRAFT` | Complete or partial design awaiting Owner approval |
| `UNDER_DISCUSSION` | Active discussion; not an implementation requirement |
| `PENDING_DESIGN` | Not yet designed |

A proposal, selected discussion option, AI recommendation, or document version increment is not approval. Only an explicit Owner decision changes an item to `GAME_CONFIRMED`.

### 3.3 Design quality and readiness

Before Owner review, the Director performs a self-review for completeness, consistency, balance logic, dependencies, edge cases and testability.

Readiness is reported by dimension, not hidden behind one score:
1. Design Completeness
2. System Integration
3. Balance Readiness
4. Technical Feasibility
5. Testability

A system described on paper is not thereby mathematically simulated, prototyped, integrated or tested.

### 3.4 Change proposals and conflict resolution

Any change to `GAME_CONFIRMED`, including a numerical adjustment, requires a Change Proposal containing:
- Current rule and proposed replacement.
- Reason and expected player/game impact.
- Dependencies and affected documents/systems.
- Compatibility, save and regression impact.
- Alternatives, risks and verification plan.

The Director maintains a central cross-system conflict review. Conflicts are mapped across affected systems and resolved through Owner decisions. No AI may unilaterally reinterpret a confirmed rule.

### 3.5 Future systems

Future/expansion systems may have concepts, boundaries and interfaces documented. They do not expand the initial development scope and must not be implemented until separately authorized.

## 4. Development workflow and source control

### 4.1 Standard lifecycle

`OWNER GOAL → DIRECTOR BACKLOG / TASK PACKET → CLAUDE IMPLEMENTATION ON TASK BRANCH → PULL REQUEST → DIRECTOR REVIEW → CI / QA → OWNER MERGE DECISION`

- `main` is the integrated source of truth.
- All code and project-document changes enter `main` through a Pull Request.
- Never commit directly to `main`.
- AI agents do not merge PRs.
- Keep unrelated tasks and existing PRs isolated.
- Use one bounded task or tightly coupled change per PR.
- Start from the latest appropriate base and verify branch ancestry before PR submission.

### 4.2 Required task packet

Every implementation handoff must identify:
- Task ID and objective.
- Source documents and current verified baseline.
- Confirmed rules/invariants to preserve.
- Scope, explicit non-goals and expected files (uncertain paths marked as hypotheses).
- Dependencies, assumptions and blockers.
- Acceptance criteria and required tests.
- Risk classification and approval gates.
- Save/schema compatibility and rollback plan.

### 4.3 Code review

The Director reviews the complete diff against the task packet, approved specifications, tests, save compatibility, security, performance, mobile/desktop behavior and unrelated changes.

Review outcomes:
- **APPROVE:** No blocking issue found in reviewed scope; Owner may decide to merge.
- **REQUEST CHANGES:** Correctable issues remain.
- **BLOCK:** Scope, evidence, safety, confirmed-rule conflict or data-integrity concern makes the change unsafe.

Director approval is advisory. The Game Owner retains final merge authority.

## 5. Validation, testing and issue management

### 5.1 Four validation levels

1. **Design Validation:** Completeness, consistency, dependencies, rules and edge cases.
2. **Mathematical Simulation:** Quantitative behavior, balance ranges, probabilities and stress cases.
3. **Prototype Testing:** Actual implementation behavior in an executable prototype.
4. **Integration Testing:** Cross-system behavior, saves, UI, maps, combat, devices and release environment.

Reports must distinguish analysis, simulation, automated tests, browser tests, emulation and physical-device tests. Never claim a test passed unless it was executed and its output inspected.

### 5.2 Test evidence

Use the current repository scripts and documented environments; do not rely on remembered command names or counts. Report exact commands, results, environment, skipped checks and limitations. A skipped test is not a pass. Viewport emulation is not equivalent to physical iOS Safari testing.

### 5.3 Central issue register

Every tracked defect/risk should include:
- Issue ID, affected system and severity.
- Description and reproducible evidence.
- Root cause (or explicitly unknown).
- Impact, proposed correction and owner.
- Status and verification evidence.

Severity:
- **Critical / P0:** Data loss, credential leak, destructive deployment or unrecoverable save corruption.
- **High / P1:** Confirmed rule broken, major progression/combat defect, severe exploit or blocker.
- **Medium / P2:** Incorrect feature behavior, important edge case or material UX regression.
- **Low / P3:** Minor polish or non-blocking maintainability/documentation issue.

An issue is not closed merely because code changed; verification evidence is required.

## 6. Documentation and decision control

### 6.1 Central source of truth

The MASTER GDD is the central game-design source of truth. Supporting documents should link to it and own only their relevant detail; avoid duplicate competing copies of the same rule.

Project control artifacts include:
- MASTER GDD
- PROJECT REGISTRY
- TASK & HANDOFF
- CHANGE LOG
- GAME_CONFIRMED
- System-specific design documents
- Governance Framework and operational policies

The Director must preserve existing project artifacts and history. Where the central Project 01 / Master Project workspace or other project documents are not directly accessible, record the limitation and use explicit handoffs; never claim automatic cross-project synchronization without evidence.

### 6.2 Version and archive control

- Use centralized version control for MASTER GDD and supporting documents.
- A version increment does not imply approval.
- DRAFT edits cannot alter GAME_CONFIRMED automatically.
- Historical documents remain preserved and are labelled `ACTIVE`, `SUPERSEDED` or `ARCHIVED`.
- Superseded/archived material is historical reference, not an implementation requirement unless explicitly reinstated by the Owner.

### 6.3 Decision Registry

Every material decision should have a unique Decision ID, date, decision owner, scope, rationale, affected systems/documents, status and evidence of approval. Link decisions to relevant tasks, PRs, specifications and change records.

Documentation access follows role-based permissions: Owner, Director and Implementation Engineer receive only the access needed for their responsibilities. More restrictive document-level controls may be applied where required.

## 7. AI agent coordination

The Director coordinates AI work through bounded task packets, explicit handoffs and a shared record of status, dependencies, decisions and conflicts.

- ChatGPT is the central planning, design, review and coordination role.
- Claude is the implementation engineer and works only on assigned scope.
- Additional AI agents may be introduced with named responsibilities, least-privilege access and explicit handoff contracts.
- AI agents must not issue conflicting instructions or silently overwrite another agent's work.
- Existing open PRs remain isolated unless explicitly assigned.
- Technical blockers are escalated as Technical Proposals; game-design decisions return to the Owner.
- No AI agent may merge, deploy, change permissions, expose secrets or incur unapproved spending.

Use task IDs and handoff records to make work traceable. Do not claim continuous background work or cross-project access unless the relevant action and evidence exist.

## 8. Backup, security and disaster recovery

### 8.1 Approved backup policy

**Storage model — Option A: Multi-Location Backup**
- Maintain a primary cloud backup location and a separately isolated secondary backup location.
- The two locations must not share a single failure or deletion boundary where reasonably avoidable.
- Exact providers, account ownership, access configuration and costs are operational setup items to be documented before activation.

**Retention — Option A: Long-Term Retention**
- Daily backups: retain 7 days.
- Weekly backups: retain 8 weeks.
- Monthly backups: retain 12 months.
- Important releases: retain permanently.
- Important releases must be identified and tagged; retention tiers must not delete permanent release archives.

**Backup security — Option C: Maximum**
- Encrypt backup data in transit and at rest.
- Require multi-factor authentication for privileged access.
- Separate backup credentials/accounts from ordinary development access.
- Use immutable or write-protected retention for designated critical backups where supported.
- Never place credentials, tokens or encryption secrets in source code, issue bodies, PRs, logs or artifacts.

**Recovery verification — Option C**
- Automate integrity checks where practical.
- Perform scheduled full restore drills in an isolated environment.
- Record backup identifier, timestamp, source version, integrity result, restore result and any exceptions.
- A backup that has not been successfully restored is not proven recoverable.

### 8.2 Disaster recovery target

The approved target is **8–12 hours for service/project recovery (DR target)**. This is a target, not a claim of current capability. RPO (maximum acceptable data loss window), exact recovery tiers, provider-specific procedures and drill cadence remain operational parameters to be defined and verified before being represented as achieved.

### 8.3 Three-environment model

- **Production:** Approved source, release artifacts and important player data; no experiments.
- **Development:** Isolated implementation and integration work.
- **Testing:** Test saves and simulated data only; never use real player saves for destructive tests.

### 8.4 Save protection

- Back up before risky save-related changes and migrations.
- Version the save schema and check compatibility.
- Preserve readable existing saves; do not test on or overwrite real user saves.
- Require an approved migration plan, compatibility tests and rollback/recovery plan before schema changes.
- Include integrity checks and recovery tests.
- Stop on suspected corruption or unsafe recovery; escalate to the Owner.
- Preserve the original Prototype 0.1 baseline and all historical save/recovery evidence.

### 8.5 Recovery procedure

1. Halt risky writes, deployments or changes.
2. Assess affected systems and identify the last verified backup.
3. Restore only in an isolated recovery environment.
4. Verify source, assets, documentation, save data and build integrity as applicable.
5. Run the relevant regression and recovery checks.
6. Report the evidence, data-loss window, remaining risks and rollback.
7. Obtain Owner approval before restoring or replacing Production.

Restore drills are required. Untested backups must not be described as verified.

## 9. Asset management

Use a central Asset Registry for source, provenance, license/usage rights, version, intended use, dependencies, format, dimensions, owner and status. Track whether an asset is proposed, approved, integrated, deprecated or archived.

Do not assume that an uploaded or publicly visible asset is licensed for redistribution. Record attribution and license restrictions. Preserve source assets and transformation history; avoid overwriting originals.

## 10. Build, release and deployment

### 10.1 Build & Release Management — Option C

A release candidate must have:
- Version identifier and source commit.
- Reproducible build/package record where applicable.
- QA/test evidence and known limitations.
- Release notes and changed-file inventory.
- Asset/license review where applicable.
- Save compatibility statement.
- Rollback target and instructions.
- Owner release approval.

### 10.2 Deployment Protection — Option C

Use an approval gate, staging verification, smoke tests, rollback readiness and post-deployment monitoring. Production deployment is a release operation and must not be inferred from a successful PR or CI run. AI agents do not independently authorize production deployment.

Keep the last known-good approved release available for rollback. Do not alter deployment configuration or workflows as part of unrelated tasks.

## 11. Project completion criteria — Production Ready

The project's production-readiness assessment must cover:
- Approved feature scope and documented exclusions.
- Design and system integration readiness.
- Functional QA, regression and defect disposition.
- Performance and compatibility across target devices/browsers.
- Security, privacy and asset-license review.
- Save integrity, backup and demonstrated recovery.
- Build reproducibility, release documentation and rollback.
- Operational ownership, monitoring and support readiness.
- Explicit Game Owner approval.

Completion is reported by evidence and dimension. Feature completion alone does not mean Production Ready. Prototype, beta, release candidate and production statuses must remain distinct.

## 12. Priority, progress and reporting

Prioritize work by:
1. Game impact.
2. Dependency/blocking effect.
3. Necessity for the approved phase.

Maintain an executive dashboard with:
- Design Progress.
- System Readiness by dimension.
- Dependency Overview.
- Issues and Risks.
- Owner Decisions Needed.
- Upcoming Priorities.

Report at milestones, when an Owner decision is required, when a milestone is blocked, when a major conflict/risk appears, and at phase completion. Progress figures must be evidence-based; do not invent percentages or imply background work.

## 13. Design completion gate

A system is considered design-complete only when all applicable criteria are satisfied:
1. Design Coverage.
2. Production-Ready Specification.
3. System Integration.
4. Dependency Resolution or explicitly accepted documented assumptions.
5. Design Quality Review.
6. Owner Decision.

Design Complete does not mean prototype-tested, integrated-tested or production-ready.

## 14. Governance maintenance and amendment

This framework is **GOVERNANCE v1.0 — APPROVED** as of 9 November 2026.

Any amendment must be recorded as a Governance Change Proposal with:
- Current clause and proposed change.
- Rationale and project impact.
- Affected roles, workflows, documents and tools.
- Risks, transition plan and effective version.
- Explicit Game Owner approval.

Do not silently alter this framework. Preserve prior versions and decision history. A new version does not retroactively approve unapproved game-design proposals.

---

## Appendix A — Approved questionnaire decisions

| # | Governance topic | Approved selection |
|---:|---|---|
| 1 | Backup Storage Location | A — Multi-Location Backup |
| 2 | Backup Security | C — Maximum |
| 3 | Disaster Recovery Target | B — 8–12 hours |
| 4 | Recovery Verification | C — Automated integrity checks + full restore drills |
| 5 | Asset Management | C — Registry, version, license, dependencies and usage status |
| 6 | Build & Release Management | C — Versioning, build pipeline, QA evidence, release notes and rollback |
| 7 | Deployment Protection | C — Approval gate, staging, smoke test, rollback and monitoring |
| 8 | Documentation Access | B — Role-based access |
| 9 | Decision & Approval Tracking | C — Decision Registry linked to documents, tasks, PRs and GAME_CONFIRMED |
| 10 | AI Agent Coordination | C — Multi-Agent Governance |
| 11 | Project Completion Criteria | C — Production Ready |
| 12 | Governance Finalization | C — Conflict audit and Governance v1.0 approval |
| 13 | Backup Retention | A — Daily 7 days, weekly 8 weeks, monthly 12 months, important releases permanent |

## Appendix B — Operational parameters not yet evidenced as configured

The following are approved policy intentions or targets, but must not be reported as implemented until verified:
- Cloud backup providers, accounts, storage locations and credentials.
- Encryption/key custody, MFA and immutable-retention configuration.
- Backup schedules and automated integrity-check jobs.
- Full restore-drill schedule and successful drill evidence.
- RPO and service-specific recovery priorities.
- Asset Registry location and required metadata automation.
- Build/release pipeline and staging environment configuration.
- Monitoring and operational response procedures.
- Role permissions across each project workspace and connected service.

## Appendix C — Project invariants

This governance document does not change:
- GAME_CONFIRMED or Game Core Identity.
- Existing approved combat, card, monster, job, progression or art-direction rules.
- Existing Prototype 0.1 regression baseline and prototype history.
- Existing player saves or save schema.
- Current project phase gates or separately approved task scopes.

Where this framework and an explicit latest Game Owner decision conflict, the latest explicit Owner decision governs; record the resolution through the appropriate change/decision record.
