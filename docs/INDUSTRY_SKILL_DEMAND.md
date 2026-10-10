# Industry skill demand and resume upload

## Features and entry points

Sign in and select **Skill demand**, or open `http://localhost:8081/market`. The dashboard supports demand ranking, two/three-role comparison, and the authenticated student's evidence comparison. It displays distinct-job counts, percentages, active filters, collection freshness, source jobs, data provenance, warnings, and loading/error/empty/insufficient-data states. **Apply filters** and chart interactions read collected data only. **Collect jobs for this role & location** explicitly uses the existing cached SerpApi discovery flow.

Personal recommendations distinguish present, missing, and unverified competencies; show available curated learning links and existing roadmap progress; and explain their deterministic priority. Retrieved-role roadmaps now use the selected role's deduplicated collection scope as a demand tie-breaker, without replacing existing progress.

The Jobs screen's existing resume feedback now also accepts real **UTF-8 TXT and DOCX** files after selecting and matching a listing. Maximum upload size is **1 MiB**, with **30–20,000 extracted characters**. PDF is explicitly unsupported. The native/web document picker uploads to the backend; loading lasts until parsing/advice succeeds or fails. Existing pasted text and successful advice are preserved. No resume file or text is retained or sent to SerpApi. No ATS score or fabricated progress is shown.

## Calculation and data boundaries

`demand_percentage = distinct_jobs_mentioning_skill / total_distinct_jobs_analyzed * 100`

Each normalized skill counts once per distinct job. Required/preferred/mentioned classification uses the strongest observed qualifier per job. Canonical URL identity retains meaningful vacancy query parameters and strips fragments and known tracking parameters. A stable provider-identity hash links changed descriptions; intersecting identity groups merge transitively. The latest collected content is used per distinct listing. Legacy records without reliable IDs/URLs use a conservative title/company/location fallback, which can still merge lookalike jobs. Aliases use AIMORA's central dictionary.

Only retained discovery snapshots are analyzed, currently bounded to 200 cache records. Role/location filters match normalized **search scopes** rather than asserting exact title/workplace matches. Collection dates are inclusive UTC boundaries in the UI and filter retrieval timestamps, not posting dates. The dashboard reports first/latest collection time. It does not verify availability or employer legitimacy. Samples below five jobs, or without recognized skills, are marked insufficient. No recognized mentions in a nonempty comparison sample yield 0%; no collected jobs yield null/unavailable. Neither establishes whole-market demand.

Student classification:

- **Present:** recorded evidence and known proficiency above zero.
- **Missing:** recorded evidence with an explicit zero proficiency level.
- **Unverified:** absent competency, null level, or unsupported proficiency; never interpreted as proof of absence.

Coverage is present skills / all observed skills × 100, or null when no observed skills exist. It is not readiness, eligibility, or a hiring probability. The web radar shows up to six skills with known, evidenced proficiency, with a 0–100 axis: demand frequency percentage and level / 5 × 100. These are distinct measures; their geometric difference is not a skill gap. Unknowns are excluded from the chart and retained in the accessible list. Fewer than three known axes produces an explanatory unavailable state. Native platforms use the same values in the list rather than importing DOM-only Recharts.

Recommendation priority is `demand_fraction × (1 + 0.5 × required_mention_fraction) × action_weight`, where learn=2, assess=1.5, maintain=0.25. Explicit observed proficiency targets can identify an evidenced competency below target; targets are never inferred from mention frequency. Existing tasks remain visible with their status and evidence.

## APIs and files

All routes use existing authentication. Personal analytics derives student identity from the authenticated principal and accepts no student selector. Admin personal access returns 403. Existing credentials and token signing are preserved.

| API | Behavior |
|---|---|
| `GET /api/market/skills` | Aggregate collected data; optional `role`, `location`, `collected_after`, `collected_before` |
| `GET /api/market/skills?search_id=...` | Existing one-page contract preserved |
| `GET /api/market/scopes` | Available collected roles/locations |
| `GET /api/market/skills/compare?roles=Role A,Role B` | Compare two/three roles with location/date filters |
| `GET /api/market/skills/me` | Own-profile comparison, coverage, priorities, resources, and tasks |
| `POST /api/jobs/{job_id}/resume-upload` | Multipart `student_id` and `file`, ownership checked, actual parsed-text advice |

New backend files: `app/services/market.py`, `app/services/resume_files.py`, `tests/test_market.py`, and `scripts/verify_market_browser.py`. Modified backend files: schemas, discovery normalization, jobs routes, and learning service. No database migration or new backend dependency is needed: stable identity is additive JSON metadata, and parsing uses the Python standard library.

