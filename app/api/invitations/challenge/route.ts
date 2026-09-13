import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getAddress } from "viem";
import { createInvitationChallenge, ensureDeadDropSchema, invitationChallengeMessage } from "@/lib/server/deadDropDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'" };

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers });
    const body = await request.json() as { address?: unknown };
    if (typeof body.address !== "string") return NextResponse.json({ error: "Invalid wallet address." }, { status: 400, headers });
    const address = getAddress(body.address);
    const nonce = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await ensureDeadDropSchema();
    await createInvitationChallenge(address, nonce, expiresAt);
    return NextResponse.json({ nonce, message: invitationChallengeMessage(address, nonce, expiresAt), expiresAt: expiresAt.toISOString() }, { status: 201, headers });
  } catch (error) {
    const configured = !(error instanceof Error && /DATABASE_URL|connection string|neon/i.test(error.message));
    return NextResponse.json({ error: configured ? "Could not issue invitation challenge." : "Invitation service is not configured." }, { status: configured ? 400 : 503, headers });
  }
}
