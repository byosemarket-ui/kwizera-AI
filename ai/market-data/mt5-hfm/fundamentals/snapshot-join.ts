/**
 * Cache-only snapshot join — never performs live provider HTTP.
 */
import {
  HFM_FUNDAMENTALS_MAX_EVENTS_PER_PACKAGE,
  HFM_FUNDAMENTALS_PACKAGE_CONTRACT_ID,
  HFM_FUNDAMENTALS_PACKAGE_CONTRACT_VERSION,
  HFM_FUNDAMENTALS_STALE_AFTER_MS,
  type HfmEconomicFreshness,
  type HfmFundamentalsAvailability,
} from "./contracts.js";
import { economicCalendarGateAvailability } from "./gate.js";
import {
  buildEventImpactSummary,
  filterEventsForSymbol,
  normalizeHfmSymbol,
} from "./impact.js";
import { getHfmFundamentalsStorage, hashFundamentalsPackageId } from "./storage.js";
import type { HfmFundamentalsPackage } from "./types.js";

export interface BuildFundamentalsPackageInput {
  snapshotId: string;
  symbol: string;
  asOfUtc?: string;
  /** When true, persist package under snapshots/ */
  persist?: boolean;
}

export async function buildHfmFundamentalsPackageForSnapshot(
  input: BuildFundamentalsPackageInput,
): Promise<HfmFundamentalsPackage> {
  const snapshotId = String(input.snapshotId ?? "").trim();
  const symbol = normalizeHfmSymbol(input.symbol);
  const asOfUtc = input.asOfUtc ?? new Date().toISOString();
  const gate = economicCalendarGateAvailability();

  const base = {
    contractId: HFM_FUNDAMENTALS_PACKAGE_CONTRACT_ID,
    contractVersion: HFM_FUNDAMENTALS_PACKAGE_CONTRACT_VERSION,
    packageId: hashFundamentalsPackageId([snapshotId, symbol, asOfUtc, gate]),
    snapshotId,
    symbol,
    asOfUtc,
    rankingUnaffected: true as const,
    informationalOnly: true as const,
    placesOrders: false as const,
    mutatesBroker: false as const,
    acceptsForExecution: false as const,
  };

  if (gate === "LICENSING_BLOCKED" || gate === "NOT_CONFIGURED") {
    const pkg: HfmFundamentalsPackage = {
      ...base,
      availability: gate,
      freshness: "DISABLED",
      completeness: "DISABLED",
      providerId: null,
      eventIds: [],
      events: [],
      impacts: [],
      attribution: null,
      qualityWarnings: [
        gate === "LICENSING_BLOCKED"
          ? "LICENSING_GATE_NOT_CLEARED"
          : "PROVIDER_NOT_ENABLED",
        "EMPTY_DOES_NOT_MEAN_NO_ECONOMIC_EVENTS",
      ],
    };
    if (input.persist) await getHfmFundamentalsStorage().saveSnapshotPackage(pkg);
    return pkg;
  }

  const storage = getHfmFundamentalsStorage();
  const state = await storage.loadProviderState();
  const all = await storage.loadLatestEvents();

  let availability: HfmFundamentalsAvailability = "OK";
  let freshness: HfmEconomicFreshness = "UNKNOWN";
  const warnings: string[] = [];

  if (!state?.lastSuccessAtUtc || all.length === 0) {
    availability = "UNAVAILABLE";
    freshness = "UNKNOWN";
    warnings.push("NO_CACHED_CALENDAR");
    warnings.push("EMPTY_DOES_NOT_MEAN_NO_ECONOMIC_EVENTS");
  } else {
    const age = Date.now() - Date.parse(state.lastSuccessAtUtc);
    if (!Number.isFinite(age) || age > HFM_FUNDAMENTALS_STALE_AFTER_MS) {
      availability = "STALE";
      freshness = "STALE";
      warnings.push("CACHE_STALE");
      warnings.push("STALE_NOT_LABELLED_CURRENT");
    } else {
      freshness = "FRESH";
    }
  }

  const relevant = filterEventsForSymbol(all, symbol, HFM_FUNDAMENTALS_MAX_EVENTS_PER_PACKAGE);
  if (availability === "OK" && relevant.length === 0) {
    availability = "EMPTY";
    warnings.push("NO_MATCHING_EVENTS_FOR_SYMBOL");
  } else if (availability === "OK" && relevant.some((e) => e.completeness !== "COMPLETE")) {
    availability = "PARTIAL";
  }

  for (const e of relevant) {
    e.freshness = freshness === "STALE" ? "STALE" : e.freshness;
  }

  const pkg: HfmFundamentalsPackage = {
    ...base,
    availability,
    freshness,
    completeness:
      relevant.length === 0
        ? availability === "UNAVAILABLE" || availability === "STALE"
          ? "EMPTY"
          : "EMPTY"
        : availability === "PARTIAL"
          ? "PARTIAL"
          : "COMPLETE",
    providerId: "SHOWMYTRADES",
    eventIds: relevant.map((e) => e.eventId),
    events: relevant,
    impacts: relevant.map(buildEventImpactSummary),
    attribution: state?.attribution ?? null,
    qualityWarnings: warnings,
  };

  if (input.persist) await storage.saveSnapshotPackage(pkg);
  return pkg;
}

/** Summarize for unified AI input — bounded, no secrets. */
export function summarizeFundamentalsForUnifiedInput(pkg: HfmFundamentalsPackage): Record<string, unknown> {
  return {
    contractId: pkg.contractId,
    contractVersion: pkg.contractVersion,
    packageId: pkg.packageId,
    snapshotId: pkg.snapshotId,
    symbol: pkg.symbol,
    asOfUtc: pkg.asOfUtc,
    availability: pkg.availability,
    freshness: pkg.freshness,
    completeness: pkg.completeness,
    providerId: pkg.providerId,
    rankingUnaffected: true,
    informationalOnly: true,
    qualityWarnings: pkg.qualityWarnings.slice(0, 20),
    attribution: pkg.attribution,
    eventCount: pkg.events.length,
    events: pkg.events.slice(0, HFM_FUNDAMENTALS_MAX_EVENTS_PER_PACKAGE).map((e) => ({
      eventId: e.eventId,
      providerEventId: e.providerEventId,
      title: e.title,
      currency: e.currency,
      category: e.category,
      impact: e.impact,
      scheduledAtUtc: e.scheduledAtUtc,
      forecast: e.forecast,
      previous: e.previous,
      actual: e.actual,
      status: e.status,
      confidence: e.confidence,
      period: e.period,
      qualityWarnings: e.qualityWarnings.slice(0, 8),
    })),
    impacts: pkg.impacts.slice(0, HFM_FUNDAMENTALS_MAX_EVENTS_PER_PACKAGE).map((i) => ({
      eventId: i.eventId,
      importance: i.importance,
      relevantInstruments: i.relevantInstruments.slice(0, 12),
      forecastAvailable: i.forecastAvailable,
      previousAvailable: i.previousAvailable,
      actualAvailable: i.actualAvailable,
      surprise: i.surprise,
      directionalImplication: "UNSPECIFIED",
    })),
  };
}
