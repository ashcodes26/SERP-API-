# SkillUp — Product UX, Information Architecture, and User Journeys

Prompt 1 specification · 2026-10-20 · Asia/Calcutta

## 1. Scope, evidence, and ownership

This document specifies refinements to the existing product. **None of the expected behavior or acceptance criteria below is a claim that it has been implemented or passed.** This session inspected source and existing reports; it did not run the application in a browser or contact providers.

Inspected worktree: `skillup-quality`; HEAD `8ae05aefc8b6c67ddc169831df50f41140b4b83d`, detached HEAD, initially clean. No branch switch, commit, migration, feature activation, or application change is part of this task. The sole repository edit is `docs/quality/PRODUCT_UX_SPEC.md`, authorized by the user's Prompt 1 request. Existing audit, plan, ownership, architecture, and progress reports remain unchanged.

The requested `docs/quality/CODEX_REFINEMENT_PROMPT_PACK.md` does not exist at this revision. Its actual counterpart is [SkillUp_Codex_Refinement_Prompt_Pack.md](SkillUp_Codex_Refinement_Prompt_Pack.md); its Shared Operating Rules and Prompt 1 govern this document. Inputs also include the completed [project audit](PROJECT_AUDIT.md), [remediation plan](REFINEMENT_PLAN.md), [domain ownership](DOMAIN_OWNERSHIP.md), root/mobile agent instructions, README/manifests, historical [information architecture](../audit/FINAL_INFORMATION_ARCHITECTURE.md), [profile approval workflow](../architecture/PROFILE_UPDATE_WORKFLOW.md), [document approval boundaries](../architecture/DOCUMENT_INTELLIGENCE_FINAL_APPROVAL.md), [deployment runbook](../architecture/GEMINI_DEPLOYMENT_RUNBOOK.md), and [faculty workflow documentation](../PLACEMENT_FACULTY_DASHBOARD.md). The audit's tested baseline is `98c4384`; this source inspection uses the newer HEAD above. Historical test/browser results are not renewed here.

Verified stack: Expo 57 / Expo Router / React Native and web / TypeScript in `mobile/`; FastAPI / Pydantic / SQLAlchemy / SQLite in `backend/`. State is screen-local plus an in-memory session/target handoff, with no shared query cache. [Schemas][schemas] are authoritative and [mobile contracts][contracts] are manually mirrored. Backend authorization is required regardless of navigation visibility.

Evidence notation used below:

- **Current:** directly inspected source behavior; audit reproduction is identified by its F-number where relevant.
- **Expected:** a proposed product requirement with a testable acceptance ID.
- **Existing interface:** can use an inspected API without inventing a new service; frontend work may still be substantial.
- **Dependency:** blocked on a decision, contract, security fix, or operational approval. Section 11 records the boundary and safe interim behavior.

Implementation owners retain the ownership map: D shared primitives; F screens/shell/client; B deterministic workflows; S contracts/auth/private review; G provider adapters; T tests; R release evidence. This document grants none of those files to this session. Interface changes proceed sequentially S → B/G → F → T → R as applicable. No additional agents or sessions are required by this specification.

## 2. Information architecture and shared meaning

Keep all nine current route URLs. Do not add a separate student dashboard, onboarding wizard, faculty document inbox, or parallel task store. [Navigation][nav] already groups areas by user intent.

| Audience / area | Actual screen and components | Purpose and expected navigation |
|---|---|---|
| Shared account entry | `/login`, [login][login], [shell][shell] | Shared sign-in, student-only signup; return to an authorized intended destination, including supported query context. |
| Student: My Career Plan | `/`, [Journey][journey], [JourneyInput][input], [DocumentReview][documents], [CareerRoadmap][roadmap] | Profile → Role Alignment → Learning Roadmap. Profile is the authoritative evidence view, not a duplicate resume editor. |
| Student: Career Assets | `/resume`, `/linkedin`, [Resume][resume], [LinkedIn][linkedin] | Local Resume Analyzer / LinkedIn Analyzer navigation; independent storage, consent, analysis, and revisions. |
| Student: Opportunities | `/jobs`, `/market`, [Jobs][jobs], [Market][market] | Local Job Search & Matching / Skill-Demand Insights navigation; sources, sample scope, and freshness remain visible. |
| Student: Placement Hub | `/placement`, [Placement][placement], [placement widgets][placement-ui] | Shared revision/feedback → drives → recorded applications → training and assigned assessments. |
| Faculty: Overview | `/admin?section=overview`, [Admin][admin] | Applied scope, metric definitions, follow-up → authorized student detail. |
| Faculty: Students & Cohorts | `/admin?section=students[&student=ID]`, [Admin][admin] | Search/pagination/detail; entry to `/admin-import`. No student enumeration outside scope. |
| Faculty: Skill Analytics | `/admin?section=analytics`, [Admin][admin] | Selected cohort/role → deterministic aggregates → contributing students. |
| Faculty: Placement Management | `/admin?section=placement`, [Admin][admin], [DriveEditor][placement-ui] | Create/edit scoped drives; application history remains in student detail. |
| Faculty: Reviews & Training | `/admin?section=reviews-training`, [Admin][admin] | Link to existing student review context; assign preparation to selected cohort or open student. |
| Faculty: Reports | `/admin?section=reports`, [Admin][admin] | Export the currently applied scoped filters, with optional chosen role context. |
| Faculty: Import | `/admin-import`, [Import][import] | Assigned cohort → file → mapping → validation → explicit confirmation → results → return to students. |
| Account menu | [shell][shell] | Account/role, Sign out, Close. Student profile location is My Career Plan; faculty copy points to faculty context, never to a forbidden student screen. No new settings capability is implied. |

At desktop widths, keep grouped labeled navigation and active parent/local state. At narrow widths, keep scrollable labeled student areas and the existing faculty section selector; cards/forms stack vertically. A selected step is not proof of completed work. Locked Journey steps explain the missing prerequisite in text. Back from a detail restores the originating list and applied filters; opening a subarea does not change the active career target.

### Shared vocabulary and continuity

| Label | Meaning / persistence boundary |
|---|---|
| Saved profile / Student-confirmed evidence | Ordinary Student/Evidence/StudentSkill records. Confirmation is not external credential verification. A skill mention does not establish proficiency. |
| Preview / Pending review | Parsed text or proposal, not an approved profile update. Retained review is separately consented and private. |
| Applied / Rejected / Review changed | Document decision `applied` / `rejected` / `stale`; request actions remain accept/edit/reject. Never display Accept as a saved status before response. |
| Unknown / Not recorded | Missing proficiency/data, never a fabricated zero. Readiness is informational; no hiring probability or placement guarantee. |
| Saved alignment | Deterministic Analysis for an identified student/role, with analysis time and formula version. A saved analysis can be older than current evidence. |
| Learning milestone | RoadmapItem; API status `not_started`, `in_progress`, `done`, displayed Not started, In progress, Done. `done` requires completion evidence. |
| Improvement task | Legacy RoadmapTask. Distinct from a milestone or faculty TrainingAssignment; currently has no visible list. |
| AI feedback / AI learning plan | Optional, separately consented, validated provider suggestions; never approved skills, grades, or automatic profile changes. |
| Saved resume revision | Student-controlled text snapshot. Replace changes an editor draft; Save revision persists it. Faculty approval applies only to a shared snapshot. |
| Faculty review | `submitted`, `changes_requested`, `approved`, plus sharing state. Faculty approval does not verify student facts or update the private resume. |
| Recorded application / training completion | Student/faculty-reported activity; not employer submission or independently verified employment/completion. Training uses `completed`, distinct from roadmap `done`. |
| Live retrieval / Cached / Older cache | Retrieval provenance and time, never a promise an opening is still active. `curated_fallback` and `demo_fixture` remain explicitly labeled. |

Display one profile/evidence representation in Journey and contextual summaries elsewhere. Keep resume text, confirmed LinkedIn text, document proposals, milestones, tasks, and faculty snapshots separate. No upload or analysis silently synchronizes all of them. Show the selected role/listing and relevant source record at every analysis/action boundary. Do not reuse a consent checkbox across purposes.

Expected next action is derived from existing loaded data, without a new recommendation service: add/review evidence when none exists; save an edited target before analysis; analyze when no usable current alignment exists; build/open the matching roadmap; open a resource or record evidence for an unfinished milestone. Placement actions remain in Placement Hub. If data is unavailable, offer retry rather than inventing a next action or count. Missing evidence must not prevent browsing jobs, manual resume revision, or viewing existing saved work.

## 3. Interaction and state contract applying to every journey

Each journey below adds its domain states to this contract. Mutation success and subsequent reload failure are separate outcomes: “Saved; this section could not refresh” is different from “Nothing changed.” A timed-out write may have committed. Never promise rollback merely because the client lost its response.

