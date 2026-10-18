# Stage 2 Implementation Plan

This plan follows approval of the final information architecture. It is intentionally frontend-first and route-compatible; no backend requirement, database schema, or public API contract change is needed.

## Implementation sequence

| Order | Task | Exact primary files | Dependencies | Risk and mitigation | Verification |
|---|---|---|---|---|---|
| 1 | Add navigation model/constants for final student and faculty groups. | `mobile/src/components/app-navigation.tsx`, new navigation config if needed | Approved labels and parent defaults | Medium: route/role guard drift. Keep existing hrefs and `role-routing` tests. | Student/admin nav labels and links render; existing route tests pass. |
| 2 | Update global shell to present grouped student/faculty navigation and account-menu entry for Profile & Settings. | `mobile/src/app/_layout.tsx`, `app-navigation.tsx`, optional account-menu component | Task 1 | Medium: sign-out/session affordance regression. Retain current header actions and mobile access. | Login, refresh, sign-out, deep-link, responsive keyboard test. |
| 3 | Add local Career Assets and Opportunities selectors that preserve the existing route screens. | `app-navigation.tsx` or group-shell component; `resume.tsx`, `linkedin.tsx`, `jobs.tsx`, `market.tsx` only if local header is required | Tasks 1–2 | Low: no route move. Avoid resetting draft/search state on selection. | Navigate Resume ↔ LinkedIn and Jobs ↔ Skill Demand; query handoffs survive. |
| 4 | Make Journey copy/stepper explicitly follow the first-time/returning specification while keeping `/` as landing route. | `mobile/src/app/index.tsx`, `journey-input.tsx`, `career-roadmap.tsx` | Existing Phase 0 request protection | Medium: analysis target restoration and upload flow. Do not create a dashboard. | New/returning student browser flow, upload, analysis, AI-plan/export regressions. |
| 5 | Re-label/match faculty current tabs to final faculty areas; introduce contextual Import and Reports entry points. | `mobile/src/app/admin.tsx`, `admin-import.tsx`, `placement-ui.tsx` | Approved faculty tab composition | Medium–high: student detail, scopes, cohort filters, and `?student=` must survive. | Scoped-faculty E2E flow including import, review, training, drive, report. |
| 6 | Add URL-state section aliases only if approved; otherwise retain local state. | `admin.tsx`, `role-routing.ts`, navigation tests | Product decision below | High: stale params and deep-link semantics. | `/admin?student=id` and any `section` alias work after refresh. |
| 7 | Add responsive/accessibility acceptance coverage for the new shell. | frontend tests/E2E scripts selected in later testing stage | Stable navigation implementation | Medium: current harness has Node unit tests but no RN browser harness. | 360px/768px/1440px, keyboard, labels, selected state, error/retry paths. |

## Definition of done

- The student landing route is still `/` and remains the Journey, not a dashboard.
- All eight current authenticated app routes remain available and role-protected.
- Primary navigation exposes the approved group labels without duplicate destinations.
- Resume `job_id`, Journey selected-target handoff, and faculty `student` query links continue to work.
- The same placement/review/training cards are reused; no duplicate workflow is created.
- TypeScript, lint, frontend tests, backend tests, and route compatibility tests pass.
- Browser verification covers first-time/returning student and scoped faculty journeys.

## Explicitly deferred

- Physical route decomposition into `/career-assets/*`, `/opportunities/*`, or `/faculty/*`.
- Shared async UI primitives, broad visual-system refactoring, and backend route/schema extraction.
- Legacy RoadmapTask API disposition.
- New dashboard metrics, user settings persistence, notification systems, or backend changes.

## Product decisions requiring approval before implementation

1. **Profile & Settings scope:** Is a lightweight account menu sufficient for this release, with profile editing remaining in My Career Plan, or should a real `/settings` page be added? A new page creates new IA and likely settings persistence questions.
2. **Career Assets and Opportunities default child:** The plan defaults to Resume and Job Search. Confirm those defaults, or specify LinkedIn/Skill Demand as defaults.
3. **Faculty Reviews & Training:** Should reviews and training be a single combined faculty section, as specified, even though reviews are currently visible in student detail? The proposal keeps contextual review cards and offers the section as a workflow entry, not a duplicated data view.
4. **Faculty Reports location:** Confirm Reports is a dedicated faculty navigation item backed by the existing filtered CSV export, with no new metrics/report formats.
5. **Admin URL state:** Approve or reject adding `?section=` URL aliases. Retaining local tab state is safer/minimal; URL state improves sharable links but introduces compatibility testing work.
6. **Roadmap task capability:** Confirm whether the hidden legacy To-do/task APIs remain intentionally reserved for a future release. This stage will not expose or remove them.
