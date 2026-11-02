/**
 * Phase 4.18F.5 — Redacted OpenAI evidence-delivery diagnostics.
 * Proves what categories were serialized into the actual request payload.
 * Never includes API keys, tokens, credentials, or account identifiers.
 */

import type { MarketEvidenceBundle } from "./market-evidence-builder.js";

export const OPENAI_EVIDENCE_DELIVERY_SCHEMA = "kwizera.openai-evidence-delivery.v2" as const;

export type OpenAiImageDeliveryLifecycle =
  | "CAPTURE_CREATED"
  | "IMAGE_VALIDATED"
  | "REQUEST_QUEUED"
  | "REQUEST_SENT"
  | "RESPONSE_RECEIVED"
  | "RESPONSE_VALIDATED"
  | "DELIVERY_FAILED"
  | "IMAGE_NOT_INCLUDED";

export type OpenAiEvidenceRequestStatus =
  | "REQUEST_NOT_RUN"
  | "REQUEST_BUILT"
  | "REQUEST_SENT"
  | "REQUEST_FAILED"
  | "OPENAI_UNAVAILABLE"
  | "OPENAI_TIMEOUT"
  | "OPENAI_NOT_CONFIGURED";

export type OpenAiEvidenceResponseStatus =
  | "RESPONSE_NOT_VERIFIED"
  | "RESPONSE_RECEIVED"
  | "RESPONSE_FAILED"
  | "RESPONSE_INVALID";

export type OpenAiEvidenceValidationStatus =
  | "VALIDATED"
  | "VALIDATION_FAILED"
  | "RESPONSE_NOT_VERIFIED"
  | "REQUEST_NOT_RUN";

