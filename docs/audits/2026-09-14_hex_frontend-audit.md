# frontend audit: HexOnion (2026-09-14)

## verdict

HexOnion has a distinctive visual identity, but the frontpage makes new visitors work too hard to understand the product and reach it. The first screen sells mystery and wallet access before explaining a useful outcome. The primary encoder link leads to a hidden workspace for visitors without access. Overall provisional score: **28/40**. The page passes the generic-AI-site smell test: the olive LCD palette, Nokia typography, terminal framing, and restrained motion form a coherent identity. Preserve that identity while making the explanation and next step clearer.

The recommended message is: **“Turn text into hex. Read hex as text.”** Follow with: “Encode text or inspect Bitcoin bytes in your browser. Hexadecimal, or hex, is a way to represent bytes. It is encoding, not encryption.” Pair familiar words with the technical name, then explain specialist controls where users encounter them. See the [companion frontpage copy proposal](2026-09-14_hex_frontpage-copy.md).

## scores

| pillar | score /10 | summary |
|---|---|---|
| visual design | 6 | Strong brand identity; dense small copy and mobile ordering weaken comprehension. |
| animation | 8 | Header animation fits the terminal theme; Motion off and reduced-motion content remained usable. |
| code quality | 7 | Local conversion is clearly separated, but the gated anchor and Reset behavior create flow defects. |
| a11y + performance | 7 | No observed horizontal overflow or captured console errors; copy legibility and navigation need attention. |

These are scoped expert judgments from a local production build and source review, not a user-study score, WCAG certification, or measured Web Vitals assessment. No unavailable tooling subscore is included.

## quick wins (do these first)

Each item is intended as a small independent edit, approximately 30 minutes or less before shared validation.

1. [P0] Encoder CTA has no visible destination while locked -> do: send locked visitors to a visible access section and unlocked visitors to the workspace, `app/page.tsx:130`, `components/SecurityGate.tsx:75`.
2. [P1] Hero describes mystery before utility -> do: replace the intro with the plain-language explanation above, `components/TerminalHeader.tsx:96`.
3. [P1] Homepage promises Onion transport without establishing availability -> do: remove the unconditional Onion promise until it matches the verified deployment and product boundary, `app/page.tsx:130`, `app/dead-drop/page.tsx:10`.
4. [P1] Sharing cards bury the decoder -> do: describe the main task as “Encode text or decode hex” and make sharing an optional later step, `app/page.tsx:130`.
5. [P1] Wallet access lacks a clear explanation -> do: add “Connect to check your token balance. This check does not transfer tokens” beside the encoder access action, `components/SecurityGate.tsx:26`, `components/SecurityGate.tsx:57`.
6. [P2] Valid automatic conversion says “AWAITING COMMAND” -> do: change that status to “Result ready” when input is valid and nonempty, `app/page.tsx:120`.
7. [P2] Reset unexpectedly changes modes -> do: rename the existing action “Load Genesis example” to describe its actual behavior, `app/page.tsx:75`, `app/page.tsx:122`.
8. [P2] Explanatory copy is unnecessarily small -> do: increase intro and card body sizing to a readable Nokia-font scale, starting at 14px and checking wrapping at 390px, `app/globals.css:663`, `app/globals.css:1061`.

## findings by severity

Severity definitions: P0 means broken behavior, a console error, or a WCAG A failure; P1 means a user-visible quality problem; P2 means a code or content problem with UX risk; P3 means polish. Every P0 and P1 below was rechecked against its source before inclusion.

### P0 blocking

**F01 | Navigation | The primary encoder CTA points into hidden content.**

Evidence: `app/page.tsx:130` links to `#hex-workspace`; `components/SecurityGate.tsx:75` puts that workspace inside a hidden, inert container until access is granted. In the production browser pass, clicking the desktop CTA changed the URL hash but left `scrollY` at 0 and `targetVisible` false. Mobile also left the target hidden. See [captured observations](assets/2026-09-14/observations.json) and [desktop click state](assets/2026-09-14/desktop-encoder-click.png).

Why it matters: a new visitor clicks “Open hex encoder” and cannot see either the tool or an explanation of the next required step.

-> do: make the CTA resolve to a visible, clearly labeled access section while locked and the workspace after access is granted, preserving the existing gate and mounted drafts.

### P1 major

**F02 | Product understanding | The hero suggests secrecy without explaining the operation.**

Evidence: `components/TerminalHeader.tsx:92` names the product and `:94` says “ENCODER / DECODER,” but the full explanatory paragraph at `:96` only says “Messages hide in plain sight” and “Turn words into bytes. Read between the lines.” Neither that hero nor the complete homepage choice section at `app/page.tsx:130` explains that hex is reversible encoding rather than encryption.

Why it matters: newcomers can mistake an unfamiliar-looking hex message for private communication and cannot quickly explain what the product helps them do.

-> do: replace the hero paragraph with one concrete encode/decode outcome and an adjacent “Hex is encoding, not encryption” explanation.

**F03 | User flow | The page asks users to choose a sharing channel before choosing their task.**

Evidence: the complete choice section at `app/page.tsx:130` presents public X sharing and a private dead drop, with “Then choose whether to share the result” linking both to hex conversion. Decode exists in the gated tabs at `app/page.tsx:85`, while the private route actually calls `encryptDeadDrop(message)` directly at `app/dead-drop/page.tsx:35`.

Why it matters: visitors seeking to read hex have no clear entry point, and the introduction suggests hex conversion is a prerequisite for a separate encrypted-message flow.

-> do: organize the homepage around “Encode text or decode hex,” with optional public sharing after conversion and any verified private-message capability presented as a separate task.

**F04 | Message accuracy | “Through the Onion network” is an unsupported unconditional homepage promise.**

