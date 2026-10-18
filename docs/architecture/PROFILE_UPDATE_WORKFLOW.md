# Document Intelligence — Student Profile Update Workflow

## User journey

### 1. Select and preview

In **My Career Plan → Profile**, the student chooses “Review another document.” The UI accepts PDF/DOCX/TXT within the existing parser limits and describes supported document kinds. It immediately labels a scanned PDF as needing selectable text; it does not claim OCR.

The preview shows:

- sanitized filename, parsed text status, detected/selected document kind, and privacy/retention summary;
- deterministic findings and a clear `explicitly found` label;
- an `Unknown/unsupported` state with no profile actions;
- a separate optional Gemini consent control with the exact data purpose and best-effort redaction notice.

Existing Journey PDF/DOCX upload remains available as-is. Resume Analyzer continues to store/revise resumes under `ResumeWorkspace`; LinkedIn continues to use its own consent and public-search review mechanics. The new entry point never merges or deletes those records.

### 2. Extract and compare

Without AI consent, DIL builds a deterministic review using parsed sections, explicit named skills, URLs, and literal text. With AI consent, it requests one bounded structured Gemini response and then validates it locally. In either case, the comparison service runs against the latest profile before the review is shown.

The review is grouped into:

1. **Ready to add** — explicit, non-conflicting facts.
2. **Already recorded** — duplicate/no-op facts, optionally useful as new provenance.
3. **Needs your decision** — scalar conflicts, with current value, proposed value, literal excerpt, and document source.
4. **Suggestions, not facts** — inferred ideas that cannot update the profile automatically.
5. **Withheld** — source missing/ambiguous/out-of-policy; shown only as a privacy-safe explanatory count/message where appropriate.

Each item has Accept, Edit, Reject, and “Why?” controls. A student sees that accepting a skill adds evidence with unknown proficiency; no control implies skill level, grade, or employment outcome.

### 3. Decide safely

On Accept/Edit/Reject, the client supplies proposal and item versions plus a UUID idempotency key. `accept`, `edit`, and `reject` are actions; persisted outcomes are `applied`, `rejected`, `stale`, `expired`, or `deleted`. The API performs a single transactional request:

```text
authenticate -> student ownership -> find pending item -> check versions/idempotency
 -> re-verify source excerpt -> validate edited field type -> compare live profile
 -> apply one safe update + minimal evidence link -> immutable non-content audit event -> commit
```

If the profile changed after preview, a stale/specific conflict state is returned. The client never retries a mutation with a newly generated key automatically; it reloads/reconciles first. An already-applied action is returned idempotently.

### 4. Update/refresh behavior

After a successful approval, return the updated `ProfileOut`, item status, audit timestamp, and whether deterministic alignment/roadmap refresh is useful. The Profile screen can offer “Review updated role alignment” and “Refresh learning roadmap” using the existing Journey actions.

The system must not automatically:

- change the selected role or role requirements;
- invoke Gemini roadmap generation;
- replace resume originals/revisions, LinkedIn data, or faculty-review snapshots;
- replace/downgrade competency levels;
- delete roadmap milestones or legacy to-do tasks;
- expose document data to faculty.

### 5. Correct type, delete, and retain data

Before approving an item, the student may correct document type to `resume`, `certificate`, `transcript`, `project_report`, `internship_document`, or `unknown`. This marks existing pending items stale and runs deterministic extraction/comparison again. If the correction needs a Gemini extraction, the student must give fresh AI consent; an earlier AI output is never silently reclassified.

The document list shows expiry and delete actions. Original binary uploads are never stored. With storage consent, extracted review text, full excerpts, extraction output, and pending current/proposed values exist for a maximum of 30 days. On expiry or delete before approval, that review data is purged and cannot be approved. On delete after approval, the same source-review data is purged; the approved normal profile/Evidence record and a minimal immutable audit record remain. The audit record contains opaque provenance IDs and keyed commitments, not raw text, excerpt, filename, or values. The UI explains that deletion cannot erase an approved fact or legally necessary audit record.

## State machine

```text
upload_received
  -> parsed | parse_failed | unsupported
parsed
  -> previewed
previewed
  -> stored_for_review (storage consent; expires in 30 days)
  -> discarded
stored_for_review
  -> deterministic_compared
  -> ai_requested (AI consent)
ai_requested
  -> extracted | extraction_timeout | extraction_unavailable | extraction_invalid
deterministic_compared/extracted
  -> ready_for_review
ready_for_review
  -> accept/edit -> applied | stale
  -> reject -> rejected
  -> type_corrected -> superseded -> ready_for_review
  -> expires -> expired
stored_for_review/ready_for_review/applied/rejected
  -> delete -> deleted (review data purged)
applied/rejected
  -> minimal audit recorded
```

Only `applied` changes existing profile data. Provider failures preserve the deterministic preview and leave all profile data untouched. An `unknown` document, a `withheld` item, or an excluded academic/proficiency field cannot become `applied`.

## Authorization matrix

| Actor | Allowed | Disallowed |
|---|---|---|
| Authenticated student | Own preview, own documents/proposals, own item decisions/deletion | Any other student; faculty/admin documents; bulk mutation |
| Faculty/admin | Existing aggregate/scoped placement records only | All DIL records and derivatives: raw text, document metadata, proposals, consent state, approvals, audit content, and document download |
| Unauthenticated/expired session | Nothing | All DIL routes |
| Gemini/provider | Receives only consented/redacted bounded text + server-built prompt | Credentials, database access, tool access, document URL, write authority |

The implementation uses the current `owner()` style dependency for every DIL route. It must not use a caller-supplied student ID. V1 has no faculty DIL workflow or request object.

## UI accessibility and recovery requirements

- Native labels for document kind, consent, status, action, source excerpt, conflict choice, and retained/deleted state.
- Keyboard focus moves to the result/error heading; `accessibilityLiveRegion="polite"` announces parse/extraction/approval outcomes without reading document text.
- Buttons are disabled only while the exact item action is pending; other items remain reviewable.
- Status text uses words and icons rather than color alone; excerpts are selectable and limited in visual length with a labelled expand control.
- Empty state: no documents reviewed yet; link to supported formats and privacy notice.
- Retry is manual for timeout/quota/unavailable AI and reuses stored source text only if retention/consent is valid.

## Existing feature preservation map

| Existing workflow | Preservation requirement |
|---|---|
| Journey input preview/save | Do not change `/api/journey/input/*`; optionally offer DIL link after existing save in a later UI phase. |
| Resume upload/revisions | Do not reclassify a `ResumeWorkspace` as a DIL document or alter its `version`, `analysis`, or `decisions`. |
| Resume Gemini analysis | Retain `ai_consent`, rewrite validation, source redaction and factual-edit guard. DIL extraction uses separate schemas/statuses. |
| LinkedIn saved/public/OIDC flows | Preserve `confirmed`, lookup review, and consent semantics. Do not use public search snippets as DIL evidence without the current review gate. |
| Deterministic role gaps | Continue to use `StudentSkill.level is NULL` as unknown and existing evidence IDs; no model-derived proficiency. |
| Roadmap/placement | Keep current ownership, status, eligibility, and faculty scope logic; refresh only through existing safe routes/actions. |
