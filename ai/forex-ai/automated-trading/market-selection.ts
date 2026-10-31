/**
 * Phase 4.12 / 4.13 — Shell Markets ↔ Automated Trading instrument mapping.
 * Only ForexConnect venues sync into AT backend state.
 * Never silently assumes XAU/USD when no valid selection exists.
 */

export interface ShellMarketLike {
  venue?: string | null;
  provider?: string | null;
  symbol?: string | null;
  displaySymbol?: string | null;
}

export type MarketSelectionGapCode =
  | "SYNCED"
  | "SHELL_ONLY"
  | "BACKEND_ONLY"
  | "MISMATCH"
  | "NONE"
  | "NO_MARKET_SELECTED";

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
  code: MarketSelectionGapCode;
  message: string;
} {
  const shell = input.shellInstrument ? String(input.shellInstrument).trim() || null : null;
  const backend = input.backendInstrument ? String(input.backendInstrument).trim() || null : null;
  if (!shell && !backend) {
    return {
      code: "NO_MARKET_SELECTED",
      message: "NO_MARKET_SELECTED — choose a ForexConnect instrument in Markets.",
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
      message:
        `AT backend has persisted ${backend} but Markets shell has no ForexConnect selection — hydrate shell or clear backend.`,
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

/**
 * Operating instrument for AT actions.
 * Prefer shell FC selection when present; else backend only when shell is empty
 * and allowBackendFallback is true. Never invents a default symbol.
 */
export function resolveAtOperatingInstrument(input: {
  shellInstrument: string | null | undefined;
  backendInstrument: string | null | undefined;
  /** When true, allow persisted backend instrument if shell has no FC selection. */
  allowBackendFallback?: boolean;
}): {
  instrument: string | null;
  code: MarketSelectionGapCode;
  message: string;
} {
  const shell = input.shellInstrument ? String(input.shellInstrument).trim() || null : null;
  const backend = input.backendInstrument ? String(input.backendInstrument).trim() || null : null;
  const gap = describeMarketSelectionGap({ shellInstrument: shell, backendInstrument: backend });
  if (gap.code === "SYNCED" || gap.code === "SHELL_ONLY") {
    return { instrument: shell, code: gap.code, message: gap.message };
  }
  if (gap.code === "MISMATCH") {
    // Shell wins for display/ops until backend is overwritten by sync.
    return { instrument: shell, code: gap.code, message: gap.message };
  }
  if (gap.code === "BACKEND_ONLY" && input.allowBackendFallback !== false) {
    return {
      instrument: backend,
      code: "BACKEND_ONLY",
      message: `${gap.message} Using persisted backend instrument until Markets selection is restored.`,
    };
  }
  return {
    instrument: null,
    code: "NO_MARKET_SELECTED",
    message: "NO_MARKET_SELECTED — refuse silent XAU/USD default.",
  };
}

/** Build a shell SelectedMarket-compatible object for ForexConnect hydrate. */
export function forexConnectShellMarketFromSymbol(symbol: string): ShellMarketLike {
  const s = String(symbol ?? "").trim();
  return {
    venue: "forexconnect",
    provider: "FOREXCONNECT",
    symbol: s,
    displaySymbol: s,
  };
}
