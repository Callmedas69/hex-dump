"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatUnits } from "viem";
import { useAccount, useSignMessage, useSwitchChain } from "wagmi";
import { developmentPolicy, productionPolicy } from "../lib/tokenGate";

export function InvitationCreator({ onCreated }: { onCreated?: (token: string) => void }) {
  const { address, isConnected, chainId } = useAccount();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { signMessageAsync } = useSignMessage();
  const [slots, setSlots] = useState("10");
  const [days, setDays] = useState("7");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const policy = process.env.NODE_ENV === "development" ? developmentPolicy(process.env.NEXT_PUBLIC_USDG_PROFILE) : productionPolicy({
    NEXT_PUBLIC_MEME_TOKEN_ADDRESS: process.env.NEXT_PUBLIC_MEME_TOKEN_ADDRESS,
    NEXT_PUBLIC_MEME_TOKEN_CHAIN_ID: process.env.NEXT_PUBLIC_MEME_TOKEN_CHAIN_ID,
    NEXT_PUBLIC_MEME_TOKEN_SYMBOL: process.env.NEXT_PUBLIC_MEME_TOKEN_SYMBOL,
    NEXT_PUBLIC_MEME_TOKEN_DECIMALS: process.env.NEXT_PUBLIC_MEME_TOKEN_DECIMALS,
    NEXT_PUBLIC_MEME_TOKEN_MIN_RAW: process.env.NEXT_PUBLIC_MEME_TOKEN_MIN_RAW,
  });
  const validLimits = Number.isInteger(Number(slots)) && Number(slots) >= 1 && Number(slots) <= 100 && Number.isInteger(Number(days)) && Number(days) >= 1 && Number(days) <= 30;
  const requirement = policy ? `${policy.minimumRawBalance === 0n ? "a positive balance of" : `at least ${formatUnits(policy.minimumRawBalance, policy.decimals)}`} ${policy.symbol}` : null;

  async function create() {
    if (!address || !policy || chainId !== policy.chainId || !validLimits || busy) return;
    setBusy(true); setNotice("");
    try {
      const challengeResponse = await fetch("/api/invitations/challenge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address }) });
      const challenge = await challengeResponse.json() as { nonce?: string; message?: string; error?: string };
      if (!challengeResponse.ok || !challenge.nonce || !challenge.message) throw new Error(challenge.error ?? "Could not start authorization. Check the deployment configuration.");
      const signature = await signMessageAsync({ message: challenge.message });
      const response = await fetch("/api/invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address, nonce: challenge.nonce, signature, deposits: Number(slots), days: Number(days) }) });
      const result = await response.json() as { token?: string; error?: string };
      if (!response.ok || !result.token) throw new Error(result.error ?? "Could not create invitation.");
      onCreated?.(result.token); setNotice("Invitation created. It is ready in the sending field.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not create invitation."); }
    finally { setBusy(false); }
  }

  return <section className="invitation-creator" aria-labelledby="invitation-title">
    <h3 id="invitation-title">CREATE INVITATION CODE</h3>
    {policy ? <>
      <p>Required: {requirement} on Robinhood Chain mainnet.</p>
      <p>Connect your wallet, then sign a one-time message to prove you control it. The server checks your token balance. Signing does not transfer funds.</p>
      <div className="invitation-controls">
        <ConnectButton accountStatus="address" showBalance={false} />
        <label>Messages allowed<input disabled={busy} inputMode="numeric" min="1" max="100" step="1" type="number" value={slots} onChange={event => setSlots(event.target.value)} aria-describedby="invitation-limits" /></label>
        <label>Code expires in (days)<input disabled={busy} inputMode="numeric" min="1" max="30" step="1" type="number" value={days} onChange={event => setDays(event.target.value)} aria-describedby="invitation-limits" /></label>
        {isConnected && chainId !== policy.chainId && <button type="button" disabled={switching || busy} onClick={() => switchChain({ chainId: policy.chainId })}>Switch to Robinhood Chain</button>}
        <button type="button" className="primary" disabled={!isConnected || chainId !== policy.chainId || busy || !validLimits} onClick={create}>{busy ? "Authorizing…" : "Create invitation code"}</button>
      </div>
      <p id="invitation-limits">Choose 1–100 messages and 1–30 days, using whole numbers. The code expiry controls how long it can create links. Each message expires 24 hours after its link is created.</p>
      {!validLimits && <p role="alert">Enter a whole number within each range before creating a code.</p>}
    </> : <p>Creating invitation codes is currently unavailable because wallet access is not configured. You can still use an existing code above.</p>}
    <p className="notice" role="status" aria-live="polite">{notice}</p>
  </section>;
}
