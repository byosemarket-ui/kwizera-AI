import type { FxcmErrorCode } from "./types.js";

export class FxcmMarketDataError extends Error {
  readonly code: FxcmErrorCode;
  readonly httpStatus: number | null;

  constructor(code: FxcmErrorCode, message: string, httpStatus: number | null = null) {
    super(message);
    this.name = "FxcmMarketDataError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/** Safe user-facing mapping — never includes tokens/secrets. */
export function userFacingFxcmError(error: unknown): { code: FxcmErrorCode; message: string } {
  if (error instanceof FxcmMarketDataError) {
    return { code: error.code, message: sanitizeMessage(error.message) };
  }
  const msg = error instanceof Error ? error.message : String(error);
  if (/timeout|abort/i.test(msg)) {
    return { code: "FXCM_TIMEOUT", message: "FXCM API request timed out." };
  }
  if (/fetch|network|ECONN|ENOTFOUND|socket/i.test(msg)) {
    return { code: "FXCM_NETWORK", message: "Could not reach FXCM API." };
  }
  return { code: "FXCM_UNAVAILABLE", message: "FXCM provider unavailable." };
}

function sanitizeMessage(message: string): string {
  return message
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/access_token=[^&\s]+/gi, "access_token=[redacted]")
    .replace(/[0-9a-f]{32,}/gi, "[redacted]");
}

export function assertNoSecretsInText(text: string, token: string | null): void {
  if (token && token.length >= 8 && text.includes(token)) {
    throw new FxcmMarketDataError("FXCM_UNSUPPORTED_OPERATION", "Refusing to expose FXCM credentials.");
  }
}
