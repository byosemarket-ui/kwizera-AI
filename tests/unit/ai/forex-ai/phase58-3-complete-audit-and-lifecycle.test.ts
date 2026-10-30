/**
 * Phase 58.3 — complete DEMO lifecycle audit unit tests (no live broker mutation).
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DemoExecutionGrantStore,
  resetDemoExecutionGrantStoreForTests,
} from "../../../../ai/forex-ai/automated-trading/demo-execution/grant-store.ts";
import {
  DemoLifecycleOrchestrator,
  resetDemoLifecycleOrchestratorForTests,
} from "../../../../ai/forex-ai/automated-trading/demo-execution/orchestrator.ts";
import { evaluateDemoLifecyclePreflight } from "../../../../ai/forex-ai/automated-trading/demo-execution/preflight.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("Phase 58.3 wiring", () => {
  it("sidecar supports cancel-pending and partial close amount", () => {
    const mod = read("services/forexconnect-sidecar/mutation_demo.py");
    expect(mod).toContain("cancel_pending_order");
    expect(mod).toContain("DELETE_ORDER");
    expect(mod).toContain("INVALID_CLOSE_AMOUNT");
    expect(mod).toContain("PARTIALLY_CLOSED");
    expect(mod).toContain("read_offer_quote");
    const server = read("services/forexconnect-sidecar/server.py");
    expect(server).toContain("/demo-mutation/cancel-pending");
    expect(server).toContain("/offer-quote");
  });

  it("API allowlists demo-lifecycle before order regex and exposes cancel-pending", () => {
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toContain("isDemoLifecyclePath");
    expect(api).toContain("demo-lifecycle/cancel-pending");
    expect(api).toContain("demo-lifecycle/attach-protective");
    expect(api).toContain("demo-lifecycle/reconcile-protection");
    expect(api).toContain("placesOrders: false");
  });

  it("API requires client idempotencyKey and rejects invented Date.now fallbacks", () => {
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).not.toMatch(/demo_open_\$\{Date\.now\(\)\}/);
    expect(api).not.toMatch(/demo_close_\$\{Date\.now\(\)\}/);
    expect(api).not.toMatch(/demo_cancel_\$\{Date\.now\(\)\}/);
    expect(api).not.toContain("Math.max(1, Math.floor(Number(body.lots ?? 1)))");
    expect(api).toContain('code: "IDEMPOTENCY_KEY_REQUIRED"');
    expect(api).toContain('code: "LOTS_INVALID"');
  });

  it("Node bridge exposes cancel and offer-quote", () => {
    const client = read("ai/market-data/forexconnect/client.ts");
    expect(client).toContain("demoMutationCancelPending");
    expect(client).toContain("getOfferQuote");
  });

  it("ordinary AT remains DisabledBrokerMutationAdapter", () => {
    const stub = read("ai/forex-ai/automated-trading/broker-intent/mutation-stub.ts");
    expect(stub).toContain("DisabledBrokerMutationAdapter");
    expect(stub).toContain("EXECUTION_FORBIDDEN");
  });
});

describe("Phase 58.3 DEMO preflight", () => {
  it("passes when DEMO session, grant, quote, and optional protection are valid", () => {
    const nowMs = Date.parse("2026-10-25T12:00:00.000Z");
    const r = evaluateDemoLifecyclePreflight({
      instrument: "EUR/USD",
      direction: "BUY",
      lots: 1,
      maxLots: 1,
      environment: "demo",
      sessionConnected: true,
      quotePresent: true,
      quoteBid: 1.1,
      quoteAsk: 1.1002,
      quoteInstrument: "EUR/USD",
      quoteTimestamp: nowMs - 250,
      nowMs,
      freshnessThresholdMs: 15_000,
      requireProtective: true,
      stopLoss: 1.095,
      takeProfit: 1.115,
      entryHint: null,
      grantActive: true,
    });
    expect(r.ok).toBe(true);
    expect(r.maySubmitDemoMutation).toBe(true);
    expect(r.placesOrdersGlobal).toBe(false);
  });

  it("blocks stale/missing quote and LIVE environment", () => {
    const nowMs = Date.parse("2026-10-25T12:00:00.000Z");
    const missing = evaluateDemoLifecyclePreflight({
      instrument: "EUR/USD",
      direction: "BUY",
      lots: 1,
      maxLots: 1,
      environment: "demo",
      sessionConnected: true,
      quotePresent: false,
      quoteBid: null,
      quoteAsk: null,
      requireProtective: false,
      stopLoss: null,
      takeProfit: null,
      entryHint: null,
      grantActive: true,
    });
    expect(missing.ok).toBe(false);
    expect(missing.blockers).toContain("QUOTE_UNAVAILABLE");

    const stale = evaluateDemoLifecyclePreflight({
      instrument: "EUR/USD",
      direction: "BUY",
      lots: 1,
      maxLots: 1,
      environment: "demo",
      sessionConnected: true,
      quotePresent: true,
      quoteBid: 1.1,
      quoteAsk: 1.1002,
      quoteInstrument: "EUR/USD",
      lastQuoteAgeMs: 60_000,
      nowMs,
      freshnessThresholdMs: 15_000,
      requireProtective: false,
      stopLoss: null,
      takeProfit: null,
      entryHint: null,
      grantActive: true,
    });
    expect(stale.blockers).toContain("QUOTE_STALE");
    expect(stale.maySubmitDemoMutation).toBe(false);

    const live = evaluateDemoLifecyclePreflight({
      instrument: "EUR/USD",
      direction: "BUY",
      lots: 1,
      maxLots: 1,
      environment: "live",
      sessionConnected: true,
      quotePresent: true,
      quoteBid: 1.1,
      quoteAsk: 1.1002,
      quoteInstrument: "EUR/USD",
      quoteTimestamp: nowMs - 100,
      nowMs,
      requireProtective: false,
      stopLoss: null,
      takeProfit: null,
      entryHint: null,
      grantActive: true,
    });
    expect(live.blockers).toContain("ENVIRONMENT_NOT_DEMO");
  });
});

describe("Phase 58.3 grant + early validation", () => {
  let dir: string;
  let cwdSpy: ReturnType<typeof vi.spyOn> | null = null;
  let prevStorage: string | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "kw-demo-life-583-"));
    prevStorage = process.env.KWIZERA_STORAGE_ROOT;
    process.env.KWIZERA_STORAGE_ROOT = dir;
    mkdirSync(join(dir, "forex"), { recursive: true });
    mkdirSync(join(dir, "data", "forex"), { recursive: true });
    writeFileSync(join(dir, "data", "forex", "demo-execution-grants.json"), JSON.stringify({ grants: [] }));
    writeFileSync(join(dir, "data", "forex", "demo-lifecycle-records.json"), JSON.stringify({ records: [] }));
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(dir);
    resetDemoExecutionGrantStoreForTests();
    resetDemoLifecycleOrchestratorForTests();
  });

  afterEach(() => {
    cwdSpy?.mockRestore();
    if (prevStorage == null) delete process.env.KWIZERA_STORAGE_ROOT;
    else process.env.KWIZERA_STORAGE_ROOT = prevStorage;
    resetDemoExecutionGrantStoreForTests();
    resetDemoLifecycleOrchestratorForTests();
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates Phase 58.3 purpose grants", () => {
    const store = new DemoExecutionGrantStore(join(dir, "data", "forex", "grants.json"));
    const g = store.create({ ttlMs: 60_000, maxLots: 1, instrumentAllowlist: ["XAU/USD"] });
    expect(g.purpose).toBe("PHASE_58_3_DEMO_LIFECYCLE");
    expect(g.environment).toBe("DEMO");
    expect(g.instrumentAllowlist).toEqual(["XAU/USD"]);
  });

  it("rejects requireProtective without levels before broker call", async () => {
    const orch = new DemoLifecycleOrchestrator();
    const grant = orch.createGrant({ ttlMs: 120_000, maxLots: 1, instrumentAllowlist: ["EUR/USD"] });
    const result = await orch.openMarket({
      grantId: grant.grantId,
      instrument: "EUR/USD",
      direction: "BUY",
      lots: 1,
      requireProtective: true,
      idempotencyKey: "p58-3-no-levels",
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("PROTECTION_LEVELS_REQUIRED");
    expect(result.record.mutatesBroker).toBe(false);
  });
});
