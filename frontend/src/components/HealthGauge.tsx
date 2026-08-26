"use client";

import { useMemo } from "react";
import { maxUint256 } from "viem";
import { formatHealthFactor, healthFactorStatus } from "@/lib/format";
import { useAnime } from "@/hooks/useAnime";

const SIZE = 220;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const STATUS_COLOR: Record<string, string> = {
  "no-debt": "#B6FF3C",
  healthy: "#B6FF3C",
  "at-risk": "#FFC24B",
  liquidatable: "#FF5C5C",
};

const STATUS_LABEL: Record<string, string> = {
  "no-debt": "no debt",
  healthy: "healthy",
  "at-risk": "at risk",
  liquidatable: "liquidatable",
};

/**
 * Health factor has no natural ceiling, so the gauge sweep maps HF in [0, 2.0] onto [0%, 100%]
 * — 1.0 (the liquidation line) sits at the halfway point, matching most users' intuitive reading.
 */
export function HealthGauge({ value }: { value: bigint | undefined }) {
  const status = value === undefined ? undefined : healthFactorStatus(value);

  const fraction = useMemo(() => {
    if (value === undefined) return 0;
    if (value === maxUint256) return 1;
    const hf = Number(value) / 1e18;
    return Math.max(0, Math.min(hf / 2, 1));
  }, [value]);

  const circleRef = useAnime<SVGCircleElement>(
    {
      strokeDashoffset: CIRCUMFERENCE * (1 - fraction),
      duration: 900,
      ease: "outExpo",
    },
    [fraction],
  );

  const color = status ? STATUS_COLOR[status] : "#8C8C86";

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: SIZE, height: SIZE }}
    >
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={STROKE}
          fill="none"
        />
        <circle
          ref={circleRef}
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-numeral text-4xl" style={{ color }}>
          {value === undefined ? "—" : formatHealthFactor(value)}
        </span>
        <span className="mt-1 text-xs tracking-widest text-muted uppercase">
          {status ? STATUS_LABEL[status] : "loading"}
        </span>
      </div>
    </div>
  );
}
