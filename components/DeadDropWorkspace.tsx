"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { decryptDeadDrop, encryptDeadDrop, MAX_PLAINTEXT_BYTES } from "@/lib/deadDropCrypto";
import { InvitationCreator } from "./InvitationCreator";

type PendingDrop = Awaited<ReturnType<typeof encryptDeadDrop>> & { message: string; invitation: string; idempotencyKey: string };
type CreatedDrop = { link: string; expiresAt: string };

export function DeadDropWorkspace({ retrievalId }: { retrievalId?: string }) {
  const [message, setMessage] = useState("");
  const [invitation, setInvitation] = useState("");
  const [notice, setNotice] = useState("");
  const [created, setCreated] = useState<CreatedDrop | null>(null);
  const [retrieved, setRetrieved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [motion, setMotion] = useState(true);
  const pending = useRef<PendingDrop | null>(null);
  const inFlight = useRef(false);
  const workspace = useRef<HTMLElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const linkField = useRef<HTMLTextAreaElement>(null);
  const bytes = new TextEncoder().encode(message).length;
  const oversized = bytes > MAX_PLAINTEXT_BYTES;
  const reader = retrievalId !== undefined;

  useEffect(() => {
    const media = gsap.matchMedia();
    if (motion) media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(workspace.current, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, ease: "steps(4)" });
    });
    return () => media.revert();
  }, [motion]);

  useEffect(() => {
    if (created || retrieved !== null) resultHeading.current?.focus();
  }, [created, retrieved]);

  async function deposit() {
    if (inFlight.current || !message || !invitation.trim() || oversized) return;
    inFlight.current = true;
    setBusy(true); setNotice("");
    try {
      // Reuse the encrypted request after a lost response so a retry uses one message slot.
      if (!pending.current || pending.current.message !== message || pending.current.invitation !== invitation.trim()) {
        pending.current = { ...await encryptDeadDrop(message), message, invitation: invitation.trim(), idempotencyKey: crypto.randomUUID().replace(/-/g, "") };
      }
      const draft = pending.current;
      const response = await fetch("/api/drops", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${draft.invitation}` },
        body: JSON.stringify({ payload: draft.envelope, idempotencyKey: draft.idempotencyKey }),
      });
      if (response.status === 401 || response.status === 403) throw new Error("This invitation code cannot be used. Check the code or ask for a new one. Your message is still here.");
      if (!response.ok) throw new Error("Could not create the link. Your message is still here. Try again without changing it to retry the same request.");
      const result = await response.json() as { id?: string; expiresAt?: string };
      if (!result.id || !/^[a-f0-9]{32}$/.test(result.id) || !result.expiresAt || !Number.isFinite(Date.parse(result.expiresAt))) throw new Error("The server response was incomplete. Keep this page open and try again.");
      setCreated({ link: `${window.location.origin}/dead-drop/${result.id}#${draft.key}`, expiresAt: result.expiresAt });
      setMessage(""); pending.current = null;
    } catch (error) {
      setNotice(error instanceof TypeError ? "Could not reach the service. Your message is still here. Check your connection and try again." : error instanceof Error ? error.message : "Could not create the link. Please try again.");
    } finally { inFlight.current = false; setBusy(false); }
  }

  async function retrieve() {
    if (inFlight.current) return;
    setNotice("");
    if (!retrievalId || !/^[a-f0-9]{32}$/.test(retrievalId)) { setNotice("This message link is incomplete or invalid. Ask the sender for the complete link."); return; }
    const key = window.location.hash.slice(1);
    if (!/^[A-Za-z0-9_-]{43}$/.test(key)) { setNotice("This link is missing a valid decryption key. Ask the sender for the complete link, including # and everything after it."); return; }
    inFlight.current = true; setBusy(true);
    try {
      const response = await fetch(`/api/drops/${retrievalId}`, { cache: "no-store" });
      if (response.status === 404 || response.status === 410) throw new Error("This message is unavailable. It may have expired or the link may be incorrect. Ask the sender to create a new link.");
      if (!response.ok) throw new Error("The service could not load this message. Try opening it again in a moment.");
      const envelope: unknown = await response.json();
      try { setRetrieved(await decryptDeadDrop(envelope, key)); }
      catch { throw new Error("This key could not unlock the message. Ask the sender for the original complete link and try again."); }
    } catch (error) {
      setNotice(error instanceof TypeError ? "Could not reach the service. Check your connection, then try opening the message again." : error instanceof Error ? error.message : "Could not open the message. Try again.");
    } finally { inFlight.current = false; setBusy(false); }
  }

  async function copyLink() {
    if (!created) return;
    try { await navigator.clipboard.writeText(created.link); setNotice("Complete message link copied. Share it with your recipient."); }
    catch { linkField.current?.focus(); linkField.current?.select(); setNotice("Clipboard unavailable. The complete link is selected above. Use your browser’s Copy command to copy it manually."); }
  }

  return <main className="shell dead-drop-page" data-motion={motion ? "on" : "off"}>
    <header className="terminal-header">
      <div className="terminal-titlebar"><span><span className="status-square" />HEXONION / DEAD DROP</span><button type="button" aria-pressed={motion} onClick={() => setMotion(value => !value)}>{motion ? "Motion on" : "Motion off"}</button></div>
      <div className="page-header"><div><p className="command-line">$ {reader ? "open message" : "create message link"}<span className="terminal-cursor" aria-hidden="true" /></p>
        <h1>{reader ? "A PRIVATE MESSAGE FOR YOU" : "SHARE A PRIVATE MESSAGE"}</h1>
        <p className="intro">{reader ? "Open the message with the key in your link. No wallet or invitation code is needed to read it." : "Write a message, create a link, and share it yourself. Your browser encrypts the text before it leaves your device. The message is available for 24 hours."}</p>
      </div><Link className="small" href="/">← Home / Bitcoin hex</Link></div>
    </header>
    <section ref={workspace} className="workspace" aria-label="Secret dead drop">
      {reader ? <div className="dead-drop-reader">
        {retrieved === null ? <><h2>OPEN YOUR MESSAGE</h2><p>Your complete link includes a decryption key after <code>#</code>. Your browser uses that key to unlock the encrypted message.</p><button type="button" className="primary" onClick={retrieve} disabled={busy}>{busy ? "Opening…" : "Open message"}</button><p>Messages expire 24 hours after creation. Opening a message does not delete it.</p></>
          : <><h2 ref={resultHeading} tabIndex={-1}>YOUR MESSAGE</h2><pre className="dead-drop-plaintext">{retrieved || "(Empty message)"}</pre><p>This text was decrypted in your browser. Anyone with the complete link can open it until it expires.</p></>}
      </div> : created ? <div className="dead-drop-success">
        <h2 ref={resultHeading} tabIndex={-1}>YOUR MESSAGE LINK IS READY</h2>
        <p>Copy the complete link and share it with your recipient. Creating a link does not send it to anyone.</p>
        <p>Message expires: <time dateTime={created.expiresAt}>{new Date(created.expiresAt).toLocaleString()}</time> (your local time).</p>
        <label htmlFor="message-link">Complete message link</label>
        <textarea ref={linkField} id="message-link" readOnly value={created.link} rows={6} spellCheck={false} aria-describedby="message-link-help" onFocus={event => event.currentTarget.select()} />
        <p id="message-link-help">Keep everything after <code>#</code> in the link. Anyone with the complete link can read the message. Save it before leaving this page; we cannot recover a lost key.</p>
        <div className="dead-drop-actions"><button type="button" className="primary" onClick={copyLink}>Copy message link</button><a className="dead-drop-open" href={created.link}>Open message</a><button type="button" onClick={() => { setCreated(null); setNotice(""); }}>Create another message</button></div>
      </div> : <div className="dead-drop-compose">
        <h2>CREATE A MESSAGE LINK</h2>
        <div className="dead-drop-field"><label htmlFor="invitation">1. Enter your invitation code</label><p id="invitation-help">An invitation code lets you create a message link. If someone gave you a code, paste it here. No wallet is needed to use it.</p><input id="invitation" value={invitation} disabled={busy} onChange={event => setInvitation(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} aria-describedby="invitation-help" />
          <details className="dead-drop-disclosure"><summary>Need an invitation code?</summary><p>Ask someone for a code, or create one with an eligible wallet.</p><InvitationCreator onCreated={token => { setInvitation(token); setNotice("Invitation code added. Write your message below."); }} /></details>
        </div>
        <div className="dead-drop-field"><label htmlFor="message">2. Write your message</label><textarea id="message" value={message} disabled={busy} onChange={event => setMessage(event.target.value)} placeholder="Write your private message…" aria-invalid={oversized} aria-describedby="message-size" />
          <p id="message-size" role="status">{bytes.toLocaleString("en-US")} / {MAX_PLAINTEXT_BYTES.toLocaleString("en-US")} bytes (16 KiB, UTF-8). Emoji can use several bytes.{oversized && ` Remove at least ${(bytes - MAX_PLAINTEXT_BYTES).toLocaleString("en-US")} bytes to continue.`}</p>
        </div>
        <button type="button" className="primary" onClick={deposit} disabled={busy || !invitation.trim() || !message || oversized}>{busy ? "Creating link…" : "Create message link"}</button>
        <p>3. Copy the link and share it yourself. The 24-hour expiry starts when the link is created.</p>
      </div>}
      <p className="notice" role="status" aria-live="polite">{notice}</p>
      <details className="dead-drop-disclosure"><summary>How privacy and expiry work</summary>
        <p>The message is encrypted with AES-256-GCM in your browser. The server stores ciphertext (encrypted data). The decryption key stays after <code>#</code> in the link; that part is not sent with the message request.</p>
        <p>Share the complete link only with people you trust. A recipient can save or forward the text. Expiry stops access through this service; it cannot erase saved copies or guarantee removal from every storage layer.</p>
        <p>If someone gives you a link to an address ending in .onion, open it in Tor Browser.</p>
      </details>
    </section>
  </main>;
}
