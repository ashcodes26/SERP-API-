# SkillUp - Gemini Integration Final Report

Date: 2026-10-19
Branch: `chore/simplify-journey-page`
Starting checkpoint: `7587107b29ea4a73e04f13bc337b7d85b8d27f62`

## Delivery status

Batches 2-6 are implemented and their automated acceptance checks passed. Batch 1 was verified and reused. This is a gated implementation delivery: production release, manual browser/device acceptance and real Gemini capability verification remain blocked/unverified as listed below. No production data was opened, changed or migrated. No real Gemini or SerpApi calls were used in automated tests.

The current request's batch numbering takes precedence over the older architecture plan. Implementation authorization came from the current request; unresolved deployment privacy, retention and security decisions were not assumed approved. New document review and grounded explanations default off.

## Implemented functionality

### Batch 2 - Document Intelligence

- Reuses the existing request-only 1 MiB TXT/DOCX/text-PDF parser, including PDF page/decompression, DOCX ZIP/XML, Unicode and text-length boundaries. Original binaries are never stored by the backend.
- Conservative classification: resume, certificate, transcript, project report, internship document or unknown. Unknown material creates no profile actions. Classification is advisory and never issuer/authenticity verification.
- Deterministic findings reuse existing skill section/alias/negation/URL/learning-goal handling. Skills remain mentions with unknown proficiency; explicit labelled scalar facts and project/experience/certification statements become review candidates.
- Optional Gemini extraction uses separate immediate consent, bounded best-effort contact redaction, a strict schema, one SDK attempt and local unique source-excerpt/value verification. Failed/blocked/malformed output preserves deterministic proposals.
- Additive private persistence for documents/extractions/proposals/items/audit. Separate storage consent, 30-day maximum review expiry, no automatic extension, student-only ownership, and per-student HMAC duplicate fingerprints.
- Per-item accept/edit/reject uses proposal/item versions, current-profile fingerprint, explicit conflict confirmation, reverified evidence and a single transaction. SQLite writer reservation serializes mutations and duplicate uploads.
- Idempotency replays do not reapply facts; reuse with another action fails. An expired replay purges source values before response. Audit persistence failure rolls back profile/evidence/item writes.
- Approved skills attach ordinary Evidence and StudentSkill references; an existing level is preserved and a new level is null. GPA, grades, honors, degree results, inferred achievements and proficiency are excluded from v1 mutation.
- Evidence provenance links document/item/opaque ID; proposal responses include document/extraction IDs. Unverifiable/deduplicated findings are counted, and inferred suggestions have no approve action.
- Delete/expiry purges retained text, filenames, excerpts, extraction JSON, current/proposed/applied review values and duplicate HMAC. Previously approved ordinary profile facts and minimal audit remain.
- Added a maintenance purge command; scheduler deployment/monitoring is still required.
- Profile UI includes preview, separate consents, type correction, current/proposed values, source excerpts, conflict review, edit/reject, retry keys, deletion/expiry, session/request-race guards and user-controlled refresh guidance.

### Batch 3 - Career Readiness and Roadmap

- Added owner-only readiness explanations over current deterministic scores/gaps and approved persisted evidence references.
- Gemini selects only supplied source IDs and allowed conditional action enums. Server templates render factual explanations. Arbitrary model scores, URLs, candidate facts and prose are not accepted into this explanation API.
- Added owner-scoped one-hour cache for validated IDs/enums only. Keys bind owner, task, profile/evidence/role/listing context, model, schema and actual prompt content. Changed sources invalidate the cache; post-provider comparison withholds stale results.
- Added atomic durable UTC-hour owner/task budgets. Existing roadmap transport receives owner scope without breaking its API/test seams; pre-migration legacy adapters retain a scoped in-process fallback.
- Read-only personalized recommendations reuse the existing learning service's saved milestones/resources/progress or explicitly labelled curated resources. They do not reset or create saved progress automatically.
- Existing optional roadmap narrative is redacted and rejects unsupported learner/academic claims and unrelated dictionary skills. Existing deterministic roadmap, HTML/PDF/progress export and user-triggered generation remain available.

### Batch 4 - Career Assets

- Resume continues through the Batch 1 shared gateway, consent/redaction, source-quote checks, hard factual guards and optional rewrite-equivalence checks. Added owner-aware request budgets and safe quota status.
- Resume revision, accepted/rejected edits, restore, target listing, export and faculty sharing workflows retain their contracts.
- Added separate LinkedIn optimization over confirmed saved text only. Public-search/OIDC lookup and deterministic analysis remain independent. Contact headers/URLs are removed before the provider; source changes invalidate results.
- LinkedIn AI suggestions are source-bound conditional editorial actions. They do not rewrite the saved LinkedIn profile or add qualifications, experience, metrics or student evidence.

### Batch 5 - Opportunities