| State | Expected behavior and microcopy | Recovery |
|---|---|---|
| Initial load | Name the operation: “Loading your saved profile…” or “Loading assigned students…”. Do not say “Saving progress” for reads or show invented percentages/ETA. | Keep navigation/account recovery available. |
| Action pending | Disable the same submit action synchronously against repeated taps; label it Parsing, Saving revision, or Recording progress. Keep unrelated safe actions available. | No automatic retry of a write or consented provider request. Navigation away does not claim to cancel server work. |
| Empty | Explain why and provide one relevant action, e.g. “No saved resumes yet. Upload or paste one to begin.” | Distinguish no data, no matches, no permission, and failed loading. |
| Partial data | Render usable sections with explicit unknowns and a local error for the failed section. Retain provenance/warnings; do not blank a whole workspace on one optional failure. | Retry that section against the current session/context. |
| Validation | Name the field, constraint, and correction next to the field and in an error summary. Server remains authoritative. Keep entered values; never echo passwords or raw server exceptions. | Focus first invalid field; clear obsolete errors after correction. |
| Provider unavailable / missing config | “Live search is unavailable. Your saved work is unchanged.” AI failure shows no invented feedback. Safe deterministic/local paths remain available. | Manual retry with valid consent; respect returned quota/retry information. No fake listings or silent AI fallback. |
| Transport error / offline | “We could not confirm the result. Check saved status before trying again.” Retain local draft while that screen/session remains alive. | Reconcile from existing GET/status APIs; reuse original document-decision key for an identical uncertain decision. Do not automatically generate a new key. |
| Version/conflict | “This saved record changed. Review the latest version before saving.” Preserve local text and identify the affected record. | Copy local edits, reload/recompare, then explicitly resubmit. No last-write-wins overwrite of newer records. |
| Permission denied / missing record | “This record is unavailable or you no longer have access.” Do not reveal another student's existence/content. | Clear protected stale content and offer the authorized home/list; never retry with another identity/ID. |
| Session expired | Explain sign-in is needed; clear old protected session content and pending response updates. | Restore only a permitted destination. Unsaved text is not promised across sign-out/reload; offer a deliberate copy opportunity where feasible, without persisting private drafts to browser storage. |
| Success | Confirm the actual object/action: “Profile details saved” / “Revision saved” / “Progress recorded”. Use saved response and timestamp/version where supplied. | An optional follow-up read failure must not invite duplicate creation. |
| Back/cancel | Close a picker/dialog without writes. Before replacing a dirty editor/form, offer Keep editing / Discard unsaved changes. | Cancel does not undo an already committed action. Only show Undo where a real operation exists. |

### Global acceptance criteria

- **G01 — role routing:** Given student, faculty, and expired sessions, opening each route above exposes only the permitted workspace; protected APIs independently reject unauthorized access. A permitted sign-in return preserves section/student/listing query context; a forbidden destination returns to role home.
- **G02 — account control:** At 360px and 1440px, actual pointer and keyboard activation of Sign out reaches the button, ends the session, and closes the menu. Login as a different role does not reopen it. A logout network failure is visible and does not claim successful server invalidation. [Shell][shell], audit F04.
- **G03 — races and save outcomes:** With slow-old/fast-new responses, duplicate taps, route exit, and account A→B transition, no old-context result commits to the new view. A successful write followed by failed reload is reported as saved with refresh failure. [Client][client], [Journey][journey], [Admin][admin], [Placement][placement].
- **G04 — accessibility:** At 360/768/1440px and enlarged text, every critical action is reachable without clipped content, keyboard traps, or horizontal page scrolling. Use semantic page/section headings, labeled fields, named radio/checkbox groups, visible focus, text status alongside color, and at least 44px touch targets. Charts have equivalent readable data; loading/results/errors are announced without reading private source text. Dialog/menu Escape or native Back closes where safe and restores trigger focus. Test keyboard and screen reader, not source attributes alone. [Navigation][nav], [primitives][primitives], [controls][controls], [placement widgets][placement-ui].
- **G05 — honest status:** Before a response, no write shows Saved/Applied/Done. Empty/error/unknown states are distinct. Declining every optional AI consent causes zero provider requests and leaves supported local workflows usable. No confidence, readiness, coverage, or profile-completion number is presented as a job probability.

## 4. Journey A — account entry, onboarding, and profile completion

**Entry and intent:** `/login` → `/` Profile, or a returning student's My Career Plan. Intent: establish an account, review what is known, and choose a meaningful target. Preconditions: student session for private profile; no document or AI consent is required just to enter.

**Current path:** [Login][login] gathers username/password and signup student ID/name/email/department. [Journey][journey] calls `/api/placement/journey`, then loads profile/seeded role; each ordinary focus resets analysis, roadmap, and stage. The existence of a ProfileOut currently counts as “has profile,” even without skills. Update profile opens [JourneyInput][input]. That UI has no manual profile form. The [legacy parser][journey-service] currently extracts a possible name, skill claims, and a bounded summary; it does not reliably populate all academic fields just because JourneyDetails supports them.

**Expected primary path and reductions:**

1. Signup/login → loaded saved profile. Explain missing optional evidence without calling an account-only profile complete. Avoid asking for identity details already saved at signup.
2. Show saved basic details and skill evidence once, with Unknown/Not recorded. Primary action is Add profile evidence when empty. Do not require a faculty assignment, all seven completion fields, or AI to continue.
3. One profile-evidence section presents existing PDF/DOCX confirmed save and optional item review with accurate scope/availability. Do not make a student upload the same file through both paths. They are alternative write contracts, not interchangeable approval mechanisms.
4. Target edit → Save target role → inspect observed requirements → Analyze role alignment. Show unsaved target changes; prevent analyzing the old role while showing a new title. Optional requirement text may yield no supported requirements; explain that before presenting a meaningful score.
5. Returning student resumes supported saved context, not a seeded reset. This persistence requires dependency D1; use honest explicit selection until resolved. “Reset demo” becomes “Reload saved plan” for the current reload-only behavior, with dirty-form warning; it never deletes data.

**Save/recovery:** Signup creates account/student. Target save creates a Job but currently does not persist an owner-specific active selection. Profile saves are governed by Journey B. Cancel target edits restores displayed saved role; Back to profile discards only unsubmitted preview after warning. No self-service email reset or general profile correction form exists: explain operator/coordinator assistance, without inventing a recovery link or contact address. Missing academic fields can be addressed through authorized import/current supported review paths; D4 covers the remaining editing gap.

**Accessibility/mobile:** Keep keyboard focus at the active step heading after a transition, with inline prerequisite text for locked steps. Identity fields use appropriate input types and labels; password errors do not announce the password. At phone widths, target requirements remain editable above the keyboard and primary action remains reachable without overlapping navigation. Apply G04 to A01–A05.

| State | Journey-specific behavior |
|---|---|
| Loading / partial | Load account/profile/role independently where safe; failed role load does not hide saved evidence. A sample role is labeled as such, not “your chosen role.” |
| Empty | “Your account is ready. Add evidence to compare it with a target role.” No made-up completion percentage or compulsory upload wall. |
| Validation | Signup: required ID/name/email/department; password 12–256 characters; username 1–120, ID ≤64, name ≤200, department ≤120, valid email. Target title nonblank ≤200, requirements ≤20,000. Display backend account/duplicate validation safely. |
| Error / permission / retry | Keep safe entered non-secret fields, field-level errors, manual retry. Failed sign-in never claims account creation failed/succeeded. Failed profile load is not an empty profile. |
| Success / recovery | “Account created” only after authentication response; “Target saved” is not “Plan restored on every device” until D1 lands. After reauthentication reload authorized saved data. |

- **A01:** Valid synthetic signup produces a student account and authorized Journey; faculty role injection fails. Missing fields, invalid email, short password, and duplicate identity do not create a second account. [Login][login], [schemas][schemas].
- **A02:** An account with zero competency evidence sees Add profile evidence and Unknown states; can still visit jobs/assets; no all-fields completion gate blocks analysis exploration. A pre-existing student's identity is not requested twice. [Journey][journey].
- **A03:** Edit a saved target title without saving: analysis must use the labeled saved target or require save first, never combine old requirements with new title. Empty/unsupported requirements show an actionable explanation. Cancel retains the previous saved target and analysis. [Journey][journey], [analysis service][analysis-service].
- **A04:** Once D1 is agreed, custom target → analysis → roadmap progress → Assets → Journey → refresh restores the agreed target/analysis and persisted progress without a provider call or a new analysis. Until then this is an explicit unmet dependency, not a passing requirement. [Journey][journey], [placement routes][placement-routes].
- **A05:** Reload saved plan warns about unsaved target edits, preserves all persisted records, and makes no delete request. Keyboard order follows identity/evidence → target → primary next action. [Journey][journey].

