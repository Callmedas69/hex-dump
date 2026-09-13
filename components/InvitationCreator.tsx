"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage } from "wagmi";

export function InvitationCreator() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [slots, setSlots] = useState("10");
  const [days, setDays] = useState("7");
  const [token, setToken] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!address) return;
    setBusy(true); setNotice(""); setToken("");
    try {
      const challengeResponse = await fetch("/api/invitations/challenge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address }) });
      const challenge = await challengeResponse.json() as { nonce?: string; message?: string; error?: string };
      if (!challengeResponse.ok || !challenge.nonce || !challenge.message) throw new Error(challenge.error ?? "Could not start authorization.");
      const signature = await signMessageAsync({ message: challenge.message });
      const response = await fetch("/api/invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address, nonce: challenge.nonce, signature, deposits: Number(slots), days: Number(days) }) });
      const result = await response.json() as { token?: string; error?: string };
      if (!response.ok || !result.token) throw new Error(result.error ?? "Could not create invitation.");
      setToken(result.token); setNotice("Invitation created. Copy it now; it will not be shown again.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not create invitation."); }
    finally { setBusy(false); }
  }

  return <section className="invitation-creator" aria-labelledby="invitation-title"><div><span className="eyebrow">USDG HOLDER TOOL</span><h2 id="invitation-title">CREATE INVITATION CODE</h2><p>Sign a one-time wallet challenge to create an access code. Each message slot allows one encrypted transmission; the complete dead-drop link authorizes retrieval.</p></div><div className="invitation-controls"><ConnectButton accountStatus="address" showBalance={false} /><label>Message slots<input inputMode="numeric" min="1" max="100" type="number" value={slots} onChange={event => setSlots(event.target.value)} /></label><label>Valid days<input inputMode="numeric" min="1" max="30" type="number" value={days} onChange={event => setDays(event.target.value)} /></label><button type="button" className="primary" disabled={!isConnected || busy} onClick={create}>{busy ? "Authorizing…" : "Create invitation code"}</button></div>{token && <div className="invitation-token"><code>{token}</code><button type="button" onClick={() => void navigator.clipboard.writeText(token)}>Copy invitation code</button></div>}<p className="notice" role="status" aria-live="polite">{notice}</p></section>;
}
