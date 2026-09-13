"use client";

import { useEffect, useRef, useState } from "react";
import { composerUrl, initialPostText, postLength, validateShare, type ShareSnapshot, type ShareSelection } from "../lib/share";
import { renderShareImage } from "../lib/shareImage";
import styles from "./ShareDialog.module.css";

type Props = { bytes: Uint8Array; mode: "encode" | "decode"; baseOffset?: number; selection?: ShareSelection; onClose: () => void };
type Connection = { configured: boolean; connected: boolean; csrf?: string };

function imageBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read the generated image."));
    reader.readAsDataURL(blob);
  });
}

export default function ShareDialog({ bytes, mode, baseOffset = 0, selection, onClose }: Props) {
  const [snapshot] = useState<ShareSnapshot>(() => ({ bytes: bytes.slice(), mode, baseOffset, selection: selection ? { ...selection } : undefined }));
  const [text, setText] = useState(() => initialPostText(snapshot));
  const [image, setImage] = useState<{ blob: Blob; url: string }>();
  const [connection, setConnection] = useState<Connection>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [postedUrl, setPostedUrl] = useState("");
  const requestId = useRef("");
  const dialog = useRef<HTMLDialogElement>(null);
  const validation = validateShare(text, snapshot.bytes);

  async function checkConnection() {
    try {
      const response = await fetch("/api/x/status", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not check the X connection. Image download and the composer are still available.");
      setConnection(await response.json());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not check X connection."); }
  }

  useEffect(() => {
    dialog.current?.showModal();
    let disposed = false;
    let objectUrl = "";
    renderShareImage(snapshot).then((blob) => {
      if (disposed) return;
      objectUrl = URL.createObjectURL(blob);
      setImage({ blob, url: objectUrl });
    }).catch((cause) => { if (!disposed) setError(cause instanceof Error ? cause.message : "Image rendering failed."); });
    fetch("/api/x/status", { cache: "no-store" }).then(response => {
      if (!response.ok) throw new Error("Could not check X. Image download and the composer are still available.");
      return response.json();
    }).then(value => { if (!disposed) setConnection(value); }).catch(cause => { if (!disposed) setError(cause.message); });
    return () => { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [snapshot]);

  async function connectX() {
    const tab = window.open("about:blank", "_blank");
    if (!tab) { setError("Allow a popup to connect X, or use the composer option."); return; }
    tab.opener = null;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/x/auth", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      tab.location.href = result.url;
      setMessage("Finish X sign-in in the new tab, then press Check connection here.");
    } catch (cause) { tab.close(); setError(cause instanceof Error ? cause.message : "Could not connect to X."); }
    finally { setBusy(false); }
  }

  async function post() {
    if (!image || validation || !connection?.csrf || busy || postedUrl) return;
    setBusy(true); setError(""); setMessage("");
    if (!requestId.current) requestId.current = crypto.randomUUID();
    try {
      const response = await fetch("/api/x/post", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, imageBase64: await imageBase64(image.blob), csrf: connection.csrf, requestId: requestId.current }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "X could not publish this post.");
      setPostedUrl(result.url); setMessage("Posted to X.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No confirmation received. Check your X profile before trying again."); }
    finally { setBusy(false); }
  }

  async function disconnectX() {
    setBusy(true);
    try {
      const response = await fetch("/api/x/disconnect", { method: "POST" });
      if (!response.ok) throw new Error("Could not disconnect X.");
      setConnection({ configured: true, connected: false });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not disconnect X."); }
    finally { setBusy(false); }
  }

  function downloadImage() {
    if (!image) return false;
    const anchor = document.createElement("a");
    anchor.href = image.url;
    anchor.download = "bitcoin-hex-1600x900.png";
    anchor.click();
    return true;
  }

  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="share-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
      <div className={styles.heading}>
        <div><span className={styles.eyebrow}>SHARE YOUR DISCOVERY</span><h2 id="share-title">From bytes to a story.</h2></div>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Close share preview">×</button>
      </div>
      <div className={styles.preview} aria-busy={!image}>
        {/* The blob is the exact downloadable PNG, so optimization is inappropriate here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {image ? <img src={image.url} width={1600} height={900} alt={snapshot.mode === "encode" ? "Encoded result shown as hexadecimal bytes" : "Decode result with a hex byte grid and its readable text"} /> : <p>Preparing your image…</p>}
      </div>
      <p className={styles.note}>1600 × 900 PNG · Your selected bytes are captured in this preview.</p>
      <label className={styles.label} htmlFor="share-post-text">Post text <span>{postLength(text)} / 280</span></label>
      <textarea id="share-post-text" value={text} maxLength={10000} readOnly={snapshot.mode === "encode"} disabled={busy || !!postedUrl} onChange={event => { setText(event.target.value); requestId.current = ""; }} rows={3} />
      {snapshot.mode === "encode" && <p className={styles.note}>Encoding shares contain hex only. Edit your message in the encoder to change the result.{snapshot.bytes.length > 93 ? " Post text shows the first 93 bytes to fit X’s character limit." : ""}</p>}
      {validation && <p className={styles.error}>{validation}</p>}
      <div className={styles.actions}>
        <button type="button" disabled={!image || busy} onClick={() => {
          if (downloadImage()) setMessage("PNG download started.");
        }}>Download PNG</button>
        <button type="button" disabled={!!validation || busy} onClick={async () => {
          try { await navigator.clipboard.writeText(text); setMessage("Post text copied."); } catch { setError("Clipboard unavailable. Select the post text and copy it manually."); }
        }}>Copy text</button>
        <button type="button" disabled={!image || !!validation || busy} onClick={() => {
          if (!downloadImage()) return;
          const tab = window.open(composerUrl(text), "_blank");
          if (tab) { tab.opener = null; setMessage("PNG downloaded and X composer opened. Attach the downloaded image before posting."); } else setError("Allow popups to open the X composer.");
        }}>Download PNG + open X</button>
      </div>
      <p className={styles.note}>X does not allow a website to attach a local file automatically. Use the combined button to download the PNG and open the composer, then attach the downloaded image.</p>
      <div className={styles.connection}>
        {connection?.configured ? connection.connected ? <>
          <span>X connected · Post the reviewed text and image together.</span>
          <div className={styles.actions}><button type="button" className={styles.primary} disabled={busy || !image || !!validation || !!postedUrl} onClick={post}>{busy ? "Posting…" : postedUrl ? "Posted" : "Post to X"}</button><button type="button" disabled={busy} onClick={disconnectX}>Disconnect X</button></div>
        </> : <>
          <span>Connect X to post the text and image together.</span>
          <div className={styles.actions}><button type="button" disabled={busy} onClick={connectX}>Connect X</button><button type="button" disabled={busy} onClick={checkConnection}>Check connection</button></div>
        </> : <span>{connection ? "Direct posting is unavailable. Use the image download and X composer above." : "Checking X connection…"}</span>}
      </div>
      <div aria-live="polite">{message && <p className={styles.success}>{message}</p>}{postedUrl && <a href={postedUrl} target="_blank" rel="noopener noreferrer">View your post on X ↗</a>}</div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </dialog>
  );
}
