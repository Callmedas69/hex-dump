"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { decodeAscii, decodeUtf8, discoverTextRuns, encodeText, formatDump, parseOffsetDump, parseRawHex, toHex, type ParsedHex } from "../lib/hexCodec";
import { GENESIS_BLOCK_HEX, GENESIS_MESSAGE } from "../lib/fixtures/bitcoinGenesis";
import { SecurityGate } from "../components/SecurityGate";
import ShareDialog from "../components/ShareDialog";
import { TerminalHeader } from "../components/TerminalHeader";
import { HexExample } from "../components/HexExample";
import { outputHelp, workspaceStatus } from "../lib/workspacePresentation";
import { Providers } from "./providers";

gsap.registerPlugin(useGSAP);
const PAGE_BYTES = 512;

type ConversionMode = "encode" | "decode";

function HexWorkspace({ active, motion, mode, setMode }: {
  active: boolean;
  motion: boolean;
  mode: ConversionMode;
  setMode: (mode: ConversionMode) => void;
}) {
  const root = useRef<HTMLElement>(null);
  const audio = useRef<AudioContext | null>(null);
  const [text, setText] = useState(GENESIS_MESSAGE);
  const [hex, setHex] = useState(() => toHex(parseRawHex(GENESIS_BLOCK_HEX).bytes));
  const [format, setFormat] = useState<"raw" | "dump">("raw");
  const [view, setView] = useState<"ascii" | "utf8" | "dump">("ascii");
  const [share, setShare] = useState(false);
  const [notice, setNotice] = useState("");
  const [sound, setSound] = useState(false);
  const [selectedStart, setSelectedStart] = useState<number>();
  const [page, setPage] = useState(0);

  useGSAP(() => {
    if (!active || !motion) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".reveal", { opacity: 0, y: 10, duration: .35, stagger: .07, clearProps: "all" });
    });
    return () => media.revert();
  }, { scope: root, dependencies: [active, motion], revertOnUpdate: true });
  useEffect(() => () => { void audio.current?.close(); }, []);

  const parsed = useMemo<ParsedHex & { error?: string }>(() => {
    try {
      if (mode === "encode") return { bytes: encodeText(text), baseOffset: 0 };
      return format === "dump" ? parseOffsetDump(hex) : parseRawHex(hex);
    } catch (cause) { return { bytes: new Uint8Array(), baseOffset: 0, error: cause instanceof Error ? cause.message : "Invalid input." }; }
  }, [mode, text, hex, format]);
  const runs = useMemo(() => discoverTextRuns(parsed.bytes), [parsed.bytes]);
  const selected = mode === "decode" ? runs.find(run => run.start === selectedStart) ?? runs.reduce<(typeof runs)[number] | undefined>((longest, run) => !longest || run.text.length > longest.text.length ? run : longest, undefined) : undefined;
  const output = useMemo(() => {
    if (mode === "encode") return { text: toHex(parsed.bytes) };
    if (view === "dump") return { text: formatDump(parsed.bytes, parsed.baseOffset) };
    if (view === "utf8") {
      try { return { text: decodeUtf8(parsed.bytes) }; }
      catch { return { text: "", error: "These bytes are not valid UTF-8. Use ASCII inspection or Hex dump to inspect the original bytes." }; }
    }
    return { text: decodeAscii(parsed.bytes) };
  }, [mode, view, parsed]);
  const pages = Math.max(1, Math.ceil(parsed.bytes.length / PAGE_BYTES));
  const visiblePage = Math.min(page, pages - 1);
  const rowStarts = Array.from({ length: Math.ceil(Math.min(PAGE_BYTES, Math.max(0, parsed.bytes.length - visiblePage * PAGE_BYTES)) / 16) }, (_, i) => visiblePage * PAGE_BYTES + i * 16);

  function blip() {
    if (!sound) return;
    try {
      const ctx = audio.current ??= new AudioContext();
      if (ctx.state === "suspended") void ctx.resume();
      const oscillator = ctx.createOscillator(); const gain = ctx.createGain();
      oscillator.frequency.value = 720; gain.gain.setValueAtTime(.015, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .035);
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.start(); oscillator.stop(ctx.currentTime + .04);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    } catch { /* Audio is an optional enhancement. */ }
  }
  function resetSelection() { setSelectedStart(undefined); setPage(0); setNotice(""); }
  function preset(full: boolean) {
    const bytes = full ? parseRawHex(GENESIS_BLOCK_HEX).bytes : encodeText(GENESIS_MESSAGE);
    setMode("decode"); setFormat(full ? "dump" : "raw");
    setHex(full ? formatDump(bytes) : toHex(bytes));
    resetSelection();
  }

  return (
    <section ref={root} className="workspace" id="hex-workspace">
      <div className="workspace-bar reveal"><span><span className="status-square" aria-hidden="true" /> HEXONION WORKSPACE / SESSION ACTIVE</span><button type="button" className="small" aria-pressed={sound} onClick={() => setSound(!sound)}>Sound {sound ? "on" : "off"}</button></div>
      <div className="tabs reveal" role="group" aria-label="Conversion mode">
        <button type="button" aria-pressed={mode === "encode"} className={mode === "encode" ? "active" : ""} onClick={() => { setMode("encode"); resetSelection(); }}>Encode text → hex</button>
        <button type="button" aria-pressed={mode === "decode"} className={mode === "decode" ? "active" : ""} onClick={() => { setMode("decode"); resetSelection(); }}>Decode hex → text</button>
      </div>
      <div className="input-area reveal">
        <div className="panel-head">
          <label htmlFor="hex-input"><span className="panel-index">01</span> {mode === "encode" ? "Your message" : "Paste hex data"}</label>
          {mode === "decode" && <label className="format-label">Input format <select aria-label="Input format" value={format} onChange={event => { setFormat(event.target.value as "raw" | "dump"); resetSelection(); }}><option value="raw">Hex pairs (raw hex)</option><option value="dump">Hex with byte positions (offset dump)</option></select></label>}
        </div>
        <textarea id="hex-input" aria-describedby="input-help" spellCheck={false} value={mode === "encode" ? text : hex} onChange={event => { if (mode === "encode") setText(event.target.value); else setHex(event.target.value); resetSelection(); blip(); }} />
        <div className="input-footer"><p id="input-help">{mode === "encode" ? "Text becomes UTF-8 bytes, including emoji and international characters. The result updates as you type." : "Paste hex pairs, such as 48 65 6C 6C 6F. For an offset dump, row addresses show byte positions and are not part of your data."} Maximum 65,536 bytes (64 KiB).</p><div className="preset-actions"><button type="button" onClick={() => preset(true)}>Try the Genesis block</button><button type="button" onClick={() => preset(false)}>Try its headline</button></div></div>
      </div>
      {parsed.error && <p className="error" role="alert">{parsed.error}</p>}
      {parsed.warning && <p className="warning" role="status">{parsed.warning} Complete the final byte before sharing.</p>}
      <div className="inspector reveal">
        <section className="byte-panel" aria-label="Hex byte grid">
          <div className="panel-head"><span><span className="panel-index">02</span> Byte inspector · each pair is one byte</span><span>{parsed.bytes.length.toLocaleString()} bytes</span></div>
          <div className="byte-scroll" tabIndex={0} aria-label="Scrollable hex bytes">
            {rowStarts.map(start => <div className="byte-row" key={start}><span className="offset">{(parsed.baseOffset + start).toString(16).padStart(8, "0").toUpperCase()}</span>{Array.from(parsed.bytes.slice(start, start + 16), (byte, index) => {
              const active = selected && start + index >= selected.start && start + index < selected.end;
              return <span key={index} className={`byte ${index === 8 ? "byte-group" : ""} ${active ? "selected-byte" : ""}`} title={`Offset ${(parsed.baseOffset + start + index).toString(16)}: ${byte}`}>{byte.toString(16).padStart(2, "0").toUpperCase()}</span>;
            })}</div>)}
            {!parsed.bytes.length && <p className="empty">Your bytes will appear here.</p>}
          </div>
          {pages > 1 && <div className="pagination"><button type="button" disabled={visiblePage === 0} onClick={() => setPage(visiblePage - 1)}>Previous</button><span>{visiblePage + 1} / {pages}</span><button type="button" disabled={visiblePage === pages - 1} onClick={() => setPage(visiblePage + 1)}>Next</button></div>}
        </section>
        <section className="output-panel" aria-label="Conversion output">
          <div className="panel-head"><span><span className="panel-index">03</span> {mode === "encode" ? "ENCODED HEX" : "DECODED OUTPUT"}</span><button type="button" className="small" disabled={!output.text || !!parsed.error} onClick={async () => {
            try { await navigator.clipboard.writeText(output.text); setNotice("Output copied."); } catch { setNotice("Clipboard unavailable. Select the output and copy it manually."); }
          }}>Copy output</button></div>
          {mode === "decode" && <div className="viewtabs" role="group" aria-label="Output view">{(["ascii", "utf8", "dump"] as const).map(item => <button type="button" key={item} aria-pressed={view === item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item === "ascii" ? "Basic characters (ASCII)" : item === "utf8" ? "Text including emoji (UTF-8)" : "Hex dump"}</button>)}</div>}
          {output.error ? <p className="error output-error" role="status">{output.error}</p> : <pre className={view === "dump" && mode === "decode" ? "dump-output" : ""}>{output.text || "Waiting for bytes…"}</pre>}
          <p className="output-note">{outputHelp(mode, view)}</p>
        </section>
      </div>
      <div className="buffer-status"><span>BUFFER / {parsed.bytes.length.toLocaleString()} OF 65,536 BYTES</span><meter min={0} max={65536} value={parsed.bytes.length} aria-label="Input buffer usage" /><span role="status">{workspaceStatus({ mode, byteCount: parsed.bytes.length, error: parsed.error, warning: parsed.warning, outputError: output.error })}<span className="terminal-cursor" aria-hidden="true" /></span></div>
      {mode === "decode" && <section className="discovery reveal" aria-label="Readable text discovery"><div className="discovery-title"><span className="eyebrow">READABLE PASSAGES FOUND</span><strong>{runs.length} possible passage{runs.length === 1 ? "" : "s"}</strong><p>Choose a passage to highlight its bytes. Binary data can also look like text.</p></div><div className="candidate-list">{runs.map(run => <button type="button" key={run.start} aria-pressed={selected?.start === run.start} className={selected?.start === run.start ? "active" : ""} onClick={() => { setSelectedStart(run.start); setPage(Math.floor(run.start / PAGE_BYTES)); }}><span>{(parsed.baseOffset + run.start).toString(16).padStart(8, "0")}–{(parsed.baseOffset + run.end - 1).toString(16).padStart(8, "0")}</span><span className="candidate-text">{run.text}</span></button>)}</div></section>}
      <div className="actions"><span className="notice" role="status">{notice}</span><button type="button" onClick={() => { if (mode === "encode") setText(""); else setHex(""); resetSelection(); }}>Clear</button><button type="button" onClick={() => { setText(GENESIS_MESSAGE); preset(true); }}>Load Bitcoin example</button><button type="button" className="primary" disabled={!parsed.bytes.length || !!parsed.error || !!parsed.warning} onClick={() => setShare(true)}>Preview sharing</button></div>
      {active && share && <ShareDialog bytes={parsed.bytes} mode={mode} baseOffset={parsed.baseOffset} selection={selected} onClose={() => setShare(false)} />}
    </section>
  );
}

