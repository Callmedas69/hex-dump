import test from "node:test";
import assert from "node:assert/strict";
import { encryptDeadDrop, decryptDeadDrop, validateDeadDropEnvelope, MAX_ENVELOPE_BYTES, MAX_PLAINTEXT_BYTES } from "../lib/deadDropCrypto.ts";

test("dead drop crypto round trips Unicode text", async () => {
  const original = "秘密 transmission 🧅\nline two";
  const { envelope, key } = await encryptDeadDrop(original);
  assert.equal(await decryptDeadDrop(envelope, key), original);
});

test("dead drop crypto round trips empty text", async () => {
  const { envelope, key } = await encryptDeadDrop("");
  assert.equal(await decryptDeadDrop(envelope, key), "");
});

test("dead drop crypto rejects a wrong key and tampering", async () => {
  const { envelope, key } = await encryptDeadDrop("classified");
  const wrongKey = (await encryptDeadDrop("other")).key;
  await assert.rejects(() => decryptDeadDrop(envelope, wrongKey));
  const changedCiphertext = `${envelope.ciphertext[0] === "A" ? "B" : "A"}${envelope.ciphertext.slice(1)}`;
  const changedIv = `${envelope.iv[0] === "A" ? "B" : "A"}${envelope.iv.slice(1)}`;
  await assert.rejects(() => decryptDeadDrop({ ...envelope, ciphertext: changedCiphertext }, key));
  await assert.rejects(() => decryptDeadDrop({ ...envelope, iv: changedIv }, key));
  await assert.rejects(() => decryptDeadDrop({ v: 2, iv: envelope.iv, ciphertext: envelope.ciphertext }, key));
});

test("dead drop crypto enforces the 16 KiB UTF-8 limit", async () => {
  await assert.rejects(() => encryptDeadDrop("🧅".repeat(4097)), /16 KiB/);
});

test("maximum ASCII and Unicode messages fit the API envelope allowance", async () => {
  for (const text of ["a".repeat(MAX_PLAINTEXT_BYTES), "🧅".repeat(MAX_PLAINTEXT_BYTES / 4)]) {
    const { envelope, key } = await encryptDeadDrop(text);
    const normalized = validateDeadDropEnvelope({ ...envelope, ignored: "extra metadata" });
    assert.deepEqual(normalized, envelope);
    assert.equal(Buffer.byteLength(JSON.stringify(normalized)), MAX_ENVELOPE_BYTES);
    assert.equal(await decryptDeadDrop(normalized, key), text);
    await assert.rejects(() => encryptDeadDrop(text + "a"), /16 KiB/);
    assert.throws(() => validateDeadDropEnvelope({ ...envelope, ciphertext: envelope.ciphertext + "AA" }), /Malformed/);
  }
});
