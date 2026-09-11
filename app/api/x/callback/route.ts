import { NextRequest, NextResponse } from "next/server";
import { finishXAuth, removeXSession, xConfiguration, X_COOKIE, X_FLOW_COOKIE } from "@/lib/server/xAuth";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const config = xConfiguration();
  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    if (!config || !code || !state || request.nextUrl.searchParams.has("error")) throw new Error("X sign-in was cancelled or is unavailable. Close this tab and try again from your share preview.");
    const session = await finishXAuth(request.cookies.get(X_FLOW_COOKIE)?.value ?? "", state, code);
    removeXSession(request.cookies.get(X_COOKIE)?.value);
    const response = new NextResponse("X is connected. Close this tab, return to your share preview, and press Check connection. Nothing has been posted.", { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'" } });
    response.cookies.set(X_COOKIE, session.id, { httpOnly: true, sameSite: "lax", secure: config.secure, path: "/api/x", maxAge: session.maxAge });
    response.cookies.set(X_FLOW_COOKIE, "", { path: "/api/x", maxAge: 0 });
    return response;
  } catch (error) {
    const response = new NextResponse(error instanceof Error ? error.message : "X sign-in failed. Try again from the share preview.", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
    response.cookies.set(X_FLOW_COOKIE, "", { path: "/api/x", maxAge: 0 });
    return response;
  }
}
