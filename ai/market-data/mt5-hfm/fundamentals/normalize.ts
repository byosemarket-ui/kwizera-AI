import {
  HFM_ECONOMIC_EVENT_CONTRACT_ID,
  HFM_ECONOMIC_EVENT_CONTRACT_VERSION,
  HFM_FUNDAMENTALS_PROVIDER_ID,
  HFM_SMT_ATTRIBUTION_DEFAULT_TEXT,
  HFM_SMT_ATTRIBUTION_DEFAULT_URL,
  type HfmEconomicConfidence,
  type HfmEconomicEventStatus,
} from "./contracts.js";
import type { HfmEconomicAttribution, HfmEconomicEvent } from "./types.js";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function inferCategory(title: string, id: string): string {
  const t = `${title} ${id}`.toLowerCase();
  if (/rate.?decision|interest rate|deposit|fomc|ecb|boe|boj|snb|boc|rba|rbnz/.test(t)) {
    return "RATE_DECISION";
  }
  if (/statement|minutes|press conference|monetary policy|projections/.test(t)) {
    return "CB_COMMUNICATION";
  }
  if (/cpi|hicp|pce|ppi|inflation/.test(t)) return "INFLATION";
  if (/payroll|employment|unemployment|earnings|wage|jolts/.test(t)) return "EMPLOYMENT";
  if (/\bgdp\b|gross domestic/.test(t)) return "GDP";
  if (/\bpmi\b/.test(t)) return "PMI";
  if (/retail|sales|confidence|trade balance/.test(t)) return "ACTIVITY";
  if (/speech|speak/.test(t)) return "SPEECH";
  if (/holiday/.test(t)) return "HOLIDAY";
  return "OTHER";
}

function mapStatus(raw: string): HfmEconomicEventStatus {
  const s = raw.toLowerCase();
  if (s === "scheduled" || s === "moved" || s === "tentative" || s === "cancelled" || s === "released") {
    return s;
  }
  return "unknown";
}

function mapConfidence(raw: string): HfmEconomicConfidence {
  const s = raw.toLowerCase();
  if (
    s === "official" ||
    s === "sources_agree" ||
    s === "single_source" ||
    s === "sources_disagree"
  ) {
    return s;
  }
  return "unknown";
}

export function parseSmtAttribution(raw: unknown): HfmEconomicAttribution {
  const r = asRecord(raw);
  return {
    required: Boolean(r?.required),
    text: str(r?.text) || HFM_SMT_ATTRIBUTION_DEFAULT_TEXT,
    url: str(r?.url) || HFM_SMT_ATTRIBUTION_DEFAULT_URL,
  };
}

export function normalizeSmtEvent(
  raw: unknown,
  retrievedAtUtc: string,
): HfmEconomicEvent | null {
  const e = asRecord(raw);
  if (!e) return null;
  const providerEventId = str(e.id).trim();
  const title = str(e.title).trim();
  const currency = str(e.currency).trim().toUpperCase();
  const time = str(e.time).trim();
  const tsRaw = e.ts;
  const ts = typeof tsRaw === "number" && Number.isFinite(tsRaw) ? Math.floor(tsRaw) : NaN;
  if (!providerEventId || !title || !currency || !time || !Number.isFinite(ts)) {
    return null;
  }

  const forecast = str(e.forecast);
  const previous = str(e.previous);
  const actual = str(e.actual);
  const warnings: string[] = [];
  if (!forecast) warnings.push("MISSING_FORECAST");
  if (!previous) warnings.push("MISSING_PREVIOUS");
  if (!actual) warnings.push("MISSING_ACTUAL");
  const confidence = mapConfidence(str(e.confidence));
  if (confidence === "single_source") {
    warnings.push("CONFIDENCE_SINGLE_SOURCE_NOT_OFFICIAL");
  }
  if (confidence === "sources_disagree") {
    warnings.push("CONFIDENCE_SOURCES_DISAGREE");
  }
  const status = mapStatus(str(e.status));
  if (status === "tentative") warnings.push("STATUS_TENTATIVE");

  const completeness =
    forecast && previous && actual
      ? "COMPLETE"
      : forecast || previous || actual
        ? "PARTIAL"
        : "MISSING_VALUES";

  return {
    contractId: HFM_ECONOMIC_EVENT_CONTRACT_ID,
    contractVersion: HFM_ECONOMIC_EVENT_CONTRACT_VERSION,
    eventId: `smt:${providerEventId}`,
    providerId: HFM_FUNDAMENTALS_PROVIDER_ID,
    providerEventId,
    title,
    currency,
    country: null,
    category: inferCategory(title, providerEventId),
    impact: str(e.impact).toLowerCase() || "unknown",
    scheduledAtUtc: time.endsWith("Z") ? time : `${time}Z`,
    scheduledTs: ts,
    originalTimezone: null,
    forecast,
    previous,
    actual,
    unit: null,
    period: str(e.period),
    status,
    movedFrom: str(e.moved_from),
    confidence,
    sourceUrl: null,
    retrievedAtUtc,
    publishedAtUtc: null,
    freshness: "FRESH",
    completeness,
    qualityWarnings: warnings,
    revisionOfEventId: null,
    analyticalOnly: true,
    doesNotApproveExecution: true,
  };
}

export function normalizeSmtCalendarPayload(json: unknown, retrievedAtUtc: string): {
  events: HfmEconomicEvent[];
  attribution: HfmEconomicAttribution;
  serverTime: number | null;
  count: number;
  dropped: number;
} {
  const root = asRecord(json);
  const list = Array.isArray(root?.events) ? root!.events : [];
  const events: HfmEconomicEvent[] = [];
  let dropped = 0;
  for (const item of list) {
    const n = normalizeSmtEvent(item, retrievedAtUtc);
    if (n) events.push(n);
    else dropped += 1;
  }
  const serverTime =
    typeof root?.server_time === "number" && Number.isFinite(root.server_time)
      ? Math.floor(root.server_time)
      : null;
  return {
    events,
    attribution: parseSmtAttribution(root?.attribution),
    serverTime,
    count: typeof root?.count === "number" ? root.count : events.length,
    dropped,
  };
}
