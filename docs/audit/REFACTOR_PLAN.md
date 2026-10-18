# Refactor Plan

This is a dependency-ordered plan only. It does not authorize implementation.

## Phase 0 — Stabilize and establish baselines (P0, S)

| Task | What / why | Exact files | Dependencies and risks | Verify |
|---|---|---|---|---|
| Capture deterministic checks | Add a documented frontend test command for existing `mobile/tests/*.test.cjs`; run backend tests in isolated CI. | `mobile/package.json`, CI/workflow if present, `README.md` | Do not change test semantics; current `npm test` is missing. | `npm test`, `tsc`, lint, pytest all produce final exit statuses. |
| Regression-test Journey connectivity | Add tests for session restoration, duplicate/focus requests, API unavailable/retry, and document preview errors. | `mobile/src/app/index.tsx`, `mobile/src/app/_layout.tsx`, `backend/tests/test_journey_input.py`, `backend/tests/test_workspace.py` | Requires chosen RN-web testing harness. | Offline/online and corrupt upload tests pass. |
| Test AI roadmap boundary | Mock Gemini adapter; cover all result states and authorization. | `backend/tests/test_gemini_roadmap.py` (new), `test_intelligence.py`, `routes/jobs.py` | No live key; keep provider test isolated. | Valid schema and all failure-state tests pass. |

## Phase 1 — Shared interaction foundation (P1, M)

| Task | What / why | Exact files | Dependencies and risks | Verify |
|---|---|---|---|---|
| Create shared async state primitives | Replace duplicate busy/error/retry guards with cancellation/latest-request aware hook. | New `mobile/src/hooks/use-async-action.ts`; `index.tsx`, `jobs.tsx`, `market.tsx`, `resume.tsx`, `linkedin.tsx`, `placement.tsx`, `admin.tsx`, `admin-import.tsx` | Preserve each endpoint timeout and retry behavior. | Page integration tests prove no stale UI state. |
| Normalize UI primitives | Define shared screen/header/form/notice/empty-state components from `career-ui`. | `career-ui.tsx`, new components, page files listed in UX plan | Do not visually break existing pages all at once. | Visual/keyboard acceptance at target breakpoints. |
| Standardize error contract presentation | Map `ApiError.code`, retryability, and common next steps into reusable feedback. | `api/client.ts`, shared feedback component, route screens | Backend contracts must remain unchanged. | 401, 403, 409, 413, 422, 429, 5xx states are understandable. |

## Phase 2 — Student workflow consolidation (P1, L)

| Task | What / why | Exact files | Dependencies and risks | Verify |
|---|---|---|---|---|
| Career dashboard and plan shell | Reorganize student navigation without removing deep links. | `app-navigation.tsx`, `_layout.tsx`, `index.tsx`, route files/new route wrappers | Requires Phase 1 primitives; protect bookmarked routes. | Student end-to-end path: profile → alignment → roadmap → placement. |
| Shared target-role context | Persist/restore selected role/job safely across Journey, Jobs, Resume, LinkedIn. | session/context utilities, `index.tsx`, `jobs.tsx`, `resume.tsx`, `linkedin.tsx` | Avoid making unreviewed client state source of truth. | Cross-page task handoffs retain intended role. |
| Roadmap product decision | Decide and document lifecycle for `RoadmapItem` versus legacy `RoadmapTask`; then align UI. | `career-roadmap.tsx`, `jobs.tsx`, `workspace.py`, `models.py`, contracts | High migration/API compatibility risk; do not delete before consumer audit. | Migration/compatibility tests and product acceptance. |

## Phase 3 — Faculty workflow modularization (P1, L)

| Task | What / why | Exact files | Dependencies and risks | Verify |
|---|---|---|---|---|
| Split faculty screen by domain | Separate overview, students, cohorts/skills, drives, training/reviews into maintainable route components. | `admin.tsx`, `placement-ui.tsx`, `_layout.tsx`, new `app/admin-*` files | Preserve role guard and query links. | Scoped faculty users cannot see out-of-scope students. |
| Integrate import/report flow | Put import job status/errors and report actions under faculty operations. | `admin-import.tsx`, `admin.tsx`, `api/placement.ts` | Keep import audit trail and existing API paths. | Upload → map → preview → confirm → report scenario. |

## Phase 4 — Backend modularity and operational readiness (P2, M/L)

| Task | What / why | Exact files | Dependencies and risks | Verify |
|---|---|---|---|---|
| Split schema and route modules by bounded context | Reduce 1,125-line schema and mixed workspace/placement routers. | `schemas.py`, `routes/workspace.py`, `routes/placement.py`, imports/tests | Import cycles and OpenAPI path changes are risks. | Route inventory and contract tests unchanged. |
| Contract drift protection | Generate/validate TypeScript contract types from OpenAPI or test mirrored structures. | `schemas.py`, `contracts.ts`, CI script | Tooling choice required. | Deliberate incompatible change fails CI. |
| Production decision record | Define deployment, database migration, background AI jobs, observability, retention, auth and CORS requirements. | `README.md`, `docs/architecture/*`, config/deployment files as needed | This is architecture, not a quick code refactor. | Threat model and deployment review approved. |

## Phase 5 — Polish and cleanup (P2/P3, M)

- Add browser E2E coverage and visual regression baselines.
- Confirm and remove/retire unused components/endpoints only with compatibility review.
- Improve copy, responsive layouts, accessibility, and loading skeletons.
- Reassess dependency health with Expo-compatible tooling; no package removal until usage is proven.

## Complexity summary

| Phase | Complexity | Reason |
|---|---|---|
| 0 | Small | Tests/configuration, but must not mask existing failures. |
| 1 | Medium | Cross-cutting UI behavior touches every screen. |
| 2 | Large | Navigation/context changes affect all student workflows. |
| 3 | Large | Faculty permissions and dense workflow decomposition. |
| 4 | Medium–Large | Contract and module extraction must preserve APIs. |
| 5 | Medium | E2E infrastructure and iterative visual/accessibility work. |
