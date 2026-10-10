# AIMORA — Unified PRD & MVP Specification

**Status:** Product source of truth  
**Audience:** AIMORA product, design, and implementation team  
**Build constraint:** Two people, three weeks  
**Primary platforms:** Expo / React Native mobile app and FastAPI backend  
**Foundation:** `sources/00_MASTER_SPEC.md`, `sources/Placement_Skill_Gap_AI_Implementation_Documents.md`, and `sources/Placement_Skill_Gap_AI_Project_Brief_2000_words.md`  
**Refinement input:** AI Career Toolkit Final Project Abstract, as described in the referenced project conversation

> This specification consolidates the established Placement Skill Gap AI product into AIMORA and selectively refines it with the abstract’s useful ideas. The abstract is a refinement source; the institutional placement-readiness workflow, mobile-first architecture, import capability, and three-week MVP constraints remain foundational.

## 1. Product vision

AIMORA helps students prepare for placements through a measurable, evidence-based cycle: understand a target role, compare its requirements with demonstrated student capabilities, close the highest-impact gaps, and reassess progress. Placement teams can onboard student cohorts from institutional CSV/XLSX files and use structured, privacy-aware readiness information to guide support.

**Product promise:** AIMORA explains what a student should improve, why it matters for a chosen role, what concrete learning action to take, and what evidence would demonstrate progress.

## 2. Problem and opportunity

Students often rely on generic preparation and cannot see which skills matter most for a specific role. Their evidence is fragmented across academic records, resumes, projects, repositories, self-reports, and assessments. Placement teams spend time reconciling inconsistent spreadsheets and lack a consistent way to turn those records into actionable preparation.

AIMORA combines institutional onboarding with career evidence and job requirements in one competency model. It is a decision-support and learning product, not a placement guarantee, hiring filter, or predictive employment system.

## 3. Users and jobs to be done

### Primary: Student

- Build or review a career profile from imported academic details and career evidence.
- Choose a target role or provide a job description.
- Understand matched strengths and priority skill gaps with supporting evidence.
- Follow a realistic roadmap and relevant learning resources.
- Complete a short assessment and see how readiness changes.
- Prepare for role-specific interview questions.

### Primary: Placement coordinator / administrator

- Upload a cohort CSV/XLSX file, map its columns, review validation and duplicates, and import valid records.
- Find a student profile and view readiness summaries for placement support.
- Use aggregated patterns to plan interventions; avoid treating a score as a hiring decision.

### Secondary: Faculty / career services

Use cohort-level gap patterns to coordinate workshops and support. Full institutional analytics and integrations are deferred beyond the prototype.

### Out of scope as MVP users

Recruiters and employers do not receive candidate-ranking or applicant-management tools in the MVP.

## 4. Product principles

1. **One competency model:** Resume, academic, project, GitHub, LinkedIn, self-reported, and assessment evidence feed one profile instead of disconnected analyzers.
2. **Explain every conclusion:** Show skill matches, gaps, evidence source, confidence, and scoring factors.
3. **Evidence over claims:** Distinguish demonstrated evidence from self-report and extracted text.
4. **Action before complexity:** Every important gap should connect to a specific learning action, resource, or assessment.
5. **Human-supportive readiness:** Scores inform preparation and institutional support; they do not predict or guarantee employment.
6. **Mobile-first, demo-reliable:** Keep Expo/React Native as the student experience and preserve a deterministic offline/demo path.
7. **Privacy by design:** Collect only needed data, make evidence provenance visible, and keep secrets and sensitive processing on the server.
8. **Buildable scope:** Protect the core end-to-end loop before adding optional analyzers or integrations.

## 5. End-to-end workflow

```text
Institution CSV/XLSX ──> Map ──> Validate/deduplicate ──> Student profile
                                                              │
Resume / project / optional GitHub or LinkedIn evidence ──────┤
                                                              ▼
                                             Unified competency profile
                                                              │
                                      Target role / job description
                                                              ▼
                                  Required and preferred competencies
                                                              ▼
                         Explainable alignment, gaps, confidence, SWOT
                                                              ▼
                             Prioritized roadmap + learning resources
                                                              ▼
                                    Assessment / interview practice
                                                              ▼
                                  Updated evidence and readiness view
```

