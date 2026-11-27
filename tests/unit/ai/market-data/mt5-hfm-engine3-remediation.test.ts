/**
 * STEP 1D.3 — Engine 3 final remediation tests (E3-R1..R4).
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  classifyBrokerUtcOffsetSample,
  deriveHfmBrokerUtcOffset,
  resetHfmTrustedBrokerUtcOffsetForTests,
} from "../../../../ai/market-data/mt5-hfm/quote-timestamp";
import {
  normalizeHfmCandleOpenTime,
  noteHfmCandleOffsetObservation,
  resetHfmCandleOffsetHistoryForTests,
  selectOffsetForBrokerCandle,
} from "../../../../ai/market-data/mt5-hfm/candle-timestamp";
import {
  getHfmOffsetArchiveCoverage,
  getHfmOffsetArchiveObservations,
  loadHfmOffsetArchive,
  lookupHfmOffsetArchiveForBrokerCandle,
  noteHfmOffsetArchiveObservation,
  persistHfmOffsetArchive,
  resetHfmOffsetArchiveForTests,
  setHfmOffsetArchivePathForTests,
  HFM_OFFSET_ARCHIVE_MAX_OBS,
} from "../../../../ai/market-data/mt5-hfm/offset-archive";
import {
  candleHasTrustedUtc,
  chartDomainsCompatible,
  chartSeriesTime,
  projectBarsToChartDomain,
  resolveHfmChartTimeDomain,
} from "../../../../desktop/forex/hfm-dashboard/charts/chart-time-domain";
import type { HfmChartCandle } from "../../../../desktop/forex/hfm-dashboard/charts/types";
import { readFileSync as readSrc } from "node:fs";
import { resolve } from "node:path";

let tmpDir: string;

beforeEach(async () => {
  resetHfmCandleOffsetHistoryForTests();
  resetHfmTrustedBrokerUtcOffsetForTests();
  resetHfmOffsetArchiveForTests();
  tmpDir = mkdtempSync(join(tmpdir(), "hfm-e3r-"));
  setHfmOffsetArchivePathForTests(join(tmpDir, "broker-utc-offset.json"));
  await loadHfmOffsetArchive();
});

afterEach(() => {
  resetHfmOffsetArchiveForTests();
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* */
  }
});

describe("E3-R4 quote offset 7199 vs 7200 sampling skew", () => {
  it("classifies 7199 as one-second skew around 7200", () => {
    const c = classifyBrokerUtcOffsetSample(7199);
    expect(c.samplingSkew).toBe(true);
    expect(c.trustedOffsetSec).toBe(7200);
    expect(c.measuredDeltaSec).toBe(7199);
    expect(c.residualSec).toBe(-1);
  });

  it("classifies 7201 as one-second skew around 7200", () => {
    const c = classifyBrokerUtcOffsetSample(7201);
    expect(c.samplingSkew).toBe(true);
    expect(c.trustedOffsetSec).toBe(7200);
  });

  it("does not snap a genuine non-aligned offset (e.g. 7300)", () => {
    const c = classifyBrokerUtcOffsetSample(7300);
    expect(c.samplingSkew).toBe(false);
    expect(c.trustedOffsetSec).toBeNull();
  });

  it("derive preserves measured 7199 and trusts 7200 as NORMALIZED", () => {
    const r = deriveHfmBrokerUtcOffset({
      brokerTime: 1_700_007_199,
      gmtTime: 1_700_000_000,
      marketSessionState: "MARKET_OPEN",
    });
    expect(r.measuredDeltaSec).toBe(7199);
    expect(r.brokerUtcOffsetSec).toBe(7200);
    expect(r.status).toBe("NORMALIZED");
    expect(r.reason).toBe("OFFSET_ONE_SECOND_CLOCK_SAMPLE_SKEW");
  });

  it("exact 7200 remains NORMALIZED with null reason", () => {
    const r = deriveHfmBrokerUtcOffset({
      brokerTime: 1_700_007_200,
      gmtTime: 1_700_000_000,
      marketSessionState: "MARKET_OPEN",
    });
    expect(r.measuredDeltaSec).toBe(7200);
    expect(r.brokerUtcOffsetSec).toBe(7200);
    expect(r.status).toBe("NORMALIZED");
    expect(r.reason).toBeNull();
  });

  it("candle and quote agree on trusted 7200 after 7199 sample", () => {
    const q = deriveHfmBrokerUtcOffset({
      brokerTime: 1_700_107_199,
      gmtTime: 1_700_100_000,
      marketSessionState: "MARKET_OPEN",
    });
    noteHfmCandleOffsetObservation({
      offsetSec: q.brokerUtcOffsetSec!,
      measuredDeltaSec: q.measuredDeltaSec,
      observedAtGmtSec: 1_700_100_000,
      observedAtBrokerSec: 1_700_107_199,
      status: q.status,
      reason: q.reason,
    });
    const c = normalizeHfmCandleOpenTime({
      brokerOpenTime: 1_700_100_000,
      preferLiveOffset: false,
    });
    expect(c.brokerUtcOffsetSec).toBe(7200);
    expect(c.openTimeUtc).toBe(1_700_100_000 - 7200);
    expect(c.timestampNormalizationStatus).toBe("NORMALIZED");
  });
});

