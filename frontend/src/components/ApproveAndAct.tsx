"use client";

import { useEffect } from "react";
import type { Address } from "viem";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { erc20Abi } from "@/lib/abi/erc20";
import { SOLVENT_ENGINE_ADDRESS } from "@/lib/contracts";
import { useAllowance } from "@/hooks/useAllowance";

/**
 * Shared two-step ERC20 approve-then-act control. `token`/`amount` drive the allowance check;
 * `onAct` fires the actual protocol call (deposit/repay/liquidate) once allowance suffices.
 */
export function ApproveAndAct({
  token,
  amount,
  actionLabel,
  onAct,
  actPending,
  disabled,
}: {
  token: Address;
  amount: bigint;
  actionLabel: string;
  onAct: () => void;
  actPending: boolean;
  disabled?: boolean;
}) {
  const { address } = useAccount();
  const { data: allowance, refetch: refetchAllowance } = useAllowance(
    token,
    address,
  );

  const {
    writeContract: approve,
    data: approveHash,
    isPending: approvePending,
  } = useWriteContract();

  const { isLoading: approveConfirming, isSuccess: approveConfirmed } =
    useWaitForTransactionReceipt({ hash: approveHash });

  useEffect(() => {
    if (approveConfirmed) refetchAllowance();
  }, [approveConfirmed, refetchAllowance]);

  const needsApproval = amount > 0n && (allowance ?? 0n) < amount;
  const isDisabled = disabled || amount === 0n || !address;

  if (needsApproval) {
    return (
      <button
        type="button"
        disabled={isDisabled || approvePending || approveConfirming}
        onClick={() =>
          approve({
            address: token,
            abi: erc20Abi,
            functionName: "approve",
            args: [SOLVENT_ENGINE_ADDRESS, amount],
          })
        }
        className="w-full rounded-sm bg-bone px-6 py-4 text-sm font-semibold tracking-wide text-ink uppercase transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        {approvePending || approveConfirming ? "Approving…" : "Approve"}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={isDisabled || actPending}
      onClick={onAct}
      className="w-full rounded-sm bg-accent px-6 py-4 text-sm font-semibold tracking-wide text-ink uppercase transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {actPending ? "Confirming…" : actionLabel}
    </button>
  );
}
