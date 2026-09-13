"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { decryptDeadDrop, encryptDeadDrop } from "@/lib/deadDropCrypto";
import { Providers } from "../providers";
import { InvitationCreator } from "../../components/InvitationCreator";

const onionBase = process.env.NEXT_PUBLIC_DEAD_DROP_ONION_URL?.replace(/\/$/, "");

export default function DeadDropPage() {
  const retrievalId = useMemo(() => typeof window === "undefined" ? null : window.location.pathname.match(/^\/dead-drop\/([a-f0-9]{32})$/)?.[1] ?? null, []);
  const [message, setMessage] = useState("");
  const [invitation, setInvitation] = useState("");
  const [notice, setNotice] = useState("");
  const [link, setLink] = useState("");
  const [retrieved, setRetrieved] = useState<string | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [motion, setMotion] = useState(true);
  const workspaceRef = useRef<HTMLElement>(null);
  const [dropId, setDropId] = useState<string | null>(retrievalId);
  const connection = typeof window !== "undefined" && window.location.hostname.endsWith(".onion") ? "ONION SERVICE / TOR BROWSER" : "HTTPS / WEB";

  useEffect(() => {
    const element = workspaceRef.current;
    if (!element || !motion || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(element, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, ease: "steps(4)" });
  }, [motion]);

  async function deposit() {
    setBusy(true); setNotice("");
    try {
      const { envelope, key } = await encryptDeadDrop(message);
      const response = await fetch("/api/drops", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${invitation}` }, body: JSON.stringify({ payload: envelope, idempotencyKey: crypto.randomUUID().replace(/-/g, "") }) });
      const result = await response.json() as { id?: string; expiresAt?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error ?? "Could not send the message.");
      const webLink = `${window.location.origin}/dead-drop/${result.id}#${key}`;
      setDropId(result.id); setLink(webLink); setMessage(""); setNotice(`Message sent. It expires ${new Date(result.expiresAt ?? "").toLocaleString()}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not send the message."); }
    finally { setBusy(false); }
  }

  async function previewCiphertext() {
    try { setPreview((await encryptDeadDrop(message)).envelope.ciphertext); setNotice("Encrypted preview generated locally."); } catch (error) { setNotice(error instanceof Error ? error.message : "Could not preview the encrypted message."); }
  }

  async function retrieve() {
    setBusy(true); setNotice("");
    try {
      const id = retrievalId ?? dropId;
      if (!id) throw new Error("This link does not contain a message ID.");
      const key = window.location.hash.slice(1);
      if (!key) throw new Error("This link is missing the key needed to read the message.");
      const response = await fetch(`/api/drops/${id}`, { cache: "no-store" });
      const envelope = await response.json() as { v?: number; iv?: string; ciphertext?: string; error?: string };
      if (!response.ok) throw new Error(envelope.error ?? "This message is no longer available.");
      setRetrieved(await decryptDeadDrop(envelope, key));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not open the message."); }
    finally { setBusy(false); }
  }

  async function copy(value: string, label: string) { try { await navigator.clipboard.writeText(value); setNotice(`${label} copied.`); } catch { setNotice("Clipboard unavailable. Copy the link manually."); } }

  return <Providers><main className="shell" data-motion={motion ? "on" : "off"}><header className="terminal-header"><div className="terminal-titlebar"><span><span className="status-square" />HEXONION / SECRET DEAD DROP</span><span>{connection}</span><button type="button" onClick={() => setMotion(value => !value)}>{motion ? "Motion on" : "Motion off"}</button></div><div className="page-header"><div><p className="command-line">$ open private message<span className="terminal-cursor" aria-hidden="true" /></p><h1>SECRET DEAD DROP</h1><p className="intro">Write a private message here. It is encrypted in your browser before it is sent. Share the HTTPS link in any browser, or share the Onion link with someone using Tor Browser.</p></div><Link className="small" href="/">← Home / Bitcoin hex</Link></div></header>
    <div className="dead-drop-browser-note"><strong>Using an Onion link?</strong> Open it in Tor Browser. Keep the complete link, including everything after <code>#</code>; that is the decryption key.</div>
    {!retrievalId && !dropId && <InvitationCreator />}
    <section ref={workspaceRef} className="workspace" aria-label="Secret dead drop">
      {retrievalId || (dropId && !message) ? <div className="input-area"><div className="panel-head"><span>READ MESSAGE / {retrievalId ?? dropId}</span></div>{retrieved === null ? <div style={{ padding: 18 }}><p className="intro">The encrypted message is fetched from the server. The decryption key stays in the link and is used only in this browser.</p><button type="button" className="primary" onClick={retrieve} disabled={busy}>{busy ? "Opening…" : "Open message"}</button></div> : <pre style={{ margin: 0, padding: 18, whiteSpace: "pre-wrap" }}>{retrieved}</pre>}</div> : <><div className="input-area"><div className="panel-head"><label htmlFor="invitation">INVITATION CODE</label><span>FOR SENDING</span></div><input id="invitation" value={invitation} onChange={event => setInvitation(event.target.value)} type="password" autoComplete="off" style={{ width: "100%", padding: 15, background: "transparent", border: 0, color: "var(--ink)", font: "inherit" }} /></div><div className="input-area"><div className="panel-head"><label htmlFor="message">YOUR MESSAGE / 16 KiB UTF-8 MAX</label><span>{new TextEncoder().encode(message).length.toLocaleString()} bytes</span></div><textarea id="message" value={message} onChange={event => setMessage(event.target.value)} maxLength={16384} placeholder="Write a private message…" /></div><button type="button" className="primary" onClick={deposit} disabled={busy || !invitation || !message}>{busy ? "Sending…" : "Send message"}</button></>}
      {link && <div className="input-area" style={{ marginTop: 18, padding: 15 }}><p className="intro">Use the HTTPS link in a regular browser or the Onion link in Tor Browser. Keep the complete link intact, including everything after #.</p><button type="button" onClick={() => copy(link, "Web link")}>Copy HTTPS link</button>{onionBase && <button type="button" style={{ marginLeft: 8 }} onClick={() => copy(`${onionBase}/dead-drop/${dropId}${link.slice(link.indexOf("#"))}`, "Onion link")}>Copy Onion link</button>}</div>}
      {!retrievalId && !dropId && <div style={{ marginTop: 18 }}><button type="button" onClick={previewCiphertext} disabled={!message}>Preview encrypted data</button>{preview && <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", marginTop: 12 }}>{preview}</pre>}<p className="output-note">Messages expire 24 hours after sending.</p></div>}
       <p className="notice" role="status" aria-live="polite" style={{ marginTop: 18 }}>{notice}</p><p className="output-note">Wallet signing is only needed to create an invitation code. The recipient opens the complete link in a browser or Tor Browser. Only the encrypted message is sent to the server; the key stays in the complete link. Expiration removes the service record but cannot guarantee forensic erasure from every storage layer.</p>
    </section></main></Providers>;
}
