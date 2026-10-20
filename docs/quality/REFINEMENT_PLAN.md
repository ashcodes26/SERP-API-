# SkillUp — phased refinement plan

Planning baseline: `98c4384`, `chore/simplify-journey-page`, worktree `planning`. Date: 2026-10-20 (Asia/Calcutta). This is a plan, not implementation or deployment approval. Finding IDs refer to [PROJECT_AUDIT.md](PROJECT_AUDIT.md); exclusive edit boundaries are in [DOMAIN_OWNERSHIP.md](DOMAIN_OWNERSHIP.md).

## Product completion target

Finish the existing student/faculty journey before adding feature families. A release candidate should let a returning student resume the chosen role, review evidence, understand deterministic unknowns/gaps, open learning resources and record progress, improve an asset without losing edits, and complete institution-scoped review/training/application workflows. Faculty should see only authorized information, including role metadata, and trust report definitions and retained-data policy.

Preserve the stack, nine route URLs, current API contracts until explicitly coordinated, original/resaved resume text, source provenance, independent consents, student approval of profile changes, deterministic scoring/versioning, and existing SQLite data. Do not turn SWOT/ATS/OCR/interview practice into new release requirements merely because the old reference PRD mentions them.

Release-platform decision remains open. Web acceptance can proceed now; a release marketed as native also needs Android/iOS build, picker/storage/sharing/safe-area and assistive-technology evidence. Do not call a web export a native release.

## Immediate first safe implementation batch

This batch starts only after this audit; no application changes were made here.

| Order / owner | Exact scope | Acceptance / checks | Exclusions |
|---|---|---|---|
| 1 — G Gemini adapter | `backend/app/services/gemini_roadmap.py`: reject blocked/unsafe/incomplete responses before consuming JSON; retain safe public status contract. | T adds cases in `backend/tests/test_gemini_roadmap.py` for valid JSON plus block metadata, no candidate, non-STOP completion/truncation, normal success, no consent/config, quota/timeout. Run focused roadmap/gateway tests, then full backend suite. | No model change, prompt rewrite, scoring change, schema/migration, live call, flag enablement or new dependency. |
| 2 — F frontend shell | `mobile/src/app/_layout.tsx`: fix account-menu stacking/hit targets; close menu on sign-out/account transition; preserve auth/session logic. | Release verifies real pointer and keyboard sign-out at 360 and 1440px, focus/close behavior, subsequent student/faculty login and session expiry. Run frontend unit tests, tsc, lint, web export. Add maintained UI regression once the harness in Phase 0 exists. | No auth redesign, route rename or design-system rewrite. Do not represent a source-string assertion as a rendered regression test. |
| 3 — T/R integration | T alone edits the test files; R records reproducible browser evidence under a new task-specific `docs/quality/release/` report. Proposed new report path is not an existing artifact. | Full tests remain green; no private provider output on blocked result; Sign out hit target is the actual button; original account/scope behavior unchanged. Review `git diff --check` and file list. | No shared progress-document edits; no commit without request. |

G and F can implement in parallel because their files do not overlap. T coordinates test edits with G rather than both writing the same test file. R validates after the relevant change lands in the shared worktree. This is an estimate of a small reviewable batch, not a promise of hours or dates.

## Phase 0 — reproducible gates and risk containment

**Goal:** make further changes reviewable without relying on historical claims. This phase can accompany the first safe fixes; unresolved safety findings are not postponed behind general refactoring.

1. R captures current commands, resolved backend dependencies and supported Node/Python/Expo versions. Decide a backend lock strategy consistent with current pip requirements; avoid incidental upgrades.
2. R proposes a new `.github/workflows/quality.yml` (does not exist today) running backend isolation/tests, frontend helper tests, tsc, lint and static export from a fresh checkout. Keep provider secrets absent and all databases synthetic. Account for Windows versus CI operating-system behavior.
3. R/T establish a browser harness in the existing `backend/scripts/` convention or an explicitly agreed test directory. Parameterize frontend/backend ports, use fresh synthetic accounts/database, update retired labels, and remove personal `.env` dependency. Choose the supported browser tooling before adding dependencies; manifests remain R-owned.
4. S/B address F02 and F10 with regression-first reproductions. Immediate custom-role catalog restriction can use an existing-safe subset, but private/custom role sharing requires a documented visibility decision before schema work. Import expiry must distinguish staged personal data from approved Student records and follow an approved retention policy.
5. R/S triage F11 advisories by actual dependency path and exposed surface. Record each advisory, reachability, compatible remediation and expiry for any accepted exception. The current aggregate is 30 affected package entries, not 30 independent exploits. Never run forced audit fixes.
6. Keep retained-document/grounded-AI flags off. Collect missing policy/operations approvals from the existing runbook; do not manufacture approval or new retention durations.

