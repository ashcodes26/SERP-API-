# Resume Analyzer — Stitch refinement

Implemented in the actual Expo `/resume` route. Existing original text, validated replacements, Undo/Reject, manual editing, factual confirmation, explicit saving and saved-only export remain intact. No backend, contract, authentication, dependency, configuration or unrelated-screen changes. No commit or push.

## Evidence and initial differences

Inspected the route, both revision-editor implementations, shared shell/navigation, input/confirmation helpers, resume workspace utilities, API client, TypeScript contracts, backend workspace routes/services/tests, the root `PROJECT_UI_DESIGN_SPEC.md`, and the supplied `s3_resume_analyzer/{screen.png,code.html}` plus `dark_void/DESIGN.md`. `docs/PROJECT_UI_DESIGN_SPEC.md` is absent; the specification exists at repository root.

The existing screen used a larger generic application header, pill navigation/actions, a 1000px page container, oversized workflow tiles, always-expanded target/consent setup, plain feedback blocks and a generic 360px editor. It lacked the reference's compact source/target toolbar, rating-card hierarchy, framed replacement comparisons, document-panel proportions and grouped revision controls. Existing functional handlers already implemented the correct approval workflow.

The current account has an existing saved resume and stored Gemini review with three validated replacement suggestions. Opening that saved workspace is a read operation. Its actual text, target, ratings, decisions and server version were used; no sample values were copied from Stitch and no new analysis was requested.

## Implemented layout

- Resume-specific use of the existing compact student shell: local logo, four destinations, existing read-only Demo Mode control, actual username and existing logout handler. Career Assets is active. Changes are conditional on `/resume`; other routes retain their prior presentation. At small widths the Resume navigation fits within the available width.
- Full-width secondary navigation with existing Resume/LinkedIn routes and a desktop workspace/job breadcrumb. Centered **960px container with 24px desktop gutters**, 36px top spacing and 24px section separation; 16px mobile gutters. Locally bundled Inter 400/500/600 reuse the installed Expo Font workflow. No new assets or font dependency.
- Actual workflow stage, 42/50px desktop title (28/34px narrow), revision status and compact five-step strip. The stage is derived from the existing `resumeAssetStage()` utility, not forced to the reference's edited demo stage.
- Compact baseline-document field, upload/management toggle, delete confirmation, saved target/job badges and Change target action. Storage consent, file/paste input, all saved workspaces, open/delete actions and timestamps remain in management. Target selection/search, source provenance, complete listing description/requirements, Google notice/consent and analysis action remain available in target setup. A new workspace still exposes the required setup.
- Accurate privacy/consent notice. Previously saved feedback does not imply consent for another analysis, faculty sharing, institutional verification or live synchronization.
- Three actual AI rating cards: relevance, evidence and clarity, using the backend's **/100** scale. Overall rating remains visible; all five ratings, reasons, excerpts, strengths, gaps, improvements, questions, provider status/model and validation messages are available through Full feedback. Null ratings remain unrated. These are explicitly informational AI estimates.
- Target Alignment Stream with genuine suggestion count, pending/applied/rejected badges, validation type, original/proposed passages, reason and existing actions. Applied passages receive the corresponding visual treatment; no applied state was fabricated for screenshots.
- Workspace Editor with split/revision-only presentation controls, a preserved raw-text preview and wider controlled revision editor. Original panel keeps its natural height; the draft panel uses the reference's higher surface. Desktop panel ratio approximates 5:7 with 24px gap; panels stack below 1024px. The editor starts at 580px, retains resizing, manual editing, synchronized yellow replacement highlighting and its existing 20,000-character limit.
- Factual confirmation, explicit Save revision, Restore original, format selection and saved-only download grouped in the draft panel. Footer states supported privacy/save behavior only.

## Functional preservation

| Existing behavior/API | Preserved implementation |
| --- | --- |
| GET `/api/resumes`, GET `/api/resumes/{id}` | Owner-scoped list/open, explicit workspace selection, refresh on focus and local-draft preservation. No automatic workspace creation or draft save. |
| POST `/api/resumes`, `/api/resumes/upload` | Private-storage consent, implemented formats, 1 MiB limit, existing paste/file validation and dirty-draft confirmation. |
| Existing job search/detail and `job_id` query parameter | Same listing/manual target modes, payloads, source links/provenance, minimum description requirements and errors. No search was invoked for visual verification. |
| POST `/api/resumes/{id}/analyze` | Same version, target fields, explicit `ai_consent`, analysis guard and status handling. Reanalysis still reviews the preserved original and resets decisions. |
| PATCH `/api/resumes/{id}/suggestions/{suggestion_id}` | Same accepted/rejected/pending decision calls, version checks and error handling. Replace/Undo retain exact-span replacement in the current draft, preserving other edits. No automatic `/apply` call was introduced. |
| PUT `/api/resumes/{id}/revision` | Same version, current draft and factual-confirmation payload. User must explicitly Save revision. |
| POST `/api/resumes/{id}/restore`; DELETE workspace | Existing confirmations and version handling retained. No restore/delete operation was executed for verification. |
| POST `/api/resumes/{id}/export` | Same DOCX/TXT handling, version and final-review confirmation. Dirty drafts block export; the backend exports saved text only. |

