import "server-only";
import { neon } from "@neondatabase/serverless";
import { createHash, timingSafeEqual } from "node:crypto";

export type StoredDrop = { id: string; v: number; iv: string; ciphertext: string; expiresAt: string };

function getSql(signal?: AbortSignal) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured.");
  return neon(url, signal ? { fetchOptions: { signal } } : undefined);
}

export async function ensureDeadDropSchema() {
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS dead_drop_invitations (id BIGSERIAL PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, remaining_deposits INTEGER NOT NULL, expires_at TIMESTAMPTZ NOT NULL, revoked BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS dead_drops (id TEXT PRIMARY KEY, version INTEGER NOT NULL, iv TEXT NOT NULL, ciphertext TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), invitation_id BIGINT REFERENCES dead_drop_invitations(id), idempotency_key TEXT NOT NULL, UNIQUE(invitation_id, idempotency_key))`;
  await sql`CREATE INDEX IF NOT EXISTS dead_drops_expires_idx ON dead_drops (expires_at)`;
  await sql`CREATE TABLE IF NOT EXISTS dead_drop_invitation_challenges (nonce_hash TEXT PRIMARY KEY, wallet_address TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, consumed_at TIMESTAMPTZ)`;
  await sql`CREATE INDEX IF NOT EXISTS dead_drop_challenges_expires_idx ON dead_drop_invitation_challenges (expires_at)`;
}

export function invitationChallengeMessage(address: string, nonce: string, expiresAt: Date) {
  return `HEXONION invitation challenge\nAddress: ${address.toLowerCase()}\nNonce: ${nonce}\nExpires: ${expiresAt.toISOString()}`;
}

export async function createInvitationChallenge(walletAddress: string, nonce: string, expiresAt: Date) {
  const sql = getSql();
  const nonceHash = createHash("sha256").update(nonce).digest("hex");
  await sql`INSERT INTO dead_drop_invitation_challenges (nonce_hash, wallet_address, expires_at) VALUES (${nonceHash}, ${walletAddress.toLowerCase()}, ${expiresAt.toISOString()})`;
}

export async function getInvitationChallenge(nonce: string) {
  const sql = getSql();
  const nonceHash = createHash("sha256").update(nonce).digest("hex");
  const rows = await sql`SELECT wallet_address AS "walletAddress", expires_at AS "expiresAt", consumed_at AS "consumedAt" FROM dead_drop_invitation_challenges WHERE nonce_hash = ${nonceHash} LIMIT 1`;
  return rows[0] as { walletAddress: string; expiresAt: string; consumedAt: string | null } | undefined;
}

export async function consumeInvitationChallenge(nonce: string) {
  const sql = getSql();
  const nonceHash = createHash("sha256").update(nonce).digest("hex");
  const rows = await sql`UPDATE dead_drop_invitation_challenges SET consumed_at = NOW() WHERE nonce_hash = ${nonceHash} AND consumed_at IS NULL AND expires_at > NOW() RETURNING wallet_address AS "walletAddress"`;
  return rows[0]?.walletAddress as string | undefined;
}

export async function createDrop(input: { tokenHash: string; idempotencyKey: string; iv: string; ciphertext: string; expiresAt: Date }) {
  const sql = getSql();
  const existing = await sql`SELECT d.id, d.expires_at AS "expiresAt" FROM dead_drops d JOIN dead_drop_invitations i ON i.id = d.invitation_id WHERE i.token_hash = ${input.tokenHash} AND d.idempotency_key = ${input.idempotencyKey} LIMIT 1`;
  if (existing[0]) return { id: String(existing[0].id), expiresAt: String(existing[0].expiresAt), duplicate: true };
  const id = crypto.randomUUID().replace(/-/g, "");
  let rows;
  try {
    rows = await sql`WITH consumed AS (UPDATE dead_drop_invitations SET remaining_deposits = remaining_deposits - 1 WHERE token_hash = ${input.tokenHash} AND remaining_deposits > 0 AND revoked = FALSE AND expires_at > NOW() RETURNING id) INSERT INTO dead_drops (id, version, iv, ciphertext, expires_at, invitation_id, idempotency_key) SELECT ${id}, 1, ${input.iv}, ${input.ciphertext}, ${input.expiresAt.toISOString()}, id, ${input.idempotencyKey} FROM consumed RETURNING id, expires_at AS "expiresAt"`;
  } catch (error) {
    const retry = await sql`SELECT d.id, d.expires_at AS "expiresAt" FROM dead_drops d JOIN dead_drop_invitations i ON i.id = d.invitation_id WHERE i.token_hash = ${input.tokenHash} AND d.idempotency_key = ${input.idempotencyKey} LIMIT 1`;
    if (retry[0]) return { id: String(retry[0].id), expiresAt: String(retry[0].expiresAt), duplicate: true };
    throw error;
  }
  if (!rows[0]) throw new Error("Invitation unavailable.");
  return { id: String(rows[0].id), expiresAt: String(rows[0].expiresAt), duplicate: false };
}

export async function verifyInvitation(tokenHash: string, idempotencyKey = "") {
  const sql = getSql();
  const rows = await sql`SELECT id, token_hash AS "tokenHash", remaining_deposits AS "remainingDeposits", expires_at AS "expiresAt", revoked FROM dead_drop_invitations WHERE token_hash = ${tokenHash} LIMIT 1`;
  const row = rows[0] as { id: number; tokenHash: string; remainingDeposits: number; expiresAt: string; revoked: boolean } | undefined;
  if (!row) return false;
  const left = Buffer.from(tokenHash, "hex");
  const right = Buffer.from(row.tokenHash, "hex");
  const matches = left.length === right.length && timingSafeEqual(left, right);
  if (!matches || row.revoked || new Date(row.expiresAt).getTime() <= Date.now()) return false;
  if (row.remainingDeposits > 0) return true;
  // A lost response can consume the last slot. Only the same, still-live request may retry.
  if (!idempotencyKey) return false;
  const existing = await sql`SELECT id FROM dead_drops WHERE invitation_id = ${row.id} AND idempotency_key = ${idempotencyKey} AND expires_at > NOW() LIMIT 1`;
  return !!existing[0];
}

export async function getDrop(id: string): Promise<StoredDrop | null> {
  const sql = getSql();
  await cleanupExpiredDrops();
  const found = await sql`SELECT id, version AS v, iv, ciphertext, expires_at AS "expiresAt" FROM dead_drops WHERE id = ${id} AND expires_at > NOW() LIMIT 1`;
  return (found[0] as StoredDrop | undefined) ?? null;
}

export async function cleanupExpiredDrops({ batchSize = 100, maxBatches = 1, signal }: { batchSize?: number; maxBatches?: number; signal?: AbortSignal } = {}) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000 || !Number.isInteger(maxBatches) || maxBatches < 1 || maxBatches > 20) throw new Error("Invalid cleanup limits.");
  const sql = getSql(signal);
  let deleted = 0;
  for (let batch = 0; batch < maxBatches; batch++) {
    signal?.throwIfAborted();
    // Row locks make overlapping jobs safe. Database time remains the expiry authority.
    const rows = await sql`WITH expired AS (SELECT id FROM dead_drops WHERE expires_at <= NOW() ORDER BY expires_at, id LIMIT ${batchSize} FOR UPDATE SKIP LOCKED), removed AS (DELETE FROM dead_drops WHERE id IN (SELECT id FROM expired) RETURNING id) SELECT COUNT(*)::int AS deleted FROM removed`;
    const count = Number(rows[0]?.deleted);
    if (!Number.isInteger(count) || count < 0 || count > batchSize) throw new Error("Invalid cleanup result.");
    deleted += count;
    if (count < batchSize) break;
  }
  // Includes rows locked by another run, so partial work never reports a drained queue.
  const remaining = await sql`SELECT EXISTS(SELECT 1 FROM dead_drops WHERE expires_at <= NOW()) AS remaining`;
  return { deleted, remaining: remaining[0]?.remaining !== false };
}

export async function createInvitation(tokenHash: string, deposits: number, expiresAt: Date) {
  const sql = getSql();
  await sql`INSERT INTO dead_drop_invitations (token_hash, remaining_deposits, expires_at) VALUES (${tokenHash}, ${deposits}, ${expiresAt.toISOString()})`;
}
