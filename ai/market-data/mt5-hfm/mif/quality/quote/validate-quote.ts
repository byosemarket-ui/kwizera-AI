/**
 * Phase 5B.2 Step 2 — Bid/Ask/spread integrity for MifCanonicalQuote.
 * Does not coerce null to zero. Does not repair crossed quotes.
 */
import type { MifCanonicalQuote } from "../../canonical/quote.js";
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import {
  MIF_QI_CROSSED_QUOTE,
  MIF_QI_INVALID_ASK,
  MIF_QI_INVALID_BID,
  MIF_QI_INVALID_SPREAD,
  MIF_QI_MISSING_ASK,
  MIF_QI_MISSING_BID,
  MIF_QI_PROVIDER_MISMATCH,
  MIF_QI_QUOTE_TIME_UNAVAILABLE,
  MIF_QI_SYMBOL_MISMATCH,
} from "../codes.js";
import type { MifQualityFinding } from "../types.js";

export interface QuoteBidAskResult {
  findings: MifQualityFinding[];
  bidOk: boolean;
  askOk: boolean;
  /** Computed only when both bid and ask are finite; never invented. */
  computedSpread: number | null;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function validateQuoteBidAsk(
  quote: MifCanonicalQuote,
  expectedSymbol?: string,
): QuoteBidAskResult {
  const findings: MifQualityFinding[] = [];

  if (quote.providerId !== MIF_PROVIDER_ID) {
    findings.push({
      code: MIF_QI_PROVIDER_MISMATCH,
      severity: "blocking",
      message: `providerId ${String(quote.providerId)} != HFM_MT5`,
    });
  }

  if (
    expectedSymbol &&
    quote.providerSymbol.toUpperCase() !== expectedSymbol.toUpperCase()
  ) {
    findings.push({
      code: MIF_QI_SYMBOL_MISMATCH,
      severity: "blocking",
      message: `quote symbol ${quote.providerSymbol} != ${expectedSymbol}`,
    });
  }

  let bidOk = true;
  let askOk = true;

  if (quote.bid == null) {
    bidOk = false;
    findings.push({
      code: MIF_QI_MISSING_BID,
      severity: "blocking",
      message: "bid is null",
      evidence: { field: "bid" },
    });
  } else if (!isFiniteNumber(quote.bid)) {
    bidOk = false;
    findings.push({
      code: MIF_QI_INVALID_BID,
      severity: "blocking",
      message: "bid is not finite",
      evidence: { field: "bid", value: String(quote.bid) },
    });
  }

  if (quote.ask == null) {
    askOk = false;
    findings.push({
      code: MIF_QI_MISSING_ASK,
      severity: "blocking",
      message: "ask is null",
      evidence: { field: "ask" },
    });
  } else if (!isFiniteNumber(quote.ask)) {
    askOk = false;
    findings.push({
      code: MIF_QI_INVALID_ASK,
      severity: "blocking",
      message: "ask is not finite",
      evidence: { field: "ask", value: String(quote.ask) },
    });
  }

  let computedSpread: number | null = null;
  if (bidOk && askOk && isFiniteNumber(quote.bid) && isFiniteNumber(quote.ask)) {
    if (quote.ask < quote.bid) {
      findings.push({
        code: MIF_QI_CROSSED_QUOTE,
        severity: "blocking",
        message: `ask ${quote.ask} < bid ${quote.bid}`,
        evidence: { bid: quote.bid, ask: quote.ask },
      });
    } else {
      computedSpread = quote.ask - quote.bid;
      if (computedSpread < 0 || !Number.isFinite(computedSpread)) {
        findings.push({
          code: MIF_QI_INVALID_SPREAD,
          severity: "blocking",
          message: "computed spread invalid",
          evidence: { spread: computedSpread },
        });
        computedSpread = null;
      } else if (
        quote.spread != null &&
        isFiniteNumber(quote.spread) &&
        Math.abs(quote.spread - computedSpread) > 1e-10
      ) {
        findings.push({
          code: MIF_QI_INVALID_SPREAD,
          severity: "blocking",
          message: `declared spread ${quote.spread} != ask-bid ${computedSpread}`,
          evidence: { declared: quote.spread, computed: computedSpread },
        });
      }
    }
  }

  if (
    (quote.quoteTimestampSec == null || !isFiniteNumber(quote.quoteTimestampSec) || quote.quoteTimestampSec <= 0) &&
    (quote.quoteTimestampMs == null || !isFiniteNumber(quote.quoteTimestampMs) || quote.quoteTimestampMs <= 0)
  ) {
    findings.push({
      code: MIF_QI_QUOTE_TIME_UNAVAILABLE,
      severity: "warning",
      message: "provider/broker quote timestamp unavailable",
    });
  }

  return { findings, bidOk, askOk, computedSpread };
}
