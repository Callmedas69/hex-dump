import "server-only";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

export const X_COOKIE = "hex_x_session";
export const X_FLOW_COOKIE = "hex_x_flow";
type PendingAuth = { state: string; verifier: string; expires: number };
export type XSession = { accessToken: string; csrf: string; expires: number; posts: Map<string, { fingerprint: string; result: Promise<string> }> };
const state = globalThis as typeof globalThis & { hexXAuth?: { flows: Map<string, PendingAuth>; sessions: Map<string, XSession> } };
const store = state.hexXAuth ??= { flows: new Map(), sessions: new Map() };
export function randomToken() { return randomBytes(32).toString("base64url"); }

export function xConfiguration() {
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  const redirectUri = process.env.X_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri || process.env.X_SESSION_STORE !== "memory") return null;
  try {
    const url = new URL(redirectUri);
    if (url.pathname !== "/api/x/callback" || url.search || url.hash || url.username || url.password) return null;
    if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) return null;
    return { clientId, clientSecret, redirectUri, origin: url.origin, secure: url.protocol === "https:" };
  } catch { return null; }
}

export function secureEqual(a: string, b: string) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function prune() {
  for (const [key, entry] of store.flows) if (entry.expires <= Date.now()) store.flows.delete(key);
  for (const [key, entry] of store.sessions) if (entry.expires <= Date.now()) store.sessions.delete(key);
}

export function beginXAuth() {
  const config = xConfiguration();
  if (!config) throw new Error("Direct X posting is not configured. Download the image and use the X composer.");
  prune();
  if (store.flows.size >= 1000) throw new Error("Too many connection requests. Try again later.");
  const flowId = randomToken();
  const flow = { state: randomToken(), verifier: randomToken(), expires: Date.now() + 600_000 };
  store.flows.set(flowId, flow);
  const url = new URL("https://x.com/i/oauth2/authorize");
  url.search = new URLSearchParams({ response_type: "code", client_id: config.clientId, redirect_uri: config.redirectUri, scope: "tweet.read users.read tweet.write media.write", state: flow.state, code_challenge: createHash("sha256").update(flow.verifier).digest("base64url"), code_challenge_method: "S256" }).toString();
  return { flowId, url: url.toString() };
}

export async function finishXAuth(flowId: string, returnedState: string, code: string, request: typeof fetch = fetch) {
  const flow = store.flows.get(flowId);
  store.flows.delete(flowId);
  const config = xConfiguration();
  if (!config || !flow || flow.expires <= Date.now() || !secureEqual(flow.state, returnedState)) throw new Error("X connection expired or could not be verified. Please connect again.");
  const response = await request("https://api.x.com/2/oauth2/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${Buffer.from(`${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`).toString("base64")}` },
    body: new URLSearchParams({ code, grant_type: "authorization_code", redirect_uri: config.redirectUri, code_verifier: flow.verifier }), signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error("X could not complete sign-in. Check the app permissions and reconnect.");
  const token = await response.json();
  if (typeof token.access_token !== "string" || !Number.isFinite(token.expires_in) || token.expires_in <= 0) throw new Error("X returned an invalid session.");
  const scopes = new Set(String(token.scope ?? "").split(" "));
  if (!["tweet.write", "media.write"].every(scope => scopes.has(scope))) throw new Error("X did not grant posting and media permissions. Reconnect with both permissions enabled.");
  prune();
  if (store.sessions.size >= 1000) throw new Error("Connection capacity reached. Try again later.");
  const id = randomToken();
  const maxAge = Math.min(token.expires_in, 7200);
  store.sessions.set(id, { accessToken: token.access_token, csrf: randomToken(), expires: Date.now() + maxAge * 1000, posts: new Map() });
  return { id, maxAge };
}

export function getXSession(id: string | undefined) {
  prune();
  return id ? store.sessions.get(id) : undefined;
}
export function removeXSession(id: string | undefined) { if (id) store.sessions.delete(id); }

export function oncePerDraft(session: XSession, id: string, fingerprint: string, post: () => Promise<string>): Promise<string> {
  const previous = session.posts.get(id);
  if (previous) {
    if (previous.fingerprint !== fingerprint) return Promise.reject(new Error("The draft changed. Review it again before posting."));
    return previous.result;
  }
  if (session.posts.size >= 30) return Promise.reject(new Error("Session posting limit reached. Reconnect to X."));
  const result = Promise.resolve().then(post);
  session.posts.set(id, { fingerprint, result });
  return result;
}
