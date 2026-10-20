# SkillUp — exclusive file ownership and session boundaries

Baseline: `98c4384`, branch `chore/simplify-journey-page`, worktree `planning`; 2026-10-20 (Asia/Calcutta).

This map assigns **edit ownership**, not read restrictions. It describes proposed future sessions; this audit did not start any. It does not authorize application changes, commits, branch switches, another worktree, real-data migration, deployment or policy approval. Sessions read current Git state/instructions first and preserve unrelated changes.

Only the three files in `docs/quality/` were authored in this audit. Existing `docs/audit/`, `docs/architecture/`, phase/progress documents and screenshots are historical/reference material; no session may overwrite another session's progress document as its own status report.

## Ownership resolution

- One writer per file for the duration of a batch. A directory allocation below applies only to its explicitly listed entries or explicit remainder; exclusions are part of the boundary.
- No catch-all ownership of `backend/app/`, `mobile/src/` or `docs/`. An unlisted file is **unassigned**: inspect and request a boundary decision before editing it.
- A change requiring another owner's file is a dependency, not permission. Send/record a concrete interface proposal (method/path, fields, semantics, errors, concurrency/consent rules, tests), freeze it, then let that owner implement it sequentially.
- Tests and release scripts are separate edit domains. Implementation owners supply expected behavior and may run/read tests, but do not race T/R in their files.
- A conceptual cross-domain file remains one physical file. Until a separately reviewed extraction, sections/functions are not independent parallel ownership.
- Suggested new files are explicitly marked **proposed**; their existence must not be claimed before creation. Scope transfers require a recorded handoff and clean agreement on the outstanding diff.

## D — design system and accessibility primitives

Exclusive existing paths:

- `mobile/src/constants/` (all existing token/theme/CSS files).
- `mobile/src/global.css`, `mobile/src/hooks/` (existing theme/color hooks).
- `mobile/src/components/career-ui.tsx`, `workspace-controls.tsx`, `analytics.tsx`.
- `mobile/src/components/themed-text.tsx`, `themed-view.tsx`, `hint-row.tsx`, `web-badge.tsx`, `external-link.tsx`, `animated-icon.tsx`, `animated-icon.web.tsx`, `animated-icon.module.css`, `ui/collapsible.tsx`.

Owns visual tokens, primitive accessibility/interaction semantics and audited legacy presentation reachability. Read `mobile/design-reference/` and `mobile/assets/` as references; neither is assigned for mutation by this plan. No rebranding or asset deletion implied.

**Cannot edit:** route screens, API/client/contracts, domain widgets, manifests or tests. `workspace-controls.tsx` also contains file picking/confirmation behavior: changing those interfaces must be agreed with F/S, then implemented only by D. Public primitive signatures freeze before F adopts them. Business-containing `placement-ui.tsx` belongs to F, despite its name.

## F — frontend pages, shell, data fetching and domain widgets

Exclusive existing paths:

- `mobile/src/app/` (all nine screen files plus `_layout.tsx`; exactly one F writer, not one per nominal feature).
- `mobile/src/context/auth.tsx`, `mobile/src/config.ts`, `mobile/src/api/client.ts`, `mobile/src/api/placement.ts`.
- `mobile/src/utils/` (all existing helper and platform-variant files).
- `mobile/src/components/app-navigation.tsx`, `app-tabs.tsx`, `app-tabs.web.tsx`, `backend-status.tsx`.
- `mobile/src/components/ai-explanation.tsx`, `career-roadmap.tsx`, `document-review.tsx`, `journey-input.tsx`, `candidate-evidence.tsx`.
- `mobile/src/components/career-asset-header.tsx`, `opportunities-header.tsx`, `improvement-row.tsx`, `linkedin-insights.tsx`, `placement-ui.tsx`.
- `mobile/src/components/demand-ranking.tsx`, `market-controls.tsx`, `market-radar.tsx`, `market-radar.web.tsx`.
- `mobile/src/components/revision-editor.tsx`, `revision-editor.web.tsx`.

Owns navigation/session presentation, async orchestration, current screens and consumer behavior. The shell fix F04 is entirely in this domain. Gemini consent/explanation **UI** belongs here; G does not edit it concurrently.

**Cannot edit:** `mobile/src/types/contracts.ts` (S), D primitives/tokens, tests, dependency/configuration manifests, or backend endpoints. Central `client.ts` is one shared integration lock across Journey/Jobs/Resume/LinkedIn/import work; request a sequential client patch before parallel page work. `_layout.tsx` is a single shell/auth-surface lock. Student/faculty screen sub-sessions are unsafe until F explicitly partitions concrete files and serializes client/placement-ui changes.

## B — non-AI backend workflow services and career/placement routes

Exclusive existing paths:

