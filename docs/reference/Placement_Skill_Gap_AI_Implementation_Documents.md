# Placement Skill Gap AI — Implementation Source Documents

> Companion documents to `00_MASTER_SPEC.md`  
> Purpose: provide implementation-level contracts and guardrails for AI-assisted/vibe coding.

---

# 01 — Architecture

## 1.1 Architectural Principles

1. Keep the MVP simple enough to finish in three weeks.
2. Do not introduce a new framework when the existing stack can solve the problem.
3. Keep frontend, backend, database, import, and AI responsibilities separated.
4. Keep API contracts stable.
5. Prefer deterministic logic for validation, scoring, normalization, and critical business rules.
6. Use AI where it adds value: extraction, interpretation, recommendations, and natural-language generation.
7. Every live dependency must have a demo/offline fallback where practical.
8. Never place secrets or AI provider keys in the mobile application.

## 1.2 Final MVP Stack

### Mobile

- Expo
- React Native
- TypeScript
- Expo Router
- TanStack Query
- Zustand
- Zod
- Expo Secure Store
- React Native Reanimated
- Gesture Handler

### Backend

- Python
- FastAPI
- Pydantic
- SQLAlchemy

### Data

- Pandas
- OpenPyXL
- SQLite for MVP
- PostgreSQL for future institutional deployment

### Development

- Git
- GitHub
- VS Code
- Expo/EAS

## 1.3 System Architecture

```text
┌───────────────────────────────┐
│       Expo React Native       │
│                               │
│ Dashboard / Profile / Jobs    │
│ Skill Gap / Roadmap / Tests   │
│ Admin Import                  │
└───────────────┬───────────────┘
                │ HTTPS/JSON
                ▼
┌───────────────────────────────┐
│            FastAPI            │
│                               │
│ Auth/Profile Service          │
│ Import Service                │
│ Job Analysis Service          │
│ Skill Gap Service             │
│ Roadmap Service               │
│ Assessment Service            │
└───────┬───────────┬───────────┘
        │           │
        ▼           ▼
┌────────────┐ ┌───────────────┐
│  SQLite    │ │   AI Layer    │
│    MVP     │ │ Extraction /  │
│            │ │ Recommendations│
└────────────┘ └───────────────┘
```

## 1.4 Frontend Structure

```text
app/
├── auth/
├── dashboard/
├── profile/
├── job-analysis/
├── skill-gap/
├── roadmap/
├── assessment/
├── interview/
└── admin-import/

components/
├── ui/
├── cards/
├── forms/
├── charts/
└── feedback/

services/
├── api/
├── auth/
├── storage/
└── validation/

store/
├── auth/
├── student/
└── app/

types/
└── index.ts
```

## 1.5 Backend Structure

```text
backend/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   │
│   ├── models/
│   ├── schemas/
│   ├── routes/
│   ├── services/
│   ├── ai/
│   ├── importers/
│   ├── validators/
│   └── utils/
│
├── tests/
├── requirements.txt
└── .env.example
```

## 1.6 Responsibility Boundaries

| Layer | Responsibility |
|---|---|
| Mobile UI | Presentation and user interaction |
| Frontend state | Local UI/session state |
| TanStack Query | Server state/cache |
| FastAPI routes | HTTP interface |
| Services | Business logic |
| AI layer | Extraction/recommendation/generation |
| Validators | Deterministic validation |
| SQLAlchemy | Persistence |
| SQLite/PostgreSQL | Storage |

The frontend must not directly access the database.

---

# 02 — API Contract

## 2.1 General Rules

- Base path: `/api`
- JSON is the default request/response format.
- File uploads use `multipart/form-data`.
- Dates use ISO 8601.
- IDs are strings unless explicitly defined otherwise.
- Successful operations return structured data.
- Errors use a consistent schema.
- The frontend must never depend on undocumented fields.

## 2.2 Standard Error

```json
{
  "error": {
    "code": "STUDENT_NOT_FOUND",
    "message": "Student was not found",
    "details": {}
  }
}
```

## 2.3 Profile

### `GET /api/profile/{student_id}`

Response:

```json
{
  "student_id": "SRM1024",
  "first_name": "Aarav",
  "last_name": "Kumar",
  "email": "aarav@example.com",
  "department": "CSE",
  "program": "B.Tech CSE",
  "specialization": "AIML",
  "semester": 5,
  "cgpa": 8.7,
  "graduation_year": 2028,
  "skills": []
}
```

### `POST /api/profile`

Creates or updates a student profile.

