/**
 * Phase 50A — Reject multi-image selections that mix instruments/providers.
 */
import type { MultiImageCaptureRef } from "./types.js";

export interface InstrumentConsistencyResult {
  ok: boolean;
  code: "OK" | "INSTRUMENT_MISMATCH" | "PROVIDER_MISMATCH" | "SNAPSHOT_INSTRUMENT_MISMATCH";
  error?: string;
  symbol: string | null;
  provider: string | null;
}

function normSymbol(s: string): string {
  return String(s ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

function normProvider(s: string): string {
  return String(s ?? "").trim().toUpperCase();
}

export function validateCaptureInstrumentConsistency(
  captures: MultiImageCaptureRef[],
  analysisSymbol?: string | null,
  analysisProvider?: string | null,
): InstrumentConsistencyResult {
  if (!captures.length) {
    return {
      ok: false,
      code: "INSTRUMENT_MISMATCH",
      error: "No captures supplied for instrument consistency check.",
      symbol: null,
      provider: null,
    };
  }

  const primary = captures[0]!;
  const symbol = normSymbol(primary.instrument.symbol || primary.instrument.displaySymbol);
  const provider = normProvider(primary.instrument.provider);

  for (const c of captures) {
    const s = normSymbol(c.instrument.symbol || c.instrument.displaySymbol);
    const p = normProvider(c.instrument.provider);
    if (s !== symbol) {
      return {
        ok: false,
        code: "INSTRUMENT_MISMATCH",
        error:
          `Selected captures mix instruments (${primary.instrument.displaySymbol} vs ${c.instrument.displaySymbol}). `
          + "Re-select screenshots for one instrument before Confirm & Send.",
        symbol,
        provider,
      };
    }
    if (p !== provider) {
      return {
        ok: false,
        code: "PROVIDER_MISMATCH",
        error:
          `Selected captures mix providers (${primary.instrument.provider} vs ${c.instrument.provider}). `
          + "Re-select screenshots for one provider before Confirm & Send.",
        symbol,
        provider,
      };
    }
  }

  const expectedSym = analysisSymbol ? normSymbol(analysisSymbol) : "";
  const expectedProv = analysisProvider ? normProvider(analysisProvider) : "";
  if (expectedSym && expectedSym !== symbol) {
    return {
      ok: false,
      code: "SNAPSHOT_INSTRUMENT_MISMATCH",
      error:
        `ANALYSIS_TIME instrument ${analysisSymbol} does not match selected capture instrument ${primary.instrument.displaySymbol}. `
        + "Prepare a matching snapshot or clear the snapshot before Confirm & Send.",
      symbol,
      provider,
    };
  }
  if (expectedProv && expectedProv !== provider) {
    return {
      ok: false,
      code: "SNAPSHOT_INSTRUMENT_MISMATCH",
      error:
        `ANALYSIS_TIME provider ${analysisProvider} does not match selected capture provider ${primary.instrument.provider}.`,
      symbol,
      provider,
    };
  }

  return { ok: true, code: "OK", symbol, provider };
}