## 5. Journey B — upload, extraction, review, approval, persistence

**Entry and intent:** `/` Profile → Add/Update profile evidence or Documents to review. Student wants to see exactly what a document would change. Preconditions: own authenticated account, supported text file; retained review additionally requires capabilities, operational readiness, and storage consent. Gemini extraction requires another independent consent.

### Two existing paths; do not falsely merge their guarantees

| Path | Existing primary sequence and saved boundary | Expected refinement |
|---|---|---|
| Confirmed Journey save | [JourneyInput][input] → `/api/journey/input/preview` → read-only details → confirmation → `/api/journey/input/save` with profile digest → ordinary profile/evidence records | PDF/DOCX, ≤1 MiB. Preview makes no profile write. Show all fields/skill mentions that will be included; describe this as confirming the whole detected set. It has no per-item Accept/Edit/Reject controls. Offer Cancel/another file when wrong. Do not imply arbitrary academic extraction or external verification. |
| Private item review | [DocumentReview][documents] → `/api/documents/preview` → storage consent → create private review → compare items → individual decisions | PDF/DOCX/TXT, ≤1 MiB. Binary is not retained server-side. Stored review text/proposals are not approved profile facts. Default extraction is deterministic; optional Gemini output remains a proposal. Flags default off; preview can still work. |

For the private path, group the same proposal items by Ready to add, Already recorded, Needs your decision, Suggestions not facts, and Withheld. Current UI renders item status inline; grouping is a frontend refinement, not another data model. Show field, current/proposed value, source excerpt and document identity. Do not claim page numbers absent from the flattened parser.

Important actions:

| Interaction | Expected behavior / saved effect |
|---|---|
| Choose / replace / cancel picker | A canceled picker preserves prior usable state. Replacing an unsaved preview warns if edits would be lost. Release temporary client copies on every exit, including failure. |
| Preview | Parsing/classification only. “Preview ready. Your profile has not changed.” Never show Save success. Unsupported/corrupt/encrypted/scanned material gives an actionable text-file alternative; no OCR claim. |
| Create private review | Enabled only with current storage consent and review capability. Confirm source-review expiry and separate approved-fact retention before storage. Success identifies retained review, not profile approval. |
| Correct document type | Before any approval, choose supported type or Unknown; supersede pending items and recompare deterministically. Reset AI consent. Applied items lock type correction; explain why. |
| Extract with Gemini | Explicit purpose/data notice and fresh consent; one user-requested bounded attempt. Provider error preserves deterministic proposals and saved facts. |
| Accept | Apply one supported explicit item using proposal/item versions and UUID key. Conflict additionally requires explicit current-versus-proposed confirmation. Return saved profile/item state. |
| Edit | Edit only a source-supported value, with type validation; show it as draft until response `applied`. Unsupported free-form facts are rejected without mutation. |
| Reject / cancel edit | Reject records rejection without changing profile. Cancel edit restores the proposed value locally; it is not an approval/rejection. |
| Refresh comparison / retry | Stale → reload latest review/profile and recompare, then review again. Uncertain identical decision → original request/key only. Do not replay an old decision against a refreshed proposal. Serialize decision dispatch per proposal or reconcile proposal versions; other items remain readable. |
| Delete retained review | Explicit confirmation: “Delete retained text, excerpts, and proposals? Approved profile facts and minimal audit records remain.” Delete/expiry makes approval unavailable. No Undo promised. |

**Allowlist:** [document service][document-service] permits supported scalar identity/program/semester/graduation-year facts and explicit skill/project/experience/certification evidence. DIL v1 excludes GPA/grades/academic results/honors and inferred proficiency/achievements. Unknown/transcript sources cannot apply facts in this implementation. Projects/experience/certifications may become evidence summaries, not an invented structured career-history editor. Existing assessed levels remain unchanged; newly mentioned skills remain null. The legacy Journey contract supports a broader detail schema; that is not permission to bypass DIL exclusions or invent extracted GPA. A unified editor/schema policy is dependency D4.

**Accessibility/mobile:** Stack Current, Proposed, and Source in that reading order on narrow screens. Name each action by field/item so repeated Accept buttons are distinguishable to assistive technology. Excerpts are selectable with labeled expand/collapse controls; after a decision announce only field/status, keep predictable focus, and do not jump to the top of a long review. Picker return/error restores focus to its trigger or result heading. Apply G04 to B01–B08.

| State | Journey-specific behavior |
|---|---|
| Loading | Separate Reading document / Creating private review / Extracting / Applying this item. Keep already approved profile summary readable. |
| Empty / partial | No documents → Preview document. No explicit supported facts → explain type/source limitation. No new facts → Already recorded. Withheld/suggestions show safe reasons/counts; no approval controls. |
| Validation | File type/size/text checks; malformed value or absent unique source evidence stays unapplied. Conflict checkbox is not preselected. Unsupported academic fields never acquire an approval button. |
| Disabled capability | “Preview is available. Private review is not enabled for this deployment.” No consent loop or success affordance; offer existing supported confirmed-save route where appropriate. Missing schema must fail safely (D3). |
| Failure / retry | Preserve preview/proposals on provider failure. Save/digest conflict requires a fresh preview, not blind retry. Uncertain mutation gets reconciliation copy. Foreign ownership gives no document metadata. |
| Success / recovery | “Applied to your profile” with refreshed saved facts; rejection says “Rejected; profile unchanged.” Offer explicit Reanalyze alignment; never auto-generate a roadmap or overwrite assets. Retained-review deletion explains surviving facts. |

- **B01:** For supported synthetic PDF/DOCX, preview followed by Cancel leaves ProfileOut unchanged. Confirmed save without confirmation or with stale digest is refused. Identical confirmed content does not duplicate evidence or lower proficiency. [JourneyInput][input], [journey service][journey-service].
- **B02:** With private-review flag off, deterministic preview works but create/decide are unavailable; no UI promises retention or individual saved approval. When configured in an isolated test environment, create stores review only and profile remains unchanged until a decision. [DocumentReview][documents], [document routes][document-routes].
- **B03:** Accept/Edit/Reject each sends current proposal/item versions; conflicts require explicit confirmation. A valid accepted skill adds evidence with null new proficiency; reject adds no profile fact; unsupported edit is rejected atomically. [DocumentReview][documents], [document service][document-service], [schemas][schemas].
- **B04:** Same uncertain decision/key returns the original result without duplicate fact/audit; altered payload with reused key is rejected. Two item decisions against one proposal never show false success after a stale version. Profile changed elsewhere → refresh/re-review, preserving approved work. [DocumentReview][documents], [document service][document-service].
- **B05:** A transcript, unknown type, unsupported academic fact, suggestion, or unverifiable excerpt cannot be approved. Correcting type before approval supersedes pending items and requires new AI consent; after approval it is explained as unavailable. [DocumentReview][documents], [document service][document-service].
- **B06:** Consent declined, timeout, quota, blocked, invalid output, or provider absence changes no approved fact; deterministic proposals remain usable. A successful provider response still requires individual approval. [DocumentReview][documents], [document routes][document-routes].
- **B07:** Delete/expiry purges source review data and disables decisions, including replay after expiry, while preserving already approved normal facts/minimal audit. Student B/faculty cannot list, read, decide, or delete student A's private review. Client announces status without exposing excerpts to global alerts/logs. [DocumentReview][documents], [document service][document-service].
- **B08:** Unsupported extension, >1 MiB, scanned/empty/corrupt/encrypted file, picker cancel, and parse failure show accurate corrective actions and no false save. Native temporary-copy cleanup is exercised separately from web picking. [JourneyInput][input], [controls][controls].

## 6. Journey C — approved evidence, readiness, recommendations, and learning

**Entry and intent:** `/` Role Alignment or Jobs match handoff. Preconditions: loaded own profile and selected persisted role; a meaningful comparison needs supported role requirements. To build the selected roadmap, retain student/analysis IDs. AI explanations and AI plan are independent optional requests.

**Current path:** Analyze → saved Analysis/SkillGap → deterministic summary → Build roadmap → saved RoadmapItems. [CareerRoadmap][roadmap] currently discards `onChange`, displays resource title without an open action, and has no progress/evidence editor (F06). GET selected roadmap may create missing items and perform resource retrieval; opening it is not guaranteed a side-effect-free read. Optional grounded explanation may also use existing roadmap services. [Learning service][learning] preserves existing milestone/progress data. Generic AI guidance is not saved milestone progress.

**Expected path and interactions:**

