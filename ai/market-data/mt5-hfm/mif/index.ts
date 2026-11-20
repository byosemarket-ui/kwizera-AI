/**
 * Market Intelligence Foundation (MIF) public exports.
 * Phase 5B.1 — canonical types + three-dialect adapters.
 * Phase 5B.2 — data integrity / quote / instrument / MTF / unified quality (additive).
 * Phase 5C Step 1A — analytical foundation + Fibonacci (additive, read-only).
 * Phase 5C Step 2 — harmonic patterns + market regime (additive, read-only).
 * Phase 5C Step 3 — multi-timeframe relationships (additive, read-only).
 * Phase 5D Step 1 — strategy intelligence foundation & registry (additive, read-only).
 * Phase 5D Step 2 — opportunity detection framework (additive, read-only).
 * Phase 5D Step 3 — trend continuation & pullback detectors (additive, read-only).
 * Phase 5D Step 4 — reversal detector (additive, read-only).
 * Phase 5D Step 5 — breakout detector (additive, read-only).
 * Phase 5D Step 6 — breakout retest detector (additive, read-only).
 * Phase 5D Step 7 — range opportunity detector (additive, read-only).
 * Phase 5D Step 8 — liquidity sweep opportunity detector (additive, read-only).
 * Phase 5D Step 9 — supply/demand opportunity detector (additive, read-only).
 * Phase 5D Step 10 — momentum expansion opportunity detector (additive, read-only).
 * Phase 5D Step 11 — pattern completion opportunity detector (additive, read-only).
 * Phase 5D.5 — HFM_MT5 production integration pipeline (additive, read-only).
 * Phase 5D.6 — structure/S-R/liquidity/momentum engines + persistence + quality (additive).
 * Phase 5D.7 — dedicated price displacement + outcome intelligence + replay (additive).
 * Phase 5E Step 1 — opportunity ranking & scoring (additive, analytical only).
 */
export * from "./canonical/types.js";
export * from "./canonical/instrument.js";
export * from "./canonical/candle.js";
export * from "./canonical/quote.js";
export * from "./adapters/adapter-errors.js";
export * from "./adapters/historical-adapter.js";
export * from "./adapters/live-forming-adapter.js";
export * from "./adapters/unified-hfm-adapter.js";
export * from "./quality/index.js";
export * from "./analysis/index.js";
export * from "./strategy-intelligence/index.js";
export * from "./opportunity-detection/index.js";
export * from "./opportunity-ranking/index.js";
export * from "./production-integration/index.js";
