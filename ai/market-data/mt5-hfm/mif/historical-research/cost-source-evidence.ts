/**
 * Phase 5F STEP 1 — documented investigation of HFM_MT5 cost sources.
 * Not invented values — only what inspected interfaces expose.
 */
export const MIF_RESEARCH_COST_SOURCE_EVIDENCE = {
  provider: "HFM_MT5" as const,
  investigatedAt: "2026-11-20",
  sourcesInspected: [
    "services/mt5-hfm-agent/mql5/KwizeraReadonlySnapshot.mq5 (CopyRates bars + SymbolInfo*)",
    "services/mt5-hfm-agent/mt5_control.py (demo.candles / on-demand CopyRates)",
    "ai/market-data/mt5-hfm/historical-engine.ts",
    "ai/market-data/mt5-hfm/catalog-types.ts / catalog current.json fields",
  ] as const,
  findings: {
    spread: {
      historical: {
        availability: "SOURCE_BACKED" as const,
        source: "CopyRates MqlRates.spread (points) on each returned bar when present",
        unit: "broker spread points on bar",
        note: "Per-bar historical; never substitute current SYMBOL_SPREAD for missing bars",
      },
      currentOnly: {
        availability: "CURRENT_METADATA_ONLY" as const,
        source: "SymbolInfoInteger(SYMBOL_SPREAD) / catalog.spread",
        note: "Live/current only — not historical",
      },
    },
    slippage: {
      availability: "UNAVAILABLE" as const,
      reason:
        "No HFM_MT5 historical slippage series in CopyRates, catalog, or expert snapshot APIs",
      inventForbidden: true,
    },
    commission: {
      availability: "UNAVAILABLE" as const,
      reason:
        "No historical commission series exported by expert/catalog; account deal history is not wired into research archive",
      inventForbidden: true,
    },
    swap: {
      availability: "UNAVAILABLE" as const,
      reason:
        "Expert catalog path does not export SYMBOL_SWAP_* historical series; no swap history in bars",
      inventForbidden: true,
    },
  },
  nativeHstParser: {
    implemented: false,
    reason:
      "Unverified binary .hst parsing rejected; CopyRates remains sole archive ingestion route",
  },
} as const;
