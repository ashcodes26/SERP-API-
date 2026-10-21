# Stitch sign-in and student signup refinement

Implemented in the existing Expo `/login` route, with signup remaining a tab on that route. No backend, contracts, routing, session storage, dependencies, configuration, or unrelated screen was changed. No commit or push was made.

## Reference and initial differences

Inspected `s1_shared_sign_in_student_signup/screen.png`, `code.html`, and `dark_void/DESIGN.md` in the supplied Stitch export. The PNG is **1280 × 889 pixels**, not a scaled mobile design. There is no separate signup PNG in that folder: the exported HTML supplies its tab-switched signup state.

The old route had a scrolling, text-heavy brand row; a 900px desktop breakpoint; a flexible left column; a bordered generic form; oversized pill actions/tabs; system-dependent fonts; an extra form heading; different hero copy/spacing; plain role cards; no decorative background; and no compact status/help or sandbox treatment. Signup put username first and used the same large field spacing as sign-in. The underlying login/signup handlers already used the correct server contracts.

## Implemented presentation

- Fixed 64px header outside the scroll area: terminal mark, Inter wordmark, shield, actual service-availability indicator, and local account-access help. Availability comes from the existing `GET /api/health`; failure/unknown never displays a green success indicator. The help dialog describes existing access behavior only.
- At 1024px and above, centered split composition: 54% story column and 460px form, 24px outer gutters, 36px minimum column gap/vertical padding. Hero is Inter 600, 42/50px; narrower screens use 28/34px. Cards, badges, field labels and notices follow the export's dense hierarchy.
- Original exported decorative background downloaded unchanged and bundled locally under a matching dark gradient. Inter 400/500/600 reuse existing local, licensed font files through the installed Expo Font package; no remote font request or global override.
- Form panel: 16px radius, 24px padding, compact rectangular tabs with student badge, role notice, black 42px sign-in/38px signup inputs, 48px primary actions, visible focus border, password visibility toggle, server-error alert and disabled/busy states. Signup field spacing follows its denser export variant.
- Narrow layouts stack the story and form, then stack role cards below 768px. Fields and interactive controls retain mobile target sizes; signup remains vertically scrollable. Placeholder/helper contrast is intentionally stronger than the export's faint disabled gray.
- Decorative icons are local SVGs. Web tabs expose `aria-selected`; controls expose disabled/busy state; fields retain accessible labels; the information dialog has modal semantics.

## Functional preservation and deliberate reference differences

| Reference element | Application behavior preserved |
| --- | --- |
| Username or institutional-email sign-in | The existing endpoint looks up a **username**. The label and helper say username; no unsupported email alias is promised. |
| Signup omits username | Required username remains, after department. Student ID, full name, email, department and password still enter the existing payload. This makes signup taller than the reference. |
| Department dropdown with four sample choices | Existing free-text department remains; the schema does not define those choices as an enum. |
| Minimum password policy shown on sign-in | Registration still requires at least 12 characters. Existing sign-in accepts existing account passwords; it does not impose a new minimum on legacy accounts. |
| Remember-session checkbox | Replaced with an accurate session-storage note. Web remains per-tab sessionStorage; native storage is unchanged. No persistence toggle was fabricated. |
| Sample cohort, names and counts | Replaced with factual capability descriptions. No fictional public cohort/student data or compliance assertions. |
| Student/faculty demo credential autofill and client role guessing | No credential autofill or role guessing. A development-only student control invokes the existing server-gated `POST /api/auth/demo-session`, then the existing `accept()` flow. Faculty row is informational: institutional account provisioning, no demo shortcut/public signup. |
| Empty reference submits appear enabled | Existing required-field and password-length disabled predicate is retained. Empty application actions therefore appear dimmed. |

The original `submit()` handler and disabled predicate were compared before/after and are unchanged: `POST /api/auth/login`, `POST /api/auth/signup`, `accept(result)`, error propagation and password clearing. `accept()` still obtains the authenticated account and server-issued role; protected routes, intended destinations/query parameters and storage handling remain in the existing auth context/root layout. No role selector, public faculty registration, password recovery, SSO, new permission, fabricated success state, or security-policy change was added.

The existing development bootstrap may automatically open a demo workspace on a fresh load. That behavior/configuration was preserved. Verification reached `/login` through the existing logout action; no configuration workaround was introduced.

## Verification and captures

- `npx tsc --noEmit`: passed.
- `npx expo lint`: passed, including after accessibility/refinement changes.
- `node --test tests/*.test.cjs`: **22 passed**.
- Backend `python -m pytest -q` with test environment: **238 passed**, one existing Starlette/httpx deprecation warning. Test databases are isolated.
- Reused existing Expo web server at `http://localhost:8081` and backend at `http://localhost:8000`. A temporary static server served the reference HTML only; it was stopped afterward.
- Compared actual application screenshots against the supplied sign-in PNG and runtime signup HTML at **1280 × 889 CSS pixels**. Browser zoom was measured, rather than inferred from screenshot scaling. The browser provider pads screenshot canvases; final PNGs extract the matching viewport rectangle without changing its content or scale.
- Compared/revised background sizing/overlay, header/logo, hero wrapping, role-card heights, tab icon dimensions, form alignment, signup spacing, field sizes and control states. An unsupported SVG DOM prop found in the first pass was removed; its warning overlay disappeared.
- Browser checks at **390 × 844**, **768 × 889**, and **1280 × 889**: document width equals viewport width, no horizontal overflow. Mobile inputs measure at least 44px high. Mobile tabs wrap inside the card and remain selectable.
- Transient, non-account test input verified the original signup boundary: 11-character password disabled; 12-character password enabled when required fields were present. Password show/hide and account-help open/close were exercised, then all test values cleared. Signup was **never submitted**, and the demo button was not invoked for capture. No account was created for visual verification.
- Native devices and screen-reader navigation were not tested. No new credential/session success flow was simulated; authentication/authorization coverage comes from existing regression tests and the unchanged handlers.

Captures in the task visualization directory:

- `auth-signin-before.jpg`
- `auth-stitch-signin-reference.jpg`, `auth-stitch-signup-reference.jpg`
- `auth-signin-final.png`, `auth-signup-final.png`
- `auth-signin-final-comparison.png`, `auth-signup-final-comparison.png` — reference left, application right
- `auth-signup-lower.jpg`, `auth-signin-mobile-form.jpg`, `auth-signup-mobile-form.jpg`

Remaining differences are intentional contract/content adaptations above, minor SVG-vs-Material-Symbol shapes, slightly different text wrapping, stronger helper contrast, and background coverage at the outer page edges. Signup's extra required field pushes its sandbox farther down the scroll area. This is a screenshot-checked close reproduction, **not pixel-perfect equivalence**.

## Files and preservation

- Modified: `mobile/src/app/login.tsx`; font provenance note `mobile/assets/fonts/career-plan/README.md`.
- Added: `mobile/src/components/auth-ui.tsx`; `mobile/assets/images/auth-stitch-background.jpg`; this report.
- Asset provenance: background URL is the decorative `background-image` in the supplied auth `code.html` (lh3.googleusercontent.com), downloaded unchanged; Inter sources/license remain documented beside the existing font files.
- A fresh SHA-256 baseline confirms only the two listed existing files changed during this task. Existing backend, API client, contracts, auth context/root layout, Career Plan refinements, global tokens/styles and other pre-existing uncommitted files were preserved.
- No setup or environment change is required. Temporary viewport overrides were reset. The sign-in tab remains available; Stage 2/unrelated redesign work was not undertaken.
