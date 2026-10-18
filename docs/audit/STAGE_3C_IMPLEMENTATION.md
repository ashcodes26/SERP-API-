# Stage 3C Implementation — Career Assets UI/UX Polish

## Scope

Stage 3C is limited to the existing student Career Assets routes: `/resume` and `/linkedin`. It does not add a dashboard, alter global navigation, change APIs, models, permissions, consent behavior, storage, exports, or backend logic.

The work is based on repository evidence. Browser/device automation was not available in this environment, so visual and touch behavior is not represented as browser-verified.

## Files changed

- `mobile/src/components/career-asset-header.tsx` — shared Career Assets header, local navigation, and non-interactive workflow orientation.
- `mobile/src/utils/career-asset-stage.ts` — small, testable Resume workflow-state helper.
- `mobile/src/app/resume.tsx` — clearer five-step document workflow, target guidance, consent/error copy, feedback limitations, revision status, and export readiness.
- `mobile/src/app/linkedin.tsx` — clearer input-source choices, public-search limitations, source confirmation, target-positioning guidance, and error recovery language.
- `mobile/src/components/linkedin-insights.tsx` — more explicit score limitations, evidence terminology, profile-improvement hierarchy, and suggestion labelling.
- `mobile/src/components/candidate-evidence.tsx` — clearer saved-profile evidence and conflict context.
- `mobile/tests/career-asset-stage.test.cjs` — regression coverage for visible Resume workflow-state guidance.

## Before and after

| Area | Before | After |
|---|---|---|
| Career Assets orientation | The two screens had separate headers and did not consistently communicate their workflows. | Both use the same Career Assets header, local navigation, concise purpose statement, and stage orientation. |
| Resume flow | Upload, targeting, feedback, edits, and export were available but visually dense. | A five-step progression names the current phase: Add resume, Choose target, Review feedback, Revise, Export. Existing actions and validation are unchanged. |
| Resume feedback | Gemini rating and suggestions could be interpreted as a hiring/ATS result. | Copy distinguishes supplied-text feedback from an ATS score or hiring prediction, and makes user approval of edits explicit. |
| Resume revision/export | Original preservation, dirty state, and export prerequisites were present but less visible. | The revision area foregrounds the preserved original and unsaved-state status; export explains why it is unavailable until review/save requirements are met. |
| LinkedIn input | URL search, pasted text, exports, and official connection appeared in one dense section. | The page labels profile-evidence inputs and explains that indexed public search can be unavailable or incomplete; saved/confirmed content is clearly separated from retrieved excerpts. |
| LinkedIn insights | Quality, evidence, improvements, and wording were presented with less explicit confidence framing. | The score is scoped to supplied text, evidence is labelled as text evidence rather than proficiency, and suggested wording is identified as unverified drafts. |

## Functionality preserved

- Resume: PDF/DOCX/TXT upload, pasted-text input, private storage consent, target-role/manual-description and `job_id` listing handoff, Gemini consent, structured feedback, factual rewrite validation, individual replace/undo/reject actions, original restoration, revision save, versioned workspace behavior, and DOCX/TXT export.
- LinkedIn: URL and editable text input, profile-export upload, public-search preview, consent and self-confirmation gates, official connection path, saved profile analysis, target-role comparison, evidence views, wording suggestions, and existing improvement-to-roadmap action.
- Existing local Career Assets navigation remains the mechanism for switching between Resume and LinkedIn.
- Existing API contracts, student privacy boundaries, role access, session restoration, request locks, and backend behavior are unchanged.

## Verification

| Command | Result |
|---|---|
| `mobile: npm.cmd test` | Pass — 18 tests |
| `mobile: npx.cmd tsc --noEmit` | Pass |
| `mobile: npm.cmd run lint` | Pass |
| `git diff --check` | Pass (existing line-ending warnings only) |
| Backend tests | Not rerun: Stage 3C contains no backend changes. The latest recorded full backend baseline is 176 passing tests. |

The new regression test verifies Resume stage guidance across no workspace, target-ready, analysis-review, unsaved-revision, and approved-export states. Existing tests continue to cover upload format/size validation and revision replacement behavior.

## Remaining UX concerns

- A saved resume reopened in a later session still follows the pre-existing final factual-review confirmation behavior before export. This stage intentionally did not change that persistence model.
- Resume workspaces expose saved originals and revisions through the existing workspace model; no separate version-history endpoint or new history UI was introduced.
- Public LinkedIn results depend on the configured provider and indexed public data. The UI now states that limitation but cannot guarantee lookup availability.
- The existing LinkedIn “Add task” action still uses the preserved legacy Roadmap To-do API. It was not redesigned or removed because that would change behavior outside this stage.

## Manual visual verification checklist

1. At 360px, 768px, and desktop widths, verify the Career Assets local navigation, workflow labels, action rows, listing choices, and chart cards wrap without clipping or horizontal overflow.
2. Keyboard-test all header links, actions, checkboxes, details controls, and error/status announcements. Confirm visible focus indicators and that the workflow labels do not claim to be interactive controls.
3. Resume: upload valid PDF, DOCX, and TXT files; verify invalid type/size feedback; paste text; select a target; test Gemini consent gating; review suggestions; replace/undo/reject; save; restore original; and export DOCX/TXT.
4. Resume: open `/resume?job_id={existing-job-id}`, refresh, and confirm the retrieved-listing target handoff remains intact. Test a connection error and version-conflict recovery message with unsaved editor text.
5. LinkedIn: test pasted content, profile-export upload, consent/self-confirmation gates, URL search found/not-found/error outcomes, use-retrieved-text confirmation, saved-state restoration, target comparison, and official connection cancellation.
6. Verify LinkedIn score, evidence, and suggested wording language is understood as analysis of supplied text—not a verified LinkedIn score, skill certification, recruiter rating, or employment verification.
7. In web and native environments, verify resume export download/share flows and external profile-source opening behavior.
