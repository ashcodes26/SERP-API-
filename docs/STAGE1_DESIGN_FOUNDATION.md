# Stage 1 — Shared design foundation

Scope: shared presentation only. Reference: the supplied Stitch export's `dark_void/DESIGN.md`. Screen-specific redesigns require approval for Stage 2.

## Token ownership

- `mobile/src/constants/design-tokens.json` is the canonical source for colors, typography sizes/weights, spacing, radii, control sizes, content widths and breakpoints.
- `design.ts` provides semantic aliases and platform font styles. `palette.ts` and `theme.ts` retain their existing exported names for compatibility.
- `variables.css` is generated from that JSON. From `mobile/`, run `node scripts/sync-design-tokens.cjs` after token edits; run the same command with `--check` to detect drift. No dependency or package configuration change is needed.
- Use the reference's structural Dark Void roles: black canvas, `#0d0d0f` cards, `#16161a` nested/secondary surfaces, `#1e1e24` dialogs, violet `#8052ff` primary actions. The Material-style pastel primary in the export frontmatter is not the CTA fill.
- Preserve readable white primary-action labels: default/hover/pressed contrast is 4.60/5.50/6.01:1. Hover deliberately darkens instead of applying the reference's unspecified lightening, which could reduce contrast. Body/card, muted/secondary and error/dialog pairs also pass 4.5:1.
- Inter is preferred when available on web, with system fallbacks. Inter is not bundled or downloaded by this stage. Typography tokens include mobile sizes for subsequent screen work.

## Shared components and shell

- `career-ui.tsx`: existing Card, Details and Action signatures remain compatible. Cards now have full borders, tonal backgrounds, padding and 12px corners. Actions add optional compact/busy/accessible-label props, hover/pressed states, a spinner and readable disabled styling. Existing `ui` style keys remain available.
- `workspace-controls.tsx`: Field retains controlled values and validation ownership; adds focused styling and disabled semantics. Check preserves explicit checked/disabled state and callbacks. Confirm keeps its original handlers and cancellation behavior, using the dialog surface and shared busy treatment. File picking is unchanged.
- `app-shell.tsx`: presentation-only header receives the existing username, role, logout handler and busy state. No authentication/session API is called here. Logout remains visible and has a 44px minimum control height.
- `app-navigation.tsx`: existing four student destinations, six faculty section URLs and asset/opportunity subnavigation remain intact. At 1200px the shell puts navigation beside the brand/account controls; smaller widths use a separate navigation row. Faculty keeps its existing section menu below 900px. Horizontal scrolling retains access when links do not fit.
- `_layout.tsx`: only the shared header import and rendered header are replaced. Existing session restoration, demo session fallback, authorization handlers, logout error handling and protected route stacks are retained.
- `global.css`: keyboard focus uses the generated focus-width/offset tokens; existing reduced-motion behavior remains.

## Files changed by this stage

New: `mobile/src/constants/design-tokens.json`, `mobile/scripts/sync-design-tokens.cjs`, `mobile/src/components/app-shell.tsx`, this document.

Updated: `mobile/src/constants/design.ts`, `palette.ts`, `theme.ts`, `variables.css`; `mobile/src/components/career-ui.tsx`, `app-navigation.tsx`, `workspace-controls.tsx`; `mobile/src/app/_layout.tsx`; `mobile/src/global.css`.

The pre-existing uncommitted backend, client/contract, student demo and page edits remain in the working tree. They are not changes introduced by Stage 1. No commit or push was made.

## Verification

- `npx tsc --noEmit`: pass.
- `npx expo lint`: pass.
- `node --test tests/*.test.cjs`: 22 passed.
- `node scripts/sync-design-tokens.cjs --check`: pass.
- `.venv/Scripts/python.exe -m pytest -q` from `backend/`: 238 passed; existing Starlette/httpx deprecation warning remains.
- `git diff --check`: pass (Git reports line-ending normalization warnings).
- SHA-256 comparison of 95 protected backend, contract, API, auth/session, dependency and configuration files against the captured pre-stage contents: unchanged.
- Browser: restored a real existing student demo session, checked student navigation and existing saved data, loaded/closed the read-only Resume Demo records, signed out, and signed in to the existing faculty account. Faculty compact menu retains all six links; Reports retains its section query URL and scoped CSV control.
- Browser widths measured in CSS pixels: 320, 480, 768 and 1440. Narrow layouts retain Logout with no document-level horizontal overflow in the tested views. Keyboard navigation reaches Logout with a visible violet focus outline. Native simulator/device testing was not run.

## Preservation checklist and remaining work

- Backend, endpoints, contracts, permissions, session logic, database schemas, scoring and null/zero semantics are unchanged.
- No fabricated data, new metrics, unsupported controls, compliance claims, automatic consent or external AI calls were added. Existing demo provenance labels and privacy disclosures remain.
- Page-specific composition, mobile title sizing/content gutters, dense tables and replacement of remaining local inline styles belong to later stages. Shared components already cascade their visual changes into existing screens.
- Live Gemini/SerpApi processing, file upload/export mutations and all placement operations were not re-exercised through the browser; their frontend handlers are unchanged and existing tests pass. No external service calls were needed for this stage.
- Stage 2 has not started.
