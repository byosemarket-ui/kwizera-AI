/**
 * Phase 4.18D — Production deps for read-only canonical analysis (ForexConnect).
 * Never mutates broker state.
 */
import { getForexConnectBridge } from "../../../market-data/forexconnect/client.js";
import { getForexConnectLiveCandleService } from "../../../market-data/forexconnect/live-service.js";
import { resolveForexConnectLiveTimeframe } from "../../../market-data/forexconnect/timeframes.js";
import type { StrategyCandle } from "../auto-engine/strategy/rules.js";
import { evaluateLiveOfferQuoteFreshness } from "../quote-freshness.js";
import type { CanonicalAnalysisDeps } from "./canonical-analysis.service.js";
import type { CanonicalQuoteSnapshot, CanonicalTimeframeId } from "./canonical-analysis.types.js";
import { normalizeInstrumentId } from "./adapters.js";
import { getAtOpenAiAnalysisStore } from "./store.js";

function mapCandles(raw: unknown[]): StrategyCandle[] {
  return raw
    .map((row) => {
      const c = row as Record<string, unknown>;
      return {
        time: Number(c.time ?? c.timestamp ?? 0),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        closed: c.closed === false ? false : true,
      } satisfies StrategyCandle;
    })
    .filter(
      (c) =>
        Number.isFinite(c.time)
        && Number.isFinite(c.open)
        && Number.isFinite(c.high)
        && Number.isFinite(c.low)
        && Number.isFinite(c.close),
    );
}

export function createCanonicalAnalysisProductionDeps(): CanonicalAnalysisDeps {
  return {
    async loadCandles(instrument: string, timeframe: CanonicalTimeframeId) {
      const bridge = getForexConnectBridge();
      const hist = await bridge.getHistoricalCandles({
        symbol: instrument,
        timeframe: timeframe as never,
        limit: 120,
      });
      const raw = Array.isArray(hist?.candles) ? hist.candles : [];
      return mapCandles(raw as unknown[]);
    },

    async getQuoteSnapshot(instrument: string): Promise<CanonicalQuoteSnapshot> {
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      const instr = normalizeInstrumentId(instrument);
      try {
        const live = getForexConnectLiveCandleService();
        const tf = resolveForexConnectLiveTimeframe(undefined, "1m");
        await live.ensure(instr, tf);
        const latest = live.getLatestQuoteState(instr);
        if (!latest?.quote) {
          return {
            instrument: instr,
            bid: null,
            ask: null,
            quoteFresh: false,
            freshnessReasonCode: "NO_QUOTE_UPDATES",
            effectivePriceChangeAgeMs: null,
            snapshotFingerprint: null,
            evaluatedAtUtc: nowIso,
          };
        }
        const bid = latest.quote.bid;
        const ask = latest.quote.ask;
        const priceChangeAgeMs =
          latest.lastPriceChangeAtMs != null
            ? Math.max(0, nowMs - latest.lastPriceChangeAtMs)
            : null;
        const receiptAgeMs =
          latest.lastQuoteAtMs != null ? Math.max(0, nowMs - latest.lastQuoteAtMs) : null;
        const evalFresh = evaluateLiveOfferQuoteFreshness({
          bid,
          ask,
          streamState: latest.streamState ?? null,
          priceChangeAgeMs,
          receiptAgeMs,
          updateCount: latest.updateCount ?? 0,
          tradingStatus: latest.quote.tradingStatus ?? null,
          sourceTimestampMs: latest.quote.sourceTimestampMs ?? null,
          receivedAtMs: latest.quote.receivedAtMs ?? null,
          instrument: instr,
          nowMs,
        });
        return {
          instrument: instr,
          bid: typeof bid === "number" ? bid : null,
          ask: typeof ask === "number" ? ask : null,
          quoteFresh: evalFresh.fresh,
          freshnessReasonCode: evalFresh.reasonCode,
          effectivePriceChangeAgeMs: evalFresh.effectivePriceChangeAgeMs,
          snapshotFingerprint: evalFresh.snapshotFingerprint,
          evaluatedAtUtc: evalFresh.evaluatedAtUtc,
        };
      } catch {
        return {
          instrument: instr,
          bid: null,
          ask: null,
          quoteFresh: false,
          freshnessReasonCode: "QUOTE_UNAVAILABLE",
          effectivePriceChangeAgeMs: null,
          snapshotFingerprint: null,
          evaluatedAtUtc: nowIso,
        };
      }
    },

    async getPointSize(instrument: string): Promise<number | null> {
      try {
        const bridge = getForexConnectBridge();
        const listed = await bridge.listInstruments();
        if (!listed.ok || !Array.isArray(listed.instruments)) return null;
        const want = normalizeInstrumentId(instrument);
        for (const row of listed.instruments) {
          const r = row as Record<string, unknown>;
          const keys = [r.providerSymbol, r.displaySymbol, r.canonicalSymbol, r.symbol]
            .map((s) => String(s ?? "").replace(/\s+/g, "").toUpperCase());
          if (!keys.includes(want)) continue;
          const ps = Number(r.pointSize ?? r.PointSize);
          if (Number.isFinite(ps) && ps > 0) return ps;
        }
      } catch {
        /* ignore */
      }
      return null;
    },

    getLatestOpenAi(instrument: string) {
      const latest = getAtOpenAiAnalysisStore().latest();
      if (!latest) return null;
      if (normalizeInstrumentId(latest.instrument) !== normalizeInstrumentId(instrument)) {
        return null;
      }
      return latest;
    },
  };
}
