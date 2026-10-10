# Job discovery enhancement handoff

## What changed

AIMORA now has an authenticated **Jobs & insights** screen alongside the existing evidence-to-assessment journey. Search by role, location, keywords, and entry-level/internship query terms. Results include provider descriptions, source links, retrieval timestamps, missing-field warnings, and explicit provenance. Filters improve the provider query; they do not certify eligibility or listing availability.

Select a retrieved job to compare it with the logged-in student's evidence using the existing `role-alignment-v1` analysis service. Skill requirements retain their source excerpts and required/preferred/mentioned classification. Only an explicitly supplied numerical proficiency level becomes a target level. Unknown levels remain null. When no target levels are measurable, the frontend displays **Not measurable**, not a numerical readiness claim. Readiness is informational and never an employment probability.

Market insights count recognized skills in that exact retrieved page, with a sample denominator and required/preferred counts. They do not claim market-wide demand. Matching feeds the existing journey and produces an analysis-specific roadmap. Roadmaps use the selected job and observed recurrence across the student's analyzed roles as a tie-breaker after gap priority. Repeated matching of the same job retains task status and completion evidence. Marking a task done requires nonblank evidence and does not automatically change proficiency.

Resume feedback accepts pasted text, suggests supported missing keywords, flags relevant skills without profile evidence, and reviews sections and measured outcomes. It never invents credentials or numbers. Text is processed for the request only; it is not persisted or sent to SerpApi.

## Implementation and data

- `backend/app/services/job_discovery.py`: Google Jobs normalization, bounded search/pagination, deduplication, versioned job persistence, cache, skill extraction, matching, sample insights, and resume feedback.
- `backend/app/services/serpapi.py`: shared bounded HTTP transport and masked provider errors; provider-key URL log redaction.
- `backend/app/routes/jobs.py`: authenticated routes and student ownership enforcement.
- `backend/app/models.py`: additive `discovered_jobs` metadata and `job_search_cache` tables. Retrieved roles reuse `jobs` and `job_skills`; analyses retain their existing relationships.
- `backend/app/schemas.py` and `mobile/src/types/contracts.ts`: matching backend/frontend contracts, including the readiness `measurable` flag.
- `backend/app/services/intelligence.py`: shared alias dictionary and measurable-readiness signal; existing scoring formula preserved.
- `backend/app/services/learning.py`: selected-role rationale, bounded observed recurrence, and progress carry-forward.
- `mobile/src/app/jobs.tsx`, `mobile/src/components/career-ui.tsx`, `mobile/src/api/client.ts`: complete frontend search/details/insights/match/resume/roadmap flow, loading/empty/error/retry states, and accessible controls using the existing design.
- Layout, tabs, and the journey screen connect the new flow to the existing authenticated profile and analysis.
- `backend/tests/test_job_discovery.py`: mocked-provider and API regression coverage.

There are no new runtime dependencies. Root `requirements.txt` already includes the backend dependency manifest. Startup's existing SQLAlchemy `create_all` creates the two new tables in existing SQLite databases; existing tables/data are not rewritten. The project has no Alembic migration system. Back up the SQLite file before applying this enhancement to a valuable environment. A production migration workflow remains future work.

Job identity includes the provider identity and description version so changed descriptions do not overwrite historical analysis targets. Only explicit required/preferred skills enter role scoring; mentioned skills appear in insights. Requirement importance weights (required 0.8, preferred 0.5) are policy values, not provider observations. Cache eviction removes cache records only and preserves jobs, analyses, and roadmap progress.

## New endpoints

