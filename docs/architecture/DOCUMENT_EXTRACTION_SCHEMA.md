# Document Intelligence — Extraction and Proposal Schema

## Schema principles

The provider schema is intentionally narrower than the internal domain. Gemini may return only source-supported candidates; the FastAPI service validates, verifies, normalizes, compares, and decides whether an item becomes a reviewable proposal. No confidence value authorizes a write. `explicit` means the literal text supports the fact; `inferred_suggestion` is never an auto-applicable profile fact.

The implementation must define these models in `backend/app/schemas.py` with `ConfigDict(extra='forbid', strict=True, str_strip_whitespace=True)` and bounded field sizes. Equivalent TypeScript contracts belong in `mobile/src/types/contracts.ts` only after API approval.

## External structured extraction response

```json
{
  "schema_version": "document-extraction-v1",
  "document_type": "resume",
  "classification": {"status": "classified", "confidence": 0.0, "rationale": "short bounded explanation"},
  "facts": [
    {
      "id": "fact-001",
      "field": "skills",
      "value": {"name": "Python"},
      "fact_kind": "explicit",
      "evidence": [{"excerpt": "Python, SQL", "page": null, "section": "Skills"}],
      "confidence": 0.0
    }
  ],
  "suggestions": [
    {
      "id": "suggestion-001",
      "field": "skills",
      "value": {"name": "Data analysis"},
      "reason": "The project describes analysis work but does not name the skill.",
      "evidence": [{"excerpt": "...", "page": null, "section": "Projects"}]
    }
  ],
  "warnings": ["Text-only limitation"]
}
```

Provider constraints:

- `document_type`: `resume | certificate | transcript | project_report | internship_document | unknown`.
- Classification status: `classified | uncertain | unsupported`; `unknown`/`unsupported` produces no auto-applicable facts.
- At most 100 facts, 25 suggestions, 5 evidence excerpts per entry; excerpts 1–600 characters; no contacts, raw full-document echoes, or provider instructions.
- Allowed explicit field values are `name`, `department`, `program`, `specialization`, `semester`, `graduation_year`, `skills`, `projects`, `experience`, `certifications`, `portfolio_urls`, `github_urls`, `linkedin_urls`, and document evidence metadata. `cgpa`, grades, academic honors, degree results, inferred proficiency, and inferred achievements are **not provider-writable fields** in v1. Transcript material may be classified and reviewed but does not enable those excluded mutations.
- `level` is excluded. DIL never derives `StudentSkill.level`; it only creates an evidence-backed skill with `level=NULL` and conservative confidence.
- Suggestions are visible but remain `inferred_suggestion`; they cannot be approved as facts without an edited, server-valid value plus a matching explicit excerpt where policy permits it.

## Server-side models (representative)

```python
DocumentType = Literal['resume', 'certificate', 'transcript', 'project_report', 'internship_document', 'unknown']
FactKind = Literal['explicit', 'inferred_suggestion']
ProposalOperation = Literal['add', 'update', 'attach_evidence']
ComparisonStatus = Literal['new', 'no_change', 'duplicate', 'conflict', 'unsupported', 'withheld']
# `accept`, `edit`, and `reject` are request actions. Persisted item decision is one of:
ProposalDecision = Literal['pending', 'applied', 'rejected', 'stale', 'expired', 'deleted']

class SourceExcerpt(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True, str_strip_whitespace=True)
    excerpt: str = Field(min_length=1, max_length=600)
    page: int | None = Field(default=None, ge=1, le=30)
    section: str | None = Field(default=None, max_length=80)

class ExtractedFact(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True, str_strip_whitespace=True)
    id: str = Field(pattern=r'^fact-[A-Za-z0-9_-]{1,60}$')
    field: AllowedDocumentField
    value: dict[str, Any]  # parsed immediately into a field-specific discriminated model
    fact_kind: Literal['explicit']
    evidence: list[SourceExcerpt] = Field(min_length=1, max_length=5)
    confidence: float = Field(ge=0, le=1)

class ExtractionResult(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    schema_version: Literal['document-extraction-v1']
    document_type: DocumentType
    classification: Classification
    facts: list[ExtractedFact] = Field(max_length=100)
    suggestions: list[ExtractedSuggestion] = Field(max_length=25)
    warnings: list[str] = Field(max_length=20)
```

The actual model should use a discriminated union for `value` rather than accepting an arbitrary dictionary by the time data reaches comparison logic. Examples: `ScalarFieldValue(value: str)`, `SkillValue(name: str, category: str | None)`, `UrlValue(url: HttpUrl)`, and `ExperienceValue(title, organization, dates)`.

## Source-verification and normalization contract

Before a fact becomes a proposal item, the service must:

