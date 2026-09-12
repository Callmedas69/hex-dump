"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { decodeAscii, decodeUtf8, discoverTextRuns, encodeText, formatDump, parseOffsetDump, parseRawHex, toHex, type ParsedHex } from "../lib/hexCodec";
import { GENESIS_BLOCK_HEX, GENESIS_MESSAGE } from "../lib/fixtures/bitcoinGenesis";
import { SecurityGate } from "../components/SecurityGate";
import ShareDialog from "../components/ShareDialog";
import { TerminalHeader } from "../components/TerminalHeader";
import { Providers } from "./providers";

gsap.registerPlugin(useGSAP);
const PAGE_BYTES = 512;

function HexWorkspace({ active, motion }: { active: boolean; motion: boolean }) {
  const root = useRef<HTMLElement>(null);
  const audio = useRef<AudioContext | null>(null);
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [text, setText] = useState(GENESIS_MESSAGE);
  const [hex, setHex] = useState(() => formatDump(parseRawHex(GENESIS_BLOCK_HEX).bytes));
  const [format, setFormat] = useState<"raw" | "dump">("dump");
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
    setMode("decode"); setFormat("dump");
    setHex(formatDump(full ? parseRawHex(GENESIS_BLOCK_HEX).bytes : encodeText(GENESIS_MESSAGE)));
    resetSelection();
  }

  return (
    <section ref={root} className="workspace">
      <div className="workspace-bar reveal"><span><span className="status-square" aria-hidden="true" /> HEXONION WORKSPACE / SESSION ACTIVE</span><button type="button" className="small" aria-pressed={sound} onClick={() => setSound(!sound)}>Sound {sound ? "on" : "off"}</button></div>
      <div className="tabs reveal" role="tablist" aria-label="Conversion mode">
        <button type="button" role="tab" aria-selected={mode === "decode"} className={mode === "decode" ? "active" : ""} onClick={() => { setMode("decode"); resetSelection(); }}>Decode hex → text</button>
        <button type="button" role="tab" aria-selected={mode === "encode"} className={mode === "encode" ? "active" : ""} onClick={() => { setMode("encode"); resetSelection(); }}>Encode text → hex</button>
      </div>
      <div className="input-area reveal">
        <div className="panel-head">
          <label htmlFor="hex-input"><span className="panel-index">01</span> {mode === "encode" ? "YOUR TEXT" : "PASTE BITCOIN BYTES"}</label>
          {mode === "decode" && <label className="format-label">Input format <select aria-label="Input format" value={format} onChange={event => { setFormat(event.target.value as "raw" | "dump"); resetSelection(); }}><option value="raw">Raw hex</option><option value="dump">Offset dump</option></select></label>}
        </div>
        <textarea id="hex-input" aria-describedby="input-help" spellCheck={false} value={mode === "encode" ? text : hex} onChange={event => { if (mode === "encode") setText(event.target.value); else setHex(event.target.value); resetSelection(); blip(); }} />
        <div className="input-footer"><p id="input-help">{mode === "encode" ? "Text becomes UTF-8 bytes. Emoji and Unicode are supported." : "Paste raw bytes or an offset dump. Offsets are labels, not payload."} · 64 KiB maximum.</p><div className="preset-actions"><button type="button" onClick={() => preset(true)}>Genesis block</button><button type="button" onClick={() => preset(false)}>Message only</button></div></div>
      </div>
      {parsed.error && <p className="error" role="alert">{parsed.error}</p>}
      {parsed.warning && <p className="warning" role="status">{parsed.warning} Complete the final byte before sharing.</p>}
      <div className="inspector reveal">
        <section className="byte-panel" aria-label="Hex byte grid">
          <div className="panel-head"><span><span className="panel-index">02</span> BYTE GRID</span><span>{parsed.bytes.length.toLocaleString()} bytes</span></div>
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
          {mode === "decode" && <div className="viewtabs" aria-label="Output view">{(["ascii", "utf8", "dump"] as const).map(item => <button type="button" key={item} aria-pressed={view === item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item === "ascii" ? "ASCII" : item === "utf8" ? "UTF-8" : "Hex dump"}</button>)}</div>}
          {output.error ? <p className="error output-error" role="status">{output.error}</p> : <pre className={view === "dump" && mode === "decode" ? "dump-output" : ""}>{output.text || "Waiting for bytes…"}</pre>}
          <p className="output-note">{mode === "encode" ? "Two hexadecimal digits represent one byte." : "ASCII inspection shows non-printable bytes as dots. Original bytes are preserved."}</p>
        </section>
      </div>
      <div className="buffer-status"><span>BUFFER / {parsed.bytes.length.toLocaleString()} OF 65,536 BYTES</span><meter min={0} max={65536} value={parsed.bytes.length} aria-label="Input buffer usage" /><span>{parsed.error ? "INPUT REJECTED" : parsed.warning ? "INCOMPLETE BYTE" : "AWAITING COMMAND"}<span className="terminal-cursor" aria-hidden="true" /></span></div>
      {mode === "decode" && <section className="discovery reveal" aria-label="Readable text discovery"><div className="discovery-title"><span className="eyebrow">READABLE TEXT DISCOVERY</span><strong>{runs.length} candidate{runs.length === 1 ? "" : "s"} found</strong><p>Choose a passage to highlight its bytes. Binary data can also look like text.</p></div><div className="candidate-list">{runs.map(run => <button type="button" key={run.start} aria-pressed={selected?.start === run.start} className={selected?.start === run.start ? "active" : ""} onClick={() => { setSelectedStart(run.start); setPage(Math.floor(run.start / PAGE_BYTES)); }}><span>{(parsed.baseOffset + run.start).toString(16).padStart(8, "0")}–{(parsed.baseOffset + run.end - 1).toString(16).padStart(8, "0")}</span><span className="candidate-text">{run.text}</span></button>)}</div></section>}
      <div className="actions"><span className="notice" role="status">{notice}</span><button type="button" onClick={() => { if (mode === "encode") setText(""); else setHex(""); resetSelection(); }}>Clear</button><button type="button" onClick={() => { setText(GENESIS_MESSAGE); preset(true); }}>Reset</button><button type="button" className="primary" disabled={!parsed.bytes.length || !!parsed.error || !!parsed.warning} onClick={() => setShare(true)}>Share result ↗</button></div>
      {active && share && <ShareDialog bytes={parsed.bytes} mode={mode} baseOffset={parsed.baseOffset} selection={selected} onClose={() => setShare(false)} />}
    </section>
  );
}

export default function Home() {
  const [motion, setMotion] = useState(true);
  return <Providers><main className="shell" data-motion={motion ? "on" : "off"}><TerminalHeader motion={motion} onToggleMotion={() => setMotion(!motion)} /><SecurityGate>{active => <HexWorkspace active={active} motion={motion} />}</SecurityGate><footer><span>HEXONION / END OF TRANSMISSION<span className="terminal-cursor" aria-hidden="true" /></span><span>Text becomes bytes. Bytes reveal stories.</span></footer></main></Providers>;
}
