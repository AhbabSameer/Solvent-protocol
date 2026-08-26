"use client";

import { useReadContract } from "wagmi";
import type { Address } from "viem";
import { erc20Abi } from "@/lib/abi/erc20";
import { SOLVENT_ENGINE_ADDRESS } from "@/lib/contracts";

/** How much of `token` the SolventEngine is currently allowed to pull from `owner`. */
export function useAllowance(token: Address, owner: Address | undefined) {
  return useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: owner ? [owner, SOLVENT_ENGINE_ADDRESS] : undefined,
    query: { enabled: Boolean(owner) },
  });
}
