"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { Address } from "viem";
import { SOLVENT_ENGINE_ADDRESS, DEPLOYMENT_BLOCK } from "@/lib/contracts";

const borrowedEventAbi = [
  {
    type: "event",
    name: "Borrowed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

/**
 * v1 SolventEngine has no on-chain enumerable borrower list (mappings aren't iterable) — this
 * is the standard client-side substitute liquidation bots use: scan Borrowed events since
 * deployment for every address that has ever taken on debt. Some may have since fully repaid;
 * useHealthFactors filters those out (health factor reads as "no debt" / max uint256).
 */
export function useBorrowerCandidates() {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ["borrower-candidates", SOLVENT_ENGINE_ADDRESS],
    queryFn: async (): Promise<Address[]> => {
      if (!publicClient) return [];
      const logs = await publicClient.getLogs({
        address: SOLVENT_ENGINE_ADDRESS,
        event: borrowedEventAbi[0],
        fromBlock: DEPLOYMENT_BLOCK,
        toBlock: "latest",
      });
      const addresses = new Set<Address>();
      for (const log of logs) {
        if (log.args.user) addresses.add(log.args.user);
      }
      return Array.from(addresses);
    },
    enabled: Boolean(publicClient),
    staleTime: 30_000,
  });
}
