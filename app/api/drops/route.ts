import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { ensureDeadDropSchema, createDrop, cleanupExpiredDrops, verifyInvitation } from "@/lib/server/deadDropDb";
import { validateDeadDropEnvelope, MAX_PLAINTEXT_BYTES } from "@/lib/deadDropCrypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'" };

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers });
    await ensureDeadDropSchema();
    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    if (!token || token.length < 32) return NextResponse.json({ error: "Invitation unavailable." }, { status: 401, headers });
    const tokenHash = createHash("sha256").update(token).digest("hex");
    if (!(await verifyInvitation(tokenHash))) return NextResponse.json({ error: "Invitation unavailable." }, { status: 403, headers });
    const body = await request.json() as Record<string, unknown>;
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey)) return NextResponse.json({ error: "Invalid idempotency key." }, { status: 400, headers });
    const envelope = validateDeadDropEnvelope(body.payload);
    const encodedSize = new TextEncoder().encode(JSON.stringify(envelope)).length;
    if (encodedSize > MAX_PLAINTEXT_BYTES + 512) return NextResponse.json({ error: "Transmission is too large." }, { status: 413, headers });
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const result = await createDrop({ tokenHash, idempotencyKey, iv: envelope.iv, ciphertext: envelope.ciphertext, expiresAt });
    await cleanupExpiredDrops();
    return NextResponse.json({ id: result.id, expiresAt: result.expiresAt }, { status: result.duplicate ? 200 : 201, headers });
  } catch (error) {
    const message = error instanceof Error && error.message === "Invitation unavailable." ? error.message : "Could not deposit transmission.";
    return NextResponse.json({ error: message }, { status: message === "Invitation unavailable." ? 403 : 400, headers });
  }
}
