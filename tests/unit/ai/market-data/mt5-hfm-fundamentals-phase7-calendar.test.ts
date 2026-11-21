import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  HFM_ECONOMIC_CALENDAR_ENABLED_ENV,
  HFM_ECONOMIC_CALENDAR_LICENSING_ENV,
  __resetFundamentalsRefreshForTests,
  __resetHfmFundamentalsStorageForTests,
  buildEventImpactSummary,
  buildHfmFundamentalsPackageForSnapshot,
  buildFundamentalsStatusPublic,
  buildPublicCalendarQuery,
  computeSurpriseNote,
  currenciesInSymbol,
  economicCalendarGateAvailability,
  eventRelevantToSymbol,
  fetchShowMyTradesCalendar,
  getBackgroundRefreshEnabled,
  isEconomicCalendarLiveAllowed,
  normalizeSmtCalendarPayload,
  normalizeSmtEvent,
  refreshHfmEconomicCalendar,
  summarizeFundamentalsForUnifiedInput,
} from "../../../../ai/market-data/mt5-hfm/fundamentals/index.js";
import { getMifOdWorkerStatus } from "../../../../ai/market-data/mt5-hfm/mif/index.js";
import { OPENAI_AI_MAX_CONCURRENT } from "../../../../ai/forex-ai/snapshot-openai/concurrency.js";
import { buildHfmUnifiedAiAnalysisInput } from "../../../../ai/market-data/mt5-hfm/analysis/reasoning/unified-input.js";

function sampleSmtEvent(over: Record<string, unknown> = {}) {
  return {
    ts: 1795773600,
    time: "2026-12-10T13:30:00Z",
    currency: "USD",
    impact: "high",
    title: "Consumer Price Index MoM",
    forecast: "0.3%",
    previous: "0.4%",
    actual: "",
    id: "usd-cpi-mom.20261210T1330",
    status: "scheduled",
    moved_from: "",
    period: "2026-11",
    confidence: "sources_agree",
    ...over,
  };
}

describe("Phase 7 — licensing / feature gates", () => {
  const prevLic = process.env[HFM_ECONOMIC_CALENDAR_LICENSING_ENV];
  const prevEn = process.env[HFM_ECONOMIC_CALENDAR_ENABLED_ENV];

  afterEach(() => {
    if (prevLic === undefined) delete process.env[HFM_ECONOMIC_CALENDAR_LICENSING_ENV];
    else process.env[HFM_ECONOMIC_CALENDAR_LICENSING_ENV] = prevLic;
    if (prevEn === undefined) delete process.env[HFM_ECONOMIC_CALENDAR_ENABLED_ENV];
    else process.env[HFM_ECONOMIC_CALENDAR_ENABLED_ENV] = prevEn;
  });

  it("defaults to licensing blocked / live disallowed", () => {
    delete process.env[HFM_ECONOMIC_CALENDAR_LICENSING_ENV];
    delete process.env[HFM_ECONOMIC_CALENDAR_ENABLED_ENV];
    expect(economicCalendarGateAvailability()).toBe("LICENSING_BLOCKED");
    expect(isEconomicCalendarLiveAllowed()).toBe(false);
    expect(getBackgroundRefreshEnabled()).toBe(false);
  });

  it("requires both env flags exactly 1", () => {
    process.env[HFM_ECONOMIC_CALENDAR_LICENSING_ENV] = "1";
    process.env[HFM_ECONOMIC_CALENDAR_ENABLED_ENV] = "true";
    expect(isEconomicCalendarLiveAllowed()).toBe(false);
    process.env[HFM_ECONOMIC_CALENDAR_ENABLED_ENV] = "1";
    expect(isEconomicCalendarLiveAllowed()).toBe(true);
    expect(economicCalendarGateAvailability()).toBe("OK");
  });
});

describe("Phase 7 — SMT normalize + impact", () => {
  it("preserves forecast/previous/actual as strings and never invents actual", () => {
    const e = normalizeSmtEvent(sampleSmtEvent(), "2026-11-21T22:00:00Z");
    expect(e).not.toBeNull();
    expect(e!.forecast).toBe("0.3%");
    expect(e!.previous).toBe("0.4%");
    expect(e!.actual).toBe("");
    expect(e!.eventId).toBe("smt:usd-cpi-mom.20261210T1330");
    expect(e!.analyticalOnly).toBe(true);
  });

  it("marks single_source as not official", () => {
    const e = normalizeSmtEvent(
      sampleSmtEvent({ confidence: "single_source" }),
      "2026-11-21T22:00:00Z",
    );
    expect(e!.confidence).toBe("single_source");
    expect(e!.qualityWarnings).toContain("CONFIDENCE_SINGLE_SOURCE_NOT_OFFICIAL");
  });

  it("maps currency relevance without direction signal", () => {
    expect(currenciesInSymbol("EURUSD")).toEqual(["EUR", "USD"]);
    const e = normalizeSmtEvent(sampleSmtEvent(), "2026-11-21T22:00:00Z")!;
    expect(eventRelevantToSymbol(e, "EURUSD")).toBe(true);
    expect(eventRelevantToSymbol(e, "EURGBP")).toBe(false);
    const impact = buildEventImpactSummary(e);
    expect(impact.directionalImplication).toBe("UNSPECIFIED");
    expect(impact.surpriseComparable).toBe(false);
  });

  it("surprise only when both forecast and actual present", () => {
    expect(computeSurpriseNote("0.3%", "").comparable).toBe(false);
    expect(computeSurpriseNote("0.3%", "0.4%").comparable).toBe(true);
  });

  it("normalizes calendar payload and drops malformed rows", () => {
    const out = normalizeSmtCalendarPayload(
      {
        server_time: 1,
        count: 2,
        events: [sampleSmtEvent(), { title: "bad" }],
        attribution: {
          required: false,
          text: "Economic calendar by ShowMyTrades",
          url: "https://showmytrades.com/tools/economic-calendar",
        },
      },
      "2026-11-21T22:00:00Z",
    );
    expect(out.events).toHaveLength(1);
    expect(out.dropped).toBe(1);
    expect(out.attribution.required).toBe(false);
  });
});

