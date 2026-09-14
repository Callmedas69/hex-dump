import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { encryptDeadDrop } from "../lib/deadDropCrypto.ts";

const require = createRequire(import.meta.url);
const moduleUrl = code => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
async function loadSource(path, replacements) {
  let source = await readFile(new URL(path, import.meta.url), "utf8");
  for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(JSON.stringify(from), JSON.stringify(to));
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(moduleUrl(compiled));
}

const dbUrl = moduleUrl(`
  export const state = { allowed: true, calls: [], drop: null, fail: false };
  export async function ensureDeadDropSchema() { if(state.fail) throw new Error("synthetic outage"); }
  export async function verifyInvitation(...args) { state.calls.push(args); return state.allowed; }
  export async function createDrop(input) { state.drop = input; return { id: "a".repeat(32), expiresAt: input.expiresAt.toISOString() }; }
  export async function cleanupExpiredDrops() {}
  export async function getDrop() { return state.drop; }
`);
const { state } = await import(dbUrl);
const replacements = {
  "next/server": pathToFileURL(require.resolve("next/server")).href,
  "@/lib/server/deadDropDb": dbUrl,
  "@/lib/deadDropCrypto": new URL("../lib/deadDropCrypto.ts", import.meta.url).href,
};
const { POST } = await loadSource("../app/api/drops/route.ts", replacements);
const { GET } = await loadSource("../app/api/drops/[id]/route.ts", replacements);

function request(body, token = "synthetic-invitation-token-32-bytes-long") {
  const req = new Request("https://hex.test/api/drops", { method: "POST", headers: { authorization: `Bearer ${token}`, origin: "https://hex.test", "content-type": "application/json" }, body: JSON.stringify(body) });
  req.nextUrl = new URL(req.url);
  return req;
}

test("actual deposit handler accepts a full 16 KiB encrypted message and validates auth and size", async () => {
  const { envelope } = await encryptDeadDrop("🧅".repeat(4096));
  const idempotencyKey = "synthetic-request-id-123456";
  const response = await POST(request({ payload: envelope, idempotencyKey }));
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(state.drop.ciphertext, envelope.ciphertext);
  assert.equal(state.calls.at(-1)[1], idempotencyKey);
  assert.equal((await POST(request({ payload: { ...envelope, ciphertext: envelope.ciphertext + "AA" }, idempotencyKey }))).status, 400);
  assert.equal((await POST(request({ payload: envelope, idempotencyKey }, "short"))).status, 401);
  state.allowed = false;
  assert.equal((await POST(request({ payload: envelope, idempotencyKey }))).status, 403);
  state.allowed = true;
});

test("actual retrieval handler distinguishes unavailable messages from service outages", async () => {
  const params = Promise.resolve({ id: "a".repeat(32) });
  state.drop = null;
  assert.equal((await GET(new Request("https://hex.test"), { params })).status, 404);
  state.fail = true;
  const response = await GET(new Request("https://hex.test"), { params });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  state.fail = false;
});

test("exhausted invitation recovery only permits the same live request and respects revocation and expiry", async () => {
  const neonUrl = moduleUrl(`
    export const state = { row: null, existing: [], queries: [] };
    export function neon() { return async (parts, ...args) => {
      state.queries.push({ sql: parts.join("?"), args });
      return parts.join("").includes("FROM dead_drop_invitations") ? (state.row ? [state.row] : []) : state.existing;
    }; }
  `);
  const mock = (await import(neonUrl)).state;
  const noop = moduleUrl("");
  const { verifyInvitation } = await loadSource("../lib/server/deadDropDb.ts", { "server-only": noop, "@neondatabase/serverless": neonUrl });
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "https://synthetic.test";
  try {
    const tokenHash = "a".repeat(64);
    mock.row = { id: 9, tokenHash, remainingDeposits: 0, revoked: false, expiresAt: new Date(Date.now() + 60000).toISOString() };
    assert.equal(await verifyInvitation(tokenHash), false);
    assert.equal(await verifyInvitation(tokenHash, "unknown-request"), false);
    mock.existing = [{ id: "existing-message" }];
    assert.equal(await verifyInvitation(tokenHash, "original-request"), true);
    assert.deepEqual(mock.queries.at(-1).args, [9, "original-request"]);
    assert.match(mock.queries.at(-1).sql, /expires_at > NOW\(\)/);
    mock.row.revoked = true;
    assert.equal(await verifyInvitation(tokenHash, "original-request"), false);
    mock.row.revoked = false;
    mock.row.expiresAt = new Date(Date.now() - 1000).toISOString();
    assert.equal(await verifyInvitation(tokenHash, "original-request"), false);
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});
