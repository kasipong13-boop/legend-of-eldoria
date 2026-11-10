# LEGEND OF ELDORIA — Master Project Control Index v1.0

**Status:** DRAFT — repository control index, awaiting Game Owner review  
**Prepared under:** GOVERNANCE_FRAMEWORK_v1.0 (APPROVED)  
**Prepared:** 9 November 2026  
**Repository:** `kasipong13-boop/legend-of-eldoria`  
**Integrated branch:** `main`  
**Verified main commit at preparation:** `021fbd508716567f56fb034a543e36f9b85f64b5`

> This index is a navigation, registry and reporting layer. It does not replace, rewrite, or approve MASTER GDD, GAME_CONFIRMED, source documents, existing project records, or active Pull Requests. Unknown or inaccessible records are explicitly marked; no missing source document is recreated from assumptions.

## 1. Executive dashboard

### 1.1 Verified repository baseline

| Dimension | Verified status | Evidence |
|---|---|---|
| Integrated game baseline | Prototype 0.2.3 on `main` | `README.md` |
| Technology | Static HTML/CSS/JavaScript browser game; mobile and desktop | `README.md`, `CLAUDE.md` |
| Isometric ground grid | 64×32 logical ground tile | `CLAUDE.md`, Art Direction v1.1 |
| Save storage | Browser localStorage, scoped to browser/device; no cross-device sync | `README.md`, `CLAUDE.md` |
| Verification suite | Node.js 20+ scripts under `verification/` | `README.md`, `CLAUDE.md` |
| Governance | v1.0 approved and merged | `docs/GOVERNANCE_FRAMEWORK_v1.0.md` |
| AI collaboration | Collaboration, autonomy and review standards present | `docs/AI_COLLABORATION_PROTOCOL.md`, `docs/AI_AUTONOMY_POLICY.md`, `docs/AI_CODE_REVIEW_STANDARD.md` |
| Art direction | Art Direction & Asset Pipeline v1.1 present | `docs/ART_DIRECTION_AND_ASSET_PIPELINE_v1.1.md` |
| Production readiness | Not established; prototype is not production-ready by default | Governance v1.0 §11 |

### 1.2 Current project health

| Area | Status | Director assessment |
|---|---|---|
| Governance Framework | APPROVED / MERGED | Recorded in repository |
| Master documentation control | PARTIAL | This index provides navigation; authoritative GDD/control artifacts not found at expected repository paths |
| Prototype baseline | DOCUMENTED | README identifies 0.2.3 on main |
| Character / Save foundation | OPEN — DRAFT PR #1 | GitHub reported mergeable=false; requires conflict and CI review |
| Battle foundation | OPEN — DRAFT PR #16 | PR description says browser/CI validation not yet run |
| Card Collection foundation | OPEN — DRAFT PR #20 | Draft; requires CI checks before review/merge |
| Prototype 0.3 expanded Greenvale | NEEDS RECONCILIATION | Work log mentions a PR in review, but currently listed open PRs do not clearly identify it |
| Backup infrastructure | POLICY APPROVED / NOT VERIFIED AS CONFIGURED | Providers, schedules, immutable storage and restore evidence not established |
| Production deployment readiness | NOT ASSESSED / NOT READY | No claim of production readiness is made |

No numeric completion percentage is assigned because the project registry and complete phase plan are not yet verified.

## 2. Master document registry

The registry distinguishes verified repository files from authoritative records not located during this inspection.

| Artifact | Expected role | Verified location | Status |
|---|---|---|---|
| Governance Framework | Project-wide governance | `docs/GOVERNANCE_FRAMEWORK_v1.0.md` | ACTIVE / APPROVED |
| MASTER GDD | Central game-design source of truth | Not located at repository root or current `docs/` listing | LOCATION UNVERIFIED |
| GAME_CONFIRMED | Approved gameplay rules | Not located at repository root or current `docs/` listing | LOCATION UNVERIFIED |
| PROJECT REGISTRY | Project/workstream registry | Not located at repository root or current `docs/` listing | LOCATION UNVERIFIED |
| TASK & HANDOFF | Task and AI handoff register | Not located at repository root or current `docs/` listing | LOCATION UNVERIFIED |
| CHANGE LOG | Central decision/change history | `CHANGELOG_TH.md` exists, but is a prototype change log; not proven to be the full governance decision registry | PARTIAL / SCOPE TO VERIFY |
| Work Log | Chronological implementation record | `WORK_LOG_TH.md` | ACTIVE |
| README | Repository baseline and run instructions | `README.md` | ACTIVE |
| Claude instructions | Implementation constraints | `CLAUDE.md` | ACTIVE |
| AI Collaboration Protocol | Agent roles and handoff lifecycle | `docs/AI_COLLABORATION_PROTOCOL.md` | ACTIVE |
| AI Autonomy Policy | Bounded AI implementation authority | `docs/AI_AUTONOMY_POLICY.md` | ACTIVE |
| AI Code Review Standard | Review and QA requirements | `docs/AI_CODE_REVIEW_STANDARD.md` | ACTIVE |
| GitHub Development Standard | Branch, PR, CI and deployment rules | `docs/GITHUB_DEVELOPMENT_STANDARD.md` | ACTIVE |
| Art Direction & Asset Pipeline | Visual identity and asset workflow | `docs/ART_DIRECTION_AND_ASSET_PIPELINE_v1.1.md` | ACTIVE DOCUMENT PRESENT |
| Whispering Forest Map Design | Map design reference | `docs/WHISPERING_FOREST_MAP_DESIGN.md` | DOCUMENT PRESENT |
| Map Data / Monster Spawn | Map/spawn reference | `docs/MAP_DATA_MONSTER_SPAWN.md` | DOCUMENT PRESENT |

