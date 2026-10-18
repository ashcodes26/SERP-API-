# Stage 3F Acceptance Verification

## Acceptance result

**Not accepted for Stage 4 implementation or release sign-off.** Automated regression, type, lint, static-export, and backend evidence are healthy, but the P1 acceptance criteria require rendered, authenticated browser/device verification. This environment has no available browser, emulator, or device surface, so those checks were not executed and cannot be marked passed.

No application source was changed. No visual defect was reproducible without a rendered UI, so no speculative fix was applied.

## Browser and device coverage

| Surface | Result | Evidence |
|---|---|---|
| Browser automation | Blocked | `cua.getState()` returned `apps: []` and `browsers: []`. |
| Emulator/simulator | Blocked | No device/emulator surface was exposed to the QA runtime. |
| 360px viewport | Not executed | Requires a browser/device surface. |
| 768px viewport | Not executed | Requires a browser/device surface. |
| 1440px viewport | Not executed | Requires a browser/device surface. |
| Screen reader | Not executed | No appropriate OS/browser assistive-technology surface was available. |

An Expo shell, HTTP response, static route, or source inspection is **not** treated as proof that an authenticated rendered workflow works.

## Reliable local QA environment (persistent Windows PowerShell)

Use two persistent PowerShell terminals. The commands below keep QA data isolated from `backend/aimora.db` and use only the synthetic demo record plus a QA faculty account.

### Terminal 1 — isolated backend and synthetic accounts

```powershell
Set-Location "C:\Users\Shirivarshini A\OneDrive\Desktop\SERP API\SERP-API-\backend"

# Isolated local database. Do not point this at aimora.db or a production database.
$env:APP_ENV = 'development'
$env:DATABASE_URL = 'sqlite:///./skillup-qa.db'
$env:AUTH_SIGNING_KEY = 'replace-with-a-local-qa-only-random-secret-at-least-32-characters'
$env:DEMO_PASSWORD = 'replace-with-a-local-qa-only-demo-password'
$env:DEMO_LOGIN_BYPASS = 'false'
$env:SERPAPI_API_KEY = ''
$env:GEMINI_API_KEY = ''
$env:CORS_ORIGINS = 'http://localhost:8081,http://127.0.0.1:8081'

# Initialise and seed only the synthetic student/role into skillup-qa.db.
.\.venv\Scripts\python.exe -c "from app.db import init_db, SessionLocal; from app.services.demo_seed import seed_demo; init_db(); db=SessionLocal(); seed_demo(db); db.commit(); db.close()"

# Run once; prompts privately for a QA-only faculty password.
.\.venv\Scripts\python.exe -m scripts.manage_accounts create-admin --username qa-faculty

# Run once; grants qa-faculty access only to the synthetic demo student in this QA DB.
.\.venv\Scripts\python.exe -m scripts.manage_accounts grant --username qa-faculty --student-id AIMORA-DEMO-001 --cohort "QA CSE 2028 A" --department CSE --batch 2028 --section A

.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Sign in as student with username `demo` and the QA-only `DEMO_PASSWORD`; sign in as faculty with `qa-faculty` and the privately entered QA password. Leave live SerpApi, Gemini, and LinkedIn variables unset to test their documented unavailable/fallback states without sending data externally.

### Terminal 2 — Expo web

```powershell
Set-Location "C:\Users\Shirivarshini A\OneDrive\Desktop\SERP API\SERP-API-\mobile"
$env:EXPO_PUBLIC_API_URL = 'http://127.0.0.1:8000'
npx.cmd expo start --web --port 8081
```

Open `http://localhost:8081` in Chrome. Use a normal profile for the student and an Incognito/second browser profile for faculty so tab-scoped sessions do not overlap.

### Test-only provider conditions

- **Gemini:** blank `GEMINI_API_KEY` verifies unavailable-configuration and consent guidance. Mocked success/timeout/quota/malformed responses are covered by backend tests; do not send personal content to a live provider during acceptance.
- **SerpApi/public LinkedIn lookup:** blank keys verify visible unavailable/fallback errors. Backend tests cover provider timeout/quota/malformed and safe result handling.
- **Synthetic records only:** create cohorts/import rows only in `skillup-qa.db`; delete the QA database after acceptance if desired. Never run the setup against `aimora.db`.

## Checks passed

| Check | Result | Evidence |
|---|---|---|
| Frontend regression tests | Pass — 20 tests | `mobile: npm.cmd test` |
| TypeScript | Pass | `mobile: npx.cmd tsc --noEmit` |
| Expo lint | Pass | `mobile: npm.cmd run lint` |
| Web static export | Pass | `mobile: npx.cmd expo export --platform web`; Expo exported all 11 routes including student, faculty, login, and import routes. |
| Backend suite | Pass — 176 tests, 0 failures/errors/skips | Latest Stage 3F JUnit execution with `APP_ENV=test`; isolated backend test suite includes imports, role scopes, placement, provider failures, document validation, and exports. |
| Student/faculty route restrictions | Pass (automated) | Existing role-routing tests cover intended deep links, section precedence, and unauthorized route redirection. |
| Faculty section precedence | Pass (automated) | Existing test confirms explicit valid `section` wins over student-detail fallback. |
| Focus/reduced motion safeguards | Present in source, not rendered-verified | `global.css` includes `:focus-visible` and reduced-motion styles. |

