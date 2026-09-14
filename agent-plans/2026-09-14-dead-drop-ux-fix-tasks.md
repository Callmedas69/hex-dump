# Dead-drop UX fixes

Authorized by Harry's “fix it” following the focused dead-drop review. Implement tasks sequentially; preserve the homepage work and signed invitation authorization.

- [x] 1. Pass recipient identity from the server route into a shared client workspace; remove browser-derived initial render state.
- [x] 2. Separate compose, sender-success and recipient views with plain-language instructions and accurate create-link labels.
- [x] 3. Show the complete selectable link, working Open message URL, clipboard fallback, local expiry and link-key access explanation.
- [x] 4. Put code entry first and optional wallet creation inside a disclosure; show configured holdings and distinct code/message limits.
- [x] 5. Count UTF-8 bytes and align server allowance with encryption/base64 overhead; verify the maximum boundary.
- [x] 6. Preserve the encrypted request during retries; allow last-slot recovery only for an existing live request under a valid invitation.
- [x] 7. Provide missing-key, wrong-key, expired/unavailable and network/service recovery; distinguish service failure from missing messages.
- [x] 8. Replace misleading random ciphertext previews and unconditional Onion claims with optional explanations; preserve motion accessibility and mobile readability.
- [x] 9. Finish browser and required repository checks; save verification and evidence.
- [x] 10. Follow-up: expose Dead drop in homepage navigation and a public explanation with invitation, sharing and recipient instructions; verify both entry paths without wallet access.

Evidence: `docs/audits/2026-09-14_dead-drop-fix-verification.md`. No deployment, live wallet signatures or real messages are part of this fix pass.
