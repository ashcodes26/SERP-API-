# Gemini Batch 1 — Centralized Gateway Implementation

## Implemented

- Added `backend/app/services/ai_gateway.py`, a backend-only shared structured Gemini transport.
- Added task metadata and bounded input/output limits for existing resume review, rewrite verification, and roadmap narrative tasks.
- Centralized one-attempt SDK invocation, JSON structured-output configuration, provider-error classification, strict response-validation helper, and privacy-safe in-process owner/task throttling support.
- Kept `gemini_resume.request_structured` as the compatibility seam used by existing resume tests/callers; it now delegates to the gateway.
- Kept `gemini_roadmap.request_structured` as a compatibility seam and delegated it to the gateway.
- Added `GEMINI_TASK_LIMIT_PER_HOUR` configuration with a conservative default of five requests per owner/task/hour for new owner-aware callers.

## Preserved behavior

- Existing resume consent, redaction, prompt, Pydantic response validation, factual rewrite checks, and API responses remain domain-owned in `gemini_resume.py`.
- Existing roadmap consent, schema, status responses, deterministic-gap input, and API responses remain domain-owned in `gemini_roadmap.py`.
- No frontend code, public route, database schema, or external provider credential was changed.
- Legacy compatibility callers do not provide an owner ID yet; their throttling/cache migration is intentionally deferred until owner-scoped persistence is added in Batch 2.

## Files changed

- `backend/app/services/ai_gateway.py`
- `backend/app/services/gemini_resume.py`
- `backend/app/services/gemini_roadmap.py`
- `backend/app/config.py`
- `backend/tests/test_ai_gateway.py`

## Verification

Command run:

```powershell
$env:APP_ENV='test'; .\.venv\Scripts\python.exe -m pytest -q tests/test_ai_gateway.py tests/test_gemini_resume.py tests/test_gemini_roadmap.py
```

Result: **59 passed**. One pre-existing Starlette/httpx deprecation warning was reported.

## Remaining work / risks

- No real Gemini key/model capability check was run; this remains intentionally unverified.
- Cache persistence and durable cross-process throttling require additive database tables and Alembic migration work in Batch 2.
- No provider payload or user document content is logged by the gateway; diagnostics persistence is deferred with the same migration-dependent work.
