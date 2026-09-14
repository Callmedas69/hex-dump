# Homepage coherence fixes: verification

Approved from the [focused review](2026-09-14_homepage-message-coherence-review.md). Implemented 2026-09-14.

## Result

The hero now introduces both tools: **Work with hex. Share private messages.** It offers two peer choices before wallet access: **Explore hex tool** and **Open Dead drop**. Each choice describes its purpose and access model. Hex is explicitly described as reversible, while Dead drop is described as encrypted message links with a 24-hour expiry.

The Hello example, encode/decode choices, Bitcoin example and wallet details now form one continuous hex section. The long standalone Dead drop walkthrough was removed from the homepage; sender, recipient, key and invitation instructions remain on `/dead-drop`. Generic hero access diagnostics and the codec-only workflow ruler were removed. Root metadata and the footer describe both tools. Access errors identify the hex converter.

The header renders independently of the converter's access presentation. Entering the hex section focuses its heading. Encode/decode actions retain the existing gate entry and draft behavior. No authorization logic was changed in this pass.

## Checks

- `npm test`: 37 passed, 3 database integration tests skipped, no failures.
- `npm run lint`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed with temporary configured token settings and again with the unchanged original local environment.
- `git diff --check`: passed. Existing `lib/share.ts` retains its original session hash.
- Configured production browser suite: passed navigation, keyboard focus, legacy fragment entry, wallet connection, chain switching, balance/RPC/metadata failures, draft recovery, inspector controls and 1600×900 sharing previews.
- Final unconfigured production browser suite: passed both tool entries and return navigation, heading focus, read-only Bitcoin example, explicit hex access errors, reduced motion, Motion off and 200% zoom-equivalent reflow.
- No unexpected browser errors, live signatures, transfers or X posts. Wallet/RPC responses were simulated; known WalletConnect telemetry/config requests were intentionally blocked.

## Final layout measurements

Both tool actions have 44px minimum targets. At each tested size both actions appear in the initial viewport. No horizontal page overflow was found.

| Viewport | Bottom of lower tool action |
|---|---|
| 320×844 | 827px |
| 390×844 | 760px |
| 768×1024 | 578px |
| 1440×1000 | 575px |

The final narrow-screen spacing refinement was checked in the unconfigured pass; the hero and choice layout does not depend on wallet configuration.

Evidence: [configured flow results](assets/2026-09-14-homepage-two-tools/browser-results.json), [final layout and unconfigured results](assets/2026-09-14-homepage-two-tools/unavailable-results.json), [mobile first screen](assets/2026-09-14-homepage-two-tools/unavailable-390-first-screen.png), [desktop page](assets/2026-09-14-homepage-two-tools/unavailable-1440.png).

## Limits and handoff

This verifies local production builds with browser test doubles, not production service availability or a user study. The three database tests need a configured test database. Recipient metadata, encryption, invitation authorization and database behavior were preserved. No environment files were edited. No commit, push or deployment was performed.

The completed atomic task list is saved in `agent-plans/2026-09-14-homepage-two-tools-tasks.md`.
