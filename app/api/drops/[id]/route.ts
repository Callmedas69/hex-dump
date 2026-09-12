import { NextResponse } from "next/server";
import { ensureDeadDropSchema, getDrop } from "@/lib/server/deadDropDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'" };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!/^[a-f0-9]{32}$/.test(id)) return NextResponse.json({ error: "Transmission unavailable." }, { status: 404, headers });
    await ensureDeadDropSchema();
    const drop = await getDrop(id);
    if (!drop) return NextResponse.json({ error: "Transmission unavailable." }, { status: 404, headers });
    return NextResponse.json({ v: drop.v, iv: drop.iv, ciphertext: drop.ciphertext, expiresAt: drop.expiresAt }, { headers });
  } catch {
    return NextResponse.json({ error: "Transmission unavailable." }, { status: 404, headers });
  }
}