## 2.4 Job Analysis

### `POST /api/job/analyze`

Request:

```json
{
  "title": "Machine Learning Engineer",
  "description": "..."
}
```

Response:

```json
{
  "job_id": "job-001",
  "title": "Machine Learning Engineer",
  "required_skills": [],
  "preferred_skills": [],
  "competencies": []
}
```

## 2.5 Skill Gap

### `POST /api/skill-gap/analyze`

Request:

```json
{
  "student_id": "SRM1024",
  "job_id": "job-001"
}
```

Response:

```json
{
  "student_id": "SRM1024",
  "job_id": "job-001",
  "alignment_score": 71,
  "matched_skills": [],
  "partial_matches": [],
  "skill_gaps": [
    {
      "skill": "SQL",
      "student_level": 4,
      "required_level": 8,
      "gap": 4,
      "priority": "HIGH",
      "reason": "Important requirement for the target role"
    }
  ]
}
```

## 2.6 Roadmap

### `GET /api/roadmap/{student_id}`

Response:

```json
{
  "student_id": "SRM1024",
  "target_role": "Machine Learning Engineer",
  "duration_weeks": 8,
  "items": []
}
```

## 2.7 Assessment

### `POST /api/assessment/submit`

Request:

```json
{
  "student_id": "SRM1024",
  "skill": "SQL",
  "answers": []
}
```

Response:

```json
{
  "score": 80,
  "skill": "SQL",
  "updated_level": 6,
  "readiness_update": {
    "previous_score": 71,
    "new_score": 74
  }
}
```

## 2.8 Dashboard

### `GET /api/dashboard/{student_id}`

Response:

```json
{
  "student_id": "SRM1024",
  "target_role": "Machine Learning Engineer",
  "alignment_score": 71,
  "top_gaps": [],
  "roadmap_progress": 25,
  "assessment_progress": 40
}
```

## 2.9 Import API

### `POST /api/import/upload`

Multipart upload of `.csv` or `.xlsx`.

Response:

```json
{
  "job_id": "import-001",
  "filename": "SRM_AIML_Students.xlsx",
  "status": "QUEUED"
}
```

### `POST /api/import/preview`

Response:

```json
{
  "job_id": "import-001",
  "total_records": 1248,
  "valid_records": 1213,
  "warnings": 24,
  "errors": 11,
  "duplicates": 9,
  "mapping": {}
}
```

### `POST /api/import/confirm`

Confirms import of valid records.

### `GET /api/import/{job_id}`

Returns import status and counts.

### `GET /api/import/{job_id}/errors`

Returns structured import errors.

### `POST /api/import/{job_id}/retry`

Retries failed records only.

---

# 03 — Database Schema

## 3.1 Database Rules

- SQLite for the AIMORA MVP.
- PostgreSQL-compatible design wherever practical.
- Primary keys must be stable.
- Foreign keys must be enforced.
- Student IDs must be unique.
- Email should be unique when available.
- Do not store derived AI output as the only source of truth.

## 3.2 Students

```text
students
---------
id                  PK
student_id          UNIQUE NOT NULL
first_name          NOT NULL
last_name           NOT NULL
email               NOT NULL
phone
date_of_birth
enrollment_date
graduation_year
department
program
specialization
semester
cgpa
metadata_json
created_at
updated_at
```

## 3.3 Student Skills

```text
student_skills
--------------
id                  PK
student_id          FK -> students.id
skill
proficiency
confidence
source
evidence
created_at
updated_at
```

## 3.4 Jobs

```text
jobs
----
id                  PK
title
company
description
created_at
updated_at
```

## 3.5 Job Skills

```text
job_skills
----------
id                  PK
job_id              FK -> jobs.id
skill
requirement_type    # REQUIRED / PREFERRED
importance
required_level
```

## 3.6 Skill Gaps

```text
skill_gaps
----------
id                  PK
student_id          FK
job_id              FK
skill
student_level
required_level
gap
priority
reason
created_at
updated_at
```

## 3.7 Roadmap Items

```text
roadmap_items
-------------
id                  PK
student_id          FK
skill
week
title
description
resource
duration
difficulty
status
completion_criteria
created_at
updated_at
```

## 3.8 Assessments

```text
assessments
-----------
id                  PK
student_id          FK
skill
score
previous_level
updated_level
completed_at
metadata_json
```

## 3.9 Import Jobs

```text
import_jobs
----------
id                  PK
filename
source_type
total_records
successful_records
failed_records
duplicate_records
status
started_at
completed_at
created_at
```

