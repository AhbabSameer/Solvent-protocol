import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
  injectedWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { APP_CHAIN } from "./contracts";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

if (!walletConnectProjectId && typeof window !== "undefined") {
  console.warn(
    "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set — get a free project ID at https://cloud.reown.com and add it to .env.local",
  );
}

export const wagmiConfig = getDefaultConfig({
  appName: "Solvent Protocol",
  projectId: walletConnectProjectId || "MISSING_WALLETCONNECT_PROJECT_ID",
  chains: [APP_CHAIN],
  ssr: true,
  // Deliberately excludes RainbowKit's default Coinbase/Base Account wallet: it pulls in
  // @coinbase/cdp-sdk, which lazy-imports optional @x402 payment packages we don't install,
  // breaking the Turbopack build. Not needed for a Sepolia testnet dApp anyway.
  wallets: [
    {
      groupName: "Recommended",
      wallets: [metaMaskWallet, rainbowWallet, walletConnectWallet, injectedWallet],
    },
  ],
});
