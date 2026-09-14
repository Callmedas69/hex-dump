# Dead-drop UX fix verification

Date: 2026-09-14. Scope: the existing dead-drop sender and recipient routes, following Harry's approval to fix the [focused review](2026-09-14_dead-drop-ux-review.md).

## Changes

- Sender flow: invitation code → write message → create link → copy/share. Optional wallet code creation is inside a disclosure.
- Sender success always includes a selectable complete link, clipboard fallback, an actual full-link Open message action, local expiry, and clear instructions to save/share the link.
- Recipient identity comes from awaited server route parameters. The first render agrees on sender versus reader, and recipients see no wallet or invitation form.
- Recovery copy distinguishes incomplete links, missing or wrong keys, expired/unavailable messages and connection/service failures. Retrieval service failures return 503 instead of misleading 404 responses.
- UTF-8 byte counts prevent oversized drafts from being submitted. The API accepts the 21,914-byte encrypted envelope produced by a full 16,384-byte message, including the GCM tag and base64 expansion. Envelope validation strips unrelated fields and bounds the encoded strings before decoding.
- Retries reuse the same encryption key, ciphertext and request identifier while the draft/code remain unchanged. An exhausted invitation can recover its existing, unexpired request; revoked and expired invitations remain rejected.
- Invitation creation displays the configured token threshold on Robinhood Chain mainnet, explains the signature, validates integer limits, and separates code expiry from each message's 24-hour expiry.
- Removed the fresh, potentially stale ciphertext preview and unconditional alternate Onion-link advertising. Optional privacy details explain AES-256-GCM, ciphertext, key fragments, forwarding and expiry limits. The generated link uses the current site's origin.
- Scoped olive/Nokia styling preserves the terminal design, keyboard focus, readable mobile controls and reduced-motion behavior. GSAP animations are cleaned up and respond to the system motion preference.

## Verification

| Check | Result |
|---|---|
| `npm test` | 37 passed, 3 database integration tests skipped; no failures |
| `npm run lint` | Passed |
| `npx tsc --noEmit` | Passed |
| `npm run build` | Passed; final build restored to the original local environment |
| `tests/browser/dead-drop.mjs` | Passed with real browser crypto and intercepted API requests |
| Configured invitation copy | Passed with a temporary build showing **at least 2.5 QA** on chain 4663; invalid-limit feedback checked |
| Unconfigured invitation copy | Explains creation is unavailable while allowing existing-code composition |
| Homepage regression | `tests/browser/homepage.mjs --unavailable` passed, including dead-drop shared-style smoke |
| Browser errors | No page errors or React hydration errors in the dead-drop suite |

Browser coverage includes 320/390/768/1440px layouts without horizontal overflow, a Unicode encrypt/decrypt round trip, a lost-response retry with identical request body, successful and denied clipboard access, full-link navigation, recipient keyboard focus, byte-limit boundaries, invalid IDs, missing/wrong keys, 404/503/network errors, successful retry after failure, and reduced motion.

`tests/deadDropHandlers.test.mjs` executes the actual route-handler source with simulated database dependencies. It verifies maximum-size acceptance, malformed-size and invitation rejection, 404 versus 503 responses, and the actual invitation-verification function's last-slot recovery, revocation and expiry handling. This does not exercise live SQL transactions.

## Evidence and limits

Discovery follow-up: the homepage now includes a Tools navigation link and a public Dead drop introduction before the converter choices. It explains invitation codes, browser encryption, 24-hour expiry, complete-link sharing and wallet-free retrieval. Both entry links sit outside the converter access gate. The homepage browser suite passed navigation by keyboard, return-home navigation and the introduction CTA with access unconfigured, plus 320/390/768/1440px reflow and reduced motion. Tests (37 passed, 3 database skips), lint, TypeScript and production build passed again. Updated homepage screenshots and results are in `assets/2026-09-14-fixes/`.

- [Browser results](assets/2026-09-14-dead-drop-fixes/results.json) and [configured-policy results](assets/2026-09-14-dead-drop-fixes/configured-results.json).
- [Mobile sender](assets/2026-09-14-dead-drop-fixes/sender-390.png), [sender success and clipboard fallback](assets/2026-09-14-dead-drop-fixes/sender-success.png), [opened recipient message](assets/2026-09-14-dead-drop-fixes/recipient-open.png), [configured invitation help](assets/2026-09-14-dead-drop-fixes/configured-invitation-help.png).
- All browser messages/codes were synthetic. No live deposits, wallet signatures, token transfers, X posts or Tor requests were made.
- Live Neon persistence tests were skipped because `DATABASE_URL` was not configured in the test process. Deployment availability, live invitation authorization and Tor delivery remain unverified.
- Temporary production-token settings were process-local; environment files were not edited. Existing homepage changes and the user's `lib/share.ts` changes were preserved.
- Tasks are saved in `agent-plans/2026-09-14-dead-drop-ux-fix-tasks.md`. This work was not committed, pushed or deployed.
