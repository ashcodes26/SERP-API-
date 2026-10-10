# AIMORA

A mobile-first career-readiness prototype for the SerpApi Hackathon: synthetic student evidence → target role → explainable skill gaps → learning resources → assessment → updated readiness.

## Requirements

- Python 3.12 (tested)
- Node.js 22.13 or newer for Expo SDK 57
- Backend runtime dependencies: root `requirements.txt`, which includes `backend/requirements.txt`
- Backend test dependencies: `backend/requirements-dev.txt`
- Frontend dependencies: `mobile/package.json` and `mobile/package-lock.json`

## Backend setup (PowerShell)

From the repository root:

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r requirements.txt
Copy-Item backend/.env.example backend/.env
```

Set independent random values for `AUTH_SIGNING_KEY`, `ADMIN_PASSWORD`, and `DEMO_PASSWORD` in `backend/.env`. Leave `APP_ENV=development` for the local demo. Add `SERPAPI_API_KEY` there to enable live search; otherwise roadmap resources use clearly labelled curated fallback. All credentials stay backend-only.

```powershell
cd backend
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Health: http://127.0.0.1:8000/api/health. API documentation: http://127.0.0.1:8000/docs.

## Frontend setup (second terminal)

```powershell
cd mobile
npm.cmd ci
Copy-Item .env.example .env
npx.cmd expo start --web --port 8081
```

Set `EXPO_PUBLIC_API_URL=http://127.0.0.1:8000` for local web development. Open http://localhost:8081. Sign in as `demo` using the backend's `DEMO_PASSWORD`, or `admin` using `ADMIN_PASSWORD` for CSV/XLSX imports. Tokens are held in memory.

For a physical phone, use the computer's LAN IP in `EXPO_PUBLIC_API_URL` and bind FastAPI to `0.0.0.0` on a trusted LAN.

## Checks

```powershell
cd backend
.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
$env:APP_ENV = 'test'
.venv/Scripts/python.exe -m pytest
```

`APP_ENV=test` is only for isolated tests; do not run a network server in that mode.

```powershell
cd mobile
npx.cmd tsc --noEmit
npx.cmd expo lint
npx.cmd expo install --check
npx.cmd expo export --platform web
```

Latest verification: 35 backend tests passed; frontend TypeScript, lint, dependency compatibility, and web export passed. Desktop sign-in visually inspected. Device acceptance and live SerpApi verification remain outstanding. See [frontend redesign report](docs/FRONTEND_REDESIGN.md).

## Current scope

Implemented: synthetic profile, seeded role comparison, deterministic skill gaps/readiness, SerpApi resource/job-posting search, resource roadmap, SQL/Python/Docker quizzes, dashboard, prototype authentication/ownership checks, and development-only admin CSV/XLSX imports.

Incomplete: resume extraction/ATS, free-text job-description analysis, SWOT generation, interview practice, production student accounts, full offline mobile operation, and production deployment hardening. Readiness is informational, never an employment probability. Use synthetic records only.

`.env` files, credentials, databases, virtual environments, installed dependencies, build output, and local browser profiles are excluded from Git. Commit `.env.example` files only.
