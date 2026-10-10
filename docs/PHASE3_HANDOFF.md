# Phase 3 handoff — Core Career Intelligence

## Scope delivered
- Deterministic skill alias normalization (`backend/app/services/intelligence.py`). Unrecognized skills are preserved, not guessed.
- Synthetic demo student and seeded ML engineer target role, written idempotently to SQLite (`backend/app/services/demo_seed.py`). Not institutional records.
- Evidence-backed profile, seeded job, explainable skill-gap analysis, and persisted analysis/gaps (`backend/app/services/analysis.py`).
- Endpoints: `POST /api/demo/seed`, `GET /api/profile/{student_id}` (numeric DB ID), `POST /api/job/analyze` with `{ "seeded_job_id": <id> }`, `POST /api/skill-gap/analyze`.
- Phase 2 SerpApi resource search remains untouched. Mobile TypeScript response shapes unchanged.

## Scoring contract (`role-alignment-v1`)
- Skill requirement weight = importance * (1 for required, 0.5 for preferred).
- For known current and expected levels, alignment contribution = weight * min(current / expected, 1). Expected level zero counts as fully satisfied.
- Unknown current/required level yields **null gap**, a warning, and zero *measurable* alignment contribution. This is **not** an assertion of zero ability; it lowers confidence in interpreting the indicator.
- Alignment = total measured contribution / total positive requirement weight.
- Evidence coverage = weight of known-level requirements with recorded evidence / total weight.
- Confidence = weighted evidence-backed competency confidence / total weight.
- Gap severity = max(0, required - current); priority uses severity/expected * weight (high >= .45, medium >= .2, else low). Unknown required skills prioritized high if required importance >= .7, otherwise medium.
- Outputs include reasons, top drivers, formula version, and informational/employment non-prediction disclaimer. Repeated unchanged inputs reproduce the same metrics; each call creates a timestamped analysis history entry.

## Local verification
`cd backend && python -m pytest -q` — 22 passed. API end-to-end checks use temporary SQLite; no SerpApi credential required for this phase.

## Try the workflow
1. Start FastAPI: `cd backend && uvicorn app.main:app --reload`
2. `POST /api/demo/seed` to obtain synthetic `student_id`, `job_id` (DB primary keys).
3. `GET /api/profile/{student_id}` to view evidence and competencies.
4. `POST /api/job/analyze` with `{ "seeded_job_id": <job_id> }`.
5. `POST /api/skill-gap/analyze` with `{ "student_id": <student_id>, "job_id": <job_id> }`.

## Deliberate limits / Phase 4
- Job description free-text extraction is not implemented; Phase 3 only supports seeded roles. The free-text route returns an explicit 422 rather than pretending analysis occurred.
- SWOT, roadmap, assessment, and mobile screens are not implemented in this phase.
- Authentication/authorization are not implemented: only use synthetic data in local/demo environments; do not expose these endpoints to real student data or the public Internet.
- Phase 4: SerpApi-backed roadmap resources with labelled curated fallback, assessment scoring with persisted competency updates, and refreshed readiness/dashboard.
