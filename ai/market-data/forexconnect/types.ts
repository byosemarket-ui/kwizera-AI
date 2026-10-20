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
  instrumentTypeLabel?: string | null;
  assetClass?: string | null;
  metadataType?: string | null;
  contractCurrency?: string | null;
  bid?: number | null;
  ask?: number | null;
  tradingStatus?: string | null;
  /** Phase 45 — Offers PointSize when SDK exposes it. */
  pointSize?: number | null;
  /** Phase 45 — Offers PipCost (account ccy per pip per lot) when available. */
  pipCost?: number | null;
  contractMultiplier?: number | null;
  digits?: number | null;
  /** Phase 47A — TradingSettingsProvider BaseUnitSize (units per 1.0 lot). */
  baseUnitSize?: number | null;
  /**
   * Phase 47A — TradingSettingsProvider get_mmr absolute margin for 1 lot
   * (account/counter currency amount — not a decimal rate).
   */
  mmrPerLot?: number | null;
  /** Phase 47A — quantity/lot step when TradingSettings exposes it. */
  lotStep?: number | null;
  /** Phase 56.2.4 — TradingSettings CondDist* (RO). Never use as lotStep. */
  condDistStop?: number | null;
  condDistLimit?: number | null;
  condDistEntryStop?: number | null;
  condDistEntryLimit?: number | null;
  condDistAvailable?: boolean;
  condDistUnit?: string | null;
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

/** Phase 47B — read-only Accounts table row (sidecar-normalized). */
export interface ForexConnectAccountRow {
  accountId: string;
  accountIdMasked: string | null;
  accountNameMasked?: string | null;
  environment: string;
  accountCurrency: string | null;
  balance: number | null;
  equity: number | null;
  usedMargin: number | null;
  usableMargin: number | null;
  currencySource?: string | null;
  missingFields?: string[];
  source?: string;
}

export interface ForexConnectAccountsResult {
  ok: boolean;
  code?: string;
  count: number;
  accounts: ForexConnectAccountRow[];
  fetchedAt?: string | null;
  status?: ForexConnectSafeStatus;
  trading?: "DISABLED";
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
