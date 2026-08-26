"use client";

import { formatUnits } from "viem";
import { useBorrowIndex } from "@/hooks/useDebt";
import { useAnime } from "@/hooks/useAnime";
import { PROTOCOL_PARAMS } from "@/lib/contracts";

const APR_PERCENT = Number(PROTOCOL_PARAMS.interestRateBps) / 100;
const LTV_PERCENT = Number(PROTOCOL_PARAMS.loanToValueBps) / 100;
const LIQ_THRESHOLD_PERCENT =
  Number(PROTOCOL_PARAMS.liquidationThresholdBps) / 100;
const LIQ_BONUS_PERCENT = Number(PROTOCOL_PARAMS.liquidationBonusBps) / 100;

export function StatTicker() {
  const { data: borrowIndex } = useBorrowIndex();

  const items = [
    `FIXED APR ${APR_PERCENT.toFixed(2)}%`,
    `LOAN-TO-VALUE ${LTV_PERCENT.toFixed(0)}%`,
    `LIQUIDATION THRESHOLD ${LIQ_THRESHOLD_PERCENT.toFixed(0)}%`,
    `LIQUIDATION BONUS ${LIQ_BONUS_PERCENT.toFixed(0)}%`,
    `BORROW INDEX ${borrowIndex ? Number(formatUnits(borrowIndex, 18)).toFixed(6) : "—"}`,
    "SEPOLIA TESTNET — NOT AUDITED",
  ];

  const trackRef = useAnime<HTMLDivElement>(
    { translateX: ["0%", "-50%"], duration: 18000, loop: true, ease: "linear" },
    [],
  );

  const content = items.join("   ·   ");

  return (
    <div className="overflow-hidden border-y border-white/10 bg-panel py-3">
      <div
        ref={trackRef}
        className="flex w-max gap-4 text-xs tracking-widest text-muted uppercase whitespace-nowrap"
      >
        <span className="pr-4">{content}</span>
        <span className="pr-4">{content}</span>
      </div>
    </div>
  );
}
