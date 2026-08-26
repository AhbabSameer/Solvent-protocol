"use client";

import { useReadContract } from "wagmi";
import type { Address } from "viem";
import { solventEngineAbi } from "@/lib/abi/solventEngine";
import { erc20Abi } from "@/lib/abi/erc20";
import { SOLVENT_ENGINE_ADDRESS, BORROW_TOKEN_ADDRESS } from "@/lib/contracts";

/** USD value (1e18) of a user's current debt, live-accrued. */
export function useDebtValue(address: Address | undefined) {
  return useReadContract({
    address: SOLVENT_ENGINE_ADDRESS,
    abi: solventEngineAbi,
    functionName: "getAccountDebtValue",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
}

/** Wallet's sUSD token balance (borrowed funds available to repay with). */
export function useWalletBorrowBalance(address: Address | undefined) {
  return useReadContract({
    address: BORROW_TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
}

/** Live-accrued global borrow index (1e18 = 1.0x). */
export function useBorrowIndex() {
  return useReadContract({
    address: SOLVENT_ENGINE_ADDRESS,
    abi: solventEngineAbi,
    functionName: "getBorrowIndex",
  });
}
