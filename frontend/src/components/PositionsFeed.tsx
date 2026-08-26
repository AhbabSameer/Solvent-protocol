"use client";

import { maxUint256, type Address } from "viem";
import { useBorrowerCandidates } from "@/hooks/useBorrowerCandidates";
import { useHealthFactors } from "@/hooks/useHealthFactors";
import {
  formatHealthFactor,
  healthFactorStatus,
  shortenAddress,
} from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  healthy: "Healthy",
  "at-risk": "At risk",
  liquidatable: "Liquidatable",
};

const STATUS_COLOR: Record<string, string> = {
  healthy: "text-accent",
  "at-risk": "text-warn",
  liquidatable: "text-danger",
};

/**
 * Client-side substitute for a "positions at risk" feed: scans Borrowed events since deployment
 * (useBorrowerCandidates), then batch-reads live health factors (useHealthFactors) and ranks by
 * risk. Positions with no outstanding debt (health factor == max uint256) are filtered out.
 */
export function PositionsFeed({
  onSelect,
}: {
  onSelect: (address: Address) => void;
}) {
  const { data: candidates, isLoading: candidatesLoading } =
    useBorrowerCandidates();
  const addresses = candidates ?? [];
  const { data: healthFactorResults, isLoading: healthFactorsLoading } =
    useHealthFactors(addresses);

  const rows = addresses
    .map((address, index) => ({
      address,
      healthFactor: healthFactorResults?.[index]?.result as bigint | undefined,
    }))
    .filter(
      (row): row is { address: Address; healthFactor: bigint } =>
        row.healthFactor !== undefined && row.healthFactor !== maxUint256,
    )
    .sort((a, b) => (a.healthFactor < b.healthFactor ? -1 : a.healthFactor > b.healthFactor ? 1 : 0));

  if (candidatesLoading || (addresses.length > 0 && healthFactorsLoading)) {
    return (
      <div className="border-t border-white/10 bg-ink px-6 py-8 text-sm text-muted sm:px-10">
        Scanning Borrowed events for active positions…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="border-t border-white/10 bg-ink px-6 py-8 text-sm text-muted sm:px-10">
        No open positions with outstanding debt found yet. Borrow from another
        wallet on the Deposit/Borrow screen to create one, then come back
        here — or enter an address manually below.
      </div>
    );
  }

  return (
    <div className="border-t border-white/10 bg-ink px-6 py-8 sm:px-10">
      <p className="mb-4 text-xs tracking-widest text-muted uppercase">
        Open positions, ranked by risk ({rows.length})
      </p>
      <div className="flex flex-col divide-y divide-white/10">
        {rows.map((row) => {
          const status = healthFactorStatus(row.healthFactor);
          return (
            <button
              key={row.address}
              type="button"
              onClick={() => onSelect(row.address)}
              className="flex items-center justify-between gap-4 py-4 text-left transition-colors hover:bg-panel"
            >
              <span className="font-mono text-sm text-bone">
                {shortenAddress(row.address)}
              </span>
              <span
                className={`text-numeral text-lg ${STATUS_COLOR[status] ?? "text-muted"}`}
              >
                {formatHealthFactor(row.healthFactor)}
              </span>
              <span className="text-xs tracking-widest text-muted uppercase">
                {STATUS_LABEL[status] ?? status} →
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
