# Skillup

Skillup is a mobile-first career-readiness prototype built for the SerpApi Hackathon. It helps a student explore job listings, compare their evidence with a target role, review honest resume improvements, plan learning, and track progress. Readiness scores are informational evidence-coverage indicators, not employment predictions.

## Implemented features

| Area | What is available |
| --- | --- |
| Jobs & insights | Authenticated SerpApi `google_jobs` search with location, keyword, career-stage filters, bounded pagination, caching, source links, and explicit provider failures. Listings are normalized before use and can be compared with a synthetic student profile. |
| Skill demand | Retained job-search samples are grouped into distinct-job skill rankings, role comparisons, and personal learning priorities. |
| Resume Enhancer | Upload or paste a TXT/DOCX resume, select a target role or retrieved job, inspect explainable alignment checks, review each suggested change, save a confirmed revision, restore the original, and export DOCX or TXT. The screen shows one revision editor and one saved-revision statistics summary; uploaded text is not repeated as read-only or parsed-section dumps. |
| LinkedIn Analyzer | Save supplied career information or a TXT/DOCX profile export, optionally retrieve public indexed excerpts through SerpApi, use official LinkedIn OpenID Connect when configured, compare the saved profile with a target role, and add grounded improvement tasks. The editable source text is not repeated in a separate analysis dump. |
| Learning & roadmap | Explainable skill gaps, curated fallback resources when live resource search is unavailable, Python/SQL/Docker assessments, milestone progress, and student-owned roadmap tasks. |
| Privacy & ownership | Prototype sign-in, student-scoped records, consent/confirmation for saved resume and profile text, and development-only admin CSV/XLSX import. Provider keys remain on the backend. |

## Requirements

- Python 3.12 or later
- Node.js 22.13 or later (Expo SDK 57)
- A SerpApi key for live job discovery and public-profile lookup

## Run locally

### 1. Configure and run the backend

From the repository root in PowerShell:

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r requirements.txt
Copy-Item backend/.env.example backend/.env
```

Set independent values for `AUTH_SIGNING_KEY`, `ADMIN_PASSWORD`, and `DEMO_PASSWORD` in `backend/.env`. Leave `APP_ENV=development` for a local demo. Set `SERPAPI_API_KEY` to enable live jobs and public-profile lookup. If the provider regularly needs longer than the default 10 seconds, increase `SERPAPI_TIMEOUT_SECONDS` (for example, `30`).

```powershell
cd backend
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Backend health: http://127.0.0.1:8000/api/health
API documentation: http://127.0.0.1:8000/docs

### 2. Configure and run the frontend

In a second PowerShell window:

```powershell
cd mobile
npm.cmd ci
Copy-Item .env.example .env
npx.cmd expo start --web --port 8081
```

Set `EXPO_PUBLIC_API_URL=http://127.0.0.1:8000` in `mobile/.env`, then open http://localhost:8081. Sign in as `demo` with the `DEMO_PASSWORD` set in `backend/.env`; use `admin` and `ADMIN_PASSWORD` for the import workflow.

For a physical device, use the computer's trusted-LAN address in `EXPO_PUBLIC_API_URL` and bind FastAPI to `0.0.0.0`.

## Verify changes

```powershell
cd backend
.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
$env:APP_ENV = 'test'
.venv/Scripts/python.exe -m pytest
```

`APP_ENV=test` is for isolated tests only. Do not run the development server in that mode.

```powershell
cd mobile
npx.cmd tsc --noEmit
npx.cmd expo lint
npx.cmd expo install --check
npx.cmd expo export --platform web
```

## Current limits

- Resume extraction supports TXT and DOCX only; PDF/image extraction and ATS scoring are not implemented.
- Free-text job-description extraction, SWOT generation, interview practice, production accounts, offline-first mobile support, and production deployment hardening are outside the current prototype scope.
- Search listings may be stale or incomplete. Skillup does not verify that an opening remains active.
- Public profile results are limited to indexed, public information and are labeled as such. Supplied skill mentions do not establish assessed proficiency.
- Use synthetic data for the demo. Do not store real student data in prototype imports.

## Project structure

- `backend/` — FastAPI, SQLAlchemy, SQLite, SerpApi integration, and tests
- `mobile/` — Expo Router / React Native web and mobile client
- `docs/` — product handoffs, implementation notes, and verification evidence

`.env` files, credentials, databases, virtual environments, installed dependencies, build output, and local browser profiles are ignored by Git. Commit only `.env.example` files.
