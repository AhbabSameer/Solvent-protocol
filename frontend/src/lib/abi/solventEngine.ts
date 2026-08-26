/**
 * Hand-written ABI mirroring src/SolventEngine.sol + src/interfaces/ISolventEngine.sol.
 * Kept minimal: only the functions/events/errors the frontend actually calls or decodes.
 * Fixed protocol parameters (LTV, thresholds, etc.) are NOT read from chain here — they're
 * mirrored as constants in lib/contracts.ts per SPEC.md §6, since they never change post-deploy.
 */
export const solventEngineAbi = [
  {
    type: "function",
    name: "depositCollateral",
    stateMutability: "nonpayable",
    inputs: [{ name: "_amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawCollateral",
    stateMutability: "nonpayable",
    inputs: [{ name: "_amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "borrow",
    stateMutability: "nonpayable",
    inputs: [{ name: "_amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "repay",
    stateMutability: "nonpayable",
    inputs: [{ name: "_amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "liquidate",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_user", type: "address" },
      { name: "_debtToCover", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getHealthFactor",
    stateMutability: "view",
    inputs: [{ name: "_user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getAccountCollateralValue",
    stateMutability: "view",
    inputs: [{ name: "_user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getAccountDebtValue",
    stateMutability: "view",
    inputs: [{ name: "_user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getCollateralBalance",
    stateMutability: "view",
    inputs: [{ name: "_user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getBorrowIndex",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "CollateralDeposited",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "CollateralWithdrawn",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Borrowed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Repaid",
    inputs: [
      { name: "onBehalfOf", type: "address", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Liquidated",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "liquidator", type: "address", indexed: true },
      { name: "debtCovered", type: "uint256", indexed: false },
      { name: "collateralSeized", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "InterestAccrued",
    inputs: [
      { name: "borrowIndex", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  { type: "error", name: "SolventEngine__NeedsMoreThanZero", inputs: [] },
  {
    type: "error",
    name: "SolventEngine__ExceedsLoanToValue",
    inputs: [
      { name: "debtValueUsd", type: "uint256" },
      { name: "maxBorrowableUsd", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "SolventEngine__BreaksHealthFactor",
    inputs: [{ name: "healthFactor", type: "uint256" }],
  },
  { type: "error", name: "SolventEngine__InsufficientCollateral", inputs: [] },
  { type: "error", name: "SolventEngine__RepayExceedsDebt", inputs: [] },
  { type: "error", name: "SolventEngine__HealthFactorOk", inputs: [] },
  {
    type: "error",
    name: "SolventEngine__DebtToCoverExceedsUserDebt",
    inputs: [],
  },
  { type: "error", name: "SolventEngine__InvalidPrice", inputs: [] },
  { type: "error", name: "SolventEngine__StalePrice", inputs: [] },
  { type: "error", name: "SolventEngine__LiquidationFailed", inputs: [] },
] as const;
