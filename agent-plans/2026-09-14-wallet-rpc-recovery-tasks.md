# Recover token checks when the public RPC closes

- [x] Verify the supplied wallet address, official USDG contract, actual balance and reported network error.
- [x] Add a bounded wallet-provider fallback after a failed or stalled website RPC read.
- [x] Preserve account/connector isolation, chain verification, metadata checks and the existing threshold.
- [x] Test closed and stalled connections, wallet recovery, zero balances, wrong metadata, wrong chains and cancellation.
- [x] Run tests, lint, TypeScript, configured production browser regressions and the final build with the original environment.
- [x] Save verification evidence and document the remaining dependency on a working RPC provider.