**Gate:** fresh-checkout quality job passes; regression cases expose each confirmed defect before fixes; dangerous/unreviewed production activation remains disabled; advisory triage is reviewable. No real data migration/retention purge is required for this phase.

## Phase 1 — close the core student loop

| Batch / findings | Implementation boundary | Dependencies / risk | Exit evidence |
|---|---|---|---|
| Target continuation, F05 | F `index.tsx`; B `routes/placement.py`/analysis service; S only if a new active-selection schema is needed. | Agree whether latest analysis or explicit active role is authoritative. Restore without automatically analyzing or generating provider content. Medium risk. | Save custom role→analyze→roadmap→other route→return→refresh; same target and saved progress visible. Jobs handoff stays correct; first-time user still gets an honest initial state. |
| Learning resources/progress, F06 | F `career-roadmap.tsx`/consumers; existing `jobsApi.progress` and B progress route. | Preserve `RoadmapItem` IDs, provenance and completion-evidence rules. No RoadmapTask conversion. Medium risk. | Open approved source link, mark in progress, submit evidence, reload, export saved status; failed/duplicate update cannot fake completion or wipe existing evidence. |
| Task destination, F07 | Product decision first; F LinkedIn/task presentation; B/S only for an agreed API/data change. | Do not remove stored tasks, claim they are milestones, or tell users to visit a nonexistent list. Medium risk. | Every Add task confirmation links to a usable destination, or the action is accurately unavailable; existing tasks preserved. |
| Timeout/context consistency, F08/F15 | F client, relevant components/screens; G adapter budget semantics. | Shared client is one-owner/one-batch; freeze interfaces while screens work. Medium risk. | Delayed response near configured timeout, new target mid-request, expired session and duplicate tap; no stale plan/filters, duplicate quota use or misleading saved state. Jobs passes selected `analysisId`. |
| Assessment contract, F09 | S schemas/contracts/main; B learning; F Placement title; T contract regression. | Sequential mirrored contract handoff; no quiz scoring changes. Low risk. | API has agreed display name; typed client and rendered quiz heading agree; correct submission updates same skill and readiness. |
| Honest empty/unknown states, F19/F22 | Product approves interpretation; B/S keep formula/version; F presentation and reset/requirement copy. | Unknown display cannot silently change deterministic business rules. Medium risk. | New student is told evidence is unknown; no invented score/proficiency. Existing measured profiles retain expected results; reset copy describes its actual behavior. |

**Gate:** a synthetic first-time and returning student completes profile→role→alignment→resource→evidence/progress→resume/manual revision/export, with refresh/back/navigation and failure recovery. Missing provider configuration leaves local paths usable and clearly labelled. Existing backend invariants and user approval/provenance remain intact.

## Phase 2 — consistent accessible screens and faculty completion

1. D defines the shared Field/Action/Card/status/heading/spacing contract from existing palette/components (F17/F18). Keep business callbacks outside the design layer. F adopts the agreed primitives one screen group at a time; no parallel consumer/primitives rewrite.
2. F fixes request-state and filter races with targeted locks/current-context checks (F15). Separate pending action from page reload; do not disable unrelated document proposal decisions. Preserve unsaved resume editor text and pending idempotency keys.
3. Accept faculty Overview→cohort/student→resume share/review/revoke→drive→explicit application history→training/assessment→filtered CSV with two faculty scopes and two students. Exercise revoked access and stale versions at the UI and API boundaries.
4. B/S implement bounded XLSX parsing and work isolation (F13); R/T verify harmless synthetic malformed/limit fixtures and safe 4xx states. F handles native picker-copy cleanup for admin imports and actionable retry/session errors.
5. Make CSV/PDF/DOCX export behavior explicit. Existing progress `.doc` is HTML, whereas resume export produces real DOCX. Choose supported deliverables; do not rename extensions as a substitute for format conversion.

**Gate:** route × 360/768/1440 viewport matrix, keyboard-only progression/focus recovery, screen-reader headings/controls/announcements, readable contrast and touch targets; actual downloads re-open successfully. No cross-scope data or false success. Faculty metrics continue to distinguish reported outcomes from verified employment facts.

## Phase 3 — approved privacy operations and integration readiness

This phase has explicit approval dependencies in the existing architecture documents.

