# Gemini AI Integration â€” Implementation Progress

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
4. Career assets shared gateway integration, including LinkedIn.
5. Genuine retrieved listing requirement/match explanations.
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