The core loop is **Assess → Compare → Recommend → Learn → Reassess**. A user may begin with a demo profile when institutional data is unavailable.

## 6. Feature requirements and scope tiers

### 6.1 MVP Must-Have — required for a complete three-week demonstration

| Area | Requirement | Acceptance outcome |
|---|---|---|
| Student profile | View canonical institutional fields and editable career evidence | A student record can be opened and reviewed in the mobile app |
| Institutional import | Upload CSV and XLSX; detect headers; map fields; validate; detect duplicates; preview; import valid rows; report row-level errors and summary | A mixed-validity file imports valid students without losing error details |
| Target role | Enter/paste a job description or choose a seeded role | A normalized role requirement profile is available for comparison |
| Resume evidence | Upload/select a supported resume or use seeded demo evidence; extract skills, projects, education, and certifications | Extracted evidence is shown with provenance and can be reviewed |
| Skill gap | Normalize skills; compare evidence to required/preferred skills; prioritize and explain gaps | Results show matches, gaps, importance, evidence, and rationale |
| Readiness | Display an explainable readiness/alignment indicator with confidence and evidence coverage | UI labels it as informational and exposes what drives it |
| Roadmap/resources | Create ordered learning actions linked to gaps, with resource, estimated effort, objective, and completion evidence | Every top-priority gap has a useful next action, using curated fallback resources if AI is unavailable |
| Assessment | Complete a small skill assessment and update evidence/readiness deterministically | A completed assessment changes the relevant competency record and dashboard |
| Student dashboard | Show target role, readiness, top gaps, roadmap progress, and next action | The main demo loop is visible without navigating admin internals |
| Offline/demo | Seed a complete synthetic student, role, analysis, roadmap, and assessment path; fall back on API/AI failure | Expo demonstration remains complete without network access |
| Interview prep | Basic role/gap-based question set from templates or AI with a clear practice flow | Student can practice a small set of targeted questions; no adaptive scoring required |

#### Must-have ATS refinement

Resume analysis must cover job-keyword relevance, section/readability checks, parseability/formatting cautions where extractable, action-verb strength, and quantified achievement signals. Return findings with examples and improvements. Do not imply compatibility with a specific proprietary ATS or claim a definitive ATS pass score. If document formatting cannot be inspected reliably, state that limitation and provide text-based checks.

#### Must-have SWOT refinement

Produce a concise career-readiness SWOT from the same competency evidence and target role: strengths and weaknesses from matched/missing competencies, opportunities from actionable resources/projects, and threats as role-specific risks or constraints. Each item must cite its evidence or be labeled as an inference. SWOT must not invent personal traits or use protected attributes.

### 6.2 MVP Should-Have — include only after Must-Have integration works

- Optional GitHub profile/repository analysis from a user-provided profile URL or manually supplied repository data. No scraping that violates service terms; allow demo fixtures.
- LinkedIn profile optimization from user-provided text or an uploaded PDF/export, with no automated scraping.
- Separate artifact quality summaries and a small history of analysis results.
- Cohort summary of common gaps for the placement coordinator, using aggregate counts and minimum cohort-size safeguards.
- More detailed project-to-skill evidence mapping and stronger ATS suggestions.
- Editable roadmap timeline and student-selected weekly study availability.

Should-Have work stops if it threatens the end-to-end Must-Have flow or physical-device/demo reliability.

### 6.3 Future / Deferred

