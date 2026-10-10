# Resume Enhancer, LinkedIn Profile Analyzer, and roadmap to-dos

Implemented in the existing FastAPI/SQLAlchemy/SQLite backend and Expo SDK 57 frontend. Existing job discovery, skill normalization, authentication, assessments, and milestone persistence remain in use.

## Where to find the features

- Sign in as a student at `http://localhost:8081`. Open **Resume Enhancer** in navigation.
- Upload a UTF-8 TXT or DOCX, or paste an original. Consent is required for private storage. Select a retrieved job or enter a manual title and description.
- Open the separate **LinkedIn Analyzer** tab (`/linkedin`) for public URL lookup, source previews, editable profile text, TXT/DOCX import, official OAuth connection and deletion. Saved skill mentions and parsed career sections appear here. Resume Enhancer contains resume upload, statistics, target analysis, revision and export. Saved profile evidence can still support resume suggestions; reanalyze after profile changes.
- Inspect source evidence, text alignment, requirements, parsed sections, conflicts, and recommendations. Accept/reject/reset individual suggestions. Additions require an actual student-supplied example using the relevant skill.
- Apply approved suggestions explicitly, edit the revision, confirm factual accuracy, save, and download DOCX or TXT. Original text remains separate. Rebuilding/restoring warns before replacing editor text.
- In **My journey → Roadmap**, or a job's generated learning plan, the existing milestones appear beside **My To-Do List** on desktop and above it on mobile. Create from a milestone or add your own task. Edit, prioritize, set a date, link a skill, complete/reopen, filter, sort, and confirm deletion.
- Resume career recommendations can create evidence tasks. Link those tasks to an existing milestone in the roadmap editor. A task linked to another saved analysis can open its owned milestone details.

## Analysis and factual boundaries

The service reuses the existing requirement extractor and canonical skill dictionary. It recognizes explicit resume/profile section headings and preserves supplied contact, experience, education, project, and certification text. Sources remain visible. Repeated skill mentions and exact project excerpts are deduplicated within a source; identical excerpts copied between sources retain provenance and are not independent corroboration. Explicit proficiency disagreements are flagged rather than merged into a new assessed level.

Self-reported, student-confirmed, project/experience, recorded profile evidence, and explicit assessment sources are distinguished. Unknown proficiency remains `null`. A keyword that is not detected is not a finding that the student lacks the skill. No new proficiency or assessment record is created by a resume claim or a completed to-do.

The deterministic `resume-text-checks-v1` estimate uses components on a 0–100 scale:

`0.50 × required-keyword coverage + 0.20 × all requirement-keyword coverage + 0.20 × project/experience context coverage + 0.10 × recognized-section coverage`

The four section groups are education, skills, experience, and projects. The estimate is unavailable when no explicit required skills are recognized. This is not an official ATS score, compatibility guarantee, or employment probability. Visual extraction/layout, authenticity, ATS-specific rules, and experience durations are not verified.

Suggestions use conservative deterministic wording/heading changes and evidence review prompts. No LLM is configured or called. No employment, degrees, certifications, dates, metrics, or skills are invented. Accepting a review-only suggestion inserts no text. Accepting an addition requires the student's actual example; the suggested bare keyword is never inserted automatically.

## LinkedIn access and deletion

Linked Analyzer connects the consenting member through the official LinkedIn OAuth authorization-code flow using `openid profile`. The backend exchanges the code and calls `/v2/userinfo`; the UI shows the returned member name and API source. A pasted profile URL is optional metadata and never selects which account OAuth reads. The standard product provides basic identity, not experience, education, or skill histories: those remain consent-based pasted text or the student's own TXT/DOCX export. Connection never replaces profile text, resume revisions, or assessed skills. See [official OpenID Connect documentation](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2).

### Public profile URL lookup

