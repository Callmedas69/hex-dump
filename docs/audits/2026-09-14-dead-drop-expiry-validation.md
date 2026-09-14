# Dead-drop expiry validation

Verdict: **Partially meets the intended behavior.** Expired messages are excluded from retrieval, but database deletion is traffic-driven and already-open messages are not cleared at expiry. Do not promise that everything vanishes at the expiry timestamp.

## Evidence

| Requirement | Finding | Evidence |
| --- | --- | --- |
| New access stops at expiry | Implemented in server code | `lib/server/deadDropDb.ts:82` selects only `expires_at > NOW()`. The retrieval handler returns a non-cacheable 404 for no matching drop. |
| Stored ciphertext is deleted at expiry without traffic | Fails | Cleanup is invoked by deposit/retrieval, at most 100 expired rows each time. No cron is configured in `vercel.json`; no `pg_cron` or `pg_timetable` extension was present in the inspected database. External schedulers were not independently inspected. |
| No expired rows remain | Fails at inspection | Read-only aggregate query at 2026-09-14 06:18:04 UTC found 3 rows: 2 active and 1 expired. The expired row's deadline was 05:21:44 UTC, roughly 56 minutes earlier. No contents, keys or row IDs were read. |
| Already-open message disappears at expiry | Fails | With real browser encryption and a simulated API, advancing the browser clock beyond expiry left the plaintext visible and triggered no further reads. Reloading and opening again showed the simulated expired response correctly. |
| No app message history or recovery | Implemented in inspected code | Message/link state lives in React memory. No message history or saved-key feature was found. The synthetic browser run stored wallet-library settings, but no message history, in browser storage. The complete key-bearing URL can still exist in browser history or recipient copies. |
| Deleted records cannot be restored from storage history | Unverified | Neon restore-window, snapshot, branch and backup settings were not inspected. Application row deletion alone does not establish physical erasure from these layers. |

The database connection came from the local environment. Its identity relative to the deployed production database was not independently verified. Live database checks were read-only; no cleanup, schema changes, or live message creation/retrieval was performed.

## Verification performed

- 9 focused API-handler, envelope and encryption tests passed.
- `tests/browser/dead-drop-expiry-audit.mjs` reproduced retained plaintext after expiry and correct expired-response handling on reopening, with no page errors.
- Read-only database aggregates confirmed expired ciphertext remains in the active table after its deadline.
- The browser test used intercepted API responses; it does not establish the deployed API's behavior. The server expiry constraint was verified in source.
- No product implementation, deployment settings or live data were changed. The unrelated `lib/share.ts` edit remains untouched.

Evidence: [database counts](assets/2026-09-14-dead-drop-expiry/database-counts.json), [browser results](assets/2026-09-14-dead-drop-expiry/browser-results.json), [open message after expiry](assets/2026-09-14-dead-drop-expiry/opened-message-after-expiry.png), [reopened expired link](assets/2026-09-14-dead-drop-expiry/expired-link-reopened.png).

## Required follow-up

1. Define an honest deletion target separate from the exact access deadline, then implement scheduled cleanup with enough batch capacity and failure monitoring. A periodic job cannot promise deletion at the exact expiry instant.
2. Clear rendered plaintext, generated link/key state and related controls when their deadline passes; also recheck on tab focus/visibility restoration. This cannot erase copies saved by recipients or guarantee memory wiping.
3. Inspect the actual production Neon restore window, snapshots and branches before setting a retention promise. [Neon's project documentation](https://neon.com/docs/manage/projects) explains restore windows; [its snapshot documentation](https://neon.com/blog/three-ways-to-use-your-snapshots) explains that snapshots may persist beyond the history window.
4. Verify expiry boundary, idle-service cleanup, batches exceeding 100 messages, scheduler failure/retry and already-open tab behavior before updating public claims.

Safe current wording: **“Links stop working after 24 hours. Recipients may keep copies of messages they have already opened.”** Do not claim immediate or irreversible deletion yet.
