# Admin demo records

Each of the six admin sections has a compact **Demo** button at the top right
(accessible name: **Load demo records**). It creates or reuses
the signed-in faculty account's `Demo fixtures - placement workspace` cohort,
selects that cohort, clears previous search filters and student detail selection,
and refreshes stats through the existing scoped APIs. Skill analytics also loads
the demo target role and its calculated gaps. Reviews & training shows member
summaries linking to their saved records. Reports exports the selected scope.

The cohort contains six fictional profiles, known and unknown skill levels,
four simulated assessment attempts, five resume reviews, six training assignments,
six application histories and two fictional drives. Example links use example.com.
These are fixtures, including all scores and hiring outcomes; the selected
cohort and record names retain their demo labels. The large demo panels and
explanatory notices were removed, while section stats remain visible.
All aggregates use the existing backend
calculations. No Gemini or SerpApi calls are made, and no passwords are created.

`POST /api/admin/demo` requires an authenticated admin and development/test mode.
Its `FacultyDemoOut` response carries `provenance: demo_fixture` plus cohort, role
and example-student IDs. The schema is mirrored in TypeScript. Repeated clicks
reuse records and preserve demo edits. Other cohorts and existing students are
not modified. A conflicting student identity or unmarked cohort aborts loading.
Records persist in the local SQLite database; no database migration is needed.

Changed files: `backend/app/services/faculty_demo.py`, `backend/app/routes/placement.py`,
`backend/app/schemas.py`, `backend/tests/test_placement.py`, `mobile/src/api/placement.ts`,
`mobile/src/types/contracts.ts`, and `mobile/src/app/admin.tsx`.

Verification covers role permissions, production blocking, owner isolation,
repeat loading, computed counts, unknown proficiency, report export and conflict
rollback. This is the existing single-process SQLite development prototype.

Checks run: backend `python -m pytest -q` passed **186 tests** (one existing
Starlette/httpx deprecation warning). Frontend `npx tsc --noEmit` and
`npx expo lint` passed. Browser checks clicked Load demo records in all six
sections and confirmed selected cohort, records, stats and calculated skill gaps.
Repeated clicks retained six members and unchanged fixture counts. Both local
servers were restarted with this feature and remain running. No deployment or
provider API call was performed.
