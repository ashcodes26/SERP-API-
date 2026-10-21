# My Career Plan — focused Stitch refinement

**Current follow-up:** See “Same-frame visual polish” below for the latest measurements, local logo/font assets, roadmap investigation and checks. Earlier measurements describe the initial refinement.

## Scope and diagnosis

Only `/` and its presentation dependencies were changed. Existing uncommitted work was preserved. A SHA-256 baseline taken before this pass confirms no backend file, API client, contract, authentication implementation, dependency, configuration, theme, or unrelated route changed during this pass.

The previous page used shared workspace sizing and independent stacked cards, displayed the optional demo fixture inline, and conditionally omitted analysis and roadmap sections. It also reset the selected target on entry instead of restoring the saved dashboard target. These were page-composition problems, not missing color tokens or a different student route. The inspected browser showed an expanded fictional demo alongside the actual authenticated student's profile; the demo had not replaced that profile.

## Reference and dimensions

- Inspected `my_career_plan/screen.png`, its exported `code.html`, and `dark_void/DESIGN.md` in the supplied Stitch export.
- Reference PNG: **639 × 1600 raster pixels**. HTML: **64px header**, **960px centered shell**, **24px horizontal padding**, **912px inner content**, **24px section gaps**, **20/26px section headings**, **42/50px page title**, **12–14px supporting text**. Those HTML dimensions appear approximately half-size in the PNG; a desktop CSS viewport around **1280 × 3200** is inferred, not encoded in image metadata.
- Browser CSS viewport explicitly measured at **1280 × 3200**. Shell measured **960px**, left **160px**, inner content begins at **184px**. Browser zoom/host capture scaling differs from CSS pixels: the screenshot provider returned a **1421 × 3554 JPEG**, despite the verified CSS viewport. Do not interpret the capture's raw raster width as a CSS breakpoint.
- Approximate desktop heading positions measured from the DOM: page 89px; evidence 322px; target 862px; alignment 1251px; roadmap 2181px. These are close to the reference's inferred CSS section positions, but depend on actual text and saved data. This is a visual refinement, not a claim of pixel equivalence.
- Responsive check at **320 × 900 CSS pixels**: document width 320px; profile and target action buttons stay inside their cards. Navigation scrolls inside its own strip. The temporary viewport override was reset after verification.

## Implemented behavior

- Career-route-only compact shell: locally drawn brand mark, four existing destinations, read-only demo modal, actual account identity, avatar, existing logout handler. Other shells retain their prior appearance.
- Centered dashboard, page context, honest synthetic/editable status, informational readiness/private-document notice, compact cards and footer.
- Evidence panel integrates academic metadata (CGPA **/10**), both profile/upload entry points, capability-aware private-review notice, three/two/one-column competency grid, unknown values, saved evidence, and access to every competency.
- Target panel retains editable title and custom requirements, parsed server requirements, save status, reload, save and analyze actions. Editing the target invalidates the loaded results until saved and analyzed.
- Alignment section always exists: three metric cards, strengths/gaps columns, grounded-AI area, and optional scoring/warnings/SWOT disclosure. Full results use `AnalysisOut`; saved snapshots use the existing dashboard response without constructing a fake analysis.
- Roadmap section always exists: existing timeline records, server statuses, week/effort/provenance, resource links, completion criteria, evidence/progress controls, exports, optional consent-based AI plan and preserved personal tasks. Progress updates retain the existing API handlers and constraints.
- The existing **read-only** dashboard API now restores the current saved target, metrics, top gaps, progress counts and next saved milestone on entry. The implementation does not automatically generate analyses, roadmaps or Gemini requests.

## Files changed in this pass

| File | Change |
|---|---|
| `mobile/src/app/index.tsx` | Actual dashboard composition; restore existing dashboard snapshot; retain workflow actions |
| `mobile/src/components/career-plan-design.tsx` (new) | Page-scoped compact controls, typography, panels, icons, responsive page/footer |
| `mobile/src/components/career-plan-panels.tsx` | Evidence/review grid and readiness/strength/gap composition |
| `mobile/src/components/app-shell.tsx` | Compact shell only for student `/`; existing logout callback |
| `mobile/src/components/student-demo-header.tsx` | Optional toolbar/modal presentation; other callers retain inline presentation |
| `mobile/src/components/career-roadmap.tsx` | Optional compact timeline/export/guidance presentation |
| `mobile/src/components/roadmap-milestone.tsx` | Optional compact milestone/resource/progress presentation |
| `mobile/src/components/personal-tasks.tsx` | Optional compact header; existing query/filter/edit/delete behavior retained |
| `docs/CAREER_PLAN_VISUAL_REFINEMENT.md` | This report |

