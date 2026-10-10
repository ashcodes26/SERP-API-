# Phase 4 handoff — Roadmap, Assessments & Updated Readiness

## Delivered
- `GET /api/roadmap/{student_id}`: generates and persists up to 8 prioritized tasks for the latest stored student/role analysis, idempotent per analysis. Each item links to a SerpApi learning search result when live search is configured and successful; failures, empty results, and missing keys use explicitly labelled `curated_fallback` sources. Existing roadmap contract retained.
- `GET /api/assessment/questions/{skill_id}`: public questions for versioned SQL/Python/Docker mini quizzes; correct answer key stays server-side.
- `POST /api/assessment/submit`: checks all expected question IDs, scores deterministically, persists assessment and evidence, updates student competency conservatively, returns recalculated readiness.
- `GET /api/dashboard/{student_id}`: calculates up-to-date score, coverage, confidence, current top gaps, stored roadmap progress, and next action. Marks synthetic accounts `data_mode: demo`.
- Existing Phase 1–3 endpoints preserved. No new database tables or npm packages.

## Run
```sh
cd backend
python -m pip install -r requirements-dev.txt
python -m pytest -q
uvicorn app.main:app --reload
```
Optional live SerpApi: set `SERPAPI_API_KEY` only in backend `.env` (not mobile).
1. `POST /api/demo/seed` -> ids (synthetic)
2. `POST /api/skill-gap/analyze` with both ids
3. `GET /api/roadmap/{student_id}`
4. `GET /api/assessment/questions/{skill_id}` (SQL skill appears in gap output)
5. `POST /api/assessment/submit` with `student_id`, `skill_id`, `question_set_version`, `answers` map from quiz IDs to selected option strings
6. `GET /api/dashboard/{student_id}` to see updated indicators.

## Verification
`cd backend && python -m pytest -q`: 26 passed (22 inherited + 4 new). `python -m compileall -q app` passed. Live SerpApi requests not tested without a user credential; injected upstream stubs cover provider-success and timeout fallback. UI/device integration not tested (Phase 5).

## Deliberate limits / next phase
- Not for real student records: authentication/authorization is not implemented.
- Mini quizzes cover SQL, Python, and Docker only. Their level conversion is a simple demo-oriented score mapping, not a validated proficiency assessment; repeated attempts can increase levels. Avoid high-stakes interpretation.
- Curated fallback is clearly distinguished from `serpapi_live`; fallback default is a general course directory when no skill-specific item is curated.
- Roadmap is linked to the latest *analysis ID*; changes to skills are reflected immediately on dashboard, but a new analysis is required to generate a new per-analysis roadmap. Previous roadmap records remain for history.
- Phase 5: integrate mobile pages and flows with backend, loading/error states and explicit demo mode, then test on Expo Android. CSV/XLSX admin import remains a separately scheduled feature.