- `backend/app/routes/jobs.py`, `backend/app/routes/placement.py`, `backend/app/routes/workspace.py`.
- `backend/app/services/analysis.py`, `intelligence.py`, `skills_taxonomy.json`, `candidate_profile.py`, `demo_seed.py`.
- `backend/app/services/job_discovery.py`, `market.py`, `serpapi.py`, `learning.py`.
- `backend/app/services/imports.py`, `retention.py`, `journey_input.py`, `placement.py`.
- `backend/app/services/linkedin.py`, `linkedin_public.py`, `linkedin_insights.py`, `resume_files.py`, `resume_enhancer.py`, `resume_statistics.py`.

Owns deterministic scoring/business rules, parsing, SerpApi normalization, imports, learning/progress and existing resume/LinkedIn/placement orchestration. Security fixes in these files still require S review; owner status is not permission to make unapproved data/policy changes.

**Cannot edit:** model/schema/auth/config/main/migration files, G adapters, S document lifecycle, frontend, tests or release scripts. These three route modules mix multiple domains. `workspace.py` defines shared owner/version helpers and calls Gemini; `jobs.py` hosts AI roadmap; `placement.py` mixes import/catalog/training/reviews. G/S supply required interface/security changes; B alone writes these modules in a serialized batch. No per-function parallel editing.

`analysis.py`/`intelligence.py` are not to be changed for cosmetic unknown-state fixes without formula/version approval. `learning.py` is shared by roadmap, assessment, AI recommendations and faculty training: accept dependencies before modification.

## S — schema, authentication, authorization and private-data security

Exclusive existing paths:

- `backend/app/main.py`, `backend/app/db.py`, `backend/app/models.py`, `backend/app/document_models.py`.
- `backend/app/auth.py`, `backend/app/config.py`, `backend/app/schemas.py`, `backend/app/enums.py`, `backend/app/validation.py`.
- `backend/app/routes/accounts.py`, `backend/app/routes/documents.py`.
- `backend/app/services/accounts.py`, `backend/app/services/document_intelligence.py`, `backend/app/services/document_retention.py`.
- `backend/migrations/` (env and revision files), `backend/alembic.ini`, `backend/scripts/manage_accounts.py`.
- `backend/.env.example`, `mobile/.env.example` (templates only; never real secrets).
- `mobile/src/types/contracts.ts` (all mirrored API contracts), `mobile/src/types/css.d.ts`.

Owns public contract coordination, DB bootstrap/migration design, account/ownership primitives, reviewed document mutation/retention and policy enforcement. The document intelligence lifecycle mutates authoritative facts, so it belongs here; model extraction alone belongs to G.

**Cannot edit:** B/G implementation files, frontend session UI/storage helpers, tests or release files concurrently. S submits explicit patches/interfaces to their owners. A route/schema/client change proceeds S contract → B/G handler → F consumer → T tests → R acceptance, not simultaneous guesses.

This is also the lock for `main.py` route composition/legacy APIs. G/B do not add imports/routes there independently. No migration of real records, silent `create_all` expansion, destructive downgrade, HMAC rotation or feature activation without the existing approval and copy/backup validation boundary.

## G — Gemini AI adapters and grounded provider runtime

Exclusive existing paths:

- `backend/app/services/ai_gateway.py`, `ai_runtime.py`, `grounded_ai.py`.
- `backend/app/services/gemini_resume.py`, `gemini_roadmap.py`, `gemini_document_extraction.py`.
- `backend/app/routes/ai.py`.

Owns bounded provider calls, prompts/output/source validation, safety/error classifications and safe AI-cache/budget usage. F03 is confined to the roadmap adapter plus T-owned tests; that fix is safe alongside F04.

**Cannot edit:** persistence models/migrations/contracts, source facts/scoring, document approval lifecycle, resume/Jobs route wrappers, UI, dependencies, `.env` or tests. All new schemas go through S. Gateway budget changes affect resume analysis, rewrite verification, document extraction, roadmap, readiness, LinkedIn and opportunities; change/test all callers under one G owner rather than separate prompt sessions.

No live provider call, key inspection, default model switch, flag activation or unreviewed fact persistence is implied by adapter ownership. Preserve separate user consent and unsupported-output withholding.

## T — automated regression and contract tests

Exclusive existing paths:

- `backend/tests/` (all 22 existing test files).
- `mobile/tests/` (all 8 existing helper test files).
- `backend/pytest.ini`.

Owns behavioral/contract/authorization/consent/parser/concurrency regression changes and fixtures. Use isolated synthetic databases and mocked providers. No test may hit an existing configured database or read a personal `.env`. Add missing regression assertions for the confirmed audit defects; do not assert only source strings or mirror implementation logic.

**Cannot edit:** application files, manifests/lockfiles, browser scripts or CI. R chooses/integrates the browser harness with T; if rendered tests move to a new directory, assign that exact proposed path before creating it. Implementation owners may run existing tests freely. T serializes all test-file edits; G and T must not both edit `test_gemini_roadmap.py`.

