# Atomic tasks: HexOnion front page UX fixes

Date: 2026-09-14
Status: Complete. All 14 tasks executed sequentially. [Verification and evidence](../docs/audits/2026-09-14_frontpage-fix-verification.md).
Parent: [Fix plan](2026-09-14-frontpage-ux-fix-plan.md)

Complete the acceptance checks before marking a task done. Dependencies describe execution order, not permission to delegate. Files shared by tasks should be edited sequentially. Keep behavior changes and their affected tests together so intermediate work remains reviewable.

## Task index

| ID | Outcome | Depends on | Audit coverage |
|---|---|---|---|
| T01 | Record baseline and implementation constraints | None | All |
| T02 | Expose one shared access presentation state | T01 | F01, F05 |
| T03 | Repair locked and granted entry navigation | T02 | F01 |
| T04 | Explain the product in the hero | T03 | F02 |
| T05 | Replace channel choices with conversion tasks | T03, T04 | F03, F04 |
| T06 | Add a read-only Bitcoin example | T04, T05 | F05 |
| T07 | Explain access states and unavailable configuration | T02, T03 | F05, F09 |
| T08 | Fix status and selected-view explanations | T05 | F07, F09 |
| T09 | Give the Genesis-loading action an accurate label | T05 | F08 |
| T10 | Clarify share preview and X fallback wording | T08 | Copy proposal |
| T11 | Improve mobile order, text and keyboard usability | T04–T10 | F06, F09 |
| T12 | Verify access transitions and draft preservation | T03, T05, T07, T11 | F01, F03, F05 |
| T13 | Run final checks and capture browser evidence | T06–T12 | All |
| T14 | Update onboarding documentation and handoff | T13 | All |

## T01: Record the baseline

- [x] Complete T01.
- **Files:** This checklist and implementation evidence under `docs/audits/`.
- **Work:** Read the fix plan, audit, current `AGENTS.md`, relevant installed Next.js guides and current affected source. Record existing changes, including CSS/share edits. Confirm baseline checks and local policy availability without exposing secrets. Identify the installed browser testing route before promising automated coverage.
- **Acceptance:** Existing unrelated edits are recorded for preservation; old homepage assertions are identified; environment limitations are explicit. No application changes in this task.

## T02: Expose access state to introductory content

- [x] Complete T02.
- **Files:** `components/SecurityGate.tsx`; `app/page.tsx` wiring only; focused tests if state behavior is extracted.
- **Work:** Add an optional introductory render slot receiving derived access/policy presentation state outside the hidden workspace. Keep verification in SecurityGate and retain compatibility for existing consumers. Do not duplicate balance queries or mirror granted state in Home.
- **Acceptance:** Header and gate can use the same policy and granted/unavailable state. Existing balance checks, refresh/revocation behavior, hidden/inert protection and development-only sandbox still work. Children remain mounted across denied/granted transitions.

## T03: Repair entry navigation

- [x] Complete T03.
- **Files:** `app/page.tsx`, `components/SecurityGate.tsx`, `components/TerminalHeader.tsx` action props as needed; targeted navigation checks.
- **Work:** Add stable, visible access and workspace destinations. Route locked entry to access; granted entry to workspace. Track a pending user entry request and consume it once after successful access. Handle existing `#hex-workspace` links while locked. Use focus after visibility is established, not an anchor inside hidden content.
- **Acceptance:** Pointer and keyboard entry reach visible content; successful user-requested access focuses the input once; background refresh does not steal focus. On revocation, focus leaves the hidden workspace if necessary, and drafts stay mounted. No automatic wallet opening.

## T04: Write the explanatory hero

- [x] Complete T04.
- **Files:** `components/TerminalHeader.tsx`, scoped rules in `app/globals.css`.
- **Work:** Add the plan's headline, short description, fixed Hello hex sample and reversible-encoding explanation. Place an access-state-aware primary action and See a Bitcoin example link after the explanation. Put diagnostics beneath these actions; remove the duplicate first-screen wallet prompt.
- **Acceptance:** The first screen explains the concrete benefit, local conversion and hex's lack of secrecy. Brand, Nokia fonts and olive styling remain. Main action wording matches locked, granted or unavailable state.

## T05: Make encode/decode the task choices

- [x] Complete T05.
- **Files:** `app/page.tsx`, scoped chooser styles, `tests/homeUi.test.mjs`.
- **Work:** Replace public/private sharing cards with Text to hex (encode) and Hex to text (decode). Lift selected mode to the nearest shared owner and connect both task controls and workspace tabs to it. Remove active Onion promotion from the homepage. Update obsolete test assertions in the same change, retaining relevant byte-format checks.
- **Acceptance:** Either task selected while locked opens that mode after access. Switching modes preserves both drafts. No homepage claim suggests Tor transport, encryption of hex, or writing ordinary encoded messages to Bitcoin. Existing dead-drop routes remain intact.

## T06: Add the read-only Bitcoin example

- [x] Complete T06.
- **Files:** `components/HexExample.tsx` if extracted, `app/page.tsx`, scoped sample styles.
- **Work:** Render a labeled example from the existing Genesis fixture outside the gate. Link See a Bitcoin example to its visible heading or disclosure. Explain why binary data can contain readable passages. Reuse codec/fixture functions where appropriate; do not create an editable alternate workspace.
- **Acceptance:** A disconnected visitor can inspect the fixed example. It has no wallet, X or server side effects; no visitor text appears in it. Displayed offsets/bytes match the fixture and the explanation does not imply all bytes decode into text.

