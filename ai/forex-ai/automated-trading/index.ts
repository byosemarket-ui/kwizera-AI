export * from "./types.js";
export * from "./verification-types.js";
export * from "./quote-freshness.js";
export * from "./verification-gates.js";
export * from "./analysis/index.js";
export * from "./monitoring/index.js";
export * from "./decision/index.js";
export * from "./simulation-risk/index.js";
export * from "./broker-intent/index.js";
export * from "./automation-control/index.js";
// Phase 59.0: import order-execution directly from ./order-execution (avoid barrel weight).

export {
  assembleVerificationResult,
  buildMarketFromQuote,
  computeReadinessGates,
  findInstrument,
  isFiniteNumber,
  mapAccountMetadata,
  mapIdentityFromSnapshot,
  mapMarketFeedStatus,
  parseOptionalFinite,
  validateBidAsk,
  verifyInstrumentMetadata,
} from "./verification-engine.js";
export {
  AutomatedTradingStore,
  getAutomatedTradingStore,
  resetAutomatedTradingStoreForTests,
} from "./store.js";
export {
  AutomatedTradingService,
  getAutomatedTradingService,
  resetAutomatedTradingServiceForTests,
} from "./service.js";
