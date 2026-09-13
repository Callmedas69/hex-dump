import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";

test("Neon persistence keeps idempotency and quota atomic", { timeout: 30_000 }, async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is required for the persistence integration test");
    return;
  }

  const { neon } = await import("@neondatabase/serverless");
  const db = neon(process.env.DATABASE_URL);
  const { ensureDeadDropSchema, createInvitation, createDrop, getDrop, cleanupExpiredDrops } = await import("../lib/server/deadDropDb.ts");
  await ensureDeadDropSchema();

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await createInvitation(tokenHash, 2, new Date(Date.now() + 60_000));
  const idempotencyKey = `test_${randomBytes(12).toString("hex")}`;
  const expiresAt = new Date(Date.now() + 60_000);
  const payload = { tokenHash, idempotencyKey, iv: "a".repeat(16), ciphertext: "b".repeat(32), expiresAt };

  const [first, second] = await Promise.all([createDrop(payload), createDrop(payload)]);
  assert.equal(first.id, second.id);
  assert.equal([first, second].filter((r) => r.duplicate).length, 1);
  assert.ok(await getDrop(first.id));

  const secondKey = `test_${randomBytes(12).toString("hex")}`;
  await createDrop({ ...payload, idempotencyKey: secondKey });
  await assert.rejects(() => createDrop({ ...payload, idempotencyKey: `test_${randomBytes(12).toString("hex")}` }));

  await db`DELETE FROM dead_drops WHERE invitation_id IN (SELECT id FROM dead_drop_invitations WHERE token_hash = ${tokenHash})`;
  await db`DELETE FROM dead_drop_invitations WHERE token_hash = ${tokenHash}`;
  await cleanupExpiredDrops();
});

test("invitation lifecycle enforces valid, revoked, exhausted, and expired states", { timeout: 30_000 }, async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is required for the persistence integration test");
    return;
  }
  const { neon } = await import("@neondatabase/serverless");
  const db = neon(process.env.DATABASE_URL);
  const { ensureDeadDropSchema, createInvitation, verifyInvitation } = await import("../lib/server/deadDropDb.ts");
  await ensureDeadDropSchema();
  const tokenHash = createHash("sha256").update(randomBytes(32)).digest("hex");
  await createInvitation(tokenHash, 1, new Date(Date.now() + 60_000));
  assert.equal(await verifyInvitation(tokenHash), true);
  await db`UPDATE dead_drop_invitations SET revoked = TRUE WHERE token_hash = ${tokenHash}`;
  assert.equal(await verifyInvitation(tokenHash), false);
  const expiredHash = createHash("sha256").update(randomBytes(32)).digest("hex");
  await createInvitation(expiredHash, 1, new Date(Date.now() - 1_000));
  assert.equal(await verifyInvitation(expiredHash), false);
  await db`DELETE FROM dead_drop_invitations WHERE token_hash IN (${tokenHash}, ${expiredHash})`;
});

test("wallet invitation challenges are one-time and expire", { timeout: 30_000 }, async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is required for the persistence integration test");
    return;
  }
  const { neon } = await import("@neondatabase/serverless");
  const db = neon(process.env.DATABASE_URL);
  const { ensureDeadDropSchema, createInvitationChallenge, getInvitationChallenge, consumeInvitationChallenge } = await import("../lib/server/deadDropDb.ts");
  await ensureDeadDropSchema();
  const nonce = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 60_000);
  await createInvitationChallenge("0x0000000000000000000000000000000000000001", nonce, expiresAt);
  assert.equal((await getInvitationChallenge(nonce))?.walletAddress, "0x0000000000000000000000000000000000000001");
  assert.equal(await consumeInvitationChallenge(nonce), "0x0000000000000000000000000000000000000001");
  assert.equal(await consumeInvitationChallenge(nonce), undefined);
  const nonceHash = createHash("sha256").update(nonce).digest("hex");
  await db`DELETE FROM dead_drop_invitation_challenges WHERE nonce_hash = ${nonceHash}`;
});
