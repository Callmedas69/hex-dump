# Secret Dead Drop deployment

## Vercel and Neon

Create a Neon Postgres project and add its pooled connection string as `DATABASE_URL` in Vercel for Production, Preview, and Development as appropriate. Deploy the Next.js project to Vercel at `hexonion.0xdas.dev` and set `NEXT_PUBLIC_DEAD_DROP_ONION_URL` after the onion hostname exists.

The first invitation can be generated from a trusted operator shell with the same `DATABASE_URL`:

```bash
npm run invitation -- 10 7
```

Store the printed token in a secure channel. Revoke it with:

```bash
npm run revoke-invitation -- <token>
```

## AWS EC2 Tor gateway

Launch an Ubuntu 24.04 LTS EC2 instance, preferably an eligible ARM64 `t4g.small`, and restrict SSH in its security group to the operator’s IP. Install Tor and a reverse proxy, then configure the v3 onion service to forward to the Vercel custom domain. Preserve `/var/lib/tor/` with mode `0700`; the onion identity must survive restarts.

Do not redirect onion requests to the public domain. The proxy must preserve the request path and set the upstream host to the Vercel application domain. Configure an AWS billing alarm before enabling the instance.

## Release checks

Verify both directions (HTTPS send → Tor retrieval and Tor send → HTTPS retrieval), expiration, restart persistence, CSP/no-store headers, and that no plaintext or URL fragment is sent in requests or logs. Do not publish the onion hostname until these checks pass.