Before/after source comparison confirmed that the analysis, replacement, saved-selection and focus-refresh handlers and dirty guard remain unchanged. Save/export/restore/Reject payloads and export-disabled condition were checked against the pre-task source. Shared editor changes are behind optional `variant="resume"`; default typography/height/resize behavior remains available to other callers.

## Screenshot comparison

The supplied PNG is **666 × 1600 raster pixels**, while its HTML defines 42px title text and a 960px desktop container. Rendering it at a 666px CSS width would incorrectly activate mobile breakpoints. The PNG is consistent with a scaled **1280px-wide desktop** capture. Its precise original viewport metadata is unavailable.

Actual runtime reference and application captures were made at the same measured **1280 × 3074 CSS viewport**. Per-navigation browser zoom/DPR was measured and corrected through the temporary viewport override. The provider adds empty padding to screenshot canvases; normalized files extract the actual viewport rectangle without altering its content. Comparison sheets scale both normalized captures equally to 666 × 1600 for viewing. A separate sheet compares the supplied PNG directly with the scaled implementation.

Measured section positions in the final matched runtime captures:

| Heading | Stitch HTML Y | Application Y |
| --- | ---: | ---: |
| Resume Analyzer | 180.7 | 180.7 |
| Target Alignment Stream | 1144.5 | 1134.0 |
| Workspace Editor | 1954.5 | 1978.0 |

Refinement after the first comparison corrected an overly tall default feedback block, duplicate management trigger, stretched original-document panel, source-field styling and mobile navigation clipping. This is a close, screenshot-checked reproduction, **not pixel-perfect equivalence**.

Artifacts in the task visualization directory:

- `resume-stitch-reference.jpg`, `resume-reference-viewport.png`
- `resume-first-matched.jpg`, `resume-first-comparison.png`
- `resume-final.jpg`, `resume-final.png`
- `resume-runtime-final-comparison.png` — matched runtime reference left, implementation right
- `resume-supplied-final-comparison.png` — supplied PNG left, implementation right
- `resume-mobile-final.jpg`, `resume-mobile-editor.png`

## Verification

- `npx tsc --noEmit`: passed after final source changes.
- `npx expo lint`: passed after final source changes.
- `node --test tests/*.test.cjs`: **22 passed**, including exact-span replacement, multiple/manual-edit preservation, Undo, ambiguous/missing passage refusal, highlight fidelity, target/consent requirements, file validation and role navigation.
- Backend `python -m pytest -q` in the test environment: **238 passed**. One existing Starlette/httpx deprecation warning. Test databases are isolated.
- Browser: full feedback/rationale opens; target setup remains reachable; analysis stays disabled without consent; factual confirmation enables the existing saved export; manual editing clears confirmation, marks the draft unsaved and blocks export; the preserved original remains unchanged; split/revision-only controls work. The temporary local edit was restored exactly without saving.
- Browser widths **320 × 900**, **390 × 844**, **800 × 1000** and **1280 × 3074**: document width equals viewport width. At 320px no action button extends beyond the page. At 390px all four primary destinations fit, mobile controls measure at least 44px high, and document/editor panels stack.
- Browser logs contain the static reference's Tailwind CDN warning; no new application runtime error was observed.
- No Replace/Reject/Undo decision, Save, Restore, Delete, upload/create, analysis, demo or export operation was invoked against saved student data for screenshots. These mutation paths are covered by the existing tests and preserved handlers. The saved workspace remained at the same server version. Native devices and screen-reader behavior were not tested.

## Files, configuration and remaining differences

Modified:

- `mobile/src/app/resume.tsx`
- `mobile/src/components/app-shell.tsx` — Resume-only shell selection/compact navigation; authentication handlers unchanged
- `mobile/src/components/revision-editor.web.tsx`
- `mobile/src/components/revision-editor.tsx`

Added:

- `mobile/src/components/resume-design.tsx`
- `mobile/src/components/resume-analysis-panels.tsx`
- This report

A fresh SHA-256 baseline confirmed the four listed existing files were the only existing files changed during this task. Backend code/tests, API client, contracts, auth context/root layout, sign-in, Career Plan refinements, unrelated routes, global styles/tokens, dependencies/configuration and all other pre-existing uncommitted work were preserved. No configuration change is required. Existing frontend/backend servers remain at `http://localhost:8081` and `http://localhost:8000`; the temporary reference server was stopped and the viewport override reset.

Remaining differences are intentional or data-dependent:

- Actual saved text, target, rating values, validation labels, three pending replacements, workspace version and stage differ from the fictional reference. Version labels use the real server workspace version, not a fabricated semantic revision number.
- The backend exposes extracted original/revised **plain text**, not a structured PDF layout or rich-text resume schema. The preview/editor preserve that text; they do not invent formatted education/experience fields or alter document contents for appearance.
- No insertion suggestions, coursework-grounded rewrite claims, verified metric deltas, AI confidence percentage, autosave timestamps, Live Sync, institutional vault/certification claims, direct faculty-share control or unsupported compliance/support links were copied. Existing faculty sharing remains in Placement Hub.
- Consent/setup and detailed feedback expand beyond the compact reference. The explicit export format selector and accurate instructions require some additional space. Footer, minor SVG shapes and content wrapping therefore differ. The static HTML's external logo failed to load in its runtime capture; the implementation uses the existing local matching logo.

Recommended next step: review this Resume Analyzer result; scope any further screen redesign separately.
