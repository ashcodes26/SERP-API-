# Skillup

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

Latest verification: 95 backend tests and 5 frontend helper tests passed; TypeScript, lint, and web export passed, including `/linkedin`, `/resume`, `/jobs`, and `/market`. The Resume Enhancer, optional user-supplied LinkedIn context, and milestone-linked to-do list passed full browser acceptance, including real DOCX download and refresh/re-login persistence. Actual stored SerpApi listing analysis was also verified. Physical-device picker and native share acceptance remains outstanding. See [resume/profile/roadmap report](docs/RESUME_PROFILE_ROADMAP.md), [industry insights report](docs/INDUSTRY_SKILL_DEMAND.md), [job discovery handoff](docs/JOB_DISCOVERY_HANDOFF.md), and [frontend redesign report](docs/FRONTEND_REDESIGN.md).

## Current scope

New: **Skill demand** (`/market`) combines retained job-search samples into distinct-job rankings, role comparisons, and personal evidence/learning priorities. The Jobs resume panel accepts actual TXT/DOCX uploads (1 MiB maximum). See [industry skill demand report](docs/INDUSTRY_SKILL_DEMAND.md) for calculations, endpoints, component adaptations, setup, and checks.

Implemented: synthetic profile, seeded and retrieved-job comparison, deterministic skill gaps/readiness, authenticated SerpApi job discovery with cache and bounded pagination, retrieved-page skill insights, pasted-text resume advice, progress-preserving role roadmaps, SQL/Python/Docker quizzes, dashboard, prototype authentication/ownership checks, and development-only admin CSV/XLSX imports. Open **Jobs & insights** after signing in. Live job discovery requires `SERPAPI_API_KEY`; without it, the UI displays an explicit configuration error.

Incomplete: PDF resume extraction/ATS evaluation, free-text job-description analysis, SWOT generation, interview practice, production student accounts, full offline mobile operation, and production deployment hardening. Resume body-text extraction supports TXT/DOCX. Readiness is informational, never an employment probability. Use synthetic records only.

`.env` files, credentials, databases, virtual environments, installed dependencies, build output, and local browser profiles are excluded from Git. Commit `.env.example` files only.

Resume Enhancer now focuses on resume upload, original-versus-revised strength statistics, target analysis, reviewed improvements and export. **LinkedIn Analyzer** is a separate `/linkedin` tab for public lookup, profile editing, saved skill/section analysis and official basic-member connection. Text strength uses a displayed deterministic rubric, separate from job alignment. Desktop/mobile-web navigation and saved-statistics updates passed browser acceptance; no additional configuration is needed.

LinkedIn Analyzer now offers contextual career coaching: skill evidence and impact checks, profile text quality, target-role or pasted-description comparisons, prioritized improvements, grounded wording suggestions and explicit roadmap actions. Analysis uses saved consented text and clearly labels partial public-search data; no extra API key is required.
