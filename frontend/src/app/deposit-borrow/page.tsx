"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Hero } from "@/components/Hero";
import { ApproveAndAct } from "@/components/ApproveAndAct";
import { useCountUp } from "@/hooks/useCountUp";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import {
  useCollateralValue,
  useCollateralBalance,
  useWalletCollateralBalance,
} from "@/hooks/useCollateral";
import { useDebtValue } from "@/hooks/useDebt";
import { solventEngineAbi } from "@/lib/abi/solventEngine";
import { erc20Abi } from "@/lib/abi/erc20";
import {
  SOLVENT_ENGINE_ADDRESS,
  COLLATERAL_TOKEN_ADDRESS,
  COLLATERAL_TOKEN_SYMBOL,
  BORROW_TOKEN_SYMBOL,
  PROTOCOL_PARAMS,
} from "@/lib/contracts";
import { formatUsd1e18, formatToken, parseToken } from "@/lib/format";

const MINT_AMOUNT = parseToken("1000");

export default function DepositBorrowPage() {
  const { address } = useAccount();

  const { data: collateralValue, refetch: refetchCollateralValue } =
    useCollateralValue(address);
  const { data: collateralBalance, refetch: refetchCollateralBalance } =
    useCollateralBalance(address);
  const { data: walletBalance, refetch: refetchWalletBalance } =
    useWalletCollateralBalance(address);
  const { data: debtValue, refetch: refetchDebtValue } = useDebtValue(address);

  const maxBorrowableUsd = useMemo(() => {
    if (!collateralValue) return 0n;
    return (
      (collateralValue * PROTOCOL_PARAMS.loanToValueBps) /
      PROTOCOL_PARAMS.denominatorBps
    );
  }, [collateralValue]);

  const collateralValueDisplay = useCountUp(
    collateralValue ? Number(collateralValue) / 1e18 : 0,
  );
  const maxBorrowDisplay = useCountUp(Number(maxBorrowableUsd) / 1e18);

  const [depositAmount, setDepositAmount] = useState("");
  const [borrowAmount, setBorrowAmount] = useState("");
  const depositAmountWei = parseToken(depositAmount);
  const borrowAmountWei = parseToken(borrowAmount);

  const refetchAll = () => {
    refetchCollateralValue();
    refetchCollateralBalance();
    refetchWalletBalance();
    refetchDebtValue();
  };

  const {
    writeContract: deposit,
    data: depositHash,
    isPending: depositPending,
  } = useWriteContract();
  const { isLoading: depositConfirming, isSuccess: depositConfirmed } =
    useWaitForTransactionReceipt({ hash: depositHash });

  const {
    writeContract: borrow,
    data: borrowHash,
    isPending: borrowPending,
  } = useWriteContract();
  const { isLoading: borrowConfirming, isSuccess: borrowConfirmed } =
    useWaitForTransactionReceipt({ hash: borrowHash });

  const {
    writeContract: mint,
    data: mintHash,
    isPending: mintPending,
  } = useWriteContract();
  const { isLoading: mintConfirming, isSuccess: mintConfirmed } =
    useWaitForTransactionReceipt({ hash: mintHash });

  useEffect(() => {
    if (depositConfirmed) refetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depositConfirmed]);

  useEffect(() => {
    if (borrowConfirmed) refetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borrowConfirmed]);

  useEffect(() => {
    if (mintConfirmed) refetchWalletBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mintConfirmed]);

  const revealRef = useScrollReveal<HTMLDivElement>();

  return (
    <>
      <Hero
        eyebrow="Screen 2 — Deposit & Borrow"
        title="Put it to work."
        subtitle="Post sCOL as collateral, then borrow sUSD against it — up to 75% of its live USD value."
        action={
          <div className="flex gap-8">
            <div>
              <p className="text-xs tracking-widest text-muted uppercase">
                Collateral value
              </p>
              <p className="text-numeral text-4xl text-bone">
                ${collateralValueDisplay.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs tracking-widest text-muted uppercase">
                Max borrowable
              </p>
              <p className="text-numeral text-4xl text-accent">
                ${maxBorrowDisplay.toFixed(2)}
              </p>
            </div>
          </div>
        }
      />

      {!address ? (
        <p className="px-6 pb-24 text-muted sm:px-10">
          Connect your wallet to deposit or borrow.
        </p>
      ) : (
        <div
          ref={revealRef}
          className="grid gap-px border-t border-white/10 bg-white/5 lg:grid-cols-3"
        >
          {/* Deposit */}
          <div className="flex flex-col gap-6 bg-ink p-8 sm:p-10">
            <h2 className="display-section text-2xl">Deposit</h2>
            <p className="text-sm text-muted">
              Wallet balance: {formatToken(walletBalance ?? 0n)}{" "}
              {COLLATERAL_TOKEN_SYMBOL}
              <br />
              Deposited: {formatToken(collateralBalance ?? 0n)}{" "}
              {COLLATERAL_TOKEN_SYMBOL}
            </p>
            <input
              type="number"
              min="0"
              placeholder="0.0"
              value={depositAmount}
              onChange={(event) => setDepositAmount(event.target.value)}
              className="border-b border-white/20 bg-transparent py-3 text-2xl text-bone outline-none focus:border-accent"
            />
            <ApproveAndAct
              token={COLLATERAL_TOKEN_ADDRESS}
              amount={depositAmountWei}
              actionLabel={`Deposit ${COLLATERAL_TOKEN_SYMBOL}`}
              actPending={depositPending || depositConfirming}
              onAct={() => {
                deposit({
                  address: SOLVENT_ENGINE_ADDRESS,
                  abi: solventEngineAbi,
                  functionName: "depositCollateral",
                  args: [depositAmountWei],
                });
                setDepositAmount("");
              }}
            />
          </div>

          {/* Borrow */}
          <div className="flex flex-col gap-6 bg-ink p-8 sm:p-10">
            <h2 className="display-section text-2xl">Borrow</h2>
            <p className="text-sm text-muted">
              Current debt: ${formatUsd1e18(debtValue ?? 0n)}
              <br />
              Max borrowable: ${formatUsd1e18(maxBorrowableUsd)}
            </p>
            <input
              type="number"
              min="0"
              placeholder="0.0"
              value={borrowAmount}
              onChange={(event) => setBorrowAmount(event.target.value)}
              className="border-b border-white/20 bg-transparent py-3 text-2xl text-bone outline-none focus:border-accent"
            />
            <button
              type="button"
              disabled={
                borrowAmountWei === 0n || borrowPending || borrowConfirming
              }
              onClick={() => {
                borrow({
                  address: SOLVENT_ENGINE_ADDRESS,
                  abi: solventEngineAbi,
                  functionName: "borrow",
                  args: [borrowAmountWei],
                });
                setBorrowAmount("");
              }}
              className="w-full rounded-sm bg-accent px-6 py-4 text-sm font-semibold tracking-wide text-ink uppercase transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {borrowPending || borrowConfirming
                ? "Confirming…"
                : `Borrow ${BORROW_TOKEN_SYMBOL}`}
            </button>
          </div>

          {/* Faucet */}
          <div className="flex flex-col gap-6 bg-ink p-8 sm:p-10">
            <h2 className="display-section text-2xl">Testnet faucet</h2>
            <p className="text-sm text-muted">
              {COLLATERAL_TOKEN_SYMBOL} is an open-mint mock token — grab
              1,000 to try the protocol with. No approval needed.
            </p>
            <button
              type="button"
              disabled={mintPending || mintConfirming}
              onClick={() =>
                mint({
                  address: COLLATERAL_TOKEN_ADDRESS,
                  abi: erc20Abi,
                  functionName: "mint",
                  args: [address, MINT_AMOUNT],
                })
              }
              className="w-full rounded-sm border border-white/20 px-6 py-4 text-sm font-semibold tracking-wide text-bone uppercase transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              {mintPending || mintConfirming
                ? "Minting…"
                : `Mint 1,000 ${COLLATERAL_TOKEN_SYMBOL}`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
