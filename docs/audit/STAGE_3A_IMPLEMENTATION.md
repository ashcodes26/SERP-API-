# Stage 3A Implementation — Navigation and Shared UI Foundation

## Scope

Stage 3A implements shared navigation, faculty URL-state, account-menu, accessibility-semantic, and navigation-copy improvements only. It does not redesign individual feature pages, add product features, alter backend contracts, or change database schemas.

## Problems fixed

### Faculty active-state precedence (P1)

Added `mobile/src/utils/faculty-navigation.ts` as the shared source of truth for valid faculty sections.

- A valid explicit `section` always wins, including `/admin?student={id}&section=reviews-training`.
- A student detail without a valid explicit section resolves to Students & Cohorts.
- An invalid section falls back safely to Students & Cohorts when a student is present, otherwise Overview.
- Both `admin.tsx` content selection and `app-navigation.tsx` active styling use the shared resolver.

This fixes the previous mismatch where Training content was visible while the global navigation highlighted Students & Cohorts.

### Faculty mobile navigation and duplication

- Desktop retains direct global faculty links.
- At widths below 900px, global faculty navigation becomes one labelled **Faculty sections** disclosure menu containing all six sections.
- The former in-page duplicate **Faculty sections** selector was removed from `/admin`.
- The compact menu has labelled, 44px minimum-height links and active-state styling. It does not rely solely on hidden horizontal scrolling.

### Reports and Reviews & Training clarity

- Removed the global CSV export action from every faculty section.
- The existing export remains unchanged in **Reports**, which is now the clear export location and still uses the existing scoped `placementApi.report` behavior.
- Reviews & Training now explains that resume reviews live in scoped student detail and offers a contextual route to Students & Cohorts. No review data model, API, or storage was added.

### Account menu and semantics

- The account menu now renders as an absolutely positioned bounded panel, preventing the prior header reflow/layout shift.
- It retains an accessible toggle label and expanded state, sign-out, profile guidance, and a keyboard/touch-accessible close action.
- Route-changing primary and local navigation controls now use link semantics rather than tab semantics. In-page controls retain their existing semantics.

## Files changed

- `mobile/src/utils/faculty-navigation.ts` — valid faculty section definitions and deterministic URL-resolution helper.
- `mobile/src/components/app-navigation.tsx` — semantic route links, shared resolver, responsive mobile faculty menu, corrected active states.
- `mobile/src/app/admin.tsx` — shared section resolver, removal of redundant selector/global export, contextual reviews entry.
- `mobile/src/app/_layout.tsx` — bounded account-menu panel without header layout shift.
- `mobile/tests/role-routing.test.cjs` — deep-link and section-precedence regression coverage.

## Before and after

| Area | Before | After |
|---|---|---|
| `/admin?student=id&section=reviews-training` | Training content displayed but Students & Cohorts was globally active. | Training content and Reviews & Training are both active. |
| Faculty mobile navigation | Six long sections relied on hidden horizontal scrolling, plus duplicate in-page controls. | One visible, labelled section selector exposes every destination. |
| Faculty navigation | Global navigation and an identical in-page selector competed. | One primary mechanism per breakpoint. |
| CSV export | Repeated globally and in Reports. | Existing export is owned by Reports. |
| Reviews & Training | Training appeared without an obvious route to the existing review workflow. | Contextual explanation routes faculty to scoped student reviews. |
| Account menu | Expanded inside the header and shifted layout. | Bounded overlay panel with close action. |
| Route controls | Used tab semantics despite route navigation. | Use link semantics with selected-state indication. |

## Verification

| Command | Result |
|---|---|
| `mobile: npm.cmd test` | Pass — 16 tests |
| `mobile: npx.cmd tsc --noEmit` | Pass |
| `mobile: npm.cmd run lint` | Pass |
| Backend tests | Not rerun: Stage 3A did not change backend code, APIs, models, or schemas. The Stage 2B verified baseline is 176 passed. |

New regression coverage verifies:

- valid explicit faculty sections win over student-detail fallback;
- student detail falls back to Students & Cohorts without a valid section;
- invalid section fallback behavior;
- `/admin?student=7&section=reviews-training` remains a permitted faculty deep link;
- existing student/faculty route restrictions remain intact.

## Remaining UX issues

- The mobile section menu, account popover placement, keyboard focus order, and screen-reader announcements require a browser/device pass; no browser surface was available in this session.
- Reviews remain contextual to each student detail by design. A future visual pass should confirm the explanatory entry is sufficiently discoverable without duplicating review data.
- Reports maintains the existing filter/role behavior. A future visual pass should confirm faculty understand that selected cohort filters affect the export.
- No production build script is defined in `mobile/package.json`; Expo web runtime/build verification remains a separate environment task.

## Manual verification requirements

1. At 360px, open Faculty sections and confirm every section is visible, reachable by touch, and closes after navigation.
2. At 768px and desktop widths, verify the global faculty links are visible, selected, and preserve current URLs.
3. Open `/admin?student=<id>&section=reviews-training`; confirm training content and Reviews & Training active state agree. Refresh and repeat.
4. Open `/admin?student=<id>`; confirm Students & Cohorts is active. Test an invalid `section` with and without `student`.
5. Use keyboard only: tab through global/local navigation, account menu, close control, and sign-out; confirm focus outline remains visible.
6. With a screen reader, verify route links are announced as links and account menu state is announced as expanded/collapsed.
7. Confirm Reports exports the same scoped CSV as before and no other faculty section exposes a competing global export action.
8. Sign in as student and directly enter `/admin` and `/admin-import`; sign in as faculty and enter `/resume`; verify the existing role redirects remain intact.
