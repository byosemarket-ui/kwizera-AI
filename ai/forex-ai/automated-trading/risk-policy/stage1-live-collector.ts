/**
 * Stage 1 — LIVE FC DEMO spread collection tick (read-only Offers).
 * Ensures Offers subscriptions, polls quotes, ingests independent LIVE samples.
 * Never places orders. Never invents observations. Never auto-approves.
 *
 * ForexConnect client/live-service are loaded lazily to keep unit tests free of FC side effects.
 */
import { MAX_LIVE_OBSERVATION_AGE_MS } from "./observation-evidence.js";
import {
  ingestSpreadObservation,
  type LiveSpreadObservationRecord,
} from "./spread-observation-collector.js";
import { getStage1EvidenceStore, type Stage1EvidenceStore } from "./stage1-evidence-store.js";
import { STAGE3_TRACKED_INSTRUMENTS, type Stage3TrackedInstrument } from "./types.js";
import { normalizeInstrumentSymbol } from "./validate.js";

export interface Stage1InstrumentTickResult {
  instrument: Stage3TrackedInstrument;
  subscribed: boolean;
  subscribeCode: string | null;
  quotePresent: boolean;
  bid: number | null;
  ask: number | null;
  tradingStatus: string | null;
  quoteAgeMs: number | null;
  ingestStatus: string;
  ingestCode: string;
  message: string;
  accepted: boolean;
  validLiveCount: number;
}

export interface Stage1CollectTickReport {
  schema: "kwizera.at-stage1-spread-collect-tick.v1";
  startedAtUtc: string;
  finishedAtUtc: string;
  marketOpenHeuristic: boolean | null;
  instruments: Stage1InstrumentTickResult[];
  acceptedThisTick: number;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  brokerExecution: "DISABLED";
  note: string;
}

