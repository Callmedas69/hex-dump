# HexOnion front page UX fix plan

Date: 2026-09-14
Status: Complete. All 14 tasks executed sequentially and verified. See the [verification record](../docs/audits/2026-09-14_frontpage-fix-verification.md).
Execution checklist: [Atomic tasks](2026-09-14-frontpage-ux-fix-tasks.md)

## Objective

Make a first-time visitor understand what HexOnion does, what hex means, and how to start. Explain the useful action in plain language, followed by the technical term where helpful. Preserve the terminal identity and existing conversion behavior.

This plan supersedes the homepage messaging and navigation direction in [the earlier homepage flow plan](2026-09-14-homepage-flow-plan.md) and its completed task list. Those documents remain historical records. Their equal public/private sharing cards caused issues identified in the new review.

Inputs:

- [Frontend audit](../docs/audits/2026-09-14_hex_frontend-audit.md), findings F01 through F09.
- [Proposed copy and flow](../docs/audits/2026-09-14_hex_frontpage-copy.md).
- [Desktop/mobile observations](../docs/audits/assets/2026-09-14/observations.json).
- Current `AGENTS.md` product boundary and implementation rules.

## Scope and decisions

1. Lead with encoding and decoding. Sharing is an optional action after conversion.
2. Explain that hex is reversible encoding and does not keep messages secret.
3. Show a fixed, read-only example before wallet connection. Keep editable conversion behind the existing holding gate.
4. Make every entry action lead to visible content, retaining the selected conversion mode through access checks.
5. Advertise only capabilities within the current project instructions. Remove the homepage's active Onion promise and private-sharing card. Leave existing dead-drop routes, invitation authorization, encryption and deployment work untouched. Reintroducing their promotion requires a separate reconciliation of the product boundary and deployed capability.
6. Preserve Robinhood Chain mainnet, chain ID 4663. Development access remains at least 0.01 USDG, 10,000 raw units with six decimals. Production wording comes from the explicit production policy, including its symbol and threshold.
7. Keep conversion browser-local, byte offsets and leading zeroes intact, and exports at 1600 × 900. Do not alter codec, X publishing, token policy or authentication semantics for this UX work.
8. Preserve all existing user edits, particularly `app/globals.css` and `lib/share.ts`. Re-read their current state before implementation. Avoid whole-file formatting churn.

The plan was subsequently approved for implementation. Execution is complete; environment-file changes, commits, pushes, deployment, Tor setup and real X posting were outside this execution.

## Target page and copy

Use the companion copy proposal for detailed wording. Resolve its alternative suggestions with these defaults:

| Element | Planned content or behavior |
|---|---|
| Brand | HexOnion |
| Main message | Turn text into hex. Find text in Bitcoin data. |
| Description | Convert a message into hexadecimal (hex), or inspect Bitcoin bytes for readable text. Conversion happens in your browser. Copy the result or preview an image to share on X. |
| Visible sample | `Hello` → `48 65 6C 6C 6F` |
| Sample explanation | Hex represents data using 0–9 and A–F. Each pair is one byte. Anyone can decode it, so it does not keep a message secret. |
| Primary action before access | Check wallet access |
| Primary action after access | Open hex tool |
| Invalid configuration action | Access unavailable, leading to the visible explanation without opening a wallet |
| Secondary action | See a Bitcoin example |
| Task choices | Text to hex (encode); Hex to text (decode) |
| Access reassurance | Checking your balance does not transfer funds. |
| Sharing action | Preview sharing |

Page order: brand and purpose → small sample and entry actions → task selection and optional read-only Bitcoin example → access check → workspace → optional sharing. Put network/session diagnostics in secondary access details. At 390 × 844, the main message and primary action must fit within the initial viewport at default zoom.

The fixed Bitcoin example uses existing Genesis fixtures, is labeled as sample data, and explains that some bytes are not text. It does not display a visitor's draft, open a wallet, invoke X or call a server. Do not strip or reinterpret fixture bytes to make a prettier sample.

## Access and navigation design

Keep `SecurityGate` as the single owner of wallet-policy verification. Add the smallest composition interface needed to render the hero/task controls using its current access state outside the hidden workspace container. Prefer an optional render prop for introductory content receiving derived access state, rather than a second balance query or mirrored `granted` state in `Home`.

`Home` owns the selected encode/decode mode so both the introductory controls and workspace tabs change the same state. Workspace text and hex drafts remain mounted inside the existing gate wrapper. A mode change must not reinitialize drafts.

Provide stable destinations for the access section, sample and workspace. Use explicit user-triggered navigation with focus on a visible heading or input. Do not rely on a fragment pointing into a hidden ancestor. Preserve `#hex-workspace` for existing bookmarks; when visited while locked, route focus to the access explanation without exposing the workspace.

