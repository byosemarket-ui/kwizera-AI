/**
 * Production C7 report builder: periodic dump vs on-demand CopyRates.
 * Closed bars are the primary exact-consistency gate.
 */
import { readFile } from "node:fs/promises";
import { fetchHfmHistoricalCandles } from "./historical-engine.js";
import {
  type OhlcBar,
  reconcileSeries,
  summarizeReconciliation,
  type ReconciliationResult,
} from "./ohlc-reconciliation.js";

/** Prefer Agent cache under /run (readable by Core). Fall back to Expert dump paths. */
const DEFAULT_DUMP_CANDIDATES = [
  "/run/kwizera/mt5-hfm/candles-cache.json",
  "/home/mt5/.wine-hfm/drive_c/users/mt5/AppData/Roaming/MetaQuotes/Terminal/Common/Files/kwizera_readonly_candles.json",
  "/home/mt5/.wine-hfm/drive_c/Program Files/HFM Metatrader 5/MQL5/Files/kwizera_readonly_candles.json",
];

function asBars(raw: unknown): OhlcBar[] {
  if (!Array.isArray(raw)) return [];
  const out: OhlcBar[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const time = typeof r.time === "number" ? r.time : Number(r.time);
    const open = typeof r.open === "number" ? r.open : Number(r.open);
    const high = typeof r.high === "number" ? r.high : Number(r.high);
    const low = typeof r.low === "number" ? r.low : Number(r.low);
    const close = typeof r.close === "number" ? r.close : Number(r.close);
    if (![time, open, high, low, close].every((n) => Number.isFinite(n))) continue;
    out.push({
      time,
      open,
      high,
      low,
      close,
      closed: typeof r.closed === "boolean" ? r.closed : undefined,
    });
  }
  return out;
}

export async function buildHfmOhlcReconcileReport(input: {
  symbols: string[];
  timeframes: string[];
  dumpPath?: string;
  limit?: number;
}): Promise<{
  ok: boolean;
  observedAt: string;
  dumpPath: string;
  dumpSeq: unknown;
  dumpRetrievedAt: unknown;
  results: ReconciliationResult[];
  summary: ReturnType<typeof summarizeReconciliation>;
  note: string;
}> {
  const candidates = input.dumpPath
    ? [input.dumpPath]
    : process.env.KWIZERA_MT5_HFM_CANDLES_DUMP
      ? [process.env.KWIZERA_MT5_HFM_CANDLES_DUMP, ...DEFAULT_DUMP_CANDIDATES]
      : DEFAULT_DUMP_CANDIDATES;
  const observedAt = new Date().toISOString();
  let dumpRaw: Record<string, unknown> = {};
  let dumpPath = candidates[0]!;
  let readErr: string | null = null;
  const errors: string[] = [];
  let loaded = false;
  for (const candidate of candidates) {
    try {
      dumpRaw = JSON.parse(await readFile(candidate, "utf8")) as Record<string, unknown>;
      dumpPath = candidate;
      loaded = true;
      break;
    } catch (e) {
      errors.push(`${candidate}:${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (!loaded) {
    return {
      ok: false,
      observedAt,
      dumpPath,
      dumpSeq: null,
      dumpRetrievedAt: null,
      results: [],
      summary: { exactMatches: 0, expectedFormingEvolution: 0, mismatches: 0, other: 0, blocking: true },
      note: `dump_unreadable:${errors.join(" | ")}`,
    };
  }
  const candles = (dumpRaw.candles && typeof dumpRaw.candles === "object"
    ? dumpRaw.candles
    : {}) as Record<string, Record<string, unknown>>;
  const results: ReconciliationResult[] = [];
  const limit = input.limit ?? 8;

  for (const symbol of input.symbols) {
    for (const timeframe of input.timeframes) {
      const dumpBars = asBars(candles[symbol]?.[timeframe]);
      const hist = await fetchHfmHistoricalCandles({
        symbol,
        timeframe,
        limit,
        refresh: true,
      });
      const apiBars: OhlcBar[] = (hist.bars || []).map((b) => ({
        time: b.time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        closed: true, // CopyRates series: tip may still be forming — splitClosedAndForming uses tip convention
      }));
      // Mark tip as forming for both sides when lengths allow.
      if (dumpBars.length) dumpBars[dumpBars.length - 1] = { ...dumpBars[dumpBars.length - 1]!, closed: false };
      if (apiBars.length) apiBars[apiBars.length - 1] = { ...apiBars[apiBars.length - 1]!, closed: false };

      const apiObservedAt = new Date().toISOString();
      const series = reconcileSeries({
        symbol,
        timeframe,
        leftSource: "mql5_readonly_candles_dump",
        rightSource: hist.source || "mql5_ondemand_copyrates",
        leftObservedAt:
          typeof dumpRaw.dumpRetrievedAt === "string"
            ? dumpRaw.dumpRetrievedAt
            : typeof dumpRaw.retrievedAt === "string"
              ? dumpRaw.retrievedAt
              : typeof dumpRaw.cachedAt === "string"
                ? dumpRaw.cachedAt
                : observedAt,
        rightObservedAt: apiObservedAt,
        leftBars: dumpBars.slice(-limit),
        rightBars: apiBars.slice(-limit),
      });
      results.push(...series.closed);
      if (series.forming) results.push(series.forming);
    }
  }

  const summary = summarizeReconciliation(results);
  // Closed-bar mismatches are blocking; forming evolution / skew is not.
  const closedBlocking = results.some(
    (r) =>
      r.mode === "closed" &&
      (r.verdict === "GENUINE_OHLC_MISMATCH" || r.verdict === "INVALID_OHLC"),
  );
  const closedExact = results.filter((r) => r.mode === "closed" && r.verdict === "EXACT_MATCH").length;
  return {
    ok: !closedBlocking && closedExact > 0,
    observedAt,
    dumpPath,
    dumpSeq: dumpRaw.seq ?? null,
    dumpRetrievedAt: dumpRaw.dumpRetrievedAt ?? dumpRaw.retrievedAt ?? dumpRaw.cachedAt ?? null,
    results,
    summary,
    note:
      "Closed bars require EXACT_MATCH. Forming tips may be EXPECTED_FORMING_EVOLUTION when observation times differ.",
  };
}
