<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# HEX project architecture and rules

## Product boundary

HEX is a browser based Bitcoin hex encoder and decoder with a client side USDG holding gate. It supports local byte inspection and deliberate sharing to X. The planned Tor feature is not implemented yet; do not describe the current app as a chat service, onion service, or end to end encrypted messenger.

## Architecture

- `app/` contains the Next.js App Router entrypoints, layout, global styling, providers, and API routes.
- `components/` contains client UI such as the terminal header, security gate, workspace, and share dialog.
- `lib/` contains codec, token gate, sharing, canvas export, and server side X integration logic.
- `tests/` contains Node based codec, gate, sharing, canvas, and X integration tests.
- `public/` contains the local Nokia fonts and visual reference assets.
- `agent-plans/` contains product and implementation plans; plans are not shipped functionality.

## Implementation rules

- Keep Robinhood Chain mainnet (chain ID `4663`) as the only supported wallet network. Do not reintroduce Ethereum mainnet or Sepolia.
- USDG development access requires at least `0.01` USDG (`10,000` raw units, six decimals). Production token settings must be explicit and remain client UI gating unless signed server authentication is added.
- Keep conversion local in the browser. Treat hex as encoding, never as encryption.
- Encode sharing must contain only hex in both the PNG and post text; never put the original plaintext into an Encode export.
- Keep exported images at 1600×900 (16:9). Preserve byte offsets and leading zeroes.
- Use the checked in Nokia fonts: `Nokian_title.ttf` for titles and `nokiafc22-body.ttf` for body text.
- Preserve the olive LCD palette and terminal aesthetic. Use GSAP for meaningful UI sequences and CSS for small effects such as cursor blinking. Honor the Motion toggle and `prefers-reduced-motion`.
- Keep wallet and X integrations explicit and user initiated. Never publish live X posts during tests.
- Read the relevant Next.js guide under `node_modules/next/dist/docs/` before changing Next.js code. Keep the generated Next.js instruction block above intact.
- Before handoff, run `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build` when implementation changes affect those areas.
