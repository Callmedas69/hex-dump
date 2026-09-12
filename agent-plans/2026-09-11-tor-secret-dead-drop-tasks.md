# HEX Secret Dead Drop — Atomic Implementation Tasks

Each task should produce a reviewable change and pass the checks listed before the next dependent task begins.

## 0. Baseline and boundaries

- [x] **0.1 Record the baseline** — Run the existing test, lint, TypeScript, and production-build commands; record results in the task notes.
- [x] **0.2 Define the route boundary** — Decide the dead-drop route namespace and ensure it is isolated from wallet-gated codec routes and X-sharing routes.
- [x] **0.3 Add configuration placeholders** — Add documented Vercel public-domain, onion-domain, Neon `DATABASE_URL`, invitation, payload-limit, and expiry settings to `.env.example`; do not add secrets.

## 1. Data model and persistence (Neon Postgres)

- [x] **1.1 Add the Neon dependency and adapter** — Add `@neondatabase/serverless` and a server-only database module with one migration/bootstrap path suitable for Vercel functions.
- [x] **1.2 Create the drop schema** — Store only version, random drop ID, ciphertext, IV, authentication metadata, creation time, and expiry time; never store plaintext or keys.
- [x] **1.3 Create the invitation schema** — Store a token hash, remaining deposit count, expiry, revoked flag, and timestamps; never store the raw invitation token.
- [x] **1.4 Add transaction helpers** — Implement Neon/Postgres transactions, atomic invitation quota decrement, idempotency lookup, drop insertion, expiry lookup, and safe cleanup.
- [x] **1.5 Test persistence** — Cover restart persistence, duplicate idempotency keys, concurrent quota use, expiry, and cleanup.

## 2. Invitation administration

- [x] **2.1 Implement token generation** — Add a server-only operator command that generates a 256-bit invitation, prints it once, stores only its hash, and accepts count/expiry options.
- [x] **2.2 Implement token verification** — Add constant-time hash comparison, expiry checks, revocation checks, and remaining-count checks.
- [x] **2.3 Implement revocation** — Add an operator command or protected administration action to revoke an invitation by token hash/identifier without exposing the raw token.
- [x] **2.4 Test invitation lifecycle** — Verify valid, expired, revoked, exhausted, malformed, and repeated tokens.

## 3. Browser encryption module

- [x] **3.1 Define the encrypted envelope** — Version the client/server payload and define encoding for ciphertext, IV, and authentication metadata.
- [x] **3.2 Implement AES-GCM encryption** — Use Web Crypto AES-256-GCM with a fresh 96-bit IV and random key per message.
- [x] **3.3 Implement link-key encoding** — Encode the key only in the URL fragment; ensure request URLs and API bodies never contain it.
- [x] **3.4 Implement decryption** — Parse the envelope and fragment key, reject malformed/tampered data, and return plain text only on successful authentication.
- [x] **3.5 Add crypto tests** — Cover Unicode, empty text, maximum size, wrong key, changed ciphertext, changed IV, malformed envelope, and round trips.

## 4. Dead-drop API

- [x] **4.1 Add `POST /api/drops`** — Require an invitation bearer token, enforce the UTF-8 payload limit, validate the envelope, consume quota atomically, and return a drop ID plus expiry.
- [x] **4.2 Add idempotent creation** — Require a client-generated idempotency key scoped to the invitation and return the original result for an identical retry.
- [x] **4.3 Add `GET /api/drops/:id`** — Return ciphertext metadata only when the drop exists and has not expired; never return a key or plaintext.
- [x] **4.4 Add response hardening** — Set `Cache-Control: no-store`, restrictive CORS, consistent unknown/expired responses, and bounded request/response sizes.
- [x] **4.5 Add cleanup** — Run bounded expired-row cleanup on a schedule and before relevant reads without blocking normal requests.
- [x] **4.6 Add API tests** — Cover authorization, limits, replay, idempotency, expiration, malformed input, concurrent requests, and error redaction.

## 5. Dead-drop interface

- [x] **5.1 Add the sender route** — Build the invitation input, text composer, byte/ciphertext preview, expiration display, and deposit action.
- [x] **5.2 Add retrieval route** — Read the fragment key locally, fetch ciphertext by ID, decrypt locally, and render the result as escaped text.
- [x] **5.3 Add link actions** — Generate copyable HTTPS and `.onion` links without replacing the current origin or leaking the fragment to the server.
- [x] **5.4 Add connection indicator** — Detect and label public HTTPS versus onion access without claiming that either mode makes a user untraceable.
- [x] **5.5 Add terminal motion** — Use GSAP for staged entrance/status transitions and CSS for cursor blink; pause on the existing motion toggle and reduced-motion preference.
- [x] **5.6 Isolate providers** — Keep RainbowKit, wallet reads, X code, analytics, and external fonts/resources out of dead-drop route bundles.
- [x] **5.7 Add interface tests** — Cover keyboard flow, mobile layout, loading/error states, safe text rendering, copy actions, and no-wallet access.

## 6. Deployment for both entrances

- [x] **6.1 Configure Vercel and Neon** — Connect the Vercel project to Neon, set `DATABASE_URL` and application settings, and define the API health check.
- [x] **6.2 Provision the AWS EC2 Tor gateway** — Create an eligible Linux EC2 instance (for example, ARM64 `t4g.small` where the account offer applies), configure its security group, SSH access, and billing alarm, then install Tor and configure v3 `HiddenServiceDir` and `HiddenServicePort` to proxy the onion address to the Vercel application.
- [x] **6.3 Protect deployment state** — Persist onion identity with restrictive permissions; keep database credentials in Vercel environment variables and exclude message data from backups.
- [x] **6.4 Document operations** — Document Vercel/Neon setup, Tor gateway setup, invitation generation, rotation/revocation, restart behavior, expiry semantics, and log policy.
- [ ] **6.5 Test both entrances** — Create through HTTPS and retrieve through Tor Browser, then create through Tor Browser and retrieve through HTTPS.

## 7. Release verification

- [x] **7.1 Run automated checks** — Existing tests, new crypto/API/UI tests, lint, TypeScript, and production build all pass.
- [ ] **7.2 Inspect network behavior** — Confirm no plaintext, key, wallet request, X request, analytics request, or third-party request from dead-drop flows.
- [ ] **7.3 Verify security behavior** — Confirm CSP, no-store responses, redacted errors, invitation quotas, and unknown/expired indistinguishability.
- [ ] **7.4 Perform manual accessibility pass** — Keyboard-only sender/retriever flow, focus management, readable errors, and reduced-motion behavior.
- [ ] **7.5 Record launch gate** — Do not advertise the onion URL until both entrances, persistence, expiry, and Tor Browser behavior are verified on the production host.

## Deferred work

- Live chat and presence
- Image/file attachments
- Read receipts
- Multi-device key recovery
- Wallet-gated dead drops
- Public anonymous drop creation
