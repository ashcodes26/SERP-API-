# Gemini AI Integration Map

## Audit boundary

This map is based on the current repository, the approved Document Intelligence documents, and the existing Stage 2–3 audit/implementation reports under `docs/audit/`. It is a planning artifact only: no current API, schema, route, or UI behavior is changed by this document.

## Existing capabilities to preserve

| Product capability | Current implementation | State | Integration decision |
|---|---|---|---|
| Secure Gemini configuration | `backend/app/config.py` (`GEMINI_API_KEY`, `GEMINI_MODEL`, timeout); `google-genai>=2.29,<3` in `backend/requirements.txt` | Implemented | Keep backend-only `SecretStr` configuration. The configured model string is currently `gemini-3.5-flash-lite`; availability must be verified per key at runtime before use. |
| Provider invocation | `services/gemini_resume.py:request_structured` | Implemented | Extract into a narrow internal transport/adapter without changing existing callers initially. It already uses `google-genai`, structured JSON schema, bounded timeout, one SDK attempt, low temperature, and no provider error echo. |
| Resume feedback | `gemini_resume.review`, `/api/resumes/{id}/analyze` | Implemented | Preserve consent, redaction, source excerpts, strict Pydantic output, factual rewrite validation, apply/undo/reject, revision/version/export behavior. Adapt behind the shared transport; do not replace with generic DIL extraction. |
| AI roadmap narrative | `gemini_roadmap.generate`, `/api/roadmap/{student_id}/analysis/{analysis_id}/ai` | Implemented | Preserve explicit consent and deterministic gaps as input. Add cache/throttle only through a compatible adapter; never auto-regenerate or reset deterministic roadmap progress. |
| Document parsing | `services/resume_files.py`; Journey `services/journey_input.py`; Resume/LinkedIn uploads in `routes/workspace.py` | Implemented | Reuse bounded TXT/DOCX/text-PDF parsing. DIL adds separate student review/provenance persistence; it does not store original binary files or replace existing uploads. |
| Deterministic profile extraction | `services/candidate_profile.py` | Implemented | Reuse sections, conservative claims, URLs, and normalization as DIL deterministic baseline/fallback. Existing output is derived and not an approval workflow. |
| Evidence and skills | `models.Evidence`, `models.StudentSkill`, `services/analysis.py`, `services/intelligence.py` | Implemented | Remain authoritative. DIL only creates approved minimal evidence and skills at `level=NULL`; no AI-derived proficiency. |
| Readiness/gap scoring | `services/intelligence.score_role`, `analysis.py`, Journey `/` | Implemented | Remain deterministic. AI can explain saved results but must never recalculate score or claim hiring likelihood. |
| Role/roadmap progress | `models.Analysis`, `RoadmapItem`, `services/learning.py` | Implemented | DIL returns user-initiated refresh guidance only; no role changes, automatic roadmap regeneration, or progress reset. |
| LinkedIn analysis | `linkedin_insights.py`, `linkedin_public.py`, `routes/workspace.py` | Implemented, deterministic | Keep dedicated page/fallbacks and public-search limitations. A later optional AI explanation may be added only as a distinct, evidence-grounded task; it must not merge with Resume Analyzer. |
| Jobs and matching | `job_discovery.py`, `routes/jobs.py`, `market.py` | Implemented, deterministic/SerpApi | SerpApi/stored listings remain source of truth. Existing dictionary requirement extraction and deterministic matching remain authoritative. AI may summarize/explain existing listing and match output only. |
| Authentication/ownership | `auth.py`, workspace `owner()`, `allow_student()` | Implemented | New DIL/AI routes derive identity from the principal and remain student-only. Faculty receives no DIL data. |
| Existing QA foundation | Backend Gemini tests; Stage 3 frontend tests and lint/typecheck reports | Implemented | Extend targeted regression coverage; retain existing tests and route/deep-link behavior. |

## Genuine gaps requiring new work

