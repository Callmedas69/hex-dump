"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { decryptDeadDrop, encryptDeadDrop, MAX_PLAINTEXT_BYTES } from "@/lib/deadDropCrypto";
import { InvitationCreator } from "./InvitationCreator";

type PendingDrop = Awaited<ReturnType<typeof encryptDeadDrop>> & { message: string; invitation: string; idempotencyKey: string };
type CreatedDrop = { link: string; onionLink: string | null; expiresAt: string };

function configuredOrigin(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch { return null; }
}

export function DeadDropWorkspace({ retrievalId }: { retrievalId?: string }) {
  const [message, setMessage] = useState("");
  const [invitation, setInvitation] = useState("");
  const [notice, setNotice] = useState("");
  const [created, setCreated] = useState<CreatedDrop | null>(null);
  const [retrieved, setRetrieved] = useState<{ text: string; expiresAt: string } | null>(null);
  const [expired, setExpired] = useState(false);
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
    if (created || retrieved !== null || expired) resultHeading.current?.focus();
  }, [created, retrieved, expired]);

  const expireMessage = useCallback(() => {
    setCreated(null);
    setRetrieved(null);
    setMessage("");
    pending.current = null;
    setNotice("");
    setExpired(true);
    if (window.location.hash) window.history.replaceState(window.history.state, "", window.location.href.split("#")[0]);
  }, []);
  const expiresAt = created?.expiresAt ?? retrieved?.expiresAt;
  useEffect(() => {
    if (!expiresAt) return;
    const deadline = Date.parse(expiresAt);
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      clearTimeout(timer);
      const remaining = deadline - Date.now();
      if (remaining <= 0) expireMessage();
      else timer = setTimeout(check, Math.min(remaining, 2_147_483_647));
    };
    timer = setTimeout(check, 0);
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [expiresAt, expireMessage]);

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
      if (Date.parse(result.expiresAt) <= Date.now()) { expireMessage(); return; }
      const path = `/dead-drop/${result.id}#${draft.key}`;
      const onionOrigin = configuredOrigin(process.env.NEXT_PUBLIC_DEAD_DROP_ONION_URL);
      setCreated({ link: `${window.location.origin}${path}`, onionLink: onionOrigin ? `${onionOrigin}${path}` : null, expiresAt: result.expiresAt });
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
      const envelope = await response.json() as { expiresAt?: unknown };
      if (typeof envelope.expiresAt !== "string" || !Number.isFinite(Date.parse(envelope.expiresAt))) throw new Error("The message expiry could not be verified. Try opening it again.");
      if (Date.parse(envelope.expiresAt) <= Date.now()) { expireMessage(); return; }
      let text: string;
      try { text = await decryptDeadDrop(envelope, key); }
      catch { throw new Error("This key could not unlock the message. Ask the sender for the original complete link and try again."); }
      // A response or decryption that finishes after the deadline must not reveal text.
      if (Date.parse(envelope.expiresAt) <= Date.now()) { expireMessage(); return; }
      setRetrieved({ text, expiresAt: envelope.expiresAt });
    } catch (error) {
      setNotice(error instanceof TypeError ? "Could not reach the service. Check your connection, then try opening the message again." : error instanceof Error ? error.message : "Could not open the message. Try again.");
    } finally { inFlight.current = false; setBusy(false); }
  }

  async function copyLink(link: string | null, label: string) {
    if (!created || !link) return;
    if (Date.parse(created.expiresAt) <= Date.now()) { expireMessage(); return; }
    try { await navigator.clipboard.writeText(link); if (Date.parse(created.expiresAt) <= Date.now()) { expireMessage(); return; } setNotice(`${label} copied. Share it with your recipient.`); }
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
      {expired ? <div className="dead-drop-expired"><h2 ref={resultHeading} tabIndex={-1}>MESSAGE EXPIRED</h2><p>This message has expired and has been cleared from this page.</p>{!reader && <button type="button" onClick={() => setExpired(false)}>Create another message</button>}</div> : reader ? <div className="dead-drop-reader">
        {retrieved === null ? <><h2>OPEN YOUR MESSAGE</h2><p>Your complete link includes a decryption key after <code>#</code>. Your browser uses that key to unlock the encrypted message.</p><button type="button" className="primary" onClick={retrieve} disabled={busy}>{busy ? "Opening…" : "Open message"}</button><p>Messages expire 24 hours after creation. Opening a message does not delete it.</p></>
          : <><h2 ref={resultHeading} tabIndex={-1}>YOUR MESSAGE</h2><pre className="dead-drop-plaintext">{retrieved.text || "(Empty message)"}</pre><p>This text was decrypted in your browser. It will be cleared from this page when the message expires.</p></>}
      </div> : created ? <div className="dead-drop-success">
        <h2 ref={resultHeading} tabIndex={-1}>YOUR MESSAGE LINK IS READY</h2>
        <p>Copy the complete link and share it with your recipient. Creating a link does not send it to anyone.</p>
        <p>Message expires: <time dateTime={created.expiresAt}>{new Date(created.expiresAt).toLocaleString()}</time> (your local time).</p>
        <label htmlFor="message-link">Complete message link</label>
        <textarea ref={linkField} id="message-link" readOnly value={created.link} rows={4} spellCheck={false} aria-describedby="message-link-help" onFocus={event => event.currentTarget.select()} />
        <div className="dead-drop-actions"><button type="button" className="primary" onClick={() => copyLink(created.link, "Web message link")}>Copy message link</button><a className="dead-drop-open" href={created.link}>Open message</a></div>
        {created.onionLink ? <><label htmlFor="onion-message-link">Tor onion link</label><textarea id="onion-message-link" readOnly value={created.onionLink} rows={4} spellCheck={false} aria-describedby="message-link-help" onFocus={event => event.currentTarget.select()} /><div className="dead-drop-actions"><button type="button" onClick={() => copyLink(created.onionLink, "Onion message link")}>Copy onion link</button><a className="dead-drop-open" href={created.onionLink}>Open onion link</a></div></> : <p className="notice">Onion link is not configured for this deployment. Use the web link above.</p>}
        <p id="message-link-help">Keep everything after <code>#</code> in the link. Anyone with the complete link can read the message. Save it before leaving this page; we cannot recover a lost key.</p>
        <div className="dead-drop-actions"><button type="button" onClick={() => { setCreated(null); setNotice(""); }}>Create another message</button></div>
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