describe("E3-R1 historical offset archive", () => {
  it("persists and reloads observations across restart", async () => {
    noteHfmOffsetArchiveObservation({
      offsetSec: 7200,
      measuredDeltaSec: 7200,
      observedAtGmtSec: 1_700_000_000,
      observedAtBrokerSec: 1_700_007_200,
      status: "NORMALIZED",
      brokerIdentity: "HFM",
      sessionContext: "MARKET_OPEN",
    });
    const persisted = await persistHfmOffsetArchive();
    expect(persisted.ok).toBe(true);
    expect(existsSync(persisted.path)).toBe(true);

    resetHfmOffsetArchiveForTests();
    setHfmOffsetArchivePathForTests(persisted.path);
    const loaded = await loadHfmOffsetArchive();
    expect(loaded.loaded).toBe(1);
    expect(getHfmOffsetArchiveObservations()[0]!.offsetSec).toBe(7200);
  });

  it("looks up historical offset within covering observation age", () => {
    noteHfmOffsetArchiveObservation({
      offsetSec: 7200,
      observedAtGmtSec: 1_700_092_800,
      observedAtBrokerSec: 1_700_100_000,
      status: "NORMALIZED",
    });
    const hit = lookupHfmOffsetArchiveForBrokerCandle(1_700_099_000);
    expect(hit?.offsetSec).toBe(7200);
    expect(hit?.reason).toMatch(/ARCHIVE/);
  });

  it("returns null for bars older than observation coverage", () => {
    noteHfmOffsetArchiveObservation({
      offsetSec: 7200,
      observedAtGmtSec: 1_700_092_800,
      observedAtBrokerSec: 1_700_100_000,
      status: "NORMALIZED",
    });
    // Far older than max age window.
    const miss = lookupHfmOffsetArchiveForBrokerCandle(1_600_000_000);
    expect(miss).toBeNull();
    const r = normalizeHfmCandleOpenTime({
      brokerOpenTime: 1_600_000_000,
      preferLiveOffset: false,
    });
    expect(r.openTimeUtc).toBeNull();
    expect(r.timestampNormalizationReason).toBe("HISTORICAL_OFFSET_UNAVAILABLE");
  });

  it("detects DST spring-forward conflict across eras", () => {
    // Winter UTC+2
    noteHfmOffsetArchiveObservation({
      offsetSec: 7200,
      observedAtGmtSec: 1_700_000_000,
      observedAtBrokerSec: 1_700_007_200,
      status: "NORMALIZED",
    });
    // Summer UTC+3 — both cover the transition candle window
    noteHfmOffsetArchiveObservation({
      offsetSec: 10800,
      observedAtGmtSec: 1_700_050_000,
      observedAtBrokerSec: 1_700_060_800,
      status: "NORMALIZED",
    });
    const candle = 1_700_000_000;
    expect(lookupHfmOffsetArchiveForBrokerCandle(candle)).toBeNull();
    const r = normalizeHfmCandleOpenTime({
      brokerOpenTime: candle,
      preferLiveOffset: false,
    });
    expect(r.openTimeUtc).toBeNull();
    expect(r.timestampNormalizationReason).toBe("OFFSET_TRANSITION_OR_DST_AMBIGUOUS");
  });

  it("handles fall-back ambiguity when conflicting offsets cover the same candle", () => {
    const candle = 1_730_000_000;
    noteHfmCandleOffsetObservation({
      offsetSec: 10800,
      observedAtGmtSec: candle + 1000,
      observedAtBrokerSec: candle + 11800,
      status: "NORMALIZED",
    });
    noteHfmCandleOffsetObservation({
      offsetSec: 7200,
      observedAtGmtSec: candle + 5000,
      observedAtBrokerSec: candle + 12200,
      status: "NORMALIZED",
    });
    expect(selectOffsetForBrokerCandle(candle)).toBeNull();
  });

  it("does not apply current offset blindly to old history without covering obs", () => {
    noteHfmCandleOffsetObservation({
      offsetSec: 7200,
      observedAtGmtSec: 1_800_000_000,
      observedAtBrokerSec: 1_800_007_200,
      status: "NORMALIZED",
    });
    const old = 1_700_000_000; // ~1157 days earlier — outside max age
    const r = normalizeHfmCandleOpenTime({
      brokerOpenTime: old,
      preferLiveOffset: true,
      brokerUtcOffsetSec: 7200,
      offsetStatus: "NORMALIZED",
      offsetTrust: "LIVE_OPEN_SESSION",
      offsetObservedAtBrokerSec: 1_800_007_200,
      offsetObservedAtGmtSec: 1_800_000_000,
    });
    expect(r.openTimeUtc).toBeNull();
  });

  it("survives corrupt archive by quarantining and returning empty", async () => {
    const path = join(tmpDir, "broker-utc-offset.json");
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(path, "{not-json", "utf8");
    resetHfmOffsetArchiveForTests();
    setHfmOffsetArchivePathForTests(path);
    const loaded = await loadHfmOffsetArchive();
    expect(loaded.corrupt).toBe(true);
    expect(loaded.loaded).toBe(0);
  });

  it("ignores duplicate same-second observations and bounds growth", async () => {
    for (let i = 0; i < 20; i++) {
      noteHfmOffsetArchiveObservation({
        offsetSec: 7200,
        observedAtGmtSec: 1_700_000_000 + i,
        observedAtBrokerSec: 1_700_007_200, // same broker second
        status: "NORMALIZED",
      });
    }
    expect(getHfmOffsetArchiveObservations().length).toBeLessThanOrEqual(2);
    // Distinct era changes still retained
    for (let i = 0; i < HFM_OFFSET_ARCHIVE_MAX_OBS + 50; i++) {
      noteHfmOffsetArchiveObservation({
        offsetSec: i % 2 === 0 ? 7200 : 10800,
        observedAtGmtSec: 1_710_000_000 + i * 7200,
        observedAtBrokerSec: 1_710_007_200 + i * 7200,
        status: "NORMALIZED",
      });
    }
    expect(getHfmOffsetArchiveObservations().length).toBeLessThanOrEqual(HFM_OFFSET_ARCHIVE_MAX_OBS);
    const cov = getHfmOffsetArchiveCoverage();
    expect(cov.distinctOffsets.length).toBeGreaterThanOrEqual(1);
  });

  it("archive-backed normalize works after in-process history cleared", async () => {
    noteHfmOffsetArchiveObservation({
      offsetSec: 7200,
      observedAtGmtSec: 1_700_092_800,
      observedAtBrokerSec: 1_700_100_000,
      status: "NORMALIZED",
    });
    await persistHfmOffsetArchive();
    resetHfmCandleOffsetHistoryForTests();
    // Keep archive memory (simulates process with archive loaded, empty live ring).
    const r = normalizeHfmCandleOpenTime({
      brokerOpenTime: 1_700_099_500,
      preferLiveOffset: false,
    });
    expect(r.openTimeUtc).toBe(1_700_099_500 - 7200);
    expect(r.timestampNormalizationReason).toMatch(/ARCHIVE|HISTORICAL/);
  });
});

