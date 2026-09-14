"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { erc20Abi, formatUnits } from "viem";
import { useAccount, useReadContracts, useSwitchChain } from "wagmi";
import { developmentPolicy, hasTokenAccess, productionPolicy } from "../lib/tokenGate";

export type AccessPresentation = {
  granted: boolean;
  unavailable: boolean;
  requirement: string | null;
  enterWorkspace: () => void;
};

export function SecurityGate({ children, introduction }: {
  children: React.ReactNode | ((granted: boolean) => React.ReactNode);
  introduction?: (access: AccessPresentation) => React.ReactNode;
}) {
  const { address, isConnected, chainId } = useAccount();
  const { switchChain, isPending: switching } = useSwitchChain();
  const [sandbox, setSandbox] = useState(false);
  const workspace = useRef<HTMLDivElement>(null);
  const accessHeading = useRef<HTMLHeadingElement>(null);
  const pendingEntry = useRef(false);
  const focusWasInWorkspace = useRef(false);
  const checkedInitialHash = useRef(false);
  const development = process.env.NODE_ENV === "development";
  const canBypass = development && process.env.NEXT_PUBLIC_ENABLE_DEV_BYPASS === "true";
  const policy = development ? developmentPolicy(process.env.NEXT_PUBLIC_USDG_PROFILE) : productionPolicy({
    NEXT_PUBLIC_MEME_TOKEN_ADDRESS: process.env.NEXT_PUBLIC_MEME_TOKEN_ADDRESS,
    NEXT_PUBLIC_MEME_TOKEN_CHAIN_ID: process.env.NEXT_PUBLIC_MEME_TOKEN_CHAIN_ID,
    NEXT_PUBLIC_MEME_TOKEN_SYMBOL: process.env.NEXT_PUBLIC_MEME_TOKEN_SYMBOL,
    NEXT_PUBLIC_MEME_TOKEN_DECIMALS: process.env.NEXT_PUBLIC_MEME_TOKEN_DECIMALS,
    NEXT_PUBLIC_MEME_TOKEN_MIN_RAW: process.env.NEXT_PUBLIC_MEME_TOKEN_MIN_RAW,
  });
  const supported = policy && policy.chainId === 4663;
  const enabled = !!(supported && address && isConnected && chainId === policy.chainId);
  const contract = { address: policy?.address, abi: erc20Abi, chainId: policy?.chainId } as const;
  const query = useReadContracts({
    contracts: [
      { ...contract, functionName: "balanceOf", args: address ? [address] : undefined },
      { ...contract, functionName: "decimals" },
      { ...contract, functionName: "symbol" },
    ],
    allowFailure: false,
    query: { enabled, refetchInterval: 30_000, refetchOnWindowFocus: true, refetchOnReconnect: true, staleTime: 0, retry: 1 },
  });
  const balance = query.data?.[0];
  const decimals = query.data?.[1];
  const tokenSymbol = query.data?.[2];
  const metadataMatches = !!policy && decimals === policy.decimals && tokenSymbol === policy.symbol;
  const verified = !!(enabled && !query.isError && !query.isPending && metadataMatches && hasTokenAccess(balance, policy!.minimumRawBalance));
  const bypass = canBypass && sandbox;
  const granted = bypass || verified;
  const requirement = policy ? `${policy.minimumRawBalance === 0n ? "a positive balance of" : `at least ${formatUnits(policy.minimumRawBalance, policy.decimals)}`} ${policy.symbol}` : null;
  const focusWorkspace = useCallback(() => {
    workspace.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
  }, []);
  const enterWorkspace = useCallback(() => {
    if (granted) {
      pendingEntry.current = false;
      focusWorkspace();
    } else {
      pendingEntry.current = true;
      accessHeading.current?.focus();
    }
  }, [granted, focusWorkspace]);

  useEffect(() => {
    const trackFocus = (event: FocusEvent) => {
      focusWasInWorkspace.current = !!workspace.current?.contains(event.target as Node);
    };
    document.addEventListener("focusin", trackFocus);
    return () => document.removeEventListener("focusin", trackFocus);
  }, []);
  useEffect(() => {
    if (granted && pendingEntry.current) {
      pendingEntry.current = false;
      focusWorkspace();
    } else if (!granted && focusWasInWorkspace.current) {
      accessHeading.current?.focus();
    }
  }, [granted, focusWorkspace]);
  useEffect(() => {
    const followWorkspaceHash = () => {
      if (window.location.hash === "#hex-workspace") enterWorkspace();
    };
    if (!checkedInitialHash.current) {
      checkedInitialHash.current = true;
      followWorkspaceHash();
    }
    window.addEventListener("hashchange", followWorkspaceHash);
    return () => window.removeEventListener("hashchange", followWorkspaceHash);
  }, [enterWorkspace]);
  const heading = !supported ? "Hex tool access unavailable"
    : !isConnected ? "Check wallet access"
    : chainId !== policy.chainId ? "Switch to Robinhood Chain"
    : query.isPending ? "Checking your balance…"
    : query.isError || !metadataMatches ? "We couldn't check your balance"
    : `More ${policy.symbol} is needed`;
  const status = !supported ? "The hex converter is temporarily unavailable. Its wallet access checks are not configured. You can still explore the Bitcoin example or open Dead drop above."
    : !isConnected ? "Connect a wallet so HexOnion can check your token balance."
    : chainId !== policy.chainId ? "This tool checks holdings on Robinhood Chain mainnet."
    : query.isError ? "The balance check failed. Try again."
    : query.isPending ? "Checking your token balance…"
    : !metadataMatches ? "The token details could not be verified. Try the balance check again."
    : `Your balance: ${formatUnits(balance ?? 0n, policy.decimals)} ${policy.symbol}. Keep the required amount in your wallet to use the tool.`;

  return (
    <>
      {/* The slot forwards enterWorkspace to event handlers; it must not invoke it during render. */}
      {/* eslint-disable-next-line react-hooks/refs -- Event-only callback, no ref reads while rendering the introduction. */}
      {introduction?.({ granted, unavailable: !supported, requirement, enterWorkspace })}
      {granted ? <div className={`sandbox-banner ${bypass ? "" : "clearance-granted"}`}>
        <span><strong>{bypass ? "DEVELOPMENT SANDBOX" : "Ready to convert"}</strong><span className="clearance-detail">{bypass ? "Wallet balance check bypassed" : `Holding verified · ${formatUnits(balance!, decimals!)} ${tokenSymbol}`}</span></span>
        {!bypass && <ConnectButton accountStatus="address" chainStatus="none" showBalance={false} />}
        {bypass && <button type="button" className="small" onClick={() => setSandbox(false)}>Exit sandbox</button>}
      </div> : <section className="gate" id="hex-access" aria-labelledby="hex-access-title">
        <div className="gate-content"><span className="eyebrow">HEX TOOL ACCESS</span><h2 id="hex-access-title" ref={accessHeading} tabIndex={-1}>{heading}</h2>
          <p role="status">{status}</p>
          {requirement && <p className="gate-meta">Required: {requirement} · Robinhood Chain mainnet</p>}
          {supported && <p>Checking your balance does not transfer funds.</p>}
          <div className="gate-actions">
            {supported && <ConnectButton accountStatus="address" showBalance={false} />}
            {policy && supported && isConnected && chainId !== policy.chainId && <button type="button" disabled={switching} onClick={() => switchChain({ chainId: policy.chainId })}>Switch network</button>}
            {enabled && <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? "Checking…" : "Check again"}</button>}
            {canBypass && <button type="button" onClick={() => setSandbox(true)}>Enter development sandbox</button>}
          </div>
        </div>
        {supported && <ol className="clearance-steps" aria-label="Access checks">
          <li data-complete={isConnected}><span>01 / WALLET</span><strong>{isConnected ? "CONNECTED" : "AWAITING CONNECTION"}</strong></li>
          <li data-complete={!!enabled}><span>02 / NETWORK</span><strong>{!isConnected ? "AWAITING WALLET" : enabled ? "ROBINHOOD MAINNET" : "SWITCH REQUIRED"}</strong></li>
          <li data-complete={verified}><span>03 / TOKEN HOLDING</span><strong>{enabled && query.isFetching ? "CHECKING…" : enabled && query.isError ? "CHECK FAILED" : !enabled ? "AWAITING NETWORK" : "HOLDING REQUIRED"}</strong></li>
        </ol>}
      </section>}
      {/* Keep drafts mounted across transient RPC errors while hiding all gated controls. */}
      <div ref={workspace} hidden={!granted} inert={!granted}>{typeof children === "function" ? children(granted) : children}</div>
    </>
  );
}
