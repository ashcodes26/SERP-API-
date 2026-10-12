# Placement faculty dashboard

Implemented on the existing FastAPI/SQLAlchemy/SQLite and Expo SDK 57 application. Faculty and students use `/login`; the server supplies the account role. `/admin` contains overview, student management, cohort skill gaps, drives, and training. `/placement` contains student opportunities, application tracking, faculty assignments, and explicit resume sharing.

## Setup and initial faculty account

From the repository root, install frontend dependencies with `cd mobile; npm.cmd ci`. The new dependency is the SDK-compatible `expo-secure-store`; it was installed with `npx.cmd expo install expo-secure-store`. No new backend dependency is required.

In your existing `backend/.env`, keep `AUTH_SIGNING_KEY` as a random secret of at least 32 characters. Set `DEMO_LOGIN_BYPASS=false` to use the shared login screen. The optional development-only `DEMO_PASSWORD` still supports the existing synthetic demo. `ADMIN_PASSWORD` is retired and grants no access. SerpApi/Gemini secrets stay backend-only; faculty page loads never request AI feedback.

Stop the backend and back up the existing SQLite database before upgrading. From `backend/`:

```powershell
.venv/Scripts/python.exe -c "from app.db import init_db; init_db()"
.venv/Scripts/python.exe -m scripts.manage_accounts create-admin --username placement-faculty
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The account command prompts privately for a password (12–256 characters) and confirmation. It stores a salted PBKDF2-SHA256 hash with 600,000 iterations. It cannot promote an existing student account. Database-backed login/signup attempt limits allow 30 attempts per direct peer address in a 15-minute window; forwarding headers are not trusted. Sign in at `/login` with the selected username and password; the app opens `/admin`. New faculty initially see zero assigned students.

Faculty can create an empty cohort in Overview and import CSV/XLSX records into it. Existing student access must be granted by a trusted local operator. Grant named institutional IDs, repeating `--student-id` as needed:

```powershell
.venv/Scripts/python.exe -m scripts.manage_accounts grant --username placement-faculty --student-id AIMORA-DEMO-001 --cohort "CSE 2028 A" --department CSE --batch 2028 --section A
.venv/Scripts/python.exe -m scripts.manage_accounts revoke --username placement-faculty --student-id AIMORA-DEMO-001
```

Grants check department and existing batch/section metadata; they do not dynamically include every student in a department. Revocation takes effect on the next request, including reviews and exports. A newly signed-up student is not automatically assigned to faculty.

Public signup creates students only and rejects extra fields, including `role`. Existing/imported records are backfilled with student accounts named `student-<database id>` and no password. They cannot log in until the local operator activates them:

```powershell
.venv/Scripts/python.exe -m scripts.manage_accounts set-password --username student-1
```

Use the actual database student ID from the assigned student detail response. This command also prompts privately; it invalidates earlier sessions. Account roles are never taken from browser storage. Bearer sessions expire after one hour, are checked against current database roles and activation state on every request, and are invalidated by logout/password resets. Web keeps only the bearer token in tab-scoped sessionStorage; native uses SecureStore. Restoration always calls `/api/auth/me`. Permitted deep links are retained, including faculty detail query parameters; unauthorized destinations return to the account's dashboard.

## Upgrade behavior

The upgrade is additive and idempotent (`create_all` plus student account backfill). It does not alter existing student, profile, evidence, assessment, job, roadmap, LinkedIn, or resume workspace columns. Old role-bearing tokens are invalid and users must sign in again. Existing students are students by default; no faculty credential or unrestricted faculty scope is inferred from old configuration.

New tables: accounts, explicit faculty scopes, cohorts/members, student placement metadata, import ownership, resume revisions/reviews/feedback, placement drives/applications/events, faculty training assignments, and administrative audit events, and login attempt counters. Resume revisions are captured on creation and every workspace change. The current saved revision of a legacy resume is captured when next shared, viewed in history, or changed; overwritten historical text from before this upgrade cannot be reconstructed. Student-controlled resume deletion removes the associated revision/review data through foreign-key cascades.

## Working flows and definitions

- **Overview:** applied filters restrict the same assigned scope used by student lists and CSV exports. Seven present profile fields define completion: name, email, department, program, semester, CGPA, graduation year. The dashboard displays definitions for every metric. Assessment attempts include repeat attempts; assessed students are distinct students with at least one completion. Training totals refer to this faculty's assignments; overdue means incomplete and deadline before today. Offers are explicit current `offered` application stages, with separate application and distinct-student counts. They are not accepted/joined placements and are never inferred from readiness. Follow-up flags cover incomplete profiles, pending/change-requested reviews, missing assessments, and overdue assignments.
- **Student management:** search name/institutional ID, filter department/batch/section/cohort/follow-up, and paginate (20 per UI page; API maximum 100). Student detail shows saved profile/competencies/evidence, assessments, roadmap, this faculty's training and drives/applications, and only revisions explicitly shared with this faculty.
- **CSV/XLSX:** select an owned cohort, upload, map columns, validate, review row issues, and confirm. Existing duplicates are skipped by default; explicit update requires the exact matching ID/email within faculty scope. New imported records become members of the selected cohort and are assigned to the importer. Invalid email, field length, ranges, cohort mismatches, and unassigned existing identities produce row errors. No partial scope grant occurs merely from upload. Batch/section are supported columns; absent values use the selected cohort. Imports are owned by their uploader, including status/error/retry endpoints.
- **Skill gaps:** choose cohort and stored target role. Reuses `role-alignment-v1` against current saved competencies without creating analyses or making provider calls. Unknown proficiency is excluded from means and known-gap counts. The assessed mean uses the latest quiz per student/skill, with the existing `round(score × 5)` estimate; missing assessments are separate from unknown competency data. Every aggregate can open its contributing students. The source, cohort denominator, and informational readiness disclaimer are displayed.
- **Resume review:** student selects a saved resume, assigned faculty, and sharing consent in Placement. Optional stored Gemini sharing is a separate choice. A snapshot ties text, stored suggestions, and feedback to that exact revision. Review transitions are `submitted → changes_requested` or `submitted → approved`; a changed revision must be saved and shared again. Faculty cannot edit/export the student's private workspace, and approval does not verify facts externally. Sharing can be revoked; the student retains feedback history. Existing student Replace/Undo, accept/reject, save/restore, and TXT/DOCX export behavior remains.
- **Drives/applications:** faculty create/edit cohort drives with company, role, description, deadline, HTTP(S) application link, optional minimum CGPA/departments/graduation year. Students see explainable eligibility (`eligible`, `not_eligible`, `needs_review`), use the actual external application link, then explicitly record that they applied. Tracking is not automatic submission to a company. Both students and assigned faculty can record explicit stages: applied, shortlisted, interview, offered, rejected, withdrawn. Version checks reject stale updates; withdrawal cannot be reopened. Faculty can override eligibility with a required reason. Every stage update is retained in application history.
- **Training:** assign resources, courses, projects, or existing SQL/Python/Docker assessments to the selected cohort or open student. Individual assignments can link to the owner's saved roadmap item. Students update progress and submit completion evidence. Assessment assignments open the existing quiz service and require a recorded assessment before completion. Completion is student-reported, not independent verification.
- **Reporting:** filtered CSV includes necessary identity/cohort fields, profile completion, reviewed revision status, assessment attempts, roadmap/training progress, explicit application stages/offers, and target-role known gaps/unknown levels. Choose a role in Skill gaps to include skill gaps. Exports use the same faculty restrictions and prefix dangerous spreadsheet-formula-leading cells with an apostrophe. Email, full resumes, provider keys and raw assessment answers are omitted.
- **Audit:** significant imports, scope changes, cohort/drive creation/edits, assignments, review decisions, application outcome changes, and exports record actor, action, object ID and time. Audit rows contain no credentials, resume text or feedback contents. Private routes use `Cache-Control: no-store`; new validation errors do not echo request bodies/passwords.

## Verification actually run

- `cd backend; .venv/Scripts/python.exe -m pytest -q`: **172 passed**. Includes new integration scenarios for actual signed database accounts, signup role injection rejection, logout, database role changes, cross-cohort and cross-student denial, filters/pagination, unknown proficiency, immutable shared revisions, sharing/review transitions, training evidence/quiz completion, explicit application outcomes/history, scoped import validation/duplicates, CSV formula safety, and an idempotent upgrade from a legacy student table, local account provisioning, sign-in throttling, password-safe validation, and seven formula-leading CSV cases. Older tests now inject principals explicitly where appropriate; the runtime `APP_ENV=test` authentication bypass was removed.
- `cd mobile; node --test tests/role-routing.test.cjs`: **3 passed** (role dashboards, allowed intended paths including query parameters, unauthorized destinations).
- `npx.cmd tsc --noEmit`: **passed**.
- `npx.cmd expo lint`: **passed**, no warnings/errors.
- `npx.cmd expo export --platform web --output-dir dist-placement`: **passed**, all 11 routes exported, including login/admin/placement/import.
- Backend restarted on loopback port 8000; `/api/health` returned **HTTP 200**, database **ok**.

Browser acceptance remains **unverified**: the computer-use inventory returned no browser surfaces, and opening the in-app browser reported `Browser is not available: iab`. API→SQLite→response flows were exercised with isolated synthetic records; no real student data or live provider calls were used for the new tests. No deployment was performed.

## Remaining limits and next check

This remains a single-process SQLite prototype. Reporting gathers scoped students before pagination, so large institutional datasets need database-side aggregation/pagination. Password reset/provisioning and faculty scope grants are local operator commands; there is no mail delivery, MFA, or organization-wide faculty management UI. Web bearer storage is script-accessible tab storage, not an HttpOnly-cookie production authentication deployment. Application stages and non-quiz training evidence are explicitly reported, not externally verified. Historical pre-upgrade overwritten resume revisions cannot be restored.

Recommended next check: browser acceptance on synthetic records—student and faculty login, permitted deep-link refresh, unauthorized-page redirect, import, saved revision sharing/review/resubmission, assignment quiz/completion, and drive/application updates at desktop and narrow widths. No additional provider configuration is needed for these faculty flows.

## Changed files

Backend: `app/auth.py`, `app/config.py`, `app/db.py`, `app/models.py`, `app/schemas.py`, `app/main.py`; new `routes/accounts.py`, `routes/placement.py`, `services/accounts.py`, `services/placement.py`, `scripts/manage_accounts.py`; extended `routes/workspace.py`, `services/imports.py`, `services/demo_seed.py`; integration/security test updates and new `tests/test_placement.py`.

Frontend: new `app/login.tsx`, `app/admin.tsx`, `app/placement.tsx`, `context/auth.tsx`, `api/placement.ts`, `components/app-navigation.tsx`, `components/placement-ui.tsx`, session storage and role-routing utilities/tests; extended root layout, journey, import page, API client and contracts; SDK-compatible SecureStore dependency and plugin configuration. Setup: `.env.example`, `README.md`, `.gitignore`, and this report.
