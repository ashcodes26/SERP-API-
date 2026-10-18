# Test Matrix

## Test layers

| Layer | Tooling/status | Purpose |
|---|---|---|
| Backend unit/API | pytest suite exists under `backend/tests/` | Authorization, services, parsing, persistence, imports, placement, Gemini mocks, SerpApi fixtures. |
| Frontend static checks | `npx tsc --noEmit`, `npx expo lint` passed in this audit | Type and lint regressions. |
| Frontend unit | test files exist in `mobile/tests/*.test.cjs`, but no `npm test` script exists | Add an explicit runner/configuration before relying on these tests. |
| Browser E2E | scripts exist under `backend/scripts/`, but execution was not verified | Critical user flows and visual acceptance. |
| Live integrations | configuration-dependent | Synthetic-only smoke tests; never use real student data. |

## Required functional scenarios

| Domain | Scenario | Expected assertion | Priority |
|---|---|---|---|
| Auth | Signup, login, expired token, logout, inactive account, rate limit | Correct status/error; no cross-account access; session invalidated after logout | P0 |
| Authorization | Student calls another student’s profile/analysis/roadmap; faculty accesses unscoped student | 403/404 as designed; no data leak | P0 |
| Journey | New student profile, PDF/DOCX upload, corrupt/scanned/encrypted/oversize document, review/save | Valid preview/save; all parser failures are actionable 4xx/UI errors | P0 |
| Journey resilience | Backend unavailable then restored; rapid focus/navigation; retry | No stale red error after a successful response | P0 |
| Role and analysis | Seeded role, custom role with requirements, invalid custom role, unknown skills | Correct deterministic gaps/readiness and warning labels | P1 |
| Roadmap | Create deterministic plan, AI plan consent/config/quota/timeout/malformed output, export HTML/PDF/DOC | No provider request without consent; exports contain only intended saved data | P1 |
| Job search | Live unavailable, cached response, pagination, malformed external result, job match ownership | Provenance and warning states accurate; no unauthorized match | P1 |
| Market | Empty collection, filters, role comparison, personal evidence, CSV export | Rankings/counts/formula and exports match stored samples | P1 |
| Resume | PDF/DOCX/TXT input, storage consent, Gemini consent, redaction, suggestion apply/undo, save/restore/export | Version and factual-confirmation constraints hold; AI failures do not overwrite text | P0 |
| LinkedIn | text/profile export, public lookup not-found, OIDC callback/expiry, delete | Explicit consent, correct partial-data labels, records scoped to owner | P1 |
| Placement student | share/revoke resume, drive visibility/apply/update, training evidence/assessment prerequisite | Scope and consent rules enforced | P0 |
| Placement faculty | dashboard scope, cohort/student filters, review decision, drive edits, eligibility override, training assignment | Only scoped records appear/change; optimistic version conflicts handled | P0 |
| Import | CSV/XLSX limits, mapping, invalid rows, duplicate/update scope mismatch, retry | Preview never imports; confirmation/audit totals are correct | P0 |

## Non-functional scenarios

| Area | Required verification | Priority |
|---|---|---|
| Accessibility | Keyboard-only navigation, focus recovery after errors, labels, contrast, screen-reader roles, responsive touch targets | P1 |
| Responsive UI | Student and faculty flows at 360px, 768px, 1024px, 1440px | P1 |
| Privacy | Requests/logs never expose Gemini key; no AI request without consent; resume/profile data is not in client logs; export access ownership | P0 |
| Security | token tampering/expiry, rate limiting, CORS origin policy, upload parser abuse, CSV formula safety, IDOR attempts | P0 |
| Performance | large allowed documents, max import, cached search, major dashboard lists, slow Gemini/SerpApi | P2 |
| Reliability | database unavailable, provider timeout/rate-limit, duplicate submit, browser refresh during operation | P1 |

## Acceptance gates by release phase

1. **Foundation gate:** TypeScript, lint, full pytest, and front-end unit script pass; P0 API and Journey scenarios pass.
2. **Student gate:** A student completes profile → role analysis → roadmap → resume review → placement workflow in a browser.
3. **Faculty gate:** An admin with limited scope imports students, reviews a resume, assigns training, creates a drive, and exports a report without scope leakage.
4. **Integration gate:** Gemini and SerpApi synthetic/configuration smoke tests pass with unavailable/quota fallback behavior verified.
5. **Release gate:** accessibility/responsive pass, security tests pass, and no unclassified P0/P1 defects remain.
