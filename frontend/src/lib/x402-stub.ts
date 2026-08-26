/**
 * Shared stub for @coinbase/cdp-sdk's optional @x402 payment packages (see next.config.ts).
 * RainbowKit's wallet barrel statically bundles every connector, including Coinbase/Base
 * Account, whose cdp-sdk dependency imports these — but we never install @x402/* (payments
 * aren't used anywhere in this app) and never exercise that code path at runtime. Every named
 * export cdp-sdk statically imports from any @x402/* specifier is stubbed here as a no-op so
 * bundling succeeds; none of these are ever actually called.
 */
const noop = () => undefined;

export const toClientEvmSigner = noop;
export const BatchSettlementEvmScheme = noop;
export const ExactEvmScheme = noop;
export const registerExactEvmScheme = noop;
export const ExactEvmSchemeV1 = noop;
export const UptoEvmScheme = noop;
export const ExactSvmScheme = noop;
export const ExactSvmSchemeV1 = noop;
export const HTTPFacilitatorClient = noop;
export const paymentMiddlewareFromConfig = noop;
export const paymentMiddlewareFromHTTPServer = noop;
export const wrapFetchWithPayment = noop;
export const x402Client = noop;
export const x402ResourceServer = noop;
export const x402HTTPResourceServer = noop;
export const bazaarResourceServerExtension = noop;
export const BUILDER_CODE_PATTERN = "";
export const BUILDER_CODE_SCHEMA = {};
export const BUILDER_CODE = "";
export const builderCodeResourceServerExtension = noop;
export const BuilderCodeClientExtension = noop;

const x402Stub = {};
export default x402Stub;
