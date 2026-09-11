"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, lightTheme, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { WagmiProvider, createConfig, http, injected } from "wagmi";
import { defineChain } from "viem";
import { useState } from "react";
import "@rainbow-me/rainbowkit/styles.css";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const robinhood = defineChain({ id: 4663, name: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } }, blockExplorers: { default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" } } });
const transports = {
  [robinhood.id]: http(process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com"),
};
const chains = [robinhood] as const;
const config = projectId
  ? getDefaultConfig({ appName: "Bitcoin Hex", projectId, chains, transports, ssr: true })
  : createConfig({ chains, connectors: [injected()], transports, ssr: true });
const theme = lightTheme({ accentColor: "#17230f", accentColorForeground: "#a5be68", borderRadius: "none", overlayBlur: "small" });
theme.fonts.body = "var(--font-nokia-body), monospace";
Object.assign(theme.colors, {
  connectButtonBackground: "#17230f", connectButtonText: "#c4d991",
  connectButtonInnerBackground: "#283913", connectButtonBackgroundError: "#283913",
  connectButtonTextError: "#c4d991",
  modalBackground: "#a5be68", modalBorder: "#586f32", modalText: "#17230f",
  modalTextDim: "#354622", modalTextSecondary: "#354622", modalBackdrop: "#17230fcc",
  generalBorder: "#586f32", generalBorderDim: "#718840", menuItemBackground: "#bed587",
  actionButtonBorder: "#586f32", actionButtonSecondaryBackground: "#bed587",
  closeButton: "#17230f", closeButtonBackground: "#91ad50",
  profileAction: "#91ad50", profileActionHover: "#bed587", profileForeground: "#a5be68",
});
theme.shadows.connectButton = "inset 0 0 0 1px #586f32, 3px 3px 0 #586f3244";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return <WagmiProvider config={config}><QueryClientProvider client={queryClient}><RainbowKitProvider theme={theme}>{children}</RainbowKitProvider></QueryClientProvider></WagmiProvider>;
}