## Checks failed or blocked

| Severity | Check | Result | Reproduction / evidence |
|---|---|---|---|
| P1 | Authenticated responsive UI at 360px | Blocked | No browser/device surface to render or resize the app. |
| P1 | Authenticated responsive UI at 768px | Blocked | No browser/device surface to render or resize the app. |
| P1 | Authenticated responsive UI at 1440px | Blocked | No browser/device surface to render or resize the app. |
| P1 | Student/faculty end-to-end flows | Blocked | No interactive browser surface; no real or synthetic placement records were modified. |
| P1 | Keyboard/focus traversal and screen-reader behavior | Blocked | Source safeguards exist, but no rendered assistive-technology environment was available. |
| P2 | Expo compatibility | Open | `npx.cmd expo install --check` reports recommended Expo SDK 57 patch updates for `@expo/ui`, `expo`, `expo-constants`, `expo-linking`, `expo-router`, `expo-sharing`, and `expo-splash-screen`. No dependency update was made during acceptance QA. |

## Required browser acceptance procedure

Run the following only against `skillup-qa.db`.

### At every width: 360px, 768px, 1440px

1. Open student and faculty sessions separately. Confirm no page-level horizontal overflow, clipped text, hidden primary actions, or overlapping menus/dialogs.
2. Inspect typography, spacing, cards, charts, forms, error/success/loading/empty states, and active navigation indicators.
3. Keyboard-only traverse global/local navigation, account menu, buttons, inputs, radio/checkbox controls, `Details` disclosures, modals, imports, and export actions. Confirm the focus outline is visible and order is logical.
4. With reduced motion enabled, confirm navigation and controls remain usable without distracting animation.

### Student workflow

1. Login as `demo`; refresh `/`, `/resume?job_id=<seeded-id>`, `/jobs`, `/market`, and `/placement` to verify session restoration and active navigation.
2. Journey: use only synthetic text/document data; validate Profile → Alignment → Roadmap progression, revisiting completed steps, deterministic roadmap, and Gemini consent/unavailable configuration state.
3. Resume: validate PDF/DOCX/TXT and invalid inputs; test pasted text, target selection, consent gating, suggestions, replace/undo/reject, save/restore/export readiness, and native/web download UI.
4. LinkedIn: test pasted synthetic profile content, export input, invalid/empty URL lookup fallback, provider-unavailable state, confirmation, and target comparison. Do not connect a personal LinkedIn account.
5. Jobs/Market: verify loading, empty, error/retry, cached/unavailable provider language, matching, Job-to-Resume `job_id`, and Job-to-Journey handoffs.
6. Placement: verify no-data states. If QA drive/training data is intentionally created, verify written eligibility labels, application tracking, review sharing/revocation, training evidence, and assessment behavior.

### Faculty workflow

1. Login as `qa-faculty`; refresh each route: `/admin?section=overview`, `students`, `analytics`, `placement`, `reviews-training`, `reports`, `/admin?student=<id>`, and `/admin?student=<id>&section=reviews-training`. Confirm the active section matches the visible content.
2. Verify scope boundaries: only the granted synthetic student/cohort should appear in Overview, Students, filters, drill-down, drives, training, imports, and Reports.
3. Create a QA cohort and import only synthetic CSV/XLSX. Test missing cohort, invalid type, duplicate mapping, preview errors, skip duplicates, update matching records, partial issues, retry, and CSV export.
4. Verify contextual student resume reviews, cohort versus individual training assignments, drive validation, eligibility display, application updates, and reports. Do not use external application links or real student records.
5. Confirm student session redirects from `/admin` and `/admin-import`; confirm faculty session redirects from student routes.

### Screen-reader/contrast checks

1. Use NVDA/Chrome or Narrator/Edge to verify link, selected, checked, expanded, alert, polite-status, dialog, and import-step announcements.
2. Use a contrast analyzer for focus outline, muted text, selected chips, errors, successes, charts, disabled controls, and action buttons against the dark palette.
3. Record actual pass/fail observations and screenshots/video in the local QA evidence store, never in source control if they contain account/student details.

## Files changed

- `docs/audit/STAGE_3F_ACCEPTANCE.md` only.

## Release blockers and Stage 4 recommendation

The P1 acceptance gaps remain open because no actual rendered/browser/device session was available. **Do not begin Stage 4 implementation under the claim that Stage 3 visual acceptance is closed.**

Stage 4 planning may proceed only as non-implementation preparation. Begin implementation after the required synthetic-data browser acceptance procedure is completed and its actual results are appended to this document. The Expo patch-compatibility finding should be handled as a separate, reviewed maintenance task.
