"use client";

import { useEffect, useMemo, useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { isAddress, type Address } from "viem";
import { Hero } from "@/components/Hero";
import { HealthGauge } from "@/components/HealthGauge";
import { ApproveAndAct } from "@/components/ApproveAndAct";
import { PositionsFeed } from "@/components/PositionsFeed";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useHealthFactor } from "@/hooks/useHealthFactor";
import { useCollateralValue, useCollateralBalance } from "@/hooks/useCollateral";
import { useDebtValue } from "@/hooks/useDebt";
import { solventEngineAbi } from "@/lib/abi/solventEngine";
import {
  SOLVENT_ENGINE_ADDRESS,
  BORROW_TOKEN_ADDRESS,
  BORROW_TOKEN_SYMBOL,
  COLLATERAL_TOKEN_SYMBOL,
  PROTOCOL_PARAMS,
  HEALTH_FACTOR_ONE,
} from "@/lib/contracts";
import { formatUsd1e18, formatToken, parseToken } from "@/lib/format";

export default function LiquidatePage() {
  const [targetInput, setTargetInput] = useState("");
  const target: Address | undefined = isAddress(targetInput)
    ? targetInput
    : undefined;

  const { data: healthFactor, refetch: refetchHealthFactor } =
    useHealthFactor(target);
  const { data: debtValue, refetch: refetchDebtValue } = useDebtValue(target);
  const { data: collateralValue, refetch: refetchCollateralValue } =
    useCollateralValue(target);
  const { data: collateralBalance, refetch: refetchCollateralBalance } =
    useCollateralBalance(target);

  const isLiquidatable =
    healthFactor !== undefined && healthFactor < HEALTH_FACTOR_ONE;

  const [debtToCover, setDebtToCover] = useState("");
  const debtToCoverWei = parseToken(debtToCover);

  const { collateralToSeize, bonusCollateral } = useMemo(() => {
    if (!collateralValue || collateralValue === 0n || !collateralBalance) {
      return { collateralToSeize: 0n, bonusCollateral: 0n };
    }
    const seize = (debtToCoverWei * collateralBalance) / collateralValue;
    const bonus = (seize * PROTOCOL_PARAMS.liquidationBonusBps) / PROTOCOL_PARAMS.denominatorBps;
    return { collateralToSeize: seize, bonusCollateral: bonus };
  }, [debtToCoverWei, collateralValue, collateralBalance]);

  const refetchAll = () => {
    refetchHealthFactor();
    refetchDebtValue();
    refetchCollateralValue();
    refetchCollateralBalance();
  };

  const {
    writeContract: liquidate,
    data: liquidateHash,
    isPending: liquidatePending,
  } = useWriteContract();
  const { isLoading: liquidateConfirming, isSuccess: liquidateConfirmed } =
    useWaitForTransactionReceipt({ hash: liquidateHash });

  useEffect(() => {
    if (liquidateConfirmed) refetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liquidateConfirmed]);

  const revealRef = useScrollReveal<HTMLDivElement>();

  return (
    <>
      <Hero
        eyebrow="Screen 5 — Liquidate"
        title="Keep the market solvent."
        subtitle="Cover part of an unhealthy position's debt and receive its collateral at a 10% discount. A position must have a health factor below 1.0 to be liquidated."
      />

      <PositionsFeed onSelect={(address) => setTargetInput(address)} />

      <div className="border-t border-white/10 bg-ink px-6 py-8 sm:px-10">
        <label className="text-xs tracking-widest text-muted uppercase">
          Target address
        </label>
        <input
          type="text"
          placeholder="0x..."
          value={targetInput}
          onChange={(event) => setTargetInput(event.target.value)}
          className="mt-2 w-full max-w-xl border-b border-white/20 bg-transparent py-3 font-mono text-sm text-bone outline-none focus:border-accent"
        />
      </div>

      {!target ? (
        <p className="px-6 pb-24 text-muted sm:px-10">
          Enter a valid address to check its health factor.
        </p>
      ) : (
        <section
          ref={revealRef}
          className="grid gap-px border-t border-white/10 bg-white/5 lg:grid-cols-[auto_1fr]"
        >
          <div className="flex flex-col items-center justify-center gap-6 bg-ink p-10">
            <HealthGauge value={healthFactor} />
          </div>

          <div className="flex flex-col gap-6 bg-ink p-8 sm:p-10">
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

            {!isLiquidatable ? (
              <p className="text-sm text-muted">
                This position is healthy and cannot be liquidated.
              </p>
            ) : (
              <>
                <label className="text-xs tracking-widest text-muted uppercase">
                  Debt to cover ({BORROW_TOKEN_SYMBOL})
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0.0"
                  value={debtToCover}
                  onChange={(event) => setDebtToCover(event.target.value)}
                  className="border-b border-white/20 bg-transparent py-3 text-2xl text-bone outline-none focus:border-accent"
                />
                <p className="text-sm text-muted">
                  You&rsquo;ll receive ~
                  {formatToken(collateralToSeize + bonusCollateral)}{" "}
                  {COLLATERAL_TOKEN_SYMBOL} ({formatToken(bonusCollateral)}{" "}
                  bonus)
                </p>
                <ApproveAndAct
                  token={BORROW_TOKEN_ADDRESS}
                  amount={debtToCoverWei}
                  actionLabel="Liquidate"
                  actPending={liquidatePending || liquidateConfirming}
                  onAct={() => {
                    liquidate({
                      address: SOLVENT_ENGINE_ADDRESS,
                      abi: solventEngineAbi,
                      functionName: "liquidate",
                      args: [target, debtToCoverWei],
                    });
                    setDebtToCover("");
                  }}
                />
              </>
            )}
          </div>
        </section>
      )}
    </>
  );
}
