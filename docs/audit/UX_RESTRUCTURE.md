# UX and Information Architecture Restructure

## Diagnosis

The current student navigation treats workflow steps and specialist tools as peers: Journey, Job Search, Skill Demand, Resume, LinkedIn, and Placement. This creates context switching and repeats concepts such as target role, skill evidence, analysis, roadmap, and resume tailoring. Faculty features are more coherent but `admin.tsx` concentrates five domains in one screen while imports are separated with a different visual system.

## Recommended information architecture

### Student

1. **Home / Career dashboard** (`/`)
   - readiness snapshot, current target role, next action, pending training, and active applications
   - one primary action based on state: add profile, analyze role, create roadmap, or complete training
2. **Career plan** (`/career-plan` or retained `/` subroutes)
   - Profile and evidence
   - Target role and alignment
   - Learning roadmap and AI plan/export
3. **Opportunities** (`/jobs`)
   - Job search, job detail, match, and direct resume-tailoring handoff
4. **Insights** (`/market`)
   - market demand, role comparison, and personal skill demand in one area
5. **Career assets** (`/resume`, `/linkedin`)
   - tabs or segmented navigation for Resume and LinkedIn, with shared target-role context
6. **Placement** (`/placement`)
   - applications, faculty reviews, and assigned training

Keep current URLs as redirects/deep links during a migration; do not make a breaking navigation change.

### Faculty

1. **Faculty home**: cohort health, overdue work, review queue, and placement pipeline
2. **Students**: searchable list and student detail as separate route/state
3. **Cohorts and skills**: cohort management plus skill-gap analytics
4. **Opportunities**: drives, eligibility review, applications
5. **Reviews and training**: resume reviews and assignments
6. **Import and reports**: imports, job history, error resolution, CSV report

## UX rules to standardize

| Area | Required change | Why | Priority | Files initially affected | Verification |
|---|---|---|---|---|---|
| Page shell | Adopt one screen header, content width, feedback region, loading pattern, and action hierarchy. | Current local style systems drift. | P1 | `career-ui.tsx`, `_layout.tsx`, `login.tsx`, `admin-import.tsx`, each screen | Snapshot/visual test at 360px, 768px, 1440px. |
| Async state | One reusable hook for busy/error/retry/cancellation and request identity. | Prevents stale errors and duplicated ad-hoc `perform` logic. | P0 | `index.tsx`, `jobs.tsx`, `market.tsx`, `resume.tsx`, `linkedin.tsx`, `placement.tsx`, `admin.tsx` | Simulate abort, failure, retry, rapid navigation. |
| Empty states | Add clear contextual empty states for profile, market collection, placement access, resume history, and faculty scope. | Users currently need to infer prerequisites from sparse copy. | P1 | all page screens and reusable cards | Accessibility assertions and product walkthrough. |
| Context continuity | Show active target role and selected job consistently; offer explicit change action. | Target role is repeatedly entered across Journey, Jobs, Resume, LinkedIn. | P1 | `index.tsx`, `jobs.tsx`, `resume.tsx`, `linkedin.tsx`, session/context layer | Navigate Job → Resume → Journey without losing context. |
| Roadmap | Keep AI plan, deterministic items, and progress/export in one cohesive display; hide/remove obsolete task controls only after API decision. | Current UI removed cards while exports still rely on roadmap items. | P1 | `career-roadmap.tsx`, `jobs.tsx`, backend roadmap routes | Generate plan, update progress, export HTML/PDF/DOC. |
| Faculty density | Split dashboard domains or use persistent subnavigation with independent loading/empty states. | `admin.tsx` is difficult to scan and maintain. | P1 | `admin.tsx`, `placement-ui.tsx`, API client | Faculty task tests for review, drive, assignment, report. |
| Accessibility | Standardize labelled inputs, focus after errors, sufficient contrast, non-color status labels, modal focus management, and keyboard navigation. | React Native Web support alone is insufficient. | P1 | forms/components/screens | axe-like checks and manual keyboard pass. |

## Journey improvements

- Make **Profile → Alignment → Plan** a persistent stepper with completion status and a single primary next action.
- Make external limitations visible where decisions occur: “live job data unavailable”, “AI plan needs consent”, “PDF must contain selectable text”, and “faculty has not been assigned”.
- Consolidate success feedback: save/import/analysis/export confirmation should be persistent enough to read and tied to the changed record.
- Keep the current dark visual identity, but apply one component library rather than page-local variants.