| User state/event | Expected outcome |
|---|---|
| Disconnected; main action or task choice | Remember selected mode, reveal/focus access explanation, then let the user explicitly connect. |
| Wrong chain | Explain Robinhood Chain and offer explicit Switch network. |
| Checking / insufficient balance / failed RPC | Remain at the gate with useful status and an appropriate retry action. |
| Missing, unsupported or invalid production policy | Show Access unavailable; suppress connection and switching as remedies. Do not invent a default threshold. |
| Access granted; main action or task choice | Open selected mode and focus its input. |
| Access succeeds following a user entry request | Consume that pending request once and move focus to the selected workspace. |
| Background refresh grants access with no pending request | Do not steal focus or scroll the page. |
| Access revoked / transient error | Hide and make workspace inert; retain drafts. If focus was inside hidden content, move it to the gate. |
| Access recovers | Retain drafts and mode without repeating automatic focus jumps. |

Policy values shown in the header and gate must share the same policy source. For a zero minimum, show “a positive balance” to match existing access semantics. The development sandbox remains explicitly enabled for development only and stays disabled in production.

## Workspace and sharing language

- Pair familiar labels with jargon: Text including emoji (UTF-8), Basic characters (ASCII), Hex with byte positions (offset dump).
- Explain byte positions next to input format controls and the 65,536-byte (64 KiB) limit next to input.
- Replace AWAITING COMMAND with state-specific feedback: empty input, invalid input, incomplete byte, selected output decoding error, or Result ready. Do not show success for a failed UTF-8 output view.
- Make output help match the selected ASCII, UTF-8 or hex-dump view.
- Rename Reset to Load Bitcoin example, retaining its existing deliberate Decode/Genesis behavior. Keep Clear distinct.
- Explain public sharing in the preview. Keep Encode exports free of original plaintext and preserve the current payload contract; flag any pre-existing export-policy conflict separately rather than silently expanding this plan into serialization changes.
- Distinguish X not configured from X configured but disconnected. Explain download/composer fallback and manual image attachment without promising direct posting after sign-in when the server is unconfigured.

## Presentation and accessibility

Keep `Nokian_title.ttf`, `nokiafc22-body.ttf`, the olive palette, square controls and terminal styling. Start explanatory body copy at 14px and verify with the actual fonts. Keep dense byte-grid styling independent from marketing copy sizes.

Use semantic headings, visible keyboard focus, descriptive action names and at least 44px primary touch targets. Keep both modes reachable by keyboard; use complete tab semantics if retaining `role="tab"`. Focus changes must follow user intent and actual visibility. New expanders should use native disclosure behavior where suitable.

Retain GSAP for existing meaningful sequences and CSS for small effects. Honor Motion off and reduced-motion preferences. Avoid adding animated explanations or a forced tutorial.

## Implementation surfaces

| Surface | Responsibility |
|---|---|
| `app/page.tsx` | Composition, selected mode, task entry, workspace wording and feedback |
| `components/TerminalHeader.tsx` | Purpose, sample, primary actions, secondary diagnostics |
| `components/SecurityGate.tsx` | Shared access presentation state, visible destination, helpful gate states |
| `components/HexExample.tsx` (new if useful) | Fixed read-only Genesis example; no new service dependencies |
| `app/globals.css` | Scoped responsive hierarchy, explanatory text, focus and touch targets |
| `components/ShareDialog.tsx` | Preview and X connection wording only |
| `tests/homeUi.test.mjs` | Retire assertions requiring obsolete public/private cards |
| `tests/` and browser evidence | Meaningful navigation, state, draft-retention and sharing regression coverage |
| `README.md` | Update frontpage onboarding description after implementation |

Before Next.js changes, read the installed guides in `node_modules/next/dist/docs/`, including accessibility, linking/navigation and the Link API. Preserve the generated AGENTS instruction block.

## Execution and verification

Follow the [atomic task list](2026-09-14-frontpage-ux-fix-tasks.md). Each task is a bounded outcome with dependencies, owned files and an acceptance check. Include affected checks with each behavior change; reserve final tasks for integrated verification and evidence.

Use a production build for visual review, capturing 390 × 844, 768 × 1024 and 1440 × 1000. Also check 320px reflow, 200% zoom, keyboard entry, Motion off and reduced motion. Exercise valid and invalid configuration separately without changing production settings. Browser tests should stub wallet/RPC responses or use the explicit development sandbox for supplemental checks; never add a production bypass or manipulate `hidden`/`inert` to simulate verified access.

The existing homepage test matches source strings and currently requires the obsolete Onion cards. Update that contract with the information-architecture change, but do not treat string matches as proof that focus or navigation works. Use browser-observed outcomes for the broken CTA, mode persistence and draft retention.

Required final commands, run sequentially to avoid generated-type/build conflicts:

```text
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Keep X status/auth/post responses mocked for verification. Never publish a real post. Record unavailable real-wallet or deployed-Tor checks as limitations, not passes. If the local production token policy remains unconfigured, verify the honest unavailable state and use an isolated test configuration for the granted flow.

## Completion criteria

- Every audit finding F01–F09 has an implemented fix and recorded verification.
- A new visitor sees the purpose, a real hex example and a useful primary action in the initial mobile screen.
- Locked and granted entry actions land on visible, correctly focused content; both modes are reachable.
- Access status, requirements and recovery steps match actual configuration and balance state.
- The explanatory copy distinguishes encoding from secrecy and explains jargon locally.
- Drafts, byte fidelity, output modes, export dimensions and deliberate X sharing remain correct.
- Required commands pass and browser evidence records the completed state without claiming user-study results.
