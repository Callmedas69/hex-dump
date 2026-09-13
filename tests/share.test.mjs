import test from "node:test";
import assert from "node:assert/strict";
import { composerUrl, validatePostText, postLength, cardExcerpt, initialPostText, SHARE_WIDTH, SHARE_HEIGHT, SHARE_SITE_URL } from "../lib/share.ts";
import { validatePng, publishToX } from "../lib/server/xClient.ts";
import { beginXAuth, finishXAuth, getXSession, removeXSession, oncePerDraft, xConfiguration } from "../lib/server/xAuth.ts";

test("X text limits use weighted characters, including CJK and URLs", () => {
  assert.equal(postLength("界".repeat(140)), 280);
  assert.equal(validatePostText("界".repeat(141)) !== null, true);
  assert.equal(postLength("https://example.com/" + "a".repeat(500)), 23);
  assert.equal(validatePostText("  ") !== null, true);
  assert.equal(validatePostText("Bitcoin 🔐"), null);
});

test("composer preserves special characters and newlines as text only", () => {
  const text = "A & B?\n#Bitcoin 🔐";
  const url = new URL(composerUrl(text));
  assert.equal(url.origin, "https://x.com");
  assert.equal(url.searchParams.get("text"), text);
  assert.equal(url.searchParams.has("media"), false);
});

test("share card maintains 16:9 and byte aligned excerpts with original offsets", () => {
  assert.equal(SHARE_WIDTH / SHARE_HEIGHT, 16 / 9);
  const snapshot = { bytes: new Uint8Array(1000), mode: "decode", baseOffset: 4096, selection: { start: 131, end: 200, text: "message" } };
  assert.deepEqual(cardExcerpt(snapshot), { start: 128, end: 320, truncated: true });
  const full = { ...snapshot, bytes: new Uint8Array(69), selection: undefined };
  assert.deepEqual(cardExcerpt(full), { start: 0, end: 69, truncated: false });
});

test("large Unicode input produces a bounded, valid initial post", () => {
  const text = "🔐界".repeat(10000);
  const initial = initialPostText({ bytes: new TextEncoder().encode(text), mode: "encode", baseOffset: 0 });
  assert.ok(postLength(initial) <= 280);
  assert.equal(validatePostText(initial), null);
  const [hex, footer] = initial.split("\n\n");
  assert.equal(footer, SHARE_SITE_URL);
  assert.match(hex, /^[0-9A-F]{2}( [0-9A-F]{2})*$/);
  assert.deepEqual(Buffer.from(hex.replaceAll(" ", ""), "hex"), Buffer.from(new TextEncoder().encode(text).slice(0, hex.split(" ").length)));
});

test("encoding posts contain only hex even when a plaintext selection is present", () => {
  const snapshot = { bytes: new TextEncoder().encode("Hello 🔐"), mode: "encode", baseOffset: 0, selection: { start: 0, end: 5, text: "Never reveal this message" } };
  const text = initialPostText(snapshot);
  assert.equal(text, `48 65 6C 6C 6F 20 F0 9F 94 90\n\n${SHARE_SITE_URL}`);
  assert.equal(new URL(composerUrl(text)).searchParams.get("text"), text);
  assert.equal(initialPostText({ ...snapshot, mode: "decode" }).includes(snapshot.selection.text), true);
});

function pngHeader(width = 1600, height = 900) {
  const bytes = Buffer.alloc(33);
  Buffer.from("89504e470d0a1a0a", "hex").copy(bytes);
  bytes.write("IHDR", 12); bytes.writeUInt32BE(width, 16); bytes.writeUInt32BE(height, 20);
  return bytes;
}
test("server rejects incorrect image type, dimensions, and oversized inputs", () => {
  assert.equal(validatePng(pngHeader().toString("base64")).length, 33);
  assert.throws(() => validatePng(pngHeader(1200, 900).toString("base64")), /1600/);
  assert.throws(() => validatePng("not a png"));
  assert.throws(() => validatePng("A".repeat(7_000_001)));
});

test("X upload runs before posting and uses the returned media ID", async () => {
  const calls = [];
  const request = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return Response.json({ data: { id: calls.length === 1 ? "123" : "456" } });
  };
  assert.equal(await publishToX("test-token", "Test text", pngHeader(), request), "https://x.com/i/status/456");
  assert.equal(calls[0].url, "https://api.x.com/2/media/upload");
  assert.equal(calls[0].body.media_category, "tweet_image");
  assert.deepEqual(calls[1].body, { text: "Test text", media: { media_ids: ["123"] } });
});

test("failed upload never attempts to post, ambiguous post failures warn against duplicates", async () => {
  let calls = 0;
  await assert.rejects(publishToX("test", "text", pngHeader(), async () => { calls++; return new Response("", { status: 403 }); }), /upload/);
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(publishToX("test", "text", pngHeader(), async () => { if (++calls === 1) return Response.json({ data: { id: "123" } }); throw new Error("network"); }), /Check your profile/);
});

test("draft submission is idempotent, including concurrent requests and uncertain failures", async () => {
  const session = { accessToken: "test", csrf: "test", expires: Date.now() + 1000, posts: new Map() };
  let count = 0;
  const post = async () => { count++; return "https://x.com/i/status/1"; };
  const result = await Promise.all([oncePerDraft(session, "a", "content", post), oncePerDraft(session, "a", "content", post)]);
  assert.equal(count, 1); assert.equal(result[0], result[1]);
  await assert.rejects(oncePerDraft(session, "a", "changed", post), /draft changed/);
  const failure = async () => { count++; throw new Error("uncertain"); };
  await assert.rejects(oncePerDraft(session, "b", "content", failure));
  await assert.rejects(oncePerDraft(session, "b", "content", failure));
  assert.equal(count, 2);
});

test("OAuth uses S256, rejects incorrect state, consumes callbacks, and stores tokens server-side", async () => {
  const keys = ["X_CLIENT_ID", "X_CLIENT_SECRET", "X_REDIRECT_URI", "X_SESSION_STORE"];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    process.env.X_CLIENT_ID = "test-client"; process.env.X_CLIENT_SECRET = "test-secret";
    process.env.X_REDIRECT_URI = "https://hex.example/api/x/callback"; process.env.X_SESSION_STORE = "memory";
    assert.ok(xConfiguration());
    const flow = beginXAuth(); const url = new URL(flow.url);
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.ok(url.searchParams.get("scope").includes("media.write"));
    let networkCalls = 0;
    await assert.rejects(finishXAuth(flow.flowId, "wrong-state", "code", async () => { networkCalls++; }), /verified/);
    assert.equal(networkCalls, 0);
    const valid = beginXAuth();
    const tokenResponse = async () => Response.json({ access_token: "secret-test-token", expires_in: 3600, scope: "tweet.write media.write" });
    const session = await finishXAuth(valid.flowId, new URL(valid.url).searchParams.get("state"), "code", tokenResponse);
    assert.ok(!JSON.stringify(session).includes("secret-test-token"));
    assert.equal(getXSession(session.id).accessToken, "secret-test-token");
    await assert.rejects(finishXAuth(valid.flowId, new URL(valid.url).searchParams.get("state"), "code", tokenResponse));
    removeXSession(session.id); assert.equal(getXSession(session.id), undefined);
    delete process.env.X_CLIENT_SECRET; assert.equal(xConfiguration(), null);
  } finally { for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } }
});
