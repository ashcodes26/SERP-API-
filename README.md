# Skillup

A mobile-first career-readiness prototype for the SerpApi Hackathon: synthetic student evidence → target role → explainable skill gaps → learning resources → assessment → updated readiness.

## Requirements

- Python 3.12 (tested)
- Node.js 22.13 or newer for Expo SDK 57
- Backend runtime dependencies: root `requirements.txt`, which includes `backend/requirements.txt`
- Backend test dependencies: `backend/requirements-dev.txt`
- Frontend dependencies: `mobile/package.json` and `mobile/package-lock.json`

## Backend setup (PowerShell)

From the repository root:

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r requirements.txt
Copy-Item backend/.env.example backend/.env
```

Set independent random values for `AUTH_SIGNING_KEY`, `ADMIN_PASSWORD`, and `DEMO_PASSWORD` in `backend/.env`. Leave `APP_ENV=development` for the local demo. Add `SERPAPI_API_KEY` there to enable live search; otherwise roadmap resources use clearly labelled curated fallback. All credentials stay backend-only.

```powershell
cd backend
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Health: http://127.0.0.1:8000/api/health. API documentation: http://127.0.0.1:8000/docs.

## Frontend setup (second terminal)

```powershell
cd mobile
npm.cmd ci
Copy-Item .env.example .env
npx.cmd expo start --web --port 8081
```

Set `EXPO_PUBLIC_API_URL=http://127.0.0.1:8000` for local web development. Open http://localhost:8081. With `DEMO_LOGIN_BYPASS=true` in `backend/.env`, the app opens directly into the existing demo student's workspace. This temporary mode requires `APP_ENV=development` and loopback backend requests; it issues a normal student session and preserves existing saved revisions. Tokens are held in memory. The signing key is still required.

To restore the login page later, set `DEMO_LOGIN_BYPASS=false`, restart the backend, and reload the app. Sign in as `demo` using the backend's `DEMO_PASSWORD`, or `admin` using `ADMIN_PASSWORD` for CSV/XLSX imports. Production always requires login, regardless of the bypass flag.

For a physical phone, use the computer's LAN IP in `EXPO_PUBLIC_API_URL` and bind FastAPI to `0.0.0.0` on a trusted LAN.

## Gemini resume feedback

