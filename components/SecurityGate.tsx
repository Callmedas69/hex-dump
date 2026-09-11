"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { erc20Abi, formatUnits } from "viem";
import { useAccount, useChainId, useReadContracts, useSwitchChain } from "wagmi";
import { developmentPolicy, hasTokenAccess, productionPolicy } from "../lib/tokenGate";

export function SecurityGate({ children }: { children: React.ReactNode | ((granted: boolean) => React.ReactNode) }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();
  const [sandbox, setSandbox] = useState(false);
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
  const status = !policy ? development ? "The development token profile is invalid." : "The production meme token has not been configured yet."
    : !supported ? "This token's network is not supported by this deployment."
    : !isConnected ? "Connect your wallet to check the required token balance."
    : chainId !== policy.chainId ? "Switch networks to check your token balance."
    : query.isError ? "The token balance could not be checked. Please retry."
    : query.isPending ? "Checking your token balance…"
    : !metadataMatches ? "Token metadata does not match this deployment's configuration."
    : "Your balance does not meet the token requirement.";

  return (
    <>
      {granted ? <div className={`sandbox-banner ${bypass ? "" : "clearance-granted"}`}>
        <span><strong>{bypass ? "DEVELOPMENT SANDBOX" : "ACCESS GRANTED"}</strong><span className="clearance-detail">{bypass ? "Wallet balance check bypassed" : `Holding verified · ${formatUnits(balance!, decimals!)} ${tokenSymbol}`}</span></span>
        {bypass && <button type="button" className="small" onClick={() => setSandbox(false)}>Exit sandbox</button>}
      </div> : <section className="gate" aria-label="Token access">
        <div className="gate-content"><span className="eyebrow">ACCESS CONTROL / TOKEN HOLDING</span><h2>{!isConnected ? "IDENTIFY YOURSELF" : query.isFetching && enabled ? "VERIFYING HOLDING" : "CLEARANCE REQUIRED"}</h2>
          <strong>{development ? "USDG development gate" : "Meme-token access"}</strong>
          <p role="status">{status}</p>
          {policy && <p className="gate-meta">Required: {policy.minimumRawBalance === 0n ? "a positive balance of" : `at least ${formatUnits(policy.minimumRawBalance, policy.decimals)}`} {policy.symbol} · {policy.chainId === 4663 ? "Robinhood Chain mainnet" : policy.chainId}</p>}
          <div className="gate-actions">
            <ConnectButton accountStatus="address" showBalance={false} />
            {policy && supported && isConnected && chainId !== policy.chainId && <button type="button" disabled={switching} onClick={() => switchChain({ chainId: policy.chainId })}>Switch network</button>}
            {enabled && <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? "Checking…" : "Check again"}</button>}
            {canBypass && <button type="button" onClick={() => setSandbox(true)}>Enter development sandbox</button>}
          </div>
        </div>
        <ol className="clearance-steps" aria-label="Access checks">
          <li data-complete={isConnected}><span>01 / WALLET</span><strong>{isConnected ? "CONNECTED" : "AWAITING CONNECTION"}</strong></li>
          <li data-complete={!!enabled}><span>02 / NETWORK</span><strong>{!isConnected ? "AWAITING WALLET" : enabled ? "ROBINHOOD MAINNET" : "SWITCH REQUIRED"}</strong></li>
          <li data-complete={verified}><span>03 / TOKEN HOLDING</span><strong>{enabled && query.isFetching ? "CHECKING…" : enabled && query.isError ? "CHECK FAILED" : !enabled ? "AWAITING NETWORK" : "HOLDING REQUIRED"}</strong></li>
        </ol>
      </section>}
      {/* Keep drafts mounted across transient RPC errors while hiding all gated controls. */}
      <div hidden={!granted} inert={!granted}>{typeof children === "function" ? children(granted) : children}</div>
    </>
  );
}
