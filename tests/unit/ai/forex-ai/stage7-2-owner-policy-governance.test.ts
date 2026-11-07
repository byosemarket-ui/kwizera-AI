/**
 * Stage 7.2 — owner-gated spread/slippage governance + Stage 5–7 consumption.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AssertNeverCalledMutationPort } from "../../../../ai/forex-ai/automated-trading/demo-submission-adapter/mutation-port.js";
import { resolveSpreadLimit, resolveSlippageLimit } from "../../../../ai/forex-ai/automated-trading/risk-policy/resolve.js";
import {
  AtRiskPolicyStore,
  resetAtRiskPolicyStoreForTests,
} from "../../../../ai/forex-ai/automated-trading/risk-policy/store.js";
import { evaluateControlledDemoReadiness } from "../../../../ai/forex-ai/automated-trading/controlled-demo-execution/readiness.js";
import {
  resetControlledDemoExecutionStoreForTests,
} from "../../../../ai/forex-ai/automated-trading/controlled-demo-execution/index.js";
import { runDemoExecutionReadinessAudit } from "../../../../ai/forex-ai/automated-trading/demo-execution-readiness-audit/index.js";
import { isOwnerIdentityConfigured } from "../../../../ai/admin-control-plane/owner-auth-boundary.js";

function tmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "s72-pol-"));
}

describe("Stage 7.2 — policy propose/approve/reject/rollback", () => {
  let root: string;
  let store: AtRiskPolicyStore;
  let port: AssertNeverCalledMutationPort;
  const PREV_OWNER = process.env.KWIZERA_OWNER_API_TOKEN;
  const PREV_ADMIN = process.env.KWIZERA_ADMIN_API_TOKEN;

  beforeEach(() => {
    root = tmpRoot();
    store = resetAtRiskPolicyStoreForTests(path.join(root, "risk-policy.json"));
    resetControlledDemoExecutionStoreForTests(root);
    port = new AssertNeverCalledMutationPort();
    process.env.KWIZERA_ADMIN_API_TOKEN = "admin-s72-aaaa";
    process.env.KWIZERA_OWNER_API_TOKEN = "owner-s72-bbbb";
  });

  afterEach(() => {
    if (PREV_OWNER === undefined) delete process.env.KWIZERA_OWNER_API_TOKEN;
    else process.env.KWIZERA_OWNER_API_TOKEN = PREV_OWNER;
    if (PREV_ADMIN === undefined) delete process.env.KWIZERA_ADMIN_API_TOKEN;
    else process.env.KWIZERA_ADMIN_API_TOKEN = PREV_ADMIN;
    expect(port.calls).toHaveLength(0);
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it("missing / unapproved policy is not consumed by Stage 5–7 resolve", () => {
    const spread = resolveSpreadLimit({ instrument: "EUR/USD", store });
    const slip = resolveSlippageLimit({ instrument: "EUR/USD", store });
    expect(spread.status).not.toBe("VERIFIED");
    expect(slip.status).not.toBe("VERIFIED");
  });

  it("propose then owner approve activates VERIFIED consumption; stale version rejected", () => {
    const p1 = store.proposeSpread({
      instrument: "EUR/USD",
      maxSpreadAbsolute: 0.00025,
      actor: "forex-admin",
      expectedVersion: 1,
    });
    expect(p1.ok).toBe(true);
    if (!p1.ok) return;
    expect(p1.document.instruments["EUR/USD"].spread.approvalState).toBe("PENDING_APPROVAL");
    expect(resolveSpreadLimit({ instrument: "EUR/USD", store }).status).not.toBe("VERIFIED");

    const stale = store.approveSpread({
      instrument: "EUR/USD",
      actor: "system-owner",
      confirm: true,
      expectedVersion: 1,
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.status).toBe("VERSION_CONFLICT");

    const ok = store.approveSpread({
      instrument: "EUR/USD",
      actor: "system-owner",
      confirm: true,
      expectedVersion: p1.document.version,
    });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.document.instruments["EUR/USD"].spread.status).toBe("VERIFIED");
    expect(ok.document.instruments["EUR/USD"].spread.approvalState).toBe("APPROVED");
    expect(ok.document.instruments["EUR/USD"].spread.maxSpreadAbsolute).toBe(0.00025);
    expect(resolveSpreadLimit({ instrument: "EUR/USD", store }).status).toBe("VERIFIED");
    expect(ok.document.audit.some((a) => a.action === "APPROVE_SPREAD")).toBe(true);
  });

  it("explicit reject and rollback preserve history; negative values rejected", () => {
    const bad = store.proposeSlippage({
      instrument: "GBP/USD",
      maxSlippageAbsolute: -1,
      actor: "admin",
    });
    expect(bad.ok).toBe(false);

    const proposed = store.proposeSlippage({
      instrument: "GBP/USD",
      maxSlippageAbsolute: 0.00015,
      actor: "admin",
      expectedVersion: store.get().version,
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    const rejected = store.rejectSlippage({
      instrument: "GBP/USD",
      actor: "system-owner",
      reason: "Too tight for audit",
      expectedVersion: proposed.document.version,
    });
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) return;
    expect(rejected.document.instruments["GBP/USD"].slippage.approvalState).toBe("REJECTED");

    const again = store.proposeSlippage({
      instrument: "GBP/USD",
      maxSlippageAbsolute: 0.0002,
      actor: "admin",
      expectedVersion: rejected.document.version,
    });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    const approved = store.approveSlippage({
      instrument: "GBP/USD",
      actor: "system-owner",
      confirm: true,
      expectedVersion: again.document.version,
    });
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;

    const next = store.proposeSlippage({
      instrument: "GBP/USD",
      maxSlippageAbsolute: 0.0003,
      actor: "admin",
      expectedVersion: approved.document.version,
    });
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    const approved2 = store.approveSlippage({
      instrument: "GBP/USD",
      actor: "system-owner",
      confirm: true,
      expectedVersion: next.document.version,
    });
    expect(approved2.ok).toBe(true);
    if (!approved2.ok) return;
    expect(approved2.document.instruments["GBP/USD"].slippage.history.length).toBeGreaterThan(0);

    const rolled = store.rollbackSlippage({
      instrument: "GBP/USD",
      actor: "system-owner",
      expectedVersion: approved2.document.version,
    });
    expect(rolled.ok).toBe(true);
    if (!rolled.ok) return;
    expect(rolled.document.instruments["GBP/USD"].slippage.maxSlippageAbsolute).toBe(0.0002);
  });

  it("Stage 7 readiness blocks when owner identity not configured", () => {
    delete process.env.KWIZERA_OWNER_API_TOKEN;
    expect(isOwnerIdentityConfigured()).toBe(false);
    const r = evaluateControlledDemoReadiness({
      proposal: null,
      configuredEnvironment: "DEMO",
      sessionEnvironment: "DEMO",
      accountEnvironment: "demo",
      accountIdMasked: "12***89",
      sessionStatus: "CONNECTED",
      connectionHealthy: true,
      executionMasterEnabled: false,
      emergencyEntryLock: true,
      tradingEnabled: false,
      ownerIdentityConfigured: false,
      activeGrant: null,
      unresolvedAttemptExists: false,
      conflictingActiveExecution: false,
    });
    expect(r.blockers.some((b) => b.code === "OWNER_AUTHORIZATION_NOT_CONFIGURED")).toBe(true);
    expect(r.authorizationPass).toBe(false);
    expect(r.mutatesBroker).toBe(false);
  });

  it("Stage 7.1 audit PASSes owner when configured and still reports missing policies", () => {
    expect(isOwnerIdentityConfigured()).toBe(true);
    const audit = runDemoExecutionReadinessAudit({
      ownerIdentityConfigured: true,
      requireForexAdminProvesOwner: false,
      ownerAuthEvidenceNote: "test configured",
      policyDocumentVersion: 1,
      policiesByInstrument: {
        "EUR/USD": store.getInstrument("EUR/USD"),
        "GBP/USD": store.getInstrument("GBP/USD"),
        "USD/JPY": store.getInstrument("USD/JPY"),
        "XAU/USD": store.getInstrument("XAU/USD"),
      },
      proposal: null,
      configuredEnvironment: "DEMO",
      sessionEnvironment: "DEMO",
      accountEnvironment: "demo",
      accountIdMasked: "12***89",
      sessionStatus: "CONNECTED",
      usableMargin: null,
      accountBalance: null,
      accountEquity: null,
      marginFresh: null,
      proposedOrderMarginRequirement: null,
      proposedOrderMarginSource: null,
      proposedOrderMarginAuthoritative: false,
      quoteFresh: null,
      quoteTimestampUtc: null,
      executionMasterEnabled: false,
      emergencyEntryLock: true,
      tradingEnabled: false,
      activeGrantPresent: false,
      submissionPathwayWired: false,
      protectionSourceCodeConfirmed: true,
      protectionBrokerReadOnlyConfirmed: false,
      protectionFixtureOnly: true,
      protectionLiveVerified: false,
      reconciliationAttemptPersistence: true,
      reconciliationIdempotencyUnique: true,
      reconciliationDuplicateSafe: true,
      reconciliationReadOnlyLookupWired: false,
      reconciliationUnknownBlocksRetry: true,
      reconciliationLiveBrokerLookupVerified: false,
    });
    expect(audit.categories.OWNER_AUTHORIZATION).toBe("PASS");
    expect(audit.findings.some((f) => f.code === "OWNER_AUTHORIZATION_VERIFIED")).toBe(true);
    expect(audit.categories.SPREAD_POLICY).toBe("NOT_CONFIGURED");
    expect(audit.categories.SLIPPAGE_POLICY).toBe("NOT_CONFIGURED");
    expect(audit.overallState).toBe("NOT_READY");
    expect(audit.mutatesBroker).toBe(false);
    expect(audit.controlsObserved.executionMasterEnabled).toBe(false);
    expect(audit.controlsObserved.emergencyEntryLock).toBe(true);
    expect(audit.controlsObserved.activeGrantPresent).toBe(false);
  });

  it("approve without confirm fails; mutation port never called", async () => {
    store.proposeSpread({
      instrument: "USD/JPY",
      maxSpreadAbsolute: 0.02,
      actor: "admin",
      expectedVersion: store.get().version,
    });
    const denied = store.approveSpread({
      instrument: "USD/JPY",
      actor: "system-owner",
      confirm: false,
      expectedVersion: store.get().version,
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.status).toBe("CONFIRMATION_REQUIRED");
    expect(port.calls).toHaveLength(0);
  });
});
