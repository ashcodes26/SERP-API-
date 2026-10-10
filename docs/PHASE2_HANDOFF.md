# Phase 2 handoff — SerpApi vertical slice

## Implemented
- `POST /api/resources/search` with existing `ResourceSearchIn` and `ResourceSearchOut` contracts.
- Live SerpApi Google organic results for `learning_resource` and Google Jobs for `job_postings`.
- `SERPAPI_API_KEY` read only from backend settings; never returned to the client.
- URL validation, bounded/deduplicated normalized links, `serpapi_live` provenance.
- Structured errors for missing API key, HTTP authentication/rate limits/upstream failures, network timeout, malformed provider payload.
- Empty valid search returns `results: []` and a warning; no fabricated results.

## Setup
```sh
cd backend
cp .env.example .env
# Edit backend/.env and set SERPAPI_API_KEY; do NOT add the key to mobile/.env
python -m pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

Example request:
```sh
curl -X POST http://localhost:8000/api/resources/search \
  -H 'Content-Type: application/json' \
  -d '{"skill":"SQL","kind":"learning_resource","max_results":5}'
```

Search is live-only. If the key is missing, the endpoint returns HTTP 503 with `SERPAPI_NOT_CONFIGURED`; no misleading fallback is returned. `kind=job_postings` searches `google_jobs` and returns link-backed job listings (not verified skill extraction). 

## Verification
`cd backend && python -m pytest -q`: 17 passed. Upstream requests were tested using `httpx.MockTransport`. A live provider call has **not** been verified because no key was supplied.

## Next phase
Phase 3 — Core career intelligence: normalize known skills, seed a synthetic student/role, implement deterministic explainable gap/readiness scoring, and test unknown-level semantics. Do not conflate search results with verified job requirements.
