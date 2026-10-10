# Phase 7 — Security, Authentication and Mobile Verification

## Implemented

- Added `/api/auth/login`: environment-configured admin and synthetic-demo credentials return a signed, one-hour HMAC-SHA256 bearer token. Secrets live only in backend environment; no self-registration or hardcoded passwords.
- Protected all student/profile/analysis/roadmap/assessment/dashboard/resource routes with authentication and server-side ownership checks; administrator may inspect records and only the synthetic demo student can use the demo student session. Student principals cannot call admin import endpoints.
- All import routes require admin authorization, including status/errors/retry; imports remain disabled in production until a fully approved institutional import policy exists. Demo seeding is similarly limited to development/test.
- Staged import rows, error details and job metadata are purged by configurable retention (1–168 hours, default 24) on the next authorized import API request. No raw uploaded file is persisted by the upload path. Old records already stored are deleted by the retention query.
- Added mobile login screen, shared bearer headers for regular and multipart requests, and sign-out. Tokens are intentionally memory-only and are cleared on restart; re-login is required. Admin import screen now describes its authorization boundary.
- Added 4 security tests: unauthenticated, invalid credentials, cross-student access, admin permissions, tampered tokens, production restrictions, and retention.

## Security constraints and future hardening

- **Hackathon prototype, not production authorization infrastructure**. Admin and demo credentials are shared environment passwords, not a user database/SSO; tokens cannot be individually revoked before expiry. Rotate the signing key to invalidate sessions. No login rate limiter, recovery, audit trail or MFA.
- `APP_ENV=test` is reserved for isolated automated tests and skips authentication to preserve prior phase's API regression fixtures. **Never expose an `APP_ENV=test` server to a network.** All actual development and production deployments must use authentication. `APP_ENV=production` rejects import and demo-seed calls even with admin credentials.
- Demo students are synthetic and get account access only via development login; production student registration and identity verification are not implemented. No real student data or internet-facing production deployment is approved.
- A local `http://` Expo dev backend is for trusted LAN test traffic only. Use HTTPS for nonlocal use, including transmission of credentials.
- Import expiry is opportunistic (on the next authorized import request), not a clock-driven deletion job. Backups and database snapshots must have independent retention; normal student records are not purged as part of staging cleanup.
- Restrict `.env` permissions and supply long, independent secret strings. `ADMIN_PASSWORD`, `DEMO_PASSWORD` and `AUTH_SIGNING_KEY` must never be committed.

## Configuration

```bash
cd backend
cp .env.example .env
# configure the values below in .env with independent strong random strings
# APP_ENV=development
# AUTH_SIGNING_KEY=<random string at least 32 characters>
# ADMIN_PASSWORD=<unique admin password>
# DEMO_PASSWORD=<unique demo password>
# IMPORT_RETENTION_HOURS=24
python -m pip install -r requirements-dev.txt
python -m pytest -q
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

For Expo device testing, set `EXPO_PUBLIC_API_URL` to a reachable FastAPI address. `demo` signs in as synthetic student, `admin` signs in as admin. A login returns an access token valid for one hour. The mobile app stores no session token on disk.

```bash
cd mobile
npm install # required to refresh Phase 6 expo-document-picker package-lock.json
npx tsc --noEmit
npx expo lint
npx expo start
```

## Verification

- `APP_ENV=test python -m pytest -q`: **34 passed** (30 inherited + 4 security tests).
- `python -m py_compile app/main.py`: passed.
- npm lock regeneration blocked by `EAI_AGAIN` DNS resolution from registry.npmjs.org; offline retry `ENOTCACHED`. `mobile/node_modules` missing and `tsc --noEmit` cannot verify the app (unresolved Expo/React Native modules); Expo lint and Android device smoke test not completed.
- Live SerpApi request remains unverified (no credential provided).

## Next Phase — Phase 8

Complete mobile dependency resolution/lockfile commit, TypeScript/lint and Android end-to-end QA; harden auth/session management and admin policy if deploying beyond a synthetic hackathon demo. Then integrate any remaining polish/features only after validated device tests.
