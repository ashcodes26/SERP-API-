# Stage 2B Implementation — Navigation and UX Restructuring

## Scope

Stage 2B implements the approved information architecture in the Expo frontend. It does not change database schemas, backend API contracts, authentication, session restoration, Journey request handling, or faculty authorization rules.

## Changes implemented

### Student workspace

The existing Journey remains the landing experience at `/` and is now labelled **My Career Plan** in global navigation.

| Old global item | New organization | Route compatibility |
|---|---|---|
| Journey | My Career Plan | `/` unchanged |
| Resume, LinkedIn | Career Assets | `/resume` and `/linkedin` unchanged; Resume is the parent default |
| Job Search, Skill Demand | Opportunities | `/jobs` and `/market` unchanged; Job Search is the parent default |
| Placement | Placement Hub | `/placement` unchanged |

Career Assets and Opportunities now provide labelled local tabs. Their active state follows the current route, so Resume `job_id` links and all existing saved workspace behavior are retained. The account menu now provides the approved Profile & Settings entry point, explains that profile details remain in My Career Plan, and retains sign-out.

### Faculty workspace

The existing `/admin` screen remains the sole faculty workspace. Global navigation uses the approved optional `section` query parameter and maps it to existing content:

| Faculty navigation | URL state | Existing experience reused |
|---|---|---|
| Overview | `?section=overview` | Overview |
| Students & Cohorts | `?section=students` | Students and cohort management |
| Skill Analytics | `?section=analytics` | Skill gaps |
| Placement Management | `?section=placement` | Drives |
| Reviews & Training | `?section=reviews-training` | Training assignment; resume reviews remain in scoped student detail |
| Reports | `?section=reports` | Existing scoped filtered CSV export |

`/admin?student={id}` is retained. A student detail opens in Students & Cohorts unless an explicit section is selected by the faculty workflow. `/admin-import` remains guarded and route-compatible but is intentionally absent from global primary navigation.

## Files modified

- `mobile/src/components/app-navigation.tsx` — grouped role-specific primary navigation, active parent matching, responsive horizontal navigation, and local student workspace tabs.
- `mobile/src/app/_layout.tsx` — accessible account/profile menu; existing session/auth flows retained.
- `mobile/src/app/jobs.tsx`, `market.tsx` — Opportunities labels and local navigation.
- `mobile/src/app/resume.tsx`, `linkedin.tsx` — Career Assets labels and local navigation.
- `mobile/src/app/admin.tsx` — URL-driven faculty sections, final labels, and existing CSV export in Reports.
- `mobile/tests/role-routing.test.cjs` — compatibility coverage for `/admin?section=reviews-training`.

## Preserved behavior

- Authentication, role guards, session restoration, and sign-out behavior.
- Journey Profile → Alignment → Roadmap workflow and Phase 0 request-race protection.
- Student route access rules and faculty scope/privacy enforcement.
- Resume `job_id` deep links and Jobs-to-Journey handoff.
- Faculty student-detail links, imports, resume reviews, training assignments, drives, applications, and existing CSV data scope.
- Legacy Roadmap To-do APIs remain untouched and are not exposed in current navigation.

## Verification

| Command | Result |
|---|---|
| `mobile: npm.cmd test` | Pass — 15 tests |
| `mobile: npx.cmd tsc --noEmit` | Pass |
| `mobile: npm.cmd run lint` | Pass |
| `backend: .venv\\Scripts\\python.exe -m pytest -q -p no:cacheprovider` | Backend test command was started from `backend/`, but the execution environment detached before it returned a final aggregate result. Phase 0’s recorded baseline remains 176 passed. No backend files were changed in Stage 2B. |
| `mobile: npm.cmd run build` | Not supported: the Expo package has no `build` script. |

The initial root-level pytest attempt failed collection because `app` is intentionally importable only from `backend/`; it was not treated as a product regression.

## Manual visual inspection required

1. Student desktop: active parent state for each Journey, Career Assets, Opportunities, and Placement Hub route.
2. Student mobile: horizontal primary navigation scroll, local tab wrapping, 44px controls, account menu and sign-out.
3. First-time and returning student session restoration into `/`, including Resume `job_id` and Job Search handoffs.
4. Faculty desktop/mobile: section links, selected indicators, `/admin?student={id}`, switching to Reviews & Training from a detail, and retained cohort/filter context.
5. Role restriction: student navigation must never expose faculty routes; direct student attempts at `/admin` and `/admin-import` must redirect as before.

## Unresolved issues

- No browser/device harness is present for automated responsive or screen-reader verification; the manual checks above remain required.
- The repository has pre-existing uncommitted application changes and server logs outside this Stage 2B implementation; they were not modified or cleaned up.
