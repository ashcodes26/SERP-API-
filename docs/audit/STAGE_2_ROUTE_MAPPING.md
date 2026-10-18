# Stage 2 Route Mapping

This mapping preserves every current route. “Move” means a new navigation parent or local grouping, not an immediate URL change.

## Student routes

| Current route | Current component | Proposed navigation location | Decision | Compatibility/dependencies | Break risk |
|---|---|---|---|---|---|
| `/login` | `mobile/src/app/login.tsx` | Public authentication | Remain | Shared auth layout, `AuthContext`, `/api/auth/*` | Low; preserve return-to-intended-route behavior. |
| `/` | `mobile/src/app/index.tsx` | **My Career Plan** | Remain as student landing route | `JourneyInput`, `CareerRoadmap`, profile/job/analysis/roadmap APIs, session target handoff | Medium if state restoration changes; preserve `session.takeTarget()` handoff. |
| `/jobs` | `mobile/src/app/jobs.tsx` | **Opportunities → Job Search & Matching** | Move/group | SerpApi/cache, job-match API, handoffs to `/resume` and `/` | Low if URL is retained; medium for selected listing state if physical routes change later. |
| `/market` | `mobile/src/app/market.tsx` | **Opportunities → Skill Demand** | Move/group | collected search samples, market APIs, CSV browser export | Low with retained route. |
| `/resume` | `mobile/src/app/resume.tsx` | **Career Assets → Resume Analyzer** | Move/group | query parameter `job_id`, resume APIs, Gemini consent, file/download helpers | Medium: retain `job_id` query parameter and Job Search handoff exactly. |
| `/linkedin` | `mobile/src/app/linkedin.tsx` | **Career Assets → LinkedIn Analyzer** | Move/group | LinkedIn text/import/public/OIDC APIs and consent | Low if route retained; external OIDC callback must not change. |
| `/placement` | `mobile/src/app/placement.tsx` | **Placement Hub** | Remain/group | faculty scope, reviews, drives, applications, training, assessment | Medium: preserve section order/links and every consent/action rule. |

## Faculty routes

| Current route | Current component | Proposed navigation location | Decision | Compatibility/dependencies | Break risk |
|---|---|---|---|---|---|
| `/admin` | `mobile/src/app/admin.tsx` | Faculty parent shell: Overview, Students & Cohorts, Skill Analytics, Placement Management, Reviews & Training, Reports | Consolidate internally; route remains | cohort filters, `student` query parameter, all admin/placement APIs | High if split prematurely. First retain route and map current tabs to final labels. |
| `/admin?student={id}` | `admin.tsx` selected student state | **Students & Cohorts → Student detail** | Remain/deep link | `useLocalSearchParams`, scoped detail API, review/training/application cards | High: must remain a direct URL and scope-check after any route split. |
| `/admin-import` | `mobile/src/app/admin-import.tsx` | **Students & Cohorts → Import students** | Hide from global primary navigation; surface contextual entry | selected/assigned cohort, import API state | Low if URL retained; medium if selected cohort context is not passed/remembered. |

## Current component placement

| Component | Final ownership | Decision | Notes |
|---|---|---|---|
| `app-navigation.tsx` | Global workspace navigation | Replace labels/structure in implementation stage | Must support parent selection without breaking current hrefs. |
| `_layout.tsx` | Global auth/workspace shell | Remain | Keeps role guards and session restoration. |
| `journey-input.tsx` | My Career Plan/Profile | Remain | Not a standalone navigation destination. |
| `career-roadmap.tsx` | My Career Plan/Roadmap; reusable read-only/export context when opened from Jobs | Remain | AI generation requires `analysisId`; Jobs currently can render the component without it. |
| `analytics.tsx` | Shared data visualizations | Remain | Used by Journey, Market, imports. |
| `demand-ranking.tsx`, `market-controls.tsx`, `market-radar*` | Opportunities/Skill Demand | Remain | No move required. |
| `revision-editor*`, `candidate-evidence.tsx`, `improvement-row.tsx` | Career Assets/Resume Analyzer | Remain | Preserve accessibility and web/native variants. |
| `linkedin-insights.tsx` | Career Assets/LinkedIn Analyzer | Remain | Preserve external-provider caveats. |
| `placement-ui.tsx` | Placement Hub + Faculty sections | Remain/shared | Do not duplicate cards; provide contextual entry points. |
| `backend-status.tsx`, `app-tabs*`, `themed-*` | No primary IA assignment yet | Hide from design decisions pending usage audit | Do not delete in Stage 2. |

## Navigation labels and route aliases

Initial implementation should use **labels and grouped controls only**:

```text
Student
My Career Plan  -> /
Career Assets   -> /resume (local: Resume | LinkedIn)
Opportunities   -> /jobs (local: Job Search | Skill Demand)
Placement Hub   -> /placement

Faculty
Overview                -> /admin?section=overview
Students & Cohorts      -> /admin?section=students
Skill Analytics         -> /admin?section=analytics
Placement Management    -> /admin?section=placement
Reviews & Training      -> /admin?section=reviews-training
Reports                 -> /admin?section=reports
Import students         -> /admin-import
```

The `section` values are a proposed client-side convention only. They require approval before being added because current `admin.tsx` uses local tab state rather than URL state. Until then, existing `/admin` behavior remains canonical.

## Required compatibility rules

1. Do not remove any Stack screen or change role guards in `_layout.tsx` without route tests.
2. Retain `/`, `/jobs`, `/market`, `/resume`, `/linkedin`, `/placement`, `/admin`, `/admin-import`, and `/admin?student={id}`.
3. Preserve `/resume?job_id={id}` and the Jobs-to-Journey selected analysis handoff.
4. Do not expose `/admin-import` to students; retain backend authorization as the security boundary.
5. Treat a parent nav click as a deterministic child destination, never as an implicit reset of unsaved form/editor state.
