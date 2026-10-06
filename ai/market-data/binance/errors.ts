export type BinanceErrorCode =
  | "BINANCE_DISABLED"
  | "BINANCE_TIMEOUT"
  | "BINANCE_NETWORK"
  | "BINANCE_HTTP"
  | "BINANCE_INVALID_RESPONSE"
  | "BINANCE_INVALID_SYMBOL"
  | "BINANCE_INVALID_MARKET_DATA"
  | "BINANCE_NOT_IMPLEMENTED"
  | "BINANCE_WS_UNAVAILABLE"
  | "BINANCE_WS_INVALID_MESSAGE";

export class BinanceMarketDataError extends Error {
  readonly code: BinanceErrorCode;
  readonly httpStatus: number | null;

  constructor(code: BinanceErrorCode, message: string, httpStatus: number | null = null) {
    super(message);
    this.name = "BinanceMarketDataError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export function userFacingBinanceError(error: unknown): { code: BinanceErrorCode; message: string } {
  if (error instanceof BinanceMarketDataError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error && error.name === "AbortError") {
    return { code: "BINANCE_TIMEOUT", message: "Binance public API timed out." };
  }
  return { code: "BINANCE_NETWORK", message: "Binance public API is temporarily unavailable." };
}
