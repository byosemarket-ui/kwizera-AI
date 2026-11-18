/**
 * Phase 5B.1 — Market Intelligence Foundation (MIF) public exports.
 * Additive HFM_MT5 canonical types + three-dialect adapters only.
 */
export * from "./canonical/types.js";
export * from "./canonical/instrument.js";
export * from "./canonical/candle.js";
export * from "./canonical/quote.js";
export * from "./adapters/adapter-errors.js";
export * from "./adapters/historical-adapter.js";
export * from "./adapters/live-forming-adapter.js";
export * from "./adapters/unified-hfm-adapter.js";
