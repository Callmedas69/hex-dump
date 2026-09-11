import { NextRequest, NextResponse } from "next/server";
import { removeXSession, xConfiguration, X_COOKIE } from "@/lib/server/xAuth";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const config = xConfiguration();
  if (!config || request.headers.get("origin") !== config.origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  removeXSession(request.cookies.get(X_COOKIE)?.value);
  const response = NextResponse.json({ disconnected: true });
  response.cookies.set(X_COOKIE, "", { path: "/api/x", maxAge: 0 });
  return response;
}
