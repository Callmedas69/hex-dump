# Automatic purge implementation verification

Status: **Code and GitHub Actions workflow verified; matching production/repository secrets configured. Push, deployment and unattended-run verification remain outstanding.**

## Implemented

- `GET /api/cron/purge-drops` requires a server-only secret of at least 32 characters, compared with a timing-safe comparison. Missing configuration returns 503 and invalid authorization returns 401 before database access. HEAD returns 405 without running cleanup.
- The handler purges only expired database rows, in up to twenty batches of 1,000, with a 45-second request deadline and 60-second function limit. PostgreSQL time controls the deadline; row locks and `SKIP LOCKED` protect overlapping runs. A repeat invocation is safe.
- Remaining expired rows produce a 503 response and generic log so a scheduler can retry/alert. Exceptions do not disclose database credentials or message data. Responses contain only counts and completion state.
- Sender and recipient pages clear message/link state at expiry and remove the current URL fragment. They recheck on focus, visibility changes and pageshow, and reject malformed expiry, already-expired responses and decryption that finishes after expiry.
- No message history or recovery was added. Saved recipient copies, other browser-history entries and storage backups cannot be erased by this UI behavior.

## Verification

- `npm test`: 46 passed, 4 opt-in database tests skipped, no failures.
- The new purge tests were also run separately with an explicit database test URL: all 3 passed. The actual purge SQL ran inside transaction-scoped temporary tables, deleted 1,202 expired rows over two batches, preserved the live row, and deleted zero on the third run. No application message rows were changed.
- Lint, TypeScript and production build passed.
- New production-browser expiry regressions passed: recipient plaintext/key clearing, sender link clearing, resumed tabs, invalid expiry, late responses and delayed decryption. [Results](assets/2026-09-14-automatic-purge/browser-results.json), [recipient expiry](assets/2026-09-14-automatic-purge/recipient-expired.png), [sender expiry](assets/2026-09-14-automatic-purge/sender-expired.png).
- The existing dead-drop browser suite also passed encryption/decryption, retry identity, copy fallbacks, error recovery, responsive layout and reduced-motion checks. Its API fixture now includes the required expiry field.
- GitHub Actions workflow YAML and its actual inline Node script passed isolated checks for schedule, permissions, authentication, redirects, successful completion, three-attempt retries, invalid results and missing secrets. No production purge was called by these checks.

## Activation remaining

Read-only Vercel API inspection confirmed the `hex-dump` project uses Hobby. [Hobby only permits daily Vercel cron jobs](https://vercel.com/docs/cron-jobs/usage-and-pricing). A frequent Vercel cron was deliberately not inserted into `vercel.json`, as that would block deployment.

The user selected GitHub Actions and accepted approximate expiry timing. `.github/workflows/purge-expired-drops.yml` schedules the production endpoint every five minutes, offset to minutes 2, 7, 12 and so on. It allows manual dispatch, prevents overlapping workflow runs, uses no third-party actions, grants no GitHub token permissions, and retries failure up to three times before marking the run failed.

Matching `CRON_SECRET` values were successfully configured in Vercel's production environment and the GitHub repository's Actions secrets at 2026-09-14T07:09:23Z. A fresh random secret was created in memory; GitHub received a libsodium-encrypted value. At the user's subsequent request, the same value was saved to the Git-ignored local `.env` and verified to match production. Neither plaintext nor credentials were printed or written to tracked files.

Next: push the tested code and workflow to the default branch, confirm the Vercel production deployment uses the secret, trigger a smoke check, and observe unattended runs. No recurring purge is running as a result of this implementation yet. [GitHub documents potential scheduling delays and automatic disabling after 60 days without activity in a public repository](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule). Enable workflow failure notifications and monitor continued execution. Access remains blocked at expiry while physical deletion follows a successful purge run; there is no promise of instantaneous physical erasure or removal from database restore history.

Only the cleanup secret was added to production configuration. No live message records were changed, and no commit, push or deployment was made. The existing `lib/share.ts` edit remains untouched.
