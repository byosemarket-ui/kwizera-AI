/**
 * Stage 4 — Risk limits propose/approve administration (fail-closed; no broker mutation).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  resetAtRiskPolicyStoreForTests,
  resolveSlippageLimit,
  resolveSpreadLimit,
  STAGE3_TRACKED_INSTRUMENTS,
  validateAbsolutePriceLimit,
} from "../../../../ai/forex-ai/automated-trading/risk-policy/index.js";
import {
  runPreExecutionValidation,
  OWNER_MAX_LOTS_EXECUTION,
  type AtPreExecutionValidationInput,
} from "../../../../ai/forex-ai/automated-trading/broker-execution/index.js";

const tmpDirs: string[] = [];

afterEach(() => {
  delete process.env.KWIZERA_AT_MAX_SPREAD_ABSOLUTE;
  for (const d of tmpDirs.splice(0)) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

function tempStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "at-risk-policy-s4-"));
  tmpDirs.push(dir);
  return resetAtRiskPolicyStoreForTests(path.join(dir, "risk-policy.json"));
}

function hasCode(r: { blockingReasons: { code: string }[] }, code: string): boolean {
  return r.blockingReasons.some((b) => b.code === code);
}

function minimalPrecheck(over: Partial<AtPreExecutionValidationInput> = {}): AtPreExecutionValidationInput {
  const nowMs = Date.now();
  return {
    handoff: null,
    proposal: null,
    environment: "DEMO",
    controls: {
      emergencyEntryLock: true,
      masterEnable: false,
      automaticEntry: false,
      positionManagement: false,
    },
    foundation: {
      executionMasterEnabled: false,
      armedForSubmission: false,
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
      lifecycle: "IDLE",
    },
    account: null,
    market: {
      bid: 1.1,
      ask: 1.1002,
      spread: 0.0002,
      quoteAgeMs: 400,
      tradingEligible: true,
      marketClosed: false,
      instrument: "EUR/USD",
    },
    exposure: null,
    instrumentContract: null,
    riskLimits: {
      maxSpreadAbsolute: null,
      maxSlippageAbsolute: null,
    },
    nowMs,
    ...over,
  };
}

describe("Stage 4 — instruments and missing config", () => {
  it("tracks all four instruments as NOT_CONFIGURED", () => {
    const store = tempStore();
    const doc = store.get();
    for (const inst of STAGE3_TRACKED_INSTRUMENTS) {
      expect(doc.instruments[inst].spread.approvalState).toBe("NOT_CONFIGURED");
      expect(doc.instruments[inst].slippage.approvalState).toBe("NOT_CONFIGURED");
      expect(doc.instruments[inst].spread.maxSpreadAbsolute).toBeNull();
      expect(doc.instruments[inst].slippage.maxSlippageAbsolute).toBeNull();
      expect(doc.instruments[inst].documentedPricePrecision).toBeTypeOf("number");
    }
  });

  it("keeps missing spread/slippage unresolved for precheck", () => {
    const store = tempStore();
    expect(resolveSpreadLimit({ instrument: "EUR/USD", store }).status).toBe("NOT_CONFIGURED");
    expect(resolveSlippageLimit({ instrument: "EUR/USD", store }).status).toBe("NOT_CONFIGURED");
    const r = runPreExecutionValidation(minimalPrecheck());
    // DYNAMIC mode replaces sole static SPREAD_LIMIT_NOT_CONFIGURED gate.
    expect(
      hasCode(r, "SPREAD_DATA_UNAVAILABLE")
      || hasCode(r, "SPREAD_DATA_INSUFFICIENT")
      || hasCode(r, "QUOTE_MISSING")
      || r.checks.some((c) => c.id === "dynamic_spread"),
    ).toBe(true);
    expect(hasCode(r, "SPREAD_LIMIT_NOT_CONFIGURED")).toBe(false);
    expect(hasCode(r, "SLIPPAGE_LIMIT_NOT_CONFIGURED")).toBe(true);
    expect(r.allowed).toBe(false);
  });
});

describe("Stage 4 — propose vs approve", () => {
  it("proposed policy is not active until approved", () => {
    const store = tempStore();
    const proposed = store.proposeSpread({
      instrument: "EUR/USD",
      maxSpreadAbsolute: 0.0003,
      actor: "editor",
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect(proposed.document.instruments["EUR/USD"].spread.approvalState).toBe("PENDING_APPROVAL");
    expect(proposed.document.instruments["EUR/USD"].spread.proposed?.value).toBe(0.0003);
    expect(proposed.document.instruments["EUR/USD"].spread.maxSpreadAbsolute).toBeNull();
    const resolved = resolveSpreadLimit({ instrument: "EUR/USD", store });
    expect(resolved.value).toBeNull();
    expect(resolved.approvalState).toBe("PENDING_APPROVAL");
  });

  it("rejects approve without confirm=true", () => {
    const store = tempStore();
    store.proposeSpread({ instrument: "GBP/USD", maxSpreadAbsolute: 0.0004, actor: "editor" });
    const denied = store.approveSpread({ instrument: "GBP/USD", actor: "owner", confirm: false });
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.status).toBe("CONFIRMATION_REQUIRED");
  });

  it("authorized approve activates policy and records audit/previous values", () => {
    const store = tempStore();
    store.proposeSpread({ instrument: "USD/JPY", maxSpreadAbsolute: 0.03, actor: "editor" });
    const approved = store.approveSpread({
      instrument: "USD/JPY",
      actor: "owner-admin",
      confirm: true,
    });
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    const slot = approved.document.instruments["USD/JPY"].spread;
    expect(slot.approvalState).toBe("APPROVED");
    expect(slot.status).toBe("VERIFIED");
    expect(slot.maxSpreadAbsolute).toBe(0.03);
    expect(slot.approvedBy).toBe("owner-admin");
    expect(slot.approvedAtUtc).toBeTruthy();
    expect(slot.effectiveAtUtc).toBeTruthy();
    expect(slot.proposed).toBeNull();
    expect(approved.document.audit.some((a) => a.action === "APPROVE_SPREAD")).toBe(true);
    const resolved = resolveSpreadLimit({ instrument: "USD/JPY", store });
    expect(resolved.value).toBe(0.03);
    expect(resolved.source).toBe("instrument_policy");
  });

  it("rejects invalid numeric values", () => {
    expect(validateAbsolutePriceLimit(0).ok).toBe(false);
    expect(validateAbsolutePriceLimit(-1).ok).toBe(false);
    expect(validateAbsolutePriceLimit(Number.NaN).ok).toBe(false);
    expect(validateAbsolutePriceLimit(Number.POSITIVE_INFINITY).ok).toBe(false);
    const store = tempStore();
    expect(store.proposeSlippage({ instrument: "XAU/USD", maxSlippageAbsolute: -2, actor: "x" }).ok).toBe(false);
  });

  it("enforces version conflicts", () => {
    const store = tempStore();
    const v = store.get().version;
    store.proposeSpread({ instrument: "EUR/USD", maxSpreadAbsolute: 0.0002, actor: "a" });
    const conflict = store.proposeSlippage({
      instrument: "EUR/USD",
      maxSlippageAbsolute: 0.0001,
      actor: "a",
      expectedVersion: v, // stale
    });
    expect(conflict.ok).toBe(false);
    if (conflict.ok) return;
    expect(conflict.status).toBe("VERSION_CONFLICT");
  });

  it("rejected policy is not used by resolve", () => {
    const store = tempStore();
    store.proposeSlippage({ instrument: "EUR/USD", maxSlippageAbsolute: 0.0002, actor: "editor" });
    const rejected = store.rejectSlippage({ instrument: "EUR/USD", actor: "owner", reason: "too wide" });
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) return;
    expect(rejected.document.instruments["EUR/USD"].slippage.approvalState).toBe("REJECTED");
    const resolved = resolveSlippageLimit({ instrument: "EUR/USD", store });
    expect(resolved.value).toBeNull();
    expect(resolved.approvalState).toBe("REJECTED");
  });

  it("keeps prior approved active while a new proposal is pending", () => {
    const store = tempStore();
    store.proposeSpread({ instrument: "EUR/USD", maxSpreadAbsolute: 0.0003, actor: "e1" });
    store.approveSpread({ instrument: "EUR/USD", actor: "owner", confirm: true });
    store.proposeSpread({ instrument: "EUR/USD", maxSpreadAbsolute: 0.0005, actor: "e2" });
    const slot = store.get().instruments["EUR/USD"].spread;
    expect(slot.maxSpreadAbsolute).toBe(0.0003);
    expect(slot.proposed?.value).toBe(0.0005);
    expect(slot.approvalState).toBe("PENDING_APPROVAL");
    expect(resolveSpreadLimit({ instrument: "EUR/USD", store }).value).toBe(0.0003);
  });

  it("supports rollback to previous approved revision", () => {
    const store = tempStore();
    store.proposeSpread({ instrument: "GBP/USD", maxSpreadAbsolute: 0.0002, actor: "e" });
    store.approveSpread({ instrument: "GBP/USD", actor: "owner", confirm: true });
    store.proposeSpread({ instrument: "GBP/USD", maxSpreadAbsolute: 0.0008, actor: "e" });
    store.approveSpread({ instrument: "GBP/USD", actor: "owner", confirm: true });
    expect(store.get().instruments["GBP/USD"].spread.maxSpreadAbsolute).toBe(0.0008);
    const rolled = store.rollbackSpread({ instrument: "GBP/USD", actor: "owner" });
    expect(rolled.ok).toBe(true);
    if (!rolled.ok) return;
    expect(rolled.document.instruments["GBP/USD"].spread.maxSpreadAbsolute).toBe(0.0002);
    expect(rolled.document.audit.some((a) => a.action === "ROLLBACK_SPREAD")).toBe(true);
  });

  it("preserves audit history entries", () => {
    const store = tempStore();
    store.proposeSpread({ instrument: "XAU/USD", maxSpreadAbsolute: 0.5, actor: "e" });
    store.approveSpread({ instrument: "XAU/USD", actor: "owner", confirm: true });
    const hist = store.getHistory(20);
    expect(hist.some((h) => h.action === "PROPOSE_SPREAD")).toBe(true);
    expect(hist.some((h) => h.action === "APPROVE_SPREAD")).toBe(true);
    expect(hist.find((h) => h.action === "APPROVE_SPREAD")?.nextValue).toBe(0.5);
  });
});

describe("Stage 4 — precheck integration", () => {
  it("approved policy integrates with precheck spread check", () => {
    const store = tempStore();
    store.proposeSpread({ instrument: "EUR/USD", maxSpreadAbsolute: 0.001, actor: "e" });
    store.approveSpread({ instrument: "EUR/USD", actor: "owner", confirm: true });
    store.proposeSlippage({ instrument: "EUR/USD", maxSlippageAbsolute: 0.01, actor: "e" });
    store.approveSlippage({ instrument: "EUR/USD", actor: "owner", confirm: true });
    const spread = resolveSpreadLimit({ instrument: "EUR/USD", store });
    const slip = resolveSlippageLimit({ instrument: "EUR/USD", store });
    const r = runPreExecutionValidation(minimalPrecheck({
      riskLimits: {
        maxSpreadAbsolute: spread.value,
        maxSlippageAbsolute: slip.value,
      },
    }));
    expect(r.checks.some((c) => c.id === "dynamic_spread")).toBe(true);
    expect(hasCode(r, "SPREAD_LIMIT_NOT_CONFIGURED")).toBe(false);
    expect(spread.value).toBe(0.001);
    expect(r.placesOrders).toBe(false);
    expect(r.acceptsForExecution).toBe(false);
    expect(r.mutatesBroker).toBe(false);
    expect(r.executionAuthorized).toBe(false);
    expect(r.ownerMaxLots).toBe(OWNER_MAX_LOTS_EXECUTION);
    expect(hasCode(r, "EXECUTION_MASTER_OFF")).toBe(true);
    expect(r.allowed).toBe(false);
  });

  it("pending-only policy: null resolved ceiling does not sole-fail; Dynamic Spread evaluates", () => {
    const store = tempStore();
    store.proposeSpread({ instrument: "EUR/USD", maxSpreadAbsolute: 0.001, actor: "e" });
    const spread = resolveSpreadLimit({ instrument: "EUR/USD", store });
    expect(spread.value).toBeNull();
    const r = runPreExecutionValidation(minimalPrecheck({
      riskLimits: {
        maxSpreadAbsolute: spread.value,
        maxSlippageAbsolute: null,
      },
    }));
    expect(hasCode(r, "SPREAD_LIMIT_NOT_CONFIGURED")).toBe(false);
    expect(r.checks.some((c) => c.id === "dynamic_spread")).toBe(true);
    expect(hasCode(r, "SLIPPAGE_LIMIT_NOT_CONFIGURED")).toBe(true);
  });
});
