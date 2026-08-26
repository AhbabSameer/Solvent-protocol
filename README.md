# Solvent Protocol

A small lending protocol on Ethereum, built to be understood from top to bottom — not another
five-collateral-type, kinked-interest-rate DeFi app, just the core idea done properly.

**⚠️ Testnet only. Not audited. Do not use with real funds.**

## What is this, actually?

Think of it like a pawn shop, but the pawnbroker is a smart contract.

You hand over something valuable as collateral, borrow against a slice of its worth, and get it
back once you've paid up. Nobody decides if you're trustworthy — the contract just checks the
numbers.

Here's the whole flow:

1. **Deposit** — Lock up collateral (a test token called `sCOL`) into the protocol. It's still
   yours; you can withdraw it anytime, as long as you're not borrowing more than it covers.
2. **Borrow** — Draw out another token (`sUSD`) against your deposit, up to 75% of its live
   dollar value (priced by a real Chainlink oracle).
3. **Repay** — Pay back what you borrowed whenever you like, plus a small 5%-a-year interest
   charge. Once it's repaid, your collateral is free again.
4. **Withdraw** — Take your collateral back out, once your debt (if any) allows it.
5. **Liquidate** — The safety net. If someone's collateral drops too close in value to their
   debt, anyone else can step in, pay off part of what they owe, and take their collateral at a
   10% discount. This is what keeps the whole system solvent — hence the name.

## Try it

A live web app connects to the contracts below — connect a wallet on Sepolia (test) ETH and try
the whole flow with fake tokens.

**Live app:** _add your deployed link here_

There's a "mint test tokens" button built into the app, so you don't need to find or buy anything
to try it — everything involved is a worthless test asset except the gas you pay in Sepolia ETH
(also free, from a faucet).

## What's in this repo

```
src/          the smart contracts
test/         the test suite (unit, fuzz, invariant, reentrancy)
script/       deployment scripts
frontend/     the web app (Next.js)
```

## Running it yourself

### Smart contracts

Requires [Foundry](https://book.getfoundry.sh/getting-started/installation).

```shell
forge build     # compile
forge test      # run the full test suite
forge coverage  # see how much of the code is tested
```

### The web app

Requires [Node.js](https://nodejs.org/).

```shell
cd frontend
npm install
npm run dev
```

Then open http://localhost:3000.

## Deployed contracts (Sepolia test network)

| Contract | Address |
|---|---|
| SolventEngine (the protocol) | [`0xDfa279C4e8C5AbeA4E281f3a23bBF218143c4460`](https://sepolia.etherscan.io/address/0xDfa279C4e8C5AbeA4E281f3a23bBF218143c4460) |
| sCOL (test collateral token) | [`0x656caD812DA3023BD1Ab2f4c5a0fCed40082b50E`](https://sepolia.etherscan.io/address/0x656caD812DA3023BD1Ab2f4c5a0fCed40082b50E) |
| sUSD (test borrow token) | [`0x550Fe5cc9345c79075FFB1dB9F9C9B6EBc121931`](https://sepolia.etherscan.io/address/0x550Fe5cc9345c79075FFB1dB9F9C9B6EBc121931) |

Collateral is priced using the real Chainlink ETH/USD price feed on Sepolia, not a fake one — so
prices move with the real market, even though the tokens themselves are worthless test assets.

## How it's kept safe (in plain terms)

This is a small project, not an audited product, but real security thinking went into it:

- **No reentrancy tricks.** Every function that moves money finishes updating its own records
  *before* sending anything out, and has an extra guard on top — the standard defense against a
  malicious token trying to call back into the contract mid-transaction.
- **The price feed can't go stale silently.** If the oracle hasn't updated recently (3+ hours),
  the contract refuses to use the price rather than trusting outdated data.
- **Rounding always favors the protocol, never the user.** Wherever math has to round somewhere,
  it rounds in whichever direction makes the protocol slightly safer, by design.
- **Fixed, known parameters** — 75% max loan-to-value, 80% liquidation threshold, 10% liquidation
  bonus, 5% fixed yearly interest. Nothing hidden, nothing that changes based on usage.
- **No admin backdoor.** There's no owner key that can drain funds, change the rules, or pause
  the protocol.

None of this replaces a real third-party audit, which this project has not had.

## Built with

- **Contracts:** Solidity, Foundry, OpenZeppelin, Chainlink price feeds
- **Frontend:** Next.js, wagmi, viem, RainbowKit

## License

MIT
