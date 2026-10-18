# Document Intelligence Layer — Dependency-Ordered Implementation Plan

## Delivery posture

This is an approved design plan, not an implementation authorization. It introduces new private APIs and persistent tables. No existing public API or schema is changed in place; existing Journey, Resume, LinkedIn, placement, and roadmap contracts remain operational. Stage 4A.1 requires separate authorization.

## Phase 0 — product/security decisions (P0, small)

**Change:** encode the approved v1 guardrails in implementation tests/specs: student-only DIL access; no binary retention; 30-day maximum review-data retention; separate AI consent; valid type correction causes re-extraction/recomparison; GPA/grades/honors/proficiency/achievements excluded; user-initiated refresh only; Alembic migrations.

**Why:** these decisions define what may be stored and which fields can safely be proposed.

**Affected files:** future architecture/config documentation; no application code.

**Dependencies/risks:** deployment privacy/legal review; no code begins until the audit and migration guarantees are testable.

**Verify:** `DOCUMENT_INTELLIGENCE_FINAL_APPROVAL.md` is reflected in route/service tests, including faculty/admin denial and purge behavior.

## Phase 1 — foundation and schema migration (P0, medium)

**Change:** add DIL models/tables, indexes, foreign keys, timestamp/version columns, schema Pydantic models, TypeScript contracts, and Alembic-managed migrations. Add document parsing module that calls/generalizes existing `resume_files.parse_resume` without weakening any limit.

**Affected files:** `backend/app/models.py`, `backend/app/schemas.py`, new `backend/app/services/document_intelligence.py`, `backend/app/services/document_files.py` only if extraction-specific policy needs a wrapper, DB migration files, `mobile/src/types/contracts.ts`.

**Dependencies/risks:** current SQLite `create_all` does not upgrade existing tables. Risks include retaining sensitive text indefinitely and accepting a MIME/extension mismatch. The migration must set non-null defaults only where safe and must not rebuild/drop existing SkillUp tables.

**Verify:** migrations upgrade a populated synthetic DB and preserve row counts/foreign-key integrity for all existing tables; model/schema unit tests; malformed, oversized, encrypted, zip-bomb-like, scanned PDF, and TXT/DOCX/PDF tests preserve current parser protections.

### Safe SQLite migration procedure

1. Stop the backend and verify no process has an open write transaction.
2. Copy the exact SQLite database file to a timestamped, access-controlled backup and calculate a backup checksum; never test migration against the sole production file.
3. Run `alembic current` and `alembic upgrade head` against a copy first, with SQLite foreign keys enabled. The first revision adds DIL tables/indexes only; it does not alter or drop existing SkillUp tables.
4. Run integrity checks (`PRAGMA integrity_check`, foreign-key check), expected existing-table row counts, and the complete backend regression suite against the migrated copy.
5. Promote only after backup verification and a maintenance window. Record the original and target Alembic revision.
6. Roll back by stopping the service and restoring the verified pre-migration backup. Do not rely on SQLite DDL downgrade for a deployed data-bearing migration; an Alembic `downgrade` is for test/staging validation only unless separately approved.

## Phase 2 — deterministic preview/classification/provenance (P0, medium)

**Change:** implement owner-only preview/create/list/detail/delete/type-correction routes, conservative rule-based classification, explicit section/skill extraction, short-lived full excerpts, and comparison engine. Build a proposal, not an update.

**Affected files:** new `backend/app/routes/documents.py`, `backend/app/main.py`, `services/document_intelligence.py`, `services/candidate_profile.py` (reused helpers only), tests in `backend/tests/test_document_intelligence.py`.

**Dependencies/risks:** Phase 1. Classification false positives must fall back to unknown, not change parsing rules or profile data. Hash only normalized source text within a versioned canonicalization policy.

**Verify:** no profile mutation after preview; unknown document path; valid type correction invalidates/recompares; duplicate detection; source excerpt verification; student-to-student and faculty/admin denial; 30-day expiry/delete purge behavior.

## Phase 3 — explicit approval transaction and audit trail (P0, large)

**Change:** add per-item accept/edit/reject routes, idempotency/audit persistence, current-value conflict checks, safe application into existing `Student`, `Evidence`, `Skill`, and `StudentSkill` records. Approved skills get `level=None`; evidence is linked once. Audit stores commitments/provenance IDs only, never raw source/current/proposed values.

**Affected files:** `routes/documents.py`, `services/document_intelligence.py`, `models.py`, `schemas.py`, `services/analysis.py` only for reuse/readback, tests.

**Dependencies/risks:** Phase 2. Never update an existing scalar if source/profile fingerprint is stale; do not use model confidence as a permission. An item must be all-or-nothing in one transaction.

**Verify:** accept/edit/reject, replay same idempotency key, concurrent/stale versions, conflicts, duplicate evidence, rollback on failed validation, immutable non-content audit checks, expiry/deletion preservation rules, and profile/skill result assertions.

## Phase 4 — optional Gemini extraction (P0, medium)

