# AIMORA — Claude Phased Build Prompts

Use one phase per Claude task. Do not ask Claude to execute all phases in one go. If a phase is incomplete, continue that phase from the actual repository state.

## Master instruction (paste first)
You are the senior engineer for AIMORA. Read `CLAUDE_START_HERE.md`, then inspect the actual repository, its `AGENTS.md`, README, package/dependency files, current Git changes, and tests. Preserve working code. Follow the 3-day SerpApi hackathon priority. Implement only the requested phase, run relevant verification, and report changed files, actual test results, blockers, configuration, and the next task. Never expose secrets, fabricate live search results, or claim unrun tests passed.

## Phase 1 — Repository audit (Day 1)
Inspect the existing codebase and produce a concise status report: architecture, startup commands, existing working features, incomplete features, SerpApi integration status, env vars, tests, and the shortest path to a complete demo. Run available baseline checks. Fix only critical setup issues needed to proceed; do not rewrite the app. Identify the single highest-value next implementation task.

Acceptance: we know how to run the app/backend, what works, and what is missing. Report any baseline test failures separately.

## Phase 2 — SerpApi vertical slice (Day 1)
Read `Integrate Serp API.txt` and verify actual API behavior against official SerpApi documentation. Implement or repair one real, product-relevant SerpApi search operation end to end: backend config, server-only key, validated input, bounded results, timeout/error handling, normalized response, source URLs, typed API contract, and a minimal test. Use `SERPAPI_API_KEY` from server environment. Do not put keys in mobile code or logs. Do not invent endpoints or return mock results on live failure. Clearly label any demo fixture.

Acceptance: with a valid key, the backend makes a real request and returns normalized results; missing key and upstream failures return useful structured errors. Document exact setup.

## Phase 3 — Core career intelligence (Day 2)
Inspect existing models and implement the smallest complete role-analysis path: accept a target job description or seeded role; normalize known skill aliases; compare known student evidence to required/preferred skills; calculate explainable alignment, evidence coverage, confidence, and gap priorities deterministically; preserve source/evidence references; connect relevant SerpApi results to real resources where useful. Unknown skill levels must remain unknown, not silently become zero. Readiness must never be called a probability of employment. Add tests for normalization, scoring repeatability, empty inputs, and upstream failures.

Acceptance: a student and target role produce strengths, prioritized gaps, rationale, and useful source-linked resources.

## Phase 4 — Roadmap and assessment loop (Day 2)
Build on the real analysis result. Generate a practical, ordered roadmap where each high-priority gap has an action, objective, effort estimate, completion criteria, and genuine resource URL when available. Validate AI output and provide deterministic fallback. Implement a small assessment with deterministic scoring, persist its result, update the relevant competency evidence, and recalculate readiness. Do not fake completion or overwrite stronger evidence blindly.

Acceptance: roadmap and assessment state persist; completing an assessment updates the actual dashboard data.

## Phase 5 — Mobile integration (Day 2)
Inspect existing Expo screens and extend them instead of rebuilding. Connect real backend APIs for profile, target role, search/discovery, analysis, roadmap, assessment, and dashboard. Ensure every visible control works. Add loading, empty, error, retry, and success states. Keep SerpApi secrets server-side. Keep demo fixtures separate from live responses. Avoid visual redesign of unrelated working areas.

Acceptance: the main student journey works in the mobile app against the backend.

## Phase 6 — Import workflow (only if needed and feasible)
Inspect the current CSV/XLSX import implementation. Complete missing essential steps only: upload bounds/type checks, deterministic field mapping, validation, duplicate review, preview, valid-row partial import, row-level errors, persisted summary, and retry if already part of the API contract. Do not let import extras break the core SerpApi-to-roadmap journey. Use synthetic data.

Acceptance: valid rows persist, invalid rows are explained, and duplicate handling is explicit.

## Phase 7 — End-to-end QA and demo fallback (Day 3)
Run the complete workflow: start app/backend, load a synthetic student, select a target role, call the live SerpApi path, view normalized source-linked results, generate skill gaps, open roadmap, complete an assessment, and verify updated readiness. Test missing API key, network timeout, rate limit, empty search, malformed input, backend unavailable, and malformed AI output. Fix root causes. Ensure offline demo data is clearly labeled and the demo can be reset. Run relevant tests/type checks/builds where available; state what could not be tested.

Acceptance: the scripted demo is repeatable and failure modes are understandable.

## Phase 8 — Final polish and delivery (Day 3)
No new features unless critical. Fix demo-breaking bugs, improve hierarchy and clarity, verify mobile responsiveness, check `.gitignore` and secrets, document setup, and prepare a short demo script. Report implemented functionality, exact verification results, env vars, known limitations, and demo sequence. Do not claim production readiness or employment prediction.

## Fresh-session handoff prompt
Continue the existing AIMORA repository from its current state. Read `CLAUDE_START_HERE.md`, the actual repository `AGENTS.md`, and the relevant code before editing. Completed phases: [LIST]. Current phase: [NUMBER/NAME]. Current blocker: [BLOCKER/NONE]. Continue only this phase; do not recreate completed work. Run relevant checks and report changed files, actual results, unresolved issues, and next action.