- S/R verify bootstrap→additive migration readiness (F14) on synthetic populated copies: every old table record preserved, integrity and foreign keys valid, repeated upgrade harmless, destructive downgrade refused. Then rehearse backup restoration using a verified disposable copy. Real rollout still requires the deployment owner's approval.
- Deployment/privacy owner approves retention/access, Gemini notices, HMAC secret handling/rotation, backup encryption/access/disposal, incident response and source-deletion semantics (F01). A key rotation strategy must address outstanding fingerprints/audit commitments; do not just change the key.
- R operates and monitors the document purge scheduler at the specified cadence; B/S provide approved import expiry/idle purge (F10). Evidence must include idle expiry, deletion after approval, preserved approved facts, minimal audit commitments, and no raw content in diagnostics.
- S/R agree production auth/proxy/HTTPS, rate limiting, recovery/provisioning and security headers (F21). Verify scope grants/revocation and logout/password invalidation under the deployed proxy. Retain current working auth until a reviewed design is ready.
- G/R obtain authorization for minimal synthetic live Gemini/SerpApi/LinkedIn smoke tests, with explicit call budget and no personal documents. Check actual configured model/schema, no-consent zero calls, quota/timeout/unavailable/redaction behavior, source links and billing/operational expectations. Live smoke tests do not replace mocked regressions or approve provider policy.

**Gate:** required policies approved and operations demonstrated before either private feature flag is enabled. No P0/P1 privacy/auth defect outstanding; no real data used in validation. Without approval, release only with those features explicitly unavailable.

## Phase 4 — measured performance and low-risk maintenance

- Profile F16 using allowed synthetic maxima before selecting infrastructure: large assigned cohorts, reports, job snapshots, maximum readable documents and delayed providers. Bound roadmap work/latency and move real bottleneck pagination/aggregation into SQL.
- Keep single-worker SQLite assumptions explicit. Multi-worker/distributed idempotency, background jobs or database replacement are architecture decisions requiring a separate plan, copy migration and rollback evidence.
- Add contract drift detection for F20. Extract mixed modules only to support an agreed domain change; preserve public imports/URLs and compare OpenAPI before/after. Do not split large files merely to reduce their line count.
- Remove legacy presentation code/assets only after reachability/build verification; correct stale setup/user copy and page metadata (F22). Preserve historical reports and user data.

**Gate:** measured latency/resource targets agreed by the product/deployment owner, repeatable checks, compatible native/web builds if supported, and no regression in consent/ownership/deterministic rules.

## Release acceptance contract

A finished release requires evidence for each supported boundary:

1. **Functional:** student and scoped faculty scenarios above; explicit empty/loading/error/conflict/offline states; saved data survives refresh/retry without duplicate writes or silently changed facts.
2. **Security/privacy:** deny unauthenticated/other-student/unassigned-faculty requests, including role catalogs and exports; safe parsers/logs; documented retention enforced; secret configuration and backup/restore verified.
3. **AI:** separate request consent; no provider output becomes a fact without reviewed source-bound approval; blocked/truncated/schema-invalid/stale output withheld; unknown competency stays null; no invented employment probability.
4. **Quality:** full backend/helper tests, type/lint, static export, maintained browser scenarios, supported native checks, dependency triage; exact commands/versions/results archived without credentials or private input.
5. **Operations:** deployment/runtime configuration, migration/rollback, key ownership, scheduled purge, monitoring and incident/support owner accepted. Green tests alone are insufficient.

Do not commit, publish, enable flags, change branches, migrate real data, or delete records simply because this plan exists. Future sessions follow the current worktree and exclusive ownership map, report concrete diffs/checks, and stop for unresolved shared-interface, security or data-loss decisions.

## Final prioritization and coordination

**Top five release risks:** privacy/retention/scoped-role gaps; blocked AI output; sign-out menu obstruction; lost target and incomplete learning actions; dependency advisories and missing repeatable release gates.

**First safe batch:** F03 Gemini block handling plus F04 account-menu repair, with focused regression tests and synthetic UI acceptance. Everything else follows the dependencies above.

**Can run in parallel:** G adapter fix and F shell fix; T owns their test edits; R prepares isolated CI/browser validation and advisory triage without editing product files. D can inventory tokens without changing shared component interfaces. No subagents or other sessions were started by this audit.

**File-overlap warnings:** `main.py`, `schemas.py`, `models.py`, `config.py`, `routes/workspace.py`, `routes/jobs.py`, `routes/placement.py`, `client.ts`, `contracts.ts`, `_layout.tsx` and shared primitives are single-owner integration surfaces. Schema/selection/catalog/retention changes are sequential across owners; do not assign them to independent writers based only on conceptual domain names.
