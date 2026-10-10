# AIMORA Phase 5 handoff — Expo mobile integration

## Scope delivered
- Replaced the Expo starter home screen with a responsive, accessible student workflow. The second tab now explains the working flow instead of showing Expo template documentation.
- Added a typed FastAPI career client in `mobile/src/api/client.ts`, mirroring the current backend contracts. Reused the existing request timeout/structured error handler.
- User-triggered `POST /api/demo/seed` initializes **synthetic only** student and seeded role. Loads `GET /api/profile/{id}` and `POST /api/job/analyze`, then `POST /api/skill-gap/analyze`.
- Shows alignment, evidence coverage, confidence, rationale and top priority skill gaps with unknown skill levels displayed as unknown.
- Loads `GET /api/roadmap/{id}` with source provenance (`serpapi_live` versus `curated_fallback`); links open via native Linking. Roadmap persistence remains backend-owned.
- Fetches server-defined SQL/Python/Docker quiz, validates all answers are chosen, submits `POST /api/assessment/submit`, then refreshes `GET /api/dashboard/{id}`. UI does not know answer keys.
- Includes busy, empty, explicit error/retry and restart states; no hardcoded server result and no silent demo fallback. Data mode is explicitly synthetic.

## Files modified
- `mobile/src/api/client.ts`
- `mobile/src/app/index.tsx`
- `mobile/src/app/explore.tsx`
- `mobile/src/components/app-tabs.tsx`
- `docs/PHASE5_HANDOFF.md`

Backend API, database schema, schema contracts, tests, dependencies and SerpApi service were left unchanged.

## Run
```sh
cd backend
python -m pip install -r requirements-dev.txt
python -m pytest -q
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
In a separate terminal:
```sh
cd mobile
npm ci
# set EXPO_PUBLIC_API_URL in .env to http://YOUR_LAN_IP:8000 on a physical device
npx tsc --noEmit
npx expo lint
npx expo start
```
Physical Android devices cannot use `localhost` to address the development computer. Use an address reachable from the device. Keep `SERPAPI_API_KEY` only in `backend/.env`. Backend and phone must be on a reachable network. The demo requires the backend; a disconnected phone receives a useful retry/error, not fabricated live responses.

## Verification
- Backend `python -m pytest -q`: **26 passed**.
- Expo SDK 57 docs consulted for existing project SDK and navigation version.
- `npm ci --no-audit --no-fund` attempted but did not finish before environment timeout (dependencies unavailable). `tsc --noEmit` attempted and cannot resolve `expo/tsconfig.base` and React/Node typings because install is incomplete. `npx expo lint` was therefore **not able to run**. Complete installation in a normal network environment, then run both checks.
- Physical Android runtime and live SerpApi not verified. No API key supplied. API transport behavior covered by inherited backend tests, but mobile E2E not tested.

## Constraints and next phase
- This prototype is **not authorized for production student records**: no real auth/RBAC exists yet.
- Backend only supports seeded job descriptions and the 3 versioned assessment banks; mobile honestly reflects these limits.
- Roadmap regenerates per analysis ID, so after an assessment press Reanalyze and load the roadmap again to reflect the latest gaps.
- No admin import or resume upload has been implemented in Phase 5.
- **Next Phase 6**: implement CSV/XLSX administrative import end-to-end (upload, mapping, validate, duplicate review, partial import, row errors) with API and Expo screens, enforcing demo-only access until role-based authentication is available.