1. Display selected role, saved analysis time/formula, evidence coverage, known gaps, unknown levels, warnings, and disclaimer together. Do not repeat the readiness card throughout unrelated routes. “No measured gaps” must not mean “fully ready” when evidence or requirements are missing.
2. Primary next action is Build/Open learning roadmap for this analysis. Returning to a saved roadmap uses its IDs/statuses; avoid unnecessary regeneration/provider work. If freshness cannot be established, label it a saved analysis and offer Reanalyze; do not claim current evidence synchronization (D1/D2).
3. For each milestone: task/objective → resource title, provenance and safe HTTP(S) link → completion criteria → status/evidence. Open resource is external navigation only; link failure does not mark progress. No resource URL means Resource unavailable plus a usable objective, not a dead link.
4. Mark In progress or submit Done with nonblank completion evidence (≤2,000 chars) through existing `jobsApi.progress`. Persist only after response; omitted evidence must preserve earlier evidence. Allow explicit reopening using existing statuses; it does not erase assessed competence. Progress itself does not award proficiency or recalculate readiness.
5. Explain with Gemini shows source references, evidence IDs and conditional actions from the allowed context; nothing changes the deterministic score. Optional AI plan needs analysis ID, 30–4,000-character goal, separate consent, and aligned bounded timeout. It neither replaces the deterministic roadmap nor adds completion records. Jobs must pass its analysis ID to the shared component (F08).
6. Export uses saved milestone status/evidence. Existing AI HTML download is distinct from progress report. Existing PDF control opens browser print; label it Print / Save progress as PDF. Current `.doc` is HTML, not real DOC/DOCX: specify HTML as such or await a real-format implementation decision (D6). Do not silently promise native roadmap downloads; current controls are web-only.

| State | Journey-specific behavior |
|---|---|
| Loading / long-running | “Comparing saved evidence…” / “Preparing roadmap resources…”. Determinate progress only if real progress exists. Keep current saved plan visible, label the request target, and guard against context changes. |
| Empty / partial | No requirements → add explicit requirements/select another role. Unknown levels → add evidence or use assigned assessment where available. No gaps with sufficient evidence → explain scope; do not invent tasks. Partial resources → labeled curated fallback or no resource. |
| Validation | No selected analysis/student → prerequisite explanation. Done without evidence refused. Invalid/unsafe resource URL gives a local error. AI goal length and consent explained near action. |
| Failure / provider | Keep saved deterministic plan on AI failure; blocked/incomplete output must be withheld (D7). Resource timeout may leave a server-created plan; re-read before regeneration. |
| Success / recovery | “Progress recorded” from returned item, surviving reload/export. Reanalysis is explicit; preserve matching-role progress and earlier evidence. Profile approval says analysis may need refresh, not that scores already changed. |

**Accessibility/mobile:** Pair each chart/ring with role, numeric value or Unknown, and evidence counts in readable text. Resource links announce destination/external behavior. Status selection and completion-evidence inputs name their milestone; pending/save errors stay adjacent to it. Export controls explain browser support without leaving a disabled unlabeled icon. Apply G04 to C01–C06.

- **C01:** Same synthetic profile/role yields reproducible deterministic values/formula; unknown levels and gaps remain null. No assessable evidence shows “Insufficient evidence to interpret alignment” prominently rather than a personal capability judgment. Preserve raw existing formula/value until D2 is approved. [Journey][journey], [scoring][scoring].
- **C02:** Saved alignment explicitly identifies target/time; profile approval invalidates current UI interpretation and offers explicit reanalysis. No Gemini call, target change, milestone deletion, or asset rewrite occurs from profile approval. Cross-reload freshness guarantees remain blocked on D1/D2. [Journey][journey], [documents][documents].
- **C03:** On Journey and Jobs, a resource opens its actual safe URL with visible provenance; failure leaves item status unchanged. In progress and Done persist through the existing progress route and survive reload; Done without evidence fails; omitted evidence preserves prior text. [CareerRoadmap][roadmap], [job routes][job-routes].
- **C04:** Reopen/load/regenerate for the same role preserves existing status/evidence and does not create duplicate milestones. Navigating to another role does not display the prior role's pending AI plan/progress. No version-based conflict protection is claimed for `RoadmapProgressIn`, which has no version; multi-client overwrite protection is D8. [Learning service][learning], [CareerRoadmap][roadmap].
- **C05:** Each AI feature is independently consented; missing configuration, quota, timeout, invalid/blocked/truncated output produces no fabricated plan/score. A Jobs roadmap receives the selected analysis ID. A late result for another analysis is discarded. [CareerRoadmap][roadmap], [AiExplanation][ai], [Jobs][jobs], [AI adapter][ai-roadmap].
- **C06:** Progress report reflects saved status/evidence; local unsaved changes are excluded or require save first. Browser print cancellation is not reported as a downloaded PDF. HTML is not labeled native Word output, and native unsupported actions explain the browser requirement. [CareerRoadmap][roadmap].

## 7. Journey D — Resume Analyzer

**Entry and intent:** Career Assets → `/resume`, or `/resume?job_id=ID` from a real listing. Preconditions: own student session; storage consent to save original text; separate Google consent for optional analysis. Manual revision/save/export can operate without Gemini.

**Current path:** [Resume][resume] upload/paste → private workspace → manual target or listing → Gemini feedback → per-suggestion Replace/Undo/Reject → editor/factual confirmation → Save revision → export saved DOCX/TXT. Original and immutable revisions are preserved. New upload/open/restore operations can replace the local draft. Focus refresh attempts to preserve existing draft; full navigation/reload is not a durable unsaved-draft guarantee.

| Important interaction | Expected result / reduction |
|---|---|
| Upload / paste / open | Use one active workspace summary and editor; other saved resumes remain discoverable. Accepted PDF/DOCX/TXT ≤1 MiB or pasted text ≥30 characters. Require storage consent; picker cancel is harmless. Opening another workspace with dirty text requires Keep editing / Discard. |
| Job handoff / manual target | Load selected listing with source/time; do not make the user search/select it again. Handoff only selects a target, not permission to send resume text. Failed listing load permits a user-supplied target description. Manual title nonblank and description ≥30 characters. |
| Analyze | Explicit notice: original resume + target are sent to Google; best-effort redaction is not anonymization. Analysis uses preserved original, not unsaved revised text; reanalysis resets suggestion decisions, not original/revised text. Display any source-derived invalidation before asking to reanalyze. |
| Review feedback | Show AI label, supported excerpts, rating reasons/null for missing support, and withheld rewrite count. Distinguish useful qualitative feedback from rewrite-verification failure. No official ATS or employment score claim. |
| Replace / Undo / Reject | Replace only one uniquely matching span in current draft; preserve unrelated manual/prior replacements. Undo reverses that span only if unambiguous. Reject records a decision without rewriting editor. Decision saved and editor saved are separate statuses. |
| Save revision | Require factual confirmation and valid text. Save current draft/version, then show saved response/version and readiness to export. No extra AI request. Avoid repeated approval checkboxes for unchanged text; reset factual confirmation when text/context requiring review changes. |
| Restore / delete | Explicit consequences and cancel. Restore resets revision/decisions to preserved original; deletion removes selected workspace/derived records, including shared-review consequences, while other workspaces remain. No generic Undo promise after deletion. |
| Export | Export only selected saved version with required factual approval; dirty draft prompts save first. Real DOCX/TXT via existing export/download helpers; announce file generated/save dialog opened, not that the user completed a device save. |

| State | Journey-specific behavior |
|---|---|
| Loading / empty / partial | Saved list loading is separate from active editor. No resume → upload/paste; no AI suggestions → continue manual revision. Qualitative feedback can remain when rewrites are unavailable, with explanation. |
| Validation / error | Invalid file, short text/target, missing consent, missing/ambiguous replacement span, or invalid factual edits show local corrective error. Never replace the whole draft to “fix” a failed span. |
| Provider / permission | AI failure does not erase original/revisions/draft. Private workspace access denied hides protected content. Live feature/configuration availability is explicit. |
| Save conflict / recovery | Preserve draft for copy; GET latest workspace before explicit reconciliation. If Replace changed draft but decision request failed, show both facts; do not revert unrelated local edits or claim revision was saved. Route exit with dirty text warns; reload can lose unsaved draft and must not be marketed as autosave. |
| Success | Distinct messages: Original saved; Feedback saved, editor unchanged; Replaced in editor, unsaved; Revision saved; Export generated. |

**Accessibility/mobile:** Before/After labels remain explicit when columns stack. Replace/Undo actions identify the suggestion and announce the draft/save distinction without stealing cursor position. The editor supports keyboard selection/copy and scrolling above the mobile keyboard; original text is separately labeled read-only. Restore/delete dialogs identify the affected resume and restore focus on cancel. Apply G04 to D01–D05.