- Adaptive mock interviews that change difficulty and follow-up questions based on answers; speech/audio evaluation.
- Live job scraping, labor-market feeds, job alerts, or employer integrations.
- Full recruiter portal, candidate ranking, and placement decision support.
- Predictive placement probability or outcome modeling.
- LMS/SIS/placement portal integrations, SSO, and multi-institution production tenancy.
- Complex adaptive assessments, knowledge graph, collaborative filtering, vector database, or model training pipeline.
- Production-scale import workers/queues, PostgreSQL migration, and broad admin analytics.
- Automated LinkedIn scraping or unsupported GitHub data collection.

## 7. Unified competency and readiness model

### 7.1 Canonical competency record

Each normalized skill is represented with:

```text
Competency
  skill_id, canonical_name, category
  proficiency_level: 0–5 (unknown is null, never silently treated as zero)
  confidence: 0–1
  evidence[]: {source_type, source_ref, excerpt_or_summary, observed_at}
  requirement_context?: {role_id, requirement_type, importance, required_level}
```

Evidence source types include institutional record, resume, project, certification, user self-report, GitHub (when provided), LinkedIn (when provided), and assessment. Preserve source and time so older or weaker evidence is not presented as verified current ability.

### 7.2 Role profile and gap calculation

Role requirements include canonical skill, required/preferred type, importance, and an optional expected level. Normalize aliases through a deterministic skill dictionary, with AI proposing candidates for human or rule validation.

For known levels, `gap = max(0, required_level - current_level)`. A centralized deterministic service calculates match, partial match, missing requirement, and priority using gap severity, requirement importance, and required/preferred status. Unknown proficiency remains unknown and lowers evidence coverage rather than being interpreted as zero skill.

### 7.3 Readiness, confidence, and evidence

Show three related signals instead of a misleading single certainty:

- **Role alignment:** weighted coverage of required and preferred skills, calculated deterministically.
- **Evidence coverage:** share of relevant competencies supported by usable evidence.
- **Confidence:** confidence in the analysis, informed by evidence quality, recency, source agreement, extraction certainty, and missing data.

If a single headline score is required for the demo, label it **Readiness indicator (informational)** and display alignment, evidence coverage, confidence, and the largest score drivers alongside it. Never label it a probability of placement or guarantee. The formula is versioned, centralized, reproducible, and described in the UI.

### 7.4 SWOT and analysis provenance

Every generated strength, weakness, opportunity, or threat links to one or more competency records or job requirements. Keep direct evidence separate from AI interpretation; label uncertain interpretations and allow the student to correct profile evidence.

## 8. AI responsibilities and deterministic logic

### AI-assisted responsibilities

- Extract candidate skills, projects, action verbs, quantified outcomes, and sections from resume text.
- Parse job descriptions into candidate required/preferred skills and role context.
- Suggest resource explanations, roadmap wording, SWOT phrasing, and interview questions.
- Optionally summarize user-provided repository or LinkedIn material in Should-Have scope.

### Deterministic responsibilities

- CSV/XLSX parsing, field mapping, required-field and range validation, duplicate detection, partial imports, and error reporting.
- Canonical skill normalization where dictionary matches exist.
- Schema validation for all AI outputs and safe fallback on malformed/unavailable AI.
- Readiness/alignment calculation, priority calculation, assessment scoring, evidence coverage, import status, authorization, and data integrity.
- Resource link allowlist/curation and roadmap completion state.

AI output must use typed schemas, be treated as untrusted input, and never execute code or control permissions. Validate and sanitize output; keep a deterministic template/data fallback for demo-critical screens. Do not claim AI extraction is ground truth.

## 9. Institutional import requirements

### 9.1 Supported MVP input and canonical fields

CSV and `.xlsx` files are the supported sources. Map common aliases such as Register Number/Roll Number to `student_id`, Email ID to `email`, Branch to `specialization`, and Course to `program`.

Minimum import fields: `student_id`, name (or first and last name), email, and program or department. Optional fields include phone, department, program, specialization, semester, CGPA (0–10), and graduation year. Do not require sensitive fields unrelated to placement readiness.

### 9.2 Import flow

