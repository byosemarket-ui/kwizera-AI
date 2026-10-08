import type {
  MarketDataCapabilities,
  MarketInstrument,
  MarketProviderHealth,
  NormalizedMarketQuote,
} from "../providers/types.js";
import type { FxcmConfig, FxcmEnvironment } from "./config.js";

export type { FxcmConfig, FxcmEnvironment, MarketInstrument, MarketProviderHealth, NormalizedMarketQuote };

export type FxcmErrorCode =
  | "FXCM_DISABLED"
  | "FXCM_NOT_CONFIGURED"
  | "FXCM_AUTHENTICATION_FAILED"
  | "FXCM_UNAVAILABLE"
  | "FXCM_RATE_LIMITED"
  | "FXCM_INSTRUMENT_NOT_FOUND"
  | "FXCM_INVALID_SYMBOL"
  | "FXCM_CONNECTION_FAILED"
  | "FXCM_UNSUPPORTED_OPERATION"
  | "FXCM_INVALID_RESPONSE"
  | "FXCM_NETWORK"
  | "FXCM_TIMEOUT"
  | "FXCM_UNSUPPORTED_TIMEFRAME"
  | "FXCM_INVALID_RANGE"
  | "FXCM_MAPPING_UNRESOLVED"
  | "FXCM_MAPPING_CONFLICT"
  | "FXCM_OFFER_NOT_FOUND";

export interface FxcmRawInstrument {
  symbol: string;
  visible?: boolean;
  order?: number;
  instrumentType?: number;
}

export interface FxcmInstrumentCache {
  instruments: MarketInstrument[];
  fetchedAtUtc: number;
  environment: FxcmEnvironment;
  restBaseHost: string;
  cached: boolean;
}

export interface FxcmSessionHandle {
  socketId: string;
  restBaseUrl: string;
  /** Opaque auth material for Authorization header — never log. */
  authorizationHeader: string;
}

export const FXCM_INSTRUMENT_TYPE_MAP: Record<number, MarketInstrument["marketType"]> = {
  1: "FOREX",
  2: "INDEX",
  3: "COMMODITY",
  4: "TREASURY",
  5: "COMMODITY", // Bullion
  6: "SHARE",
  7: "INDEX", // FXIndex
};

export function emptyFxcmCapabilities(): MarketDataCapabilities {
  return {
    instruments: true,
    liveQuotes: false,
    streamingQuotes: false,
    historicalPrices: false,
    candles: false,
    trading: false,
  };
}