- Added explanations requiring a stored genuine `serpapi_live` DiscoveredJob, original source URL and the student's own corresponding analysis. Fixture/fallback listings cannot enter this path.
- Requirements are re-extracted deterministically from the retrieved description and source-excerpt verified; model-created requirements/listings are not accepted.
- Matching explanations reuse deterministic scores/gaps and approved evidence references. Listing versions, source URLs and unknown opening status remain explicit.
- SerpApi search, retrieval cache, pagination and original source/application links were preserved. No Gemini-triggered search, URL fetch, eligibility change or application action was added.

### Batch 6 - Final integration

- Integrated independent consent/error/status/source controls in Profile, role readiness, Roadmap, LinkedIn and Jobs without navigation redesign.
- Added lifecycle/concurrency/transaction/cache/quota/grounding regression tests and a tested additive migration against a populated synthetic SQLite copy.
- Documented configuration, approval boundaries, retention maintenance and backup-first rollout in `GEMINI_DEPLOYMENT_RUNBOOK.md`.

## Verification results

| Check | Result |
| --- | --- |
| Original Batch 1 gateway/resume/roadmap tests | 59 passed |
| Original full backend baseline | 183 passed |
| Batch 2 full backend | 205 passed; 22 DIL tests passed after final batch edit |
| Batch 3 full backend | 217 passed |
| Batch 4 full backend | 220 passed |
| Batch 5 full backend | 224 passed |
| Final full backend | **232 passed** (49 additional tests versus baseline) |
| Final frontend unit/regression tests | **21 passed** |
| TypeScript `--noEmit` | **Passed** |
| Expo lint | **Passed** |
| Expo web export | **Passed**, 11 routes, `.expo/export-release-check` |
| SQLite migration | **Passed** on populated synthetic copy; full legacy-row comparison, integrity, foreign keys, repeat upgrade |
| Whitespace/diff check | **Passed** |
| Mobile source/export secret scan | No provider-key names or Google key patterns found |
| Dependency audit | 30 existing findings: 18 high, 12 moderate, 0 critical; triage remains open |

Backend tests cover source grounding, excluded fields, consent/no configuration, safety blocks, malformed/oversized/unsupported output, timeout/quota/unavailable responses, faculty/other-student denial, profile/listing changes, cache isolation, durable limits, conflicts, invalid edits, idempotency, concurrent upload/approval, rollback, expiry/delete and expired replay.

The populated migration fixture includes ordinary profile/evidence/skills, saved resume/revision, confirmed LinkedIn content and completed roadmap progress. Every pre-existing table's entire records are compared before/after upgrade; no real database is involved.

Equivalent tested commands from `backend/`: `python -m pytest -q`, using bundled Python 3.12, isolated workspace-installed dependencies, `APP_ENV=test` and a workspace synthetic `DATABASE_URL`. Frontend commands: `node --test tests/*.test.cjs`, `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/expo/bin/cli lint`, and `node node_modules/expo/bin/cli export --platform web --output-dir .expo/export-release-check` with CI mode. Expo lint used a workspace npm/npx shim because this host did not expose npm on PATH.

Observed non-blocking tooling issues: one pre-existing Starlette/httpx deprecation warning; Metro color-environment warnings; a web export failed to write to old `dist` (EPERM), then succeeded in a fresh output directory. An initially over-mocked quota test was corrected and the full suite rerun. No dependency manifests were changed or audit fixes applied.

## New APIs

All new document/proposal/AI endpoints derive identity from the authenticated student. They do not accept a client-selected student ID. Faculty/admin access is denied. Responses use the existing private no-store middleware and sanitized validation errors.

| Method | Route | Behavior |
| --- | --- | --- |
| GET | `/api/documents/capabilities` | Review feature availability/retention policy |
| POST | `/api/documents/preview` | Request-only deterministic file preview |
| POST | `/api/documents` | Consent-gated private review creation |
| GET | `/api/documents` | Own review summaries |
| GET | `/api/documents/{id}` | Own review/proposal detail |
| PATCH | `/api/documents/{id}/type` | Validated correction; supersedes pending comparison, records minimal audit |
| POST | `/api/documents/{id}/extract` | Fresh consented optional Gemini extraction |
| DELETE | `/api/documents/{id}` | Immediate source-review purge |
| GET | `/api/profile-update-proposals/{id}` | Own retained proposal |
| POST | `/api/profile-update-proposals/{id}/refresh` | Recompare pending items, no provider call |
| PATCH | `/api/profile-update-proposals/{id}/items/{item_id}` | Individual versioned/idempotent decision |
| POST | `/api/ai/readiness/{analysis_id}` | Grounded read-only readiness/learning explanation |
| POST | `/api/ai/linkedin` | Grounded confirmed-source LinkedIn advice |
| POST | `/api/ai/opportunities/{job_id}/analysis/{analysis_id}` | Grounded retrieved-listing comparison explanation |

Existing Journey, Resume, LinkedIn lookup/analysis, jobs, scoring, roadmap, authentication and faculty APIs were preserved. New Pydantic contracts are mirrored in TypeScript.

## Migration and persistence

Alembic head: `20261019_01`. New tables:

