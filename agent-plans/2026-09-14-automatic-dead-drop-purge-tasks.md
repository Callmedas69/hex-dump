# Automatically purge expired dead drops

- [x] Confirm the expiry gap, deployment constraints and Next.js route conventions.
- [x] Implement authenticated, bounded batch cleanup using database time and safe concurrent execution.
- [x] Add the user-selected GitHub Actions schedule, authenticated requests, retries and activation instructions.
- [x] Configure matching CRON_SECRET values in Vercel production and GitHub Actions repository secrets.
- [x] Add the matching CRON_SECRET to the Git-ignored local .env as requested.
- [ ] Commit/push, deploy and verify unattended runs.
- [x] Clear expired plaintext and link/key state in open tabs, including resumed tabs and late responses.
- [x] Verify expired-only deletion, batches over 100, repeat/failed jobs, auth rejection and browser expiry.
- [x] Run tests, lint, TypeScript and production build; save evidence and deployment status.

Access ends at the stored deadline. Scheduled database purging runs independently of visitors; scheduler delays and storage backups prevent a claim of instantaneous physical erasure. No history or recovery feature will be added.

The user selected GitHub Actions and accepted approximate expiry timing. The workflow is configured for every five minutes and can be triggered manually after it reaches the default branch. Vercel API inspection confirmed Hobby for the hex-dump project, so no Vercel cron is added. Matching secrets were configured on September 14, 2026. At the user's request, the same secret was also saved to the Git-ignored local .env; its value was never printed or placed in tracked files. Commit/push, deployment and verification of unattended runs remain outstanding.
