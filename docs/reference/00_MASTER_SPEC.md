# Placement Skill Gap AI — Final Project Document

> **Consolidated final version**  
> **Target:** AIMORA, SRM Institute of Science and Technology, Ramapuram  
> **Build model:** 2 people, 3 weeks, Expo/React Native, free-first tooling

## Consolidation Summary

This document consolidates the final project direction and revisions developed throughout the conversation. It:
- Reorganized the project into a focused, expo-ready MVP.
- Consolidated the final **Placement Skill Gap AI** product scope and end-to-end workflow.
- Added the finalized **automated student-data import system** for Excel/CSV institutional data.
- Removed or deferred non-essential features such as full recruiter portals, live job scraping, LMS/job-portal integrations, serious predictive placement modeling, and complex adaptive assessments.
- Reconciled the architecture around **Expo + React Native + TypeScript**, **FastAPI**, and a simple database with a free-first approach.
- Added the definitive 3-week execution plan for a 2-person team.
- Added the final import architecture, canonical student schema, mapping, validation, duplicate handling, APIs, security, error reporting, scalability approach, and expo demonstration flow.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Problem Statement](#2-problem-statement)
3. [Project Objective](#3-project-objective)
4. [Target Users](#4-target-users)
5. [Core Product Workflow](#5-core-product-workflow)
6. [Core Features](#6-core-features)
7. [Automated Student Data Import](#7-automated-student-data-import)
8. [AI/ML Components](#8-aiml-components)
9. [Technical Architecture](#9-technical-architecture)
10. [Data Model](#10-data-model)
11. [API Design](#11-api-design)
12. [Application Screens](#12-application-screens)
13. [Security, Privacy, and Governance](#13-security-privacy-and-governance)
14. [Performance and Scalability](#14-performance-and-scalability)
15. [Three-Week Implementation Plan](#15-three-week-implementation-plan)
16. [Two-Person Team Responsibilities](#16-two-person-team-responsibilities)
17. [Vibe-Coding Workflow](#17-vibe-coding-workflow)
18. [Testing and Quality Assurance](#18-testing-and-quality-assurance)
19. [Offline and Demo Mode](#19-offline-and-demo-mode)
20. [Expo and Deployment Preparation](#20-expo-and-deployment-preparation)
21. [Risks and Contingencies](#21-risks-and-contingencies)
22. [Expo Demonstration Flow](#22-expo-demonstration-flow)
23. [Success Metrics](#23-success-metrics)
24. [MVP Scope and Deferred Features](#24-mvp-scope-and-deferred-features)
25. [Final Deliverables](#25-final-deliverables)
26. [Final Product Definition](#26-final-product-definition)

---

# 1. Project Overview

**Placement Skill Gap AI** is an AI-powered student placement-readiness platform designed to identify the difference between a student's current capabilities and the skills expected for a target job role.

The system combines student information, resumes, assessments, skills, academic information, and job descriptions to produce:

- A job-alignment score.
- Identified technical and non-technical skill gaps.
- Prioritized learning recommendations.
- A personalized upskilling roadmap.
- Targeted interview preparation.
- Progress and readiness tracking.

The project is designed as a polished institutional prototype rather than a full enterprise placement-management system.

### Core Differentiator

> **Don't just tell students what to learn — identify why they need it, prioritize it for their target role, provide a path to close the gap, and measure whether the gap actually closed.**

---

# 2. Problem Statement

Students often prepare for placements using generic learning resources without knowing whether their current skills actually match employer expectations.

At the institutional level, placement teams also face difficulty maintaining consistent, up-to-date student skill information when data is distributed across spreadsheets, databases, APIs, and manually maintained profiles.

This creates several problems:

- Students do not know their most important skill gaps.
- Learning is often generic rather than role-specific.
- Placement teams spend time collecting and maintaining student data.
- Resume and skill information can become outdated.
- Employers expect specific technical stacks and competencies.
- Institutions lack a unified view of placement readiness.

Placement Skill Gap AI addresses this by combining **automated student-data onboarding** with **AI-driven job and skill-gap analysis**.

---

# 3. Project Objective

The objective is to build a system that can:

1. Automatically import student details from institutional data sources.
2. Normalize and validate student information.
3. Create or update student profiles without manual data entry.
4. Parse resumes and job descriptions.
5. Extract relevant skills and competencies.
6. Compare student capabilities with target-role requirements.
7. Calculate an explainable alignment/readiness score.
8. Identify and prioritize skill gaps.
9. Generate a personalized learning roadmap.
10. Provide targeted mini-assessments and interview preparation.
11. Track progress toward closing identified gaps.
12. Demonstrate the complete workflow in a polished mobile application.

---

# 4. Target Users

## 4.1 Students

Students can:

- View their imported profile.
- Add or update missing information.
- Upload a resume.
- Select a target job role.
- Analyze their skill alignment.
- View prioritized skill gaps.
- Follow a personalized roadmap.
- Complete assessments.
- Track readiness.

## 4.2 Placement Coordinators / Administrators

Administrators can:

- Import student data.
- Review validation results.
- Resolve duplicates and errors.
- Monitor import jobs.
- View student readiness information.
- Use aggregated insights for placement preparation.

## 4.3 Career Services

Career teams can eventually use aggregated skill-gap data to identify common deficiencies across departments and organize targeted training.

> For the AIMORA MVP, the primary focus is **students + administrator/import workflow**. A complete career-services dashboard is deferred.

## 4.4 Recruiters

Recruiter-facing functionality is a future extension and is not part of the core MVP.

---

# 5. Core Product Workflow

The definitive end-to-end workflow is:

```text
Institutional Student Data
        |
        v
Excel / CSV / Future DB / API
        |
        v
Import Connector
        |
        v
Data Mapping + Normalization
        |
        v
Validation + Deduplication
        |
        v
Preview / Import Review
        |
        v
Batch Import
        |
        v
Student Database
        |
        +----------------------+
        |                      |
        v                      v
Student Profile          Placement AI
                               |
                     +---------+---------+
                     |                   |
                     v                   v
               Job Description       Resume/Skills
                     |                   |
                     +---------+---------+
                               |
                               v
                       Skill Extraction
                               |
                               v
                        Skill Gap Engine
                               |
                               v
                       Alignment Score
                               |
                               v
                    Personalized Roadmap
                               |
                               v
                         Assessment
                               |
                               v
                     Updated Readiness
```

The system removes the need for students to manually recreate basic institutional information while still allowing them to provide additional career-specific information.

---

# 6. Core Features

## 6.1 Student Profile

The profile combines imported institutional information with student-controlled career information.

### Institutional information

- Student ID
- Name
- Email
- Phone
- Department
- Program
- Specialization
- Semester
- CGPA
- Graduation year

### Career information

- Resume
- Technical skills
- Projects
- Certifications
- Preferred job roles
- Experience
- Self-assessed competencies

---

## 6.2 Resume Parsing

The system extracts relevant information from a student's resume, including:

- Programming languages
- Frameworks
- Databases
- Cloud technologies
- Tools
- Projects
- Certifications
- Soft skills
- Experience

The extracted data should be normalized before entering the skill-gap engine.

---

## 6.3 Job Description Parsing

A target job description is processed to extract:

- Required skills
- Preferred skills
- Technologies
- Experience expectations
- Education requirements
- Role-specific competencies

The system should distinguish between required and preferred skills where possible.

---

## 6.4 Skill Alignment

The system compares:

```text
Student Skills
      vs.
Target Job Requirements
```

The result includes:

- Overall alignment score.
- Matched skills.
- Partial matches.
- Missing skills.
- Priority of each gap.
- Explanation of why the gap matters.

The score is an **informational readiness indicator**, not a guarantee of placement.

---

## 6.5 Skill-Gap Analysis

Example:

| Skill | Student Level | Job Requirement | Gap | Priority |
|---|---:|---:|---:|---|
| Python | 8/10 | 8/10 | None | — |
| SQL | 4/10 | 8/10 | High | High |
| Docker | 2/10 | 6/10 | High | Medium |
| Cloud | 1/10 | 6/10 | High | Medium |
| System Design | 3/10 | 7/10 | High | High |

---

## 6.6 Personalized Roadmap

The roadmap converts skill gaps into actionable learning steps.

Example:

```text
Target Role: ML Engineer

Week 1
├── SQL fundamentals
├── Queries and joins
└── Practice assessment

Week 2
├── Advanced SQL
├── Data preprocessing
└── Mini project

Week 3
├── Docker fundamentals
└── Containerize project

Week 4
├── Cloud fundamentals
└── Deployment exercise
```

Recommendations should be prioritized by:

1. Job relevance.
2. Current skill gap.
3. Prerequisites.
4. Estimated effort.
5. Assessment performance.

---

## 6.7 Mini Assessment

The MVP should include a lightweight assessment system.

```text
Select Skill
      |
      v
Generate/Load Questions
      |
      v
Student Answers
      |
      v
Evaluate
      |
      v
Update Skill Confidence
      |
      v
Recalculate Readiness
```

Complex adaptive assessment is deferred.

---

## 6.8 Interview Preparation

Interview preparation is a **should-have** feature if time permits.

It can provide:

- Technical questions based on skill gaps.
- Project questions based on the student's resume.
- Role-specific interview questions.
- Suggested answers or evaluation criteria.

---

## 6.9 Dashboard

The student dashboard should show:

- Overall alignment/readiness score.
- Target role.
- Top skill gaps.
- Current roadmap.
- Assessment progress.
- Skills improved.
- Next recommended action.

---

# 7. Automated Student Data Import

## 7.1 Purpose

The import subsystem eliminates manual entry of institutional student data.

It accepts structured information from external sources, normalizes it into the application's internal schema, validates it, detects duplicates, and imports valid records.

---

## 7.2 Supported Sources

### MVP

| Source | Technology | Priority |
|---|---|---|
| CSV | Pandas | Must-have |
| Excel `.xlsx` | OpenPyXL / Pandas | Must-have |

### Future Integration

| Source | Technology |
|---|---|
| PostgreSQL | SQLAlchemy |
| MySQL | SQLAlchemy |
| SQL Server | SQLAlchemy |
| SQLite | SQLAlchemy |
| MongoDB | PyMongo |
| REST APIs | HTTP client + JSON parser |

For the three-week AIMORA build, **CSV and XLSX are the implementation target**. Database and API connectors are architectural extensions and must not delay the MVP.

---

## 7.3 Canonical Student Schema

All external sources are converted into one internal structure:

```text
Student
├── student_id
├── first_name
├── last_name
├── email
├── phone
├── date_of_birth          [optional]
├── enrollment_date        [optional]
├── graduation_year
├── department
├── program
├── specialization
├── semester
├── cgpa
├── skills
└── metadata
```

### Minimum Required Fields

- `student_id`
- `first_name`
- `last_name`
- `email`
- `program` or `department`

---

## 7.4 Data Mapping

External institutions may use different column names.

| External Field | Canonical Field |
|---|---|
| Register Number | `student_id` |
| Reg No | `student_id` |
| Roll Number | `student_id` |
| Student ID | `student_id` |
| First Name | `first_name` |
| Surname | `last_name` |
| Email ID | `email` |
| Mail ID | `email` |
| Mobile | `phone` |
| Mobile No | `phone` |
| Date of Joining | `enrollment_date` |
| Course | `program` |
| Branch | `specialization` |
| CGPA | `cgpa` |

Use deterministic rules first. AI-based mapping can later handle ambiguous headers but is not required for the MVP.

---

## 7.5 Validation

Each record passes through validation before insertion.

- Student ID exists.
- Student ID is unique within the import.
- First and last names are present.
- Email has a valid structure.
- CGPA is between `0` and `10`.
- Dates use a normalized format.
- Phone numbers are normalized.
- Department/program values are valid where controlled lists exist.

### Record Statuses

```text
VALID
WARNING
ERROR
DUPLICATE
```

Warnings do not necessarily block import.

---

## 7.6 Duplicate Detection

Primary duplicate key:

```text
student_id
```

Secondary duplicate key:

```text
email
```

If a duplicate is found, the administrator can select:

- Skip.
- Update existing record.
- Create a new record only when explicitly confirmed.

---

## 7.7 Import Workflow

```text
1. Select Data Source
        |
2. Upload CSV/XLSX
        |
3. Detect Columns
        |
4. Map Fields
        |
5. Validate Records
        |
6. Preview Results
        |
7. Resolve Critical Errors/Duplicates
        |
8. Confirm Import
        |
9. Batch Insert
        |
10. Show Import Summary
```

---

## 7.8 Import Preview

Example:

```text
Student Import Preview

Total Records       4,827
Valid Records       4,712
Warnings               82
Errors                 33
Duplicates             17

[View Errors] [View Duplicates] [Import Valid Records]
```

---

## 7.9 Error Reporting

The system should not fail the entire import because of a small number of invalid rows.

Valid rows are imported while invalid rows are reported.

Example:

```text
student_import_errors.csv

row,student_id,field,error
12,SRM1024,email,Invalid email format
48,SRM1098,cgpa,CGPA must be between 0 and 10
91,SRM1132,student_id,Duplicate student ID
```

Only failed records need correction and retry.

---

## 7.10 Import Job Model

```text
ImportJob
├── id
├── filename
├── source_type
├── total_records
├── successful_records
├── failed_records
├── duplicate_records
├── status
├── started_at
└── completed_at
```

Supported statuses:

```text
QUEUED
PROCESSING
COMPLETED
PARTIAL_SUCCESS
FAILED
```

---

## 7.11 Batch Processing

For larger files:

```text
Upload
   |
Import Job
   |
Batch Worker
   |
+-- Batch 1: 500–1000
+-- Batch 2: 500–1000
+-- Batch 3: 500–1000
...
   |
Completion Summary
```

For the MVP, FastAPI background processing is sufficient.

For production-scale deployment:

```text
FastAPI
  |
Redis Queue
  |
Celery/RQ Workers
  |
Database
```

This is intentionally deferred for the expo prototype.

---

# 8. AI/ML Components

## 8.1 Job Description NLP

The NLP layer extracts:

- Skills.
- Technologies.
- Experience requirements.
- Role-specific competencies.
- Required vs preferred skills.

## 8.2 Student Skill Extraction

Student skills can originate from:

- Imported records.
- Resume parsing.
- Self-reported skills.
- Assessment results.
- Project descriptions.
- Certifications.

## 8.3 Skill Normalization

Different names for the same skill should be normalized.

```text
"JS"
"Javascript"
"Java Script"
        |
        v
JavaScript
```

## 8.4 Skill-Gap Engine

```text
Student Skill Vector
        +
Job Requirement Vector
        |
        v
Similarity / Rule Engine
        |
        v
Matched Skills
Partial Matches
Missing Skills
        |
        v
Prioritized Skill Gaps
```

The first implementation should favor explainability and deterministic rules over a complicated ML model.

## 8.5 Recommendation Engine

The recommendation engine converts gaps into:

- Learning resources.
- Projects.
- Practice tasks.
- Assessments.
- Interview questions.

Recommendations should be directly linked to identified gaps.

## 8.6 Readiness Score

The system can combine:

```text
Skill Alignment
+ Assessment Performance
+ Resume Evidence
+ Roadmap Progress
```

into an informational readiness score.

The score must be explainable and should not be presented as a guaranteed probability of employment.

## 8.7 Predictive Placement Analytics

A sophisticated predictive placement model is **deferred**. The MVP should demonstrate readiness analytics rather than claim reliable prediction of whether a specific student will be placed.

---

# 9. Technical Architecture

## 9.1 Final Stack

### Mobile Frontend

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

- FastAPI
- Python
- Pydantic
- SQLAlchemy

### Data Processing

- Pandas
- OpenPyXL

### Database

- SQLite for the expo MVP.
- PostgreSQL for future institutional deployment.

### Version Control

- Git
- GitHub

### Build/Deployment

- Expo EAS
- Local development
- Free-tier services where needed

---

## 9.2 High-Level Architecture

```text
                  ┌─────────────────────┐
                  │   External Sources  │
                  │ CSV / XLSX / Future │
                  │ DB / REST API       │
                  └──────────┬──────────┘
                             │
                             v
                  ┌─────────────────────┐
                  │  Import Connector   │
                  └──────────┬──────────┘
                             │
                             v
                  ┌─────────────────────┐
                  │ Mapper + Normalizer │
                  └──────────┬──────────┘
                             │
                             v
                  ┌─────────────────────┐
                  │ Validation + Dedup  │
                  └──────────┬──────────┘
                             │
                             v
                  ┌─────────────────────┐
                  │ Preview / Confirm   │
                  └──────────┬──────────┘
                             │
                             v
                  ┌─────────────────────┐
                  │ Student Database    │
                  └──────────┬──────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
                v                         v
       ┌────────────────┐       ┌─────────────────┐
       │ Student App    │       │ Placement AI    │
       └────────────────┘       └────────┬────────┘
                                         │
                              ┌──────────┼──────────┐
                              v          v          v
                           Skills      Gaps      Roadmap
                              │          │          │
                              └──────────┴──────────┘
                                         |
                                         v
                                  Readiness Dashboard
```

## 9.3 Mobile Architecture

```text
app/
├── auth/
├── profile/
├── job-analysis/
├── skill-gap/
├── roadmap/
├── assessment/
├── interview/
├── dashboard/
└── admin-import/
```

Shared services:

```text
services/
├── api/
├── auth/
├── storage/
└── validation/
```

Keep API calls out of individual UI components wherever possible.

---

# 10. Data Model

```text
Student
 ├── student_id
 ├── name
 ├── email
 ├── department
 ├── program
 ├── specialization
 ├── semester
 ├── cgpa
 └── graduation_year

StudentSkill
 ├── student_id
 ├── skill
 ├── proficiency
 └── source

Job
 ├── id
 ├── title
 ├── company
 └── description

JobSkill
 ├── job_id
 ├── skill
 ├── requirement_type
 └── importance

SkillGap
 ├── student_id
 ├── job_id
 ├── skill
 ├── gap_level
 └── priority

RoadmapItem
 ├── student_id
 ├── skill
 ├── task
 ├── resource
 ├── week
 └── status

Assessment
 ├── id
 ├── student_id
 ├── skill
 ├── score
 └── completed_at

ImportJob
 ├── id
 ├── filename
 ├── source_type
 ├── total_records
 ├── successful_records
 ├── failed_records
 ├── duplicate_records
 └── status
```

---

# 11. API Design

## Core Application APIs

```http
POST /api/profile
GET  /api/profile/{student_id}

POST /api/job/analyze
POST /api/skill-gap/analyze

GET  /api/roadmap/{student_id}
POST /api/assessment/submit

GET  /api/dashboard/{student_id}
```

## Import APIs

```http
POST /api/import/upload
POST /api/import/preview
POST /api/import/validate
POST /api/import/confirm

GET  /api/import/{job_id}
GET  /api/import/{job_id}/errors

POST /api/import/{job_id}/retry
```

---

# 12. Application Screens

## Student Side

1. Splash / onboarding.
2. Login/demo access.
3. Student dashboard.
4. Student profile.
5. Resume upload.
6. Target job selection.
7. Job analysis.
8. Skill-gap results.
9. Personalized roadmap.
10. Assessment.
11. Interview preparation.
12. Progress/readiness.

## Admin Side

1. Admin dashboard.
2. Select data source.
3. Upload Excel/CSV.
4. Automatic field mapping.
5. Validation preview.
6. Duplicate/error review.
7. Import progress.
8. Import results.
9. Student search/profile.

---

# 13. Security, Privacy, and Governance

Student information is sensitive institutional data and should be handled accordingly.

## 13.1 Technical Security

- HTTPS/TLS for network communication.
- Secure credential storage.
- Environment variables for secrets.
- No API keys in the mobile application.
- Server-side validation.
- Access control.
- Secure file handling.
- Audit logging.

## 13.2 Role-Based Access

| Role | Import | Student Data | Admin Controls |
|---|---|---|---|
| Student | No | Own profile | No |
| Faculty | Limited | Authorized records | No |
| Placement Admin | Yes | Authorized records | Yes |
| System Admin | Yes | Full authorized access | Yes |

## 13.3 Privacy Principles

The production system should follow:

- Data minimization.
- Purpose limitation.
- Access control.
- Retention policies.
- Consent/notice requirements where applicable.
- Institutional policies.
- Applicable privacy and data-protection requirements, including relevant Indian requirements for institutional deployment.

For the expo prototype, use **synthetic or demo student data**, not real student records.

## 13.4 Audit Trail

Record:

```text
Who performed the import?
When?
Which file?
How many records?
How many succeeded?
How many failed?
How many duplicates?
```

---

# 14. Performance and Scalability

## MVP Target

The system should comfortably demonstrate imports of thousands of records on a local/free environment.

Use:

- Pandas for file parsing.
- Batch inserts.
- Database transactions.
- Background processing where appropriate.
- Pagination in mobile/API responses.

## Production Extension

```text
Load Balancer
      |
FastAPI Instances
      |
Redis / Queue
      |
Worker Pool
      |
PostgreSQL
```

The architecture should allow database and worker layers to scale independently.

---

# 15. Three-Week Implementation Plan

The project is constrained to **3 weeks and 2 people**.

The goal is to deliver a reliable, visually polished end-to-end demonstration rather than every possible enterprise feature.

## Week 1 — Foundation + Core Data Flow

### Days 1–2

**Both**
- Finalize architecture.
- Create GitHub repository.
- Initialize Expo project.
- Initialize FastAPI project.
- Define canonical student schema.
- Freeze API contract.
- Prepare demo data.
- Define folder structure.

**Person A — AI/Product**
- Implement student schema.
- Build CSV/XLSX parsing.
- Implement column detection.
- Implement field mapping.
- Implement validation.
- Implement duplicate detection.
- Build initial skill extraction logic.
- Prepare sample job descriptions.

**Person B — Mobile/Integration**
- Build Expo navigation.
- Create design system.
- Build dashboard shell.
- Build profile screen.
- Build import screens.
- Implement mock JSON data.
- Create reusable cards, buttons, badges, and progress components.

### Days 3–4

**Person A**
- Complete import pipeline.
- Build skill normalization.
- Implement job-description parser.
- Implement initial alignment engine.

**Person B**
- Build Dashboard.
- Build Profile.
- Build Job Selection.
- Build Skill Gap.
- Build Roadmap.
- Build Assessment using mocked API responses.

### Day 5 — Contract Freeze

Both:
- Finalize API request/response formats.
- Test frontend with backend responses.
- Resolve naming inconsistencies.
- Freeze major architecture.

After this point, structural changes require a strong reason.

## Days 6–7 — First Integration

**Person A**
- Connect import API.
- Connect skill-gap engine.
- Implement roadmap generation.
- Implement import job status.

**Person B**
- Replace mock import data with API.
- Integrate student profile API.
- Integrate skill-gap response.
- Integrate roadmap response.
- Handle loading/error states.

### End-of-Week Target

```text
Imported Student
      ↓
Profile
      ↓
Target Job
      ↓
Skill Analysis
      ↓
Skill Gaps
```

---

## Week 2 — Intelligence + Complete Workflow

### Days 8–10

**Person A**
- Complete roadmap logic.
- Implement mini assessment.
- Implement readiness recalculation.
- Improve AI prompt/output reliability.
- Add deterministic fallback logic.

**Person B**
- Finish roadmap UI.
- Finish assessment UI.
- Finish readiness dashboard.
- Add animations and transitions.
- Improve empty/loading/error states.

### Days 11–12

Both:
- Full API integration.
- Test complete user journey.
- Fix broken state transitions.
- Validate imported students against app profiles.
- Test invalid data and duplicate imports.

### Day 13 — Go/No-Go Check

The following must work:

```text
Admin
  ↓
Upload Student Data
  ↓
Validate
  ↓
Import
  ↓
Student Profile
  ↓
Target Job
  ↓
AI Skill Analysis
  ↓
Skill Gaps
  ↓
Roadmap
  ↓
Assessment
  ↓
Updated Readiness
```

If this works, feature expansion stops. If it does not, all non-essential work is frozen until it works.

---

## Week 3 — Polish + Expo Readiness

### Days 14–15

- Improve visual design.
- Refine typography.
- Improve spacing.
- Improve cards and progress indicators.
- Add useful animations.
- Improve AI output presentation.
- Add explanations to readiness scores.
- Add polished demo data.

### Days 16–17 — Offline/Demo Mode

```text
Try Live API
     |
     +---- Success ----> Live Results
     |
     +---- Failure ----> Demo/Local Results
```

The application must remain demonstrable if the backend or internet connection fails.

### Day 18 — Full QA

Test:

- Valid import.
- Invalid email.
- Invalid CGPA.
- Missing required field.
- Duplicate student ID.
- Duplicate email.
- Empty resume.
- Invalid job description.
- Backend unavailable.
- Slow API.
- Navigation.
- App restart.
- Demo mode.
- Different screen sizes.

### Day 19 — Build and Device Testing

- Create Expo/EAS preview build.
- Install on an actual phone.
- Test complete workflow on a physical device.
- Test permissions.
- Test file upload.
- Test API connectivity.
- Fix build-specific issues.

### Day 20 — Feature Freeze

No new features.

Only:

- Bug fixes.
- Visual fixes.
- Performance fixes.
- Demo reliability.
- Documentation.

### Day 21 — Final Rehearsal

Perform the complete demonstration multiple times.

The team should explain:

1. Problem.
2. Existing difficulty.
3. Automated import.
4. AI analysis.
5. Skill gaps.
6. Personalized roadmap.
7. Assessment.
8. Updated readiness.
9. Institutional value.
10. Future scalability.

---

# 16. Two-Person Team Responsibilities

## Person A — Product + AI + Backend/Data

Primary ownership:

- Data schema.
- CSV/XLSX ingestion.
- Mapping.
- Validation.
- Deduplication.
- Backend APIs.
- Skill extraction.
- Job analysis.
- Skill-gap engine.
- Roadmap generation.
- Assessment logic.
- Demo datasets.
- AI prompts.
- Backend fallback logic.

Estimated workload: **~73 hours over 3 weeks.**

## Person B — Mobile + UX + Integration

Primary ownership:

- Expo setup.
- Navigation.
- UI system.
- Screens.
- Components.
- API integration.
- State management.
- Loading/error states.
- Animations.
- Device testing.
- EAS build.
- Demo flow.
- Final visual polish.

Estimated workload: **~84 hours over 3 weeks.**

## Shared Responsibilities

Both people participate in:

1. Architecture agreement.
2. API contract freeze.
3. First major integration.
4. Full workflow validation.
5. Feature freeze.
6. Final rehearsal.

---

# 17. Vibe-Coding Workflow

Because development will be heavily AI-assisted, AI coding tools should be treated as implementation assistants rather than autonomous developers.

## Recommended Workflow

```text
Define Small Feature
       ↓
Write Exact Requirements
       ↓
Ask AI to Implement
       ↓
Run/Test Immediately
       ↓
Fix One Issue at a Time
       ↓
Commit Working Version
       ↓
Move to Next Feature
```

## Prompt Structure

Each coding request should include:

```text
Context:
What the project already contains.

Task:
Exactly one feature.

Constraints:
Libraries, architecture, APIs, naming.

Expected behavior:
What the feature must do.

Acceptance criteria:
How we know it works.

Do not:
List things the AI must not change.
```

Avoid asking an AI coding tool to redesign the entire application in one prompt.

## Git Rule

After every working milestone:

```bash
git add .
git commit -m "feat: completed feature"
```

Push regularly.

---

# 18. Testing and Quality Assurance

## Backend Tests

Test:

- Schema validation.
- File parsing.
- Column mapping.
- Duplicate detection.
- Import results.
- Skill extraction.
- Alignment calculations.
- Roadmap generation.
- API error handling.

## Frontend Tests

Test:

- Navigation.
- Forms.
- File selection.
- API states.
- Loading states.
- Error states.
- Empty states.
- Dashboard rendering.
- Assessment flow.

## Manual End-to-End Test

```text
Import
  ↓
Student Profile
  ↓
Resume
  ↓
Target Job
  ↓
Skill Gap
  ↓
Roadmap
  ↓
Assessment
  ↓
Readiness Update
```

This flow is more important for the expo than extensive automated test coverage.

---

# 19. Offline and Demo Mode

Offline/demo capability is mandatory because a live AI or backend failure should not destroy the presentation.

## Fallback Strategy

```text
Live API
   |
   +--> Available → use live response
   |
   +--> Unavailable → use deterministic demo response
```

Prepare at least one complete synthetic student:

```text
Student:
Aarav Kumar

Program:
CSE - AIML

Target Role:
Machine Learning Engineer

Alignment:
71%

Top Gaps:
- SQL
- Docker
- Cloud
- System Design

Roadmap:
8 weeks
```

The exact values are demonstration data and must not be presented as real institutional statistics.

---

# 20. Expo and Deployment Preparation

## Expo Requirements

- Expo project configured correctly.
- Expo Router navigation.
- Physical-device testing.
- EAS preview build.
- Production-style build tested before the event.
- App icon and splash screen.
- Clean application name.
- Reliable demo account/data.
- No exposed secrets.

## Important Rule

Do not wait until the final day to build the application.

The first device build should happen well before the expo.

Native configuration changes may require a new build, so late dependency changes should be avoided.

---

# 21. Risks and Contingencies

| Risk | Impact | Mitigation |
|---|---|---|
| AI-generated code breaks app | High | Small prompts + frequent commits |
| AI API unavailable | High | Local/demo fallback |
| AI API costs | Medium | Free-first design + limited calls |
| EAS build failure | High | Build by Day 19 |
| Scope creep | High | Feature freeze |
| Backend delays | High | Mock JSON for frontend |
| Skill gaps in team | Medium | AI-assisted implementation + clear ownership |
| Internet failure | High | Offline/demo mode |
| Hallucinated AI output | Medium | Deterministic validation + constrained prompts |
| Dependency conflicts | Medium | Freeze dependencies after Week 1 |
| Bad imported data | High | Preview + validation + partial import |
| Duplicate students | Medium | Student ID/email deduplication |

> **A working 70% product is worth more than a broken 100% product.**

---

# 22. Expo Demonstration Flow

The demonstration should tell one continuous story.

## Step 1 — Administrator Imports Data

```text
Admin Dashboard
      ↓
Upload SRM_AIML_Students.xlsx
```

Example result:

```text
Records detected: 1,248

Valid:       1,213
Warnings:       24
Errors:        11
Duplicates:     9
```

These figures are synthetic demo values.

## Step 2 — Automatic Mapping

```text
Reg No     → Student ID
Mail ID    → Email
Branch     → Specialization
CGPA       → CGPA
Mobile No  → Phone
```

## Step 3 — Validation

```text
✓ Valid records
⚠ Warnings
✕ Errors
↔ Duplicates
```

Then import valid records.

## Step 4 — Open a Student

The imported student profile appears automatically. No manual profile creation is required.

## Step 5 — Select Target Role

```text
Target Role:
Machine Learning Engineer
```

## Step 6 — AI Analysis

The system processes:

```text
Student Profile
+
Resume
+
Target Job Description
```

Example result:

```text
Alignment: 71%

Strong:
Python
Machine Learning
Pandas

Gaps:
SQL
Docker
Cloud
System Design
```

## Step 7 — Personalized Roadmap

Show a role-specific roadmap rather than a generic course list.

## Step 8 — Assessment

The student completes a short assessment on one identified gap.

## Step 9 — Updated Readiness

The dashboard updates the relevant skill/readiness indicators.

The demonstration ends by showing the continuous loop:

```text
Institutional Data
       ↓
Student Profile
       ↓
Job Requirements
       ↓
Skill Gap
       ↓
Learning
       ↓
Assessment
       ↓
Updated Readiness
```

---

# 23. Success Metrics

## Student-Level

- Skill alignment score.
- Number of identified gaps.
- Skill-gap closure.
- Assessment performance.
- Roadmap completion.
- Engagement with recommended activities.

## Institutional-Level

- Percentage of student records imported automatically.
- Import success rate.
- Number of data errors detected.
- Duplicate detection rate.
- Time saved during onboarding.
- Percentage of students with complete career profiles.

## Placement-Level

Long-term institutional metrics can include:

- Placement rate.
- Time to placement.
- Skill-gap closure before placement.
- Employer satisfaction.
- Student readiness improvement.

The MVP should demonstrate the measurement framework rather than claim validated institutional outcomes.

---

# 24. MVP Scope and Deferred Features

## Must-Have

- Student profile.
- CSV/XLSX import.
- Automatic column detection.
- Field mapping.
- Validation.
- Duplicate detection.
- Import preview.
- Partial import.
- Error reporting.
- Resume parsing.
- Job-description parsing.
- Skill extraction.
- Skill-gap analysis.
- Alignment score.
- Personalized roadmap.
- Mini assessment.
- Dashboard.
- Offline/demo mode.
- Polished Expo UI.

## Should-Have

- Interview preparation.
- More advanced recommendations.
- Additional visual analytics.

## Deferred

- Recruiter portal.
- Full placement-team dashboard.
- Live job scraping.
- LMS integration.
- Job-portal integration.
- Full SIS integration.
- Real-time external database synchronization.
- MongoDB connector.
- MySQL/SQL Server connectors.
- Complex adaptive assessments.
- Advanced knowledge graph.
- Sophisticated predictive placement model.
- Full cloud enterprise ETL pipeline.
- App-store launch.

These can be presented as the **future institutional deployment roadmap**.

---

# 25. Final Deliverables

## Product

- Working Expo mobile application.
- Working FastAPI backend.
- Student database.
- CSV/XLSX import pipeline.
- Validation and duplicate handling.
- AI skill-gap workflow.
- Personalized roadmap.
- Assessment.
- Dashboard.
- Offline/demo mode.

## Technical

- GitHub repository.
- Clean project structure.
- API documentation.
- Database schema.
- Import schema.
- Demo dataset.
- Environment configuration example.
- Tested Expo/EAS build.

## Presentation

- Problem statement.
- Architecture diagram.
- AI/ML workflow.
- Import workflow.
- Live demo.
- Results/metrics.
- Security and privacy explanation.
- Future-scope slide.

---

# 26. Final Product Definition

## Product Name

**Placement Skill Gap AI**

## One-Line Description

> An AI-powered placement-readiness platform that automatically imports student data, compares student capabilities with target job requirements, identifies prioritized skill gaps, and generates measurable personalized learning roadmaps.

## Core Innovation

The project combines two normally separate processes:

```text
Institutional Student Data Management
                +
AI-Powered Career Readiness
                =
Automated Placement Skill Intelligence
```

Instead of asking every student to manually create a profile, the institution can import structured student data once.

Instead of giving students generic placement advice, the system analyzes the requirements of a specific target role.

Instead of only identifying missing skills, it creates a prioritized roadmap and measures progress.

## Final End-to-End Product

```text
┌─────────────────────────────────────────────┐
│          INSTITUTIONAL DATA                 │
│                                             │
│   Excel / CSV / Future DB / REST API       │
└──────────────────────┬──────────────────────┘
                       │
                       v
┌─────────────────────────────────────────────┐
│         AUTOMATED DATA IMPORT               │
│                                             │
│ Mapping → Validation → Deduplication       │
│ → Preview → Batch Import                   │
└──────────────────────┬──────────────────────┘
                       │
                       v
┌─────────────────────────────────────────────┐
│            STUDENT PROFILE                  │
│                                             │
│ Academic + Resume + Skills + Projects      │
└──────────────────────┬──────────────────────┘
                       │
                       v
┌─────────────────────────────────────────────┐
│              TARGET JOB                     │
│                                             │
│ Job Description → Required Skills           │
└──────────────────────┬──────────────────────┘
                       │
                       v
┌─────────────────────────────────────────────┐
│              AI ANALYSIS                    │
│                                             │
│ Skill Extraction → Matching → Gap Analysis │
└──────────────────────┬──────────────────────┘
                       │
                       v
┌─────────────────────────────────────────────┐
│          PERSONALIZED ROADMAP               │
│                                             │
│ Learn → Practice → Assess → Improve        │
└──────────────────────┬──────────────────────┘
                       │
                       v
┌─────────────────────────────────────────────┐
│          READINESS DASHBOARD                │
│                                             │
│ Alignment • Skill Gaps • Progress          │
└─────────────────────────────────────────────┘
```

### Final Implementation Principle

Build the **complete core journey**, not every possible feature.

The final AIMORA product should feel like a real institutional application: polished enough to demonstrate, simple enough to finish in three weeks, explainable enough to defend technically, and structured so that future database, API, LMS, recruiter, and institutional integrations can be added without redesigning the core system.
