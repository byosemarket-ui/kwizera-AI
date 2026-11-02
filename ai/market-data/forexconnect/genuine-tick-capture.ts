/**
 * Phase 4.18F.2.2 — Capture genuine Offers bid/ask changes into the tick store
 * and expose movement windows. Read-only; placesOrders/mutatesBroker false.
 */

import { buildGenuineTickDedupeId, classifyOfferQuoteEvent } from "./genuine-tick-classify.js";
import {
  createGenuineTickStore,
  getGenuineTickStore,
  resetGenuineTickStoreForTests,
  type GenuineTickStore,
} from "./genuine-tick-store.js";
import {
  type GenuineTickEventClass,
  type GenuineTickRecord,
  type MovementWindowSummary,
  type TickCaptureCounters,
  type TickCaptureHealth,
  GENUINE_TICK_SCHEMA,
} from "./genuine-tick-types.js";
import { computeAllMovementWindows } from "./movement-windows.js";

export interface CaptureOfferQuoteInput {
  instrument: string;
  bid: number;
  ask: number;
  previousBid: number | null;
  previousAsk: number | null;
  eventSource?: string | null;
  /** Provider event time when known — kept distinct from receipt. */
  eventTimestampMs?: number | null;
  receiptTimestampMs: number;
  sessionConnected: boolean;
  nowMs?: number;
  persist?: boolean;
}

export interface CaptureOfferQuoteResult {
  eventClass: GenuineTickEventClass;
  accepted: boolean;
  duplicate: boolean;
  persisted: boolean;
  filtered: boolean;
  record: GenuineTickRecord | null;
  reason: string;
}

export class GenuineTickCaptureService {
  private store: GenuineTickStore;
  private loaded = false;

  constructor(options?: { store?: GenuineTickStore; storageRoot?: string }) {
    this.store = options?.store
      ?? (options?.storageRoot
        ? createGenuineTickStore({ storageRoot: options.storageRoot })
        : getGenuineTickStore());
  }

  ensureLoaded(): void {
    if (!this.loaded) {
      this.store.load();
      this.loaded = true;
    }
  }

  captureOfferQuote(input: CaptureOfferQuoteInput): CaptureOfferQuoteResult {
    this.ensureLoaded();
    const nowMs = input.nowMs ?? Date.now();
    try {
      this.store.markReceived();
      const receiptAgeMs = Math.max(0, nowMs - input.receiptTimestampMs);
      const classified = classifyOfferQuoteEvent({
        bid: input.bid,
        ask: input.ask,
        previousBid: input.previousBid,
        previousAsk: input.previousAsk,
        eventSource: input.eventSource,
        sessionConnected: input.sessionConnected,
        receiptAgeMs,
      });

      if (!classified.accepted) {
        this.store.markFiltered(classified.eventClass);
        return {
          eventClass: classified.eventClass,
          accepted: false,
          duplicate: false,
          persisted: false,
          filtered: true,
          record: null,
          reason: classified.reason,
        };
      }

      const eventClass = classified.eventClass as "BID_ASK_CHANGE" | "BID_CHANGE" | "ASK_CHANGE";
      const mid = classified.mid!;
      const spread = classified.spread!;
      const dedupeId = buildGenuineTickDedupeId({
        instrument: input.instrument,
        receiptTimestampMs: input.receiptTimestampMs,
        bid: input.bid,
        ask: input.ask,
        eventTimestampMs: input.eventTimestampMs ?? null,
      });

      const append = this.store.appendGenuineTick(
        {
          instrument: input.instrument,
          bid: input.bid,
          ask: input.ask,
          mid,
          spread,
          previousBid: input.previousBid as number,
          previousAsk: input.previousAsk as number,
          eventTimestampMs: input.eventTimestampMs ?? null,
          receiptTimestampMs: input.receiptTimestampMs,
          source: String(input.eventSource ?? "unknown"),
          eventClass,
          dedupeId,
          quality: "OK",
        },
        { nowMs, persist: input.persist },
      );

      return {
        eventClass,
        accepted: append.accepted,
        duplicate: append.duplicate,
        persisted: append.persisted,
        filtered: append.filtered,
        record: append.record,
        reason: append.reason,
      };
    } catch {
      this.store.markProcessingFailure();
      return {
        eventClass: "INVALID_QUOTE",
        accepted: false,
        duplicate: false,
        persisted: false,
        filtered: true,
        record: null,
        reason: "processing_failure",
      };
    }
  }

  getLatestTick(instrument: string): GenuineTickRecord | null {
    this.ensureLoaded();
    return this.store.getLatest(instrument);
  }

  getTicks(instrument: string): GenuineTickRecord[] {
    this.ensureLoaded();
    return this.store.getTicks(instrument);
  }

  getMovementWindows(instrument: string, options?: {
    asOfMs?: number;
    sessionConnected?: boolean;
  }): MovementWindowSummary[] {
    this.ensureLoaded();
    return computeAllMovementWindows({
      instrument: instrument.trim().toUpperCase(),
      ticks: this.store.getTicks(instrument),
      asOfMs: options?.asOfMs ?? Date.now(),
      sessionConnected: options?.sessionConnected,
    });
  }

  getCounters(): TickCaptureCounters {
    this.ensureLoaded();
    return this.store.getCounters();
  }

  getHealth(): TickCaptureHealth {
    this.ensureLoaded();
    const counters = this.store.getCounters();
    return {
      ok: counters.persistenceFailures === 0 || counters.accepted > 0,
      schemaVersion: GENUINE_TICK_SCHEMA,
      storePath: this.store.storePath,
      counters,
      instrumentCount: this.store.listInstruments().length,
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
    };
  }

  listInstruments(): string[] {
    this.ensureLoaded();
    return this.store.listInstruments();
  }

  getSnapshot(instrument: string, options?: { asOfMs?: number; sessionConnected?: boolean }) {
    this.ensureLoaded();
    const key = instrument.trim().toUpperCase();
    return {
      instrument: key,
      latest: this.store.getLatest(key),
      windows: this.getMovementWindows(key, options),
      health: this.getHealth(),
      placesOrders: false as const,
      acceptsForExecution: false as const,
      mutatesBroker: false as const,
    };
  }
}

let captureSingleton: GenuineTickCaptureService | null = null;

export function getGenuineTickCaptureService(): GenuineTickCaptureService {
  if (!captureSingleton) {
    captureSingleton = new GenuineTickCaptureService();
  }
  return captureSingleton;
}

export function resetGenuineTickCaptureServiceForTests(): void {
  captureSingleton = null;
  resetGenuineTickStoreForTests();
}

export function createGenuineTickCaptureService(options?: {
  storageRoot?: string;
  store?: GenuineTickStore;
}): GenuineTickCaptureService {
  return new GenuineTickCaptureService(options);
}