- **D01:** Storage consent declined → no original saved. Upload/paste success returns reloadable private original and revision. Source-URL listing handoff arrives selected without an automatic AI request. [Resume][resume], [client][client].
- **D02:** Analyze without AI consent makes zero provider calls. Successful feedback changes neither original nor local revision text; unsupported ratings remain null; withheld rewrites cannot be applied. Provider failure leaves manual revise/save/export usable. [Resume][resume], [resume adapter][resume-ai].
- **D03:** Apply two independent replacements and a manual edit, then undo one: unrelated text stays byte-for-byte unchanged. Missing/duplicate source span refuses replacement. Failed decision request visibly distinguishes pending decision from unsaved draft. [Resume][resume], [resume helpers][resume-helpers].
- **D04:** Dirty draft → switch/open/restore/leave prompts; Cancel preserves draft. Stale Save revision cannot overwrite latest saved text; copy/reload/reconcile is offered. Save success survives reload; original remains recoverable. No new persistent draft store is assumed. [Resume][resume].
- **D05:** Export cannot include unsaved edits or an unapproved saved revision. DOCX/TXT opens as its claimed format; download cancellation is not called saved. Deleting one workspace requires confirmation and does not delete another; disclose cascade to associated shared review records. [Resume][resume], [faculty documentation](../PLACEMENT_FACULTY_DASHBOARD.md).

## 8. Journey E — LinkedIn analysis and student-controlled updates

**Entry and intent:** Career Assets → `/linkedin`. Student wants to improve supplied profile wording/positioning. Preconditions: own student session; saved text for deterministic analysis; independently confirmed saved text and Google consent for grounded AI explanation.

**Current path:** [LinkedIn][linkedin] paste/export or optional consented public URL search → review/adopt editor text → save → choose one of five supported target roles and optional description → analyze positioning → recommendations. Optional official OAuth retrieves basic member details, not career history. Add task currently creates RoadmapTask but directs the user to a nonexistent visible list (F07). There is no auto-publish or LinkedIn profile export control in this screen.

**Expected primary path:** Make paste/export the direct usable path. Public search and official connection are optional source choices with separate purpose copy; no need to complete them to analyze supplied text. Public preview adoption changes editor only, resets confirmation, and warns before replacing dirty text. Save explicitly labels confirmed/self-reported status. Analyze the saved profile, showing unsaved-editor warning; do not silently analyze outdated saved text under an apparently updated editor. Recommendations remain suggestions with source excerpts and applicability; applying wording on LinkedIn is manual. Keep supported fixed targets visible; arbitrary cross-feature target import is D9.

**Task decision:** The safe interim design disables/hides Add task with “Task tracking is not available here yet.” Preserve existing RoadmapTask data/APIs. A future discoverable task list requires an approved product boundary; never silently convert these to milestones/training. No new to-do feature is authorized by this spec.

**Persistence/recovery:** Save/upload stores LinkedIn text/provenance and can invalidate source-derived resume analysis while preserving saved resume text. OAuth completion does not verify employment. Clear connection affects authorization attempt; Remove LinkedIn data requires explicit confirmation and explains retained resume text copies. Editing text resets confirmation; switching source with a dirty draft warns. External publishing has no in-app undo or synchronization guarantee.

| State | Journey-specific behavior |
|---|---|
| Loading / empty / partial | Load profile, public preview, and connection independently. No text → paste/export. Public search empty/incomplete → use supplied text; show source/time and gaps rather than complete-import success. |
| Validation | URL must be valid supported LinkedIn profile URL; distinguish URL-only save from analyzed content. Optional job description must meet existing minimum when nonempty. Confirmation for public adoption and AI explanation cannot be inherited from older text. |
| OAuth / provider | Pending → exchanging → connected/failed; expired attempt offers restart; user cancel ends attempt. Explain basic-member-only result. Missing config/quota/timeout does not disable paste/save/deterministic analysis. |
| Success / recovery | “Profile text saved; resume analysis may need refresh.” No claim that LinkedIn itself changed. On failure preserve saved profile and local text. Delete copy explains local scope and source-derived invalidation. |

**Accessibility/mobile:** Source selection, target role, and each consent have distinct accessible labels. Long text and source excerpts wrap/select on phones. Opening LinkedIn clearly leaves the app; returning preserves editor context and places connection status in a polite announcement. Adoption/delete dialogs support cancel and return focus to the original control. Apply G04 to E01–E04.

- **E01:** Public lookup with no consent makes zero search requests. Retrieved snippets do not change saved text or normal competencies until the separate supported save/review action; replacing dirty editor text can be canceled. Missing indexed text never becomes invented experience. [LinkedIn][linkedin].
- **E02:** Editing/adopting text clears factual confirmation; analysis clearly uses saved text and requires save or an explicit choice to use that saved version when draft differs. Deterministic role analysis labels coverage/unknowns and makes no credential-verification claim. [LinkedIn][linkedin], [insights][linkedin-insights].
- **E03:** Official connection success describes member details only; canceled/expired/failed OAuth is recoverable via new attempt and does not erase pasted text. No publish/export success is shown for absent features. [LinkedIn][linkedin].
- **E04:** Add task cannot produce a success message pointing to an absent screen. Interim unavailable state makes no new task write; pre-existing RoadmapTask records remain. Saved LinkedIn change/delete invalidates affected analysis while preserving already saved resume text. [LinkedIn][linkedin], [client][client].

## 9. Journey F — job discovery, grounded matching, and market context

**Entry and intent:** Opportunities → `/jobs`; `/market` for supporting demand analysis. Student wants a sourced opportunity, an honest evidence comparison, and a next action. Preconditions: role query for live search; saved own profile for personal match; explicit supported listing requirements for meaningful match. Market views use collected public listing samples, not a labor-market census.

**Current path:** [Jobs][jobs] query → normalized search/listing snapshots/cache metadata → inspect stored detail → match creates saved analysis → roadmap or Journey in-memory handoff or Resume `job_id` link. Opening employer URL does not create an application. Next page currently clears the prior page before response. Default search role is a preset, not a proven active-target selection. [Market][market] has ranking / 2–3-role comparison / student evidence modes, source listings, collection-date filters, and web CSV.

**Expected interactions/reductions:**

1. Query label reflects a draft search, independent of active career target. Use supported existing context only; do not silently replace career role because a student searches a different job.
2. Search results show query, page, collection time, live/fresh/older cache, warnings and missing fields. Keep the last successful result page available if the next page fails. Do not combine page token with edited filters or imply exhaustive search.
3. Inspect opens selected detail with safe source link, description, requirement excerpts and required/preferred/mentioned classification. Missing stated proficiency stays Unknown. No source URL → explain unavailable, never generate one.
4. Compare uses own approved evidence. Show matched/unknown skills and deterministic rationale tied to actual requirement/evidence IDs/excerpts; disclose missing requirements. Optional grounded Gemini explanation needs its own consent and validated sources. Block unsupported explanation rather than filling gaps with generic claims.
5. Use listing as target: explicit Continue in My Career Plan with exact analysis context; Resume for this listing opens the exact target without another search. Handoffs preserve provenance and do not auto-save a profile/auto-send data to Gemini. Browser refresh continuity is D1.
6. Open original source says “Verify availability and apply on source.” This is external navigation, not SkillUp applying. Recorded applications belong to institution drives in Placement Hub; do not invent external job application tracking.
7. Market ranking/sources retain sample denominator, collection scope and known/unknown personal evidence. Separate View collected sample from Collect fresh jobs (provider request); current Analyze Demand can trigger collection when role is filled and needs clear wording. Comparison requires 2–3 roles; no sample is Unavailable, not 0%. CSV matches visible sample/filter snapshot and is web-only today.

| State | Journey-specific behavior |
|---|---|
| Loading / empty | Searching / Loading listing / Comparing evidence are distinct. Zero jobs → broaden query; zero supported requirements → no meaningful match, inspect source/use another listing. Empty market → reset filters or explicitly collect. |
| Partial / stale | Company/location/source not supplied stay unknown. Older cache prominently discloses failed live refresh and collection time. Selected listing unavailable does not erase other saved work. |
| Validation | Search role nonblank ≤120; location ≤120; keywords ≤160. Career stage adds query terms, not a guaranteed strict employer filter. Market dates valid and ordered; token tied to original query; 2–3 comparison roles. |
| Provider / error / permission | Missing key, quota, timeout, malformed provider response shows safe actionable error. Use real cached data only when supplied with correct provenance. Unauthorized personal match blocked, no synthetic substitution in a normal student flow. |
| Success / recovery | Results retrieved / Comparison saved, with correct context. Failed page keeps prior page; Retry uses same displayed query. Link failure leaves match/progress unchanged. CSV generation is distinct from successful file save. |

