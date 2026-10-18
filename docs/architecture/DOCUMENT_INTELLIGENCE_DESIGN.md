# Document Intelligence Layer — Architecture Design

## Scope and repository evidence

This design introduces a **student-owned, review-first Document Intelligence Layer (DIL)**. It turns a supported uploaded document into bounded text, an optionally Gemini-assisted structured extraction, and individual proposed profile changes. It does not write an LLM response into `students`, `student_skills`, `evidence`, a roadmap, or a resume revision without a separate student approval request.

The current codebase already supplies important building blocks:

| Existing component | Evidence | Reuse in DIL |
|---|---|---|
| Safe text parsing | `backend/app/services/resume_files.py` | Generalize its request-only TXT/DOCX/text-PDF parser; preserve its 1 MiB, 30-page, ZIP/XML, decompression, Unicode, and text-length limits. |
| Journey preview/save | `backend/app/routes/workspace.py`, `services/journey_input.py` | Keep its current PDF/DOCX profile flow intact. DIL becomes a separate, generalized path rather than changing the current contract. |
| Evidence/competencies | `models.py`: `Evidence`, `StudentSkill`; `services/analysis.py` | Create `Evidence` only for approved facts and attach evidence IDs to explicitly supported skills. Unknown proficiency remains `NULL`. |
| Existing source-preserving extraction | `services/candidate_profile.py` | Reuse its section parsing, skill normalization, source labels, excerpt handling, and conservative approach as deterministic pre-processing/fallback. Its computed result is not currently persisted. |
| Gemini safety pattern | `services/gemini_resume.py`, `services/gemini_roadmap.py` | Reuse consent gating, contact redaction, structured JSON response, strict Pydantic validation, timeouts, quota/error mapping, and fail-closed behavior. |
| Ownership and concurrency | `auth.py`, `routes/workspace.py` | Reuse student-only owner dependency and version conflict conventions. Faculty must not obtain DIL documents or proposals through existing scoped placement endpoints. |
| Derived results | `services/analysis.py`, `services/learning.py` | Recalculate/read current profile and readiness after approval. Preserve existing resume revisions, analyses, roadmap progress, and legacy task APIs. |

Current limitations that shape this proposal:

- `parse_resume` supports TXT, DOCX, and text-selectable PDF; scanned PDFs/OCR, images, XLSX, and binary certificate formats are unsupported. `journey_input.parse` deliberately restricts its UI to PDF/DOCX.
- `Evidence` contains a summary, type, reference, and confidence but cannot identify a document/page/excerpt or whether a fact was accepted versus inferred.
- `CandidateExtractionOut` is a computed view for saved resume/LinkedIn text, not a student-approved profile-update workflow.
- Gemini structured output is currently used for resume feedback/rewrites and roadmap narrative only; it must not be repurposed into direct persistence.
- The SQLite schema is initialized with `create_all`; a production-safe rollout needs a real migration path or an explicitly documented schema migration procedure before deployment.

## Target architecture

```text
student upload + consent
       |
       v
Upload Gate (type/signature/size/text bounds, no retention by default)
       |
       v
Document classifier ──> unknown/unsupported (no extraction proposal)
       |
       +--> deterministic section/skill/excerpt extraction
       |
       +--> optional Gemini structured extraction (only after separate AI consent)
                         |
                         v
              Pydantic validation + excerpt-to-source verification
                         |
                         v
             Diff/conflict/duplicate engine (server controlled)
                         |
                         v
              persisted immutable proposal + review UI
                         |
                         v
     per-item accept/edit/reject (idempotency key + optimistic version)
                         |
                         v
   server validation -> profile/evidence/skills transaction -> derived refresh
```

### Responsibilities

