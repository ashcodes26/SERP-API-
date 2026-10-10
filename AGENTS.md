# AIMORA — agent instructions

3-day SerpApi Hackathon build. Read `docs/CLAUDE_START_HERE.md` and `docs/PHASE1_AUDIT_AND_PLAN.md` first.

- Structure: `backend/` (FastAPI, SQLAlchemy, SQLite) and `mobile/` (Expo Router, TypeScript). Docs in `docs/`.
- Contracts: `backend/app/schemas.py` is the source; mirror changes in `mobile/src/types/contracts.ts`.
- `SERPAPI_API_KEY` is backend-only. Never in mobile code, logs, Git, or API responses.
- Deterministic logic (scoring, validation, assessment) lives in backend services, with tests. Unknown proficiency is `null`, never 0.
- Readiness is informational, never a placement/employment probability.
- No fake live results. Fixtures must carry `provenance: demo_fixture`; fallbacks `curated_fallback`.
- Expo: `mobile/AGENTS.md` applies; use versioned Expo docs, `npx expo install`, run `npx tsc --noEmit` and `npx expo lint`.
- Run before finishing: `cd backend && python -m pytest`.
