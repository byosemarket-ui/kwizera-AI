export type ForexConnectConnectionStatus =
  | "DISABLED"
  | "NOT_CONFIGURED"
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "AUTHENTICATION_FAILED"
  | "SDK_UNAVAILABLE"
  | "SERVICE_UNAVAILABLE"
  | "ERROR";

export interface ForexConnectInstrument {
  provider: "FOREXCONNECT";
  providerSymbol: string;
  canonicalSymbol: string;
  displaySymbol: string;
  marketType: string;
  baseAsset: string | null;
  quoteAsset: string | null;
  status: string;
  offerId?: string | null;
  source?: string;
  /** Optional Offers-table / SDK fields when available. */
  description?: string | null;
  instrumentType?: string | number | null;
  assetClass?: string | null;
  metadataType?: string | null;
  contractCurrency?: string | null;
  bid?: number | null;
  ask?: number | null;
  tradingStatus?: string | null;
}

export interface ForexConnectSafeStatus {
  ok: boolean;
  provider: "FOREXCONNECT";
  apiPath: string;
  status: ForexConnectConnectionStatus | string;
  enabled: boolean;
  configured: boolean;
  environment: string;
  environmentLabel: string;
  connectionLabel?: string;
  urlHost?: string;
  usernameConfigured: boolean;
  passwordConfigured: boolean;
  sdkAvailable?: boolean;
  sdkImportError?: string | null;
  connecting?: boolean;
  connectedAt?: string | null;
  lastInstrumentAt?: string | null;
  instrumentCount?: number;
  /** Phase 34 — historical get_history capability (true only when CONNECTED). */
  historicalCapable?: boolean;
  supportedTimeframes?: string[];
  lastHistoricalAt?: string | null;
  priceBasis?: "bid";
  errorCode?: string | null;
  errorMessage?: string | null;
  trading: "DISABLED";
  note?: string;
  checkedAt?: string;
  sidecarReachable?: boolean;
}

export interface ForexConnectInstrumentsResult {
  ok: boolean;
  count: number;
  instruments: ForexConnectInstrument[];
  fetchedAt?: string | null;
  status?: ForexConnectSafeStatus;
  note?: string;
  error?: { code: string; message: string };
}

export interface ForexConnectCandlesRequest {
  symbol: string;
  timeframe: string;
  limit?: number | null;
}

export interface ForexConnectCandlesResult {
  ok: boolean;
  provider: "FOREXCONNECT";
  marketType?: string;
  providerSymbol?: string;
  canonicalSymbol?: string;
  displaySymbol?: string;
  timeframe?: string;
  periodId?: string;
  priceBasis?: "bid";
  environment?: string;
  environmentLabel?: string;
  candles: Array<Record<string, unknown>>;
  count: number;
  invalidCandles?: number;
  duplicatesRemoved?: number;
  fetchedAt?: string | null;
  lastHistoricalAt?: string | null;
  note?: string;
  status?: ForexConnectSafeStatus;
  error?: { code: string; message: string };
}
