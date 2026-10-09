/**
 * Unified instrument catalog client — Phase 31/32 remediation.
 * Surfaces FXCM_DISABLED / FXCM_NOT_CONFIGURED instead of a silent empty list.
 */
import { useCallback, useEffect, useState } from "react";
import type { MarketInstrument, MarketProviderId } from "../../../ai/market-data/providers/types";

export type UnifiedInstrumentsLoadState =
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "disabled"
  | "not_configured"
  | "auth_error";

export type UnifiedInstrumentsState = {
  state: UnifiedInstrumentsLoadState;
  instruments: MarketInstrument[];
  message: string;
  errorCode: string | null;
};

function classifyError(code: string | undefined, message: string): UnifiedInstrumentsState {
  const normalized = String(code ?? "").toUpperCase();
  if (normalized === "FXCM_DISABLED") {
    return {
      state: "disabled",
      instruments: [],
      errorCode: normalized,
      message:
        "FXCM is disabled on this server. Set KWIZERA_FXCM_ENABLED=1 and KWIZERA_FXCM_ACCESS_TOKEN in the server environment, then use Admin → Forex → Test FXCM Authentication.",
    };
  }
  if (
    normalized === "FXCM_NOT_CONFIGURED"
    || normalized === "FXCM_CONFIG_MISSING"
  ) {
    return {
      state: "not_configured",
      instruments: [],
      errorCode: normalized,
      message:
        "FXCM access token is not configured on the server. Set KWIZERA_FXCM_ACCESS_TOKEN (server-side only), enable KWIZERA_FXCM_ENABLED=1, then authenticate from Admin → Forex.",
    };
  }
  if (
    normalized === "FXCM_AUTHENTICATION_FAILED"
    || normalized === "AUTHENTICATION_ERROR"
  ) {
    return {
      state: "auth_error",
      instruments: [],
      errorCode: normalized || "FXCM_AUTHENTICATION_FAILED",
      message: message || "FXCM authentication failed. Check the server access token and environment (demo/real).",
    };
  }
  return {
    state: "error",
    instruments: [],
    errorCode: normalized || "FXCM_UNAVAILABLE",
    message: message || "Unable to load instruments.",
  };
}

export function useUnifiedInstruments(options?: {
  provider?: MarketProviderId | "ALL";
  marketType?: string | null;
  search?: string;
  enabled?: boolean;
}): UnifiedInstrumentsState & { refresh: () => void } {
  const provider = options?.provider ?? "ALL";
  const marketType = options?.marketType ?? null;
  const search = options?.search ?? "";
  const enabled = options?.enabled !== false;
  const [tick, setTick] = useState(0);
  const [result, setResult] = useState<UnifiedInstrumentsState>({
    state: "loading",
    instruments: [],
    message: "Loading instruments…",
    errorCode: null,
  });

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const controller = new AbortController();
    setResult((prev) => ({
      ...prev,
      state: "loading",
      message: "Loading instruments…",
      errorCode: null,
    }));

    const params = new URLSearchParams();
    if (provider !== "ALL") params.set("provider", provider);
    if (marketType) params.set("marketType", marketType);
    if (search.trim()) params.set("search", search.trim());
    if (tick > 0) params.set("refresh", "1");
    params.set("limit", "500");

    fetch(`/api/forex/market-data/instruments?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({})) as {
          ok?: boolean;
          instruments?: MarketInstrument[];
          error?: { code?: string; message?: string };
        };
        if (!res.ok || data?.ok === false) {
          if (cancelled) return;
          setResult(classifyError(
            data?.error?.code,
            data?.error?.message || `Instruments request failed (${res.status})`,
          ));
          return;
        }
        const instruments = Array.isArray(data.instruments) ? data.instruments : [];
        if (cancelled) return;
        setResult({
          state: instruments.length ? "ready" : "empty",
          instruments,
          errorCode: null,
          message: instruments.length
            ? `${instruments.length} instruments`
            : provider === "FXCM"
              ? "FXCM returned no instruments for this account/environment."
              : "No instruments for this filter.",
        });
      })
      .catch((error: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        setResult({
          state: "error",
          instruments: [],
          errorCode: "NETWORK_ERROR",
          message: error instanceof Error ? error.message : "Unable to load instruments.",
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, provider, marketType, search, tick]);

  return { ...result, refresh };
}
