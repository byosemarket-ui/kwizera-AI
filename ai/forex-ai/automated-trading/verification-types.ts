/**
 * Phase 52 — FXCM account & market-data verification contracts.
 * Read-only. Never places broker orders.
 */
import type { AutomatedTradingEnvironment } from "./types.js";

export const AUTOMATED_TRADING_PHASE_52 = "52";
export const ACCOUNT_SNAPSHOT_MAX_AGE_MS = 60_000;
export const MARKET_QUOTE_STALE_MS = 15_000;

export type VerificationIdentityStatus =
  | "CONFIGURATION_MISSING"
  | "CONNECTING"
  | "CONNECTION_FAILED"
  | "ENVIRONMENT_MISMATCH"
  | "ACCOUNT_IDENTITY_UNVERIFIED"
  | "ACCOUNT_VERIFIED"
  | "ACCOUNT_DATA_STALE"
  | "PROVIDER_UNAVAILABLE";

export type VerificationMarketFeedStatus =
  | "NOT_CONFIGURED"
  | "SUBSCRIBING"
  | "LIVE"
  | "NO_RECENT_MARKET_UPDATES"
  | "STALE"
  | "DISCONNECTED"
  | "MARKET_INACTIVE"
  | "ERROR"
  | "UNKNOWN_SESSION";

export type InstrumentVerificationLevel =
  | "NOT_SELECTED"
  | "NOT_SUPPORTED"
  | "RECOGNIZED"
  | "METADATA_PARTIAL"
  | "ELIGIBLE_FOR_FUTURE_RISK";

export type VerificationBlockerCode =
  | "CONFIGURATION_MISSING"
  | "CONNECTION_FAILED"
  | "ENVIRONMENT_MISMATCH"
  | "ACCOUNT_IDENTITY_UNVERIFIED"
  | "ACCOUNT_DATA_STALE"
  | "ACCOUNT_CURRENCY_MISSING"
  | "ACCOUNT_BALANCE_MISSING"
  | "ACCOUNT_VALUES_INVALID"
  | "PROVIDER_UNAVAILABLE"
  | "INSTRUMENT_NOT_SELECTED"
  | "INSTRUMENT_NOT_SUPPORTED"
  | "CONTRACT_METADATA_MISSING"
  | "QUANTITY_RULES_UNVERIFIED"
  | "MARGIN_METADATA_UNVERIFIED"
  | "INVALID_QUOTE"
  | "STALE_QUOTE"
  | "MARKET_FEED_UNAVAILABLE"
  | "EPOCH_STALE"
  | "EXECUTION_NOT_IMPLEMENTED"
  | "RISK_ENGINE_NOT_IMPLEMENTED";

export interface VerificationBlocker {
  code: VerificationBlockerCode;
  message: string;
}

export interface VerifiedAccountMetadataPublic {
  accountIdMasked: string | null;
  environment: AutomatedTradingEnvironment | null;
  accountCurrency: string | null;
  balance: number | null;
  equity: number | null;
  /** True when equity was derived (balance - usedMargin + usable not used; document when used). */
  equityDerived: boolean;
  equityDerivation: string | null;
  usedMargin: number | null;
  usableMargin: number | null;
  fetchedAtUtc: string | null;
  ageMs: number | null;
  isFresh: boolean;
  fields: {
    accountCurrency: boolean;
    balance: boolean;
    equity: boolean;
    usedMargin: boolean;
    usableMargin: boolean;
  };
  missingFields: string[];
  snapshotCode: string | null;
}

export interface VerifiedInstrumentPublic {
  symbol: string | null;
  displaySymbol: string | null;
  provider: "FOREXCONNECT" | null;
  recognized: boolean;
  level: InstrumentVerificationLevel;
  instrumentType: string | null;
  baseAsset: string | null;
  quoteAsset: string | null;
  pointSize: number | null;
  pipCostAccount: number | null;
  contractMultiplier: number | null;
  baseUnitSize: number | null;
  quantityMin: number | null;
  quantityStep: number | null;
  quantityUnit: string | null;
  marginRate: number | null;
  marginPerLotAccount: number | null;
  contractVerified: boolean;
  contractSource: string | null;
  unavailableReason: string | null;
  /** Phase 56.2.4 — optional CondDist from TradingSettings (RO). */
  condDistStop?: number | null;
  condDistAvailable?: boolean;
  condDistUnit?: string | null;
}

export interface VerifiedMarketQuotePublic {
  bid: number | null;
  ask: number | null;
  spread: number | null;
  feedStatus: VerificationMarketFeedStatus;
  sourceTimestampMs: number | null;
  receivedAtMs: number | null;
  priceChangeAgeMs: number | null;
  receiptAgeMs: number | null;
  updateCount: number;
  marketSession: "ACTIVE" | "INACTIVE" | "UNKNOWN";
}

export interface AutomatedTradingReadinessGates {
  environmentVerified: boolean;
  accountIdentityVerified: boolean;
  accountMetadataSufficient: boolean;
  instrumentMetadataVerified: boolean;
  marketDataHealthVerified: boolean;
  riskEngineVerified: false;
  executionImplemented: false;
  readyForFutureAnalysis: boolean;
  /** Never true in Phase 52. */
  readyForTrading: false;
}

export interface AutomatedTradingVerificationResult {
  identityStatus: VerificationIdentityStatus;
  environmentSelected: AutomatedTradingEnvironment;
  environmentConnected: AutomatedTradingEnvironment | null;
  environmentMatches: boolean | null;
  connectionStatus: string;
  environmentEpoch: number;
  account: VerifiedAccountMetadataPublic;
  instrument: VerifiedInstrumentPublic;
  market: VerifiedMarketQuotePublic;
  readiness: AutomatedTradingReadinessGates;
  blockers: VerificationBlocker[];
  verifiedAtUtc: string;
  placesOrders: false;
}

export function emptyAccountMetadata(): VerifiedAccountMetadataPublic {
  return {
    accountIdMasked: null,
    environment: null,
    accountCurrency: null,
    balance: null,
    equity: null,
    equityDerived: false,
    equityDerivation: null,
    usedMargin: null,
    usableMargin: null,
    fetchedAtUtc: null,
    ageMs: null,
    isFresh: false,
    fields: {
      accountCurrency: false,
      balance: false,
      equity: false,
      usedMargin: false,
      usableMargin: false,
    },
    missingFields: [],
    snapshotCode: null,
  };
}

export function emptyInstrument(symbol: string | null = null): VerifiedInstrumentPublic {
  return {
    symbol,
    displaySymbol: symbol,
    provider: symbol ? "FOREXCONNECT" : null,
    recognized: false,
    level: symbol ? "NOT_SUPPORTED" : "NOT_SELECTED",
    instrumentType: null,
    baseAsset: null,
    quoteAsset: null,
    pointSize: null,
    pipCostAccount: null,
    contractMultiplier: null,
    baseUnitSize: null,
    quantityMin: null,
    quantityStep: null,
    quantityUnit: null,
    marginRate: null,
    marginPerLotAccount: null,
    contractVerified: false,
    contractSource: null,
    unavailableReason: symbol ? "Instrument not found in ForexConnect catalog." : "No instrument selected.",
  };
}

export function emptyMarket(): VerifiedMarketQuotePublic {
  return {
    bid: null,
    ask: null,
    spread: null,
    feedStatus: "NOT_CONFIGURED",
    sourceTimestampMs: null,
    receivedAtMs: null,
    priceChangeAgeMs: null,
    receiptAgeMs: null,
    updateCount: 0,
    marketSession: "UNKNOWN",
  };
}