## 3.10 Relationships

```text
Student
  ├──< StudentSkill
  ├──< SkillGap
  ├──< RoadmapItem
  └──< Assessment

Job
  ├──< JobSkill
  └──< SkillGap
```

---

# 04 — Data Import Specification

## 4.1 Supported MVP Sources

- CSV
- Excel `.xlsx`

Future:

- PostgreSQL
- MySQL
- SQL Server
- SQLite
- MongoDB
- REST APIs

Future connectors must convert their output into the same canonical student schema.

## 4.2 Canonical Student Schema

```text
student_id
first_name
last_name
email
phone
date_of_birth
enrollment_date
graduation_year
department
program
specialization
semester
cgpa
skills
metadata
```

## 4.3 Column Mapping

| Input Header | Canonical Field |
|---|---|
| Register Number | student_id |
| Reg No | student_id |
| Roll Number | student_id |
| Student ID | student_id |
| First Name | first_name |
| Surname | last_name |
| Email ID | email |
| Mail ID | email |
| Mobile | phone |
| Mobile No | phone |
| Date of Joining | enrollment_date |
| Course | program |
| Branch | specialization |
| CGPA | cgpa |

## 4.4 Import Pipeline

```text
Upload
  ↓
File Type Validation
  ↓
Parse
  ↓
Detect Headers
  ↓
Map Columns
  ↓
Normalize Values
  ↓
Validate
  ↓
Detect Duplicates
  ↓
Preview
  ↓
Confirm
  ↓
Batch Insert
  ↓
Import Report
```

## 4.5 Validation

### Required

- `student_id`
- `first_name`
- `last_name`
- `email`
- `program` or `department`

### Rules

- CGPA: `0 <= cgpa <= 10`
- Email: valid email format
- Student ID: non-empty
- Duplicate student ID: duplicate
- Duplicate email: duplicate/warning
- Dates: normalized
- Phone: normalized where possible

## 4.6 Statuses

```text
VALID
WARNING
ERROR
DUPLICATE
```

## 4.7 Duplicate Policy

Primary key:

```text
student_id
```

Secondary key:

```text
email
```

Actions:

```text
SKIP
UPDATE
CREATE_NEW
```

`CREATE_NEW` requires explicit administrator confirmation.

## 4.8 Partial Import

Valid rows must not be blocked by unrelated invalid rows.

Example:

```text
Total:       1000
Valid:        960
Warnings:      25
Errors:        10
Duplicates:    5

Import: 960 valid records
```

## 4.9 Import Errors

```json
{
  "row": 48,
  "student_id": "SRM1098",
  "field": "cgpa",
  "code": "INVALID_CGPA",
  "message": "CGPA must be between 0 and 10"
}
```

## 4.10 Batch Processing

MVP target:

```text
500–1000 records per batch
```

Production extension:

```text
FastAPI → Queue → Workers → PostgreSQL
```

Do not add Redis/Celery/RQ to the MVP unless required by actual performance testing.

---

# 05 — AI/ML Specification

## 5.1 AI Responsibilities

AI may be used for:

- Job-description skill extraction.
- Resume skill extraction.
- Skill normalization assistance.
- Roadmap generation.
- Interview-question generation.
- Natural-language explanations.

## 5.2 Deterministic Responsibilities

Do not delegate these critical rules entirely to an LLM:

- Required-field validation.
- CGPA validation.
- Duplicate detection.
- Database integrity.
- API schema validation.
- Permission checks.
- Final score calculation.
- Import status.
- Error classification.

## 5.3 Job Analysis Pipeline

```text
Job Description
      ↓
Text Cleaning
      ↓
Skill Extraction
      ↓
Skill Normalization
      ↓
Required/Preferred Classification
      ↓
Target Role Profile
```

## 5.4 Resume Analysis Pipeline

```text
Resume
  ↓
Text Extraction
  ↓
Section Identification
  ↓
Skill/Project/Certification Extraction
  ↓
Skill Normalization
  ↓
Student Evidence
```

## 5.5 Skill Normalization

Examples:

```text
JS
Javascript
Java Script
        ↓
JavaScript
```

```text
ML
Machine Learning
        ↓
Machine Learning
```

Maintain a normalization dictionary for common skills.

## 5.6 Skill Gap Calculation

Base model:

```text
gap = required_level - student_level
```

Then prioritize using:

```text
priority =
  role_importance
  × gap_severity
  × requirement_type
```

The exact scoring formula must remain centralized in one backend service.

## 5.7 Alignment Score