1. Choose file and validate extension/size.
2. Detect headers and propose field mapping.
3. Let administrator review/change mappings.
4. Validate records and normalize values.
5. Detect duplicates by student ID and secondary email key.
6. Preview valid, warning, invalid, and duplicate rows.
7. Confirm valid-row import and selected duplicate handling (skip/update).
8. Show completed/partial/failed summary and downloadable or viewable row errors.

Never silently import ambiguous fields or create duplicate identities. The app should support partial success and retry of failed records. For the prototype, bounded file size and in-process FastAPI background work are sufficient; queue infrastructure is deferred.

## 10. Architecture

### 10.1 MVP stack

- **Mobile client:** Expo, React Native, TypeScript, Expo Router; existing state/query and validation libraries from the implementation documents.
- **Backend:** FastAPI, Python, Pydantic, SQLAlchemy.
- **Import processing:** Pandas and OpenPyXL.
- **MVP database:** SQLite; design persistence access so PostgreSQL can replace it later.
- **AI:** Server-side provider integration behind a service interface, with deterministic demo/local fallback. No provider key in the mobile bundle.
- **Delivery:** Expo development/preview build and a physical Android device; free-first services and local demo support.

### 10.2 Logical components

```text
Expo / React Native
  ├─ Student flows, admin import flow, local demo fixtures
  └─ typed API client
          │ HTTPS / REST
FastAPI
  ├─ Profile and evidence service
  ├─ Import pipeline (parse → map → validate → deduplicate → confirm)
  ├─ Job/resume extraction adapter (AI-assisted, schema-validated)
  ├─ Competency, readiness, and roadmap services (deterministic core)
  ├─ Assessment and interview practice service
  └─ SQLite via SQLAlchemy; file handling with bounded temporary storage
```

Keep business rules in backend services, not screens. AI provider selection remains replaceable. No microservices, vector database, or web-only replacement is required for the MVP.

## 11. API and data model

### 11.1 Core entities

| Entity | Key fields |
|---|---|
| Student | student_id, name, email, department, program, specialization, semester, cgpa, graduation_year |
| Evidence | id, student_id, source_type, source_ref, extracted_summary, observed_at, extraction_confidence |
| StudentSkill | student_id, skill_id, level, confidence, evidence_ids |
| Job | id, title, company (optional), description, created_at |
| JobSkill | job_id, skill_id, requirement_type, importance, expected_level |
| Analysis | id, student_id, job_id, alignment, evidence_coverage, confidence, formula_version, created_at |
| SkillGap | analysis_id, skill_id, current_level, required_level, gap, priority, rationale |
| SWOTItem | analysis_id, category, statement, evidence_refs, confidence_label |
| RoadmapItem | id, student_id, analysis_id, skill_id, task, resource, effort, week, status, completion_evidence |
| Assessment | id, student_id, skill_id, questions/version, score, completed_at |
| ImportJob | id, filename, source_type, counts, status, timestamps |
| ImportRowIssue | import_job_id, row_number, field, issue_code, message |

### 11.2 API contract baseline

Preserve established routes where possible; use versioned typed request/response schemas.

```http
POST /api/profile
GET  /api/profile/{student_id}
POST /api/job/analyze
POST /api/skill-gap/analyze
GET  /api/roadmap/{student_id}
POST /api/assessment/submit
GET  /api/dashboard/{student_id}

POST /api/import/upload
POST /api/import/preview
POST /api/import/validate
POST /api/import/confirm
GET  /api/import/{job_id}
GET  /api/import/{job_id}/errors
POST /api/import/{job_id}/retry
```

Resume analysis may be added as `POST /api/resume/analyze` if no equivalent contract exists. Responses should include stable IDs, source/evidence references, typed scores, warnings, and user-readable rationale. Do not return raw provider prompts, secrets, or unsupported claims.

## 12. UX and screens

### Student mobile flow