export interface OpenAiEvidenceDeliveryReport {
  schemaVersion: typeof OPENAI_EVIDENCE_DELIVERY_SCHEMA;
  phase: "4.18F.5" | "4.18F.7";
  analysisId: string | null;
  instrument: string | null;
  builtAtUtc: string;
  /** Approximate JSON size of marketEvidence prompt slice (chars). */
  evidenceSizeChars: number;
  categoriesIncluded: {
    historicalCandles: boolean;
    liveQuote: boolean;
    liveTickMovement: boolean;
    movementWindows: boolean;
    technicalIndicators: boolean;
    marketStructure: boolean;
    mtfMatrix: boolean;
    mtfAlignment: boolean;
    signalValidation: boolean;
    strategyCandidate: boolean;
    chartImageBytes: boolean;
  };
  timeframesIncluded: string[];
  movementWindowIds: string[];
  indicatorGroupsIncluded: string[];
  structureIncluded: boolean;
  atrMethodLabel: string | null;
  historicalLiveSeparated: boolean;
  requestStatus: OpenAiEvidenceRequestStatus;
  responseStatus: OpenAiEvidenceResponseStatus;
  validationStatus: OpenAiEvidenceValidationStatus;
  /** Phase 4.18F.7 multimodal image delivery. */
  imageDeliveryLifecycle: OpenAiImageDeliveryLifecycle | null;
  observationId: string | null;
  imageId: string | null;
  imageHash: string | null;
  imageSource: "SERVER_OHLC_RENDER" | "PLATFORM_SCREENSHOT" | null;
  includedImageBytesInRequest: boolean;
  modelRequested: string | null;
  modelUsed: string | null;
  latencyMs: number | null;
  lifecycle: string | null;
  blockers: string[];
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  note: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function inspectMarketEvidencePrompt(prompt: Record<string, unknown>): {
  categoriesIncluded: OpenAiEvidenceDeliveryReport["categoriesIncluded"];
  timeframesIncluded: string[];
  movementWindowIds: string[];
  indicatorGroupsIncluded: string[];
  structureIncluded: boolean;
  atrMethodLabel: string | null;
  historicalLiveSeparated: boolean;
  evidenceSizeChars: number;
} {
  const liveTick = isRecord(prompt.liveTickMovement) ? prompt.liveTickMovement : null;
  const windows = Array.isArray(liveTick?.windows) ? liveTick!.windows as Array<Record<string, unknown>> : [];
  const ti = isRecord(prompt.technicalIntelligence) ? prompt.technicalIntelligence : null;
  const mtf = isRecord(prompt.multiTimeframe) ? prompt.multiTimeframe : null;
  const alignment = isRecord(mtf?.alignment) ? mtf!.alignment : null;
  const matrix = Array.isArray(prompt.timeframeMatrix)
    ? prompt.timeframeMatrix as Array<Record<string, unknown>>
    : Array.isArray(alignment?.matrix)
      ? alignment!.matrix as Array<Record<string, unknown>>
      : [];
  const primary = isRecord(prompt.primary) ? prompt.primary : null;
  const indicators = isRecord(primary?.indicators) ? primary!.indicators : null;
  const structure = isRecord(primary?.structure) ? primary!.structure : (isRecord(ti?.structure) ? ti!.structure : null);

  const indicatorGroups: string[] = [];
  if (isRecord(ti?.movingAverages) || indicators?.fastSma != null) indicatorGroups.push("SMA");
  if (isRecord(ti?.movingAverages) && (ti!.movingAverages as Record<string, unknown>).ema21 != null) {
    indicatorGroups.push("EMA");
  }
  if (isRecord(ti?.rsi)) indicatorGroups.push("RSI");
  if (isRecord(ti?.macd)) indicatorGroups.push("MACD");
  if (isRecord(ti?.bollinger)) indicatorGroups.push("BOLLINGER");
  if (isRecord(ti?.atr) || indicators?.atr != null) indicatorGroups.push("ATR");
  if (isRecord(ti?.adx)) indicatorGroups.push("ADX");

  const atrMethod =
    (isRecord(ti?.atr) ? String((ti!.atr as Record<string, unknown>).method ?? "") : null)
    || (indicators?.atrMethod != null ? String(indicators.atrMethod) : null)
    || (isRecord(prompt.openaiEvidenceDelivery)
      ? String((prompt.openaiEvidenceDelivery as Record<string, unknown>).atrMethodLabel ?? "")
      : null)
    || null;

  const timeframesIncluded = [
    ...new Set([
      ...matrix.map((r) => String(r.timeframe ?? "")).filter(Boolean),
      ...(Array.isArray(prompt.otherTimeframes)
        ? (prompt.otherTimeframes as Array<Record<string, unknown>>).map((t) => String(t.timeframe ?? "")).filter(Boolean)
        : []),
      ...(primary?.timeframe ? [String(primary.timeframe)] : []),
    ]),
  ];

  const movementWindowIds = windows
    .map((w) => String(w.windowId ?? ""))
    .filter(Boolean);

  const historicalLiveSeparated =
    (isRecord(prompt.primary) || Array.isArray(prompt.otherTimeframes))
    && (liveTick != null || isRecord(prompt.liveQuote));

  return {
    categoriesIncluded: {
      historicalCandles: primary != null || Array.isArray(prompt.otherTimeframes),
      liveQuote: isRecord(prompt.liveQuote),
      liveTickMovement: liveTick != null,
      movementWindows: windows.length > 0,
      technicalIndicators: ti != null || indicators != null,
      marketStructure: structure != null,
      mtfMatrix: matrix.length > 0,
      mtfAlignment: alignment != null,
      signalValidation: isRecord(ti?.signalValidation),
      strategyCandidate: indicators?.strategyDirection != null
        || isRecord(ti?.signalValidation),
      chartImageBytes: false,
    },
    timeframesIncluded,
    movementWindowIds,
    indicatorGroupsIncluded: indicatorGroups,
    structureIncluded: structure != null,
    atrMethodLabel: atrMethod && atrMethod.length ? atrMethod : null,
    historicalLiveSeparated,
    evidenceSizeChars: JSON.stringify(prompt).length,
  };
}

export function buildOpenAiEvidenceDeliveryReport(input: {
  prompt: Record<string, unknown>;
  bundle?: MarketEvidenceBundle | null;
  analysisId?: string | null;
  instrument?: string | null;
  requestStatus: OpenAiEvidenceRequestStatus;
  responseStatus: OpenAiEvidenceResponseStatus;
  validationStatus: OpenAiEvidenceValidationStatus;
  modelRequested?: string | null;
  modelUsed?: string | null;
  latencyMs?: number | null;
  lifecycle?: string | null;
  blockers?: string[];
  nowMs?: number;
  imageDeliveryLifecycle?: OpenAiImageDeliveryLifecycle | null;
  observationId?: string | null;
  imageId?: string | null;
  imageHash?: string | null;
  imageSource?: "SERVER_OHLC_RENDER" | "PLATFORM_SCREENSHOT" | null;
  includedImageBytesInRequest?: boolean;
  phase?: "4.18F.5" | "4.18F.7";
}): OpenAiEvidenceDeliveryReport {
  const inspected = inspectMarketEvidencePrompt(input.prompt);
  // Prefer live windows from bundle when prompt omitted empty arrays.
  let movementWindowIds = inspected.movementWindowIds;
  if (!movementWindowIds.length && input.bundle?.liveTickMovement?.windows?.length) {
    movementWindowIds = input.bundle.liveTickMovement.windows.map((w) => w.windowId);
  }
  const categories = { ...inspected.categoriesIncluded };
  if (input.bundle?.liveTickMovement) {
    categories.liveTickMovement = true;
    categories.movementWindows = (input.bundle.liveTickMovement.windows?.length ?? 0) > 0
      || categories.movementWindows;
  }
  categories.chartImageBytes = input.includedImageBytesInRequest === true;

  return {
    schemaVersion: OPENAI_EVIDENCE_DELIVERY_SCHEMA,
    phase: input.phase ?? "4.18F.7",
    analysisId: input.analysisId ?? null,
    instrument: input.instrument ?? null,
    builtAtUtc: new Date(input.nowMs ?? Date.now()).toISOString(),
    evidenceSizeChars: inspected.evidenceSizeChars,
    categoriesIncluded: categories,
    timeframesIncluded: inspected.timeframesIncluded,
    movementWindowIds,
    indicatorGroupsIncluded: inspected.indicatorGroupsIncluded,
    structureIncluded: inspected.structureIncluded,
    atrMethodLabel: inspected.atrMethodLabel ?? "SMA_OF_TR",
    historicalLiveSeparated: inspected.historicalLiveSeparated,
    requestStatus: input.requestStatus,
    responseStatus: input.responseStatus,
    validationStatus: input.validationStatus,
    imageDeliveryLifecycle: input.imageDeliveryLifecycle ?? null,
    observationId: input.observationId ?? null,
    imageId: input.imageId ?? null,
    imageHash: input.imageHash ?? null,
    imageSource: input.imageSource ?? null,
    includedImageBytesInRequest: input.includedImageBytesInRequest === true,
    modelRequested: input.modelRequested ?? null,
    modelUsed: input.modelUsed ?? null,
    latencyMs: input.latencyMs ?? null,
    lifecycle: input.lifecycle ?? null,
    blockers: (input.blockers ?? []).slice(0, 12),
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    note: "Redacted OpenAI evidence-delivery diagnostics. No secrets. Analysis-only.",
  };
}
