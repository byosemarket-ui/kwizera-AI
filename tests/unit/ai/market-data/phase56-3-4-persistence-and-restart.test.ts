/**
 * Phase 56.3.4 — durable intended subscriptions + restart hydrate (synthetic).
 * Not production Offers evidence. Does not place orders.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ForexConnectLiveCandleService,
  FOREXCONNECT_RESTORE_MAX_ATTEMPTS,
} from "../../../../ai/market-data/forexconnect/live-service.ts";
import {
  ForexConnectIntendedSubscriptionsStore,
  FOREXCONNECT_INTENDED_SCHEMA_VERSION,
  validatePersistedIntendedEntry,
  normalizeForexConnectPersistedEnvironment,
} from "../../../../ai/market-data/forexconnect/intended-subscriptions-store.ts";
import type { ForexConnectBridge } from "../../../../ai/market-data/forexconnect/client.ts";
import { isInstrumentAllowlisted } from "../../../../ai/forex-ai/automated-trading/simulation-risk/allowlist.ts";

function tempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-fc-intended-"));
}

function mockBridge(options?: { disconnected?: boolean; catalog?: string[] }): ForexConnectBridge {
  let updateCount = 0;
  const disconnected = Boolean(options?.disconnected);
  const catalog = options?.catalog ?? ["XAU/USD", "EUR/USD", "US30", "GBP/USD", "XAG/USD"];
  return {
    getConfig: () => ({
      environment: "demo",
      environmentLabel: "FXCM DEMO",
      enabled: true,
    }),
    subscribeQuotes: vi.fn(async (symbol: string) => ({
      ok: true,
      providerSymbol: symbol,
      canonicalSymbol: symbol.replace(/[^A-Za-z0-9.]/g, "").toUpperCase(),
    })),
    unsubscribeQuotes: vi.fn(async () => undefined),
    getHistoricalCandles: vi.fn(async ({ symbol, timeframe }: { symbol: string; timeframe: string }) => ({
      ok: true,
      providerSymbol: symbol,
      canonicalSymbol: symbol.replace(/[^A-Za-z0-9.]/g, "").toUpperCase(),
      displaySymbol: symbol,
      marketType: "FOREX",
      timeframe,
      candles: [{
        time: Math.floor(Date.now() / 60_000) * 60,
        open: 1.1,
        high: 1.1,
        low: 1.1,
        close: 1.1,
        volume: 1,
        closed: false,
      }],
    })),
    pollQuotes: vi.fn(async () => []),
    getStreamStatus: vi.fn(async () => {
      updateCount += 1;
      return {
        ok: true,
        provider: "FOREXCONNECT",
        sessionStatus: disconnected ? "DISCONNECTED" : "CONNECTED",
        streamState: disconnected ? "DISCONNECTED" : "SUBSCRIBED_WAITING",
        offersListenerActive: !disconnected,
        offersPollerActive: !disconnected,
        callbackRegistered: !disconnected,
        subscriptionCount: disconnected ? 0 : 1,
        subscriptions: disconnected ? [] : ["EUR/USD"],
        maxSubscriptions: 8,
        lastQuoteAt: null,
        lastQuoteAgeMs: null,
        lastStreamError: null,
        updateCount,
        lastEventSource: null,
        diagnostics: null,
        priceBasis: "bid",
        trading: "DISABLED",
      };
    }),
    getStatus: vi.fn(async () => ({
      ok: true,
      status: "CONNECTED",
      enabled: true,
      environment: "demo",
      environmentLabel: "DEMO",
      trading: "DISABLED",
    })),
    listInstruments: vi.fn(async () => ({
      ok: true,
      count: catalog.length,
      fetchedAt: new Date().toISOString(),
      instruments: catalog.map((providerSymbol) => ({
        provider: "FOREXCONNECT",
        providerSymbol,
        canonicalSymbol: providerSymbol.replace(/[^A-Za-z0-9.]/g, "").toUpperCase(),
        displaySymbol: providerSymbol,
        marketType: "FOREX",
        baseAsset: null,
        quoteAsset: null,
        status: "available",
      })),
    })),
  } as unknown as ForexConnectBridge;
}

describe("Phase 56.3.4 persistence and restart (synthetic)", () => {
  const services: ForexConnectLiveCandleService[] = [];
  const roots: string[] = [];

  afterEach(async () => {
    for (const s of services) {
      await s.clearAllSessions({ clearIntended: true });
    }
    services.length = 0;
    for (const root of roots) {
      try {
        fs.rmSync(root, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    roots.length = 0;
  });

  it("validates persisted entries and rejects unsafe or unsupported symbols", () => {
    expect(validatePersistedIntendedEntry({
      providerSymbol: "XAU/USD",
      timeframe: "1m",
      rememberedAtMs: Date.now(),
    }).ok).toBe(true);

    expect(validatePersistedIntendedEntry({
      providerSymbol: "../etc/passwd",
      timeframe: "1m",
      rememberedAtMs: Date.now(),
    }).ok).toBe(false);

    expect(validatePersistedIntendedEntry({
      providerSymbol: "EUR/USD",
      timeframe: "99y",
      rememberedAtMs: Date.now(),
    }).ok).toBe(false);

    expect(validatePersistedIntendedEntry({
      providerSymbol: "FAKE/XYZ",
      timeframe: "1m",
      rememberedAtMs: Date.now(),
    }, { catalogSymbols: new Set(["XAU/USD", "EUR/USD"]) }).ok).toBe(false);

    expect(normalizeForexConnectPersistedEnvironment("demo")).toBe("demo");
    expect(normalizeForexConnectPersistedEnvironment("real")).toBe("live");
  });

  it("persists intended subscriptions and hydrates into a fresh service after restart", async () => {
    const root = tempRoot();
    roots.push(root);
    const storeA = new ForexConnectIntendedSubscriptionsStore(root);
    const bridge = mockBridge();
    const liveA = new ForexConnectLiveCandleService({ bridge, persistence: storeA });
    services.push(liveA);

    await liveA.ensure("XAU/USD", "1m");
    await liveA.ensure("EUR/USD", "1m");
    expect(liveA.listIntendedSubscriptions().map((r) => r.providerSymbol).sort()).toEqual([
      "EUR/USD",
      "XAU/USD",
    ]);

    // Simulate process restart: new service instance, same durable store.
    const storeB = new ForexConnectIntendedSubscriptionsStore(root);
    const liveB = new ForexConnectLiveCandleService({ bridge, persistence: storeB });
    services.push(liveB);
    expect(liveB.listIntendedSubscriptions()).toHaveLength(0);

    const hydrated = await liveB.hydratePersistedIntended({ environment: "demo" });
    expect(hydrated.ok).toBe(true);
    expect(hydrated.loaded.map((r) => r.providerSymbol).sort()).toEqual(["EUR/USD", "XAU/USD"]);
    expect(liveB.listIntendedSubscriptions()).toHaveLength(2);

    const restored = await liveB.restoreIntendedSubscriptions();
    expect(restored.attempted).toBeGreaterThanOrEqual(1);
    expect(restored.restored.every((r) => r.ok)).toBe(true);
    // Seeded historical snapshot must not claim LIVE.
    expect(restored.restored.every((r) => r.streamState !== "LIVE")).toBe(true);
    expect(restored.placesOrders).toBe(false);
    expect(restored.acceptsForExecution).toBe(false);

    const diag = liveB.getLifecycleDiagnostics();
    expect(diag.persistence.enabled).toBe(true);
    expect(diag.persistence.lastHydrateLoaded).toBe(2);
    expect(diag.placesOrders).toBe(false);
  });

  it("skips FAKE/XYZ and environment-mismatched records on hydrate", async () => {
    const root = tempRoot();
    roots.push(root);
    const store = new ForexConnectIntendedSubscriptionsStore(root);
    await store.save("live", [
      { providerSymbol: "XAU/USD", timeframe: "1m", rememberedAtMs: Date.now() },
      { providerSymbol: "FAKE/XYZ", timeframe: "1m", rememberedAtMs: Date.now() },
    ]);

    const bridge = mockBridge();
    const live = new ForexConnectLiveCandleService({ bridge, persistence: store });
    services.push(live);

    const mismatch = await live.hydratePersistedIntended({ environment: "demo" });
    expect(mismatch.loaded).toHaveLength(0);
    expect(mismatch.skipped.some((s) => String(s.reason).includes("environment_mismatch"))).toBe(true);

    // Write raw file with duplicate + unknown symbol (save() would already dedupe).
    const now = Date.now();
    fs.writeFileSync(store.path, `${JSON.stringify({
      version: 1,
      schemaVersion: FOREXCONNECT_INTENDED_SCHEMA_VERSION,
      provider: "FOREXCONNECT",
      environment: "demo",
      updatedAtMs: now,
      subscriptions: [
        { providerSymbol: "XAU/USD", timeframe: "1m", rememberedAtMs: now },
        { providerSymbol: "FAKE/XYZ", timeframe: "1m", rememberedAtMs: now },
        { providerSymbol: "EUR/USD", timeframe: "1m", rememberedAtMs: now },
        { providerSymbol: "EUR/USD", timeframe: "1m", rememberedAtMs: now },
      ],
    }, null, 2)}\n`, "utf8");
    const hydrated = await live.hydratePersistedIntended({ environment: "demo" });
    expect(hydrated.loaded.map((r) => r.providerSymbol).sort()).toEqual(["EUR/USD", "XAU/USD"]);
    expect(hydrated.skipped.some((s) => s.reason === "not_in_provider_catalog")).toBe(true);
    expect(hydrated.skipped.some((s) => s.reason === "duplicate")).toBe(true);
  });

  it("empty or unavailable persistence fails safe without inventing LIVE", async () => {
    const root = tempRoot();
    roots.push(root);
    const store = new ForexConnectIntendedSubscriptionsStore(root);
    const bridge = mockBridge();
    const live = new ForexConnectLiveCandleService({ bridge, persistence: store });
    services.push(live);

    const hydrated = await live.hydratePersistedIntended({ environment: "demo" });
    expect(hydrated.ok).toBe(true);
    expect(hydrated.loaded).toHaveLength(0);

    const restored = await live.restoreIntendedSubscriptions();
    expect(restored.attempted).toBe(0);
    expect(restored.restored).toHaveLength(0);

    const disabled = new ForexConnectLiveCandleService({ bridge, persistence: null });
    services.push(disabled);
    const noStore = await disabled.hydratePersistedIntended();
    expect(noStore.skipped.some((s) => s.reason === "persistence_disabled")).toBe(true);
  });

  it("disconnect invalidates LIVE readiness and restore remains single-flight + bounded", async () => {
    const root = tempRoot();
    roots.push(root);
    const store = new ForexConnectIntendedSubscriptionsStore(root);
    const bridge = mockBridge();
    const live = new ForexConnectLiveCandleService({ bridge, persistence: store });
    services.push(live);

    await live.ensure("XAU/USD", "1m");
    await live.ensure("EUR/USD", "1m");
    live.markAllSessionsDisconnected("test disconnect");
    const diag = live.getLifecycleDiagnostics();
    expect(diag.lifecycleState).toBe("DISCONNECTED");
    expect(diag.intendedCount).toBe(2);

    const p1 = live.restoreIntendedSubscriptions();
    const p2 = live.restoreIntendedSubscriptions();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.attempted).toBe(r2.attempted);
    expect(r1.attempted).toBeLessThanOrEqual(FOREXCONNECT_RESTORE_MAX_ATTEMPTS);
    expect(live.getLifecycleDiagnostics().restoreInFlight).toBe(false);
  });

  it("schema file carries version and never stores quotes or secrets", async () => {
    const root = tempRoot();
    roots.push(root);
    const store = new ForexConnectIntendedSubscriptionsStore(root);
    await store.save("demo", [
      { providerSymbol: "XAU/USD", timeframe: "1m", rememberedAtMs: 123 },
    ]);
    const raw = JSON.parse(fs.readFileSync(store.path, "utf8")) as Record<string, unknown>;
    expect(raw.schemaVersion).toBe(FOREXCONNECT_INTENDED_SCHEMA_VERSION);
    expect(raw.provider).toBe("FOREXCONNECT");
    expect(raw.environment).toBe("demo");
    const text = JSON.stringify(raw);
    expect(text).not.toMatch(/password|token|secret|bid|ask/i);
    expect(Array.isArray(raw.subscriptions)).toBe(true);
  });

  it("execution allowlist and safety flags remain closed", () => {
    expect(isInstrumentAllowlisted("XAU/USD")).toBe(true);
    expect(isInstrumentAllowlisted("EUR/USD")).toBe(false);
    expect(isInstrumentAllowlisted("US30")).toBe(false);
    const bridge = mockBridge();
    const live = new ForexConnectLiveCandleService({ bridge, persistence: null });
    services.push(live);
    const diag = live.getLifecycleDiagnostics();
    expect(diag.placesOrders).toBe(false);
    expect(diag.acceptsForExecution).toBe(false);
    expect(diag.persistence.enabled).toBe(false);
  });
});
