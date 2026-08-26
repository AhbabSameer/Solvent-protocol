import type { NextConfig } from "next";

// RainbowKit's wallet barrel statically imports every connector implementation, including
// Coinbase/Base Account — whose @coinbase/cdp-sdk dependency lazy/statically imports these
// optional @x402 payment packages. We don't install them (payments aren't used here at all),
// so Turbopack can't resolve them. Stub every specifier the cdp-sdk source actually references.
const x402Stub = "./src/lib/x402-stub.ts";
const x402Specifiers = [
  "@x402/core",
  "@x402/core/client",
  "@x402/core/server",
  "@x402/evm",
  "@x402/evm/batch-settlement/client",
  "@x402/evm/exact/client",
  "@x402/evm/exact/server",
  "@x402/evm/exact/v1/client",
  "@x402/evm/upto/client",
  "@x402/evm/upto/server",
  "@x402/svm",
  "@x402/svm/exact/client",
  "@x402/svm/exact/server",
  "@x402/svm/exact/v1/client",
  "@x402/express",
  "@x402/extensions/bazaar",
  "@x402/extensions/builder-code",
  "@x402/fetch",
];

const nextConfig: NextConfig = {
  // Every page here is client-rendered (wallet connect + on-chain reads/writes all happen in
  // the browser via wagmi/viem) — no server routes, no server actions, no dynamic route params.
  // Static export produces a plain out/ folder of HTML/CSS/JS, deployable by dragging it onto
  // Netlify (or any static host) with no server runtime required.
  output: "export",
  // Static export otherwise emits both a `route.html` file AND a `route/` directory (holding
  // internal RSC prefetch payloads, not a page) for every route — an ambiguous structure that
  // trips up clean-URL resolution on static hosts. trailingSlash makes every route unambiguously
  // `route/index.html` instead, which is the Next.js-recommended setting for this deploy target.
  trailingSlash: true,
  turbopack: {
    resolveAlias: Object.fromEntries(
      x402Specifiers.map((specifier) => [specifier, x402Stub]),
    ),
  },
};

export default nextConfig;
