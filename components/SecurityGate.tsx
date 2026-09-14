"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { erc20Abi, formatUnits } from "viem";
import { useAccount, useConfig, useSwitchChain } from "wagmi";
import { getConnectorClient, readContracts } from "wagmi/actions";
import { getChainId, readContract } from "viem/actions";
import { useQuery } from "@tanstack/react-query";
import { developmentPolicy, hasTokenAccess, productionPolicy } from "../lib/tokenGate";
import { runTokenCheckWithFallback, TokenCheckTimeoutError } from "../lib/tokenCheck";

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
  const { address, isConnected, chainId, connector } = useAccount();
  const config = useConfig();
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
  const query = useQuery({
    queryKey: ["token-access", connector?.uid, chainId, address, policy?.chainId, policy?.address, policy?.symbol, policy?.decimals, policy?.minimumRawBalance.toString()],
    queryFn: ({ signal }) => {
      if (!policy || !address || !enabled) throw new Error("Connect a wallet on the required network.");
      const contract = { address: policy.address, abi: erc20Abi, chainId: policy.chainId } as const;
      return runTokenCheckWithFallback(() => readContracts(config, {
        contracts: [
          { ...contract, functionName: "balanceOf", args: [address] },
          { ...contract, functionName: "decimals" },
          { ...contract, functionName: "symbol" },
        ],
        allowFailure: false,
      }), async () => {
        if (!connector) throw new Error("The wallet is no longer connected.");
        const wallet = await getConnectorClient(config, { connector, account: address, chainId: policy.chainId });
        // Read the provider's actual chain, not just the connector's cached chain.
        const assertNetwork = async () => {
          if (await getChainId(wallet) !== policy.chainId) throw new Error("Wallet network changed during the balance check.");
          if (signal.aborted) throw new DOMException("Check cancelled.", "AbortError");
        };
        await assertNetwork();
        const result = await Promise.all([
          readContract(wallet, { ...contract, functionName: "balanceOf", args: [address] }),
          readContract(wallet, { ...contract, functionName: "decimals" }),
          readContract(wallet, { ...contract, functionName: "symbol" }),
        ] as const);
        await assertNetwork();
        return result;
      }, signal);
    },
    enabled,
    // Failed checks stay actionable instead of restarting the spinner every 30 seconds.
    refetchInterval: current => current.state.status === "success" ? 30_000 : false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
    retry: false,
  });
  const balance = query.data?.[0];
  const decimals = query.data?.[1];
  const tokenSymbol = query.data?.[2];
  const metadataMatches = !!policy && decimals === policy.decimals && tokenSymbol === policy.symbol;
  const verified = !!(enabled && !query.isError && !query.isPending && !query.isPaused && metadataMatches && hasTokenAccess(balance, policy!.minimumRawBalance));
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
    : query.isPaused ? "You're offline"
    : query.isFetching ? "Checking your balance…"
    : query.error instanceof TokenCheckTimeoutError ? "The balance check timed out"
    : query.isPending ? "Checking your balance…"
    : query.isError || !metadataMatches ? "We couldn't check your balance"
    : `More ${policy.symbol} is needed`;
  const status = !supported ? "The hex converter is temporarily unavailable. Its wallet access checks are not configured. You can still explore the Bitcoin example or open Dead drop above."
    : !isConnected ? "Connect a wallet so HexOnion can check your token balance."
    : chainId !== policy.chainId ? "This tool checks holdings on Robinhood Chain mainnet."
    : query.isPaused ? "Reconnect to the internet to check your token balance. The check will resume when your connection returns."
    : query.error instanceof TokenCheckTimeoutError && !query.isFetching ? "The network did not respond within 12 seconds. Your balance has not been verified. Check your connection and try again."
    : query.isFetching ? "Reading your token balance from Robinhood Chain, using your wallet's connection if needed. This check can take up to 12 seconds."
    : query.isError ? "We couldn't read your balance through the website or your wallet. This does not mean your balance is zero. Check your wallet's Robinhood Chain connection and try again."
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
            {enabled && <button type="button" disabled={query.isFetching || query.isPaused} onClick={() => void query.refetch()}>{query.isPaused ? "Waiting for connection" : query.isFetching ? "Checking…" : "Check again"}</button>}
            {canBypass && <button type="button" onClick={() => setSandbox(true)}>Enter development sandbox</button>}
          </div>
        </div>
        {supported && <ol className="clearance-steps" aria-label="Access checks">
          <li data-complete={isConnected}><span>01 / WALLET</span><strong>{isConnected ? "CONNECTED" : "AWAITING CONNECTION"}</strong></li>
          <li data-complete={!!enabled}><span>02 / NETWORK</span><strong>{!isConnected ? "AWAITING WALLET" : enabled ? "ROBINHOOD MAINNET" : "SWITCH REQUIRED"}</strong></li>
          <li data-complete={verified}><span>03 / TOKEN HOLDING</span><strong>{!enabled ? "AWAITING NETWORK" : query.isPaused ? "OFFLINE" : query.isFetching ? "CHECKING…" : query.isError || !metadataMatches ? "CHECK FAILED" : "HOLDING REQUIRED"}</strong></li>
        </ol>}
      </section>}
      {/* Keep drafts mounted across transient RPC errors while hiding all gated controls. */}
      <div ref={workspace} hidden={!granted} inert={!granted}>{typeof children === "function" ? children(granted) : children}</div>
    </>
  );
}
