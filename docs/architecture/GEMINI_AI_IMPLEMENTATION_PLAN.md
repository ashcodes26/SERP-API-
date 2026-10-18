# Gemini AI Integration — Implementation Plan

## Delivery rule

Implement in dependency-ordered batches. Each batch is separately approved, tested, documented, and stopped before the next one begins. Existing public contracts are preserved; additions use new private routes/tables only where genuinely required.

## Batch 1 — Shared Gemini gateway foundation (P0)

**Objective:** introduce a private backend adapter that centralizes safe provider invocation while preserving the existing Resume and Roadmap API behavior.

**Changes:**

- Add task metadata (`task_id`, prompt/schema version, input/output caps, consent requirement, cache eligibility, timeout) and a gateway interface.
- Move/reuse only transport-safe logic from `gemini_resume.request_structured`: SDK client creation, JSON schema handoff, one provider attempt, bounded timeout, provider error classification, and privacy-safe diagnostic event generation.
- Keep `gemini_resume.review` and `gemini_roadmap.generate` as compatibility adapters with their existing domain schemas, source validation, and response status contracts.
- Add configuration validation for `GEMINI_API_KEY`, `GEMINI_MODEL`, timeout, task limits, and disabled/unavailable state. Never add a frontend public key.
- Add mock-only tests for consent, no configuration, blocked, malformed, timeout, quota, and unavailable model conditions.

**Affected future files:** `backend/app/services/ai_gateway.py`, task metadata module, `config.py`, selective adapters in `gemini_resume.py` and `gemini_roadmap.py`, tests; no mobile route change.

**Risks/dependencies:** model availability must be verified with the supplied key before enabling any task. No real provider call occurs in automated tests.

**Verify:** existing Gemini resume/roadmap tests remain green; identical mock responses preserve current API response schemas; provider errors expose no prompt, document text, or secret.

## Batch 2 — Owner-scoped throttle, cache, and diagnostics (P0)

**Objective:** protect a free-tier key and prevent cross-student reuse before adding more AI entry points.

**Changes:**

- Add Alembic-managed additive tables for owner/task request windows, safe AI cache metadata/results, and privacy-safe diagnostics.
- Throttle by authenticated account/student plus task. Return retryable quota/throttle status; never auto-retry.
- Cache only task outputs explicitly declared safe. Key = owner ID + task ID + normalized input digest + relevant context/version digest + model + prompt version + schema version. Never cache raw document text in a general-purpose cache.
- Expire/invalidate cache on source, analysis, listing, profile/evidence, model, prompt, or schema change as applicable.

**Dependencies:** Document Intelligence final approval and Alembic migration setup. Apply backup-first SQLite migration procedure from `DOCUMENT_INTELLIGENCE_FINAL_APPROVAL.md`.

**Verify:** same owner/same inputs cache hit; other student cannot read/reuse output; different model/schema/context misses cache; rate limits are deterministic; diagnostics contain no secret or source content.

## Batch 3 — Document Intelligence backend (P0)

**Objective:** implement the approved Resume/Certificate/Transcript/Project/Internship parse → compare → review → individual approval workflow.

**Changes:** follow the finalized DIL architecture exactly: additive persistence, no binary retention, 30-day review-data expiry, type correction, deterministic fallback, optional consented Gemini extraction, source excerpt verification, conflict checks, individual idempotent approvals, minimal immutable audit commitments, and deletion/purge jobs.

**Dependencies:** Batches 1–2, Alembic migration approval, synthetic fixture documents.

**Verify:** complete DIL architecture test matrix plus Journey/Resume/LinkedIn/role/roadmap regressions. No automatic readiness or roadmap change.

## Batch 4 — Student Profile DIL UI (P1)

**Objective:** integrate document review into the existing My Career Plan Profile stage without a new dashboard.

**Changes:** file preview, consent, classifier correction, source evidence, field-level conflict/review, individual actions, expiry/delete messaging, and refresh guidance. Reuse current Journey request-race/session protections.

**Dependencies:** Batch 3 API contracts.

**Verify:** browser/mobile accessibility and 360/768/1440 layouts; focus/live messages; request retry/stale/idempotency behavior; no navigation redesign.

## Batch 5 — Read-only intelligence explanations (P1)

**Objective:** add optional AI explanations where deterministic data already exists.

**Changes:** task-specific schemas/prompts/UI states for readiness explanation, LinkedIn optimization, and job match explanation. Each task uses approved persisted evidence/analysis/listing snapshots and displays source/limits. LinkedIn remains distinct from Resume; Jobs retains SerpApi/stored listing authority.

**Dependencies:** Batches 1–2; per-screen consent copy and UX approval.

**Verify:** source grounding/withholding tests, URL/public-lookup fallback, listing-version cache invalidation, readiness-score stability, and no fake jobs or hiring probability claims.

## Batch 6 — Roadmap intelligence enhancement (P1)

**Objective:** enhance the existing optional Gemini roadmap narrative only after DIL-approved data is available.

**Changes:** add approved competency/context versions to cache key and optionally expose user-controlled regeneration when inputs change. Preserve existing deterministic roadmap, HTML download, progress export, and saved progress.

**Dependencies:** Batches 1–2 and existing roadmap contracts.

**Verify:** consent/no-provider behavior; identical safe cache behavior; changed approved evidence invalidates context; no progress reset or automatic request after profile updates.

## Test and release gates

Every batch runs backend `pytest`, frontend tests, TypeScript checking, Expo lint, and supported web export. Added tests cover provider failure modes, prompt injection treated as data, Pydantic schema rejection, ownership, cache isolation, rate limit, stale/idempotent approvals, and relevant feature regressions. Browser/device checks use only synthetic data.

## Explicit exclusions

No Gemini task creates job listings, changes eligibility, calculates readiness, infers grades/proficiency/achievements, automatically applies profile data, accesses faculty data, or uses real quota during automated testing.
