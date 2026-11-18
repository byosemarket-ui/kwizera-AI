/**
 * Market Intelligence Foundation (MIF) public exports.
 * Phase 5B.1 — canonical types + three-dialect adapters.
 * Phase 5B.2 Step 1 — data integrity / gap / coverage quality (additive).
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
