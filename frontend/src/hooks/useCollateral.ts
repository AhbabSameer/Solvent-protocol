"use client";

import { useReadContract } from "wagmi";
import type { Address } from "viem";
import { solventEngineAbi } from "@/lib/abi/solventEngine";
import { erc20Abi } from "@/lib/abi/erc20";
import { SOLVENT_ENGINE_ADDRESS, COLLATERAL_TOKEN_ADDRESS } from "@/lib/contracts";

/** USD value (1e18) of a user's deposited collateral, per the live oracle price. */
export function useCollateralValue(address: Address | undefined) {
  return useReadContract({
    address: SOLVENT_ENGINE_ADDRESS,
    abi: solventEngineAbi,
    functionName: "getAccountCollateralValue",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
}

/** Raw sCOL amount a user has deposited into the engine. */
export function useCollateralBalance(address: Address | undefined) {
  return useReadContract({
    address: SOLVENT_ENGINE_ADDRESS,
    abi: solventEngineAbi,
    functionName: "getCollateralBalance",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
}

/** Wallet's sCOL token balance (not yet deposited). */
export function useWalletCollateralBalance(address: Address | undefined) {
  return useReadContract({
    address: COLLATERAL_TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
}
