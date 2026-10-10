# Phase 8 — Mobile Build Stabilization and End-to-End QA

## Verified changes
- Admin Import tab is shown only for the authenticated admin role. Backend authorization remains authoritative; hiding navigation is not a security boundary.
- Multipart file-upload timeouts now return `upload_timeout` with a useful retry message instead of a generic network error.
- Phase 7 backend services and API contracts were preserved.

## Actual verification (2026-10-09)
- `cd backend && APP_ENV=test python -m pytest -q`: 34 passed.
- `npm install --package-lock-only --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=12000`: failed with `EAI_AGAIN registry.npmjs.org`.
- `npx --no-install tsc --noEmit`: unsuccessful because node_modules are absent; its missing JSX/library/type declarations do not constitute a completed project type-check.
- `npx --no-install expo lint`: cannot complete with missing Expo dependencies.
- Offline npm install could not finish in this environment.
- Android emulator/physical device and live SerpApi not available; no claim of device or live API success.
- The existing `mobile/package-lock.json` lacks the Phase 6 `expo-document-picker` dependency and is intentionally **not falsely rewritten** with invented integrity metadata.

## Required next actions on a network-connected development machine
1. `cd mobile && npm install` (regenerates the lockfile for `expo-document-picker`); review and commit package-lock.json.
2. `npx expo install --check` and resolve any Expo SDK 57 compatibility messages.
3. `npx tsc --noEmit && npx expo lint && npx expo-doctor`.
4. Backend: populate local `backend/.env` with distinct `AUTH_SIGNING_KEY`, `ADMIN_PASSWORD`, `DEMO_PASSWORD`, and optional `SERPAPI_API_KEY`. Never put secrets in `EXPO_PUBLIC_*`.
5. `APP_ENV=development uvicorn app.main:app --host 0.0.0.0 --port 8000`; configure `mobile/.env` `EXPO_PUBLIC_API_URL=http://<LAN-IP>:8000` on a trusted LAN.
6. On a physical Android phone: student login → synthetic seed → profile → role gap → roadmap → quiz → readiness refresh → logout. Verify student cannot access import via URL or API. Admin login → CSV and XLSX mapping/preview/partial import/errors/retry → logout.
7. Run negative cases: wrong password, token expiry, backend offline, invalid file, duplicate IDs and emails, unknown skills, SerpApi timeout, app restart.
8. Use synthetic data only. For off-LAN usage require HTTPS. Do not deploy prototype authentication or import publicly.

## Remaining blocker
Phase 8 is **partially completed**, not release-qualified, until package-lock resolution, mobile type/lint checks, and device acceptance are successful. Preserve this handoff and continue stabilization as the next action; do not declare Phase 9 ready.

## Follow-up stabilization attempt (2026-10-09)
- Retried `npm install --no-audit --no-fund --fetch-retries=0 --fetch-timeout=20000`: blocked by `EAI_AGAIN` resolving `registry.npmjs.org/expo-document-picker`.
- Confirmed `mobile/node_modules` is absent and `expo-document-picker` is not in the local npm cache. No fabricated lockfile entries were added.
- Fixed the web tab navigator to accept the authenticated role, expose the admin-only Import tab, and use AIMORA/Guide labels rather than starter-template labels.
- Reset staged import state when choosing a new file so an unsuccessful upload cannot leave stale mapping or preview content from an earlier file.
- Reran `APP_ENV=test python -m pytest -q`: 34 passed. `python -m compileall -q app`: passed.
- **Still not release-qualified**: Expo dependency install, TypeScript, Expo lint/doctor, and physical Android acceptance have not run successfully. These must be completed on a machine with npm connectivity and an Android device.