**Accessibility/mobile:** After Inspect, move focus to the selected listing heading and retain a return-to-results action/scroll context. Required, Preferred, Mentioned, and Unknown are text labels, not color alone. Sample charts have equivalent rows/counts; role comparisons stack without obscuring denominators or URLs. Phone search controls remain reachable with keyboard open. Apply G04 to J01–J05.

- **J01:** Search with missing config/timeout/quota produces explicit error or labeled actual stale cache, never fixtures described as live. Zero matches is distinct from failed search; prior page survives failed pagination. [Jobs][jobs], [job service][job-service].
- **J02:** Selecting listing A, matching, then selecting B clears A's context before new actions; slow A response cannot appear under B. Next-page token is not reused with changed query. [Jobs][jobs], [client][client].
- **J03:** Match explanation contains only observed requirements and saved student evidence; mentioned-only or unstated levels are not fabricated required levels. Optional AI source IDs must belong to selected listing/analysis; withheld output never changes the score/profile. [Jobs][jobs], [AiExplanation][ai], [job service][job-service].
- **J04:** Journey handoff preserves exact student/job/analysis; Resume handoff preserves exact listing. Neither makes an AI request, approves facts, or creates an employer application. Original source opens only a safe real URL; missing/broken URL has local recovery. [Jobs][jobs], [Journey][journey], [Resume][resume].
- **J05:** Market views/CSV share applied sample/filter state and collection timestamps; empty sample renders Unavailable, distinct from 0% mentions. Invalid dates/role selection preserve inputs. Fresh collection is explicit; viewing stored demand does not silently initiate it. [Market][market], [market helpers][market-helpers].

## 10. Journey G — faculty scope, review, placement, training, and import

**Entry and intent:** faculty login → `/admin` Overview or permitted section/deep link. Faculty wants to act on assigned students only. Preconditions: provisioned faculty account and explicit scope/cohort ownership; no public faculty signup. A student needs assigned faculty and saved revision to request review in `/placement`.

### Visibility contract

| Data/action | Student | Assigned faculty | Other faculty/student |
|---|---|---|---|
| Normal saved profile/evidence, skill levels, assessments, roadmap | Own | Authorized student scope through existing detail/aggregates | Denied |
| Private resume workspace/original/unshared revisions | Own | Denied; only expressly shared exact snapshot available | Denied |
| Shared resume snapshot/feedback | Own | Selected faculty, active sharing and scope; optional stored suggestions only if student elected | Denied |
| LinkedIn saved text/public previews/OAuth, DIL metadata/text/proposals/consents/audit | Own supported private routes | Denied, even when assigned; ordinary approved profile facts remain visible separately | Denied |
| Drives/training/applications | Assigned/own | Own managed cohort/student/drive boundaries, with explicit status history | Denied |
| Imports/reports | No import/faculty report | Own upload and authorized scoped data only; CSV excludes raw resume, email, answers | Denied |
| Custom-role catalog | Owner policy unresolved | Current catalog leakage F02 is a blocker, not allowed visibility | D10 required; do not treat current exposure as intended access |

Review revocation removes faculty access on subsequent requests/refresh; it cannot retract a person’s prior knowledge or screenshots. Hide cached revoked content once access change is known. No live push-revocation transport is assumed. Importing an existing unassigned identity never grants scope.

### Workflow and interaction specification

| Subjourney | Primary path, persistence, and reduction |
|---|---|
| Overview → students | Choose draft filters → Apply → metrics/list/report use applied scope → follow-up/student → detail → Back. Preserve applied filters/page on return. Empty scope differs from no filter matches. Cohort/role draft selections for new assignments are separately labeled and confirmed before writes. No duplicate dashboard. |
| Analytics | Select authorized cohort and safely visible role → Analyze → known gaps/unknown/assessed denominators → contributing student list → authorized detail. Reuse deterministic scoring; no model-generated cohort proficiency. |
| Share/review/revoke | Student selects saved revision + assigned faculty + share consent; optional AI sharing defaults off and resets when recipient/revision changes. Submit creates immutable snapshot → faculty reads exact version → written feedback + Approved/Changes requested → student revises in Resume and explicitly reshares new snapshot. No duplicate review store or faculty rewrite of private text. Revoke is explicit and updates visibility/history; no automatic new snapshot sharing. |
| Drives/applications | Faculty selects owned cohort → creates validated drive/eligibility → saves; edits use version. Student sees Eligible / Not eligible / Needs review with reasons → employer link → explicitly Record that I applied. Application stage updates use version/history. Faculty eligibility override requires reason. Withdrawn application cannot be silently reopened. |
| Training/quiz | Faculty selects named cohort/open student and kind → optional existing resource/roadmap link → Save assignments. Student opens resource or supported SQL/Python/Docker quiz → answers every question → submits fixed versioned set → score recorded → submits training evidence. Nonquiz completion is self-reported; assessment training requires recorded assessment. Progress and proficiency are separate; existing scoring never lowers a prior skill level. |
| Reports | Show applied filters/optional role and metric definitions → Export filtered CSV. Reuse scoped report; no raw private documents/email/answers. Escape formula-leading cells. Treat Offers as recorded offered stages, not joined/verified placements. |
| Import | Students & Cohorts → assigned cohort → CSV/XLSX upload → suggested mappings editable one destination each → Validate/preview row counts/issues → explicit skip-duplicates default or clearly confirmed update-matching-assigned-records → imported/error counts → revalidate remaining rows → Return to selected cohort/list. File upload/validation stages do not create approved students. Do not remove review/confirm to reduce clicks. |

**Known limits:** `/admin` can currently lose whole-page results when one Promise.all member fails; section-level recovery is expected. Question response lacks the `skill` label rendered in student quiz (F09/D11). Import staging expiry is not wired at runtime (F10), and parser resource limits need remediation (F13). Do not state a retention period is enforced until B/S/R establish it. Password activation/reset and scope grants are operator commands, not new UI capabilities.

**Accessibility/mobile:** Keep applied scope, selected assignee, and student/revision identity next to consequential actions when cards stack. Back from detail restores list focus; aggregate drill-down has a heading and return action. Import mapping controls name the source column and current destination; row errors announce row/field safely. Quiz choices form named single-choice groups, answered state remains visible, and Close assessment warns before discarding answers. Apply G04 to H01–H07.

| State | Journey-specific behavior |
|---|---|
| Loading / partial | Scoped metrics/list/student detail/drive requests have separate states; one failure does not erase unrelated sections. Latest applied filter context wins. Pending mutation disables its own submission. |
| Empty | No faculty assigned → contact placement coordinator; no resume → save one; no reviews/drives/training/applications → explain separately. No cohort → create an empty owned cohort or operator grant. No authorized students → no fabricated zero-readiness metrics. |
| Validation | Feedback required for decision; explicit sharing choices; drive company/role/link/date/eligibility ranges checked; training assignee/required fields and supported quiz skill checked; all answers required. Import extension/mapping/identity/ranges/issues shown before confirm; server constraints remain authoritative. |
| Permission / revoked | Do not expose private raw sources or another faculty's records. Stale deep link returns generic unavailable/access message and authorized list. Report/import scope checks apply on every request. |
| Failure / conflict / retry | Keep feedback/form/answers/evidence drafts for correction. Version conflict reloads current drive/application/training before explicit resubmit. Lost share/assignment/import response reconciles existing review/training/status before creation retry; do not assume all endpoints are idempotent. |
| Success / recovery | State exact result: Revision shared; Feedback recorded; Application tracked (not submitted to employer); Training evidence recorded; N rows imported, M issues remain. A committed mutation plus reload failure must not say no data changed. Cancel dialog/edit writes nothing; deleting a share/import is not a generic Undo. |

