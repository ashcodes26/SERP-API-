# Phase 6 handoff — CSV/XLSX demo imports

## Implemented
- `POST /api/import/upload`: bounded multipart CSV/XLSX uploads (configured max MB, 5000 rows, 40 columns), staging in SQLite, suggested mapping.
- `POST /api/import/preview`: supplied source-to-canonical mapping, required fields, email and number checks, existing/in-file duplicate IDs and emails, durable per-row issues and counts.
- `POST /api/import/confirm`: partial import of valid rows; duplicates skipped by default. Explicit `update_duplicates=true` updates records only when institutional ID and email identify the SAME existing **synthetic** record. Non-synthetic records are never modified.
- `GET /api/import/{job_id}` and `/errors`: status and stored validation issues.
- `POST /api/import/{job_id}/retry`: revalidates rows that were not imported; correct source records by uploading an amended file as a new job (no row-edit endpoint).
- Mobile **Import** tab: file picker, header-to-field mapping controls, preview/counts/issues, confirmation, explicit duplicate update, revalidation, errors and busy states. Existing student journey remains unchanged.
- Import endpoints explicitly reject requests when `APP_ENV` is not `development` or `test`. **There is no production admin authorization**; only use synthetic data in isolated local development.

## Files
`backend/app/models.py`, `backend/app/main.py`, `backend/app/services/imports.py`, `backend/tests/test_imports.py`, `mobile/src/api/client.ts`, `mobile/src/app/admin-import.tsx`, `mobile/src/components/app-tabs.tsx`, `mobile/src/app/explore.tsx`, `mobile/package.json`, `docs/PHASE6_HANDOFF.md`.

## Run and verify
```bash
cd backend
python -m pip install -r requirements-dev.txt
python -m pytest -q
uvicorn app.main:app --host 0.0.0.0 --port 8000

cd ../mobile
npm install             # updates package-lock.json with Expo SDK 57 document picker
npx tsc --noEmit
npx expo lint
npx expo start
```
Set `EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:8000` for a physical phone; backend `APP_ENV=development` for *synthetic/demo only*. No real students without authentication/RBAC and retention policies. `SERPAPI_API_KEY` belongs in `backend/.env` only.

## Tests and limitations
- Backend `python -m pytest -q`: 30 passing (26 inherited + 4 import tests). Tests cover CSV/XLSX, mapping, range/email errors, duplicates, import, idempotent retry and non-synthetic update safeguards.
- Node package registry DNS was unavailable (`EAI_AGAIN`), so `expo-document-picker` has been added to package.json but the existing package-lock.json could NOT be regenerated. `npm ci` will not work until `npm install` succeeds and the regenerated lockfile is committed. TypeScript/lint/mobile device tests remain blocked by missing dependencies.
- No actual mobile end-to-end or live SerpApi verification was possible. No production auth. `retry` only revalidates existing staged source; correction requires reupload. Only CSV and non-macro XLSX supported. Do not use real student records.

## Next: Phase 7
Build authentication/RBAC and tighten privacy/retention before any real student use, and run mobile install, typecheck, lint and device QA. Phase 7 must not silently convert prototype imports into production admission.
