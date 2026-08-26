"use client";

import { useReadContract } from "wagmi";
import type { Address } from "viem";
import { solventEngineAbi } from "@/lib/abi/solventEngine";
import { SOLVENT_ENGINE_ADDRESS } from "@/lib/contracts";

export function useHealthFactor(address: Address | undefined) {
  return useReadContract({
    address: SOLVENT_ENGINE_ADDRESS,
    abi: solventEngineAbi,
    functionName: "getHealthFactor",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
}
