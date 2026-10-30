/**
 * Phase 3.10 — Fail-closed open fill assessment + critical alert emission.
 * No broker mutations. No customer alert delivery.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assessOpenFillAmount,
  blocksAdditionalDemoEntries,
} from "../../../../ai/forex-ai/automated-trading/demo-execution/open-fill-assessment.js";
import {
  emitCriticalAlert,
  resetCriticalAlertStateForTests,
  setCriticalAlertLocalAuditFailForTests,
  setCriticalAlertTestSinkForTests,
} from "../../../../ai/forex-ai/automated-trading/demo-execution/critical-alert.js";
import { readFileSync as readSrc } from "node:fs";

describe("Phase 59.0.17 open fill amount assessment", () => {
  it("passes when filled amount equals baseUnitSize × lots", () => {
    const r = assessOpenFillAmount({
      requestedLots: 2,
      baseUnitSize: 1000,
      filledAmount: 2000,
    });
    expect(r.ok).toBe(true);
    expect(r.fullFillConfirmed).toBe(true);
    expect(r.partialFillSuspected).toBe(false);
    expect(r.code).toBe("OPEN_FILL_AMOUNT_OK");
  });

  it("fails closed on undersize/partial fill and does not invent success", () => {
    const r = assessOpenFillAmount({
      requestedLots: 2,
      baseUnitSize: 1,
      filledAmount: 1,
    });
    expect(r.ok).toBe(false);
    expect(r.partialFillSuspected).toBe(true);
    expect(r.fullFillConfirmed).toBe(false);
    expect(r.code).toBe("OPEN_FILL_AMOUNT_MISMATCH");
  });

  it("fails closed on oversize fill and missing/invalid amount", () => {
    expect(assessOpenFillAmount({
      requestedLots: 1,
      baseUnitSize: 1,
      filledAmount: 2,
    }).code).toBe("OPEN_FILL_AMOUNT_MISMATCH");

    expect(assessOpenFillAmount({
      requestedLots: 1,
      baseUnitSize: 1,
      filledAmount: null,
    }).code).toBe("OPEN_FILL_AMOUNT_UNVERIFIED");

    expect(assessOpenFillAmount({
      requestedLots: 1,
      baseUnitSize: null,
      filledAmount: 1,
    }).code).toBe("OPEN_FILL_BASE_UNIT_SIZE_UNVERIFIED");
  });

  it("blocks additional entries for protection failure, fill mismatch, and reconciliation", () => {
    expect(blocksAdditionalDemoEntries({
      state: "PROTECTION_FAILED",
      fillConfirmed: true,
      tradeId: "t1",
      remainingAmount: 1,
      lastCode: "PROTECTION_UNVERIFIED",
    })).toBe(true);

    expect(blocksAdditionalDemoEntries({
      state: "RECONCILIATION_REQUIRED",
      fillConfirmed: true,
      tradeId: "t1",
      remainingAmount: 1,
      lastCode: "OPEN_FILL_AMOUNT_MISMATCH",
    })).toBe(true);

    expect(blocksAdditionalDemoEntries({
      state: "PROTECTED",
      fillConfirmed: true,
      tradeId: "t1",
      remainingAmount: 1,
      lastCode: "OK",
    })).toBe(false);

    // Closed / zero remaining must not block forever
    expect(blocksAdditionalDemoEntries({
      state: "PROTECTION_FAILED",
      fillConfirmed: true,
      tradeId: "t1",
      remainingAmount: 0,
      lastCode: "PROTECTION_UNVERIFIED",
    })).toBe(false);
  });

  it("documents that multi-event partial-fill streaming is not implemented (fail closed)", () => {
    const mod = readSrc(
      join(process.cwd(), "ai/forex-ai/automated-trading/demo-execution/open-fill-assessment.ts"),
      "utf8",
    );
    expect(mod).toMatch(/Multiple incremental fill events are NOT supported/i);
    const orch = readSrc(
      join(process.cwd(), "ai/forex-ai/automated-trading/demo-execution/orchestrator.ts"),
      "utf8",
    );
    expect(orch).toContain("assessOpenFillAmount");
    expect(orch).toContain("emitCriticalAlert");
    expect(orch).toContain("Streaming multi-partial fills are not supported");
  });
});

describe("Phase 59.0.17 critical alert emission", () => {
  let storageRoot: string;
  const prevStorage = process.env.KWIZERA_STORAGE_ROOT;

  beforeEach(() => {
    storageRoot = mkdtempSync(join(tmpdir(), "kw-crit-alert-"));
    process.env.KWIZERA_STORAGE_ROOT = storageRoot;
    resetCriticalAlertStateForTests();
  });

  afterEach(() => {
    resetCriticalAlertStateForTests();
    if (prevStorage == null) delete process.env.KWIZERA_STORAGE_ROOT;
    else process.env.KWIZERA_STORAGE_ROOT = prevStorage;
    rmSync(storageRoot, { recursive: true, force: true });
  });

  it("delivers via local audit sink without customer channels", async () => {
    const r = await emitCriticalAlert({
      code: "PROTECTION_UNVERIFIED",
      message: "test unprotected",
      lifecycleId: "lc1",
      tradeId: "tr1",
      instrument: "XAU/USD",
      dedupeKey: "unprotected:tr1",
    });
    expect(r.delivered).toBe(true);
    expect(r.ok).toBe(true);
    expect(r.suppressedDuplicate).toBe(false);
    expect(r.localAuditRecorded).toBe(true);
    expect(r.channel).toBe("local-audit");
    expect(r.attempts.length).toBeGreaterThanOrEqual(1);
    const auditPath = join(storageRoot, "forex", "critical-alerts.jsonl");
    expect(existsSync(auditPath)).toBe(true);
    const line = readFileSync(auditPath, "utf8").trim().split("\n")[0]!;
    const row = JSON.parse(line) as { customerDelivery?: boolean; code?: string };
    expect(row.customerDelivery).toBe(false);
    expect(row.code).toBe("PROTECTION_UNVERIFIED");
  });

  it("retries sink failures then reports delivery failure", async () => {
    let calls = 0;
    setCriticalAlertTestSinkForTests({
      channel: "test-fail",
      async deliver() {
        calls += 1;
        return { ok: false, error: "SINK_DOWN" };
      },
    });
    const r = await emitCriticalAlert({
      code: "OPEN_FILL_AMOUNT_MISMATCH",
      message: "partial",
      dedupeKey: "fill:t-fail",
      lifecycleId: "lc-fail",
    }, { maxAttempts: 3 });
    expect(calls).toBe(3);
    expect(r.delivered).toBe(false);
    expect(r.ok).toBe(false);
    expect(r.attempts).toHaveLength(3);
    expect(r.attempts.every((a) => a.ok === false)).toBe(true);
  });

  it("retries then succeeds on later attempt", async () => {
    let calls = 0;
    setCriticalAlertTestSinkForTests({
      channel: "test-flaky",
      async deliver() {
        calls += 1;
        if (calls < 3) return { ok: false, error: "TRANSIENT" };
        return { ok: true };
      },
    });
    const r = await emitCriticalAlert({
      code: "PROTECTION_UNVERIFIED",
      message: "retry ok",
      dedupeKey: "unprotected:retry",
    }, { maxAttempts: 3 });
    expect(calls).toBe(3);
    expect(r.delivered).toBe(true);
    expect(r.ok).toBe(true);
  });

  it("suppresses duplicate alerts within TTL", async () => {
    const first = await emitCriticalAlert({
      code: "PROTECTION_UNVERIFIED",
      message: "once",
      dedupeKey: "unprotected:dup",
    });
    const second = await emitCriticalAlert({
      code: "PROTECTION_UNVERIFIED",
      message: "once",
      dedupeKey: "unprotected:dup",
    });
    expect(first.suppressedDuplicate).toBe(false);
    expect(first.delivered).toBe(true);
    expect(second.suppressedDuplicate).toBe(true);
    expect(second.delivered).toBe(false);
  });

  it("fails closed when local audit cannot be recorded", async () => {
    setCriticalAlertLocalAuditFailForTests(true);
    const r = await emitCriticalAlert({
      code: "PROTECTION_UNVERIFIED",
      message: "audit fail",
      dedupeKey: "unprotected:audit-fail",
    });
    expect(r.localAuditRecorded).toBe(false);
    expect(r.ok).toBe(false);
  });
});

describe("Phase 59.0.17 API/FE source guards", () => {
  it("API rejects missing idempotency and invalid lots; ACCEPTED_PENDING not success", () => {
    const api = readSrc(join(process.cwd(), "dev/server/forex-automated-trading-api.ts"), "utf8");
    expect(api).not.toMatch(/demo_open_\$\{Date\.now\(\)\}/);
    expect(api).toContain('code: "IDEMPOTENCY_KEY_REQUIRED"');
    expect(api).toContain('code: "LOTS_INVALID"');
    const orch = readSrc(
      join(process.cwd(), "ai/forex-ai/automated-trading/demo-execution/orchestrator.ts"),
      "utf8",
    );
    expect(orch).toContain("ACCEPTED_PENDING_UNCONFIRMED");
    expect(orch).toContain("mayAttemptDemoClose");
    expect(orch).toContain("mayAttemptDemoCancel");
    expect(orch).toMatch(/ok:\s*false[\s\S]*ACCEPTED_PENDING/);
  });

  it("UI has no demo open-market submit control that bypasses API", () => {
    const ui = readSrc(join(process.cwd(), "desktop/forex/ForexAutomatedTradingPage.tsx"), "utf8");
    expect(ui).not.toContain("/demo-lifecycle/open-market");
    expect(ui).toContain("demo-lifecycle/grant");
    expect(ui).toContain("placesOrders");
  });
});
