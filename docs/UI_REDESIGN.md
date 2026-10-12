# SkillUp Dark Void redesign

The latest user request supersedes the original Linear palette and the Skill Demand attachment's isolated-feature restriction. The app now uses pure black, white text, Electric Iris (#8052ff), saffron (#ffb829), and restrained verdant (#15846e). Palette values are centralized in mobile/src/constants/palette.ts and mirrored in the web variables stylesheet. The original supplied files remain archived in mobile/design-reference. System font fallbacks are used; no licensed font was supplied.

Guide is removed from the router and both navigation components. Jobs is labelled Job Search. Shared sections use whitespace and separators, with violet pill actions and short labels. Authentication, uploads, analysis calls, consent, deletion controls and persistent roadmap/task operations retain their existing backend contracts.

## Stats and graphs

- Journey: measured alignment ring, recorded competency bars and current/target gap comparison. Unknown proficiency remains unavailable.
- Resume: original/revision text-strength comparison, statement counts, alignment ring, expandable score breakdown and unsaved preview comparison.
- LinkedIn: text-quality ring, evidence-category counts and target keyword coverage.
- Job Search: listing counts and measured role alignment.
- Skill Demand: ranked interactive demand bars, client-side skill search, inline matching listings and source excerpts, required/preferred counts, role comparison bars and existing personal radar. Analyze Demand retrieves jobs through the backend when a role is supplied; a blank role loads collected data. Role chips load their stored scope. Existing date filters, CSV export and personal comparisons remain available.
- Roadmap/tasks: milestone completion and saved task counts/progress, distinct from proficiency.
- Import: actual valid, duplicate, error and imported row counts.

No salary, trend, hiring probability or historical performance data is invented. Percentages, counts and scores remain labelled as separate measures.

## Improvements

Numbered rows show a brief summary and status. View change reveals full reasons, excerpts and before/after text. Resume accept/reject/reset and evidence entry remain connected to the existing API; LinkedIn Add task still persists the complete recommendation. Source evidence and scoring explanations use progressive disclosure.

## Verification

- npx tsc --noEmit: passed.
- npx expo lint: passed.
- node --test tests/market-data.test.cjs tests/resume-workspace.test.cjs: 6 passed, including skill filtering that preserves ranks and null values.
- npx expo export --platform web --output-dir .design-check: passed, 8 routes, no Guide route.
- Backend APP_ENV=test .venv/Scripts/python.exe -m pytest -q: 112 passed.

No dependencies added, no API/schema changes and no environment configuration required. Browser/device visual and live-provider interaction checks remain unverified. Recommended next check: review signed-in screens at desktop and phone widths. Refresh http://localhost:8081 to use the redesign.
