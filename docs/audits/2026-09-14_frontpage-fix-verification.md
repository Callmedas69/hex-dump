# Frontpage fix execution record

## Baseline (T01)

- Existing changes: `app/globals.css`, `lib/share.ts`; earlier audit artifacts untracked. Plans are ignored by Git and saved locally.
- CSS baseline saved at `assets/2026-09-14-fixes/globals.before.css`, SHA256 `B7532F15303ABC802DD912CC1E42BAE570C46D347A0446FE1AFC643D98EFCA98`.
- Sharing baseline SHA256 `E254E1A926F3B2CDF1CCA3166BA3A04761D048163229CFBD47EEA53F24E874B0`. Its existing post footer contains a decode link; strict hex-only post wording in AGENTS conflicts with that existing behavior. This UX work preserves the authorized existing serializer and tests and does not add plaintext.
- Baseline `npm test`: 30 passed, 3 database tests skipped, no failures. Baseline lint passed. The preceding audit production build passed.
- Installed Next.js accessibility, linking/navigation and Link API guides consulted. Existing homepage test asserts obsolete Onion cards and needs updating with T05.
- Local production gate is unconfigured. Granted behavior will use an isolated test configuration and mocked wallet/RPC, never a production bypass.
- In-app browser connection was unavailable during the audit; the installed gstack Playwright module and cached Chromium successfully captured production screenshots. Reuse this available test route.

## Execution

Tasks execute sequentially. Final commands, browser outcomes and limitations will be recorded here after implementation.

- T02–T10: shared gate presentation, explicit entry/focus, plain-language hero and sample, task selection, read-only Genesis example, gate states, output feedback, honest sample action and sharing copy implemented. Focused checks and TypeScript passed; status/view tests added.
- T11: screenshots inspected at desktop/mobile sizes; primary action is visible within the 390 × 844 initial viewport. No horizontal overflow at 320/390/768/1440, including the unlocked inspector. Mode controls now use native pressed buttons with keyboard access.
- T12 discovered and fixed an existing chain-state bug: `useChainId()` reported the app's configured network when the wallet switched to an unsupported network. The gate now reads `useAccount().chainId`, so a wallet on another chain locks the workspace and must explicitly switch back to 4663.
- Wallet management remains available in the granted banner after removing the duplicate hero connection prompt.
- CSS preservation verified against the saved baseline: no original CSS lines removed or modified. All new rules are scoped to homepage components. `lib/share.ts` retains its exact baseline hash.

## Final required checks (T13)

| Command | Result |
|---|---|
| `npm test` | Passed: 32 passed, 3 skipped, 0 failed (35 total). The skips require a database. |
| `npm run lint` | Passed, no lint warnings or errors. |
| `npx tsc --noEmit` | Passed. |
| `npm run build` | Passed using unchanged local environment. |

Commands ran in that order after implementation and browser-driven corrections. Existing Node module-type notices remain; no package-wide module-mode change was made for this UX task.

## Browser checks

The configured production pass used process-local public token settings for USDG on chain 4663 and a minimum of 10,000 raw units. Files containing environment settings were not changed. An injected EIP-6963 test wallet and intercepted RPC responses exercised the actual gate; no application bypass was added.

Evidence: [configured browser results](assets/2026-09-14-fixes/browser-results.json), [unconfigured browser results](assets/2026-09-14-fixes/unavailable-results.json), [mobile first screen](assets/2026-09-14-fixes/configured-390-first-screen.png), [desktop](assets/2026-09-14-fixes/configured-1440.png), [mobile workspace](assets/2026-09-14-fixes/workspace-390.png), [sharing preview](assets/2026-09-14-fixes/share-unconfigured.png).

- Main action bottom is approximately **581px** at 390 × 844, compared with the previous first tool link starting at approximately 983px. Its target height is 44px.
- No horizontal page overflow at 320, 390, 768 or 1440px. Unlocked workspace checked at 320, 390, 768 and desktop.
- Keyboard entry reaches the visible access heading, then the selected input after grant. Legacy `#hex-workspace` links route to access while locked.
- Both mode drafts survive balance loss, account changes, RPC failure and successful recovery. Recovery without a pending entry request does not focus the input automatically.
- Unsupported wallet chain locks the workspace; explicit Switch network returns to chain 4663 and restores access. Wrong token metadata and disconnect also lock the workspace.
- UTF-8 failures, incomplete bytes, empty input, output-view help and the renamed Bitcoin sample action were exercised.
- Preview PNG natural dimensions are 1600 × 900. Encode post text excludes test plaintext. Existing PNG renderer unit tests verify plaintext omission in draw operations.
- Unconfigured X offers download/composer instructions; configured but disconnected X offers Connect X without a publishing action. **Zero post requests and zero signing/transaction requests.**
- Reduced motion, Motion off, 200% zoom-equivalent reflow (720 × 500 CSS pixels on a 1440 × 1000 device viewport), and a mobile dead-drop CSS smoke check passed.
- No unexpected browser errors. The test deliberately blocked WalletConnect telemetry/config requests; matching resource failures are recorded separately, not counted as application failures.

## Finding closure

| Finding | Resolution | Evidence |
|---|---|---|
| F01 hidden destination | State-aware entry, visible gate heading and one-time focus after grant | Browser entry, bookmark and access-transition assertions |
| F02 unclear/secrecy-oriented hero | Concrete purpose, Hello sample and reversible encoding explanation | `configured-390-first-screen.png` |
| F03 channel-first flow | Encode/decode task selection with mode intent retained | Browser mode/draft assertions |
| F04 unsupported Onion promise | Active private-sharing promotion removed from homepage | Updated homepage contract test; homepage screenshots |
| F05 premature/unhelpful wallet ask | Read-only example, explicit requirement, honest unavailable/error states | Gate matrix and unavailable build pass |
| F06 mobile hierarchy | Primary action in initial viewport; diagnostics in disclosure | Measured action bottom and 44px height |
| F07 waiting despite completed output | Input/output-aware status with UTF-8 error handling | Status unit tests and browser edge cases |
| F08 misleading Reset | Load Bitcoin example describes retained preset behavior | Browser input-format and bytes assertions |
| F09 readability/jargon | 14px explanatory copy; nearby definitions and view-specific notes | Screenshots, output-help unit tests, keyboard/reflow checks |

## Limits

No real wallet, production credentials, deployed Tor service, live X publication, database persistence, formal user study, screen-reader audit or Web Vitals measurement was used. Browser zoom was tested through an equivalent layout/device-pixel emulation, not the browser toolbar. The local production policy remains unconfigured; this is an existing deployment setup issue, and the new unavailable state is intentional. Tests exercised a configured gate separately without modifying that environment.

## Handoff (T14)

All 14 tasks completed sequentially. README onboarding and verification instructions now match the implemented flow. The earlier homepage plan remains a historical record; the approved UX fix plan supersedes its public/private choice layout. No commit, push or deployment was performed. Required checks and both configured/unconfigured production-browser passes are complete. The final local build uses the original environment.
