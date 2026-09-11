import { NextRequest, NextResponse } from "next/server";
import { beginXAuth, xConfiguration, X_FLOW_COOKIE } from "@/lib/server/xAuth";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const config = xConfiguration();
  if (!config) return NextResponse.json({ error: "Direct X posting is not configured. Use image download and the X composer." }, { status: 503 });
  if (request.headers.get("origin") !== config.origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const flow = beginXAuth();
    const response = NextResponse.json({ url: flow.url }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(X_FLOW_COOKIE, flow.flowId, { httpOnly: true, secure: config.secure, sameSite: "lax", path: "/api/x", maxAge: 600 });
    return response;
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not connect to X." }, { status: 400 }); }
}