1. Verify every excerpt against the retained normalized source text using whitespace-tolerant matching; a purported exact fact without a located excerpt is `withheld`.
2. Confirm that field-specific values are represented by that excerpt. For skills, use the existing `normalize_skill`; do not accept a model-created synonym unless it maps to a known canonical skill and the evidence explicitly names it.
3. Strip/control bound text, canonicalize URLs using existing URL validators where applicable, and sanitize filename/metadata.
4. Deduplicate facts by normalized value + stable excerpt range + source digest.
5. Compare against current student data and `StudentSkill.evidence_ids`, not the profile state only at extraction time.
6. Produce a review-time evidence reference `{document_id, extraction_id, fact_id, excerpt, page, section}`. Full excerpts exist only while review data is retained. On approval, persist a minimal `Evidence` summary plus `dil:{document_id}:{proposal_item_id}` and a non-reversible provenance ID; audit records retain only keyed commitments, never an excerpt or a reusable document hash.

## Proposal schema returned to the UI

```json
{
  "id": 41,
  "status": "ready_for_review",
  "version": 3,
  "document": {"id": 10, "type": "certificate", "filename": "cloud-certificate.pdf"},
  "items": [
    {
      "id": 204,
      "field_path": "skills.Python",
      "operation": "attach_evidence",
      "fact_kind": "explicit",
      "comparison_status": "new",
      "current_value": null,
      "proposed_value": {"name": "Python", "level": null},
      "evidence": [{"excerpt": "Completed Python Fundamentals", "page": 1, "section": null}],
      "decision": "pending",
      "reason": "Explicit skill mention in uploaded certificate. Proficiency is not inferred.",
      "editable": true
    }
  ],
  "warnings": ["Document text was extracted; no OCR was used."],
  "refresh_recommended": false
}
```

`current_value`, `proposed_value`, and `applied_value` are JSON values stored with field-specific schemas only while the review is active. They are purged on review expiry/deletion unless the value has already become an approved normal profile record. The response never exposes other students' data, provider raw output, secrets, or raw files.

## Comparison and conflict rules

| Situation | Result | Approval behavior |
|---|---|---|
| Exact normalized value already present with same evidence fingerprint | `duplicate` | Mark/no-op; no duplicate evidence or skill link. |
| Exact current scalar value, new independent document evidence | `attach_evidence` / `no_change` | Student may attach provenance; scalar remains unchanged. |
| Empty allowed scalar field with explicit source value | `new` + `add` | Can be applied only after server validation following a student `accept` or `edit` action. |
| Current value differs from an explicit document value | `conflict` + `update` | Never automatic; UI shows both. Approval requires current-value fingerprint and explicit student choice. |
| Model proposes a stronger title/level/outcome than literal text | `withheld` | Cannot be approved. |
| New skill named explicitly | `new` + `attach_evidence` | Create/find canonical `Skill`, `StudentSkill(level=NULL)`, and evidence reference. |
| Same skill already exists | `no_change` / `attach_evidence` | Append evidence ID only once; do not modify level. |
| GPA, grade, academic honor, degree result, inferred proficiency, or inferred achievement | `unsupported` | Not proposed in v1, even if a model supplies it. |

## Approval request and idempotency

```json
{
  "proposal_version": 3,
  "item_version": 1,
  "decision": "edited",
  "edited_value": {"name": "Python"},
  "idempotency_key": "UUID generated per attempted action"
}
```

The server stores the idempotency key and a bounded, privacy-safe response reference. Repeating the same key returns the original result; a different key against an `applied`, `rejected`, `expired`, or `deleted` item is rejected as a no-op/conflict according to the requested action. Before an `accept` or `edit` action writes, the server rechecks owner, status, item/proposal version, document retention, field allow-list, source excerpt, live target fingerprint, and duplicate state. Rejections create a minimal immutable audit event but never alter profile data.

## Type correction and lifecycle vocabulary

- A student may correct `document_type` to a supported enum value or `unknown` before an item is applied. The API validates the enum, marks existing pending items `stale`, and creates a new comparison revision.
- `parse_status`: `parsed | parse_failed | unsupported`.
- `classification_status`: `classified | uncertain | unsupported | student_corrected`.
- `extraction_status`: `not_requested | available | unavailable | quota_limit | timeout | blocked | invalid_output`.
- `proposal_status`: `ready_for_review | superseded | expired | deleted | completed`.
- An `accept` or valid `edit` action results in `applied`; `reject` results in `rejected`. There is no persisted `accepted` or `edited` state.

## Validation/error vocabulary

Use contract-safe errors analogous to the current workspace routes: `DOCUMENT_TOO_LARGE`, `DOCUMENT_FORMAT_UNSUPPORTED`, `DOCUMENT_PARSE_FAILED`, `DOCUMENT_OCR_REQUIRED`, `DOCUMENT_UNSUPPORTED_TYPE`, `STORAGE_CONSENT_REQUIRED`, `AI_CONSENT_REQUIRED`, `EXTRACTION_UNAVAILABLE`, `EXTRACTION_TIMEOUT`, `EXTRACTION_INVALID_OUTPUT`, `PROPOSAL_NOT_FOUND`, `PROPOSAL_STALE`, `PROPOSAL_ITEM_NOT_FOUND`, `CONFLICT_REVIEW_REQUIRED`, `EVIDENCE_NOT_VERIFIED`, `IDEMPOTENCY_KEY_REUSED`, and `FORBIDDEN`. Do not echo uploaded text, LLM output, or provider exception strings.