- **H01:** With two faculty and at least two differently scoped synthetic students, navigation, direct URLs, detail, aggregates, role catalog, reports, import status/retry/confirm, reviews, training, and applications reveal only authorized data. Scope revocation on a loaded record removes its visible protected contents on the next failed authorization/refresh. Catalog acceptance is blocked on D10. [Admin][admin], [placement routes][placement-routes], [auth][auth].
- **H02:** Apply filters → open student → back → Reports preserves applied scope/page as applicable. Editing draft cohort/filter does not silently change exported scope. Slow old filter response cannot overwrite newer result. Each metric keeps its definition and denominator. [Admin][admin], [faculty service][faculty-service].
- **H03:** Share saved revision V with faculty A and AI sharing off: A sees V only, not later V+1, original/private workspace, LinkedIn, or DIL data; faculty B sees none. Saving a revision does not reshare. Feedback is attached to V, revoke removes access, and student history remains. Failed share/reload never creates false-success or invites blind duplicate share. [Placement][placement], [ReviewCard][placement-ui], [placement routes][placement-routes].
- **H04:** Create/edit scoped drive; stale edit is rejected with draft retained. Student follows employer link without application creation; only explicit Record that I applied tracks it. Application version conflict preserves history; eligibility override needs reason; withdrawal is terminal under existing rules. [Admin][admin], [Placement][placement], [ApplicationCard][placement-ui].
- **H05:** Assign supported quiz to authorized student → heading names the correct skill (D11) → incomplete answers cannot submit → correct version scores deterministically → subsequent training evidence completes assignment. Resource/project completion without required evidence fails. No completion claims external certification. [Placement][placement], [TrainingCard][placement-ui], [learning service][learning].
- **H06:** Synthetic CSV/XLSX → map → validate changes no Student records; explicit confirmation imports only eligible rows with default duplicates skipped. Update option identifies the selected cohort/mode. Unassigned matching identity stays inaccessible; lost response uses `/api/import/{job_id}` status before retry; completed result returns to the intended cohort. Expired staging cannot be confirmed/retried once F10 is fixed; no enforced-retention claim before that. [Import][import], [import service][import-service], [placement routes][placement-routes].
- **H07:** Export rows match applied faculty filters and optional role; omit emails/raw resumes/answers; formula-leading synthetic cells are escaped. No data/permission/download failure is reported as successful export/save. [Admin][admin], [placement routes][placement-routes].

## 11. Prioritized UX issues and dependency register

Priorities reuse audit severity: P0 conditional release/privacy gate; P1 critical workflow/access; P2 substantial UX/reliability. These are requirements and outstanding work, not fixes delivered here.

| Order / priority / audit | Recommendation linked to actual screen/component | Acceptance | Owners / dependency |
|---|---|---|---|
| 1 / P0 gate / F01,F14 | Keep private review/grounded AI unavailable until schema/policy/operations readiness is verified; preserve preview/local paths. [DocumentReview][documents], [AI UI][ai] | B02,B06,B07,G05 | S/R + deployment/privacy owner, D3 |
| 2 / P1 / F02,F10 | Close catalog privacy and import expiry gaps before claiming authorized access/retention. [Admin][admin], [Import][import] | H01,H06 | B/S/R, D10; approved staging policy |
| 3 / P1 / F03,F04 | Reachable sign-out and withheld unsafe AI output. [Shell][shell], [AI roadmap][ai-roadmap] | G02,C05 | F; G/T/R, D7; preserve existing interfaces |
| 4 / P1 / F05 | Restore durable chosen target/analysis/progress; remove seeded-reset friction. [Journey][journey] | A03,A04,C02 | S/B/F, D1/D2 |
| 5 / P1 / F06 | Connect actual resource URL and evidence-backed progress actions. [CareerRoadmap][roadmap] | C03,C04 | F using existing B contract; D8 only for stronger concurrency |
| 6 / P2 / F15,F08 | Context-guarded responses, specific save/loading messages, independent section failure/retry, Jobs analysis ID and bounded timeouts. [Client][client], [Jobs][jobs], [Admin][admin], [Placement][placement] | G03,C05,J02,H02 | F single client/shell owner; G timeout coordination |
| 7 / P2 / F19 | Interpret insufficient evidence honestly without changing deterministic formula. [Journey][journey], [Jobs][jobs] | C01,J03 | Product/B/S/F, D2 |
| 8 / P2 / F07 | Stop success messages for unreachable task destination. [LinkedIn][linkedin] | E04 | F interim, product decision before task UI |
| 9 / P2 / F09 | Correct quiz title contract, preserve scoring. [Placement][placement] | H05 | S → B/F → T, D11 |
| 10 / P2 / F17,F18 | Consistent status/forms, semantics, focus and responsive interactions; adoption after primitive contract. [Primitives][primitives], [controls][controls], [placement widgets][placement-ui] | G04 plus every journey's local criteria | D then F; T/R rendered acceptance |
| 11 / P2 / source + F15 | Protect dirty resume/LinkedIn/form text and truthful mutation recovery. [Resume][resume], [LinkedIn][linkedin], [Import][import] | D03,D04,E02,H06 | F existing interfaces; no silent persistent draft store |
| 12 / P2/P3 / F22 | Honest reset/export/collection labels; eliminate duplicate uploads and misleading “complete” states. [Journey][journey], [CareerRoadmap][roadmap], [Market][market] | A02,A05,B01,C06,J05 | F; D4/D6 for deeper changes |

### Decisions required before dependent implementation

| ID | Concrete unresolved dependency / interface proposal | Safe behavior until resolved |
|---|---|---|
| D1 — active target continuation | Product/S/B must choose latest saved analysis vs explicit per-student active target. Recommended: explicit owned selection is the desired product behavior, but do not add storage until reviewed. Existing `/api/placement/journey` returns seed role only; dashboard is not a full saved AnalysisOut reader. Define an owner-scoped restoration response with role/analysis identity and saved roadmap lookup semantics, unauthorized/missing/stale outcomes, and migration only if necessary. Unsaved target without analysis must have an explicit restore policy. No new endpoint is assumed. | Label saved selection limits; preserve exact current-session Jobs handoff; do not claim cross-refresh restore or rerun providers on focus. |
| D2 — unknown/freshness interpretation | Product/B/S agree presentation-only insufficient-evidence rule and whether snapshot/freshness metadata is needed after profile changes. Keep `role-alignment-v1`, raw stored values, null competency, and formula unchanged. Freshness across reload cannot be inferred from absent profile revision metadata. | Label saved analysis time, unknown counts, and insufficient evidence; offer explicit reanalysis. |
| D3 — retained review rollout | Existing approval/runbook gates: schema readiness, privacy/consent/audit retention, HMAC management, verified backup/copy migration/restore and monitored purge. S/R must expose truthful capability failure without client schema guesses. | Flags stay off; deterministic preview and legacy confirmed save stay accurately scoped. No policy approval manufactured here. |
| D4 — profile correction and extraction breadth | There is no general profile editor. DIL allowlist excludes GPA/results; legacy JourneyDetails schema is broader than current extraction. Agree supported correction route/fields, source/conflict requirements and ownership before a manual editor or merged upload experience. Do not describe unsupported academic completion as one click away. | Existing confirmation/review alternatives; Not recorded and coordinator/operator guidance where no supported edit exists. |
| D5 — task destination | Product decides whether a discoverable view of existing RoadmapTask belongs in Journey and assigns concrete F files. Listing API exists but no screen does. No milestone conversion, migration, or data removal is authorized. | Disable/hide Add task with honest unavailable message; preserve old records. |
| D6 — report format | Product/F/R choose supported progress HTML/browser-print behavior or separately scope real DOCX generation. Current `.doc` bytes are HTML. Native roadmap export requires an assigned implementation/test boundary. | Truthful HTML / Print–Save as PDF labels; explain browser-only availability. |
| D7 — AI safety and budgets | G fixes F03 block/finish metadata handling before roadmap output is trusted; F/G agree bounded client timeout relative to server request budget and stale-result rules. No automatic retry, new model, live call, or feature activation. | Keep deterministic roadmap; withhold unsafe output and make failed/unknown request status explicit. |
| D8 — milestone concurrency | Existing PATCH progress has status/evidence only, no version/idempotency field. F can serialize own requests and reconcile returned values; multi-device lost-update protection requires S/B version/expected-state contract and T regressions. | Do not claim compare-and-set protection; reload after uncertain write, preserve evidence, avoid automatic overwrite/replay. |
| D9 — shared asset target | Resume supports manual description/listing; LinkedIn supports fixed role enum plus optional description. A universal persisted target context across these tools is not implemented. Any broader handoff requires S/B/F compatibility agreement. | Keep exact supported listing handoff; visibly choose LinkedIn's supported role rather than silently mapping to an unrelated role. |
| D10 — role ownership/access | S/B define private/custom vs deliberately shared role visibility; current unowned Job catalog cannot enforce desired privacy solely by hiding UI. Restrict to safe approved catalog before exposing it broadly; preserve existing custom data. | Treat cross-scope custom roles as blocked, not accepted architecture. No frontend-only privacy claim. |
| D11 — assessment display contract | `get_questions` returns `skill_id`, `question_set_version`, `questions`; client requires nonexistent `skill`. S agrees authoritative label field or a consumer join to known skill metadata; mirror contracts, then F display and T API/rendered tests. | Use verified existing metadata or neutral Assessment heading, never undefined or invented name. |

Screen-reader/native acceptance and supported release platforms remain R/product decisions. No OCR, external credential verification, automatic LinkedIn publishing, broad skill certification, employer application submission, predictive placement, SWOT, interview practice, new metrics, or new infrastructure is included.

