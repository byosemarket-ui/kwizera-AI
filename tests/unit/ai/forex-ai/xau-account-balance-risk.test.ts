/**
 * XAU/USD account-balance risk policy — deterministic FIXTURE tests (not live broker evidence).
 * 25% of verified FXCM balance as max modeled SL loss, floor-only sizing, net R:R ≥ 3.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  accountBindingHash,
  captureAccountBalanceRiskSnapshot,
  evaluateRiskSnapshotValidity,
  instrumentProfitCurrency,
  XAU_ACCOUNT_RISK_POLICY_VERSION,
  type AccountBalanceRiskSnapshot,
} from "../../../../ai/forex-ai/automated-trading/account-risk/index.ts";
import {
  buildOrderProposal,
  resolveProposalRiskBase,
  type AtOrderProposalRecord,
} from "../../../../ai/forex-ai/automated-trading/order-proposal/index.ts";
import { validateMonetaryRewardToRisk } from "../../../../ai/forex-ai/automated-trading/per-order-risk/monetary-3r.ts";
import type { AtOrderPreparationHandoff } from "../../../../ai/forex-ai/automated-trading/result-intake/types.ts";
import type { AtSimContractMetaInput } from "../../../../ai/forex-ai/automated-trading/simulation-risk/types.ts";

const NOW = Date.parse("2026-11-13T12:00:00.000Z");
const ACCOUNT_ID = "FIXTURE-ACCT-001";

function account(balance: number | null, over: Record<string, unknown> = {}) {
  return {
    accountIdMasked: "FIX***001",
    accountCurrency: "USD",
    balance,
    fetchedAtUtc: new Date(NOW - 5_000).toISOString(),
    fields: { balance: balance != null, accountCurrency: true },
    ...over,
  };
}

function snap(balance: number, over: Record<string, unknown> = {}): AccountBalanceRiskSnapshot {
  const out = captureAccountBalanceRiskSnapshot({
    account: account(balance, over),
    accountId: ACCOUNT_ID,
    identityVerified: true,
    environment: "DEMO",
    nowMs: NOW,
  });
  if (!out.ok) throw new Error(out.code);
  return out.snapshot;
}

function handoff(dir: "BUY" | "SELL"): AtOrderPreparationHandoff {
  return {
    acceptedResultId: "res-fx",
    analysisId: "an-fx",
    instrument: "XAU/USD",
    canonicalDirection: dir,
    directionalConfidencePct: 65,
    confidenceType: "ANALYSIS_CONFIDENCE",
    isCalibratedWinProbability: false,
    observationId: "obs",
    imageId: "img",
    imageHash: "hash",
    analyzedAtUtc: new Date(NOW).toISOString(),
    resultExpiresAtUtc: new Date(NOW + 3_600_000).toISOString(),
    validationStatus: "VALID",
    intakeLifecycle: "ACCEPTED",
    evidenceReferences: {
      reconciliationStatus: "ALIGNED",
      canonicalOutcome: "BUY_CANDIDATE",
      primaryTimeframe: "5m",
      mtfAlignment: "ALIGNED",
    },
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    note: "fixture",
  } as AtOrderPreparationHandoff;
}

/** FIXTURE XAU contract: AMOUNT = baseUnitSize(1) × lots; $1 per 1.00 move per lot. */
function xauContract(over: Partial<AtSimContractMetaInput> = {}): AtSimContractMetaInput {
  return {
    verified: true,
    pointSize: 0.01,
    tickSize: 0.01,
    digits: 2,
    quantityMin: 1,
    quantityStep: 1,
    quantityUnit: "contracts",
    quantityUnitAmbiguous: false,
    contractMultiplier: 1,
    baseUnitSize: 1,
    pipCostAccount: 0.01,
    marginPerLotAccount: 50,
    minStopDistance: null,
    minStopDistanceVerified: false,
    source: "fixture",
    unavailableReason: null,
    ...over,
  };
}

