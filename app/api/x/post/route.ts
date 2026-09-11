import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getXSession, oncePerDraft, secureEqual, xConfiguration, X_COOKIE } from "@/lib/server/xAuth";
import { publishToX, validatePng } from "@/lib/server/xClient";
import { validatePostText } from "@/lib/share";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const config = xConfiguration();
  if (!config) return NextResponse.json({ error: "Direct X posting is not configured." }, { status: 503 });
  if (request.headers.get("origin") !== config.origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = getXSession(request.cookies.get(X_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Reconnect to X before posting." }, { status: 401 });
  try {
    if (!request.headers.get("content-type")?.includes("application/json")) throw new Error("Expected a JSON draft.");
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Missing post draft.");
    const parts: Uint8Array[] = []; let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 7_100_000) { await reader.cancel(); throw new Error("The image exceeds the upload limit."); }
      parts.push(value);
    }
    const body = JSON.parse(Buffer.concat(parts).toString("utf8"));
    if (typeof body.csrf !== "string" || !secureEqual(body.csrf, session.csrf)) return NextResponse.json({ error: "Refresh the X connection before posting." }, { status: 403 });
    if (typeof body.requestId !== "string" || !/^[a-f0-9-]{36}$/i.test(body.requestId)) throw new Error("Invalid draft identifier.");
    if (typeof body.text !== "string" || body.text.length > 10_000) throw new Error("Invalid post text.");
    const textError = validatePostText(body.text); if (textError) throw new Error(textError);
    const png = validatePng(body.imageBase64);
    const fingerprint = createHash("sha256").update(body.text).update(png).digest("hex");
    const url = await oncePerDraft(session, body.requestId, fingerprint, () => publishToX(session.accessToken, body.text, png));
    return NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error && !(error instanceof SyntaxError) ? error.message : "Could not read this post draft." }, { status: 400 }); }
}