All endpoints require the existing bearer authentication. Student-specific operations enforce ownership; admin access follows the existing policy.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/jobs/search` | Query `role`, `location`, `keywords`, `level`, `page`, `next_page_token` |
| GET | `/api/jobs/{job_id}` | Persisted retrieved listing |
| POST | `/api/jobs/{job_id}/match` | Body `{student_id}`; existing analysis plus explanations |
| GET | `/api/market/skills?search_id=...` | Exact retrieved-page skill statistics |
| POST | `/api/jobs/{job_id}/resume-advice` | Body `{student_id, text}` |
| GET | `/api/roadmap/{student_id}/analysis/{analysis_id}` | Retrieve/create selected-analysis roadmap |
| PATCH | `/api/roadmap/items/{item_id}` | Body `{status, completion_evidence?}` |

Pagination accepts only provider tokens previously issued for the same cached search scope and is capped at three pages. Each response contains at most ten normalized jobs, further limited by `SERPAPI_MAX_RESULTS`. The shared transport bounds provider payloads to 2 MB. Cached responses identify fresh or stale status and preserve original retrieval time. On provider failure, a still-valid stale response carries a warning; without one the API returns an explicit error. Job discovery never silently substitutes fixtures or curated listings.

## Configuration and run

Keep `SERPAPI_API_KEY` only in `backend/.env`. The frontend receives no provider key. Existing authentication secrets and CORS settings still apply.

| Setting | Default | Meaning |
|---|---|---|
| `SERPAPI_API_KEY` | unset | Required for live job discovery |
| `SERPAPI_TIMEOUT_SECONDS` | 10 | Provider timeout |
| `SERPAPI_MAX_RESULTS` | 10 | Normalized result limit |
| `JOB_CACHE_TTL_SECONDS` | 900 | Fresh cache lifetime (30–3600) |
| `JOB_CACHE_STALE_SECONDS` | 86400 | Maximum stale fallback age (3600–604800) |

Use the setup and two-terminal start commands in [README](../README.md). Restart FastAPI after updating the backend. Sign in as the configured demo student, open Jobs & insights, search, select a listing, then match or request a roadmap. Admins can explicitly load the existing synthetic demo student. No production student onboarding has been added.

## Verification and remaining work

Verified locally: **49 backend tests passed**, TypeScript passed, Expo lint passed, and Expo static web export passed with the new `/jobs` route. The tests cover provider parameters, pagination, empty/malformed responses, missing keys, provider authorization/rate-limit/server failures, cache freshness/staleness/expiry, deduplication, content versions, secret redaction, extraction, null target levels, matching, insights, resume advice, ownership, and roadmap progress preservation. Completion evidence cannot be cleared while leaving a task done.

Provider calls in tests use mocked HTTP transport and explicitly named fixtures. A subsequent live check with the locally configured key returned HTTP 200 and ten `serpapi_live` listings for Machine Learning Engineer / Chennai / Python / internship. The backend must run with outbound network access: the execution sandbox blocked sockets with Windows error 10013. The local provider timeout was increased to 45 seconds after 10-second timeouts, and the Jobs frontend now waits up to 60 seconds. The new Jobs screen has not received browser/device interaction acceptance testing; successful export and type/lint checks do not establish that.

After restarting the development backend, local HTTP smoke checks confirmed health 200, configured demo login 200, all five discovery/insights paths registered in OpenAPI, missing-key search 503 with `SERPAPI_NOT_CONFIGURED`, and the Jobs web route 200. These checks do not constitute interactive browser acceptance.

Known limits: conservative finite skill dictionary, no broad semantic parsing or inferred proficiency, one-page insight samples, no active-listing verification, pasted resume text only, no PDF/DOCX resume parsing or ATS score, no saved-job/application tracking or interview generation, no production account system or deployment hardening. Roadmaps use existing resource search and clearly labelled curated fallback when live resources are unavailable. Concurrent identical uncached requests are not coalesced; production rate limiting and cache concurrency controls remain future work. Retrieved job history is retained without a retention policy.

Provider reference: [SerpApi Google Jobs API](https://serpapi.com/google-jobs-api), including `engine=google_jobs`, `q`, `location`, and `next_page_token`. The implementation uses the existing HTTP client rather than adding a provider SDK.

Changes remain local; this enhancement was not committed or pushed.