describe("Phase 7 — SMT client behaviors", () => {
  it("handles 304 as success notModified", async () => {
    const fetchImpl = async () =>
      new Response(null, {
        status: 304,
        headers: { etag: '"abc"', "x-server-time": "123" },
      });
    const r = await fetchShowMyTradesCalendar({
      days: 1,
      etag: '"abc"',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.ok).toBe(true);
    expect(r.notModified).toBe(true);
    expect(r.status).toBe(304);
  });

  it("handles 429 rate limit", async () => {
    const fetchImpl = async () =>
      new Response("", { status: 429, headers: { "retry-after": "10" } });
    const r = await fetchShowMyTradesCalendar({
      days: 1,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe("RATE_LIMITED");
    expect(r.retryAfterSec).toBe(10);
  });

  it("handles invalid JSON", async () => {
    const fetchImpl = async () =>
      new Response("not-json", { status: 200, headers: { "content-type": "application/json" } });
    const r = await fetchShowMyTradesCalendar({
      days: 1,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe("INVALID_JSON");
  });
});

describe("Phase 7 — storage join + refresh gate", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "hfm-fund-"));
    process.env.KWIZERA_STORAGE_ROOT = tmp;
    __resetHfmFundamentalsStorageForTests();
    __resetFundamentalsRefreshForTests();
    delete process.env[HFM_ECONOMIC_CALENDAR_LICENSING_ENV];
    delete process.env[HFM_ECONOMIC_CALENDAR_ENABLED_ENV];
  });

  afterEach(async () => {
    __resetHfmFundamentalsStorageForTests();
    __resetFundamentalsRefreshForTests();
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined);
  });

  it("snapshot package is licensing-blocked by default without HTTP", async () => {
    const pkg = await buildHfmFundamentalsPackageForSnapshot({
      snapshotId: "snap-1",
      symbol: "EURUSD",
    });
    expect(pkg.availability).toBe("LICENSING_BLOCKED");
    expect(pkg.rankingUnaffected).toBe(true);
    expect(pkg.events).toHaveLength(0);
    const status = buildFundamentalsStatusPublic();
    expect(status.liveAllowed).toBe(false);
    expect(status.backgroundRefreshEnabled).toBe(false);
  });

  it("refresh refuses when licensing blocked", async () => {
    const r = await refreshHfmEconomicCalendar({
      fetchImpl: (async () => {
        throw new Error("should not fetch");
      }) as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("LICENSING_BLOCKED");
    expect(r.backgroundRefreshEnabled).toBe(false);
  });

  it("public calendar query returns gate status without inventing events", async () => {
    const q = await buildPublicCalendarQuery({ limit: 10 });
    expect(q.availability).toBe("LICENSING_BLOCKED");
    expect(q.events).toEqual([]);
  });

  it("unified input includes fundamentalPackage without changing ranking fields", () => {
    const ctx = {
      snapshot: {
        snapshotId: "s1",
        snapshotHash: "h1",
        symbol: "EURUSD",
        provider: "HFM_MT5",
        capturedAt: "2026-11-21T22:00:00Z",
        chartTimeframeAtStart: "H1",
        quote: null,
        dataQuality: { warnings: [] },
        synchronization: {},
        timeframes: {},
      },
    } as any;
    const built = buildHfmUnifiedAiAnalysisInput({
      analysisId: "a1",
      context: ctx,
      imageRefs: [],
      orchestration: null,
      scenarioPackage: null,
      fundamentalPackage: {
        availability: "LICENSING_BLOCKED",
        rankingUnaffected: true,
        informationalOnly: true,
        events: [],
      },
    });
    const pkg = built.packageObject as Record<string, unknown>;
    expect(pkg.fundamentalPackage).toBeTruthy();
    expect((pkg.knownLimitations as string[]).some((x) => /ranking/i.test(x))).toBe(true);
    const summary = summarizeFundamentalsForUnifiedInput({
      contractId: "kwizera.hfm.fundamentals-package.v1",
      contractVersion: "1.0.0",
      packageId: "p",
      snapshotId: "s1",
      symbol: "EURUSD",
      asOfUtc: "2026-11-21T22:00:00Z",
      availability: "EMPTY",
      freshness: "FRESH",
      completeness: "EMPTY",
      providerId: "SHOWMYTRADES",
      eventIds: [],
      events: [],
      impacts: [],
      attribution: null,
      qualityWarnings: [],
      rankingUnaffected: true,
      informationalOnly: true,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    } as any);
    expect(summary.rankingUnaffected).toBe(true);
  });
});

describe("Phase 7 — safety constants", () => {
  it("keeps OD disabled and OpenAI concurrency 1", () => {
    expect(getMifOdWorkerStatus().enabled).toBe(false);
    expect(OPENAI_AI_MAX_CONCURRENT).toBe(1);
    expect(getBackgroundRefreshEnabled()).toBe(false);
  });
});
