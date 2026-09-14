# Dead-drop page: focused UX and flow review

Date: 2026-09-14. Review only; no application changes in this pass.

Follow-up: the approved fixes and their verification are recorded in [dead-drop fix verification](2026-09-14_dead-drop-fix-verification.md). The findings below preserve the original review evidence.

The completed homepage plan excluded changes to this route. Its earlier browser pass checked only that shared CSS had not broken the mobile page. This review follows the sender and recipient flows with a mocked deposit/retrieval API and the actual browser encryption code. It does not establish production service availability, Tor delivery or a security certification.

## What needs fixing first

| Priority | Finding and evidence | Recommended action |
|---|---|---|
| Blocking | After sending, the page displays Open message, but clicking it reports a missing key. `app/dead-drop/page.tsx:39` stores the full link in state while the browser remains at `/dead-drop`; `:54` reads the key only from the current URL fragment. Reproduced in the browser. | Give the sender a dedicated success panel with a full-link Open message action that navigates to the actual recipient URL. |
| Blocking | Clipboard failure says Copy the link manually, but no selectable link is rendered. `app/dead-drop/page.tsx:64`, `:71`; browser confirms the full link is absent from visible text. | Always render the complete link in a labeled, read-only selectable field next to Copy link. |
| Major | Recipient URLs generate React error 418 during initial rendering. The server sees no `window` and renders sender content, while the client derives a recipient ID immediately in `app/dead-drop/page.tsx:13`; `[id]/page.tsx` re-exports the same component. Recipient decryption succeeded after recovery, but the rendering error is real. | Pass the route ID from the Next.js route into a shared client component so server and client agree on the initial mode. |
| Major | Recipients still see Write a private message here and transport instructions aimed at senders, even when their only action is Open message. The header at `app/dead-drop/page.tsx:66` is unconditional. | Give recipients an Open a message heading, one clear action and recovery wording for missing keys or expired/unavailable messages. |
| Major | The advertised 16 KiB text limit exceeds what the API accepts after encryption and base64 encoding. A valid 16,384-byte plaintext produces a 21,914-byte envelope; `app/api/drops/route.ts:24` rejects envelopes above 16,896 bytes. The textarea also limits character units rather than UTF-8 bytes. | Align the server envelope-size allowance with the validated plaintext limit and block oversized UTF-8 drafts before sending, with a remaining-byte count. |
| Major | Invitation creation dominates the page even when a sender already has a code. Its labels Message slots and Valid days precede the message composer; the separate 24-hour message expiry is elsewhere. `components/InvitationCreator.tsx:31`, `app/dead-drop/page.tsx:68`, `:72`. | Start with Enter invitation code; offer Create a code as a secondary path with labels Messages allowed and Code expires in, explaining the separate message expiry. |
| Moderate | USDG HOLDER TOOL is hardcoded while server invitation authorization uses a configurable production token policy. The creation panel does not explain the current threshold before requesting a signature. `components/InvitationCreator.tsx:31`, `app/api/invitations/route.ts:27`. | Show the actual configured token requirement and explain that the signature proves wallet ownership without transferring funds. |
| Moderate | The page mentions Onion links unconditionally, while the Copy Onion link control depends on optional configuration. `app/dead-drop/page.tsx:10`, `:66`, `:71`. Existing project instructions also describe Tor as planned. | Show only verified available transport options; keep Tor-specific instructions beside an actual supported Onion option rather than in every visitor's primary flow. |

## Recommended flow

**Sender:** Enter an invitation code (or create one) → write a message → encrypt and create a link → copy or open the complete link.

**Recipient:** Open the complete link → read a short explanation → Open message → read the result, or receive a specific recovery instruction.

Use **Create message link** rather than **Send message** for deposit. The action stores a message and creates a link; it does not deliver anything to a named recipient. Success copy should be **Your message link is ready. Share it with your recipient.**

Before sharing, explain: **Anyone with this complete link can open the message. Keep everything after #; that part contains the decryption key.** The current wording mentions the fragment but does not plainly explain possession of the link grants access.

Keep **Preview encrypted data** in optional technical details. It generates fresh ciphertext locally, so it should not imply those exact bytes are the subsequent submitted payload. Ordinary users need a message preview and a clear next action more than a ciphertext display.

## Evidence and limits

- [Browser observations](assets/2026-09-14-fixes/dead-drop-review.json).
- [Sender after successful deposit and failed clipboard copy](assets/2026-09-14-fixes/dead-drop-sender-after-send.png).
- [Recipient after opening the copied link](assets/2026-09-14-fixes/dead-drop-recipient.png).
- The mock received one deposit request. Actual browser encryption/decryption round-tripped a synthetic message. No real service records, wallet signatures or Tor requests were created.
- The payload-size defect was confirmed by running the existing encryption function and comparing serialized envelope size with the API's source check. No real database-backed oversized request was submitted.
- Invitation signing, database persistence, ambiguous-send retries and deployment transport remain unverified in this focused pass. The current source-string UI test does not exercise the confirmed flow defects.

These findings concern the existing route in the repository. They do not change the project's approved product boundary or justify describing the current overall app as a shipped Onion messaging service.
