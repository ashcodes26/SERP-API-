# Stage 2B Visual and Interaction Acceptance Review

**Review date:** 2026-10-18
**Scope:** Stage 2B navigation/UX restructuring only. No application code was changed during this review.

## Acceptance result

**Conditional acceptance.** The local backend and Expo web shell are available, route compatibility and automated regression checks are healthy, and the navigation structure is implemented as designed. One confirmed faculty active-state defect must be corrected before declaring the navigation fully accepted. Browser/device visual inspection remains unverified because no browser surface was available to this review session.

## Runtime and automated evidence

| Check | Result | Evidence |
|---|---|---|
| Backend health | Pass | `GET http://127.0.0.1:8010/api/health` returned HTTP 200 with `database: ok`. |
| Expo web shell | Pass | `HEAD http://127.0.0.1:8081` returned HTTP 200. |
| Route shell compatibility | Pass, routing shell only | `/`, `/resume`, `/resume?job_id=1`, `/linkedin`, `/jobs`, `/market`, `/placement`, `/admin`, `/admin?section=reviews-training`, `/admin?student=1`, and `/admin-import` all returned HTTP 200 from Expo web. This does not substitute for an authenticated UI check. |
| Backend suite | Pass | From `backend/` with `APP_ENV=test`: `176 passed, 1 warning in 157.24s`. The warning is FastAPI/Starlette `TestClient` deprecation, not a Stage 2B failure. |
| Frontend tests | Pass | Existing Stage 2B result: `npm.cmd test` — 15 passed. |
| TypeScript and lint | Pass | Existing Stage 2B result: `npx.cmd tsc --noEmit` and `npm.cmd run lint` passed. |

## Verified checks

### Student workspace

- **My Career Plan:** `/` remains the Journey route and is the student home route in `role-routing.ts`.
- **Career Assets:** primary parent correctly resolves to `/resume`; `/resume` and `/linkedin` render local labelled destinations, with active selection determined by pathname.
- **Opportunities:** primary parent correctly resolves to `/jobs`; `/jobs` and `/market` render local labelled destinations, with active selection determined by pathname.
- **Placement Hub:** `/placement` remains an available, student-only route.
- **Account menu:** the account control has an accessible label, expanded state, profile-management guidance, and a preserved sign-out action. It does not introduce a new settings route.
- **Student parent active state:** source logic marks the grouping parent active for either child route (Career Assets for Resume/LinkedIn, Opportunities for Jobs/Skill Demand).
- **Journey/Resume compatibility:** `/resume?job_id=1` is served by Expo; the route guard permits `/resume`. The existing Journey and `job_id` regression behavior is covered by the prior test suite, but was not interacted with in a browser.

### Faculty workspace and restrictions

- **Section mapping:** each approved `section` value maps to the existing `/admin` content: Overview, Students, Skill gaps, Drives, Training, and Reports.
- **Student detail compatibility:** `/admin?student={id}` maps to Students & Cohorts when no explicit `section` is present. Opening a student sets `student` and `section=students`.
- **Role boundaries:** the route guard permits only `/admin` and `/admin-import` for faculty and only the six student routes for students. The unit test confirms student access to `/admin` and `/admin-import` is rejected, while faculty access to student routes is rejected.
- **Refresh intent handling:** root layout captures the initial path/query and redirects only to a permitted intended path after session restoration. This was source- and test-verified, not browser-verified.

### Responsive and accessibility implementation checks

- Primary navigation is a horizontal `ScrollView`, so long faculty labels have a non-wrapping overflow mechanism.
- Student local navigation wraps rather than forcing card/content horizontal overflow.
- Navigation chips have a 44px minimum height; account and sign-out controls also use a 44px minimum height.
- Selected navigation uses both accent border and elevated background, not color alone.
- Web CSS supplies a visible `:focus-visible` outline and honours reduced-motion preference.

## Confirmed failure

### P1 — Faculty primary active state can contradict the visible section

**Reproduction**

1. Sign in as a faculty user and open a student detail: `/admin?student={id}`.
2. Use **Assign training to this student**.
3. The page sets `section=reviews-training` while preserving `student={id}`.
4. The content correctly changes to the training form, but the global primary navigation marks **Students & Cohorts** active.

**Evidence**

`admin.tsx` derives visible content from `section` before `student`, so `section=reviews-training` selects Training. `app-navigation.tsx` instead gives `params.student` priority and always selects the Students & Cohorts primary item.

**Impact**

The active navigation indicator no longer identifies the current faculty section. This conflicts with the Stage 2B acceptance requirement for correct active highlighting.

**Recommended correction (Stage 3 or an approved focused regression fix)**

Use the explicit recognized `section` value as the primary-navigation source of truth; use the student-detail fallback only when no valid section is supplied. Add a regression test for `/admin?student={id}&section=reviews-training`.

## Unverified scenarios

