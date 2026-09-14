# Wallet RPC recovery

## Confirmed cause

The user supplied `net::ERR_CONNECTION_CLOSED` for the website's public Robinhood RPC. The previously shipped deadline fixed the endless loading state, but the check still depended entirely on that connection. Connecting a wallet did not make token reads use the wallet's provider.

A fresh read-only probe on September 14, 2026 succeeded from this environment: `eth_chainId` returned `0x1237` (4663), the configured USDG contract returned symbol `USDG`, decimals `6`, and balance `501403` raw units for the user-supplied address. That is **0.501403 USDG**, above the 0.01 USDG requirement. This confirms the balance at the time of the read; it does not establish that the endpoint is consistently reachable from the user's browser. The explorer API returned an HTTP 403 challenge, so it was not used to establish the balance.

[Paxos documents the configured USDG contract](https://docs.paxos.com/guides/stablecoin/usdg/mainnet). [Robinhood documents the mainnet configuration and production RPC providers](https://docs.robinhood.com/chain/connecting/).

## Fix

- If the website RPC rejects or has not completed within six seconds, use the connected wallet provider to read the same contract's balance, decimals and symbol.
- Keep the complete check bounded to twelve seconds, including wallet-provider lookup and reads. Preserve cancellation and discard late primary results.
- Check the actual wallet provider's chain before and after reads. Include the connector identity in the query key, alongside account and token policy.
- Keep successful zero balances and metadata mismatches authoritative; fallback only follows a failed read. All existing holding requirements remain enforced.
- Use only read-only wallet calls. No signatures, transfers, or network changes are introduced by the fallback.

## Verification

- `npm test`: 44 passed, 3 database integration tests skipped, 0 failed.
- `npm run lint`, `npx tsc --noEmit`, configured production build and final production build with the original environment: passed.
- `tests/browser/homepage.mjs --flow-only --wallet-rpc`: passed. The browser simulates `ERR_CONNECTION_CLOSED` and recovers through the wallet with 0.501403 USDG. The actual live balance probe above is separate from these test doubles.
- A stalled primary RPC recovered through the wallet in 6,528ms. Zero balance and mismatched metadata stayed locked; a wallet provider reporting another chain was rejected before balance reads.
- Existing deadline, account-switch cancellation, offline/reconnect, draft, network, sharing and navigation regressions passed. No unexpected browser errors, signatures, transfers or live posts.
- Evidence: [browser results](assets/2026-09-14-wallet-rpc/browser-results.json), [recovered access](assets/2026-09-14-wallet-rpc/wallet-recovered.png).
- The user confirmed the balance checker works after this fix.

## Limits

Recovery requires the connected wallet to support `eth_call` through a working Robinhood provider. If the wallet uses the same unreachable RPC, both paths can fail; the UI stays locked and offers retry. A dedicated production RPC remains preferable. No environment files or provider credentials were changed. The unrelated `lib/share.ts` edit was preserved.