1. **Upload Gate** accepts only `pdf`, `docx`, or `txt`, validates extension, MIME and file signature through the existing parser, and discards bytes after text extraction. A future document-specific limit may be lower than the global 1 MiB limit, never higher without security review.
2. **Classification** returns `resume`, `certificate`, `transcript`, `project_report`, `internship_document`, or `unknown`. It is advisory metadata. An unknown document may show the extracted text and receive no automatic fact proposal; it must not be silently treated as a resume.
3. **Extraction** combines deterministic findings with an optional, redacted Gemini structured response. The model receives untrusted document text as data and is asked only to cite excerpts that occur in that text. The server rejects entries whose excerpts cannot be uniquely located.
4. **Comparison** normalizes names, skills, URLs and scalar values; it compares them with the live student record, skills, and DIL-approved evidence. It assigns exactly one comparison status: `new`, `no_change`, `duplicate`, `conflict`, `unsupported`, or `withheld`; the separate operation is `add`, `update`, or `attach_evidence`.
5. **Proposal workflow** stores a review snapshot, not a mutation. The UI displays explicit facts, evidence excerpts, suggested/inferred items, conflicts, and the current value side by side.
6. **Approval service** applies a single current proposal item once, inside one transaction. It rechecks ownership, proposal/document state, expected current value/version, current evidence, allowed field policy, and the edited value. It records an immutable audit event and source provenance.
7. **Derived refresh** invalidates source-dependent resume analysis only where present behavior requires it, recomputes deterministic readiness on read, and exposes a `refresh_recommended` result. It must not reset roadmap item progress or regenerate an AI roadmap automatically.

## Supported document policy

| Kind | Extraction allowed | Automatic proposal policy |
|---|---|---|
| Resume | contact-independent identity/profile text, skills, projects, experience wording | explicit details/skills only; never rewrite resume or infer level |
| Certificate | title, issuer, issue/expiry date, certificate ID only if explicit | evidence and optional skill association; no academic/proficiency assertion |
| Transcript | institution/program/term/course text only if explicit | may create source-only review context; GPA, grades, academic honors, academic achievements, and degree-result updates are excluded in v1 |
| Project report | project title, tools, explicit responsibilities/outcomes | project evidence and skill evidence only; preserve contribution language |
| Internship document | organization, role, dates, explicitly stated responsibilities | experience/evidence proposals only; no duration or achievement inference |
| Unknown/unsupported | classification, extracted text metadata | no profile update proposals until user classifies it or a supported classifier is added |

## Privacy and security design

- Require `storage_consent` before a review artifact is created, and a separate `ai_consent` immediately before transmitting sanitized text to Gemini. Declining AI still permits deterministic extraction where supported.
- Never persist original binary files. Without storage consent, parsing/extraction is request-only and no later review or approval is possible. With storage consent, retain review text, full excerpts, raw validated extraction JSON, proposal current/proposed values, and classification rationale for at most 30 days; the expiry is set when the review is created and is never extended automatically.
- On expiry or student deletion of an unapproved review, purge review text, full excerpts, provider response JSON, proposed/current values, and per-document duplicate digest. Store only minimal operational deletion metadata where legally required. On approval, the normal profile/Evidence records remain because the student requested the update; raw review text and full excerpts still expire no later than 30 days. An immutable audit record retains no raw text, full excerpt, filename, current/proposed value, or provider output—only opaque provenance IDs, policy/schema versions, timestamps, action, actor, and keyed integrity commitments. This is an audit trail, not a promise of complete erasure of approved facts or legally required audit records.
- Use a per-student, server-keyed HMAC duplicate fingerprint while a review is retained; do not keep a globally reusable SHA-256 fingerprint after expiry/deletion. Audit entries reference a random provenance identifier and keyed commitments rather than a recoverable document hash.
- Redact contacts and URLs before Gemini using and strengthening `gemini_resume.redact_contacts`; explicitly disclose that redaction is best effort, not anonymization.
- Treat all document text, OCR-like strings, filenames, and provider output as untrusted. System prompts prohibit instruction following from source data; provider tools, URLs, and function calls stay disabled; output must match a server-owned JSON schema.
- Use strict Pydantic (`extra='forbid'`), field limits, source-excerpt verification, allowed source/field enums, response size caps, provider timeout, one provider attempt, and generic errors that do not echo file/provider contents.
- Use `current_principal` plus a student-only owner dependency for every document/proposal operation. No faculty route returns raw DIL text, proposal items, or provenance. Existing placement review sharing remains independent.
- Enforce idempotency keys for approval, optimistic proposal versioning, and conflict checks against the *current* record. A stale approval returns `409` with reload guidance and never applies partially.

## Required data model additions (future implementation)

The following tables are required; JSON alone would not provide the queryability, ownership controls, idempotency, and immutable audit history required by this feature.