## Verification performed

- `npx tsc --noEmit`: passed.
- `npx expo lint`: passed.
- `node --test tests/*.test.cjs`: **22 passed**.
- Backend `python -m pytest -q` with test environment: **238 passed**, one existing Starlette/httpx deprecation warning.
- Reused the existing development app at `http://localhost:8081/`; no dependency install or server configuration change.
- Browser: verified desktop shell dimensions, restored authenticated dashboard snapshot, 320px action wrapping, saved milestone resource/progress disclosure (completion disabled with no evidence), read-only demo modal and return to actual workspace. Fixed React DOM warnings from native-only SVG accessibility props.
- Created desktop/mobile captures and a side-by-side reference comparison. No save/analyze/build/progress/assessment/AI mutation was submitted for screenshots.

## Remaining differences and unsupported reference features

- Real profile, requirements, metrics and statuses differ from the reference's fictional backend-engineer story. Unknown competency levels remain unknown; backend-returned readiness metrics remain unchanged. No scores, completion states, student details or source validation badges were fabricated.
- The dashboard contract exposes **only the next saved milestone and three leading gaps**, not the full saved analysis or full timeline. The current initial view explicitly identifies this partial snapshot. The existing Analyze/Build actions load complete results when the user chooses to run them. The generation-capable roadmap endpoint was not invoked merely for a fuller screenshot.
- Full analysis contains strengths, all gaps, warnings and SWOT; the snapshot does not contain strengths or an analysis ID for grounded Gemini requests. Those details remain unavailable until the existing analysis action runs.
- No generated Gemini summary was supplied or fabricated. Existing explicit consent and server grounding remain required.
- Reference transcript pending count, coursework/assessment verification labels, assigned quiz shortcuts, faculty milestone gates, prerequisite locks, institutional audit identifiers, compliance certification and support/audit footer links are not asserted where the current data/contracts do not support them. Private-review availability comes from the real capability endpoint.
- The initial vector logo and system-font approximation have been replaced in the follow-up below by the original reference PNG and locally bundled Inter weights. Supporting text and longer real requirements can still produce different line wrapping and card heights.
- Mobile uses stacked cards and an internally scrollable navigation strip. Open task/review/AI forms preserve their existing functional UI and may be taller than the compact closed dashboard.

No configuration is required. Review the running `/` screen before extending this visual treatment to another route; unrelated pages were intentionally left as they were.

## Same-frame visual polish

### Comparison method and results

The supplied PNG remains the visual reference. Its exported HTML was also served temporarily as a static local page and captured in the **same browser tab** as the application, sequentially at **1280 × 3200 CSS pixels**, measured from each document. This avoids the separate hidden tab's different zoom. Both resulting captures have identical **1421 × 3554** raster dimensions from the host capture system. The side-by-side comparison scales both equally to 639 × 1600; neither application's data nor DOM was replaced for capture.

| Heading | Rendered Stitch HTML, CSS y | Final app, CSS y |
|---|---:|---:|
| My Career Plan | 88 | 89 |
| Profile Evidence & Competencies | 315 | 316 |
| Target Role Specification | 861 | 868 |
| Alignment & Readiness Breakdown | 1244 | 1248 |
| Target Roadmap | 2162 | 2113 |

The first four headings now align within 7 CSS pixels for the inspected student. The roadmap begins earlier because the real snapshot has a short empty strengths state and no consented AI narrative. This is a measured comparison, **not pixel-perfect equivalence**; the supplied static PNG and its runtime HTML also have minor wrapping differences.

Changes in this follow-up:

