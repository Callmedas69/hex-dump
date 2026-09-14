# HexOnion

Two browser tools: a hex encoder/decoder for text and Bitcoin byte inspection, and Dead drop for encrypted message links that expire after 24 hours. The hex converter uses a client-side token holding gate; Dead drop requires an invitation code to create a link and only the complete link to read it. Hex is reversible encoding: anyone can decode it, so it does not keep a message secret. The byte grid follows the [original screenshot](agent-plans/references/bitcoin-hex-dump-inspiration.png).

The app and share PNG retain the [green LCD reference](agent-plans/references/lcd-style-inspiration.png) palette: olive surfaces, near-black text, square controls, and a subtle static pixel grid. The homepage introduces both tools with **Explore hex tool** and **Open Dead drop** entry points. The hex section contains the Hello example, encode/decode actions, **Hex tool access details**, and a read-only Bitcoin Genesis example that needs no wallet. Detailed private-sharing instructions stay on the Dead drop page. Titles use `public/Nokian_title.ttf`; body text uses `public/nokiafc22-body.ttf`, including the wallet UI and PNG export. Encode exports omit the original plaintext.

## Local development

Use Node 22.18+ (or Node 24) and npm.

```sh
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and configure the desired options. For a wallet-free local preview, set `NEXT_PUBLIC_ENABLE_DEV_BYPASS=true`, restart the dev server, then choose **Enter development sandbox**. The bypass is disabled in every production build.

Development requires **at least 0.01 USDG on Robinhood Chain mainnet** (chain ID **4663**). The default profile is `robinhood-mainnet`; old `sepolia` and `mainnet` profile values are invalid. The [Paxos USDG token](https://docs.paxos.com/guides/stablecoin/usdg/mainnet) is `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`, with six decimals: the inclusive threshold is **10,000 raw units**. This is a token holding check at USDG's dollar denomination, not a live USD price oracle. Reads do not transfer funds. The gate reads balance, decimals, and symbol and rejects metadata mismatches or RPC errors.

RainbowKit uses [Robinhood's mainnet configuration](https://docs.robinhood.com/chain/connecting/): ETH for gas, `https://rpc.mainnet.chain.robinhood.com` for public RPC, and `https://robinhoodchain.blockscout.com` for the explorer. Set `NEXT_PUBLIC_ROBINHOOD_RPC_URL` to use your own provider.

RainbowKit connects injected wallets without a WalletConnect project ID. Configure `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` to enable its standard mobile/remote wallet options. Optional RPC URL settings are documented in `.env.example`; browser RPC keys should be restricted by origin.

## Production token policy

Set every `NEXT_PUBLIC_MEME_TOKEN_*` value before building. The only supported network is **Robinhood Chain mainnet (4663)**. A missing, invalid, or unsupported production policy keeps the workspace locked and shows **Access unavailable** without a futile wallet-connection prompt. The read-only example stays available. Visitors cannot change the gating token. To replace USDG with the final token, change the address, symbol, decimals, and raw threshold in Vercel and redeploy; no application code change is required.

Balances are compared as bigint values in the smallest token unit. A positive minimum is inclusive; a zero minimum still requires a positive balance. The gate refreshes every 30 seconds, on focus, and on reconnect. Account/network changes select a new query; disconnects and failed checks revoke the displayed workspace.

This is a **client UI access gate**. Local conversion code is shipped to the browser and is not a secret or a server-enforced paywall. Server capabilities requiring wallet ownership would need separate signed authentication.

## Conversion

Run `npm run dev` and open the local URL printed in the terminal. Choose **Encode text** or **Decode hex**, then follow **Check wallet access**. Development requires at least 0.01 USDG on Robinhood Chain, or the explicit development sandbox described above; production shows its configured requirement. The balance check does not transfer funds. After access is granted, the selected mode opens and the input receives focus. Wallet controls remain available in the verified-access banner.

In Encode mode, replace **Your message** with your text. The byte grid and **ENCODED HEX** update as you type; for example, `Hello` becomes `48 65 6c 6c 6f`. Use **Copy output** or **Preview sharing** to review the text and 16:9 image. Decode mode explains ASCII, UTF-8 and row positions next to the controls. **Load Bitcoin example** replaces the inputs with the Genesis example and selects Decode; **Clear** clears only the active input. Switching modes and temporary access failures preserve both drafts.

