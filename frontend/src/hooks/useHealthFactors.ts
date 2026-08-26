"use client";

import { useReadContracts } from "wagmi";
import type { Address } from "viem";
import { solventEngineAbi } from "@/lib/abi/solventEngine";
import { SOLVENT_ENGINE_ADDRESS } from "@/lib/contracts";

/** Batches getHealthFactor across many addresses in one multicall — used to rank borrowers by risk. */
export function useHealthFactors(addresses: Address[]) {
  return useReadContracts({
    contracts: addresses.map((address) => ({
      address: SOLVENT_ENGINE_ADDRESS,
      abi: solventEngineAbi,
      functionName: "getHealthFactor",
      args: [address],
    } as const)),
    query: { enabled: addresses.length > 0 },
  });
}
