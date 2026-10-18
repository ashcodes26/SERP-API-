# Gemini Free-Tier Strategy

## Purpose

SkillUp will use a user-supplied Gemini API key during initial development. Free-tier access, quotas, and model availability are account- and time-dependent. The application must verify capability with the configured key rather than treating a default model name as a guarantee.

## Repository baseline

- The backend already depends on `google-genai>=2.29,<3` and uses `from google import genai`.
- `Settings.gemini_api_key` is a backend `SecretStr`; `Settings.gemini_model` is configurable through `GEMINI_MODEL` and currently defaults to `gemini-3.5-flash-lite`.
- Current resume and roadmap calls use one SDK attempt and a configurable 1–45 second timeout. Those safeguards remain the baseline.

## Model-selection policy

1. Do not hard-code a model as “free.” Before enabling an AI task, perform an administrator-controlled, non-user-document capability check using the configured API key and the requested model.
2. Confirm the exact model supports structured JSON output through the installed SDK/API surface and that the key can call it. A `404`, permission error, or unsupported-schema response marks the task unavailable; it does not fall back silently to a different model.
3. Keep the verified model in `GEMINI_MODEL` only after the check. Record model name, SDK version, capability-check time, and non-sensitive status—not the key or response body.
4. Use a stable model identifier when practical. Treat preview/latest aliases as explicit operational choices because their availability and behavior can change.
5. Do not use Google Search grounding, tools, file APIs, or agentic features for v1. SkillUp has SerpApi for job discovery and needs bounded structured responses, not external-provider expansion.

Google’s model catalog and pricing pages change independently of this repository. At audit time, Google documents Pydantic/JSON-schema structured output for the GenAI SDK and notes that free-tier availability varies by model/account. Review the official pages before enabling a new model:

- https://ai.google.dev/gemini-api/docs/models
- https://ai.google.dev/gemini-api/docs/structured-output
- https://ai.google.dev/gemini-api/docs/pricing

## Free-tier controls

| Control | v1 policy |
|---|---|
| Calls | One provider attempt per user action; no automatic retry for timeout/quota/unavailable responses. |
| Concurrency | Per-owner, per-task in-flight/request-window throttle before provider invocation. |
| Input | Existing 30–20,000 text bounds; task-specific lower caps; redacted/minimized payloads only. |
| Output | Strict Pydantic schema, max tokens, maximum JSON size, excerpt limits, and `extra='forbid'`. |
| Cache | Owner-scoped, task-specific, versioned; no generic cache of raw personal documents. |
| Failure | Explicit `not_requested`, `unavailable`, `quota_limit`, `timeout`, `blocked`, `invalid_output`, or task-safe `error`; deterministic fallback stays available. |
| Diagnostics | Counts, latency bucket, task/model/status/cache outcome only. Never log API keys, raw prompt text, resume/LinkedIn/document text, or provider response bodies. |
| Testing | Mock Gemini/SerpApi only; do not consume free-tier quota in CI or automated tests. |

## Proposed initial quotas (implementation configuration, not enabled yet)

These are conservative application-side ceilings, deliberately independent of provider quotas. They must be validated against real usage and may only become configuration defaults after Batch 2 approval.

| Task class | Suggested ceiling | Rationale |
|---|---:|---|
| Resume review / document extraction | 3 requests per student per rolling hour | High-input, privacy-sensitive tasks; cache/review prior output. |
| Roadmap narrative / readiness explanation | 5 requests per student per rolling hour | User-initiated narrative requests, lower repeat value. |
| LinkedIn/job explanation | 5 requests per student per rolling hour | Read-only explanation tasks with owner/version cache. |
| Global emergency guard | Configured per deployment | Must be lower than known provider limits and leave headroom for manual verification. |

The UI should say “Try again later” with an application retry time; it must not expose a provider quota value or imply that payment will make a result correct.

## Cache safety and invalidation

Cache key material includes owner/tenant ID, task ID, normalized input digest, model, prompt version, schema version, and relevant context versions:

- Resume review: workspace ID/version and target/job-description digest.
- Roadmap: analysis ID/version, approved profile/evidence version, goal digest.
- DIL extraction: no general reusable document cache; any retained proposal/extraction remains in DIL storage under its 30-day policy.
- LinkedIn: profile update/version, confirmation/import method, target role/description digest, approved profile evidence version.
- Job explanation: stored listing content/version, deterministic match output version, approved profile evidence version.

Cache entries never cross owner boundaries. A cache record does not make a provider response authoritative or bypass consent. For consented personal-content tasks, cache lookup is permitted only while the applicable consent/source retention state remains valid.

## Operational checks before enabling development use

1. Keep `GEMINI_API_KEY` in `backend/.env` only; keep `.env` ignored and `mobile/.env` free of Gemini credentials.
2. Run the non-sensitive capability check against the configured model manually, then confirm structured-output parsing with a synthetic fixture.
3. Verify quota/timeout/unavailable model errors appear as safe task statuses and no raw provider details enter logs.
4. Set conservative gateway throttles and use mocked tests for regression coverage.
5. Confirm a no-key configuration still leaves Journey, Resume, LinkedIn, Opportunities, and Placement deterministic behavior usable.

## Stop conditions

Do not enable an AI task if the configured key/model cannot complete the synthetic structured-output capability check, if provider data-use/consent terms are not approved, if task cache isolation is untested, or if any response can reach a profile/roadmap/placement write without the documented server validation and student approval flow.