1. Splash/onboarding and demo access.
2. Dashboard: readiness indicator, target role, top gaps, progress, next action.
3. Profile and evidence: institutional fields, resume, skills, projects, certifications, source labels.
4. Resume analysis: ATS-focused checks, extracted evidence, cautions, editable corrections.
5. Target role/job description entry and analysis status.
6. Results: matches, gaps, confidence/evidence coverage, SWOT, score explanation.
7. Roadmap: ordered tasks, explicit resources, effort, progress.
8. Assessment and basic interview practice.
9. Progress history and reassessment.

### Coordinator mobile flow

1. Admin/demo dashboard.
2. CSV/XLSX file selection.
3. Column mapping.
4. Validation, duplicate, and error preview.
5. Import confirmation/progress/summary.
6. Student search/profile and a minimal cohort summary if time permits.

Provide loading, empty, retry, and error states. Explain scores in plain language and never make color the only indication of status. Keep the interaction mobile-first and suitable for a short live demo.

## 13. Security, privacy, and governance

- Use synthetic data in demonstrations unless institutionally approved data is explicitly available.
- Minimize collected fields and avoid date of birth or other unnecessary sensitive data.
- Require role-appropriate access for admin import and student records; students should only access their own profiles in a deployed system.
- Use HTTPS in deployed environments and secure credential storage on device.
- Keep provider credentials on the backend; redact secrets and sensitive resume content from logs.
- Bound upload size and accepted file types; validate content and avoid executing uploaded files/macros.
- Store uploaded files only as long as needed; define deletion and retention behavior before a real institutional pilot.
- Obtain appropriate consent for resume/profile analysis; allow correction of extracted data and removal of uploaded evidence.
- Do not use protected attributes or readiness scores to rank or deny students. Provide evidence and uncertainty for recommendations.
- Audit administrative imports and important data changes in a production deployment.
- Follow institutional policies and applicable privacy law before using real student records; this prototype is not a compliance certification.

## 14. Performance and reliability targets

Targets for the bounded prototype:

- Typical profile, dashboard, and stored analysis reads should feel immediate on the demo device; show progress for file parsing or AI calls.
- Import preview must report progress or a clear completion state and must not block the entire app UI.
- Limit file size/row count to a documented prototype bound; reject oversize files with a clear reason.
- AI calls have timeouts, schema validation, and deterministic fallback for demo-critical paths.
- Offline/demo mode can complete the entire scripted journey without backend or internet availability.
- Repeated analysis on unchanged inputs should produce stable deterministic scores and preserve an analysis timestamp/version.

## 15. Three-week implementation plan (two people)

### Week 1 — Foundation and core data flow

- Both: agree canonical schemas, freeze first API contract, prepare synthetic demo dataset, initialize Expo and FastAPI, establish reusable design components.
- Person A (backend/data): student schema, CSV/XLSX import, header mapping, validation, deduplication, skill normalization, first job parser/alignment rules.
- Person B (mobile/integration): navigation, dashboard/profile/import screens, reusable UI, seeded mock data, target role and result screen shells.
- End-of-week: imported or seeded student can reach a target-role skill analysis screen; frontend and backend contracts align.

### Week 2 — Complete the learning loop

- Person A: resume/job extraction adapter, explainable gaps, readiness/confidence, resource-linked roadmap, small assessment, error-safe deterministic fallback.
- Person B: integrate profile/import/analysis APIs, finish results, roadmap, assessment, dashboard, loading/error states, basic interview practice.
- Both: exercise the full import-to-reassessment flow; stop feature expansion if this path is not stable by the go/no-go checkpoint.
- Optional SWOT/ATS refinement is delivered from shared evidence model, not as a separate disconnected analyzer.

### Week 3 — Reliability and expo readiness

- Polish visual hierarchy, score explanations, accessibility, and realistic synthetic demo content.
- Build offline/demo fallback and verify the scripted path without network.
- Test CSV/XLSX happy path and invalid/duplicate rows, resume/JD empty or malformed inputs, AI timeout/malformed output, assessment update, and physical-device behavior.
- Freeze structural changes; prepare Expo preview build, demo account/data, reset path, and presentation walkthrough.

