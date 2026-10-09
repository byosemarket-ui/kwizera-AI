/**
 * Phase 34 — ForexConnect user-facing errors (never leak secrets).
 */
export class ForexConnectMarketDataError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ForexConnectMarketDataError";
    this.code = code;
  }
}

export function userFacingForexConnectError(error: unknown): { code: string; message: string } {
  if (error instanceof ForexConnectMarketDataError) {
    return { code: error.code, message: error.message.slice(0, 400) };
  }
  const message = error instanceof Error ? error.message : String(error ?? "ForexConnect error");
  const lower = message.toLowerCase();
  if (lower.includes("disabled")) {
    return { code: "FOREXCONNECT_DISABLED", message: "ForexConnect is disabled." };
  }
  if (lower.includes("not_configured") || lower.includes("not configured")) {
    return {
      code: "FOREXCONNECT_NOT_CONFIGURED",
      message: "ForexConnect is not configured on the server.",
    };
  }
  if (lower.includes("auth")) {
    return {
      code: "FOREXCONNECT_AUTHENTICATION_FAILED",
      message: "ForexConnect authentication failed.",
    };
  }
  if (lower.includes("unavailable") || lower.includes("econnrefused") || lower.includes("sidecar")) {
    return {
      code: "FOREXCONNECT_SERVICE_UNAVAILABLE",
      message: "ForexConnect sidecar is unavailable.",
    };
  }
  return {
    code: "FOREXCONNECT_ERROR",
    message: message.replace(/(password|passwd|pwd)\s*[:=]\s*\S+/gi, "$1=[redacted]").slice(0, 400),
  };
}
