"use client";

import { useRef } from "react";
import Image from "next/image";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

gsap.registerPlugin(useGSAP);

export function TerminalHeader({
  motion,
  onToggleMotion,
}: {
  motion: boolean;
  onToggleMotion: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      if (!motion) return;
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".boot-line", {
          opacity: 0,
          x: -6,
          stagger: 0.16,
          duration: 0.25,
          ease: "steps(4)",
          clearProps: "all",
        });
        gsap.fromTo(
          ".terminal-command",
          { clipPath: "inset(0 100% 0 0)" },
          {
            clipPath: "inset(0 0% 0 0)",
            duration: 1.2,
            ease: "steps(24)",
            clearProps: "clipPath",
          },
        );
        gsap.to(".activity-bars i", {
          scaleY: 0.35,
          transformOrigin: "bottom",
          duration: 1.1,
          stagger: { each: 0.12, from: "center" },
          repeat: -1,
          yoyo: true,
          ease: "steps(4)",
        });
      });
      return () => media.revert();
    },
    { scope: root, dependencies: [motion], revertOnUpdate: true },
  );

  return (
    <header className="terminal-header" ref={root}>
      <div className="terminal-titlebar">
        <span>
          <span className="status-square" aria-hidden="true" /> FIELD TERMINAL
        </span>
        <div className="terminal-tools">
          <button
            type="button"
            className="small motion-toggle"
            aria-pressed={motion}
            onClick={onToggleMotion}
          >
            Motion {motion ? "on" : "off"}
          </button>
          <span className="window-marks" aria-hidden="true">
            ─ □ ×
          </span>
        </div>
      </div>
      <div className="page-header">
        <div className="identity-lockup">
          <Image
            className="hexonion-logo"
            src="/hexonion-logo.webp"
            alt="HexOnion logo"
            width={220}
            height={220}
            priority
          />
          <div className="terminal-identity">
            <p className="command-line" aria-hidden="true">
              <span className="terminal-command">C:\HEXONION&gt; RUN CODEC.EXE</span>
              <span className="terminal-cursor" />
            </p>
            <h1>HexOnion</h1>
            <p className="terminal-subtitle">
              ENCODER <span aria-hidden="true">/</span> DECODER
            </p>
            <p className="intro">
              Messages hide in plain sight.
              <br />
              Turn words into bytes. Read between the lines.
            </p>
          </div>
        </div>
        <aside className="session-panel" aria-label="Terminal information">
          <div className="session-heading">
            <span>SESSION BRIEF</span>
            <span className="activity-bars" aria-hidden="true">
              {[8, 15, 11, 22, 17, 25, 13, 19].map((height, index) => (
                <i key={index} style={{ height }} />
              ))}
            </span>
          </div>
          <dl>
            <div className="boot-line">
              <dt>NETWORK</dt>
              <dd>ROBINHOOD MAINNET</dd>
            </div>
            <div className="boot-line">
              <dt>PROCESSING</dt>
              <dd>LOCAL / IN BROWSER</dd>
            </div>
            <div className="boot-line">
              <dt>CAPABILITY</dt>
              <dd>ENCODE · DECODE</dd>
            </div>
          </dl>
          <div className="header-wallet">
            <ConnectButton
              accountStatus="address"
              chainStatus="icon"
              showBalance={false}
            />
          </div>
        </aside>
      </div>
      <div className="terminal-ruler" aria-hidden="true">
        <span>01 — ACCESS</span>
        <span>02 — INSPECT</span>
        <span>03 — TRANSMIT</span>
      </div>
    </header>
  );
}
