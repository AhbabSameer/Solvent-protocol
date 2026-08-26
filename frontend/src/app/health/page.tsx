"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { isAddress, type Address } from "viem";
import { Hero } from "@/components/Hero";
import { HealthGauge } from "@/components/HealthGauge";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useHealthFactor } from "@/hooks/useHealthFactor";
import { useCollateralValue } from "@/hooks/useCollateral";
import { useDebtValue } from "@/hooks/useDebt";
import { formatUsd1e18 } from "@/lib/format";

export default function HealthPage() {
  const { address: connectedAddress } = useAccount();
  const [lookup, setLookup] = useState("");

  const target: Address | undefined =
    lookup && isAddress(lookup) ? lookup : connectedAddress;

  const { data: healthFactor } = useHealthFactor(target);
  const { data: collateralValue } = useCollateralValue(target);
  const { data: debtValue } = useDebtValue(target);

  const revealRef = useScrollReveal<HTMLDivElement>();

  return (
    <>
      <Hero
        eyebrow="Screen 3 — Health Factor"
        title="Know where you stand."
        subtitle="Health factor = (collateral value × 80% liquidation threshold) / debt value. Below 1.0, a position can be liquidated."
      />

      <section
        ref={revealRef}
        className="grid gap-px border-t border-white/10 bg-white/5 lg:grid-cols-[auto_1fr]"
      >
        <div className="flex flex-col items-center justify-center gap-6 bg-ink p-10">
          <HealthGauge value={healthFactor} />
        </div>

        <div className="flex flex-col gap-8 bg-ink p-8 sm:p-10">
          <div>
            <label className="text-xs tracking-widest text-muted uppercase">
              Look up an address (defaults to your connected wallet)
            </label>
            <input
              type="text"
              placeholder={connectedAddress ?? "0x..."}
              value={lookup}
              onChange={(event) => setLookup(event.target.value)}
              className="mt-2 w-full border-b border-white/20 bg-transparent py-3 font-mono text-sm text-bone outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-xs tracking-widest text-muted uppercase">
                Collateral value
              </p>
              <p className="text-numeral text-3xl">
                ${formatUsd1e18(collateralValue ?? 0n)}
              </p>
            </div>
            <div>
              <p className="text-xs tracking-widest text-muted uppercase">
                Debt value
              </p>
              <p className="text-numeral text-3xl">
                ${formatUsd1e18(debtValue ?? 0n)}
              </p>
            </div>
          </div>

          {!target ? (
            <p className="text-sm text-muted">
              Connect your wallet, or enter an address above, to see a health
              factor.
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