New frontend files: `src/app/market.tsx`, `src/components/market-controls.tsx`, `market-radar.tsx`, `market-radar.web.tsx`, `resume-upload.tsx`, `src/utils/market-data.ts`, and `tests/market-data.test.cjs`. Modified: contracts, API client (including correct multipart headers), Jobs resume section, native/web tabs, package manifests/lockfile, and `.gitignore` for the isolated browser profile. README links this report. Existing uncommitted discovery work is preserved; no commit/push was made.

## Supplied component patterns

- Radar: [Recharts RadarChart](https://recharts.github.io/en-US/api/RadarChart/), with ResponsiveContainer, polar axes, two labelled series, Tooltip, Legend, and an accessible list. Web-only import via platform file.
- Leading-icon button group: native accessible radio controls for ranking/roles/student views with selected state.
- Advanced dropdown: an accessible dismissible modal with selection state, separated actions, reload, reset, and implemented web CSV download. No unrelated/nested placeholder actions.
- Circular progress: native/web SVG ring calculated from actual coverage, with text and accessibility values.
- File input: adapted from the supplied InputFile API pattern to the already-installed [Expo SDK 57 DocumentPicker](https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/). The inspected [upstream InputFile](https://github.com/untitleduico/react/blob/main/components/base/input/input-file.tsx) depends on web InputBase/InputGroup/Button utilities absent here. No upstream component source was copied; independent controls match existing AIMORA styling. The upstream repository's [MIT license](https://github.com/untitleduico/react/blob/main/LICENSE) was checked.

Added frontend dependencies: **recharts 3.10.1** for the web chart, **react-native-svg 15.15.4** for the cross-platform coverage ring, installed using `npx.cmd expo install` for SDK compatibility. Untitled UI, React Aria, and Tailwind were not added. Dependency installation reported 29 audit findings (11 moderate, 18 high); no blind or breaking audit fix was applied. The web export bundle is about 2.2 MB; production bundle optimization remains future work.

## Setup, checks, and limits

No new environment variables. Continue using backend-only `SERPAPI_API_KEY`, existing authentication/CORS settings, and existing cache/timeout settings. The locally configured provider timeout remains 45 seconds. Restart FastAPI after changes; Metro serves the frontend. See [README](../README.md) for Windows setup/run commands. The backend must have outbound network permission for explicit collection; aggregation works from stored data without external requests.

Executed checks: **62 backend tests passed** (49 baseline plus 13 new), **3 frontend helper tests passed**, TypeScript passed, Expo lint passed, and static web export passed with seven routes including `/market`. Tests cover aliases, deduplication/version changes, counts/percentages, scopes/dates, zero versus unavailable, authenticated ownership, provider-free chart interactions, progress preservation, null radar handling, filter construction, CSV escaping, TXT/DOCX parsing, corrupt/unsafe/oversized files, real multipart processing, and no resume content in evidence storage/logs. Existing provider failure/cache/quota tests remain green. One upstream Starlette/httpx test-client deprecation warning remains.

Browser acceptance passed against the running app and retained live listings: demo login, ranking, API-driven empty location filter, reset through the actions menu, student coverage/radar, mobile viewport, and insufficient role-selection state. The final browser run reported no uncaught exceptions or console errors. Desktop/mobile screenshots were visually inspected; fixes removed an SVG DOM-property warning and shortened a clipped radar label while preserving its full name in the accessible list. Artifacts: [ranking desktop](market-ranking-desktop.png), [student desktop](market-student-desktop.png), [student mobile web](market-student-mobile-web.png). Actual TXT/DOCX multipart upload and parser failures were verified through API acceptance tests; document-picker interaction on physical devices remains unverified.

Re-run from `backend`: `$env:APP_ENV='test'; .venv/Scripts/python.exe -m pytest`. From `mobile`: `node --test tests/market-data.test.cjs`, `npx.cmd tsc --noEmit`, `npx.cmd expo lint`, and `npx.cmd expo export --platform web`.

The browser acceptance script requires a locally launched Chrome CDP test session on port 9473, the development site on port 8081, and a configured demo password. It reads credentials locally without printing them. Device build testing is separate from a mobile-width browser check. Resume parsing handles document body text only, with no OCR, PDF support, formatting assessment, or external ATS integration. Collection history is bounded by cache retention, not an exhaustive historical database. Saved jobs/application tracking/interviews remain outside this enhancement.