- Replaced the drawn logo approximation with the exact 80 × 80 PNG named by the export, displayed locally at 32 × 32.
- Bundled Inter 400/500/600 TrueType files and their SIL OFL license. They load with the already-installed Expo Font package and apply only to Career Plan typography. There is no runtime Google-font dependency, app-wide font override, new package or configuration change.
- Matched header active-link hierarchy, compact badges, neutral card surface `#201f21`, 108px minimum competency tile height, thin borders and the reference's document-notice padding.
- Grouped title and audit notice with the reference's 12px separation; adjusted target requirements and primary 44px CTA typography/padding. Existing requirements editing remains available inside its disclosure.
- Added consistent decorative SVG symbols instead of platform-dependent icon characters, including profile, metrics, buttons and timeline markers.
- Tightened milestone code/title/status alignment; retained actual server statuses, week/effort/provenance, resources and evidence controls. “Displayed milestones” explicitly describes the snapshot subset.
- Removed the stretched empty strengths column. Gap rationale remains available under “Why these gaps?” rather than lengthening every compact gap row.

### Saved-roadmap investigation

| Existing interface | Evidence and limitation |
|---|---|
| `GET /api/dashboard/{student_id}` | `learning.dashboard()` reads the latest analysis's rows but returns counts and **one** next action, not the complete collection or analysis ID. |
| `GET /api/roadmap/{student_id}` | Selects the latest analysis and calls `create_roadmap()`. |
| `GET /api/roadmap/{student_id}/analysis/{analysis_id}` | Authorizes the selected analysis and calls the same generation service. |
| `create_roadmap()` | Returns existing rows immediately when they exist; otherwise searches resources and persists milestones. No `saved_only`/non-generating mode is exposed. Thus these collection endpoints can reuse saved data, but are not guaranteed read-only across empty/latest-analysis states. |
| `GET /api/roadmap/milestones/{item_id}` | Pure authorized read of a **known** item; it does not enumerate the analysis's item IDs. IDs are not guessed. |
| `GET /api/roadmap/tasks` | Separate personal tasks and task counts; not a complete roadmap-milestone inventory. |
| `GET /api/market/skills/me` | Returns at most three roadmap items per sampled skill across analyses; no latest-target collection identity. Substitution could mix targets and omit saved milestones. |

The existing snapshot cannot safely enumerate a complete current-analysis timeline through a guaranteed read-only collection API. No backend/API behavior was changed, no direct database access was wired into the UI, and no Build/generation call was made for screenshots. The explicit existing workflow remains. A future dedicated authorized read-only collection would require a separately scoped API change.

### Files and verification for this follow-up

- Modified: `mobile/src/app/index.tsx`; components `app-shell.tsx`, `career-plan-design.tsx`, `career-plan-panels.tsx`, `career-roadmap.tsx`, `roadmap-milestone.tsx`, `student-demo-header.tsx`; this report.
- Added: `mobile/assets/images/career-plan-logo.png`; `mobile/assets/fonts/career-plan/Inter-{400,500,600}.ttf`, `OFL.txt`, `README.md` (provenance).
- A fresh SHA-256 baseline confirms only those seven existing frontend source files changed during this follow-up. Backend code, contracts, API client, authentication, unrelated routes, global styles/tokens, dependencies/configuration and other pre-existing work remain unchanged.
- `npx tsc --noEmit` and `npx expo lint`: passed after the styling changes.
- Frontend tests: **22 passed**. Backend regression suite: **238 passed**, one existing Starlette/httpx deprecation warning.
- Browser checks: desktop comparison above; 320 × 900 and 800 × 1000 CSS widths match document widths with no horizontal page overflow; profile/upload/analyze actions fit within the mobile cards; expanded/collapsed gap context preserves the server rationale. Browser logs showed only the static reference's Tailwind CDN warning, not a new app runtime error.
- Temporary viewport override reset; static reference server stopped. Existing app remains at `http://localhost:8081/`. No student analysis, roadmap, progress, evidence or AI record was created/modified for verification.

Captures are in the task's visualization artifact directory: `career-polish-reference.jpg`, `career-polish-before.jpg`, `career-polish-after.jpg`, `career-polish-comparison.png`, `career-polish-mobile.jpg`, `career-polish-preview.jpg`.

Remaining differences are data-dependent: actual student identity, unknown competencies, server-returned metrics, unavailable strengths/AI narrative in the snapshot, one initially displayed milestone, and supported personal-task controls. Unsupported compliance links, faculty locks, quiz assignments, certification labels and fictional values remain excluded. No further configuration is required.