These require a browser, physical device, or emulator and were not represented as passed.

1. Desktop visual spacing, typography, clipping, and selected-state contrast at 1440px.
2. Mobile (approximately 360px) primary-nav scrolling/discoverability, local-tab wrapping, account-menu expansion, and touch-target measurements.
3. Keyboard traversal order, focus visibility while horizontally scrolling navigation, and screen-reader announcements for `tablist`/`tab` semantics.
4. Authenticated student flow: first-time Journey, returning Journey, account-menu sign-out, page refresh/session restore, and Job Search-to-Resume/Journey handoffs.
5. Authenticated faculty flow: every section link, cohort/filter preservation, student detail, training assignment, reports export, and import entry.
6. Actual client-side redirects after a student directly enters `/admin` or `/admin-import`, and after a faculty user enters a student URL.
7. Browser download behavior for reports and any Resume export.

## Precise manual acceptance script

### Student, desktop and mobile

1. Start backend on `127.0.0.1:8010` and Expo web on `localhost:8081`; sign in as a student.
2. At `/`, verify **My Career Plan** is active, Journey is still the first screen, and the next incomplete Journey action is clear.
3. Open **Career Assets**. Confirm `/resume`, **Resume Analyzer** is active, then switch to **LinkedIn Analyzer** and confirm `/linkedin` and active state.
4. Paste `/resume?job_id=<valid-id>` in the address bar, refresh, and verify the selected listing remains available without a navigation reset.
5. Open **Opportunities**. Confirm `/jobs`, then switch to **Skill-Demand Insights** and confirm `/market` plus both parent/local active states.
6. Open **Placement Hub** and verify reviews, drives, applications, training, and assessment empty states do not overflow at 360px.
7. Open the account menu by keyboard and touch; verify visible focus, expanded state, guidance, and sign-out.
8. Repeat steps 2–7 at 360px, 768px, and 1440px. Confirm the primary bar is discoverably scrollable on narrow screens and no chip truncates.

### Faculty

1. Sign in as a faculty account. Open each global item and refresh each URL: `overview`, `students`, `analytics`, `placement`, `reviews-training`, and `reports`.
2. Confirm the local **Faculty sections** control and global navigation identify the same section after each refresh.
3. Open a student from Students & Cohorts. Verify `/admin?student=<id>&section=students`, selected detail data is within faculty scope, and **Students & Cohorts** is active.
4. Select **Assign training to this student**. Verify the training form appears and, after the P1 correction, **Reviews & Training** becomes active.
5. Directly enter `/admin?student=<id>` and verify it opens student detail. Directly enter `/admin-import` and verify it remains faculty-only.
6. In a student session, directly enter `/admin` and `/admin-import`; in a faculty session, directly enter `/resume`. Verify redirects rather than protected content.

## Screens needing UI improvement in Stage 3

| Priority | Screen/area | Observation | Recommendation |
|---|---|---|---|
| P1 | Faculty global navigation + student-detail-to-training transition | Confirmed active-state contradiction described above. | Align active-state precedence with explicit section URL state. |
| P2 | Faculty mobile primary navigation | Six long labels rely on horizontal scrolling with the scroll indicator hidden; discoverability cannot be inferred by users from code alone. | Use a labelled compact section picker/drawer on narrow widths, or add a visible overflow affordance/gradient while retaining labels. |
| P2 | Faculty workspace | Global section navigation and the in-page **Faculty sections** control duplicate the same six destinations. | Establish one clear primary navigation mechanism per breakpoint; retain the other only as a context-aware mobile selector if testing supports it. |
| P2 | Reports | **Export filtered CSV** is available globally on every faculty section and again in Reports. | Make Reports the obvious export home, or explain the contextual quick export visually so it does not appear duplicated. |
| P2 | Reviews & Training | The section name promises two experiences, while reviews remain discoverable only in student detail and the selected section opens training assignment. | Add a lightweight contextual review entry/listing or clearer copy that routes faculty to a student detail without duplicating review data. |
| P3 | Account menu | Opening it expands a full-width inline block in the header; visual layout stability is unverified. | Use a bounded menu/popover pattern on desktop and a clearly structured disclosure on mobile. |
| P3 | Navigation semantics | Route-changing controls use ARIA tab roles. Tabs conventionally switch panels within one page, whereas these links navigate routes. | In Stage 3, validate with a screen reader; consider navigation/list/link semantics for global links and reserve tabs for local panels. |

## Stage 3 design priorities

1. Fix the P1 faculty active-state discrepancy and add a deep-link regression test.
2. Design and test a mobile faculty navigation pattern with explicit overflow discovery.
3. Remove visual duplication between global and local faculty selectors; clarify Reports and Reviews & Training entry points.
4. Standardize header/account-menu layout, spacing, and responsive behavior.
5. Perform browser/device accessibility acceptance before visual polish is considered complete.