**Important:** “Not located” means not found in the inspected repository root and `docs/` directory. It does not mean the Game Owner never created the artifact; it may exist in a separate ChatGPT Project workspace, Library location or another path. Do not create a substitute and label it the original.

## 3. Active Pull Request registry

Point-in-time GitHub snapshot during this preparation. Re-check GitHub before action.

| PR | Title | Branch relationship | State | Review notes |
|---:|---|---|---|---|
| #1 | Prototype 0.2: Character creation and transactional save foundation | `feature/prototype-0.2-character-save` → `main` | OPEN / DRAFT | GitHub reported mergeable=false. PR body says manual gameplay checks remain. Do not merge before conflict and current CI review. |
| #16 | Battle System Foundation: confirmed rules and HP continuity fixes | `feature/battle-system-foundation` → `feature/prototype-0.2-character-save` | OPEN / DRAFT | PR body says browser/CI validation not yet run. Depends on PR #1 branch. |
| #20 | Card Collection Foundation: isolated read-only archive and additive deck saves | `feature/card-collection-foundation` → `feature/prototype-0.2-character-save` | OPEN / DRAFT | PR body requires CI checks. Depends on PR #1 base branch. |

### PR handling rules

- Keep all three PRs open and isolated unless explicitly assigned.
- Do not merge, close, retarget, overwrite or combine them as part of documentation-control work.
- Inspect branch ancestry, changed files, current head SHA, CI checks and save compatibility before review.
- Resolve PR #1 mergeability before planning downstream integration.
- Review PR #16 and #20 against the latest approved base and each other for overlapping files and dependency assumptions.
- Game Owner retains final merge authority.

### Work-log discrepancy

`WORK_LOG_TH.md` describes “Prototype 0.3 — Expanded Greenvale Capital (PR in review)”. The open PR snapshot lists #1, #16 and #20, with no clearly matching Greenvale PR. Treat the work-log note as historical or unverified until its exact PR/branch is identified. Do not infer Prototype 0.3 is merged or active on `main`.

## 4. Workstream and task register

This is a control-level view, not a replacement for a detailed implementation backlog.

| ID | Workstream | Evidence | Status | Next control action |
|---|---|---|---|---|
| GOV-01 | Governance Framework v1.0 | Merged in main commit `021fbd5` | COMPLETE | Maintain by approved change proposal only |
| CTRL-01 | Master Project Control integration | This index | DRAFT / PR review | Owner review and merge |
| DOC-01 | Locate authoritative Master Project artifacts | Key files not located in inspected root/docs | BLOCKED BY LOCATION | Identify authoritative workspace/path; link, do not recreate blindly |
| SAVE-01 | Character and transactional save foundation | PR #1 | OPEN / DRAFT | Resolve mergeability, inspect diff/CI, preserve existing saves |
| BATTLE-01 | Battle foundation / HP continuity | PR #16 | OPEN / DRAFT | Validate tests and dependency against PR #1 |
| CARD-01 | Card Collection foundation | PR #20 | OPEN / DRAFT | Validate CI, additive save compatibility and dependency |
| WORLD-03 | Expanded Greenvale / Prototype 0.3 | Work-log reference only | NEEDS RECONCILIATION | Identify exact PR/branch and verify current code |
| ART-01 | Art Direction & Asset Pipeline v1.1 | Document in `docs/` | DOCUMENT PRESENT | Keep asset integration behind art/QA gates |
| DR-01 | Backup and disaster recovery implementation | Policy approved; setup not evidenced | NOT CONFIGURED / UNVERIFIED | Define provider, RPO, schedule, key custody and restore-drill plan |

Task status definitions:
- **COMPLETE:** Evidence shows the task is completed and integrated.
- **OPEN / DRAFT:** Work exists but is not merged/approved as integrated.
- **BLOCKED BY LOCATION:** Authoritative source or dependency cannot be verified.
- **NEEDS RECONCILIATION:** Project records disagree or are stale.
- **NOT CONFIGURED / UNVERIFIED:** Policy exists but implementation evidence is absent.