| Gap | Why existing code is insufficient | Required addition | Prerequisite |
|---|---|---|---|
| Central AI task policy | Resume and roadmap share low-level request code but own task/error rules; no common task registry | Internal Gemini gateway with task definitions, policy metadata, common bounded transport, safe status taxonomy, diagnostics, throttling, and cache interface | Model/key verification, no contract breakage |
| Per-user/task throttle | Current provider calls are serialized only for resume analysis; no durable user/task quota guard | Owner-scoped throttle records or a bounded database-backed limiter | New persistence/migration policy |
| Owner-isolated AI cache | Job search has a separate cache; Gemini results have no cache | Cache table keyed by owner, task, model, prompt/schema versions, normalized input/context digests, expiry; no raw documents in generic cache | DIL retention rules |
| DIL review/approval | Journey previews/saves a limited PDF/DOCX profile result; Resume/LinkedIn do not support proposed field review | Approved additive DIL tables/APIs, review UI, source verification, conflict/idempotency/audit workflow | Alembic and final DIL approval |
| Grounded readiness explanation | Current readiness is deterministic and UI-readable; no AI explanation task | Optional consented explanation task using persisted approved facts and analysis snapshot only | Gateway; deterministic result snapshot |
| LinkedIn AI optimization | Current `linkedin_insights` is rule-based and correct about partial sources | Optional separate task that uses saved/confirmed text and explicit source excerpts; preserve fallback behavior | Gateway; specific UX approval |
| Job explanation | Existing job extraction/matching is deterministic; no AI interpretation | Listing-version and student-evidence-version scoped explanatory task; never alters listings/match score | Gateway/cache isolation |

## Canonical AI task inventory

| Task ID | Inputs | Consent | Output purpose | Source of truth / mutation rule |
|---|---|---|---|---|
| `resume_review_v1` | saved resume + user-selected job description | Existing resume AI consent | editorial feedback/rewrite candidates | Existing ResumeWorkspace flow only; no direct profile update |
| `roadmap_narrative_v1` | persisted deterministic analysis + optional goal text | Existing roadmap consent | optional phases/summary | Existing roadmap endpoint; no automatic state change |
| `document_extraction_v1` | retained DIL text + selected type | New separate DIL AI consent | source-cited candidates | Proposal only; individual approval required |
| `readiness_explanation_v1` | approved profile evidence + deterministic analysis snapshot | New explicit consent | explain gaps/priorities | Read-only explanation; deterministic score remains authoritative |
| `linkedin_optimization_v1` | confirmed saved LinkedIn text + approved profile evidence + role context | New explicit consent | suggestions with source excerpts | Read-only; no profile/resume mutation |
| `job_match_explanation_v1` | retrieved listing version + deterministic match + approved profile snapshot | New explicit consent | explain documented matches/gaps/preparation | Read-only; SerpApi listing and deterministic score remain authoritative |

`document_extraction_v1` is the only task that can eventually contribute to a profile update, and it does so only through the separately approved DIL proposal/approval transaction. No AI task may write directly to `Student`, `Evidence`, `StudentSkill`, `Analysis`, `RoadmapItem`, placement data, or resume revisions.

## Compatibility adapters

The first implementation batch should introduce an internal adapter boundary, not a caller rewrite:

```text
gemini_resume.review ─┐
gemini_roadmap.generate ─┼─> ai_gateway.invoke(task, owner, normalized_input, context)
new DIL task ───────────┘
```

Adapters keep current request/response schemas and status messages stable. The gateway owns only transport-adjacent concerns (model selection, request bounds, one attempt, provider classification, rate limit, cache lookup/store, privacy-safe diagnostics). Each task continues to own its Pydantic model, system prompt, source-verification logic, and domain-specific fail-closed policy.

## Non-duplication boundaries

- Do not replace `candidate_profile.extract_profile` with Gemini; deterministic extraction remains the baseline and unavailable-provider fallback.
- Do not move factual resume rewrite checks into DIL or allow DIL to edit `ResumeWorkspace`.
- Do not replace `extract_requirements`, `match_job`, SerpApi search/cache, or `score_role` with LLM output.
- Do not create another dashboard route; enrich the existing Journey route with optional read-only AI explanations only after the core DIL approval flow.
- Do not expose DIL records to the faculty/admin placement workspace.
