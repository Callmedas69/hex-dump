# Token-check recovery

User report: connected wallet and Robinhood mainnet remain on Checking your balance without a result.

- [x] Inspect query state, RPC configuration, installed retry behavior and screenshot.
- [x] Probe the public RPC without signing or sending transactions; record timeout as a local observation, not proof of wallet balance.
- [x] Bound the complete token read to 12 seconds; remove stacked automatic retries and discard cancelled/late results.
- [x] Distinguish active reading, offline/paused, timeout, RPC failure, token mismatch, insufficient balance and verified access.
- [x] Keep retry available after failure and retain successful polling, reconnect behavior, gate requirements and draft preservation.
- [x] Add deadline/cancellation tests and browser scenarios for stalled RPC, stale wallet response and offline recovery.
- [x] Run required checks and configured production browser regressions; restore the original build environment.
- [x] Save findings, evidence and deployment limitations.