## 5. Decision and approval index

| Decision ID | Decision | Authority / status | Scope boundary |
|---|---|---|---|
| GOV-DEC-001 | Governance Framework v1.0 approved | Game Owner / APPROVED | Governance only; no game rules changed |
| GOV-DEC-002 | Multi-Location Backup (A) | Game Owner / APPROVED POLICY | Providers and account setup unverified |
| GOV-DEC-003 | Maximum Backup Security (C) | Game Owner / APPROVED POLICY | Encryption, MFA and immutable configuration unverified |
| GOV-DEC-004 | Disaster Recovery Target 8–12 hours (B) | Game Owner / APPROVED TARGET | RPO and demonstrated recovery performance undefined/unverified |
| GOV-DEC-005 | Recovery Verification (C) | Game Owner / APPROVED POLICY | Automation and restore-drill evidence unverified |
| GOV-DEC-006 | Asset Management (C) | Game Owner / APPROVED POLICY | Registry implementation unverified |
| GOV-DEC-007 | Build & Release Management (C) | Game Owner / APPROVED POLICY | Pipeline and release gates unverified |
| GOV-DEC-008 | Deployment Protection (C) | Game Owner / APPROVED POLICY | Staging, monitoring and rollback configuration unverified |
| GOV-DEC-009 | Documentation Access (B) | Game Owner / APPROVED POLICY | Actual workspace permissions unverified |
| GOV-DEC-010 | Decision & Approval Tracking (C) | Game Owner / APPROVED POLICY | This is an initial index, not an automated system |
| GOV-DEC-011 | AI Agent Coordination (C) | Game Owner / APPROVED POLICY | Agent integrations/permissions remain bounded by connected tools |
| GOV-DEC-012 | Production Ready completion criteria (C) | Game Owner / APPROVED CRITERIA | Does not assert game is production ready |
| GOV-DEC-013 | Governance Finalization (C) | Game Owner / APPROVED | Governance v1.0 recorded |
| GOV-DEC-014 | Long-Term Backup Retention (A) | Game Owner / APPROVED POLICY | Daily 7 days; weekly 8 weeks; monthly 12 months; important releases permanent |

These IDs index already-approved governance choices. They do not add or modify gameplay rules. If a central decision register exists elsewhere, reconcile and link these IDs without overwriting its history.

## 6. Risk and dependency register

| Risk ID | Risk | Severity | Current handling |
|---|---|---|---|
| R-CTRL-01 | Authoritative MASTER GDD / GAME_CONFIRMED / Project Registry / Task Handoff locations not verified in this repository | HIGH | Do not recreate or infer source rules; locate and link authoritative records |
| R-SAVE-01 | PR #1 mergeability false at inspection; save foundation is high-risk | HIGH | No merge until conflict, tests, compatibility and recovery review are resolved |
| R-DEP-01 | PR #16 and #20 depend on PR #1 branch | HIGH | Preserve branch topology; review dependency and changed-file overlap |
| R-WORLD-01 | Work log references Prototype 0.3 PR not identified in open PR snapshot | MEDIUM | Reconcile exact PR/branch before roadmap update |
| R-DR-01 | Approved backup policy has no verified provider/configuration/restore evidence | HIGH | Do not claim backup/recovery operational until evidenced |
| R-DOC-01 | Prototype changelog and governance decision history may be separate records | MEDIUM | Preserve `CHANGELOG_TH.md`; identify central Change Log before consolidation |

## 7. Immediate next priorities

1. **Locate authoritative project documents:** Identify existing MASTER GDD, GAME_CONFIRMED, PROJECT REGISTRY and TASK & HANDOFF in the Game Owner's authoritative workspace. Add links and provenance; do not replace originals.
2. **Reconcile PR topology:** Resolve PR #1 mergeability and determine integration sequence for #16 and #20.
3. **Reconcile Prototype 0.3:** Identify the referenced Greenvale PR/branch and verify whether it is active, superseded or integrated elsewhere.
4. **Establish a central change/decision registry:** Link Owner approvals, design changes, tasks and PRs without rewriting the prototype changelog.
5. **Operationalize backup policy:** Only after provider/account decisions and explicit setup are available; record configuration and restore evidence.

## 8. Operating rules

- Update this dashboard only from verified repository/project evidence.
- Record date and commit/PR snapshot for each status refresh.
- Do not infer approval from a draft, selected discussion option, AI recommendation or PR creation.
- Do not mark PRs merged without GitHub confirmation.
- Do not mark backup, restore, staging, monitoring or production controls implemented without evidence.
- Preserve all historical records and source documents.
- Any change to GAME_CONFIRMED or Governance v1.0 follows explicit Owner approval/change proposal.
- Game Owner retains final authority for merge, release and high-risk decisions.

**Prepared by:** ChatGPT — AI Development Director  
**Review state:** Awaiting Game Owner review and merge decision.