Linked Analyzer also supports **Retrieve public profile information** using the existing backend-only `SERPAPI_API_KEY`. It performs up to two Google searches and accepts only HTTPS LinkedIn results matching the exact profile slug (including localized LinkedIn domains and known skills/experience/education detail paths). It never fetches LinkedIn pages or imports cookies. API source format is documented by [SerpApi organic results](https://serpapi.com/organic-results).

Results show real snippets and their source links, dictionary-detected skill mentions, retrieval time, and `serpapi_live` provenance. No result is a valid `not_found` response: missing information is unavailable, never proof of a missing skill. Provider auth/quota/network/timeout errors retain their controlled errors. The tested SerpApi `Fully empty` response is normalized to an empty result for this lookup only.

A single private preview per student persists across navigation/reload. Repeated searches of the same URL reuse that preview for 15 minutes and display `cached`. Searching preserves saved profile text, resume revisions and analyses. **Use retrieved text in profile editor** asks before replacing nonempty editor text; source URLs and retrieval time are included in the editable snapshot. Review/correct the text, check both own-data consent and background confirmation, then **Save profile information**. Server validation binds adoption to the owner's successful exact-URL lookup. Other people's public previews can be inspected but must not be adopted as the student's own background.

Reviewed snapshots use `public_search_reviewed` import method and `linkedin_public_search_reviewed` resume evidence labels. They never establish assessed proficiency or overwrite existing skill levels. Provenance URL/date lines are excluded from skill extraction. Saving invalidates derived analyses so reanalysis uses reviewed text; deleting profile data also deletes the public preview. The original and approved resume text remain preserved.

Live verification against the user's provided profile URL returned no useful matching indexed results. Successful adoption is covered by explicitly labeled synthetic provider fixtures; no fabricated profile results were inserted into the running app.

### Local setup

1. In your approved LinkedIn developer app, enable **Sign in with LinkedIn using OpenID Connect** and ensure `openid` and `profile` permissions are provisioned.
2. Configure a reachable HTTPS URL for your backend and register the exact callback `https://YOUR_BACKEND/api/profile/linkedin/callback` in the app's Auth tab. An HTTPS development tunnel can forward to local port 8000. Keep the tunnel running while connecting.
3. Set `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, and `LINKEDIN_REDIRECT_URI` in `backend/.env`. Empty placeholders are provided; credentials remain backend-only. Restart the backend.
4. In the LinkedIn Analyzer tab, check consent, click **Connect with LinkedIn**, then **Continue on LinkedIn**. Approve access and return to the original Skillup tab. The result updates automatically.

Without configuration, the connect action returns `503 LINKEDIN_NOT_CONFIGURED` with setup instructions. Provider refusals, unavailable permissions, malformed replies, rate limits, and timeouts are reported without exposing credentials. A real member authorization has now completed successfully with locally configured credentials and an HTTPS ngrok callback. The provider returned basic member details; full career history is outside the enabled OpenID Connect product.

Each connection uses a random single-use state bound to the authenticated student, persisted only as a hash. Pending/failed attempts expire after ten minutes and are purged on subsequent connection requests. Successful basic-member receipts remain available until explicitly cleared, profile data is deleted, or a new connection is started. Only one attempt is kept per student. Access/ID tokens and authorization codes are not persisted or returned to the frontend. Callback query credentials are removed before Uvicorn access logging. Status and cancellation endpoints require the same student's session; deleting profile data also clears the connection receipt. The frontend loads the latest owner-bound connection result on mount and resumes pending polling after navigation or reload. Successful results remain visible after the original authorization window expires; saved manual profile text is preserved.

URLs must use HTTPS and `linkedin.com/in/` or `www.linkedin.com/in/`, without credentials or an alternate port. Query/fragment tracking is removed. No passwords, session cookies, unofficial tokens, or scraping are used.

Editing or removing imported profile data invalidates that student's stored resume analyses and suggestion decisions, increments resume versions, and preserves original/independently approved revision text. Previously copied and approved facts remain part of that resume until the student edits or deletes it; this is explained before deletion. Other students' data and existing learning/assessment records are unaffected.

## Persistence, privacy, and limits

Five additive tables are initialized through the project's existing SQLAlchemy `create_all` startup flow: `resume_workspaces`, `linkedin_profiles`, `linkedin_authorizations`, `linkedin_public_lookups`, and `roadmap_tasks`. The repository has no migration framework. Existing tables are not altered or dropped. Back up the SQLite database before deploying schema changes.

Every workspace endpoint requires an authenticated student principal; arbitrary student IDs are not accepted. Foreign saved-item IDs return 404. Admins cannot read personal workspaces through these routes. Mutating resumes/tasks uses a version field and atomic conditional updates; stale writes return 409 and the UI preserves local edits. Exports require the saved version and explicit final review.

Uploads: 1 MiB, 30–20,000 readable parsed characters, TXT/DOCX only. Existing DOCX archive/XML limits remain enforced. Uploaded binary content is request-only; parsed text is private and retained until deletion. Picker-created cache copies/blob URLs and native export cache copies are released. Sensitive workspace responses use `Cache-Control: no-store`; validation errors omit the submitted personal text. No public document URLs are created and resume/profile text is never sent to SerpApi.

Limits: 20 saved resumes per student, 500 tasks per student, 30 suggestions per analysis. Task statistics use all persisted task statuses even when the displayed list is filtered. Empty-list completion percentage is `null`. Today uses the UTC calendar date; Upcoming means unfinished tasks with future UTC dates. Unscheduled tasks remain in All. Task completion never changes a milestone; existing milestone completion requires its separate evidence action.

## API additions

| Method | Route | Purpose |
| --- | --- | --- |
| GET / POST | `/api/resumes` | Own saved resumes / save a pasted original |
| POST | `/api/resumes/upload` | Consent-based actual parsing and storage |
| GET / DELETE | `/api/resumes/{id}` | Own workspace / delete with version |
| POST | `/api/resumes/{id}/analyze` | Actual retrieved job or manual description, version required |
| PATCH | `/api/resumes/{id}/suggestions/{suggestion_id}` | Save an individual approval/rejection/reset |
| POST | `/api/resumes/{id}/apply` | Rebuild from original using accepted changes only |
| PUT | `/api/resumes/{id}/revision` | Save factually reviewed editor text |
| POST | `/api/resumes/{id}/restore` | Restore original and reset decisions |
| POST | `/api/resumes/{id}/export` | Authenticated DOCX/TXT binary download |
| GET / PUT / DELETE | `/api/profile/linkedin` | Review, correct, consent to storage, remove |
| POST | `/api/profile/linkedin/upload` | Parse the student's own supported export |
| GET / POST | `/api/profile/linkedin/public-search` | Restore preview / retrieve exact-URL public search snippets |
| POST | `/api/profile/linkedin/automatic` | Start consent-based official OAuth connection |
| GET | `/api/profile/linkedin/callback` | Single-use member authorization callback |
| GET | `/api/profile/linkedin/connection` | Restore latest own result after navigation/refresh |
| GET / DELETE | `/api/profile/linkedin/connection/{id}` | Own connection result / clear receipt |
| GET / POST | `/api/roadmap/tasks` | Filter/sort own tasks with actual counts / create |
| PATCH / DELETE | `/api/roadmap/tasks/{id}` | Versioned edits/status/deletion |
| GET | `/api/roadmap/skills` | Existing canonical skill choices |
| GET | `/api/roadmap/milestones/{id}` | Owned linked-milestone details |

## Files and dependencies

Backend additions: `app/routes/workspace.py`, `app/services/resume_enhancer.py`, `app/validation.py`, `tests/test_workspace.py`, `scripts/verify_workspace_browser.py`. Modified `app/models.py`, `app/schemas.py`, and `app/main.py` for additive persistence, response contracts, routes, private cache headers, and controlled validation.

Frontend additions: `src/app/resume.tsx`, `src/components/career-roadmap.tsx`, `src/components/workspace-controls.tsx`, `src/utils/resume-workspace.ts`, native/web download and picker-cleanup helpers, and `tests/resume-workspace.test.cjs`. Modified navigation, My journey, Jobs, typed contracts, API client, and the existing resume upload component to reuse the picker/validation flow. Reused the current dark design, `Card`, `Action`, existing parser, job APIs, milestone progress endpoint, and canonical skills.

Added SDK-compatible `expo-file-system ~57.0.7` and `expo-sharing ~57.0.22` via `npx expo install` for private native cache-file export and the device save/share dialog. The existing DocumentPicker module is reused. Web downloads use an authenticated Blob, not native local-file sharing, consistent with [Expo Sharing SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/sdk/sharing/). File handling follows [Expo FileSystem documentation](https://docs.expo.dev/versions/latest/sdk/filesystem/) (the published page identifies version 57.0.7) and installed SDK types. No additional Python runtime packages or environment variables are needed. Existing backend credentials and `EXPO_PUBLIC_API_URL` remain in use.

## Verification performed

| Boundary/check | Result and evidence |
| --- | --- |
| Backend suite | 89 passed with `APP_ENV=test`; one existing Starlette/httpx deprecation warning |
| Frontend helpers | 5 passed: existing market helpers plus upload/date validation |
| TypeScript and lint | `npx tsc --noEmit` and `npx expo lint` passed |
| Production web | Expo export passed, including `/linkedin`, `/resume`, `/jobs`, `/market`, and existing routes |
| Browser → upload API → database → UI | Actual TXT file selected through DocumentPicker, parsed original returned and privately persisted |
| Decisions → revision → download | Individual reject/accept, explicit application, editing, factual approval, save, real DOCX download; downloaded document reparsed to exactly the approved editor text |
| Official LinkedIn connection | Nine tests covering official token/userinfo request shapes, consent, owner isolation, expiry, replay, cancellation, provider failures, response bounds and callback log redaction; no live credentials used. Browser verified new heading, removed copy, actionable missing-configuration response, preserved editor and desktop/mobile widths. |
| LinkedIn → combined analysis → deletion | Actual pasted fixture profile with consent, source-backed confirmation, removal invalidating derived analysis while preserving revision |
| Persistence → re-login → UI | Browser refresh, actual login again, saved workspace reopened with identical revision |
| Roadmap/task API → database → UI | Linked create, complete, Completed filter, reopen, edit, delete confirmation; live counts; milestone remained not started while task completed |
| Responsive display | Desktop 1440×1000 two panels; mobile-web 390×844 stacked panels and editor, no horizontal overflow |
| Actual retrieved listing → analysis | Real previously retrieved SerpApi listing analyzed; target title/description/provenance preserved and private no-store header verified |
| Console/network | Complete acceptance run: no uncaught browser exceptions, console errors, or failed API responses |

Screenshots: [resume editor desktop](resume-editor-desktop.png), [resume editor mobile web](resume-editor-mobile-web.png), [source evidence](resume-evidence-desktop.png), [roadmap and tasks desktop](roadmap-tasks-desktop.png), [tasks mobile web](roadmap-tasks-mobile-web.png). Screenshots use explicitly synthetic QA text; test workspaces, tasks, and imported profile were removed afterward. The CDP acceptance script requires Chrome on local port 9473 and does not print credentials or tokens.

Remaining limits: physical Android/iOS picker and save/share behavior has not been device-tested; mobile-web was verified. PDF parsing/export, complete LinkedIn career-history retrieval, and LLM rewriting are not implemented or presented as working. The official basic-member OAuth integration is covered by synthetic provider tests; live member authorization previously succeeded with locally configured credentials and a registered HTTPS callback. DOCX generation uses a simple text-based layout, not reproduction of the uploaded visual design. Text dictionary/heading extraction has limited coverage and asks students to review source evidence. Production multi-user onboarding and hardened authentication remain outside this existing local prototype's authentication model.

## Separate analyzer and resume statistics update

Resume statistics are backend-computed response fields on every saved resume, available before target-job analysis. Both the immutable original and saved revision show strength (0?100), word/character counts, bullet counts, distinct supported skill mentions, nonempty section coverage, action-statement counts and quantified-statement counts. The screen compares scores and supplies revision-specific improvement prompts. Unsaved edits do not change statistics; saving, applying suggestions or restoring the original recalculates them. LinkedIn/profile/assessment text never contributes to these resume-only statistics.

`resume-text-strength-v1`: 15 points each for nonempty Education, Skills, Experience and Projects sections; 20 for at least one recognized action statement in Projects/Experience; 20 for at least one such statement containing a numeric outcome or scale. Dates and telephone numbers alone receive no outcome credit. The exact limited rubric is visible; this is separate from the existing job alignment estimate and does not assess factual accuracy, visual layout, or a commercial ATS. Optional sections should only be added when applicable to the student's actual background.

Changed files for this update: `backend/app/schemas.py`, `backend/app/services/resume_statistics.py`, `backend/tests/test_resume_statistics.py`, `backend/scripts/verify_resume_statistics_browser.py`, `backend/scripts/verify_workspace_browser.py`; `mobile/src/app/resume.tsx`, `mobile/src/app/linkedin.tsx`, `mobile/src/components/resume-statistics.tsx`, both `app-tabs` implementations and `mobile/src/types/contracts.ts`; this report and README. No dependencies, environment variables or database migrations were added. Custom Expo Router tabs provide all six student destinations on web and native. Resume state refreshes on tab focus so profile edits cannot leave an obsolete analysis/version active while local editor text is preserved.

Validation: 89 backend tests passed using `APP_ENV=test` (the local development configuration requires authentication, while older endpoint tests assume test mode); TypeScript and Expo lint passed; web export includes `/linkedin`. The new real-browser acceptance script verified separate visible screens, original 85 ? saved revision 100 with +15 change, unchanged unsaved statistics, saved profile preservation, navigation back to saved resumes, desktop/mobile widths and no console/network errors. It removed its synthetic resume afterward and did not alter the user's LinkedIn data. Screenshots are local ignored files in `docs/.workspace-downloads/`. Run the script as `python -m scripts.verify_resume_statistics_browser` from backend with Chrome debugging on port 9473 and the local servers running.

Known limits: physical native navigation and rendering have not been device-tested. Text statistics depend on the recognized heading/skill/action dictionaries and cannot verify claims. Recommended next task: physical Android/iOS acceptance for navigation, picker and resume sharing.

## LinkedIn contextual career intelligence

The separate analyzer now computes `evidence-coach-v1` reports from the saved profile: a grounded narrative summary, text-quality rubric, section gaps, skill evidence with exact excerpts, contribution/quantified-outcome counts, curated career-direction comparisons, prioritized coaching, headline starting points and conservative wording revisions. Expanded recognition includes data, web/backend and cloud tools without changing the shared assessed-proficiency dictionary. Each skill retains unknown proficiency (`null`); an action example is not an assessment. Metadata/URL terms and negative or hypothetical claims are excluded. Repeated statements do not inflate action/outcome counts. No employment title, qualification, duration or metric is invented.

Select Data Analyst, Machine Learning Engineer, Full Stack Developer, Backend Developer or Cloud / DevOps Engineer, optionally paste a job description, and click **Analyze my LinkedIn profile**. `POST /api/profile/linkedin/analyze` reads only the authenticated owner's consented saved text. The response compares supported target skills and applied examples; a supplied description replaces the curated template. No profile, resume version, competency, task or third-party service is modified by analysis. Reports refresh after saving/importing profile text; local target reports reset when target inputs or saved profile change. Target reports are session-only; base insights are reproducible on every profile GET/save response. Unsaved editor changes are excluded and identified by the UI.

The quality score uses six nonempty sections (10 points each), one contribution example (20) and one measured-impact statement (20). Scores are withheld for insufficient text and for reviewed public search snippets, whose omissions cannot support a whole-profile completeness judgment. Career-template coverage is a percentage of skill mentions in supplied text, not a current labour-market measurement or hiring prediction. The UI names these boundaries and the rule-based engine. There is no language-model API call, additional credential, runtime dependency or migration.

Improvement actions can be saved individually to the existing roadmap to-do list via the student's explicit button click. Wording and headline suggestions are presented for review; they never replace profile text automatically.

Files changed: `backend/app/services/linkedin_insights.py`, `backend/app/schemas.py`, `backend/app/routes/workspace.py`, `backend/tests/test_linkedin_insights.py`, `backend/scripts/verify_linkedin_insights_browser.py`; `mobile/src/types/contracts.ts`, `mobile/src/api/client.ts`, `mobile/src/app/linkedin.tsx`, `mobile/src/components/linkedin-insights.tsx`; README and this report.

Validation: 95 backend tests with `APP_ENV=test`, TypeScript, Expo lint and web export passed. Tests cover contextual versus bare skill evidence, supported role comparisons, specific descriptions, no recognized requirements, partial snippets, metadata exclusion, duplicates, negative/hypothetical claims, no invented titles, unknown proficiency, ownership, admin rejection, input validation, private no-store headers and read-only analysis. Real browser checks passed for the existing saved profile, target selection, a pasted description, exact preservation of editor text, desktop and mobile widths, and no console exceptions or failed API responses. Browser screenshots are ignored local QA artifacts; the script did not modify existing profile data or create tasks. Backend was restarted with the new endpoints.

Known limits: the coaching uses conservative rules and bounded dictionaries rather than semantic language-model reasoning; unsupported skills and unusual section headings may be missed. Native-device acceptance remains outstanding. Recommended next task: broaden extraction against consented profile/export examples and collect feedback on coaching priorities.

Numbered/Markdown headings and Featured/Selected Projects are recognized. Project-stack mentions receive a separate project_context label rather than being treated as action statements or assessed skill levels. A visual check of the existing saved profile revealed these formats and prompted regression tests; section and project/contribution-context detection was rechecked against that text.