- `document_intelligence_documents`
- `document_extractions`
- `profile_update_proposals`
- `profile_update_proposal_items`
- `profile_update_audit`
- `ai_request_windows`
- `ai_safe_cache`
- `ai_diagnostics`

The frozen revision creates these tables/indexes and an audit-update rejection trigger only. Existing tables are not altered, rebuilt or dropped. Legacy `init_db()` bootstrapping deliberately excludes these new tables; migration is an explicit operator action. Destructive downgrade is refused. Production rollback requires a verified backup restoration after shutdown.

No automatic source-document cache exists. Retained audit data contains actor/action/opaque references/time/policy version/idempotency/HMAC commitments, not raw text, filename, excerpt, current/proposed value or provider response. Audit retention/access and HMAC rotation policy remain deployment decisions.

## Limitations and remaining release blockers

1. **Privacy/retention approval:** approve audit duration/access, Gemini processing/consent copy, HMAC key storage/rotation, backup encryption/access/retention/disposal and incident response. Until then leave `DOCUMENT_REVIEW_ENABLED=false` and `GROUNDED_AI_ENABLED=false`.
2. **Retention operations:** install/monitor the purge scheduler before enabling stored reviews. Expiry is enforced on access; physical purge while idle depends on the scheduler. Scheduler operation was not performed here.
3. **Browser/device acceptance unverified:** 360/768/1440 layout, keyboard/screen-reader focus/live messages, native pickers/cache cleanup, session restoration, duplicate taps and actual browser download/export behavior require synthetic manual acceptance. Automated unit/type/lint/export success is not a browser/device claim.
4. **Provider behavior unverified:** real model availability, structured-schema support, actual quota/timeout/redaction behavior and provider retention policies were not probed. Any smoke check needs explicit authorization and a minimal synthetic call budget. No real key was read or sent by these tests.
5. **Dependency security:** the unchanged frontend lockfile currently reports 30 audit findings. Triage/update in a separate reviewed change before production release.
6. **Intentional v1 scope:** no OCR/images/XLSX document intelligence, authenticity/issuer registry checks, academic-result mutation, inferred skill level, experience duration or employment probability. Flattened text has no verified page metadata; purported model page numbers are withheld. Unlabelled or ambiguous scalar facts fail closed.
7. **Conservative AI presentation:** new explanations prioritize evidence/action references instead of unrestricted prose. Project/experience/certification/URL approvals attach evidence rather than creating a new generic biography or replacing Resume/LinkedIn workspaces. Roadmap and Resume legacy narrative/rewrite semantics still require human review; automated guards do not establish source truth or credential authenticity.
8. **SQLite scope:** review mutation serialization uses SQLite `BEGIN IMMEDIATE`; another database engine needs a separately tested locking/migration design.
9. **Operational scale:** legacy deployments without the additive migration retain in-process request limits for existing adapters; durable cross-process budgets require the migration. New explanation APIs return unavailable if their tables/flags are absent.

No release-blocking policy was bypassed by enabling a feature, persisting real student data, running a real migration, consuming real Gemini test quota or modifying production records.

## Files changed from the starting checkpoint

- `backend/.env.example`
- `backend/alembic.ini`
- `backend/app/config.py`
- `backend/app/db.py`
- `backend/app/document_models.py`
- `backend/app/enums.py`
- `backend/app/main.py`
- `backend/app/models.py`
- `backend/app/routes/ai.py`
- `backend/app/routes/documents.py`
- `backend/app/routes/jobs.py`
- `backend/app/routes/workspace.py`
- `backend/app/schemas.py`
- `backend/app/services/ai_gateway.py`
- `backend/app/services/ai_runtime.py`
- `backend/app/services/document_intelligence.py`
- `backend/app/services/document_retention.py`
- `backend/app/services/gemini_document_extraction.py`
- `backend/app/services/gemini_resume.py`
- `backend/app/services/gemini_roadmap.py`
- `backend/app/services/grounded_ai.py`
- `backend/app/services/learning.py`
- `backend/migrations/env.py`
- `backend/migrations/versions/20261019_01_private_review.py`
- `backend/tests/test_document_intelligence.py`
- `backend/tests/test_gemini_roadmap.py`
- `backend/tests/test_grounded_ai.py`
- `docs/architecture/GEMINI_DEPLOYMENT_RUNBOOK.md`
- `docs/architecture/GEMINI_IMPLEMENTATION_PROGRESS.md`
- `docs/architecture/GEMINI_INTEGRATION_FINAL_REPORT.md`
- `mobile/src/api/client.ts`
- `mobile/src/app/index.tsx`
- `mobile/src/app/jobs.tsx`
- `mobile/src/app/linkedin.tsx`
- `mobile/src/components/ai-explanation.tsx`
- `mobile/src/components/career-roadmap.tsx`
- `mobile/src/components/document-review.tsx`
- `mobile/src/types/contracts.ts`
- `mobile/src/utils/document-review.ts`
- `mobile/tests/document-review.test.cjs`
