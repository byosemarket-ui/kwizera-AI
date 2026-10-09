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
