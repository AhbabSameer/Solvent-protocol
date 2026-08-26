import { formatUnits, parseUnits, maxUint256 } from "viem";

/** SolventEngine USD-value and health-factor figures are all scaled to 1e18, per PRECISION. */
export function formatUsd1e18(value: bigint, fractionDigits = 2): string {
  const asString = formatUnits(value, 18);
  const asNumber = Number(asString);
  return asNumber.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** Health factor is 1e18-scaled (1e18 = 1.0); type(uint256).max means "no debt". */
export function formatHealthFactor(value: bigint): string {
  if (value === maxUint256) return "∞";
  return (Number(formatUnits(value, 18))).toFixed(2);
}

export function healthFactorStatus(
  value: bigint,
): "no-debt" | "healthy" | "at-risk" | "liquidatable" {
  if (value === maxUint256) return "no-debt";
  const asNumber = Number(formatUnits(value, 18));
  if (asNumber < 1) return "liquidatable";
  if (asNumber < 1.2) return "at-risk";
  return "healthy";
}

/** sCOL/sUSD are both standard 18-decimal MockERC20 tokens. */
export function formatToken(value: bigint, fractionDigits = 4): string {
  const asNumber = Number(formatUnits(value, 18));
  return asNumber.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  });
}

export function parseToken(value: string): bigint {
  return parseUnits(value || "0", 18);
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