Install the updated backend requirements, then set `GEMINI_API_KEY` locally in
`backend/.env` and restart the backend. Create the key in
[Google AI Studio](https://aistudio.google.com/api-keys). Never put it in chat,
mobile settings, source control or logs. Set `GEMINI_MODEL=gemini-3.5-flash-lite`
(configurable) and optionally `GEMINI_TIMEOUT_SECONDS=30` (1–45 seconds).
Google's [current pricing](https://ai.google.dev/gemini-api/docs/pricing) lists
this text model with a free tier. Availability and quotas depend on the project,
region and model; [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
can change. Linking billing can change pricing/data treatment. Check your project
in AI Studio; this app does not enforce a spending cap.

In the existing Resume workspace, upload or paste a de-identified resume, choose
a target description, read the privacy notice, and enable the separate Google
consent checkbox before Analyze with Gemini. Without consent no provider
request is made. Recognizable emails, phone numbers, address lines, URLs and common
contact headers are removed from outbound resume and job text where feasible.
This is best-effort redaction, not complete anonymization: names and personal
details embedded in experience may remain. Review/de-identify text before sending.

Under Google's [unpaid-services terms](https://ai.google.dev/gemini-api/terms),
submitted content and generated output may be used to improve products, and human
reviewers may process them. Google instructs users not to submit sensitive,
confidential or personal information to unpaid services. EEA, Switzerland and UK
data-use exceptions apply; read the current terms. Paid-services data terms differ.
Use synthetic/de-identified material for this free-tier prototype. Deleting an
AIMORA resume removes its local stored analysis, not data already sent to Google.

The official [Google Gen AI Python SDK](https://googleapis.github.io/python-genai/)
uses JSON structured output with a Pydantic schema. Resume/job text is untrusted
data under a separate system instruction. Evidence excerpts must be found in the
outbound and original resume. Quote case/whitespace differences are resolved back
to the actual source passage. Unsupported strengths/gaps are withheld individually;
ratings without valid supporting excerpts are withheld as null, without discarding
other valid feedback or edits. Schema-invalid responses are rejected with sanitized
field diagnostics. Rewrites must uniquely match the original, avoid
overlap, and preserve numbers, detected skills, negation and uncertainty. Gemini can
now reorder clauses, remove filler and improve action wording. Fuller rewrites
receive a separate structured Gemini factual-equivalence check in one batch;
unverified or changed claims are discarded. Simple equivalent wording/formatting
changes use the existing narrow comparison. These checks do not verify the truth
of self-supplied facts or guarantee AI accuracy; review every proposed edit.


The resume workspace now uses Gemini only: summary, strengths with resume excerpts,
evidence gaps, improvements, questions and individual before/after rewrites. Gemini
returns overall, relevance, evidence, clarity and structure ratings out of 100 with
reasons and supporting excerpts. A compact chart compares the four dimensions.
Ratings are subjective AI estimates, not official ATS scores, verified proficiency
or hiring probabilities. Missing information is null, never an invented rating.

Click **Replace** under an individual before/after suggestion to update the revised
resume editor immediately. It changes only that exact passage in your current
draft, preserving earlier replacements and unrelated manual edits. **Undo
replacement** reverses that passage. Missing or ambiguous editor text is left
untouched with an explanatory error. Replacements remain unsaved until you review
the facts and choose **Save revision**; export uses the saved revision. The original
remains recoverable. Existing colors, typography and components are retained.


Missing configuration, quota/rate limits, timeout, blocked, malformed and failed
responses produce explicit states with no scores or suggestions. Rule-based resume
analysis and the optional local embedding model have been removed. Historical
analyses are hidden until reanalysis; saved original/revised text remains intact.
At most two provider requests are made: one analysis and, when needed, one batch
factual check (maximum 12 seconds). Each request has one attempt and no automatic
retry; there are no per-edit provider calls. Partial verification failures leave
qualitative analysis available with an explicit rewrite error. The existing version
contract rejects duplicate completed submissions; in-flight analyses are serialized
within this demo backend process. Run a single worker for this SQLite prototype;
multiple worker deployment needs distributed idempotency before scaling. No prompts,
responses, resume contents, provider exception details or API keys are logged by
this integration. Feedback is stored in the existing private workspace analysis.
Verification uses mocked provider responses and synthetic resumes only.
If the backend cannot reach Google, launch it from a normal terminal with outbound
network access; a sandboxed server can serve localhost while still being unable to
call Gemini. Gemini 2.5 models may be inaccessible for generation on new projects;
the current default is the free-tier-compatible `gemini-3.5-flash-lite`. The provider
receives a compact JSON structure schema; strict bounds, extra-field rejection and
factual checks remain enforced locally with Pydantic. A live synthetic-only request
confirmed validated feedback with this model during the connection/schema fix.
Verification uses mocked Gemini responses, including the real SDK with a mocked
HTTP transport. No personal resume data is used for live verification.

## Checks

```powershell
cd backend
.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
$env:APP_ENV = 'test'
.venv/Scripts/python.exe -m pytest
```

`APP_ENV=test` is only for isolated tests; do not run a network server in that mode.

```powershell
cd mobile
npx.cmd tsc --noEmit
npx.cmd expo lint
npx.cmd expo install --check
npx.cmd expo export --platform web
```

Current Gemini-only verification: 151 backend tests, frontend TypeScript, Expo lint
the five resume helper tests, and the web export passed. A live synthetic-only Gemini request returned validated ratings and a fuller rewrite approved by the separate Gemini factual check. Browser visual acceptance remains unverified
because no browser surface was available. Existing upload/revision/approval/restore
and TXT/DOCX export flows are covered by backend tests. See the historical reports
in `docs/` for earlier feature work; their retired local-analysis setup no longer applies.

## Current scope

New: **Skill demand** (`/market`) combines retained job-search samples into distinct-job rankings, role comparisons, and personal evidence/learning priorities. The Jobs resume panel accepts actual text PDF/DOCX/TXT uploads (1 MiB maximum). See [industry skill demand report](docs/INDUSTRY_SKILL_DEMAND.md) for calculations, endpoints, component adaptations, setup, and checks.

Implemented: synthetic profile, seeded and retrieved-job comparison, deterministic skill gaps/readiness, authenticated SerpApi job discovery with cache and bounded pagination, retrieved-page skill insights, pasted-text resume advice, progress-preserving role roadmaps, SQL/Python/Docker quizzes, dashboard, prototype authentication/ownership checks, and development-only admin CSV/XLSX imports. Open **Jobs & insights** after signing in. Live job discovery requires `SERPAPI_API_KEY`; without it, the UI displays an explicit configuration error.

Resume and LinkedIn import supports text PDFs, DOCX and UTF-8 TXT. Resume Enhancer accepts a pasted job description without a provider key, alongside real retrieved listings. Resume analysis requires Gemini configuration and Google consent; storage, manual revision and export work locally. Still outside this prototype: official ATS evaluation, SWOT generation, interview practice, production student accounts, full offline mobile operation and production deployment hardening. Readiness is informational, never an employment probability. Use synthetic records only.

`.env` files, credentials, databases, virtual environments, installed dependencies, build output, and local browser profiles are excluded from Git. Commit `.env.example` files only.

Resume Enhancer now focuses on resume upload, original-versus-revised strength statistics, target analysis, reviewed improvements and export. **LinkedIn Analyzer** is a separate `/linkedin` tab for public lookup, profile editing, saved skill/section analysis and official basic-member connection. Text strength uses a displayed deterministic rubric, separate from job alignment. Desktop/mobile-web navigation and saved-statistics updates passed browser acceptance; no additional configuration is needed.

LinkedIn Analyzer now offers contextual career coaching: skill evidence and impact checks, profile text quality, target-role or pasted-description comparisons, prioritized improvements, grounded wording suggestions and explicit roadmap actions. Analysis uses saved consented text and clearly labels partial public-search data; no extra API key is required.

My journey now supports reviewed one-row CSV/XLSX profile input with a web CSV template. Skill demand defaults to fewer controls, with collection dates/export/fresh retrieval under More options. LinkedIn profile input is first; the repeated Saved Profile Analysis card was removed. See [journey input and UI update](docs/JOURNEY_INPUT_AND_UI_UPDATE.md).

## Resume compatibility

No database migration is required. The existing workspace stores Gemini output in
its analysis JSON. Old rule/semantic analyses are ignored without deleting original
or saved revision text. Existing private upload, revision, approval, restore and
export routes retain ownership checks and no-store responses. Retired semantic,
improvement-preview and job-specific rule resume-advice routes return 404; Jobs
links to the existing Gemini resume workspace. The separate profile extraction,
LinkedIn, skill-gap and learning roadmap features remain available.

The rewrite prompt asks for smaller independent edits, preserves skill names and
uncertainty verbatim, and illustrates participation versus leadership and purpose
versus achieved outcomes. Validation warnings identify unmatched passages, changed
metrics/skills/qualifiers, overlap, or Gemini equivalence rejection without quoting
private source text. Numeric checks ignore sentence punctuation after numbers.
A synthetic sparse student resume produced three validated edits with this prompt.

Applied replacement passages are highlighted bright yellow in the web revision
editor. Drag its bottom-right corner to change width/height within the workspace.
Native editors support a drag height handle and accessible size buttons, with a
live highlighted preview. Highlights are presentation only: saved/exported resumes
remain plain text. Undo or editing an applied passage removes its highlight.