The alignment score should be:

- Deterministic where possible.
- Explainable.
- Reproducible for the same input.
- Clearly labeled as an informational readiness indicator.

Do not present it as a probability of employment.

## 5.8 Roadmap Generation

Input:

```text
Target role
Skill gaps
Skill priorities
Current levels
Prerequisites
Student constraints
```

Output:

```text
week
skill
task
resource
duration
difficulty
completion_criteria
```

Validate generated roadmap objects against a Pydantic schema before returning them to the frontend.

## 5.9 AI Output Safety

If AI returns malformed or incomplete output:

```text
AI response
   ↓
Schema validation
   ↓
Valid → use
Invalid → retry/fallback
```

The app must never crash because an AI response has unexpected structure.

## 5.10 Provider Independence

The AI service should be behind a backend abstraction:

```text
AIService
   ├── extract_skills()
   ├── analyze_job()
   ├── generate_roadmap()
   └── generate_interview_questions()
```

This prevents provider-specific code from spreading throughout the application.

---

# 06 — UI/UX Specification

## 6.1 Design Principles

- Clean.
- Modern.
- Professional.
- Mobile-first.
- Minimal cognitive load.
- Consistent components.
- Clear feedback.
- Strong hierarchy.
- Avoid unnecessary screens.

## 6.2 Primary Navigation

```text
Dashboard
Profile
Job Analysis
Skill Gaps
Roadmap
Assessment
Progress
```

Admin-only:

```text
Admin Import
Import History
Student Search
```

## 6.3 Student Dashboard

Display:

1. Target role.
2. Alignment/readiness score.
3. Top three skill gaps.
4. Roadmap progress.
5. Next action.
6. Assessment progress.

## 6.4 Skill Gap Screen

Each gap card should show:

```text
Skill: SQL

Current: 4/10
Required: 8/10
Gap: High
Priority: High

Why it matters:
Required for the selected target role.

Recommended action:
Complete SQL fundamentals + practice assessment.
```

## 6.5 Roadmap Screen

Use:

```text
Week 1
  ✓ SQL Fundamentals
  ○ SQL Joins
  ○ Practice Assessment

Week 2
  ○ Advanced SQL
  ○ Mini Project
```

## 6.6 Import Screens

### Screen 1 — Source

```text
Upload Student Data

[ Excel ]
[ CSV ]
```

### Screen 2 — Mapping

```text
Input Header       Mapped Field
Reg No              Student ID
Mail ID             Email
Branch              Specialization
CGPA                CGPA
```

### Screen 3 — Validation

```text
4,827 Total
4,712 Valid
82 Warnings
33 Errors
17 Duplicates
```

### Screen 4 — Confirmation

```text
[Import Valid Records]
```

### Screen 5 — Result

```text
Import Completed

Successful: 4,712
Failed: 33
Duplicates: 17
```

## 6.7 UI State Requirements

Every API-driven screen must have:

- Loading state.
- Success state.
- Empty state.
- Error state.
- Retry action where appropriate.

## 6.8 Component Reuse

Prefer reusable components:

```text
Button
Card
Input
Badge
ProgressBar
SkillCard
RoadmapItem
ScoreCard
ErrorState
LoadingState
```

Do not create visually different versions of the same component without a documented reason.

---

# 07 — Development Rules

## 7.1 Source-of-Truth Hierarchy

```text
00_MASTER_SPEC.md
        ↓
01_ARCHITECTURE.md
        ↓
02_API_CONTRACT.md
        ↓
03_DATABASE_SCHEMA.md
        ↓
04_DATA_IMPORT_SPEC.md
        ↓
05_AI_ML_SPEC.md
        ↓
06_UI_UX_SPEC.md
        ↓
07_DEVELOPMENT_RULES.md
        ↓
08_TESTING_AND_ACCEPTANCE.md
```

If documents conflict, follow the higher-priority document unless the conflict is explicitly resolved.

## 7.2 Coding Rules

### Always

- Use TypeScript on the frontend.
- Use typed API responses.
- Validate external data.
- Reuse existing components.
- Reuse existing services.
- Follow the established folder structure.
- Handle loading/error/empty states.
- Keep business logic out of UI components.
- Keep secrets server-side.
- Test changes immediately.
- Commit working milestones.

### Never

- Change frameworks without approval.
- Add unnecessary dependencies.
- Rewrite unrelated working code.
- Change API response shapes casually.
- Duplicate state-management libraries.
- Hard-code API keys.
- Put database access in frontend code.
- Create a second implementation of an existing service.
- Remove working functionality to solve an unrelated problem.

