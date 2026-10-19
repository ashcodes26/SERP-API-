# Gemini AI Integration - Implementation Progress

## Checkpoint (2026-10-19)

Branch: `chore/simplify-journey-page`. Starting head: `7587107`.
Clean clone verified before edits. The six requested documents and finalized DIL approval/implementation documents were read.
The current user request authorizes implementation and safe automatic progression; its batch numbering takes precedence over the older plan.

## Batch 1 â€” preserved and verified

Existing gateway/adapters were reused, not recreated. Original targeted tests: **59 passed**.
Existing backend baseline: **183 passed**. No real provider requests.

## Batch 2 â€” Document Intelligence implementation and automated acceptance passed

- Shared bounded PDF/DOCX/TXT parser; conservative classifier and deterministic extraction.
- Separate preview without storage; feature-gated 30-day private review storage, no binary retention.
- Additive Alembic revision `20261019_01`; legacy startup bootstrap does not create new private tables.
- Strict bounded Gemini extraction with fresh AI consent, contact redaction, unique source-excerpt/value verification and deterministic fallback.
- Student-only routes, type correction/supersession, per-item review and conflict confirmation.
- Accept/edit/reject transaction, current-profile fingerprint, versions, idempotent replay, writer serialization and non-content immutable audit commitments.
- Evidence provenance; skill levels stay unknown or preserve an existing level. Excluded academic fields cannot be applied.
- Delete/expiry purge content, excerpts, extraction JSON, current/proposed/applied values and duplicate HMAC; approved facts remain.
- Maintenance purge entry point; configure its scheduler before enabling review.
- Durable owner/task request windows and privacy-safe diagnostics added; no general document cache.
- Profile review card, separate consents, provenance display, edit/reject/conflict, expiry/delete, safe retry keys, session checks, refresh guidance.

Verification: **22 DIL tests passed**; full backend **205 passed** before the final type-correction audit addition (DIL rechecked afterward); frontend **21 passed**; TypeScript passed; Expo lint passed; Expo web export passed (11 routes).
Migration test used only a populated synthetic SQLite copy, checked every pre-existing table's complete rows, integrity, foreign keys and repeat upgrade. Rollback-on-audit-failure and concurrent approval replay passed.

Browser/device accessibility and real Gemini capabilities remain unverified; these are release acceptance gates, not claimed successes.

## Deployment gate â€” unresolved policies

`DOCUMENT_REVIEW_ENABLED` defaults false. Enabling real review storage requires approval of audit retention/access, provider consent copy, HMAC key rotation/ownership, backup controls and incident response listed in `DOCUMENT_INTELLIGENCE_FINAL_APPROVAL.md`.
`DOCUMENT_HMAC_KEY` must be a separately managed server secret of at least 32 characters. No production database has been opened or migrated. Only additive migrations are implemented; destructive downgrade is refused.

## Remaining batches (current request)

3. **Implemented / automated acceptance passed:** career readiness explanations and roadmap context.
4. **Implemented / automated acceptance passed:** Career assets shared gateway integration, including LinkedIn.
5. **Implemented / automated acceptance passed:** Genuine retrieved listing requirement/match explanations.
6. Final integration/regression and final report.

## Next executable action

Begin Batch 3 against approved profile evidence and existing deterministic scoring/roadmap services. Keep provider tests mocked and update this checkpoint after its acceptance passes.

## Batch 3 checkpoint

- Added student-owned `/api/ai/readiness/{analysis_id}` with current deterministic scoring, approved evidence references, allowed action selection, and post-provider source-change detection.
- Gemini returns only source IDs/action enums. Server renders explanations; no model score/proficiency/candidate fact is accepted.
- Owner-scoped cache persists only validated IDs/enums for one hour; context includes role/profile/evidence/model/prompt/schema versions. Document text is never cached here.
- Durable quota windows are atomic across sessions. Roadmap adapter receives owner scope while retaining its existing API and mock seams.
- Added read-only personalized learning recommendations through `learning.py`; existing milestones/resources/status/completion evidence are preserved.
- Existing roadmap generation/export remains user initiated. Learner descriptions are best-effort redacted.
- Readiness and roadmap UI use separate request consent, safe status/errors, evidence refs and session guards.
- New explanation features default off (`GROUNDED_AI_ENABLED=false`) pending provider consent/privacy deployment approval.

Verification: full backend **217 passed**; targeted document/readiness/roadmap **37 passed**; frontend **21 passed**; TypeScript and Expo lint passed; Expo web export passed to `.expo/export-batch3` (11 routes). An earlier export failed to write into the old `dist` directory (EPERM); the clean-directory rerun succeeded. Provider and manual browser/device behavior remain unverified.

Next: Batch 4, preserve Resume workflows and add independently consented LinkedIn optimization through the shared gateway.

## Batch 4 checkpoint

- Resume uses the existing shared gateway, consent, factual rewrite validation, revision decisions and export contracts; added owner-scoped budgets without changing compatibility seams.
- Added `/api/ai/linkedin` for confirmed saved source excerpts only, independent of deterministic LinkedIn analysis and public/OIDC lookup. Contact lines/URLs are redacted before the provider.
- LinkedIn suggestions use validated source IDs and conditional editorial action enums; no new candidate fact, qualification or metric is accepted. Source/version changes invalidate cached results.
- Added separate LinkedIn AI consent/status/source UI; never overwrites saved profile text, lookup review, resume revisions or student records.

Verification: full backend **220 passed**; targeted assets/workspace/grounded tests **76 passed**; frontend **21 passed**; TypeScript, Expo lint and Expo web export passed (11 routes, `.expo/export-batch4`). One new budget test initially failed because its fixture mocked the gateway before quota validation; corrected the test and reran the full suite. No real provider calls.

Next: Batch 5, genuine retrieved-listing requirements and match explanations with source URLs and deterministic scores preserved.

## Batch 5 checkpoint

- Added `/api/ai/opportunities/{job_id}/analysis/{analysis_id}`; requires the student's own matching analysis and a stored `serpapi_live` DiscoveredJob with a source URL.
- Explicit requirements are re-extracted and source-excerpt verified against the actual retrieved description. No Gemini output creates a listing, requirement, proficiency, analysis or deterministic score.
- Explanation selection combines listing references with deterministic gaps and approved student evidence references. Server output preserves original source URLs and unknown-opening-status notices.
- Owner-scoped cache invalidates on listing content/version, approved evidence, model, prompt/schema or context changes. Existing SerpApi search/cache contracts are untouched.
- Jobs UI adds separate consent/status/evidence explanation controls after the existing comparison.

Verification: full backend **224 passed**, including real-listing gate, fixture/fallback rejection, ungrounded requirement rejection, ownership, score stability and listing-version invalidation; frontend **21 passed**; TypeScript, Expo lint and web export passed (11 routes, `.expo/export-batch5`). Tests simulate retrieval with synthetic records; no live provider/search quota was used.

Next: Batch 6, final adversarial/lifecycle integration checks, release runbook, final regression and report.
