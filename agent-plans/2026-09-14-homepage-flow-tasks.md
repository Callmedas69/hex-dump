# Atomic Tasks: Homepage Flow Refactor

Complete and verify each task before moving to the next.

## 1. Homepage information architecture

- [x] Add a concise plain-language introduction describing encoding and the two sharing choices.
- [x] Replace the single dead-drop promo with two equal public/private destination cards.
- [x] Add an anchor target for the encoder section.

## 2. Public X sharing path

- [x] Label the path “Share encoded hex on X.”
- [x] Explain that X sharing is public and requires USDG access.
- [x] Link the action to the gated encoder workspace.

## 3. Private Onion path

- [x] Label the path “Send a private message through the Onion network.”
- [x] Explain browser encryption, sender-only USDG access, and recipient retrieval with the complete link.
- [x] Link the action to `/dead-drop`.
- [x] Use “Onion” in user-facing copy and reserve “Tor” for a brief technical clarification if needed.

## 4. Responsive presentation

- [x] Preserve the terminal aesthetic while making both cards readable on mobile.
- [x] Ensure cards stack cleanly below the mobile breakpoint and buttons remain full-width and usable.
- [x] Avoid adding technical labels or repeated jargon to the first screen.

## 5. Tests and release

- [x] Add homepage UI assertions for both cards, public X wording, browser encryption wording, sender-only gate wording, and both links.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npx tsc --noEmit`.
- [x] Run `npm run build`.
- [x] Mark completed tasks and commit/push the implementation.
