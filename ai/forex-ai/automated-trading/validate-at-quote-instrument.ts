/**
 * Phase 59.0.3 — Validate AT-configured instruments before Offers intended / subscribeQuotes.
 * Fail closed: missing, invalid, disallowed, unknown-to-catalog, or unavailable catalog.
 * Never invents symbols. Does not enable trading.
 */
import { findInstrument } from "./verification-engine.js";
import { isInstrumentAllowlisted } from "./simulation-risk/allowlist.js";
import type { ForexConnectInstrument } from "../../market-data/forexconnect/types.js";

export type AtQuoteInstrumentValidationCode =
  | "OK"
  | "INSTRUMENT_MISSING"
  | "INSTRUMENT_INVALID_ID"
  | "INSTRUMENT_NOT_PERMITTED"
  | "INSTRUMENT_NOT_IN_CATALOG"
  | "CATALOG_UNAVAILABLE";

export interface AtQuoteInstrumentValidationOk {
  ok: true;
  code: "OK";
  providerSymbol: string;
  canonicalSymbol: string;
  placesOrders: false;
  acceptsForExecution: false;
}

export interface AtQuoteInstrumentValidationReject {
  ok: false;
  code: Exclude<AtQuoteInstrumentValidationCode, "OK">;
  message: string;
  symbol: string;
  placesOrders: false;
  acceptsForExecution: false;
}

export type AtQuoteInstrumentValidationResult =
  | AtQuoteInstrumentValidationOk
  | AtQuoteInstrumentValidationReject;

function isSafeProviderSymbol(symbol: string): boolean {
  const s = symbol.trim();
  if (!s || s.length > 64) return false;
  if (/[\\\0\n\r\t]/.test(s)) return false;
  if (s.includes("..")) return false;
  if (!/^[A-Za-z0-9./_\-]+$/.test(s)) return false;
  return true;
}

/**
 * Validate a single AT instrument for ForexConnect Offers subscribe.
 * Requires both the AT allowlist and a successful provider catalog match.
 */
export function validateAtQuoteInstrumentForSubscribe(input: {
  symbol: string | null | undefined;
  catalogOk: boolean | null | undefined;
  instruments: ReadonlyArray<ForexConnectInstrument> | null | undefined;
}): AtQuoteInstrumentValidationResult {
  const base = { placesOrders: false as const, acceptsForExecution: false as const };
  const raw = String(input.symbol ?? "").trim();
  if (!raw) {
    return {
      ...base,
      ok: false,
      code: "INSTRUMENT_MISSING",
      message: "Instrument symbol is missing.",
      symbol: "",
    };
  }
  if (!isSafeProviderSymbol(raw)) {
    return {
      ...base,
      ok: false,
      code: "INSTRUMENT_INVALID_ID",
      message: `Instrument "${raw.slice(0, 64)}" failed identifier validation.`,
      symbol: raw,
    };
  }
  if (!isInstrumentAllowlisted(raw)) {
    return {
      ...base,
      ok: false,
      code: "INSTRUMENT_NOT_PERMITTED",
      message: `Instrument "${raw}" is not on the Automated Trading allowlist.`,
      symbol: raw,
    };
  }
  if (input.catalogOk !== true || !Array.isArray(input.instruments)) {
    return {
      ...base,
      ok: false,
      code: "CATALOG_UNAVAILABLE",
      message: "ForexConnect instrument catalog unavailable — refuse subscribe.",
      symbol: raw,
    };
  }
  const hit = findInstrument(input.instruments as ForexConnectInstrument[], raw);
  if (!hit) {
    return {
      ...base,
      ok: false,
      code: "INSTRUMENT_NOT_IN_CATALOG",
      message: `Instrument "${raw}" is not in the ForexConnect catalog.`,
      symbol: raw,
    };
  }
  return {
    ...base,
    ok: true,
    code: "OK",
    providerSymbol: String(hit.providerSymbol || raw).trim() || raw,
    canonicalSymbol: String(hit.canonicalSymbol || "").trim(),
  };
}
