/**
 * Phase 4.12 — Shell Markets → Automated Trading instrument mapping.
 * Only ForexConnect venues sync into AT backend state.
 */

export interface ShellMarketLike {
  venue?: string | null;
  provider?: string | null;
  symbol?: string | null;
  displaySymbol?: string | null;
}

/**
 * Resolve a ForexConnect provider symbol from the shell SelectedMarket.
 * Returns null for Binance/FXCM-historical/unsupported selections — AT must not
 * silently map those onto ForexConnect subscriptions.
 */
export function fcInstrumentFromShellMarket(market: ShellMarketLike | null | undefined): string | null {
  if (!market) return null;
  const venue = String(market.venue ?? "").toLowerCase();
  const provider = String(market.provider ?? "").toUpperCase();
  if (venue === "forexconnect" || provider === "FOREXCONNECT") {
    const symbol = String(market.symbol ?? "").trim();
    return symbol || null;
  }
  return null;
}

export function describeMarketSelectionGap(input: {
  shellInstrument: string | null;
  backendInstrument: string | null;
}): {
  code: "SYNCED" | "SHELL_ONLY" | "BACKEND_ONLY" | "MISMATCH" | "NONE";
  message: string;
} {
  const shell = input.shellInstrument;
  const backend = input.backendInstrument;
  if (!shell && !backend) {
    return {
      code: "NONE",
      message: "No market selected in Markets and no instrument stored in Automated Trading.",
    };
  }
  if (shell && !backend) {
    return {
      code: "SHELL_ONLY",
      message: `Shell has ${shell} but Automated Trading backend has no selectedInstrument — sync required.`,
    };
  }
  if (!shell && backend) {
    return {
      code: "BACKEND_ONLY",
      message: `Automated Trading has ${backend}; Markets shell has no ForexConnect selection.`,
    };
  }
  if (shell && backend && shell !== backend) {
    return {
      code: "MISMATCH",
      message: `Shell ${shell} ≠ backend ${backend} — resync required.`,
    };
  }
  return {
    code: "SYNCED",
    message: `Shell and Automated Trading agree on ${shell}.`,
  };
}
