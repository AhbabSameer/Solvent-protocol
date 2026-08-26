"use client";

import Link from "next/link";
import { useAccount, useSwitchChain } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Hero } from "@/components/Hero";
import { StatTicker } from "@/components/StatTicker";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { APP_CHAIN } from "@/lib/contracts";

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Deposit",
    body: "Lock up sCOL — a test collateral token — into the protocol. It's still yours: withdraw it anytime, as long as you're not borrowing more than it covers.",
  },
  {
    step: "02",
    title: "Borrow",
    body: "Draw out sUSD against your deposit — up to 75% of its live dollar value. No credit checks, no paperwork, just math.",
  },
  {
    step: "03",
    title: "Repay",
    body: "Pay back what you borrowed whenever you like, plus a small 5%-a-year interest charge. Once it's repaid, your collateral is free again.",
  },
  {
    step: "04",
    title: "Stay healthy",
    body: "If your collateral's value falls too close to your debt, anyone can step in, cover part of what you owe, and take your collateral at a discount. That's what keeps the whole protocol solvent.",
  },
];

const SCREENS = [
  {
    href: "/deposit-borrow",
    title: "Deposit & Borrow",
    body: "Post sCOL collateral, then draw sUSD against it at up to 75% loan-to-value.",
  },
  {
    href: "/health",
    title: "Health Factor",
    body: "Live-accrued view of any position's collateral, debt, and liquidation risk.",
  },
  {
    href: "/repay-withdraw",
    title: "Repay & Withdraw",
    body: "Pay down debt or pull collateral back out, with a health-factor preview first.",
  },
  {
    href: "/liquidate",
    title: "Liquidate",
    body: "Cover an unhealthy position's debt in exchange for a 10% collateral bonus.",
  },
];

export default function Home() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending: switching } = useSwitchChain();
  const wrongNetwork = isConnected && chainId !== APP_CHAIN.id;
  const howItWorksRef = useScrollReveal<HTMLDivElement>();
  const revealRef = useScrollReveal<HTMLDivElement>();

  return (
    <>
      <Hero
        eyebrow="Sepolia testnet — not audited"
        title={
          <>
            Lend and borrow,
            <br />
            without the noise.
          </>
        }
        subtitle="Solvent is a minimal, over-collateralized lending market: one collateral asset, one borrow asset, fixed-rate interest, and fixed-bonus liquidation — built to be understood end to end."
        action={
          wrongNetwork ? (
            <button
              type="button"
              onClick={() => switchChain({ chainId: APP_CHAIN.id })}
              disabled={switching}
              className="rounded-sm bg-danger px-6 py-4 text-sm font-semibold tracking-wide text-ink uppercase transition hover:brightness-110 disabled:opacity-50"
            >
              {switching ? "Switching…" : "Switch to Sepolia"}
            </button>
          ) : (
            <ConnectButton.Custom>
              {({ openConnectModal, account }) =>
                account ? (
                  <Link
                    href="/deposit-borrow"
                    className="inline-block rounded-sm bg-accent px-8 py-4 text-sm font-semibold tracking-wide text-ink uppercase transition hover:brightness-110"
                  >
                    Enter app →
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={openConnectModal}
                    className="rounded-sm bg-accent px-8 py-4 text-sm font-semibold tracking-wide text-ink uppercase transition hover:brightness-110"
                  >
                    Connect wallet
                  </button>
                )
              }
            </ConnectButton.Custom>
          )
        }
      />

      <StatTicker />

      <section className="border-t border-white/10 px-6 py-24 sm:px-10">
        <p className="mb-4 text-xs tracking-[0.3em] text-accent uppercase">
          What is Solvent, actually?
        </p>
        <h2 className="display-section max-w-3xl text-3xl sm:text-4xl">
          Think of it like a pawn shop, but the pawnbroker is math.
        </h2>
        <p className="mt-6 max-w-2xl text-muted">
          You hand over something valuable as collateral, borrow against a
          slice of its worth, and get it back once you&rsquo;ve paid up. No
          middleman decides if you&rsquo;re trustworthy — a smart contract
          just checks the numbers.
        </p>

        <div
          ref={howItWorksRef}
          className="mt-16 grid gap-px border border-white/10 bg-white/5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {HOW_IT_WORKS.map((item) => (
            <div key={item.step} className="flex flex-col gap-4 bg-ink p-8">
              <span className="text-numeral text-sm text-accent">
                {item.step}
              </span>
              <span className="display-section text-xl">{item.title}</span>
              <span className="text-sm text-muted">{item.body}</span>
            </div>
          ))}
        </div>
      </section>

      <section
        ref={revealRef}
        className="grid gap-px border-t border-white/10 bg-white/5 sm:grid-cols-2 lg:grid-cols-4"
      >
        {SCREENS.map((screen) => (
          <Link
            key={screen.href}
            href={screen.href}
            className="group flex flex-col justify-between gap-10 bg-ink p-8 transition-colors hover:bg-panel sm:p-10"
          >
            <span className="display-section text-2xl">{screen.title}</span>
            <span className="text-sm text-muted">{screen.body}</span>
            <span className="text-xs tracking-widest text-accent uppercase opacity-0 transition-opacity group-hover:opacity-100">
              Open →
            </span>
          </Link>
        ))}
      </section>
    </>
  );
}
