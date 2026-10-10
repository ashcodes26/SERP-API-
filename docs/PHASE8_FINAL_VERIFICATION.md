# Phase 8 release verification gates

Phase 8 stabilization changes have been delivered, but release verification is **blocked**, not complete. Do not label the Expo build or Android end-to-end demo as tested until the following commands pass.

## Reproducible build checks

```bash
cd mobile
npm install
npm ci
npx expo install --check
npx tsc --noEmit
npx expo lint
npx expo-doctor
```

Commit the generated `package-lock.json` after `npm install` resolves `expo-document-picker`; avoid manually inventing lock metadata. If `expo install --check` reports version mismatches, use `npx expo install --fix` and rerun all checks.

## Runtime acceptance

Use only synthetic data and local development credentials. Start FastAPI with `APP_ENV=development`, bind it to an address accessible to the phone, and set `EXPO_PUBLIC_API_URL` to the computer's LAN URL. Perform: (1) student login, seed, profile, analysis, roadmap, quiz, updated readiness, logout; (2) admin login, CSV and XLSX upload, column mapping, validate, duplicate handling, partial import, retry, logout; (3) wrong password, missing network, expired token, invalid/oversize uploads, and forbidden student imports. Repeat on a physical Android device, record device/OS and results.

SerpApi live calls additionally require `SERPAPI_API_KEY` server-side. Missing a key does not block curated-resource fallback but cannot count as successful live-provider verification.
