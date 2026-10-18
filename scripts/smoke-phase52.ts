/**
 * Lightweight Phase 52 smoke (no full app / no broker orders).
 */
import {
  assembleVerificationResult,
  AUTOMATED_EXECUTION_BANNER,
  validateBidAsk,
  verifyInstrumentMetadata,
} from "../ai/forex-ai/automated-trading/index.ts";
import type { ForexConnectAccountsResult, ForexConnectInstrument } from "../ai/market-data/forexconnect/types.ts";

let failed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else console.log("PASS:", msg);
}

assert(AUTOMATED_EXECUTION_BANNER.includes("PHASE 52"), "banner phase 52");
assert(validateBidAsk(1.1, 1.2).ok === true, "valid bid/ask");
assert(validateBidAsk(1.2, 1.1).ok === false, "reject inverted bid/ask");

const inst: ForexConnectInstrument = {
  provider: "FOREXCONNECT",
  providerSymbol: "EUR/USD",
  canonicalSymbol: "EURUSD",
  displaySymbol: "EUR/USD",
  marketType: "forex",
  baseAsset: "EUR",
  quoteAsset: "USD",
  status: "tradable",
  pointSize: 0.0001,
  pipCost: 10,
  lotStep: 0.01,
};
assert(verifyInstrumentMetadata("EUR/USD", [inst]).instrument.contractVerified === true, "contract verified");

const accounts: ForexConnectAccountsResult = {
  ok: true,
  count: 1,
  accounts: [{
    accountId: "A1",
    accountIdMasked: "••••A1",
    environment: "demo",
    accountCurrency: "USD",
    balance: 0,
    equity: 0,
    usedMargin: 0,
    usableMargin: 0,
  }],
  fetchedAt: new Date().toISOString(),
  status: {
    ok: true,
    provider: "FOREXCONNECT",
    apiPath: "/status",
    status: "CONNECTED",
    enabled: true,
    configured: true,
    environment: "demo",
    environmentLabel: "DEMO",
    usernameConfigured: true,
    passwordConfigured: true,
    trading: "DISABLED",
  },
};

const mismatch = assembleVerificationResult({
  selected: "LIVE",
  environmentEpoch: 1,
  credentialsConfigured: true,
  connectionStatus: "CONNECTED",
  sessionEnv: "DEMO",
  accountsResult: accounts,
  instruments: [],
});
assert(mismatch.identityStatus === "ENVIRONMENT_MISMATCH", "env mismatch");
assert(mismatch.readiness.readyForTrading === false, "never ready for trading");
assert(mismatch.placesOrders === false, "placesOrders false");

if (failed) {
  console.error(`\nPhase 52 smoke FAILED (${failed})`);
  process.exit(1);
}
console.log("\nPhase 52 smoke OK");