## 7.3 Dependency Rule

Before installing a package:

1. Check whether the existing stack can solve the problem.
2. Check whether an existing package already provides the capability.
3. Only then add a dependency.

## 7.4 AI Coding Rule

Give the coding agent one well-defined feature at a time.

Each request should contain:

```text
Context
Task
Constraints
Expected behavior
Acceptance criteria
Files allowed to change
Files that must not change
```

## 7.5 Change Management

For changes affecting:

- API
- database
- navigation
- authentication
- shared types
- AI output schemas

review the dependent components before implementation.

## 7.6 Git Rules

Use small commits:

```bash
git add .
git commit -m "feat: add student import validation"
```

Recommended prefixes:

```text
feat:
fix:
refactor:
test:
docs:
chore:
```

Never use a large unreviewed AI-generated change as the only commit before integration.

## 7.7 Integration Rule

Frontend must consume backend contracts rather than inventing its own data structures.

Backend must return documented schemas rather than frontend-specific ad hoc objects.

Shared TypeScript/Pydantic representations should stay aligned.

## 7.8 Demo Reliability

Every critical live feature should have a fallback where practical.

```text
Live API
   ↓
Failure
   ↓
Demo/local response
```

---

# 08 — Testing and Acceptance

## 8.1 Definition of Done

A feature is complete only when:

- It works in the intended flow.
- Its API contract is correct.
- Errors are handled.
- Loading/empty states exist where needed.
- It does not break existing features.
- It passes its acceptance tests.
- It has been tested on the target device where relevant.

## 8.2 Import Tests

### Valid Data

- Valid CSV imports.
- Valid XLSX imports.
- Headers map correctly.
- Records appear in database.

### Invalid Data

- Missing student ID rejected.
- Missing name detected.
- Invalid email detected.
- CGPA outside `0–10` rejected.
- Invalid dates reported.

### Duplicates

- Duplicate student ID detected.
- Duplicate email detected.
- Skip works.
- Update works.
- Explicit create-new works.

### Partial Import

```text
100 records
80 valid
10 warnings
7 errors
3 duplicates
```

Expected:

```text
80 valid records imported
20 records reported
```

## 8.3 API Tests

For every endpoint verify:

- Correct status code.
- Correct response schema.
- Required fields.
- Invalid input.
- Missing resources.
- Server errors.
- Authentication/authorization where applicable.

## 8.4 AI Tests

Verify:

- Same structured input produces valid structured output.
- Missing AI fields are handled.
- Invalid AI JSON is rejected safely.
- Unknown skills do not crash normalization.
- Empty job descriptions are handled.
- Empty resumes are handled.
- Generated roadmap conforms to schema.

## 8.5 Frontend Tests

Verify:

- Navigation.
- Forms.
- File selection.
- API loading.
- API errors.
- Retry.
- Empty states.
- Dashboard.
- Skill-gap display.
- Roadmap.
- Assessment.
- App restart.

## 8.6 End-to-End Acceptance Test

```text
1. Admin opens import
2. Uploads XLSX
3. Columns are detected
4. Fields are mapped
5. Validation completes
6. Duplicates/errors are shown
7. Valid records are imported
8. Student profile opens
9. Student selects target role
10. Job is analyzed
11. Skill gaps are calculated
12. Roadmap is generated
13. Student completes assessment
14. Readiness updates
15. Dashboard reflects the new state
```

## 8.7 Failure Acceptance

The application must remain usable when:

- Backend is unavailable.
- AI service fails.
- Uploaded file is invalid.
- Network is slow.
- AI returns malformed output.
- Student does not exist.
- Job does not exist.

## 8.8 Device Acceptance

Before the expo:

- Test on at least one physical Android device.
- Test the complete workflow.
- Test file upload.
- Test API connectivity.
- Test offline/demo fallback.
- Test the final EAS build.

---

# Final Implementation Rule

These documents are companion specifications to `00_MASTER_SPEC.md`.

The coding agent should:

1. Read `00_MASTER_SPEC.md`.
2. Read the relevant implementation document before changing a feature.
3. Follow the API and database contracts exactly.
4. Reuse the existing architecture.
5. Avoid introducing new dependencies without justification.
6. Run the relevant tests after each meaningful change.
7. Never silently change a contract to make code compile.
8. Prefer a small, working, integrated implementation over a large unfinished feature.

> **Goal: one coherent codebase, one API contract, one database model, one design system, and one source of truth.**