function proposal(over: Record<string, unknown> = {}): AtOrderProposalRecord {
  const dir = (over.dir as "BUY" | "SELL" | undefined) ?? "BUY";
  return buildOrderProposal({
    handoff: handoff(dir),
    entryPrice: 2000,
    stopLoss: dir === "BUY" ? 1990 : 2010,
    verifiedEquity: null,
    accountCurrency: "USD",
    usableMargin: 100_000,
    usedMargin: 0,
    marginFresh: true,
    riskBasis: "ACCOUNT_BALANCE",
    accountBalanceSnapshot: snap(500),
    instrumentProfitCurrency: "USD",
    contract: xauContract(),
    contractFresh: true,
    sdkMinQuantity: 1,
    marginPerUnitAccount: 50,
    exposureAuthoritative: true,
    existingExposure: 0,
    systemMasterOn: true,
    tradingEnabled: false,
    emergencyEntryLock: true,
    technicalRewardDistanceMax: 100,
    nowMs: NOW,
    ...over,
  });
}

const codes = (p: AtOrderProposalRecord) => p.blockers.map((b) => String(b.code));

describe("XAU account-balance snapshot (FIXTURE)", () => {
  it.each([
    [500, 125],
    [1_000, 250],
    [2_000, 500],
  ])("balance %s → maximum modeled risk %s", (balance, max) => {
    const s = snap(balance);
    expect(s.maximumRiskAccountCurrency).toBe(max);
    expect(s.riskBasis).toBe("ACCOUNT_BALANCE");
    expect(s.policyVersion).toBe(XAU_ACCOUNT_RISK_POLICY_VERSION);
    expect(s.provider).toBe("FOREXCONNECT");
    expect(s.accountBindingHash).toBe(accountBindingHash(ACCOUNT_ID));
    expect(JSON.stringify(s)).not.toContain(ACCOUNT_ID);
  });

  it("stale balance → ACCOUNT_BALANCE_STALE", () => {
    const out = captureAccountBalanceRiskSnapshot({
      account: account(1_000, { fetchedAtUtc: new Date(NOW - 61_000).toISOString() }),
      accountId: ACCOUNT_ID,
      identityVerified: true,
      nowMs: NOW,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("ACCOUNT_BALANCE_STALE");
  });

  it("wrong / unverified account → ACCOUNT_IDENTITY_UNVERIFIED", () => {
    const out = captureAccountBalanceRiskSnapshot({
      account: account(1_000),
      accountId: ACCOUNT_ID,
      identityVerified: false,
      nowMs: NOW,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("ACCOUNT_IDENTITY_UNVERIFIED");
  });

  it("unknown currency → ACCOUNT_CURRENCY_UNKNOWN (USD never assumed)", () => {
    const out = captureAccountBalanceRiskSnapshot({
      account: account(1_000, { accountCurrency: null }),
      accountId: ACCOUNT_ID,
      identityVerified: true,
      nowMs: NOW,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("ACCOUNT_CURRENCY_UNKNOWN");
  });

  it("missing balance is not substituted by equity", () => {
    const out = captureAccountBalanceRiskSnapshot({
      account: { ...account(null), equity: 9_999 } as never,
      accountId: ACCOUNT_ID,
      identityVerified: true,
      nowMs: NOW,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("ACCOUNT_BALANCE_UNAVAILABLE");
  });

  it("balance or account change after proposal → snapshot expires", () => {
    const s = snap(1_000);
    expect(evaluateRiskSnapshotValidity(s, { accountId: ACCOUNT_ID, balance: 1_000 })).toBe("VALID");
    expect(evaluateRiskSnapshotValidity(s, { accountId: ACCOUNT_ID, balance: 1_000.5 })).toBe("EXPIRED_BALANCE_CHANGED");
    expect(evaluateRiskSnapshotValidity(s, { accountId: "OTHER-ACCT", balance: 1_000 })).toBe("EXPIRED_ACCOUNT_CHANGED");
    expect(evaluateRiskSnapshotValidity(s, { accountIdMasked: "OTH***999", balance: 1_000 })).toBe("EXPIRED_ACCOUNT_CHANGED");
    expect(evaluateRiskSnapshotValidity(s, null)).toBe("CURRENT_ACCOUNT_UNAVAILABLE");
  });

  it("instrument P/L currency derives from the quote leg", () => {
    expect(instrumentProfitCurrency("XAU/USD")).toBe("USD");
    expect(instrumentProfitCurrency("XAUUSD")).toBeNull();
  });
});

describe("XAU balance-basis proposal sizing (FIXTURE)", () => {
  it("$500 balance → 12 lots floored (risk $120 ≤ $125), policy stamped, no allocation used", () => {
    const p = proposal({ individualOrderAllocation: 1 });
    expect(codes(p)).toEqual([]);
    expect(p.lifecycle).toBe("PROPOSAL_READY");
    expect(p.capital.riskBasis).toBe("ACCOUNT_BALANCE");
    expect(p.capital.riskBaseAmount).toBe(500);
    expect(p.capital.individualOrderAllocation).toBeNull();
    expect(p.capital.maximumPermittedOrderLoss).toBe(125);
    expect(p.capital.riskPolicyVersion).toBe(XAU_ACCOUNT_RISK_POLICY_VERSION);
    expect(p.quantity.normalizedQuantity).toBe(12);
    expect(p.quantity.brokerAmount).toBe(12);
    expect(p.capital.projectedLossAtStopLoss).toBe(120);
    expect(resolveProposalRiskBase(p.capital)).toBe(500);
  });

  it("exactly 25% boundary is allowed ($400 → 10 lots → risk $100)", () => {
    const p = proposal({ accountBalanceSnapshot: snap(400) });
    expect(p.lifecycle).toBe("PROPOSAL_READY");
    expect(p.capital.projectedLossAtStopLoss).toBe(100);
    expect(p.capital.maximumPermittedOrderLoss).toBe(100);
  });

  it("rounding never increases risk ($505 → 12 lots, not 13)", () => {
    const p = proposal({ accountBalanceSnapshot: snap(505) });
    expect(p.quantity.normalizedQuantity).toBe(12);
    expect(p.capital.projectedLossAtStopLoss!).toBeLessThanOrEqual(505 * 0.25);
  });

  it("broker minimum above risk-affordable quantity → BLOCKED (never rounded up)", () => {
    const p = proposal({ accountBalanceSnapshot: snap(20) });
    expect(p.lifecycle).toBe("BLOCKED");
    expect(codes(p)).toContain("BROKER_MINIMUM_EXCEEDS_RISK_BUDGET");
    expect(p.quantity.normalizedQuantity).toBeNull();
  });

  it("missing balance snapshot → BLOCKED with capture reason", () => {
    const p = proposal({
      accountBalanceSnapshot: null,
      accountBalanceBlocker: { code: "ACCOUNT_BALANCE_STALE", message: "stale" },
    });
    expect(p.lifecycle).toBe("BLOCKED");
    expect(codes(p)).toContain("ACCOUNT_BALANCE_STALE");
  });

  it("missing contract metadata → BLOCKED", () => {
    const p = proposal({ contract: { ...xauContract(), verified: false } });
    expect(p.lifecycle).toBe("BLOCKED");
    expect(codes(p)).toContain("MISSING_INSTRUMENT_SPEC");
  });

  it("margin cannot be verified → BLOCKED (balance never substitutes margin)", () => {
    const p = proposal({ usableMargin: null, marginFresh: false });
    expect(p.lifecycle).toBe("BLOCKED");
    expect(codes(p)).toEqual(expect.arrayContaining(["MISSING_MARGIN_DATA"]));
  });

  it("insufficient margin reduces quantity without exceeding risk", () => {
    const p = proposal({ usableMargin: 300 });
    expect(p.lifecycle).toBe("PROPOSAL_READY");
    expect(p.quantity.normalizedQuantity).toBe(6);
    expect(p.capital.projectedLossAtStopLoss).toBe(60);
  });

  it("non-account-currency risk without verified conversion → BLOCKED", () => {
    const p = proposal({
      accountBalanceSnapshot: snap(1_000, { accountCurrency: "EUR" }),
      contract: xauContract({ pipCostAccount: null }),
      instrumentProfitCurrency: "USD",
    });
    expect(p.lifecycle).toBe("BLOCKED");
    expect(codes(p).some((c) => /FX_CONVERSION|FX_RATE|CONVERSION/.test(c))).toBe(true);
  });

  it("unauthoritative exposure → BLOCKED", () => {
    const p = proposal({ exposureAuthoritative: false });
    expect(codes(p)).toContain("EXPOSURE_UNVERIFIED");
  });

  it("no technical structure target → BLOCKED (TP never stretched to manufacture 3R)", () => {
    const p = proposal({ technicalRewardDistanceMax: null });
    expect(p.lifecycle).toBe("BLOCKED");
    expect(codes(p)).toContain("TECHNICAL_TARGET_UNVERIFIED");
  });

  it("structure too close for net 3R → BLOCKED, not stretched", () => {
    const p = proposal({ technicalRewardDistanceMax: 20 });
    expect(p.lifecycle).toBe("BLOCKED");
    expect(p.pricePlan.takeProfit).toBeNull();
  });

  it("SELL geometry: SL above entry, TP below; inverted SL rejected", () => {
    const sell = proposal({ dir: "SELL" });
    expect(sell.lifecycle).toBe("PROPOSAL_READY");
    expect(sell.pricePlan.stopLoss!).toBeGreaterThan(sell.pricePlan.entryPrice!);
    expect(sell.pricePlan.takeProfit!).toBeLessThan(sell.pricePlan.entryPrice!);
    const bad = proposal({ dir: "SELL", stopLoss: 1990 });
    expect(codes(bad)).toContain("INVALID_SL_GEOMETRY");
  });

  it("live spread is deducted once and net R:R stays ≥ 3 with SL/quantity unchanged", () => {
    const p = proposal({ liveSpreadAbsolute: 0.5 });
    expect(p.lifecycle).toBe("PROPOSAL_READY");
    expect(p.pricePlan.stopLoss).toBe(1990);
    expect(p.quantity.normalizedQuantity).toBe(12);
    expect(p.pricePlan.netRewardRiskRatio!).toBeGreaterThanOrEqual(3 - 1e-9);
    const friction = p.pricePlan.verifiedTradingCostsAccount!;
    expect(friction).toBeCloseTo(0.5 * 12, 6);
    expect(p.pricePlan.grossTakeProfitRewardAccount! - p.pricePlan.netTakeProfitRewardAccount!).toBeCloseTo(friction, 6);
  });
});

describe("Dynamic broker-compatible sizing — no fixed 0.01 cap (FIXTURE, $10 SL risk per lot)", () => {
  it.each([
    [40, 1],
    [80, 2],
    [120, 3],
    [200, 5],
  ])("balance %s → %s lots (AMOUNT = lots, risk ≤ 25%)", (balance, lots) => {
    const p = proposal({ accountBalanceSnapshot: snap(balance) });
    expect(codes(p)).toEqual([]);
    expect(p.quantity.normalizedQuantity).toBe(lots);
    expect(p.quantity.brokerAmount).toBe(lots);
    expect(p.capital.projectedLossAtStopLoss!).toBeLessThanOrEqual(balance * 0.25 + 1e-9);
    expect(codes(p)).not.toContain("OWNER_MAX_QUANTITY_EXCEEDED");
  });

  it("adapts to a different broker minimum (2); AMOUNT increment stays BaseUnitSize per the FXCM SDK", () => {
    const p = proposal({
      accountBalanceSnapshot: snap(120),
      contract: xauContract({ quantityMin: 2, quantityStep: 2 }),
      sdkMinQuantity: 2,
    });
    expect(p.lifecycle).toBe("PROPOSAL_READY");
    expect(p.quantity.normalizedQuantity).toBe(3);
    expect(p.quantity.brokerMinimum).toBe(2);
    expect(p.quantity.quantityStep).toBe(1);
  });

  it("baseUnitSize 2 changes the AMOUNT conversion: 3 lots → AMOUNT 6", () => {
    const p = proposal({
      accountBalanceSnapshot: snap(120),
      contract: xauContract({ baseUnitSize: 2, quantityMin: 2, quantityStep: 2 }),
      sdkMinQuantity: 2,
    });
    expect(p.lifecycle).toBe("PROPOSAL_READY");
    expect(p.quantity.brokerAmount).toBe(p.quantity.normalizedQuantity! * 2);
  });

  it("broker minimum above the risk budget → BROKER_MINIMUM_EXCEEDS_RISK_BUDGET (never rounded up)", () => {
    const p = proposal({
      accountBalanceSnapshot: snap(80),
      contract: xauContract({ quantityMin: 5, quantityStep: 1 }),
      sdkMinQuantity: 5,
    });
    expect(p.lifecycle).toBe("BLOCKED");
    expect(codes(p)).toContain("BROKER_MINIMUM_EXCEEDS_RISK_BUDGET");
    expect(p.quantity.normalizedQuantity).toBeNull();
  });

  it("margin fails independently of risk → INSUFFICIENT_USABLE_MARGIN", () => {
    const p = proposal({ accountBalanceSnapshot: snap(2_000), usableMargin: 40 });
    expect(p.lifecycle).toBe("BLOCKED");
    expect(codes(p)).toContain("INSUFFICIENT_USABLE_MARGIN");
  });

  it("a Stop Loss change re-sizes: wider SL → fewer lots, risk still ≤ 25%", () => {
    const tight = proposal({ accountBalanceSnapshot: snap(200), stopLoss: 1990 });
    const wide = proposal({ accountBalanceSnapshot: snap(200), stopLoss: 1975 });
    expect(tight.quantity.normalizedQuantity).toBe(5);
    expect(wide.quantity.normalizedQuantity).toBe(2);
    expect(wide.capital.projectedLossAtStopLoss!).toBeLessThanOrEqual(50 + 1e-9);
  });
});

describe("Net R:R gate (FIXTURE, 1 lot, risk $10)", () => {
  const base = { direction: "BUY" as const, entryPrice: 2000, stopLoss: 1990, quantity: 1, contract: xauContract() };

  it("3.0 passes, 2.99 fails, 4.0 passes", () => {
    expect(validateMonetaryRewardToRisk({ ...base, takeProfit: 2030 }).ok).toBe(true);
    expect(validateMonetaryRewardToRisk({ ...base, takeProfit: 2029.9 }).ok).toBe(false);
    expect(validateMonetaryRewardToRisk({ ...base, takeProfit: 2040 }).ok).toBe(true);
  });

  it("verified costs subtracted once; unverified commission ignored", () => {
    expect(validateMonetaryRewardToRisk({ ...base, takeProfit: 2030, costDataVerified: true, estimatedCostsAccount: 1 }).ok).toBe(false);
    expect(validateMonetaryRewardToRisk({ ...base, takeProfit: 2031, costDataVerified: true, estimatedCostsAccount: 1 }).ok).toBe(true);
    expect(validateMonetaryRewardToRisk({ ...base, takeProfit: 2030, costDataVerified: false, estimatedCostsAccount: 5 }).ok).toBe(true);
  });

  it("invalid TP geometry rejected", () => {
    expect(validateMonetaryRewardToRisk({ ...base, takeProfit: 1995 }).ok).toBe(false);
  });
});

describe("Safety — new risk/lock modules contain no broker mutation calls", () => {
  const root = path.resolve(process.cwd(), "ai/forex-ai/automated-trading");
  const files = [
    "account-risk/policy.ts",
    "account-risk/balance-snapshot.ts",
    "position-lock/classify.ts",
    "position-lock/store.ts",
    "position-lock/monitor.ts",
    "position-lock/file-mutex.ts",
  ];
  it.each(files)("%s has no submit/modify/cancel/close/DEMO-mutation calls", (rel) => {
    const src = fs.readFileSync(path.join(root, rel), "utf8");
    expect(src).not.toMatch(/demoMutation|demo-mutation|openMarket|createOrder|sendRequest|closeTrade|cancelPending|attachProtective/);
    expect(src).not.toMatch(/placesOrders:\s*true|mutatesBroker:\s*true|acceptsForExecution:\s*true/);
  });
});