**Scope rule:** Must-Have integration outranks Should-Have features. GitHub, LinkedIn, elaborate analytics, and adaptive interviews are cut first if the schedule tightens.

## 16. Testing and demo acceptance

### Acceptance journey

1. Coordinator opens import and selects a sample XLSX/CSV.
2. App proposes mappings; coordinator reviews them.
3. Validation identifies valid rows, warnings, errors, and duplicates.
4. Valid rows import and summary/errors remain inspectable.
5. Student opens a seeded/imported profile and reviews resume evidence.
6. Student enters a target job description or selects a seeded role.
7. Analysis displays matched skills, prioritized gaps, ATS findings, evidence/confidence, and evidence-linked SWOT.
8. Roadmap offers gap-specific resources and tasks.
9. Student completes a mini assessment; competency evidence and readiness update.
10. Dashboard shows progress and next action; same journey works in offline/demo mode.

### Quality checks

- Import: CSV/XLSX parsing, aliases, missing fields, invalid email/CGPA, duplicate ID/email, partial import, retry/error reporting.
- Analysis: empty resume/JD, aliases, unknown skill level, required vs preferred, malformed AI output, unsupported evidence, deterministic score repeatability.
- Privacy/security: upload validation, no client-side secret, access boundary checks, log redaction.
- UX: navigation, loading/empty/error states, text readability, Android physical-device file selection and API connectivity.
- Demo: full resettable script, synthetic records clearly labeled, offline fallback, app build created before event day.

### Demo story

Use one clearly synthetic student and a target role. Show institutional import, profile evidence, top gaps, a targeted resource-backed roadmap, one assessment, and the updated readiness explanation. Avoid presenting synthetic results as institutional outcomes or placement predictions.

## 17. Success metrics

### Prototype delivery metrics

- A demo user can complete the full Assess → Compare → Recommend → Learn → Reassess loop.
- A mixed-quality CSV/XLSX import completes with valid rows imported and invalid rows explained.
- Every high-priority skill gap in the demo has a rationale and learning action/resource.
- Readiness displays evidence coverage and confidence, not an unsupported employment probability.
- The scripted demo remains usable offline.

### Pilot product metrics (future measurement)

- Skill-gap closure and role-alignment change over time.
- Assessment completion and score improvement.
- Roadmap action completion and resource usefulness ratings.
- Student and placement-coordinator satisfaction.
- Import success rate, correction burden, and time to onboard a cohort.
- Recommendation quality and confidence calibration reviewed by people.

Placement rate and time-to-placement may be long-term institutional outcomes, but must not be attributed to AIMORA without an appropriate evaluation design.

## 18. Future roadmap

1. **Pilot readiness:** user feedback, evidence correction, resource quality review, confidence calibration, privacy/retention review.
2. **Richer evidence:** optional GitHub and manual LinkedIn import, artifact score history, project evidence mapping.
3. **Institutional adoption:** PostgreSQL, SSO, secure SIS/LMS connectors, auditable cohort workflows, scalable import workers.
4. **Adaptive practice:** adaptive mock interviews and assessment difficulty with validated evaluation and explicit consent.
5. **Responsible analytics:** aggregate gap trends with privacy safeguards; only consider predictive models when representative, authorized outcomes exist and human oversight is established.

## 19. Final product definition

**AIMORA is a mobile-first, AI-assisted placement-readiness platform that combines institutional student onboarding with resume and career evidence, compares that evidence against target-role requirements, explains confidence and skill gaps, recommends specific learning resources and actions, and measures progress through reassessment.**

The three-week MVP is successful when a student can move from a profile and target job to evidence-backed gaps, a practical roadmap, and an updated readiness view—and a placement coordinator can safely import a cohort through a transparent CSV/XLSX workflow. The abstract strengthens this product with ATS depth, SWOT, explicit resources, and a future path to adaptive interviews; it does not change AIMORA into a collection of disconnected analyzers or replace its Expo/React Native + FastAPI foundation.
