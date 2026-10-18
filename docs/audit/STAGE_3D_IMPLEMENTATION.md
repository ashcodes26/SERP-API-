# Stage 3D Implementation — Opportunities & Placement Hub UI/UX Polish

## Scope and evidence

Stage 3D is limited to the existing student Opportunities (`/jobs`, `/market`) and Placement Hub (`/placement`) experiences. It preserves routes, deep links, existing APIs, SerpApi collection/caching behavior, matching and eligibility logic, authorization, faculty scoping, and placement business rules.

The implementation was based on repository evidence:

- `/jobs` already supported role/location/keyword search, cache status, pagination, listing inspection, matching, Resume `job_id` handoff, and Journey target handoff; its result and match context was compact.
- `/market` already operated on collected listing samples, role comparison, personal evidence comparison, source links, and web CSV export; its data-scope limitations were spread across small labels.
- `/placement` already loaded faculty, saved resumes, reviews, drives, applications, and training in parallel; these workflows rendered as a flat sequence rather than action-oriented groups.
- `EligibilityOut` exposes only `eligible`, `not_eligible`, and `needs_review`, while a missing decision was possible. The UI needed a clear fourth pending/unknown presentation without changing the API or rules.

No visual claim in this document is browser-verified: no browser/device surface was available in this environment.

## Files changed

- `mobile/src/components/opportunities-header.tsx` — consistent Opportunities header, local navigation, and purpose statement for `/jobs` and `/market`.
- `mobile/src/utils/placement-status.ts` — small, testable presentation mapping for existing eligibility/status values.
- `mobile/src/app/jobs.tsx` — clearer search purpose, collection/source context, job-card hierarchy, match-score limitations, and Resume handoff language.
- `mobile/src/app/market.tsx` — clearer collected-data boundaries, role-comparison context, evidence limitations, source-listing context, and Career Plan handoff language.
- `mobile/src/app/placement.tsx` — grouped review, drives, applications, and training/assessment workflows with explicit empty, loading, success, and recovery states.
- `mobile/src/components/placement-ui.tsx` — clearer review, application, and training status labels.
- `mobile/tests/placement-status.test.cjs` — regression coverage for eligibility-state interpretation.

## Before and after

| Area | Before | After |
|---|---|---|
| Opportunities hierarchy | Job Search and Skill Demand had local navigation but differing page orientation. | Both start with a shared Opportunities header and a concise purpose statement. |
| Job search | Search inputs and results worked but gave limited context about data freshness and action boundaries. | Search clarifies provider-sourced/unverified listings; result cards expose source and observed requirements; external application is explicitly performed at the original source. |
| Job matching | Recorded evidence, gaps, and a score were present. | The score is explicitly scoped to saved student evidence and observed listing terms, not eligibility or hiring likelihood. Existing Resume and Journey handoffs are clearer. |
| Skill Demand | Collected-sample limits appeared in dispersed labels. | Ranking, role comparison, evidence, learning priorities, and source-listing areas state their sample scope and limitations in context. |
| Placement Hub | Resume sharing, feedback, drives, applications, training, and assessment appeared in a flat flow. | The workspace is grouped as resume sharing/review, drives, applications, and training/assessments, with purposeful empty states. |
| Eligibility | Missing decisions and `needs_review` could be visually conflated. | Pending, eligible, not eligible, and needs-review states have distinct labels and next-step explanations; the underlying decision is untouched. |
| Placement statuses | Review, application, and training states were terse raw values. | Cards label the current status and distinguish self-recorded application updates from employer verification. |

## Features preserved

- SerpApi-backed job discovery, cache status, pagination, job detail retrieval, external source opening, and job search errors/retry behavior.
- Job-to-profile matching, deterministic readiness/gap results, listing skill requirements, and Job-to-Resume (`/resume?job_id=…`) and Job-to-Journey handoffs.
- Collected-market ranking, role comparisons, personal evidence comparison, competency/unknown-evidence presentation, resource links, existing-roadmap references, source listings, and web CSV export.
- Approved-resume sharing, optional stored-feedback sharing, revision history, faculty review/revocation, drives, existing eligibility decisions, application tracking, training completion evidence, and assigned assessments.
- No placement eligibility algorithm, API contract, database model, provider integration, or faculty scope was changed.

## Verification

| Command | Result |
|---|---|
| `mobile: npm.cmd test` | Pass — 19 tests |
| `mobile: npx.cmd tsc --noEmit` | Pass |
| `mobile: npm.cmd run lint` | Pass |
| Backend tests | Not rerun: Stage 3D does not change backend code, APIs, schemas, or business logic. Latest recorded full baseline: 176 passing tests. |

The new test confirms presentation mapping for no decision, eligible, not eligible, and needs-review states. Existing tests continue to cover market filter/date logic, ranking behavior, CSV safety, role restrictions, Journey request safety, upload validation, and Resume revision safety.

## Remaining UX risks

- Employer links, listing availability, and source details depend on external providers and can become stale after collection; the UI now makes this limitation explicit but cannot verify listings.
- A placement application remains a student-recorded status until changed by the student or faculty; the application provider is not integrated and was not implied by this stage.
- Eligibility reasons are supplied by the existing decision engine. This stage changes only wording and presentation, not decision accuracy or review escalation rules.
- Very long drive descriptions, eligibility reasons, application histories, training instructions, and source-listing lists require real-device wrapping/scroll validation.
- The legacy LinkedIn-to-Roadmap task action remains untouched; it is outside Opportunities and Placement Hub scope.

## Manual visual and interaction verification checklist

1. At 360px, 768px, and desktop widths, verify Opportunities local navigation, search fields, result cards, action rows, comparison controls, charts, and source-listing cards wrap without clipped text or horizontal overflow.
2. Keyboard-test Job Search, Skill Demand, and Placement Hub controls. Confirm visible focus, radio/checkbox state announcements, expandable demand items, retry actions, and status messages.
3. Job Search: test empty role validation, live/fresh-cache/older-cache labels, empty results, pagination, detail loading failure/retry, invalid source URL, and original-source application action.
4. With a signed-in student and seeded listing, compare a job, verify recorded evidence versus unknown evidence text, then verify both Resume `job_id` and Journey target handoffs survive refresh.
5. Skill Demand: test no data, fresh collection, date validation, ranking filters, two/three-role comparison, personal evidence view, unknown proficiency language, source links, and web CSV download.
6. Placement: test no faculty, no reviews, no drives, no applications, and no training empty states; then test all four eligibility presentations, application recording/updating, review feedback/revocation, revision history, training evidence, and assessment submit/cancel.
7. Confirm student pages remain inaccessible to faculty and faculty/admin pages remain inaccessible to students under existing role routing.
8. Verify that sharing a resume still requires explicit consent and selected faculty, and that stored Gemini feedback is shared only when separately selected.
