import { sepolia } from "wagmi/chains";

export const SOLVENT_ENGINE_ADDRESS =
  "0xDfa279C4e8C5AbeA4E281f3a23bBF218143c4460" as const;

export const COLLATERAL_TOKEN_ADDRESS =
  "0x656caD812DA3023BD1Ab2f4c5a0fCed40082b50E" as const;

export const BORROW_TOKEN_ADDRESS =
  "0x550Fe5cc9345c79075FFB1dB9F9C9B6EBc121931" as const;

export const COLLATERAL_TOKEN_SYMBOL = "sCOL";
export const BORROW_TOKEN_SYMBOL = "sUSD";

export const APP_CHAIN = sepolia;

/** Block SolventEngine was deployed at (SPEC.md §11) — scan for Borrowed events from here on. */
export const DEPLOYMENT_BLOCK = 11571218n;

/** Basis-point protocol parameters, fixed in SPEC.md §6 — mirror src/SolventEngine.sol constants. */
export const PROTOCOL_PARAMS = {
  loanToValueBps: 7500n,
  liquidationThresholdBps: 8000n,
  liquidationBonusBps: 1000n,
  denominatorBps: 10000n,
  interestRateBps: 500n,
  stalenessThresholdSeconds: 3n * 60n * 60n,
} as const;

export const PRECISION = 10n ** 18n;
export const HEALTH_FACTOR_ONE = 10n ** 18n;
