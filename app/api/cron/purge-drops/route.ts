import { timingSafeEqual } from "node:crypto";
import { cleanupExpiredDrops } from "@/lib/server/deadDropDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'" };

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return Response.json({ error: "Cleanup is not configured." }, { status: 503, headers });
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return Response.json({ error: "Unauthorized." }, { status: 401, headers });
  try {
    const result = await cleanupExpiredDrops({ batchSize: 1000, maxBatches: 20, signal: AbortSignal.timeout(45_000) });
    if (result.remaining) console.error("dead_drop_purge_incomplete", { deleted: result.deleted });
    else console.info("dead_drop_purge_complete", { deleted: result.deleted });
    return Response.json({ ok: !result.remaining, ...result }, { status: result.remaining ? 503 : 200, headers });
  } catch {
    // Keep database URLs, message data and authorization out of logs and responses.
    console.error("dead_drop_purge_failed");
    return Response.json({ error: "Cleanup failed. Retry this job." }, { status: 503, headers });
  }
}

// Next.js otherwise invokes GET automatically for HEAD. Probes must never delete data.
export function HEAD() {
  return new Response(null, { status: 405, headers: { ...headers, Allow: "GET" } });
}
