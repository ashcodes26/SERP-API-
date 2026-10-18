# Feature Inventory

Status labels: **Verified by code/tests** means route/component/service evidence exists; **Partially verified** means implementation exists but this audit did not complete the relevant browser/live-provider path; **Disconnected/legacy** means implemented but not surfaced in the current primary UI.

## Student features

| Feature | UI route/component | Backend API/service | Dependencies | Status / audit note |
|---|---|---|---|---|
| Authentication and role routing | `/login`, `login.tsx`, `_layout.tsx` | `/api/auth/login`, `/signup`, `/me`, `/logout`; `accounts.py`, `auth.py` | SQLite, signing key, secure/session storage | Verified by code and backend tests; production auth posture is partial. |
| Journey/profile | `/`, `index.tsx`, `journey-input.tsx` | `/api/placement/journey`, `/api/profile/{id}`, `/api/journey/input/*`; `journey_input.py` | authenticated student, PDF/DOCX parser | Partially verified; UI is simplified to Profile/Alignment/Roadmap. Upload needs browser regression coverage. |
| Custom target role | Journey Profile card | `/api/job/analyze`; `main.py` job analysis path | recognized requirements / seeded role | Verified by implementation; user-created role quality depends on supplied requirements. |
| Alignment/gap analysis | Journey Alignment; `analytics.tsx` | `/api/skill-gap/analyze`; `analysis.py`, `intelligence.py` | profile skills, job skills | Verified by code/tests; readiness is correctly documented as informational. |
| Deterministic roadmap/progress | Journey and Jobs `career-roadmap.tsx` | `/api/roadmap/{student}/analysis/{analysis}`, `/api/roadmap/items/{id}`; `learning.py` | analysis, resource discovery | Partially verified; roadmap cards/progress editing were removed from the current UI, while export still consumes roadmap items. |
| AI roadmap | Journey Roadmap `career-roadmap.tsx` | `POST /api/roadmap/{student}/analysis/{analysis}/ai`; `gemini_roadmap.py` | Gemini key, consent, analyzed gaps | Partially verified; current UI supports narrative plan and HTML export. Add direct mocked tests. |
| Job discovery/matching | `/jobs`, `jobs.tsx` | `/api/jobs/*`; `job_discovery.py`, `serpapi.py` | SerpApi for live retrieval, cache | Partially verified; robust UI states exist. Live provider is configuration-dependent. |
| Skill demand | `/market`, `market.tsx`, demand/radar components | `/api/market/*`; `market.py` | collected job samples | Verified by code/tests; personal mode requires student session. |
| Resume workspace | `/resume`, `resume.tsx`, `revision-editor*` | `/api/resumes/*`; `gemini_resume.py`, `resume_enhancer.py`, `resume_files.py` | optional Gemini + consent | Verified by code/service tests; live Gemini and real document browser flow are unverified. |
| LinkedIn analysis | `/linkedin`, `linkedin.tsx`, `linkedin-insights.tsx` | `/api/profile/linkedin/*`; LinkedIn services | consented text, optional public/OIDC config | Partially verified; public lookup is explicitly partial and OIDC needs external configuration. |
| Placement workflow | `/placement`, `placement.tsx`, `placement-ui.tsx` | `/api/placement/*`; `placement.py` service | faculty scope, saved resume, drives | Verified by code/tests; full multi-account browser scenario unverified. |
| Assessments | Placement and training UI | assessment routes in `main.py`; `learning.py` | skill question sets | Verified by code/tests; assessment questions are embedded service data, not author-managed content. |

## Faculty features

| Feature | UI route/component | Backend API/service | Dependencies | Status / audit note |
|---|---|---|---|---|
| Faculty dashboard/student management | `/admin`, `admin.tsx` | `/api/admin/dashboard`, `/students`, `/students/{id}`; `placement.py` | admin account and faculty scopes | Verified by code/tests; screen is dense and should be split into routes/tabs. |
| Cohorts and role/gap analytics | `/admin`, `admin.tsx` | `/api/admin/cohorts`, `/roles`, `/skill-gaps` | scopes, student profiles | Verified by code/tests. |
| CSV/XLSX import | `/admin-import`, `admin-import.tsx` | `/api/import/*`; `imports.py` | admin scope, bounded file parser | Verified by code/tests; separate visual language from rest of app. |
| Resume review | Admin + student Placement | `/api/placement/resume-reviews`, `/api/admin/resume-reviews/*` | student consent and faculty scope | Verified by code/tests. |
| Placement drives and eligibility | Admin + student Placement | `/api/admin/drives`, `/api/placement/drives/*`, `/api/*applications*` | cohort membership/faculty scope | Verified by code/tests; uses student-reported application tracking. |
| Training assignment/progress | Admin + student Placement | `/api/admin/training`, `/api/placement/training/*` | scope, assessment/resource rules | Verified by code/tests. |
| Reporting | Admin dashboard | `/api/admin/report` | faculty scope | Verified by code; export-browser acceptance unverified. |

## Implemented but not primary-user-facing

| Capability | Evidence | Status |
|---|---|---|
| Roadmap to-do task CRUD/filtering | `RoadmapTask` model; `/api/roadmap/tasks*`; contracts/client types | Disconnected/legacy after removal of the To-do UI. |
| Roadmap milestone detail | `/api/roadmap/milestones/{item_id}` | Disconnected from simplified roadmap UI. |
| `BackendStatus`, themed/app-tabs components | component files exist; usage was not established in this audit | Candidate legacy code; confirm with static usage/bundle analysis. |

## External dependency behavior

- **Gemini:** Resume analysis and AI roadmap are opt-in and report unavailable/quota/timeout/invalid output states. Their correctness is only fully verifiable with mocked tests plus a controlled live synthetic test.
- **SerpApi:** Job discovery uses authenticated retrieval, cache, bounded pagination, and explicit failure states. It cannot be considered live-functional without a configured key and provider test.
- **LinkedIn:** Text analysis is local; public lookup and OIDC are external/configured paths and must be accepted against real account/provider conditions.
