# AIMORA — Phase 1: Audit, Architecture and Foundation

## 1. Audit result
At the start of Phase 1 the repository (`github.com/ashcodes26/SERP-API-`) contained one commit and a title-only `README.md`. The uploaded `SERP_API.zip` and handoff zip contained specifications only. **No application code, dependency files, tests, SerpApi integration or Git history of prior work existed.** Phase 1 therefore built the missing foundation only; nothing was replaced.

If a local codebase exists that was never pushed, reconcile it with this foundation before Phase 2 (the contracts and health endpoint are the only integration points).

## 2. Authoritative requirements and conflicts
Order used: actual repo (empty) → handoff 3-day scope (`CLAUDE_START_HERE.md`) → PRD → Master Spec / Implementation Docs → Brief (background).

| Conflict | Resolution |
|---|---|
| PRD §15 / Master Spec: 3-week plan | Obsolete; 3-day hackathon scope governs |
| PRD §6.1 lists ATS, SWOT, interview prep, resume extraction as Must-Have | Core journey first; ATS/SWOT/interview prep are cut candidates (SWOT schema kept) |
| `AIMORA_Hackathon_Source_of_Truth.md` referenced but not supplied | Handoff doc used instead |
| `Integrate Serp API.txt` is a chat note, not API docs | SerpApi behavior verified against official docs in Phase 2 |
| `AGENTS.md` in upload is a ChatGPT mirror stub with no rules | Replaced by a project `AGENTS.md` at repo root |
| PRD demands offline/demo mode vs "no fake live results" | Reconciled by `provenance` field: `serpapi_live`, `curated_fallback`, `demo_fixture` |

## 3. Implementation vs hackathon MVP
| Capability | State after Phase 1 |
|---|---|
| Backend app, config, SQLite schema (13 tables), `/api/health` | Done, tested |
| Shared contracts (Pydantic ↔ TypeScript) | Done (`backend/app/schemas.py`, `mobile/src/types/contracts.ts`) |
| Mobile shell, typed API client, config, backend status card | Done (typecheck status in report) |
| SerpApi integration | Not started (Phase 2) |
| Role/skill analysis, readiness, roadmap, assessment | Not started (Phases 3–4) |
| Student journey screens | Not started (Phase 5) |
| CSV/XLSX import | Not started (Phase 6; deps pandas/openpyxl pinned) |

## 4. SerpApi operations required
Endpoint `https://serpapi.com/search.json` with `api_key` (server only). Confirm parameters against official docs at the start of Phase 2.
1. **Learning-resource search**: `engine=google`, query like `"<skill> tutorial OR course"`, read `organic_results` (title, link, snippet). Powers roadmap resources.
2. **Role-requirement discovery**: `engine=google_jobs` (`q`, optional `location`, `gl`, `hl`), read `jobs_results` for titles, descriptions and skills. Powers target-role requirements when no seeded role fits.
3. *Optional*: `engine=google_jobs_listing` with a `job_id` for full listing detail.
Required handling: timeout, auth/quota/rate-limit errors, empty and malformed responses, bounded result count, preserved source URLs, normalized `ResourceLink` objects.

## 5. Data contracts
Source: `backend/app/schemas.py`; mirrored in `mobile/src/types/contracts.ts`. Covers student, evidence, skill/competency, job, skill gap, readiness, SWOT, resource search, roadmap, assessment, dashboard, import job/issue, health and error body. Rules: proficiency 0–5 with `null` = unknown; `gap` is `null` when level is unknown; readiness always carries an informational disclaimer.
Planned routes (PRD §11.2): `POST /api/profile`, `GET /api/profile/{id}`, `POST /api/job/analyze`, `POST /api/skill-gap/analyze`, `GET /api/roadmap/{id}`, `POST /api/assessment/submit`, `GET /api/dashboard/{id}`, `POST /api/resources/search` (new), import routes.

## 6. Foundation checks
Schema creation via `create_all` on startup (no Alembic; add only if the schema must change on persisted data). Health endpoint reports DB status and whether SerpApi is configured, never the key.

## 7. Prioritized plan
| # | Phase | Depends on | Acceptance |
|---|---|---|---|
| 2 | SerpApi vertical slice: `POST /api/resources/search`, server key, tests with mocked transport + one real call | Phase 1 | Real call returns normalized results; missing key/timeout/429/empty return structured errors |
| 3 | Skill dictionary, seeded role, deterministic gap/readiness service, synthetic student seed | 1 | Repeatable scores, unknown ≠ 0, tests |
| 4 | Roadmap with SerpApi resources + curated fallback; assessment updating readiness | 2, 3 | State persists; dashboard recalculates |
| 5 | Mobile screens for the journey | 2–4 | Every control works against backend |
| 6 | CSV/XLSX import | 1 | Partial import, row errors, duplicates |
| 7–8 | QA, demo reset, polish | all | Repeatable demo script |

**Highest-priority next task:** Phase 2, the SerpApi vertical slice.