describe("E3-R2 chart coordinate domain", () => {
  const bar = (
    partial: Partial<HfmChartCandle> & { time: number; open: number; high: number; low: number; close: number },
  ): HfmChartCandle => ({
    tickVolume: null,
    realVolume: null,
    spread: null,
    brokerOpenTime: partial.time,
    ...partial,
  });

  it("uses UTC domain when all candles have trusted UTC", () => {
    const bars = [
      bar({
        time: 100,
        open: 1,
        high: 2,
        low: 0.5,
        close: 1.5,
        openTimeUtc: 90,
        timestampNormalizationStatus: "NORMALIZED",
      }),
      bar({
        time: 200,
        open: 1,
        high: 2,
        low: 0.5,
        close: 1.5,
        openTimeUtc: 190,
        timestampNormalizationStatus: "PARTIAL",
      }),
    ];
    expect(resolveHfmChartTimeDomain(bars)).toBe("UTC");
    const proj = projectBarsToChartDomain(bars);
    expect(proj.domain).toBe("UTC");
    expect(proj.bars[0]!.time).toBe(90);
    expect(proj.bars[0]!.brokerOpenTime).toBe(100);
  });

  it("falls back to broker domain when any candle lacks trusted UTC", () => {
    const bars = [
      bar({
        time: 100,
        open: 1,
        high: 2,
        low: 0.5,
        close: 1.5,
        openTimeUtc: 90,
        timestampNormalizationStatus: "NORMALIZED",
      }),
      bar({
        time: 200,
        open: 1,
        high: 2,
        low: 0.5,
        close: 1.5,
        openTimeUtc: null,
        timestampNormalizationStatus: "UNAVAILABLE",
      }),
    ];
    expect(resolveHfmChartTimeDomain(bars)).toBe("BROKER");
    const proj = projectBarsToChartDomain(bars);
    expect(proj.domain).toBe("BROKER");
    expect(proj.bars.map((b) => b.time)).toEqual([100, 200]);
    expect(proj.bars.every((b) => candleHasTrustedUtc(b) || b.time === b.brokerOpenTime)).toBe(true);
  });

  it("never mixes domains within a projected series", () => {
    const bars = [
      bar({
        time: 1000,
        open: 1,
        high: 2,
        low: 0.5,
        close: 1,
        openTimeUtc: 900,
        timestampNormalizationStatus: "NORMALIZED",
      }),
      bar({
        time: 2000,
        open: 1,
        high: 2,
        low: 0.5,
        close: 1,
        openTimeUtc: null,
        timestampNormalizationStatus: "UNAVAILABLE",
      }),
    ];
    const { domain, bars: projected } = projectBarsToChartDomain(bars);
    expect(domain).toBe("BROKER");
    // All series times equal broker opens — no UTC sneak-in.
    for (const b of projected) {
      expect(b.time).toBe(b.brokerOpenTime);
      expect(chartSeriesTime(b, domain)).toBe(b.brokerOpenTime);
    }
  });

  it("rejects incompatible cross-chart domain sync", () => {
    expect(chartDomainsCompatible("UTC", "UTC")).toBe(true);
    expect(chartDomainsCompatible("UTC", "BROKER")).toBe(false);
  });

  it("ships axis domain label and formatter wiring", () => {
    const workspace = readSrc(
      resolve("desktop/forex/hfm-dashboard/charts/HfmChartsWorkspace.tsx"),
      "utf8",
    );
    expect(workspace).toContain("projectBarsToChartDomain");
    expect(workspace).toContain("Axis domain:");
    expect(workspace).toContain("timeDomain={chartProjection.domain}");
    const engine = readSrc(
      resolve("desktop/forex/hfm-dashboard/charts/HfmChartEngine.tsx"),
      "utf8",
    );
    expect(engine).toContain("tickMarkFormatter");
    expect(engine).toContain("chartTimeDomainLabel");
    expect(engine).toContain("timeDomain: props.timeDomain");
  });
});

