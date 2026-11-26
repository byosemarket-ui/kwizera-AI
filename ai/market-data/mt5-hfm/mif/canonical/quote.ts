/**
 * Phase 5B.1 — Canonical quote mapping from HfmCanonicalQuote (additive).
 */
import type { HfmCanonicalQuote } from "../../quote-types.js";
import { buildMifInstrumentStub, type MifCanonicalInstrument } from "./instrument.js";
import {
  MIF_MARKET_DATA_CONTRACT_ID,
  MIF_MARKET_DATA_CONTRACT_VERSION,
  MIF_PROVIDER_ID,
  type MifAvailabilityStatus,
  type MifProviderId,
  type MifSafetyFlags,
  type MifSourceDialect,
  type MifTimebase,
  type MifValidationMeta,
} from "./types.js";

export interface MifCanonicalQuote extends MifSafetyFlags {
  contractId: typeof MIF_MARKET_DATA_CONTRACT_ID;
  contractVersion: typeof MIF_MARKET_DATA_CONTRACT_VERSION;
  providerId: MifProviderId;
  providerSymbol: string;
  bid: number | null;
  ask: number | null;
  last: number | null;
  spread: number | null;
  spreadPoints: number | null;
  brokerSpreadPoints: number | null;
  tickVolume: number | null;
  realVolume: number | null;
  quoteTimestampSec: number | null;
  quoteTimestampMs: number | null;
  receivedAt: string | null;
  availableAt: string | null;
  availabilityStatus: MifAvailabilityStatus;
  timebase: MifTimebase;
  timezoneOffsetSec: number | null;
  status: string | null;
  sourceDialect: MifSourceDialect;
  sourceProvenance: string;
  validation: MifValidationMeta;
  instrument: MifCanonicalInstrument | null;
  digits: number | null;
  point: number | null;
  tickSize: number | null;
}

export function mifQuoteFromHfmCanonical(
  quote: HfmCanonicalQuote,
  instrument?: MifCanonicalInstrument | null,
): MifCanonicalQuote {
  const receivedAt = typeof quote.receivedAt === "string" && quote.receivedAt.trim()
    ? quote.receivedAt
    : null;
  const inst = instrument ?? buildMifInstrumentStub({
    providerSymbol: quote.symbol,
  });
  if (instrument == null) {
    inst.digits = quote.digits;
    inst.point = quote.point;
    inst.tickSize = quote.tickSize;
  }
  return {
    contractId: MIF_MARKET_DATA_CONTRACT_ID,
    contractVersion: MIF_MARKET_DATA_CONTRACT_VERSION,
    providerId: MIF_PROVIDER_ID,
    providerSymbol: String(quote.symbol || "").toUpperCase(),
    bid: quote.bid,
    ask: quote.ask,
    last: quote.last,
    spread: quote.spread,
    spreadPoints: quote.spreadPoints,
    brokerSpreadPoints: quote.brokerSpreadPoints,
    tickVolume: quote.tickVolume,
    realVolume: quote.realVolume,
    quoteTimestampSec: quote.quoteTimestamp,
    quoteTimestampMs: quote.quoteTimestampMs,
    receivedAt,
    availableAt: receivedAt,
    availabilityStatus: receivedAt ? "KNOWN" : "UNKNOWN",
    // B1: quoteTimestampSec remains broker-domain; expose derived offset for MIF freshness.
    timebase: "BROKER_SERVER",
    timezoneOffsetSec: quote.brokerUtcOffsetSec,
    status: quote.status,
    sourceDialect: "hfm.canonical-quote",
    sourceProvenance: quote.source,
    validation: {
      status: quote.validation.verdict === "ok"
        ? "ok"
        : quote.validation.verdict === "rejected"
          ? "rejected"
          : quote.validation.verdict === "partial"
            ? "partial"
            : "unknown",
      errors: [...quote.validation.errors],
      warnings: [...quote.validation.warnings],
    },
    instrument: inst,
    digits: quote.digits,
    point: quote.point,
    tickSize: quote.tickSize,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}
