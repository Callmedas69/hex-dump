import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { createPublicClient, getAddress, http, verifyMessage, erc20Abi, type Hex } from "viem";
import { productionPolicy } from "@/lib/tokenGate";
import { consumeInvitationChallenge, createInvitation, ensureDeadDropSchema, getInvitationChallenge, invitationChallengeMessage } from "@/lib/server/deadDropDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'" };
const MAX_DEPOSITS = 100;
const MAX_DAYS = 30;

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers });
    const body = await request.json() as { address?: unknown; nonce?: unknown; signature?: unknown; deposits?: unknown; days?: unknown };
    if (typeof body.address !== "string" || typeof body.nonce !== "string" || typeof body.signature !== "string") return NextResponse.json({ error: "Invitation authorization failed." }, { status: 400, headers });
    const address = getAddress(body.address);
    const challenge = await getInvitationChallenge(body.nonce);
    if (!challenge || challenge.consumedAt || new Date(challenge.expiresAt).getTime() <= Date.now() || challenge.walletAddress.toLowerCase() !== address.toLowerCase()) return NextResponse.json({ error: "Invitation authorization failed." }, { status: 403, headers });
    const message = invitationChallengeMessage(address, body.nonce, new Date(challenge.expiresAt));
    if (!/^0x[0-9a-f]+$/i.test(body.signature) || !(await verifyMessage({ address, message, signature: body.signature as Hex }))) return NextResponse.json({ error: "Invitation authorization failed." }, { status: 403, headers });
    if (!(await consumeInvitationChallenge(body.nonce))) return NextResponse.json({ error: "Invitation authorization failed." }, { status: 403, headers });
    const policy = productionPolicy(process.env);
    if (!policy) return NextResponse.json({ error: "Token access is not configured." }, { status: 503, headers });
    const deposits = Number(body.deposits ?? 10);
    const days = Number(body.days ?? 7);
    if (!Number.isInteger(deposits) || deposits < 1 || deposits > MAX_DEPOSITS || !Number.isInteger(days) || days < 1 || days > MAX_DAYS) return NextResponse.json({ error: "Invalid invitation limits." }, { status: 400, headers });
    const client = createPublicClient({ chain: { id: policy.chainId, name: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com"] } } }, transport: http(process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com") });
    const [balance, decimals, symbol] = await Promise.all([
      client.readContract({ address: policy.address, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
      client.readContract({ address: policy.address, abi: erc20Abi, functionName: "decimals" }),
      client.readContract({ address: policy.address, abi: erc20Abi, functionName: "symbol" }),
    ]);
    if (decimals !== policy.decimals || symbol !== policy.symbol || balance < policy.minimumRawBalance || balance <= 0n) return NextResponse.json({ error: "Token balance does not meet the requirement." }, { status: 403, headers });
    await ensureDeadDropSchema();
    const token = randomBytes(32).toString("base64url");
    await createInvitation(createHash("sha256").update(token).digest("hex"), deposits, new Date(Date.now() + days * 86_400_000));
    return NextResponse.json({ token, deposits, validDays: days }, { status: 201, headers });
  } catch {
    return NextResponse.json({ error: "Could not create invitation." }, { status: 400, headers });
  }
}
