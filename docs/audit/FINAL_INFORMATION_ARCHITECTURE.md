# Final Information Architecture — SkillUp

Stage 2A design artifact. This document defines organization only; it authorizes no application changes, new backend capability, schema change, or removal of a current route.

## Design principles

1. **Journey remains the student landing page.** `/` is My Career Plan, not a separate dashboard. First-time and returning students resume the same Profile → Alignment → Roadmap flow.
2. **Navigation represents user intent, not implementation domains.** Search and demand are both opportunities; resume and LinkedIn are both career assets.
3. **No duplicate overview screen.** Readiness, next action, active target role, and plan status stay in the Journey where they already have context.
4. **Deep links survive.** Existing URLs remain valid during and after the navigation transition. Initial work changes labels/grouping before physical route migration.
5. **Student evidence stays private by default.** Placement sharing remains explicit. Faculty scopes and API authorization are unchanged.

## Student workspace

### Primary areas

| Navigation item | Purpose | Contents | Existing routes retained |
|---|---|---|---|
| **My Career Plan** | The landing experience and source of truth for learner progress | Profile/document input, target role, alignment, skill gaps, deterministic roadmap, AI roadmap, roadmap exports | `/` |
| **Career Assets** | Improve student-controlled professional assets in target-role context | Resume Analyzer, LinkedIn Analyzer | `/resume`, `/linkedin` |
| **Opportunities** | Explore roles and interpret external demand | Job Search & Matching, Skill Demand | `/jobs`, `/market` |
| **Placement Hub** | Act on institution-managed opportunities and support | Drives, applications, faculty feedback, training, assessments | `/placement` |
| **Profile & Settings** | Account/session and personal preferences | Initial release: account name, sign-out, session state; profile editing continues in My Career Plan | No new route in this stage; account affordance in global header |

### My Career Plan

The current `/` Journey is retained and should stay a three-step continuous workflow:

1. **Profile** — reviewed PDF/DOCX details upload, competency evidence, editable target role and requirements.
2. **Role Alignment** — readiness context, evidence coverage, gap prioritization, and warnings.
3. **Learning Roadmap** — deterministic roadmap context, consented AI learning plan, HTML plan download, and progress export.

The first visible state is conditional, not a separate dashboard:

- **First-time student:** Profile is selected and clearly explains the one required next action: upload/review details and set the target role.
- **Returning student with no analysis:** Profile appears with existing evidence and “Analyze gaps” as primary action.
- **Returning student with analysis:** preserve current analysis/roadmap state when navigating from a matching opportunity; otherwise open Profile with an unobtrusive “Continue your plan” path to current analysis.
- **Returning student with placement work:** do not duplicate pending training or applications in a dashboard; Placement Hub remains the action location. A small contextual link may appear in Journey only if it is an existing supported state.

### Career Assets

Use a parent label in primary navigation and a local segmented switch/tabs on asset screens:

- **Resume Analyzer**: upload/paste, select target/listing, consented Gemini analysis, review edits, save/restore/export.
- **LinkedIn Analyzer**: consented profile text/export/URL handling, profile analysis, role comparison, recommendations.

The two tools share a clear target-role handoff but keep their individual consent, storage, and export rules. Do not merge their data models or prompts in this stage.

### Opportunities

- **Job Search & Matching** is the entry point: retrieve listings, inspect provenance, match a listing to student evidence, then hand off to Resume or My Career Plan.
- **Skill Demand** is a supporting analysis view: collected-market ranking, role comparison, personal evidence/demand view, and CSV download.

This grouping prevents Skill Demand from appearing as an unrelated peer product while retaining its independent route and full-screen workspace.

### Placement Hub

One workspace, ordered around the student’s actions:

1. Assigned faculty / shared resume review status
2. Placement drives and eligibility notes
3. Applications and status updates
4. Training assignments
5. Assessments launched from assigned training

No new placement dashboard metrics are introduced. Existing empty states remain explicit when a student has no faculty assignment, drives, reviews, or training.

## Faculty/Admin workspace

### Primary areas

| Navigation item | Contents | Current implementation source |
|---|---|---|
| **Overview** | Existing scoped metrics, definitions, follow-up queue, cohort creation entry point | `/admin` Overview tab |
| **Students & Cohorts** | Student list/detail, filters, cohort selection/creation; student import entry | `/admin` Students tab; `/admin-import` |
| **Skill Analytics** | Target-role cohort gap analysis and student drill-down | `/admin` Skill gaps tab |
| **Placement Management** | Drives, eligibility context, applications through student detail | `/admin` Drives tab; student details |
| **Reviews & Training** | Resume reviews in student detail; cohort/student training assignment | `/admin` Students detail and Training tab |
| **Reports** | Existing scoped filtered CSV export only | Current `/admin` export action |

This organization does not mandate six physical pages immediately. The first implementation should retain `/admin` and add stable local navigation/anchors; later route decomposition may add aliases while keeping `/admin?student=…` compatible.

## Desktop navigation specification

### Global shell

- Brand at left; active workspace/role context and account menu at right.
- Student primary navigation: **My Career Plan**, **Career Assets**, **Opportunities**, **Placement Hub**.
- Faculty primary navigation: **Overview**, **Students & Cohorts**, **Skill Analytics**, **Placement Management**, **Reviews & Training**, **Reports**.
- Profile & Settings is accessed from the account menu, not a fifth competing student top-level tab in the first implementation.
- Active section uses both color and a visible selected-state affordance; parent label remains visible when a child screen is active.

### Local navigation

- Career Assets: Resume / LinkedIn segmented tabs.
- Opportunities: Job Search / Skill Demand segmented tabs.
- Faculty: local section controls or route tabs; preserve selected filter/cohort state when moving between related faculty sections.
- Journey: fixed Profile / Alignment / Roadmap stepper; inactive steps explain prerequisite state rather than silently disabling context.

## Mobile navigation specification

- Use a compact top bar with workspace label and account menu.
- Student primary areas use a horizontally scrollable, labelled navigation bar; never icon-only. The active parent is retained while local tabs are visible below it.
- On narrow screens, local navigation becomes a segmented control or expandable section selector; content must not require horizontal card scrolling.
- Faculty navigation becomes a labelled “Faculty sections” selector/drawer plus current-section title. Preserve selected cohort/filter state in URL or component state as currently supported.
- Keep minimum 44px touch targets, labelled controls, visible keyboard focus on web, and status text beyond color.

## First-time and returning journeys

### First-time student

`Login → My Career Plan/Profile → Upload or enter reviewed details → Set target role → Analyze alignment → Build roadmap → optional AI plan → Career Assets or Opportunities → Placement Hub when assigned.`

### Returning student

`Login → My Career Plan` opens current Profile state. The next incomplete Journey step is the primary action. A Job Match handoff may open the existing analysis context; Resume and LinkedIn return users to their own saved workspaces, not duplicate plan state.

### Faculty workflow

`Login → Overview → choose cohort/filter → Students & Cohorts or Skill Analytics → Placement Management → Reviews & Training → Reports.`

Import is reached from Students & Cohorts and returns to the selected cohort context. It remains a guarded multi-step operation, not a global top-level student-management shortcut.

## Explicit non-goals

- No separate student dashboard.
- No new backend APIs, schema changes, metrics, or AI provider behavior.
- No deletion of RoadmapTask APIs or legacy components in Stage 2A.
- No merge of resume and LinkedIn storage/consent workflows.