**Change:** add a new DIL-specific strict structured schema/prompt/service. Require a separate `ai_consent` request. Reuse `request_structured`, provider schema minimization, no-retry timing, status mapping, redaction, and provider error hygiene from `gemini_resume.py`; do not reuse resume feedback output or write logic.

**Affected files:** new `services/gemini_document_extraction.py`, `schemas.py`, `services/document_intelligence.py`, config only if a distinct model/timeout is approved, tests.

**Dependencies/risks:** Phase 2; Gemini configured. Prompt injection, unsupported facts, malformation, quota, and timeout must fail closed to no new proposal items. Redaction cannot be presented as anonymity.

**Verify:** mocked consent/no-config/valid/timeout/429/malformed/blocked response tests; extra fields rejected; excerpts must locate uniquely; model tries to set a level/GPA/achievement and server withholds it; no provider call without consent.

## Phase 5 — Profile review UI (P1, medium)

**Change:** add My Career Plan Profile UI for upload, preview, consent, item-level review, conflict handling, history/deletion, and refresh guidance. Keep Resume and LinkedIn routes separate; avoid a second generic Resume Analyzer.

**Affected files:** likely `mobile/src/app/index.tsx`, new focused components under `mobile/src/components/`, `mobile/src/api/client.ts`, contracts, utility tests. Do not alter global navigation unless the existing Profile entry needs a narrow contextual link.

**Dependencies/risks:** Phases 2–4. Mobile density, stale UI state, and accidental repeated approve requests are risks.

**Verify:** 360/768/1440 manual/browser checks; keyboard/focus/live-region testing; local file chooser; conflict edit/reject; refresh/session restore; visible provenance and no claimed proficiency.

## Phase 6 — derived refresh and observability (P1, small)

**Change:** return explicit refresh guidance and instrument privacy-safe aggregate counters (parse status, classification unknown rate, extraction status, proposal decision outcome) without raw document text. Use existing deterministic re-analysis/roadmap routes only after user action.

**Affected files:** DIL service/routes/tests, optionally a privacy-safe server metrics facility. No changes to `RoadmapItem`, `RoadmapTask`, placement eligibility, or Gemini roadmap APIs.

**Dependencies/risks:** Phase 3. Avoid metrics containing identity, excerpts, filenames, or provider output.

**Verify:** profile change updates deterministic read model; roadmap tasks/status remain unchanged; no automatic Gemini call; telemetry redaction tests.

## Test matrix

| Area | Required automated coverage |
|---|---|
| File safety | Size/MIME/extension/signature mismatch, encrypted/scanned/oversized PDF, malformed DOCX/XML, archive bounds, invalid Unicode, no file retention without consent. |
| Classification/extraction | All supported kinds, unknown fallback, deterministic-only path, source-excerpt location, canonical skills, explicit versus suggestion separation. |
| Gemini | No consent/no config/provider unavailable/timeout/quota/blocked/malformed/oversized/extra field responses; prompt injection strings treated as data; no direct write. |
| Proposals | New/duplicate/conflict/unsupported rules, stale fingerprint refresh, field allow-list, type correction, and GPA/grades/honors/proficiency/achievement exclusions. |
| Approval | Owner checks, faculty/admin denial, item/proposal versions, idempotency, transaction rollback, concurrent approvals, non-content immutable audit commitments, and provenance. |
| Regression | Current Journey upload/save, Resume upload/revision/export, LinkedIn upload/search confirmation, role analysis, roadmap creation/progress, faculty scopes/reviews. |
| UI/accessibility | Focus order, labels, live outcomes, error recovery, narrow layout, repeated tap protection, session restoration. |

Run the existing full backend suite, frontend test suite, `npx tsc --noEmit`, and `npx expo lint` in addition to the new tests. Browser/device acceptance must use synthetic accounts/documents only.

## Estimated complexity and sequencing

| Phase | Estimate | Critical dependencies |
|---|---:|---|
| 0 | 1–3 days | privacy/product approval |
| 1 | 3–5 days | migration decision |
| 2 | 4–6 days | Phase 1 |
| 3 | 5–8 days | Phase 2; audit/idempotency review |
| 4 | 3–5 days | Phase 2; Gemini test fixtures |
| 5 | 4–6 days | Phase 3, preferably Phase 4 |
| 6 | 1–2 days | Phase 3 |

Total engineering estimate: **21–35 working days** for a production-quality delivery, excluding security/privacy review and any OCR/institutional-verification scope. A reduced deterministic-only pilot through Phase 3 is approximately **12–19 working days**.

## Explicit non-goals for the first release

- OCR, image extraction, signatures, authenticity/issuer verification, credential registry integration, transcript grade calculation, and automatic faculty ingestion.
- Direct document download for faculty, shared generic document storage, automated resume rewriting, inferred proficiency, predictive placement status, or automatic job applications.
- Replacing existing resume revisions, LinkedIn records, roles, analyses, roadmaps, assessments, placement data, or public API contracts.
