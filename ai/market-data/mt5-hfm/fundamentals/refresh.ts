/**
 * Manual admin-triggered calendar refresh — no background poller.
 */
import {
  HFM_FUNDAMENTALS_CURRENCIES,
  HFM_FUNDAMENTALS_DEFAULT_DAYS,
  HFM_FUNDAMENTALS_REFRESH_MIN_INTERVAL_MS,
  HFM_FUNDAMENTALS_PROVIDER_ID,
} from "./contracts.js";
import { economicCalendarGateAvailability, isEconomicCalendarLiveAllowed } from "./gate.js";
import { normalizeSmtCalendarPayload } from "./normalize.js";
import { fetchShowMyTradesCalendar } from "./showmytrades-client.js";
import { getHfmFundamentalsStorage } from "./storage.js";
import type { HfmFundamentalsProviderState } from "./types.js";

let lastRefreshAtMs = 0;
let inFlight: Promise<HfmFundamentalsRefreshResult> | null = null;

export interface HfmFundamentalsRefreshResult {
  ok: boolean;
  code: string;
  message: string;
  availability: ReturnType<typeof economicCalendarGateAvailability> | "OK" | "PARTIAL" | "UNAVAILABLE";
  notModified?: boolean;
  eventCount?: number;
  dropped?: number;
  elapsedMs?: number;
  placesOrders: false;
  mutatesBroker: false;
  backgroundRefreshEnabled: false;
}

export function getBackgroundRefreshEnabled(): false {
  return false;
}

export async function refreshHfmEconomicCalendar(input?: {
  force?: boolean;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}): Promise<HfmFundamentalsRefreshResult> {
  if (inFlight) {
    return inFlight;
  }
  inFlight = doRefresh(input).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doRefresh(input?: {
  force?: boolean;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}): Promise<HfmFundamentalsRefreshResult> {
  const gate = economicCalendarGateAvailability();
  if (gate === "LICENSING_BLOCKED" || gate === "NOT_CONFIGURED") {
    return {
      ok: false,
      code: gate,
      message:
        gate === "LICENSING_BLOCKED"
          ? "Licensing gate not cleared — live calendar refresh blocked."
          : "Economic calendar provider not enabled.",
      availability: gate,
      placesOrders: false,
      mutatesBroker: false,
      backgroundRefreshEnabled: false,
    };
  }
  if (!isEconomicCalendarLiveAllowed()) {
    return {
      ok: false,
      code: "NOT_CONFIGURED",
      message: "Live calendar not allowed.",
      availability: "NOT_CONFIGURED",
      placesOrders: false,
      mutatesBroker: false,
      backgroundRefreshEnabled: false,
    };
  }

  const now = Date.now();
  if (!input?.force && now - lastRefreshAtMs < HFM_FUNDAMENTALS_REFRESH_MIN_INTERVAL_MS) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: `Refresh limited to once per ${HFM_FUNDAMENTALS_REFRESH_MIN_INTERVAL_MS / 1000}s`,
      availability: "OK",
      placesOrders: false,
      mutatesBroker: false,
      backgroundRefreshEnabled: false,
    };
  }

  const storage = getHfmFundamentalsStorage();
  const holder = `refresh-${now}`;
  const locked = await storage.tryAcquireRefreshLock(holder);
  if (!locked) {
    return {
      ok: false,
      code: "REFRESH_IN_FLIGHT",
      message: "Another refresh is in progress.",
      availability: "OK",
      placesOrders: false,
      mutatesBroker: false,
      backgroundRefreshEnabled: false,
    };
  }

  const prev = (await storage.loadProviderState()) ?? null;
  const attemptAt = new Date().toISOString();
  try {
    const result = await fetchShowMyTradesCalendar({
      currency: HFM_FUNDAMENTALS_CURRENCIES.join(","),
      impact: "high,medium,low",
      days: HFM_FUNDAMENTALS_DEFAULT_DAYS,
      etag: prev?.etag ?? null,
      signal: input?.signal,
      fetchImpl: input?.fetchImpl,
    });

    if (result.notModified) {
      lastRefreshAtMs = Date.now();
      const state: HfmFundamentalsProviderState = {
        providerId: HFM_FUNDAMENTALS_PROVIDER_ID,
        lastSuccessAtUtc: prev?.lastSuccessAtUtc ?? attemptAt,
        lastAttemptAtUtc: attemptAt,
        lastError: null,
        etag: result.etag ?? prev?.etag ?? null,
        lastServerTime: prev?.lastServerTime ?? null,
        lastCount: prev?.lastCount ?? null,
        attribution: prev?.attribution ?? null,
        backgroundRefreshEnabled: false,
      };
      await storage.saveProviderState(state);
      return {
        ok: true,
        code: "NOT_MODIFIED",
        message: "Calendar unchanged (HTTP 304).",
        availability: "OK",
        notModified: true,
        eventCount: prev?.lastCount ?? 0,
        elapsedMs: result.elapsedMs,
        placesOrders: false,
        mutatesBroker: false,
        backgroundRefreshEnabled: false,
      };
    }

    if (!result.ok || result.json == null) {
      const state: HfmFundamentalsProviderState = {
        providerId: HFM_FUNDAMENTALS_PROVIDER_ID,
        lastSuccessAtUtc: prev?.lastSuccessAtUtc ?? null,
        lastAttemptAtUtc: attemptAt,
        lastError: result.errorMessage ?? result.errorCode ?? "UNKNOWN",
        etag: prev?.etag ?? null,
        lastServerTime: prev?.lastServerTime ?? null,
        lastCount: prev?.lastCount ?? null,
        attribution: prev?.attribution ?? null,
        backgroundRefreshEnabled: false,
      };
      await storage.saveProviderState(state);
      return {
        ok: false,
        code: result.errorCode ?? "UNAVAILABLE",
        message: result.errorMessage ?? "Provider fetch failed",
        availability: "UNAVAILABLE",
        elapsedMs: result.elapsedMs,
        placesOrders: false,
        mutatesBroker: false,
        backgroundRefreshEnabled: false,
      };
    }

    const normalized = normalizeSmtCalendarPayload(result.json, attemptAt);
    await storage.saveEvents(normalized.events);
    lastRefreshAtMs = Date.now();
    const state: HfmFundamentalsProviderState = {
      providerId: HFM_FUNDAMENTALS_PROVIDER_ID,
      lastSuccessAtUtc: attemptAt,
      lastAttemptAtUtc: attemptAt,
      lastError: null,
      etag: result.etag,
      lastServerTime: normalized.serverTime,
      lastCount: normalized.events.length,
      attribution: normalized.attribution,
      backgroundRefreshEnabled: false,
    };
    await storage.saveProviderState(state);

    return {
      ok: true,
      code: "REFRESHED",
      message: "Calendar refreshed from ShowMyTrades.",
      availability: normalized.dropped > 0 ? "PARTIAL" : "OK",
      notModified: false,
      eventCount: normalized.events.length,
      dropped: normalized.dropped,
      elapsedMs: result.elapsedMs,
      placesOrders: false,
      mutatesBroker: false,
      backgroundRefreshEnabled: false,
    };
  } finally {
    await storage.releaseRefreshLock(holder);
  }
}

/** Test helper */
export function __resetFundamentalsRefreshForTests(): void {
  lastRefreshAtMs = 0;
  inFlight = null;
}