## R — release validation, build/dependencies and evidence

Exclusive existing paths:

- Root `README.md`, `requirements.txt`, `.gitignore`.
- `backend/requirements.txt`, `backend/requirements-dev.txt`.
- `mobile/package.json`, `mobile/package-lock.json`, `mobile/app.json`, `mobile/tsconfig.json`, `mobile/eslint.config.js`, `mobile/README.md`.
- `backend/scripts/verify_workspace_browser.py`, `verify_market_browser.py`, `verify_linkedin_insights_browser.py`, `verify_journey_layout_browser.py`.

Proposed future paths, **not present at baseline**:

- `.github/workflows/quality.yml` for the agreed CI pipeline.
- `docs/quality/release/` for new task-specific command, advisory, browser/native and rollout acceptance reports.
- Any additional browser harness file in `backend/scripts/` must be named/assigned before creation; no existing framework/dependency is assumed.

Owns reproducibility, dependency/advisory triage, supported build configuration and acceptance evidence. No force audit fixes, public deployment, real backup/migration/purge, native credential/signing change or provider quota consumption is authorized by this map. S owns template/security/persistence configuration, even when R operates the checks.

**Cannot edit:** app code, schemas/contracts, account-management script, T tests, real configuration/credentials or historical progress documents. Manifest changes require affected owner review and matching SDK documentation/checks. `reset-project.js`, licenses, images and archived design references remain unassigned/read-only in this plan.

## Audit report ownership

This planning session owns exactly:

- `docs/quality/PROJECT_AUDIT.md`
- `docs/quality/REFINEMENT_PLAN.md`
- `docs/quality/DOMAIN_OWNERSHIP.md`

Future sessions read these baseline reports, write their own named domain/release handoff, and propose a coordinated update if conclusions change. Do not rewrite these into a shared progress ledger. Existing `docs/architecture/GEMINI_IMPLEMENTATION_PROGRESS.md` and all older handoffs remain untouched.

## Safe concurrency and required sequencing

| Work | Can proceed together? | Physical overlap / handoff |
|---|---|---|
| F04 shell menu repair + F03 Gemini roadmap block guard | **Yes** | F `_layout.tsx`; G `gemini_roadmap.py`; T alone edits regression files; R validates afterwards. |
| R advisory/CI work + F/G product fixes | **Yes, with dependency freeze** | R can inventory/prepare scripts while installed versions/manifests stay fixed. Installing/upgrading changes the environment for everyone; schedule that serially. |
| D token/primitive inventory + B/G backend fixes | **Yes** | Separate files. Actual public primitive interface changes must finish before F consumer adoption. |
| Student pages + faculty pages in separate writers | **Not by default** | `client.ts`, `placement-ui.tsx`, auth shell and shared primitives overlap. Assign exact route/widget files and lock integration files first. |
| Custom-role privacy + target persistence + schema change | **Sequential** | S ownership policy/contracts/model/main; B placement/analysis routes; F Journey/client; T regression; R copy-migration/browser acceptance. |
| Document extraction + profile approval/retention + UI | **Sequential at interfaces** | G extraction/runtime; S schemas/document routes/lifecycle/migrations; F document review/client. Existing consent/proposal/version semantics must agree before independent implementation. |
| Resume AI + roadmap AI + grounded explanation changes | **One G writer** | Shared `ai_gateway.py`, `ai_runtime.py`, `gemini_resume.py` schema/redaction helpers and quotas. |
| Imports + faculty review/drives/training changes | **One B writer until extraction** | All share `routes/placement.py`; import retention spans S policy and B service/route. |
| Contract correction + frontend consumption | **Sequential** | S `schemas.py` + `contracts.ts`, then B/F code; T contract tests. No independent type edits. |
| Real rollout/privacy approval | **Sequential, owner approval required** | S/R + deployment/privacy owner; flags stay off until policy, backup/copy migration, restore and scheduler evidence are accepted. |

Every handoff states changed files, agreed interfaces, commands/results, unrun checks, data/config implications and remaining dependency. No session edits another worktree, switches branches, discards unrelated changes or commits without explicit instruction.

**Top five release risks:** privacy/retention/scoped-role gaps; blocked Gemini roadmap output; inaccessible pointer sign-out; lost target/incomplete learning loop; dependency and release-gate gaps.

**First safe batch:** F03 + F04, with T-owned regressions and R-owned browser acceptance.

**Parallel sessions:** F, G, T and R can coordinate that bounded batch; D can inspect independently. This is a proposed assignment, not evidence that sessions were launched.

**File-overlap warning:** shared schema/main/model/config/route/client/contract/shell/primitive files remain single-owner locks. Where clean separation is not possible, work is sequential until a reviewed extraction exists.