| Table | Core fields | Purpose |
|---|---|---|
| `document_intelligence_documents` | `id`, `student_pk`, `duplicate_fingerprint`, `filename`, `mime_type`, `byte_size`, `document_type`, `classification_status`, `text`, `parse_status`, `storage_consent_at`, `expires_at`, timestamps | Student-owned source artifact and parsing boundary. The per-student keyed duplicate fingerprint exists only until expiry/deletion. |
| `document_extractions` | `id`, `document_id`, `engine`, `model`, `schema_version`, `status`, `result_json`, `created_at`, `expires_at` | Validated extraction attempt; its provider result is purged with review data and is never a direct profile source of truth. |
| `profile_update_proposals` | `id`, `student_pk`, `document_id`, `extraction_id`, `status`, `profile_fingerprint`, `version`, timestamps | Review session keyed to the profile state used for comparison. |
| `profile_update_proposal_items` | `id`, `proposal_id`, `field_path`, `operation`, `current_value_json`, `proposed_value_json`, `evidence_json`, `fact_kind`, `comparison_status`, `decision`, `applied_at`, `applied_value_json`, `version` | One decision per safe field-level change. |
| `profile_update_audit` | `id`, `student_pk`, `proposal_item_id`, `actor_account_id`, `action`, `provenance_id`, `before_commitment`, `after_commitment`, `evidence_commitment`, `schema_version`, `idempotency_key`, `created_at` | Immutable minimal approval/rejection/edit audit trail. It contains integrity commitments, not raw source text, excerpts, or profile values; unique `(actor_account_id, idempotency_key)`. |

Existing `Evidence` and `StudentSkill` remain authoritative for approved profile evidence and competencies. Extend `Evidence.source_type` policy in application code with `document_intelligence` and set `source_ref` to a stable `dil:{document_id}:{proposal_item_id}` reference. Do not overload resume workspaces or LinkedIn profiles to store arbitrary documents.

## Route/UI proposal (future contract)

New private student routes, all under `/api/documents`:

- `POST /api/documents/preview`: parse/classify and produce deterministic preview; file bytes are not retained.
- `POST /api/documents`: create a reviewable document/proposal after `storage_consent`.
- `POST /api/documents/{id}/extract`: requires `ai_consent`; returns a new validated extraction/proposal revision.
- `PATCH /api/documents/{id}/type`: accepts only a supported document type or `unknown`; it records the student's correction and re-runs deterministic extraction/comparison. A re-extraction that needs Gemini requires a fresh explicit `ai_consent`; no stored AI result is relabelled as a new type.
- `GET /api/documents`, `GET /api/documents/{id}`, `GET /api/profile-update-proposals/{id}`: owner-only summaries/detail.
- `PATCH /api/profile-update-proposals/{id}/items/{item_id}`: submit `accept`, `edit`, or `reject`, with proposal/item version and idempotency key; a valid accept/edit transaction results in persisted `applied`, while reject results in `rejected`.
- `POST /api/profile-update-proposals/{id}/refresh`: recompute comparison against current profile; does not call Gemini.
- `DELETE /api/documents/{id}`: owner-only review-data deletion. It purges retained review data immediately, blocks future approvals, and leaves only approved profile/Evidence records plus the minimal non-content audit record described above.

Student UI location: **My Career Plan → Profile**. Add a “Documents to review” card below the existing Journey input flow. It must show a document kind selector/auto-classification, local parsing notice, separate Gemini consent control, a review list with current/proposed values and evidence excerpts, and a final refresh notice. Resume Analyzer and LinkedIn Analyzer retain their current dedicated upload/analyze/revision workflows; they may link to this card but are not migrated in the first release.

## Derived-data behavior

On approved changes, call existing `get_profile` and deterministic `score_role` / analysis paths on demand. If there is an existing selected role/latest analysis, mark the proposal response `readiness_refresh_recommended=true` and offer the existing Alignment/Roadmap actions. Do not alter role selection, create a Job, regenerate deterministic roadmap items, invoke Gemini roadmap generation, or change legacy `RoadmapTask` records automatically. This avoids loss of roadmap progress and preserves user intent.

## Approved v1 boundaries

- DIL is student-owned and student-only. Faculty cannot access DIL documents, text, proposals, consent state, or audit content.
- Student-corrected document type is accepted only from the documented enum and creates a non-content audit action; it always invalidates the prior comparison. It re-runs deterministic extraction/comparison and requires fresh AI consent for a new Gemini extraction.
- GPA, grades, academic honors, inferred proficiency, inferred achievements, and degree-result updates are excluded from profile mutation in v1, even when explicit text exists.
- Alembic is required for versioned migrations. Existing SQLite data is upgraded only through a tested backup-first migration process described in `DOCUMENT_INTELLIGENCE_IMPLEMENTATION_PLAN.md`.