Evidence: `app/page.tsx:130` repeatedly promises Onion transport. The checked-in `AGENTS.md` product boundary says Tor is planned rather than shipped. The code does contain a private-message route, but `app/dead-drop/page.tsx:10` makes its Onion URL optional, `:24` distinguishes HTTPS from Onion, `:36` sends to a same-origin API, and `:71` conditionally offers an Onion link. This does not establish the deployed transport.

Why it matters: visitors may assume an ordinary HTTPS visit routes messages through Tor. Repository code and the product instructions currently do not support that blanket promise.

-> do: align public claims with verified deployed capability, removing unconditional Onion wording until availability and the stated product boundary are reconciled.

**F05 | Access onboarding | The wallet request arrives before sufficient value and access context.**

Evidence: `components/TerminalHeader.tsx:103` puts network diagnostics and Connect Wallet in the hero; the complete header has no example or explanation of the balance check. `components/SecurityGate.tsx:57` says “IDENTIFY YOURSELF,” and its actions at `:61` still include Connect Wallet when no production policy exists. The full tool, including examples, remains hidden at `:75`. The captured local build reports missing production token configuration.

Why it matters: visitors must decide whether to connect before seeing a useful result. In an unconfigured deployment, connecting also cannot resolve the underlying problem. The observed missing setting is local configuration evidence, not proof that the live site is broken.

-> do: redesign the visible access introduction to show a read-only example, explain the configured holding requirement and balance-only encoder check, and show an unavailable state instead of a futile connection action when configuration is invalid.

**F06 | Mobile hierarchy | The first product action appears too far down the page.**

Evidence: the 390px capture puts the header at about 602px tall, the first encoder link at document y=983, and the private link at y=1263; see [mobile full page](assets/2026-09-14/mobile-full.png) and [observations](assets/2026-09-14/observations.json). The wallet action appears before either task. Source ordering is `components/TerminalHeader.tsx:103` followed by `app/page.tsx:130`.

Why it matters: visitors scroll past diagnostics and introductory panels before discovering the actual product action.

-> do: place a clear main task CTA directly after the hero explanation on mobile, with session diagnostics below it.

### P2 moderate

**F07 | Feedback | The workspace status implies an extra command is needed.**

Evidence: `app/page.tsx:41` and `:49` compute conversion output from current inputs automatically, but `:120` displays “AWAITING COMMAND” for valid input. This behavior was reviewed in source, not in an unlocked browser session.

Why it matters: users may look for a missing Convert button even though the result is already present.

-> do: use input-dependent plain status text such as “Enter text to begin” and “Result ready.”

**F08 | Control labeling | Reset loads a specific decoding example.**

Evidence: `app/page.tsx:122` calls `preset(true)`, whose implementation at `:75` sets Decode mode and loads the Genesis block as an offset dump. This behavior was reviewed in source.

Why it matters: pressing Reset while encoding changes the task, format, and input unexpectedly.

-> do: rename the action “Load Genesis example” to match the current operation.

**F09 | Readability | Small technical copy adds to the density.**

Evidence: `app/globals.css:663` sets the intro to 12px and `:1061` sets card paragraphs to 11px. The mobile screenshot shows stacked multiline explanatory text in the pixel font. Gate states also expose “production meme token” and “metadata” language at `components/SecurityGate.tsx:42` and `:48`.

Why it matters: both visual decoding and technical interpretation compete with understanding the next action. The font size alone is not asserted as a WCAG failure.

-> do: establish a readable explanatory-copy style with larger Nokia body text and familiar lead wording, reserving exact technical diagnostics for secondary detail.

### P3 polish

None. Address comprehension and the blocked CTA before decorative refinements.

## evidence index

| section | viewport | screenshot |
|---|---|---|
| Homepage, full page | 1440px | [desktop-full.png](assets/2026-09-14/desktop-full.png) |
| Encoder CTA after click | 1440px | [desktop-encoder-click.png](assets/2026-09-14/desktop-encoder-click.png) |
| Access section | 1440px | [desktop-bottom.png](assets/2026-09-14/desktop-bottom.png) |
| Homepage, full page | 390px | [mobile-full.png](assets/2026-09-14/mobile-full.png) |
| Encoder CTA after click | 390px | [mobile-encoder-click.png](assets/2026-09-14/mobile-encoder-click.png) |
| Homepage with reduced motion | 1440px | [reduced-full.png](assets/2026-09-14/reduced-full.png) |
| Motion toggle off | 1440px | [reduced-motion-off.png](assets/2026-09-14/reduced-motion-off.png) |
| Private-route landing | 1440px | [dead-drop.png](assets/2026-09-14/dead-drop.png) |

The [observations JSON](assets/2026-09-14/observations.json) records page text, section positions, anchor outcomes, viewport widths, and captured errors. Homepage widths matched document widths at 390px and 1440px. Captured console-error arrays were empty. Reduced-motion content remained visible.

## skipped / not verified

- Reviewed a successfully built local production server at `http://localhost:3100`; no deployed URL or deployed Tor transport was verified.
- Local production token settings were missing. The unlocked encoder workspace and its Reset/status behavior were reviewed in source only. No signed wallet journey, balance-qualified production access, deposit/retrieval round trip, or live X post was performed.
- The private-route landing was inspected as a homepage destination, not certified as an operational Onion service or audited for cryptographic security.
- No formal user testing, screen-reader audit, complete keyboard journey, color-contrast measurement, or Web Vitals measurement was performed. Performance and accessibility scores remain provisional.
- Impeccable was unavailable after catalog and local skill discovery, so its technical subscore is omitted. Findings do not rely on it.
- No application files were edited. Existing changes in `app/globals.css` and `lib/share.ts` were preserved. This audit adds review artifacts only.
