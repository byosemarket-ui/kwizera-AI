/**
 * Phase 5B.1 — Typed MIF adapter errors / outcomes.
 */

export type MifAdapterErrorCode =
  | "UNSUPPORTED_PROVIDER"
  | "INVALID_OHLC"
  | "MISSING_IDENTITY"
  | "INVALID_TIMEFRAME"
  | "INVALID_SOURCE_CONTRACT"
  | "UNSUPPORTED_SOURCE_SEMANTICS"
  | "UNRECOVERABLE_METADATA_LOSS"
  | "LIVE_SUBSCRIPTION_UNSUPPORTED";

export class MifAdapterError extends Error {
  readonly code: MifAdapterErrorCode;
  readonly details: Record<string, unknown>;

  constructor(code: MifAdapterErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "MifAdapterError";
    this.code = code;
    this.details = details;
  }
}

export type MifAdapterResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: MifAdapterError };

export function mifOk<T>(value: T): MifAdapterResult<T> {
  return { ok: true, value };
}

export function mifFail(
  code: MifAdapterErrorCode,
  message: string,
  details: Record<string, unknown> = {},
): MifAdapterResult<never> {
  return { ok: false, error: new MifAdapterError(code, message, details) };
}
