# Gemini integration deployment runbook

## Approval boundary

This document is a procedure, not permission to operate on production data. No production database was opened or migrated during implementation.

Keep `DOCUMENT_REVIEW_ENABLED=false` and `GROUNDED_AI_ENABLED=false` until the deployment owner approves provider consent copy, audit retention/access, HMAC secret ownership/rotation, backup encryption/access/retention/disposal, incident response, and retention-job operations. These unresolved decisions come from `DOCUMENT_INTELLIGENCE_FINAL_APPROVAL.md`. No destructive migration or retention-policy assumption is authorized by this implementation.

## Configuration

All settings are backend-only; use `backend/.env.example` as the non-secret reference.

| Setting | Default / requirement |
| --- | --- |
| `GEMINI_API_KEY` | Blank means unavailable; never put in mobile configuration. |
| `GEMINI_MODEL` | Existing configurable default preserved; real capability must be verified before release. |
| `GEMINI_TIMEOUT_SECONDS` | 30 seconds, bounded 1-45. |
| `GEMINI_TASK_LIMIT_PER_HOUR` | 5 per student/task/hour. SDK attempts = 1; no automatic retry. |
| `DOCUMENT_REVIEW_ENABLED` | false; requires approval before retained reviews. |
| `GROUNDED_AI_ENABLED` | false; requires approval before new provider explanations. |
| `DOCUMENT_HMAC_KEY` | Separately managed secret, at least 32 characters, required for retained reviews and their commitments. |

Do not rotate the HMAC key without an approved handling plan for outstanding fingerprints, proposals and audit commitments. Rotation/multi-key verification is not implemented.

## SQLite migration procedure

1. Verify the resolved database path and its environment. Stop the backend and confirm no active writer. This implementation supports SQLite review transactions only.
2. Create a timestamped backup using the approved access-controlled/encrypted backup location. Record its SHA-256 checksum and verify the backup is readable. Backups contain personal data and need the approved disposal policy.
3. Make a separate migration test copy. Set backend `DATABASE_URL` explicitly to that copy. Never use the sole production file for validation.
4. From `backend/`, run `python -m alembic current`, then `python -m alembic upgrade head`. Expected revision: `20261019_01`. Fresh installations bootstrap legacy tables with `init_db()` before this additive migration. Do not stamp an existing database without checking its actual schema.
5. Verify `PRAGMA integrity_check` returns `ok`, `PRAGMA foreign_key_check` is empty, and all pre-existing table records/counts match the backup. Run `python -m pytest -q` with `APP_ENV=test` against synthetic fixtures, not real records.
6. Record original/target revisions, backup checksum, validation result and approval. Only then perform an approved maintenance-window promotion. No automatic startup migration is implemented.
7. Roll back a production promotion by stopping the service and restoring the verified backup. `alembic downgrade` deliberately refuses destructive operations; it is not a data rollback mechanism.

The migration only creates eight new tables, indexes and an audit-update protection trigger. It does not alter, rebuild, drop or populate existing SkillUp tables. Repeating upgrade-to-head is tested.

## Retention operations

Before enabling review storage, configure and verify an external scheduler to run `python -m app.services.document_retention` at least every minute under the backend's approved service identity/configuration. This command performs no provider calls. Scheduler installation and production operation were not performed in this task.

Every read and approval enforces review expiry; even an idempotent replay purges expired content before returning. The maintenance command removes expired source-review content independently of user activity. Physical purge depends on scheduler uptime; monitor it before release.

| Data | Retention behavior |
| --- | --- |
| Uploaded binaries | Never persisted by the backend. Picker-created client cache copies are released. |
| Review text, filenames, excerpts, extraction JSON, proposed/current/applied values, duplicate fingerprint | Up to 30 days from creation; no automatic extension. Purged on delete/expiry. |
| Approved ordinary profile facts/evidence | Remain under the existing profile policy after source-review deletion. |
| AI cache | Validated source IDs/action enums only, owner-scoped, 1 hour; raw documents and provider prose are not cached. |
| AI request windows | Fixed UTC hour, purged after expiry. |
| Diagnostics | Task/status/timestamp only; 24 hours. No prompt, exception text, filename, source text or identity. |
| Minimal audit | Opaque provenance, actor/action/version/time/idempotency and HMAC commitments; deployment retention/access approval remains required. |

## Release verification still required

- Synthetic browser checks at 360/768/1440 widths, keyboard focus, screen-reader announcements, deletion/expiry, stale/error recovery, refresh/session restoration and duplicate-tap handling.
- Native Android/iOS document selection and temporary-copy cleanup.
- Explicitly authorized real Gemini model/schema/timeout/quota behavior, using synthetic non-personal input and a minimal call budget.
- Existing dependency-audit findings (30 total: 18 high, 12 moderate) require triage. Dependency manifests were unchanged in this implementation.
- Verify scheduler monitoring, secret storage, backup controls and approved consent notices before setting either new feature flag true.