## 12. Verification plan and task handoff

Acceptance scenarios are future work for T/R with synthetic data and mocked provider boundaries. Minimum fixture set: first-time account with no competencies; returning student with known and null skill levels; custom role; two real-looking synthetic listing snapshots with different requirements/source times; supported/unsupported document samples; two saved resume revisions with dirty local draft; confirmed/unconfirmed LinkedIn text; two faculty with disjoint scopes, assigned/unassigned students, one cohort/drive/review/training/import. No real student documents or provider credentials are needed.

| Test boundary | Required coverage / existing starting point |
|---|---|
| API/service | Preserve existing [Journey tests][test-journey], [document tests][test-documents], [job tests][test-jobs], [workspace tests][test-workspace], [LinkedIn tests][test-linkedin], [placement tests][test-placement], [AI tests][test-ai]. Add behavior/contract regressions under T ownership for approved changes. |
| Frontend helper | Existing `mobile/tests/` covers document decisions, resume spans, role routing, request gates, faculty scope, market helpers and status. These do not render screens and cannot prove G02/G04 or full journeys. |
| Browser | R/T maintained synthetic harness: A→B→C core loop plus Resume, LinkedIn, Jobs handoffs and faculty/share/import/training scenarios at 360/768/1440px; keyboard/focus/announcements, refresh/back, duplicate taps, conflict/timeout/lost-response/session/scope revocation. For each relevant failure, assert persisted data as well as UI message. |
| Downloads / native | Reopen actual resume DOCX/TXT, market/faculty CSV and roadmap HTML; exercise browser print cancel. Android/iOS picking, temporary cleanup, SecureStore, sharing, Back, safe areas and assistive technology require separate evidence before a native release. |

This task's actual checks:

| Command / inspection | Result |
|---|---|
| `git rev-parse HEAD`, `git status --porcelain` | Baseline HEAD recorded above; initially clean. |
| Bundled Python: `APP_ENV=test`, `python -m pytest` from `backend/` | Could not start: `No module named pytest`. No backend tests executed. |
| `node --test tests/*.test.cjs` from `mobile/` | Eight test-file startup failures: `Cannot find module 'typescript'`; no behavioral tests passed. Node v24.19.0. |
| `node node_modules/typescript/bin/tsc --noEmit` from `mobile/` | Could not start: local TypeScript module absent. |
| `node node_modules/expo/bin/cli lint` from `mobile/` | Could not start: local Expo CLI absent. `mobile/node_modules` is not installed. |
| Local document validator | Passed: all 55 source/document targets exist, 161 reference-link uses resolve, 45 acceptance IDs are unique, all 13 sections are ordered, and no trailing whitespace/placeholders were found. |
| `git diff --check`, `git status --short --branch`, `git diff --stat` | Passed whitespace check; no tracked changes. Only `docs/quality/PRODUCT_UX_SPEC.md` is untracked in this worktree; HEAD remains detached at the recorded commit. The validator also checks whitespace directly because Git's ordinary diff excludes untracked files. |
| Browser/native/provider checks and web export | Not run: documentation-only task, application dependencies absent; no live configuration/provider use authorized or needed. |

No dependencies were installed for this documentation-only task. These startup failures are environment limitations, not regression findings about the product. None of the product criteria is marked passed by source inspection. No production UI/backend files, tests, manifests, baseline reports, or historical progress documents are changed. Remaining dependencies are D1–D11 above; privacy/security/release findings remain owned by the audit plan. No configuration or provider keys are needed to review this document.

## 13. Proposed screen-by-screen frontend implementation sequence

1. **Shell and `/login`** — F fixes menu hit testing/session transition and intended-route recovery; D agrees accessible menu/dialog/field/status semantics. Accept G01–G04 before page adoption. G's F03 adapter repair can be separately coordinated under existing ownership; do not enable optional flags.
2. **`/` Profile and upload/review components** — clarify first-time/returning state and one evidence entry area; preserve both existing save contracts; implement honest validation, per-item decision/retry/expiry states and disabled-capability copy. Accept A01–A03,A05,B01–B08. Resolve D1/D2/D4 before claiming durable selection/general editing.
3. **`/` Alignment and shared `CareerRoadmap`** — saved context/unknown interpretation, actual resource links, evidence/progress save/recovery, truthful exports and optional AI boundaries. Accept A04,C01–C06 after dependencies; shared component completion benefits Jobs. Coordinate client changes as one F batch.
4. **`/resume`** — exact listing target handoff, feedback/draft/saved distinctions, dirty-edit protection, conflicts, Restore/Delete and real DOCX/TXT. Accept D01–D05; preserve originals and factual approval.
5. **`/linkedin`** — direct supplied-text path, accurate search/OAuth limits, saved/draft/confirmation behavior, task-unavailable interim and deletion/invalidation copy. Accept E01–E04; resolve D5/D9 before expanding targets/tasks.
6. **`/jobs`, then `/market`** — retained query/page context, grounded explanations, exact Journey/Resume handoffs, selected analysis ID, source safety, sample versus fresh collection and CSV. Accept J01–J05 and shared C05; no employer submission feature.
7. **`/placement`** — independent section states, deliberate revision/recipient/AI sharing, revoke/review/resubmit, explicit application history and evidence/quiz completion. Accept H03–H05 after D11; keep no-faculty/no-work empties distinct.
8. **`/admin` sections in order: Overview → Students/detail → Analytics → Placement → Reviews & Training → Reports** — retain scope/filter context, exact review snapshots and truthful status/metric definitions. Accept H01–H05,H07; catalog privacy fix D10 precedes analytics acceptance. One F writer owns this physical screen.
9. **`/admin-import`** — return-to-cohort context, mappings/preview/confirmation, lost-response reconciliation, truthful counts and expiry/parser failure recovery after B/S/R fixes. Accept H06. Finish R/T integrated browser, accessibility, persistence, download and supported-native checks; report unmet dependencies explicitly before release acceptance.

[login]: ../../mobile/src/app/login.tsx
[shell]: ../../mobile/src/app/_layout.tsx
[nav]: ../../mobile/src/components/app-navigation.tsx
[journey]: ../../mobile/src/app/index.tsx
[input]: ../../mobile/src/components/journey-input.tsx
[documents]: ../../mobile/src/components/document-review.tsx
[roadmap]: ../../mobile/src/components/career-roadmap.tsx
[ai]: ../../mobile/src/components/ai-explanation.tsx
[resume]: ../../mobile/src/app/resume.tsx
[linkedin]: ../../mobile/src/app/linkedin.tsx
[linkedin-insights]: ../../mobile/src/components/linkedin-insights.tsx
[jobs]: ../../mobile/src/app/jobs.tsx
[market]: ../../mobile/src/app/market.tsx
[placement]: ../../mobile/src/app/placement.tsx
[placement-ui]: ../../mobile/src/components/placement-ui.tsx
[admin]: ../../mobile/src/app/admin.tsx
[import]: ../../mobile/src/app/admin-import.tsx
[client]: ../../mobile/src/api/client.ts
[primitives]: ../../mobile/src/components/career-ui.tsx
[controls]: ../../mobile/src/components/workspace-controls.tsx
[schemas]: ../../backend/app/schemas.py
[contracts]: ../../mobile/src/types/contracts.ts
[journey-service]: ../../backend/app/services/journey_input.py
[document-service]: ../../backend/app/services/document_intelligence.py
[document-routes]: ../../backend/app/routes/documents.py
[analysis-service]: ../../backend/app/services/analysis.py
[scoring]: ../../backend/app/services/intelligence.py
[learning]: ../../backend/app/services/learning.py
[job-routes]: ../../backend/app/routes/jobs.py
[job-service]: ../../backend/app/services/job_discovery.py
[ai-roadmap]: ../../backend/app/services/gemini_roadmap.py
[resume-ai]: ../../backend/app/services/gemini_resume.py
[resume-helpers]: ../../mobile/src/utils/resume-workspace.ts
[market-helpers]: ../../mobile/src/utils/market-data.ts
[faculty-service]: ../../backend/app/services/placement.py
[placement-routes]: ../../backend/app/routes/placement.py
[import-service]: ../../backend/app/services/imports.py
[auth]: ../../backend/app/auth.py
[test-journey]: ../../backend/tests/test_journey_input.py
[test-documents]: ../../backend/tests/test_document_intelligence.py
[test-jobs]: ../../backend/tests/test_job_discovery.py
[test-workspace]: ../../backend/tests/test_workspace.py
[test-linkedin]: ../../backend/tests/test_linkedin.py
[test-placement]: ../../backend/tests/test_placement.py
[test-ai]: ../../backend/tests/test_grounded_ai.py
