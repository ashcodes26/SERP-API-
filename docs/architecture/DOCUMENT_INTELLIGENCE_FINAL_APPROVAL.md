# Document Intelligence Layer — Final v1 Approval

## Approval status

The Document Intelligence Layer design is approved for **implementation planning only**. It is not authorization to begin Stage 4A.1, change application code, add database tables, alter API contracts, or run migrations. Those actions require a separate implementation authorization.

## Approved technical decisions

1. DIL is student-owned and student-only. No faculty/admin route may access DIL raw text, document metadata, proposals, AI consent state, decisions, or audit content.
2. Original uploaded binary files are never persistently retained.
3. Extracted review text is stored only after explicit storage consent. Retained review data expires no later than 30 days after creation and is not extended automatically.
4. Gemini extraction is optional, uses separately recorded AI consent at request time, and receives only bounded, best-effort redacted text. It has no database/tool/write authority.
5. GPA, grades, academic honors, degree results, inferred proficiency, and inferred achievements are excluded from v1 profile mutations, even if a source or model mentions them.
6. Students may correct document type to a supported enum or `unknown` before approval. Type correction supersedes pending comparison items, performs deterministic re-extraction/recomparison, and requires fresh AI consent before another Gemini extraction.
7. Each profile mutation requires an individual student action, current-state conflict check, server validation, idempotency key, and one transaction containing the update, evidence link, and minimal immutable audit event.
8. Skills approved from documents are evidence-backed with `StudentSkill.level = NULL`; DIL never infers or overwrites proficiency.
9. Readiness/alignment and roadmap refresh are user initiated only. No DIL action resets roadmap progress, changes a target role, or invokes Gemini roadmap generation.
10. Alembic is the required migration mechanism for DIL persistence and is introduced without changing existing public contracts or removing current SkillUp behavior.

## Final v1 scope

V1 accepts bounded text-selectable PDF, DOCX, and TXT through the existing parser protections. It classifies documents as `resume`, `certificate`, `transcript`, `project_report`, `internship_document`, or `unknown`; `unknown` and unsupported material do not create profile updates.

The layer performs deterministic extraction first and may run a strict Gemini structured extraction only with separate consent. Every provider response is Pydantic-validated, source-excerpt-verified, normalized, compared with the current profile, and converted into individual review items. No LLM response directly mutates application data.

V1 preserves the current Journey, Resume Analyzer, LinkedIn Analyzer, role selection, deterministic skill-gap analysis, roadmaps, placement reviews, faculty scope, and legacy Roadmap To-do APIs. It does not include OCR, authenticity verification, credential registry integration, automatic faculty ingestion, or academic-result handling.

## Canonical lifecycle and terminology

| Domain | Canonical values |
|---|---|
| Parse status | `parsed`, `parse_failed`, `unsupported` |
| Classification status | `classified`, `uncertain`, `unsupported`, `student_corrected` |
| Gemini extraction status | `not_requested`, `available`, `unavailable`, `quota_limit`, `timeout`, `blocked`, `invalid_output` |
| Comparison status | `new`, `no_change`, `duplicate`, `conflict`, `unsupported`, `withheld` |
| Proposal operation | `add`, `update`, `attach_evidence` |
| Request action | `accept`, `edit`, `reject` |
| Persisted item decision | `pending`, `applied`, `rejected`, `stale`, `expired`, `deleted` |
| Proposal status | `ready_for_review`, `superseded`, `expired`, `deleted`, `completed` |

An accepted or successfully edited item becomes `applied`; there is no persisted `accepted` or `edited` item status. A rejected item never mutates profile data.

## Retention, redaction, deletion, and audit rules

| Data class | Storage and retention | Deletion behavior |
|---|---|---|
| Original binary file | Never persisted | Nothing to delete from persistent storage. |
| Extracted text, full excerpts, provider response JSON, classification rationale, pending current/proposed values | Only after storage consent; maximum 30 days | Immediately purge on student deletion request or scheduled expiry. A deleted/expired review cannot be approved. |
| Duplicate fingerprint | Per-student server-keyed HMAC only while review data is retained | Purge with review data; never retain a globally reusable document hash. |
| Approved profile fact | Existing `Student`/`StudentSkill`/`Evidence` authoritative records | Remains subject to normal profile and institutional retention policy; document deletion does not promise removal of an approved fact. |
| Approved evidence | Minimal summary and `dil:{document_id}:{proposal_item_id}` provenance reference; no full excerpt | Remains as the source link for an approved fact under existing profile retention. |
| Audit event | Immutable minimal record: actor, action, opaque provenance ID, schema/policy version, timestamps, idempotency key, and keyed before/after/evidence commitments | Not deleted with source review data. It contains no raw text, excerpt, filename, current/proposed value, or provider output. Retention duration requires deployment/legal approval. |

Redaction before Gemini is best effort and is not an anonymization guarantee. User-facing consent must state this clearly.

## Database migration strategy

1. Add Alembic configuration and an initial DIL revision that **only creates new DIL tables and indexes**. It does not alter, rebuild, or drop existing SkillUp tables.
2. For an existing populated SQLite database, stop the backend, create a timestamped access-controlled backup with checksum, and run `alembic current` / `alembic upgrade head` on a copy before the real database.
3. On the migrated copy, run `PRAGMA integrity_check`, foreign-key checks, existing-table row-count comparisons, DIL migration tests, and the complete backend regression suite.
4. Promote during a maintenance window only after verification; record source and target Alembic revisions.
5. Production rollback is restoration of the verified pre-migration SQLite backup after stopping the service. Do not rely on SQLite DDL downgrade as a production data rollback path. Alembic downgrade is limited to test/staging validation unless separately approved.

## API and approval guarantees

- New DIL routes are private and derive the student identity exclusively from the current authenticated principal; they do not accept a client-supplied student ID.
- Existing API routes/contracts remain unchanged. DIL adds routes rather than modifying Journey, Resume, LinkedIn, roadmap, or placement request/response formats.
- Stored proposal data is a review snapshot, not a profile write. Before applying a request, the server revalidates ownership, retention state, source excerpt, field allow-list, proposal/item versions, idempotency, and current profile fingerprint.
- A stale/conflicting action returns a safe `409` workflow response and applies nothing. Retrying the same idempotency key returns the original outcome; a new key cannot reapply a final item.
- One transaction performs the approved field update, minimal Evidence/competency attachment, and immutable minimal audit event. Any validation or persistence failure rolls back the entire action.

## Implementation batch sequence

1. Guardrails, Alembic setup, and additive DIL persistence migration.
2. Safe parser reuse, deterministic classification, short-lived review data, type correction, provenance, and proposal comparison.
3. Individual approval transaction, conflicts, idempotency, minimal audit, expiry/deletion jobs, and full backend regression coverage.
4. Optional consent-gated Gemini extraction with mocked safe-failure tests.
5. Student Profile review UI, accessibility, mobile behavior, and session restoration tests.
6. User-initiated readiness/roadmap refresh guidance and privacy-safe observability.

## Remaining deployment approval questions

1. Legal/records-retention duration and access policy for minimal immutable audit records.
2. Consent copy, including the Gemini provider/data-processing notice and the fact that redaction is not anonymity.
3. Security ownership/rotation policy for the server key used in per-student HMAC duplicate fingerprints and audit commitments.
4. Backup encryption, access control, retention, and secure disposal policy for SQLite backups created during migration.
5. Incident-response procedure if extracted review text or a migration backup is exposed.
6. Whether a future institutional policy may permit verified transcript fields; this is expressly out of scope for v1.
