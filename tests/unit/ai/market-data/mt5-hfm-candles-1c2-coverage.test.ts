/**
 * STEP 1C.2 — C3 live forming + C4 periodic dump coverage for all twelve TFs.
 */
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  HfmLiveCandleEngine,
  HFM_VERIFIED_LIVE_TFS,
  isVerifiedLiveTimeframe,
  resolveFormingBucket,
  timeframeSeconds,
  resetHfmLiveCandleEngineForTests,
} from "../../../../ai/market-data/mt5-hfm/live-candle-engine";
import {
  HFM_CHART_VERIFIED_TFS,
} from "../../../../desktop/forex/hfm-dashboard/charts/types";
import {
  applyBidToFormingCandle,
  isLiveFormingTimeframe,
} from "../../../../desktop/forex/hfm-dashboard/charts/live-forming";
import { HFM_CANDLE_TFS } from "../../../../desktop/forex/hfm-dashboard/types";
import { validateAndNormalizeBars } from "../../../../ai/market-data/mt5-hfm/historical-engine";

const REQUIRED_TFS = [
  "M1",
  "M3",
  "M5",
  "M15",
  "M30",
  "H1",
  "H2",
  "H4",
  "H6",
  "H12",
  "D1",
  "W1",
] as const;

const root = process.cwd();
function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function tick(symbol: string, bid: number, timeSec: number, ask = bid + 0.0002) {
  return {
    symbol,
    bid,
    ask,
    last: null,
    timeSec,
    timeMsc: timeSec * 1000,
    receiveMs: timeSec * 1000 + 50,
    volume: null,
    flags: null,
    acquisition: "test" as const,
  };
}

function seedBar(time: number, open: number) {
  return {
    time,
    open,
    high: open,
    low: open,
    close: open,
    tickVolume: 1,
    realVolume: null,
    spread: null,
    validationStatus: "ok" as const,
    provenance: "native" as const,
  };
}

describe("1C.2 twelve-timeframe mapping coverage", () => {
  it("Node / chart / dashboard lists include all twelve required TFs", () => {
    expect([...HFM_VERIFIED_LIVE_TFS].sort()).toEqual([...REQUIRED_TFS].sort());
    expect([...HFM_CHART_VERIFIED_TFS].sort()).toEqual([...REQUIRED_TFS].sort());
    expect([...HFM_CANDLE_TFS].sort()).toEqual([...REQUIRED_TFS].sort());
    for (const tf of REQUIRED_TFS) {
      expect(isVerifiedLiveTimeframe(tf)).toBe(true);
      expect(isLiveFormingTimeframe(tf)).toBe(true);
      expect(timeframeSeconds(tf)).toBeGreaterThan(0);
    }
  });

  it("MQL periodic dump AppendCandles includes the five previously missing TFs", () => {
    const mq5 = read("services/mt5-hfm-agent/mql5/KwizeraReadonlySnapshot.mq5");
    for (const tf of ["M3", "H2", "H6", "H12", "W1"]) {
      expect(mq5).toContain(`PERIOD_${tf}, "${tf}"`);
    }
    expect(mq5).toContain("PERIOD_M1");
    expect(mq5).toContain("PERIOD_D1");
  });

  it("Python map_timeframe still recognizes all twelve keys", () => {
    const mcp = read("services/mt5-hfm-agent/mt5_mcp.py");
    for (const tf of REQUIRED_TFS) {
      expect(mcp).toContain(`"${tf}": "${tf}"`);
    }
  });
});