describe("E3-R3 periodic dump clock metadata propagation", () => {
  it("agent persists and returns dump-associated brokerTime/gmtTime", () => {
    const src = readSrc(resolve("services/mt5-hfm-agent/mt5_control.py"), "utf8");
    expect(src).toContain("broker_time=dumped.get(\"brokerTime\")");
    expect(src).toContain("gmt_time=dumped.get(\"gmtTime\")");
    expect(src).toContain("clockSource");
    expect(src).toContain("prefer clocks bound to the dump/cache sequence");
    expect(src).toContain("\"brokerTime\": dump_broker");
    expect(src).toContain("\"gmtTime\": dump_gmt");
    // Must not blindly prefer unrelated live snapshot over dump clocks.
    expect(src).toContain("Do not substitute an unrelated later live snapshot clock");
    const api = readSrc(resolve("dev/server/mt5-hfm-api.ts"), "utf8");
    expect(api).toContain("brokerTime: hist.brokerTime");
    expect(api).toContain("gmtTime: hist.gmtTime");
    expect(api).toContain("clockSource: hist.clockSource");
    const hist = readSrc(resolve("ai/market-data/mt5-hfm/historical-engine.ts"), "utf8");
    expect(hist).toContain("clockSource");
    expect(hist).toContain("clockSeq");
  });

  it("cache meta retains brokerTime/gmtTime fields", () => {
    const src = readSrc(resolve("services/mt5-hfm-agent/mt5_control.py"), "utf8");
    expect(src).toContain("# E3-R3: dump-associated Expert clocks");
    expect(src).toMatch(/\"brokerTime\": data\.get\(\"brokerTime\"\)/);
    expect(src).toMatch(/\"gmtTime\": data\.get\(\"gmtTime\"\)/);
  });
});
