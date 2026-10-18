# Stage 3B Implementation — My Career Plan UI/UX Polish

## Scope and evidence

Stage 3B is limited to the student Journey (`/`) and its related UI components. It preserves the existing Profile → Role Alignment → Learning Roadmap requests, routes, API contracts, session restoration, and latest-request-wins handling.

The implementation was based on repository evidence rather than unverified screenshots:

- `mobile/src/app/index.tsx` previously rendered each stage as a dense flat sequence of panels and only a compact labelled step row.
- `journey-input.tsx` already enforced PDF/DOCX, 1 MiB validation, review-before-save, and save confirmation.
- `career-roadmap.tsx` already supported consented Gemini generation and PDF/DOC export, but did not visibly surface deterministic roadmap items before the AI section.
- `SkillGapChart` already exposed deterministic current/target values and a rationale disclosure.

No claim is made here about visual defects that require a browser/device inspection.

## Files changed

- `mobile/src/utils/journey-stage.ts` — small, testable three-step availability/completion model.
- `mobile/src/app/index.tsx` — unified Journey hierarchy, progression controls, Profile, Alignment, and recovery-state presentation.
- `mobile/src/components/journey-input.tsx` — clearer upload/review/save wording, detected-skill distinction, and error recovery action.
- `mobile/src/components/career-roadmap.tsx` — deterministic roadmap display; clear separation of optional Gemini guidance and progress exports.
- `mobile/src/components/analytics.tsx` — labels gap rationale as **Why this gap matters**.
- `mobile/tests/latest-request.test.cjs` — progression-state coverage without changing request-race test semantics.

## Before and after

| Area | Before | After |
|---|---|---|
| Journey progression | Compact step labels with limited completion context. | Three explicit stages with current, complete, available, and locked states; completed steps remain revisitable. |
| Profile | Student, competencies, target role, and action appeared as undifferentiated panels. | Profile identity, confirmed skill evidence, target role, and the next alignment action are clearly grouped and explained. |
| Upload review | Valid upload/review flow with terse copy and raw skill list. | Clear upload constraints, parsing state, detected-skill chips, explicit confirmation, and a retry action on error. |
| Saved vs detected skills | The distinction was implicit in save confirmation. | Parsed document skills are labelled **Detected skill mentions**; saved profile competencies are labelled **Confirmed competencies**. |
| Role Alignment | Readiness, gaps, warnings, and roadmap action were visually compact. | Informational readiness explanation, coverage/confidence, priority-gap context, clearly labelled rationale, notes, and a single next action. |
| Learning Roadmap | Optional AI plan appeared before a visible deterministic roadmap. | Deterministic roadmap items are first and scan-friendly; consented Gemini guidance is explicitly optional and separate. |
| Export | Existing buttons remained available without relationship context. | Progress exports explicitly state that they use saved deterministic progress and do not send data to Gemini. |

## Functionality preserved

- `/` remains the student landing route; no dashboard was introduced.
- Journey input still accepts text-based PDF/DOCX only, applies client validation, previews extracted details, and saves only confirmed details.
- Existing evidence storage, unknown-proficiency handling, custom target roles, deterministic skill-gap analysis, warnings, and roadmap APIs remain unchanged.
- The Journey request gate, retry behavior, session target handoff, and session restoration were not changed.
- Gemini roadmap consent, error/status responses, HTML download, and PDF/DOC progress export all remain available.
- Legacy Roadmap To-do UI was not reintroduced and its backend APIs were not touched.

## Verification

| Command | Result |
|---|---|
| `mobile: npm.cmd test` | Pass — 17 tests |
| `mobile: npx.cmd tsc --noEmit` | Pass |
| `mobile: npm.cmd run lint` | Pass |
| Backend tests | Not rerun: Stage 3B made no backend change. The most recent verified full baseline is 176 passed. |

New coverage verifies that completed Journey steps stay revisitable and prerequisites remain locked until saved profile/analysis state exists. Existing coverage continues to verify overlapping Journey request handling, retry, session restoration, upload validation, and role routing.

## Remaining UX issues

- The stage progression is implemented as buttons because it changes the current in-page Journey state; a browser/screen-reader check should confirm the selected/current announcement is clear.
- Deterministic roadmap items are now visible, but their resource links and task-status editing remain intentionally unchanged; this stage does not reintroduce the legacy To-do workflow.
- Long detected skill lists and long roadmap tasks need visual inspection on narrow screens.
- The account and global navigation visual checks identified in Stage 3A remain separate work.

## Manual visual verification requirements

1. At 360px, 768px, and desktop widths, inspect stage cards, form field width, skill chips, charts, roadmap items, and export controls for clipping or horizontal overflow.
2. Keyboard-test Profile, Alignment, and Roadmap progression: current state must be visible; completed Profile/Alignment must be revisitable; unavailable steps must remain disabled.
3. Upload a valid PDF and DOCX, verify parsed details and detected skills, save confirmation, cancellation, invalid file type, oversized file, parser failure, and retry behavior.
4. Save a custom role, verify unsaved text is retained while editing, analyze gaps, then revisit Profile and Alignment without a request-state overwrite.
5. Verify readiness language is understood as informational rather than a hiring probability; open at least one **Why this gap matters** disclosure.
6. Build deterministic roadmap items, then verify the Gemini consent checkbox is required before generation. Exercise success, timeout/quota/unavailable error states using configured test conditions.
7. In web, verify HTML roadmap download and PDF/DOC progress export; confirm exports work without AI consent. Verify non-web export guidance is clear.
8. Refresh during a returning Journey session and confirm restored target/alignment behavior remains unchanged. Test a Job Search handoff if a seeded listing is available.
