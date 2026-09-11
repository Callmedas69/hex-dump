import { NextRequest, NextResponse } from "next/server";
import { getXSession, xConfiguration, X_COOKIE } from "@/lib/server/xAuth";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const configured = !!xConfiguration();
  const session = configured ? getXSession(request.cookies.get(X_COOKIE)?.value) : undefined;
  return NextResponse.json({ configured, connected: !!session, csrf: session?.csrf }, { headers: { "Cache-Control": "no-store" } });
}
