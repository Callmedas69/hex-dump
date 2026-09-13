# Configurable Token Gate, User Invitations, and PNG X Sharing

## Goal

Allow verified token holders to create invitation tokens, publish X posts with both reviewed text and the generated PNG, and use the dead-drop flow to send a complete onion link to a recipient such as Jean.

## Token configuration

Production token settings are environment-driven. The application must not hardcode the final production contract address, symbol, decimals, or threshold.

```env
NEXT_PUBLIC_MEME_TOKEN_ADDRESS=
NEXT_PUBLIC_MEME_TOKEN_CHAIN_ID=4663
NEXT_PUBLIC_MEME_TOKEN_SYMBOL=
NEXT_PUBLIC_MEME_TOKEN_DECIMALS=
NEXT_PUBLIC_MEME_TOKEN_MIN_RAW=
```

Robinhood Chain mainnet (`4663`) remains the only supported network. Missing or invalid production settings fail closed. Development USDG remains an explicit development policy and is separate from production configuration. Changing to the final token requires Vercel environment updates and redeployment only.

## Invitation creation

Invitation creation uses a server-verified wallet challenge. The server issues a one-time nonce, verifies the wallet signature, checks Robinhood Chain and the configured ERC-20 balance through the RPC, then creates a limited, expiring invitation. Neon stores only the invitation token hash. The raw token is displayed once to the creator. Existing operator generation and revocation commands remain available.

## X sharing

The direct X path uploads the reviewed 1600×900 PNG first and creates one post containing the reviewed text and returned media ID. Publishing remains an explicit user action with duplicate-submit protection. The existing PNG download and composer fallback remains available when direct X credentials are not configured. Durable X session and idempotency storage is required before relying on direct posting across Vercel instances.

## Dead-drop flow

The sender creates an encrypted message in the browser, deposits it with an invitation, and receives HTTPS and onion links. The decryption key stays only in the URL fragment. The sender sends the complete onion link to Jean. Jean opens it in Tor Browser; the server returns ciphertext and Jean's browser decrypts locally.

## Acceptance criteria

- A holder of the configured token can create a limited, expiring invitation after signing a wallet challenge.
- A non-holder cannot create invitations.
- Changing the production token requires only environment updates and redeployment.
- A direct X post contains both the reviewed text and generated PNG.
- Jean can retrieve and decrypt a complete onion link in Tor Browser without the key or plaintext reaching the server.