- Encode uses UTF-8, including emoji and Unicode.
- Raw hex accepts whitespace and preserves leading zero bytes.
- Offset dump accepts eight-digit addresses followed by separate two-digit bytes. Nonfinal rows contain 16 bytes; addresses must be contiguous. Addresses never become payload.
- An incomplete final byte produces a warning and blocks sharing.
- ASCII inspection displays bytes outside 32–126 as dots. UTF-8 reports malformed sequences.
- The full Genesis example is 285 bytes. Both its header hash and transaction hash are checked against [Bitcoin Core](https://github.com/bitcoin/bitcoin/blob/master/src/kernel/chainparams.cpp).
- The 69-byte newspaper message begins at offset 131. Generic printable-text discovery also includes the preceding `0x45` byte (the letter E); it preserves byte truth instead of silently stripping it.
- Input is limited to 64 KiB. Large byte grids are paginated. Conversion remains local until the user explicitly shares.

GSAP handles the command entry, staged terminal details, activity bars, and workspace reveal with cleanup and reduced-motion support. The cursor blink and simple hover effects use CSS. **Motion on/off** pauses the terminal effects; reduced-motion preferences suppress them automatically. Access messages follow actual wallet/chain/balance states. Sound is optional and off initially.

## Sharing to X

The share dialog freezes the selected bytes and generates a **1600 × 900 PNG**. The preview is the exact exported image. Decode cards pair readable text with source hex and highlight selected bytes. Both modes preserve offsets and label excerpts.

**Encode sharing:** the PNG contains a hex grid without the original plaintext. The current post text contains space-separated hex bytes followed by a decode link and is read-only in the preview; edit the source message in the encoder to regenerate it. Long messages use a complete-byte excerpt to fit X's 280-character limit, including the link. The existing link footer is preserved by the frontpage UX changes. Decode sharing retains its readable-text panel and editable caption. Sharing on X is public, and hex can be decoded by anyone.

**Without X credentials:** download the PNG, copy/edit the post text, and open the X composer. Attach the PNG manually. Opening the composer never reports a post as published.

**Direct posting:** configure an X confidential web application with OAuth 2.0 and an exact callback URL `/api/x/callback`. Set `X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_REDIRECT_URI`, and `X_SESSION_STORE=memory`. Production callback URLs require HTTPS. Requested scopes are `tweet.read users.read tweet.write media.write`; no offline/refresh permission is requested.

The user connects X in a separate tab, returns to the preview, chooses **Check connection**, then explicitly presses **Post to X**. The server uploads the PNG and creates a post with its media ID. Only a confirmed response produces a post URL. [X media API](https://docs.x.com/x-api/media/upload-media), [X posting API](https://docs.x.com/x-api/posts/create-post).

**Hosting constraint:** this initial direct-posting integration uses a bounded in-memory session/idempotency store for a **single persistent Node process**. OAuth tokens stay on the server; browsers hold only random HttpOnly session IDs. Sessions expire within two hours and are lost on restart. Use a shared durable store before enabling direct posting on serverless/multiple-instance hosting; leave `X_SESSION_STORE` empty there to retain the composer/download flow.

State/PKCE protect sign-in. Posting requires same-origin requests, session CSRF verification, text/media validation, and a per-draft idempotency key. Uncertain network results tell users to inspect their profile before creating another draft. No live test posts were published.

## Verification

```sh
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Tests cover canonical Genesis bytes/hashes, codec edge cases, gate policy, weighted X text length, image validation, mocked media/post ordering and failures, OAuth state handling, and duplicate submissions.

The focused production-browser checks are in `tests/browser/homepage.mjs`. They cover visible entry destinations, keyboard focus, mode/draft preservation, wallet network changes, RPC and metadata failures, input feedback, public sharing previews and responsive layouts. The test supplies its own wallet and RPC responses; it never signs, transfers tokens or posts to X.

With Playwright available, start a local production server and run:

```sh
npm run start -- --port 3100
# In another terminal, against an unconfigured production build:
node tests/browser/homepage.mjs --unavailable
```

For the granted-access pass, build an isolated local configuration with symbol `USDG`, six decimals, chain ID `4663`, minimum raw balance `10000` and the USDG address documented above, then run the script without `--unavailable`. Set `HEX_TEST_URL` for another server URL, `PLAYWRIGHT_BROWSERS_PATH` for a browser cache, or `PLAYWRIGHT_MODULE_URL` to a file URL pointing at an existing Playwright installation. Browser evidence and the distinction between simulated and real checks are in the [frontpage fix verification record](docs/audits/2026-09-14_frontpage-fix-verification.md).

The installed RainbowKit dependency chain imports optional Coinbase x402 peers during Next.js bundling. Explicit `@x402/*` dependencies satisfy those imports; the app does not initiate blockchain payments.

The homepage exposes `/dead-drop` through the Tools navigation and its own tool choice, independently of the hex converter's wallet gate. Dead drop has an invitation-code → message → share-link flow. Recipients use `/dead-drop/[id]#key` without a wallet. The complete link grants access to its encrypted message for 24 hours; opening it does not delete it. The key cannot be recovered if the sender loses the link. This route does not establish deployment or Tor-service availability.

Run `node tests/browser/dead-drop.mjs` against the local production server for sender/recipient flows, clipboard fallback, UTF-8 limits, retry recovery, responsive layouts and hydration checks. It uses actual browser encryption with intercepted API calls and creates no live messages. The Node tests also run the actual API handlers with simulated database dependencies. Live Neon persistence tests require `DATABASE_URL` and otherwise skip. See the [dead-drop fix verification](docs/audits/2026-09-14_dead-drop-fix-verification.md).

Manual browser checks cover desktop/mobile layouts, Unicode round trips, offset preservation, invalid/incomplete input, byte selection, modal dismissal, and the 16:9 export. Live wallet balance transitions and live X posting still require configured accounts and API credentials.
