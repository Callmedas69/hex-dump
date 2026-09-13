# Homepage Flow Refactor Plan

## Summary

Position HEXONION around two equal choices: share encoded hex publicly on X, or send a private encrypted message through the Onion network. Keep the encoder as the shared foundation, but explain the difference between encoding and encryption in plain language before showing technical controls.

Use plain language for headings and descriptions. Introduce technical terms only when they clarify the behavior: hexadecimal, encrypted, HTTPS, Onion, Tor, and USDG.

## Product decisions

- Hex encoding converts text to hexadecimal; it does not hide the text.
- X sharing is public and may include the reviewed PNG.
- Onion dead drops encrypt the message in the browser before delivery.
- USDG access is required for both paths.
- The dead-drop sender needs access to create an invitation and send a message; the recipient opens the complete link without a wallet.
- Lead with “Onion network” and “Onion link” for users. Mention Tor only as the technical name once where useful.

## Homepage changes

- Keep the terminal visual identity, olive palette, Nokia fonts, and session panel.
- Replace the single dead-drop promo with two equal destination cards.
- Add a plain-language introduction: “Turn words into Bitcoin hex in your browser. Then choose how to share it: publicly on X or privately through the Onion network.”
- Add “Share encoded hex on X” with a short explanation that the result is public, the PNG can be reviewed, and USDG access is required. Link to the encoder section.
- Add “Send a private message through the Onion network” with a short explanation that the browser encrypts the message, the sender needs USDG access, and the recipient needs only the complete link. Link to `/dead-drop`.
- Keep the existing encoder `SecurityGate` and dead-drop invitation authorization.

## Scope and validation

Update `app/page.tsx`, `app/globals.css`, and homepage UI tests. Reuse existing components and make no database, API, encryption, X, Tor, or dependency changes. Run `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`.