function normSym(s: string | null | undefined): string {
  return String(s || "").replace(/\s+/g, "").toUpperCase().replace(/\//g, "");
}

function matchQuote(
  quotes: Array<Record<string, unknown>>,
  instrument: Stage3TrackedInstrument,
): Record<string, unknown> | null {
  const want = normSym(instrument);
  for (const q of quotes) {
    const sym = String(
      q.providerSymbol ?? q.displaySymbol ?? q.canonicalSymbol ?? q.symbol ?? "",
    );
    if (normSym(sym) === want) return q;
  }
  return null;
}

function quoteTimestampMs(q: Record<string, unknown>, nowMs: number): number {
  const src = q.sourceTimestampMs;
  const recv = q.receivedAtMs;
  if (typeof src === "number" && Number.isFinite(src) && src > 0) return src;
  if (typeof recv === "number" && Number.isFinite(recv) && recv > 0) return recv;
  return nowMs;
}

/**
 * One collection pass across the four tracked instruments.
 * Subscribes Offers (market-data only) when missing — never submits orders.
 */
export async function collectStage1SpreadTick(input?: {
  store?: Stage1EvidenceStore;
  nowMs?: number;
  /** When false, skip live.ensure (caller already subscribed). */
  ensureSubscriptions?: boolean;
}): Promise<Stage1CollectTickReport> {
  const startedAtUtc = new Date().toISOString();
  const nowMs = input?.nowMs ?? Date.now();
  const store = input?.store ?? getStage1EvidenceStore();
  const ensure = input?.ensureSubscriptions !== false;

  const { getForexConnectLiveCandleService } = await import(
    "../../../market-data/forexconnect/live-service.js"
  );
  const { getForexConnectBridge } = await import("../../../market-data/forexconnect/client.js");
  const live = getForexConnectLiveCandleService();
  const bridge = getForexConnectBridge();

  const subscribeCodes: Partial<Record<Stage3TrackedInstrument, string | null>> = {};
  if (ensure) {
    for (const instrument of STAGE3_TRACKED_INSTRUMENTS) {
      try {
        await live.ensure(instrument, "1m");
        subscribeCodes[instrument] = "ENSURE_OK";
      } catch (err) {
        subscribeCodes[instrument] = err instanceof Error ? err.message.slice(0, 160) : "ENSURE_FAILED";
      }
    }
  }

  let quotes: Array<Record<string, unknown>> = [];
  try {
    const polled = await bridge.pollQuotes();
    quotes = Array.isArray(polled) ? (polled as Array<Record<string, unknown>>) : [];
  } catch {
    quotes = [];
  }

  const instruments: Stage1InstrumentTickResult[] = [];
  let acceptedThisTick = 0;

  for (const instrument of STAGE3_TRACKED_INSTRUMENTS) {
    const prior = store.getAccepted(instrument);
    const q = matchQuote(quotes, instrument);
    if (!q) {
      store.recordRejection({
        instrument,
        code: "QUOTE_NOT_PRESENT",
        message: "No Offers quote for instrument in pollQuotes (subscription/live feed gap).",
        bid: null,
        ask: null,
        observedAtUtc: null,
      });
      instruments.push({
        instrument,
        subscribed: subscribeCodes[instrument] === "ENSURE_OK",
        subscribeCode: subscribeCodes[instrument] ?? null,
        quotePresent: false,
        bid: null,
        ask: null,
        tradingStatus: null,
        quoteAgeMs: null,
        ingestStatus: "REJECTED",
        ingestCode: "QUOTE_NOT_PRESENT",
        message: "No live quote present for instrument.",
        accepted: false,
        validLiveCount: prior.length,
      });
      continue;
    }

    const bid = typeof q.bid === "number" ? q.bid : null;
    const ask = typeof q.ask === "number" ? q.ask : null;
    const tradingStatus = q.tradingStatus != null ? String(q.tradingStatus) : null;
    const tsMs = quoteTimestampMs(q, nowMs);
    const ageMs = Math.max(0, nowMs - tsMs);
    const observedAtUtc = new Date(tsMs).toISOString();

    let marketStatus: "OPEN" | "CLOSED" | "UNKNOWN" = "UNKNOWN";
    if (tradingStatus === "C" || tradingStatus === "N") marketStatus = "CLOSED";
    else if (tradingStatus === "O" || tradingStatus === "T") marketStatus = "OPEN";

    let freshnessStatus: "FRESH" | "STALE" | "UNKNOWN" = "UNKNOWN";
    if (ageMs > MAX_LIVE_OBSERVATION_AGE_MS) freshnessStatus = "STALE";
    else if (Number.isFinite(ageMs)) freshnessStatus = "FRESH";

    const ingest = ingestSpreadObservation({
      instrument,
      bid,
      ask,
      observedAtUtc,
      provider: String(q.provider || "FOREXCONNECT"),
      sourceType: String(q.eventSource || "Offers"),
      marketStatus,
      freshnessStatus,
      provenance: "LIVE",
      priorAccepted: prior,
      nowMs,
    });

    if (ingest.status === "ACCEPTED_LIVE" && ingest.record) {
      store.recordAccepted(ingest.record);
      acceptedThisTick += 1;
    } else {
      store.recordRejection({
        instrument,
        code: ingest.code,
        message: ingest.message,
        bid,
        ask,
        observedAtUtc,
      });
    }

    const after = store.getAccepted(instrument);
    instruments.push({
      instrument,
      subscribed: subscribeCodes[instrument] === "ENSURE_OK" || q != null,
      subscribeCode: subscribeCodes[instrument] ?? null,
      quotePresent: true,
      bid,
      ask,
      tradingStatus,
      quoteAgeMs: ageMs,
      ingestStatus: ingest.status,
      ingestCode: ingest.code,
      message: ingest.message,
      accepted: ingest.status === "ACCEPTED_LIVE",
      validLiveCount: after.length,
    });
  }

  return {
    schema: "kwizera.at-stage1-spread-collect-tick.v1",
    startedAtUtc,
    finishedAtUtc: new Date().toISOString(),
    marketOpenHeuristic: instruments.some((i) => i.tradingStatus === "O") ? true : null,
    instruments,
    acceptedThisTick,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    brokerExecution: "DISABLED",
    note:
      "One read-only Offers poll. Independent LIVE samples require ≥5s gap and changing bid/ask. "
      + "Does not approve policies or submit orders.",
  };
}

export function acceptedCountsFromStore(store: Stage1EvidenceStore): Record<Stage3TrackedInstrument, number> {
  const out = {} as Record<Stage3TrackedInstrument, number>;
  for (const inst of STAGE3_TRACKED_INSTRUMENTS) {
    out[inst] = store.getAccepted(inst).length;
  }
  return out;
}

export function normalizeTrackedInstrument(raw: string): Stage3TrackedInstrument | null {
  const n = normalizeInstrumentSymbol(raw);
  if (n && (STAGE3_TRACKED_INSTRUMENTS as readonly string[]).includes(n)) {
    return n as Stage3TrackedInstrument;
  }
  return null;
}

export type { LiveSpreadObservationRecord };
