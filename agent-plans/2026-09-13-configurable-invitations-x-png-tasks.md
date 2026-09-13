# Atomic Tasks: Configurable Invitations and PNG X Sharing

Each task should be completed and verified before the next dependent task begins.

## 1. Configurable token policy

- [ ] Centralize production token configuration parsing and validation.
- [ ] Remove production reliance on hardcoded contract, symbol, decimals, or threshold values.
- [ ] Keep chain ID `4663` as the only accepted production network.
- [ ] Keep development USDG policy explicit and separate.
- [ ] Update `.env.example`, README, and deployment documentation for environment-only token changes.
- [ ] Test missing, malformed, changed-address, changed-decimal, changed-symbol, threshold, and wrong-chain settings.

## 2. Signed wallet authorization

- [ ] Add `POST /api/invitations/challenge` for one-time wallet nonce issuance.
- [ ] Add Neon storage for nonce, wallet address, expiry, consumed state, and timestamps.
- [ ] Add server-side signature verification with `viem`.
- [ ] Verify Robinhood Chain mainnet and configured ERC-20 balance through the RPC.
- [ ] Reject invalid signatures, wrong wallets, wrong chains, expired nonces, replayed nonces, RPC failures, and insufficient balances.
- [ ] Add authorization and replay tests.

## 3. User invitation creation

- [ ] Add `POST /api/invitations` with server-side count and validity limits.
- [ ] Generate a cryptographically random token and store only its SHA-256 hash.
- [ ] Add a wallet-gated invitation creation panel with one-time display and copy controls.
- [ ] Explain that the invitation authorizes depositing while the complete link authorizes retrieval.
- [ ] Preserve operator CLI generation and revocation.
- [ ] Test quotas, expiry, revocation, malformed requests, token secrecy, and repeated submissions.

## 4. X PNG publishing

- [ ] Confirm the generated PNG remains 1600×900 and matches the reviewed draft.
- [ ] Upload the PNG through X media API before creating the post.
- [ ] Create one post with reviewed text and returned media ID.
- [ ] Preserve explicit confirmation and duplicate-submit protection.
- [ ] Preserve download/composer fallback when direct credentials are unavailable.
- [ ] Add tests for upload ordering, media attachment, failures, and idempotency.
- [ ] Replace memory-only X session/idempotency storage before production serverless use.

## 5. Dead-drop end-to-end behavior

- [ ] Verify sender encryption remains browser-local.
- [ ] Verify only ciphertext metadata is stored in Neon.
- [ ] Verify onion and HTTPS links retain the key only in the fragment.
- [ ] Verify Jean can open the complete onion link in Tor Browser.
- [ ] Verify retrieval decrypts locally and no plaintext or fragment key reaches requests or logs.

## 6. Release and operations

- [ ] Configure final token variables in Vercel Production.
- [ ] Configure server-side RPC and token policy values.
- [ ] Verify invitation creation through HTTPS and onion access.
- [ ] Verify a real X post with text and PNG using authorized credentials.
- [ ] Run tests, lint, TypeScript, production build, network inspection, and accessibility checks.
- [ ] Record completed tasks and deployment evidence in the project plans.
