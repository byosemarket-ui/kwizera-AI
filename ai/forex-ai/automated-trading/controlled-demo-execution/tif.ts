/**
 * Stage 7 — Time In Force validation (verified FXCM OM options only).
 */
import {
  STAGE7_SUPPORTED_TIF,
  type Stage7Blocker,
  type Stage7SupportedTif,
} from "./types.js";

export function normalizeTimeInForce(
  raw: string | null | undefined,
): Stage7SupportedTif | null {
  if (raw == null || !String(raw).trim()) return null;
  const u = String(raw).trim().toUpperCase();
  if ((STAGE7_SUPPORTED_TIF as readonly string[]).includes(u)) {
    return u as Stage7SupportedTif;
  }
  return null;
}

export function evaluateTimeInForce(input: {
  requested: string | null | undefined;
  /** Default when proposal omits TIF — IOC is FXCM OM documented default. */
  defaultIfMissing?: Stage7SupportedTif;
}): { ok: true; tif: Stage7SupportedTif } | { ok: false; blockers: Stage7Blocker[] } {
  const raw = input.requested;
  if (raw == null || !String(raw).trim()) {
    const def = input.defaultIfMissing ?? "IOC";
    return { ok: true, tif: def };
  }
  const u = String(raw).trim().toUpperCase();
  if (u === "GTD") {
    return {
      ok: false,
      blockers: [{
        code: "UNSUPPORTED_TIF_GTD",
        message:
          "GTD is not supported by the verified FXCM TRUE_MARKET_OPEN Stage 6/7 adapter. "
          + "Never silently converted to GTC.",
        category: "TECHNICAL",
      }],
    };
  }
  const tif = normalizeTimeInForce(u);
  if (!tif) {
    return {
      ok: false,
      blockers: [{
        code: "UNSUPPORTED_TIF",
        message: `Time In Force '${u}' is not in verified set ${STAGE7_SUPPORTED_TIF.join(",")}.`,
        category: "TECHNICAL",
      }],
    };
  }
  return { ok: true, tif };
}
