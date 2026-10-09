/**
 * Unified instrument catalog client — Phase 31.
 */
import { useCallback, useEffect, useState } from "react";
import type { MarketInstrument, MarketProviderId } from "../../../ai/market-data/providers/types";

export type UnifiedInstrumentsState =
  | { state: "loading"; instruments: MarketInstrument[]; message: string }
  | { state: "ready"; instruments: MarketInstrument[]; message: string }
  | { state: "empty"; instruments: MarketInstrument[]; message: string }
  | { state: "error"; instruments: MarketInstrument[]; message: string };

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
  });

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const controller = new AbortController();
    setResult((prev) => ({ ...prev, state: "loading", message: "Loading instruments…" }));

    const params = new URLSearchParams();
    if (provider !== "ALL") params.set("provider", provider);
    if (marketType) params.set("marketType", marketType);
    if (search.trim()) params.set("search", search.trim());
    params.set("limit", "500");

    fetch(`/api/forex/market-data/instruments?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.ok === false) {
          throw new Error(data?.error?.message || `Instruments request failed (${res.status})`);
        }
        const instruments = Array.isArray(data.instruments) ? data.instruments as MarketInstrument[] : [];
        if (cancelled) return;
        setResult({
          state: instruments.length ? "ready" : "empty",
          instruments,
          message: instruments.length
            ? `${instruments.length} instruments`
            : "No instruments for this filter.",
        });
      })
      .catch((error: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        setResult({
          state: "error",
          instruments: [],
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
