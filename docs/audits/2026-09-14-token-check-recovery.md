# Token balance check: investigation and recovery

## Findings

The supplied screenshot shows both wallet connection and Robinhood mainnet checks complete. The token-read stage remains active and disables Check again.

The previous implementation used `useReadContracts` with one query retry, a 30-second polling interval, and the transport defaults. Installed viem defaults to a 10-second HTTP timeout and three transport retries; installed wagmi can also fall back from multicall to individual reads. No overall deadline bounded these layers. `isPending` was presented as Checking even for a paused/offline query. These are confirmed code paths, not proof of the exact cause on the user's device.

A read-only probe of `https://rpc.mainnet.chain.robinhood.com` failed to complete from this environment. The outside-sandbox `eth_chainId` probe timed out after 10 seconds. Earlier node probes reset or timed out. No wallet balance was requested or inferred from those failures.

[Robinhood's official connection documentation](https://docs.robinhood.com/chain/connecting/) confirms chain 4663 and the public endpoint, and describes public endpoints as rate-limited and unsuitable for production. This observation is consistent with a stalled RPC read, but does not establish a global outage or the user's holdings.

## Changes

- `lib/tokenCheck.ts` bounds the complete read to 12 seconds. Cancellation and late results cannot resolve an already-failed check or authorize a different wallet.
- `app/providers.tsx` sets an 8-second HTTP timeout and disables transport retries.
- `components/SecurityGate.tsx` uses a query keyed by the connected account, network and complete token policy, with automatic query retries disabled.
- Active reads show progress, paused queries show an offline message, and timeouts/RPC failures offer Check again. Network failure is never presented as a zero balance.
- Successful checks retain 30-second polling. Failed checks stop periodic retries; focus/reconnect and deliberate retries can recover.
- Existing metadata checks, inclusive 0.01 USDG threshold, chain 4663 restriction, wallet switching, draft preservation and client-only gate boundary remain intact.

## Verification

- `npm test`: 40 passed, 3 database integration tests skipped. New tests cover success, RPC errors, overall timeout, late results and cancellation.
- `npm run lint` and `npx tsc --noEmit`: passed.
- Configured production build and `tests/browser/homepage.mjs --flow-only --token-check`: passed.
- A deliberately stalled RPC became actionable in 9,072ms, including wallet connection. The workspace stayed locked.
- Retrying and switching to a zero-balance account remained locked even when the old account's delayed response arrived.
- A positive balance recovered access. Offline/reconnect showed the correct state and preserved the draft.
- Existing wallet/RPC/metadata error paths, chain switching, sharing preview, route navigation, keyboard focus and reduced-motion checks passed. No unexpected browser errors or live posts/signatures/transfers.
- The final production build passed using the original local environment. Temporary public test settings were process-local; environment files were not edited.

Evidence: [browser results](assets/2026-09-14-token-check/browser-results.json), [actionable RPC failure](assets/2026-09-14-token-check/rpc-unavailable.png), [offline state](assets/2026-09-14-token-check/offline.png).

## Deployment requirement

This fixes the stuck checking state. Actual balances still require a responsive RPC. Configure `NEXT_PUBLIC_ROBINHOOD_RPC_URL` with a production provider and rebuild/redeploy if the public endpoint remains unreliable. The user's full wallet address and balance were not verified. No provider credentials or deployment settings were changed. The existing `lib/share.ts` edit remains untouched.