export default function Home() {
  const [motion, setMotion] = useState(true);
  const [mode, setMode] = useState<ConversionMode>("encode");
  return (
    <Providers>
      <main className="shell home-page" data-motion={motion ? "on" : "off"}>
        <TerminalHeader motion={motion} onToggleMotion={() => setMotion(!motion)} />
        <SecurityGate introduction={access => <>
          <section className="task-choices hex-introduction" aria-labelledby="hex-tool-title">
            <span className="eyebrow">HEX TOOL / ENCODE AND DECODE</span>
            <h2 id="hex-tool-title" tabIndex={-1}>Convert text. Inspect Bitcoin bytes.</h2>
            <p className="hex-explanation">Hexadecimal (hex) represents data using 0–9 and A–F. Each pair is one byte. Anyone can decode it, so it does not keep a message secret.</p>
            <div className="hello-example" aria-label="Text to hexadecimal example">
              <span>Text <strong>Hello</strong></span><span aria-hidden="true">→</span>
              <span>Hex <code>48 65 6C 6C 6F</code></span>
            </div>
            <div className="task-choice-grid">
              <article>
                <h3>Text to hex (encode)</h3>
                <p>Turn a message into hexadecimal bytes. Supports emoji and international characters.</p>
                <button type="button" onClick={() => { setMode("encode"); access.enterWorkspace(); }}>Encode text</button>
              </article>
              <article>
                <h3>Hex to text (decode)</h3>
                <p>Inspect hexadecimal data for readable passages. Some bytes are not text.</p>
                <button type="button" onClick={() => { setMode("decode"); access.enterWorkspace(); }}>Decode hex</button>
              </article>
            </div>
            <div className="hex-section-actions">
              {access.granted && <button type="button" onClick={access.enterWorkspace}>Open hex tool</button>}
              <a href="#bitcoin-example" onClick={event => {
                const example = document.getElementById("bitcoin-example");
                if (example instanceof HTMLDetailsElement) {
                  event.preventDefault();
                  example.open = true;
                  example.querySelector("summary")?.focus();
                  example.scrollIntoView({ block: "start" });
                }
              }}>See a Bitcoin example ↓</a>
            </div>
            <details className="access-details hex-access-details">
              <summary>Hex tool access details</summary>
              <p>{access.requirement ? `Hold ${access.requirement} on Robinhood Chain mainnet to use the converter.` : "The hex converter is temporarily unavailable because its wallet access checks are not configured."} Checking your balance does not transfer funds.</p>
              <p>Encoding and decoding happen locally in your browser. Copy the result or preview an image to share on X.</p>
            </details>
          </section>
          <HexExample />
        </>}>
          {active => <HexWorkspace active={active} motion={motion} mode={mode} setMode={setMode} />}
        </SecurityGate>
        <footer><span>HEXONION / END OF TRANSMISSION<span className="terminal-cursor" aria-hidden="true" /></span><span>Hex tools and private message links.</span></footer>
      </main>
    </Providers>
  );
}