describe("1C.2 live forming for all twelve TFs", () => {
  beforeEach(() => {
    resetHfmLiveCandleEngineForTests();
  });

  it("initializes forming from CopyRates seed for every TF with closed:false", () => {
    const eng = new HfmLiveCandleEngine();
    const t0 = 1_740_000_000;
    for (const tf of HFM_VERIFIED_LIVE_TFS) {
      const f = eng.seedFromHistory("XAUUSD", tf, [seedBar(t0, 2000)]);
      expect(f).not.toBeNull();
      expect(f!.closed).toBe(false);
      expect(f!.time).toBe(t0);
      expect(f!.provider).toBe("HFM_MT5");
      expect(f!.receiveTimestamp).toBeTruthy();
    }
  });

  it("updates OHLC from bid ticks without changing open within the bucket", () => {
    for (const tf of HFM_VERIFIED_LIVE_TFS) {
      const eng = new HfmLiveCandleEngine();
      const t0 = 1_741_000_000;
      eng.seedFromHistory("EURUSD", tf, [seedBar(t0, 1.1)]);
      eng.applyTick(tick("EURUSD", 1.12, t0 + 5), tf);
      eng.applyTick(tick("EURUSD", 1.09, t0 + 10), tf);
      eng.applyTick(tick("EURUSD", 1.11, t0 + 15), tf);
      const f = eng.getForming("EURUSD", tf)!;
      expect(f.open).toBe(1.1);
      expect(f.high).toBe(1.12);
      expect(f.low).toBe(1.09);
      expect(f.close).toBe(1.11);
      expect(f.closed).toBe(false);
      // receiveTimestamp is wall/receipt domain — distinct from bar open.
      expect(f.receiveTimestamp).not.toBe(String(f.time));
    }
  });

  it("H2/H6/H12 finalize on broker-aligned period steps from CopyRates anchor", () => {
    for (const tf of ["H2", "H6", "H12"] as const) {
      const eng = new HfmLiveCandleEngine();
      // Anchor deliberately off a naive UTC epoch multiple.
      const anchor = 1_700_001_111;
      eng.seedFromHistory("GBPUSD", tf, [seedBar(anchor, 1.3)]);
      const sec = timeframeSeconds(tf)!;
      const events = eng.applyTick(tick("GBPUSD", 1.31, anchor + sec + 10), tf);
      expect(events.some((e) => e.type === "candle_finalized")).toBe(true);
      const next = eng.getForming("GBPUSD", tf)!;
      expect(next.time).toBe(anchor + sec);
      expect(next.open).toBe(1.31);
      expect(next.closed).toBe(false);
    }
  });

  it("W1 uses CopyRates week-open anchor and refuses forming without anchor", () => {
    expect(resolveFormingBucket(1_700_000_000, "W1", null)).toBeNull();
    expect(resolveFormingBucket(1_700_000_000, "W1", undefined)).toBeNull();

    const eng = new HfmLiveCandleEngine();
    // Without seed/anchor, W1 must not invent a calendar Monday bucket.
    expect(eng.applyTick(tick("USDJPY", 150, 1_700_000_000), "W1")).toEqual([]);

    const weekOpen = 1_795_305_600; // broker week open fixture
    eng.seedFromHistory("USDJPY", "W1", [seedBar(weekOpen, 150)]);
    eng.applyTick(tick("USDJPY", 150.5, weekOpen + 3600), "W1");
    expect(eng.getForming("USDJPY", "W1")?.time).toBe(weekOpen);
    expect(eng.getForming("USDJPY", "W1")?.close).toBe(150.5);

    const sec = timeframeSeconds("W1")!;
    const events = eng.applyTick(tick("USDJPY", 151, weekOpen + sec + 60), "W1");
    expect(events.some((e) => e.type === "candle_finalized")).toBe(true);
    expect(eng.getForming("USDJPY", "W1")?.time).toBe(weekOpen + sec);
  });

  it("M3 forming and boundary transition", () => {
    const eng = new HfmLiveCandleEngine();
    const t0 = 1_742_000_000;
    eng.seedFromHistory("XAUUSD", "M3", [seedBar(t0, 2600)]);
    eng.applyTick(tick("XAUUSD", 2601, t0 + 30), "M3");
    expect(eng.getForming("XAUUSD", "M3")?.high).toBe(2601);
    const sec = timeframeSeconds("M3")!;
    eng.applyTick(tick("XAUUSD", 2602, t0 + sec + 1), "M3");
    expect(eng.getForming("XAUUSD", "M3")?.time).toBe(t0 + sec);
    expect(eng.getForming("XAUUSD", "M3")?.open).toBe(2602);
  });

  it("reconcileWithHistory does not let older tip overwrite newer forming", () => {
    const eng = new HfmLiveCandleEngine();
    const t0 = 1_743_000_000;
    eng.seedFromHistory("EURUSD", "H2", [seedBar(t0, 1.1)]);
    eng.applyTick(tick("EURUSD", 1.15, t0 + 100), "H2");
    // Older history tip must not regress forming.
    eng.reconcileWithHistory("EURUSD", "H2", [seedBar(t0 - 7200, 1.05)]);
    expect(eng.getForming("EURUSD", "H2")?.time).toBe(t0);
    expect(eng.getForming("EURUSD", "H2")?.close).toBe(1.15);
  });

  it("applyTickVerifiedTimeframes covers all twelve without cross-symbol contamination", () => {
    const eng = new HfmLiveCandleEngine();
    const t0 = 1_744_000_000;
    for (const tf of HFM_VERIFIED_LIVE_TFS) {
      eng.seedFromHistory("XAUUSD", tf, [seedBar(t0, 1900)]);
      eng.seedFromHistory("EURUSD", tf, [seedBar(t0, 1.1)]);
    }
    eng.applyTickVerifiedTimeframes(tick("XAUUSD", 1905, t0 + 20));
    for (const tf of HFM_VERIFIED_LIVE_TFS) {
      expect(eng.getForming("XAUUSD", tf)?.close).toBe(1905);
      expect(eng.getForming("EURUSD", tf)?.close).toBe(1.1);
    }
  });

  it("duplicate ticks do not refresh forming; invalid ticks ignored", () => {
    const eng = new HfmLiveCandleEngine();
    const t0 = 1_745_000_000;
    eng.seedFromHistory("GBPUSD", "H6", [seedBar(t0, 1.25)]);
    const t = tick("GBPUSD", 1.26, t0 + 5);
    expect(eng.applyTick(t, "H6").length).toBeGreaterThan(0);
    const vol = eng.getForming("GBPUSD", "H6")!.tickVolume;
    expect(eng.applyTick(t, "H6")).toEqual([]);
    expect(eng.getForming("GBPUSD", "H6")!.tickVolume).toBe(vol);
  });

  it("frontend applyBid mirrors engine for new TFs including W1 with anchor", () => {
    const weekOpen = 1_795_305_600;
    let f = applyBidToFormingCandle(null, 100, weekOpen + 10, "W1", { anchorTime: weekOpen });
    f = applyBidToFormingCandle(f, 101, weekOpen + 20, "W1", { anchorTime: weekOpen });
    expect(f?.time).toBe(weekOpen);
    expect(f?.open).toBe(100);
    expect(f?.high).toBe(101);
    expect(f?.closed).toBe(false);
    expect(applyBidToFormingCandle(null, 100, weekOpen + 10, "W1")).toBeNull();
  });
});

describe("1C.2 historical validation + dump wiring", () => {
  it("does not invent synthetic bars when normalizing empty/invalid input", () => {
    const { bars, rejected } = validateAndNormalizeBars([
      { time: 1, open: 1, high: 0.5, low: 0.4, close: 0.9 },
      null,
      { time: 100, open: 1, high: 1.2, low: 0.9, close: 1.1, tickVolume: 3, spread: 2 },
    ]);
    expect(bars).toHaveLength(1);
    expect(bars[0]!.time).toBe(100);
    expect(rejected).toBeGreaterThanOrEqual(2);
  });

  it("hub still fans ticks through applyTickVerifiedTimeframes", () => {
    const hub = read("ai/market-data/mt5-hfm/realtime-hub.ts");
    expect(hub).toContain("applyTickVerifiedTimeframes");
  });

  it("regression: original seven live TFs remain verified", () => {
    for (const tf of ["M1", "M5", "M15", "M30", "H1", "H4", "D1"]) {
      expect(isVerifiedLiveTimeframe(tf)).toBe(true);
    }
  });
});