## T07: Make the access gate understandable

- [x] Complete T07.
- **Files:** `components/SecurityGate.tsx`; shared header helper copy if needed; state checks affected by presentation changes.
- **Work:** Use the plan's state table for disconnected, wrong chain, checking, insufficient, failure, unavailable and granted copy. Display actual formatted policy values, including positive-balance wording for zero thresholds. Explain that the encoder balance check transfers no funds. Suppress futile wallet/switch actions when production configuration is invalid.
- **Acceptance:** Wrong-chain visitors can explicitly switch to chain 4663; RPC failures have retry; invalid configuration clearly says access is unavailable. Production copy does not inherit a hardcoded 0.01 USDG fallback. No change to threshold/auth logic or production bypass behavior.

## T08: Correct workspace feedback and jargon

- [x] Complete T08.
- **Files:** `app/page.tsx`; small view-state helper and tests only if needed for meaningful behavior coverage.
- **Work:** Replace AWAITING COMMAND with states for empty, malformed, incomplete, output-error and ready input. Account for `output.error` when UTF-8 decoding fails. Explain UTF-8, ASCII, offsets and the input limit next to their controls. Make output notes follow the selected view.
- **Acceptance:** Valid typing immediately produces Result ready; empty input prompts entry; invalid UTF-8 is not reported as ready. ASCII and hex-dump help appear only for the applicable view. Existing warning, share-disable and byte-preservation behavior remains.

## T09: Rename the example-loading action

- [x] Complete T09.
- **Files:** `app/page.tsx`.
- **Work:** Rename Reset to Load Bitcoin example and clarify the Genesis/message preset labels using the copy proposal. Preserve their existing behavior and keep Clear separate.
- **Acceptance:** Action labels make the switch to a Bitcoin decoding example explicit. Clear still clears only the active input. Confirm in the browser; do not add a test that merely duplicates a label string.

## T10: Clarify the sharing preview

- [x] Complete T10.
- **Files:** `components/ShareDialog.tsx`; `app/page.tsx` sharing action label.
- **Work:** Use Preview sharing as the workspace action. Explain that X sharing is public, hex can be decoded, and downloaded images need manual attachment in the composer. Make the preview heading appropriate to encode/decode mode. Distinguish unconfigured direct posting from a configured but disconnected X account.
- **Acceptance:** Mocked configured/disconnected and unconfigured states give different, accurate next steps. Preview opens without publishing. Existing exports, request payloads, encoding privacy, dimensions and explicit Post to X behavior are preserved. No live X calls during verification.

## T11: Make the final layout usable on mobile and keyboard

- [x] Complete T11.
- **Files:** Scoped `app/globals.css` rules; header, task/sample and workspace markup only where needed.
- **Work:** Fit the main explanation and primary action in the first 390 × 844 viewport. Put optional diagnostics later. Start explanatory body copy at 14px; use at least 44px primary touch targets. Add visible focus styling to new links/actions. Complete keyboard semantics for the mode controls, retaining full tab semantics or using honest pressed-button semantics.
- **Acceptance:** No page-level horizontal overflow at 320, 390, 768 and 1440px; byte-grid scrolling remains contained. Keyboard can reach both modes, gate, sample and sharing. At 200% zoom content reflows without losing actions. Motion off and reduced motion leave content visible and navigable. Shared dead-drop layouts receive a smoke check for unintended CSS changes.

## T12: Verify entry-state transitions

- [x] Complete T12.
- **Files:** Focused tests/browser checks in `tests/` using the available harness; test-only fixtures; evidence under `docs/audits/`.
- **Work:** Exercise the plan's access matrix with isolated wallet/RPC stubs. Verify hidden-target regression, Encode/Decode intent, one-time focus after grant, revocation, recovery and draft preservation. Check invalid config separately. Strengthen the existing source-only homepage test with observed behavior rather than replacing it with new copy snapshots.
- **Acceptance:** Each transition has executable assertions or reproducible recorded browser evidence. Both input drafts survive a failed check and recovery. Production bypass remains impossible. Any unexercised real-wallet behavior is explicitly labeled as a limitation.

## T13: Complete integrated verification

- [x] Complete T13.
- **Files:** Verification evidence only, plus fixes to defects actually found within this scope.
- **Work:** Run `npm test`, `npm run lint`, `npx tsc --noEmit`, then `npm run build` sequentially. Review the resulting production build at 390 × 844, 768 × 1024 and 1440 × 1000. Capture initial viewport, full page, access and selected workspace, Motion off and reduced motion. Check keyboard focus, browser console, example flow and mocked sharing fallback.
- **Acceptance:** Required commands pass; F01–F09 each has a verification outcome. A test Encode message stays out of its image/post payload, output images stay 1600 × 900, and existing codec/gate/share tests remain green. No real post, token transfer, production config change or fabricated usability result.

## T14: Update onboarding documentation and handoff

- [x] Complete T14.
- **Files:** `README.md`, this checklist, fix plan status and final verification report under `docs/audits/`.
- **Work:** Align README onboarding with the new task-first page. Record completed task IDs, command results, screenshot paths and material limitations. Document the superseded homepage direction without rewriting earlier completed history. Review final diff for unintended changes and preserved user work.
- **Acceptance:** Documentation describes implemented functionality accurately. Remaining issues are listed explicitly; no incomplete task is checked off. Handoff includes concrete validation and reviewable file changes. Committing, pushing and deployment are separate from this task list.
