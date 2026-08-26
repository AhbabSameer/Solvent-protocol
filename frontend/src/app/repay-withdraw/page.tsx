"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { maxUint256 } from "viem";
import { Hero } from "@/components/Hero";
import { ApproveAndAct } from "@/components/ApproveAndAct";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useCollateralValue, useCollateralBalance } from "@/hooks/useCollateral";
import { useDebtValue, useWalletBorrowBalance } from "@/hooks/useDebt";
import { solventEngineAbi } from "@/lib/abi/solventEngine";
import {
  SOLVENT_ENGINE_ADDRESS,
  BORROW_TOKEN_ADDRESS,
  BORROW_TOKEN_SYMBOL,
  COLLATERAL_TOKEN_SYMBOL,
  PROTOCOL_PARAMS,
} from "@/lib/contracts";
import { formatUsd1e18, formatToken, formatHealthFactor, parseToken } from "@/lib/format";

export default function RepayWithdrawPage() {
  const { address } = useAccount();

  const { data: debtValue, refetch: refetchDebtValue } = useDebtValue(address);
  const { data: walletBorrowBalance, refetch: refetchWalletBorrowBalance } =
    useWalletBorrowBalance(address);
  const { data: collateralValue, refetch: refetchCollateralValue } =
    useCollateralValue(address);
  const { data: collateralBalance, refetch: refetchCollateralBalance } =
    useCollateralBalance(address);

  const [repayAmount, setRepayAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const repayAmountWei = parseToken(repayAmount);
  const withdrawAmountWei = parseToken(withdrawAmount);

  const refetchAll = () => {
    refetchDebtValue();
    refetchWalletBorrowBalance();
    refetchCollateralValue();
    refetchCollateralBalance();
  };

  const {
    writeContract: repay,
    data: repayHash,
    isPending: repayPending,
  } = useWriteContract();
  const { isLoading: repayConfirming, isSuccess: repayConfirmed } =
    useWaitForTransactionReceipt({ hash: repayHash });

  const {
    writeContract: withdraw,
    data: withdrawHash,
    isPending: withdrawPending,
  } = useWriteContract();
  const { isLoading: withdrawConfirming, isSuccess: withdrawConfirmed } =
    useWaitForTransactionReceipt({ hash: withdrawHash });

  useEffect(() => {
    if (repayConfirmed) refetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repayConfirmed]);

  useEffect(() => {
    if (withdrawConfirmed) refetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withdrawConfirmed]);

  const projectedHealthFactor = useMemo(() => {
    if (!collateralBalance || collateralBalance === 0n) return undefined;
    if (withdrawAmountWei > collateralBalance) return 0n;
    const remainingCollateral = collateralBalance - withdrawAmountWei;
    const projectedCollateralValue =
      ((collateralValue ?? 0n) * remainingCollateral) / collateralBalance;
    if (!debtValue || debtValue === 0n) return maxUint256;
    return (
      (projectedCollateralValue *
        PROTOCOL_PARAMS.liquidationThresholdBps *
        10n ** 18n) /
      (PROTOCOL_PARAMS.denominatorBps * debtValue)
    );
  }, [collateralBalance, collateralValue, debtValue, withdrawAmountWei]);

  const revealRef = useScrollReveal<HTMLDivElement>();

  return (
    <>
      <Hero
        eyebrow="Screen 4 — Repay & Withdraw"
        title="Wind it back down."
        subtitle="Pay down debt, or pull collateral back out — we'll show the resulting health factor before you submit a withdrawal."
      />

      {!address ? (
        <p className="px-6 pb-24 text-muted sm:px-10">
          Connect your wallet to repay or withdraw.
        </p>
      ) : (
        <div
          ref={revealRef}
          className="grid gap-px border-t border-white/10 bg-white/5 lg:grid-cols-2"
        >
          {/* Repay */}
          <div className="flex h-full flex-col justify-between gap-6 bg-ink p-8 sm:p-10">
            <div className="flex flex-col gap-6">
              <h2 className="display-section text-2xl">Repay</h2>
              <p className="text-sm text-muted">
                Debt: ${formatUsd1e18(debtValue ?? 0n)}
                <br />
                Wallet balance: {formatToken(walletBorrowBalance ?? 0n)}{" "}
                {BORROW_TOKEN_SYMBOL}
              </p>
              <input
                type="number"
                min="0"
                placeholder="0.0"
                value={repayAmount}
                onChange={(event) => setRepayAmount(event.target.value)}
                className="border-b border-white/20 bg-transparent py-3 text-2xl text-bone outline-none focus:border-accent"
              />
            </div>
            <ApproveAndAct
              token={BORROW_TOKEN_ADDRESS}
              amount={repayAmountWei}
              actionLabel={`Repay ${BORROW_TOKEN_SYMBOL}`}
              actPending={repayPending || repayConfirming}
              onAct={() => {
                repay({
                  address: SOLVENT_ENGINE_ADDRESS,
                  abi: solventEngineAbi,
                  functionName: "repay",
                  args: [repayAmountWei],
                });
                setRepayAmount("");
              }}
            />
          </div>

          {/* Withdraw */}
          <div className="flex h-full flex-col justify-between gap-6 bg-ink p-8 sm:p-10">
            <div className="flex flex-col gap-6">
              <h2 className="display-section text-2xl">Withdraw</h2>
              <p className="text-sm text-muted">
                Deposited: {formatToken(collateralBalance ?? 0n)}{" "}
                {COLLATERAL_TOKEN_SYMBOL}
              </p>
              <input
                type="number"
                min="0"
                placeholder="0.0"
                value={withdrawAmount}
                onChange={(event) => setWithdrawAmount(event.target.value)}
                className="border-b border-white/20 bg-transparent py-3 text-2xl text-bone outline-none focus:border-accent"
              />
              {withdrawAmountWei > 0n && projectedHealthFactor !== undefined ? (
                <p
                  className={
                    projectedHealthFactor < 10n ** 18n
                      ? "text-sm text-danger"
                      : "text-sm text-muted"
                  }
                >
                  Projected health factor after withdrawal:{" "}
                  {formatHealthFactor(projectedHealthFactor)}
                  {projectedHealthFactor < 10n ** 18n
                    ? " — this would break your health factor and revert."
                    : ""}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              disabled={
                withdrawAmountWei === 0n || withdrawPending || withdrawConfirming
              }
              onClick={() => {
                withdraw({
                  address: SOLVENT_ENGINE_ADDRESS,
                  abi: solventEngineAbi,
                  functionName: "withdrawCollateral",
                  args: [withdrawAmountWei],
                });
                setWithdrawAmount("");
              }}
              className="w-full rounded-sm bg-accent px-6 py-4 text-sm font-semibold tracking-wide text-ink uppercase transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {withdrawPending || withdrawConfirming
                ? "Confirming…"
                : `Withdraw ${COLLATERAL_TOKEN_SYMBOL}`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
