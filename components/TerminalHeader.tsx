"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

gsap.registerPlugin(useGSAP);

export function TerminalHeader({ motion, onToggleMotion }: {
  motion: boolean;
  onToggleMotion: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  useGSAP(() => {
    if (!motion) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(".terminal-command", { clipPath: "inset(0 100% 0 0)" }, {
        clipPath: "inset(0 0% 0 0)", duration: 1.2, ease: "steps(24)", clearProps: "clipPath",
      });
    });
    return () => media.revert();
  }, { scope: root, dependencies: [motion], revertOnUpdate: true });

  return <header className="terminal-header home-header" ref={root}>
    <div className="terminal-titlebar">
      <span><span className="status-square" aria-hidden="true" /> FIELD TERMINAL</span>
      <div className="terminal-tools">
        <button type="button" className="small motion-toggle" aria-pressed={motion} onClick={onToggleMotion}>Motion {motion ? "on" : "off"}</button>
        <span className="window-marks" aria-hidden="true">─ □ ×</span>
      </div>
    </div>
    <nav className="tool-navigation" aria-label="Tools">
      <a href="#hex-tool-title">Hex tool</a>
      <Link href="/dead-drop">Dead drop</Link>
    </nav>
    <div className="page-header">
      <div className="identity-lockup">
        <Image className="hexonion-logo" src="/hexonion-logo-generated.png" alt="HexOnion logo" width={220} height={220} priority />
        <div className="terminal-identity">
          <p className="command-line" aria-hidden="true"><span className="terminal-command">C:\HEXONION&gt; CHOOSE A TOOL</span><span className="terminal-cursor" /></p>
          <h1>HexOnion</h1>
          <h2 className="hero-message">Work with hex. Share private messages.</h2>
          <p className="intro">Two browser tools: convert text and inspect Bitcoin bytes, or share an encrypted message through a link that expires after 24 hours.</p>
        </div>
      </div>
    </div>
    <div className="tool-choices" role="group" aria-label="Choose a tool">
      <article className="tool-choice" aria-labelledby="hex-choice-title">
        <h3 id="hex-choice-title">Hex tool</h3>
        <p>Encode text or decode hexadecimal (hex). Conversion stays in your browser.</p>
        <a className="tool-entry" href="#hex-tool-title">Explore hex tool ↓</a>
        <p className="tool-access-note">Hex does not hide text. Wallet access applies to the converter.</p>
      </article>
      <article className="tool-choice" aria-labelledby="dead-drop-choice-title">
        <h3 id="dead-drop-choice-title">Dead drop</h3>
        <p>Create an encrypted message link. It expires after 24 hours.</p>
        <Link className="tool-entry" href="/dead-drop">Open Dead drop →</Link>
        <p className="tool-access-note">Create with an invitation code. Read with the complete link, no wallet needed.</p>
      </article>
    </div>
  </header>;
}
