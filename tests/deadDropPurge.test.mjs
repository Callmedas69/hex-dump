import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const moduleUrl = code => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
async function loadSource(path, replacements) {
  let source = await readFile(new URL(path, import.meta.url), "utf8");
  for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(JSON.stringify(from), JSON.stringify(to));
  return import(moduleUrl(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText));
}

test("cleanup drains multiple batches, bounds backlog work and preserves failures", async () => {
  const neonUrl = moduleUrl(`
    export const state = { counts: [1000, 1000, 1], remaining: false, queries: [], fail: false };
    export function neon() { return async (parts, ...args) => {
      if (state.fail) throw new Error("database unavailable");
      state.queries.push({ sql: parts.reduce((s, p, i) => s + (i ? "$" + i : "") + p, ""), args });
      return parts.join("").includes("COUNT(*)") ? [{ deleted: state.counts.shift() ?? 0 }] : [{ remaining: state.remaining }];
    }; }
  `);
  const state = (await import(neonUrl)).state;
  const { cleanupExpiredDrops } = await loadSource("../lib/server/deadDropDb.ts", { "server-only": moduleUrl(""), "@neondatabase/serverless": neonUrl });
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "https://synthetic.test";
  try {
    assert.deepEqual(await cleanupExpiredDrops({ batchSize: 1000, maxBatches: 20 }), { deleted: 2001, remaining: false });
    assert.equal(state.queries.filter(q => q.sql.includes("DELETE")).length, 3);
    assert.deepEqual(state.queries[0].args, [1000]);
    assert.match(state.queries[0].sql, /expires_at <= NOW\(\)/);
    assert.match(state.queries[0].sql, /FOR UPDATE SKIP LOCKED/);
    state.counts = [1000, 1000, 1000];
    state.remaining = true;
    assert.deepEqual(await cleanupExpiredDrops({ batchSize: 1000, maxBatches: 2 }), { deleted: 2000, remaining: true });
    assert.deepEqual(state.counts, [1000]);
    state.counts = [0];
    assert.deepEqual(await cleanupExpiredDrops(), { deleted: 0, remaining: true });
    state.remaining = false;
    assert.deepEqual(await cleanupExpiredDrops(), { deleted: 0, remaining: false });
    const before = state.queries.length;
    await assert.rejects(cleanupExpiredDrops({ signal: AbortSignal.abort() }), { name: "AbortError" });
    await assert.rejects(cleanupExpiredDrops({ maxBatches: 21 }), /Invalid cleanup limits/);
    assert.equal(state.queries.length, before);
    state.fail = true;
    await assert.rejects(cleanupExpiredDrops(), /database unavailable/);
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});

test("scheduled purge rejects unauthenticated requests and reports retryable failures without secrets", async () => {
  const dbUrl = moduleUrl(`
    export const state = { calls: [], fail: false, result: { deleted: 2001, remaining: false } };
    export async function cleanupExpiredDrops(options) { state.calls.push(options); if (state.fail) throw new Error("synthetic private database credentials"); return state.result; }
  `);
  const state = (await import(dbUrl)).state;
  const { GET, HEAD } = await loadSource("../app/api/cron/purge-drops/route.ts", { "@/lib/server/deadDropDb": dbUrl });
  const previous = process.env.CRON_SECRET;
  const secret = "synthetic-scheduler-secret-32-characters";
  const request = value => new Request("https://hex.test/api/cron/purge-drops", { headers: value ? { authorization: value } : {} });
  try {
    delete process.env.CRON_SECRET;
    assert.equal((await GET(request())).status, 503);
    process.env.CRON_SECRET = "too-short";
    assert.equal((await GET(request("Bearer too-short"))).status, 503);
    process.env.CRON_SECRET = secret;
    for (const value of [undefined, "Bearer undefined", `Bearer ${"x".repeat(secret.length)}`, secret]) assert.equal((await GET(request(value))).status, 401);
    assert.equal(HEAD().status, 405);
    assert.equal(state.calls.length, 0);
    const response = await GET(request(`Bearer ${secret}`));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { ok: true, deleted: 2001, remaining: false });
    assert.equal(state.calls[0].batchSize, 1000);
    assert.equal(state.calls[0].maxBatches, 20);
    assert.ok(state.calls[0].signal instanceof AbortSignal);
    state.result = { deleted: 20000, remaining: true };
    assert.equal((await GET(request(`Bearer ${secret}`))).status, 503);
    state.fail = true;
    const failed = await GET(request(`Bearer ${secret}`));
    assert.equal(failed.status, 503);
    assert.doesNotMatch(await failed.text(), /credentials|synthetic/);
    state.fail = false;
    state.result = { deleted: 0, remaining: false };
    assert.equal((await GET(request(`Bearer ${secret}`))).status, 200);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});

test("actual purge SQL removes only expired rows and is repeatable in isolated PostgreSQL temp tables", { timeout: 30000 }, async t => {
  // Opt-in only: the transaction shadows dead_drops with a temporary table, never application rows.
  if (!process.env.DEAD_DROP_PURGE_TEST_DATABASE_URL) { t.skip("Dedicated opt-in database URL required for temporary-table SQL verification"); return; }
  const { neon } = await import("@neondatabase/serverless");
  const source = await readFile(new URL("../lib/server/deadDropDb.ts", import.meta.url), "utf8");
  const match = source.match(/const rows = await sql`(WITH expired[^`]+)`/);
  assert.ok(match);
  const purgeSql = match[1].replace("${batchSize}", "$1");
  const db = neon(process.env.DEAD_DROP_PURGE_TEST_DATABASE_URL, { fetchOptions: { signal: AbortSignal.timeout(25000) } });
  const results = await db.transaction([
    db.query("CREATE TEMP TABLE dead_drops (id TEXT PRIMARY KEY, expires_at TIMESTAMPTZ NOT NULL) ON COMMIT DROP"),
    db.query("INSERT INTO dead_drops SELECT 'expired-' || n, NOW() - INTERVAL '1 second' FROM generate_series(1, 1201) n"),
    db.query("INSERT INTO dead_drops VALUES ('boundary', NOW()), ('live', NOW() + INTERVAL '1 hour')"),
    db.query(purgeSql, [1000]),
    db.query(purgeSql, [1000]),
    db.query(purgeSql, [1000]),
    db.query("SELECT id FROM dead_drops ORDER BY id"),
  ]);
  assert.equal(results[3][0].deleted, 1000);
  assert.equal(results[4][0].deleted, 202);
  assert.equal(results[5][0].deleted, 0);
  assert.deepEqual(results[6], [{ id: "live" }]);
});
