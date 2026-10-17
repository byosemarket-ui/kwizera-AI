/**
 * Phase 49B/49C — Multi-image OpenAI analysis engine with MTF reasoning.
 * Requires explicit confirmed=true; never sends images from review-only calls.
 */
import { randomUUID } from "node:crypto";
import { getChartCaptureStore } from "../../forex-chart-capture/store.js";
import type { ChartCaptureRecord } from "../../forex-chart-capture/types.js";
import { getAnalysisSnapshotEngine } from "../../market-data/analysis-snapshot/index.js";
import type { AnalysisMarketSnapshot } from "../../market-data/analysis-snapshot/types.js";
import { parseCanonicalTimeframe } from "../../market-data/providers/contracts.js";
import { parseMarketProviderId } from "../../market-data/providers/identity.js";
import {
  buildGuidedAnalysisResponse,
  buildOpenAiAssistantGuidanceItems,
  selectPrimaryPlanForAssistant,
  validateTradeAllocation,
} from "../analysis-response/index.js";
import { enrichAnalysisWithPositionRisk } from "../position-sizing/index.js";
import { attachPlanBundleToAnalysis } from "../snapshot-plans/index.js";
import { buildEvidenceFromSnapshot } from "../snapshot-local/evidence-from-snapshot.js";
import { verifySnapshotFingerprint } from "../snapshot-local/engine.js";
import type { LocalSnapshotEvidencePackage } from "../snapshot-local/types.js";
import { getForexOpenAiConfigStore } from "../snapshot-openai/config-store.js";
import { getOpenAiInferenceGate } from "../snapshot-openai/concurrency.js";
import {
  buildOpenAiNoTradeResult,
  normalizeOpenAiAnalysisFromModel,
} from "../snapshot-openai/normalize.js";
import {
  openAiChatMultimodalJson,
  type OpenAiImagePart,
} from "../snapshot-openai/openai-client.js";
import {
  MULTI_IMAGE_DEFAULT_TIMEOUT_MS,
  MULTI_IMAGE_MAX_BYTES_PER_IMAGE,
  MULTI_IMAGE_MAX_CAPTURES,
  MULTI_IMAGE_MAX_TIMEOUT_MS,
  MULTI_IMAGE_MAX_TOTAL_BYTES,
  MULTI_IMAGE_MIN_TIMEOUT_MS,
  MULTI_IMAGE_ANALYSIS_SCHEMA,
} from "./limits.js";
import {
  buildMtfRoster,
  parseMtfReasoningFromModel,
  shouldForceWaitForMtf,
} from "./mtf-summary.js";
import { buildMultiImageSystemPrompt, buildMultiImageUserText } from "./prompts.js";
import { computeSelectionFingerprint, validateCaptureIdList } from "./selection.js";
import { getMultiImageAnalysisStore } from "./store.js";
import type {
  MultiImageAnalysisApiResult,
  MultiImageAnalysisRequest,
  MultiImageAnalysisResult,
  MultiImageCaptureRef,
  MultiImageDataProvenance,
  MultiImageMtfReasoning,
  MultiImageReviewPayload,
} from "./types.js";
import { isOpenAiVisionEligibleModel, visionCapabilityNote } from "./vision-policy.js";

function clampTimeout(raw: unknown): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : MULTI_IMAGE_DEFAULT_TIMEOUT_MS;
  return Math.max(MULTI_IMAGE_MIN_TIMEOUT_MS, Math.min(MULTI_IMAGE_MAX_TIMEOUT_MS, Math.floor(n)));
}

function fail(started: number, code: string, error: string): MultiImageAnalysisApiResult {
  return {
    ok: false,
    code,
    error,
    latencyMs: Date.now() - started,
    analysis: null,
    review: null,
  };
}

function toCaptureRef(record: ChartCaptureRecord, hasImage: boolean): MultiImageCaptureRef {
  return {
    captureId: record.captureId,
    capturedAtUtc: record.capturedAtUtc,
    capturedAtLocal: record.capturedAtLocal,
    mode: record.mode,
    instrument: record.instrument,
    timeframe: record.timeframe,
    quote: record.quote,
    candleWindow: record.candleWindow,
    marketSnapshot: record.marketSnapshot,
    image: {
      mimeType: record.image.mimeType,
      width: record.image.width,
      height: record.image.height,
      byteLength: record.image.byteLength,
    },
    hasImage,
  };
}

async function withPlans(
  analysis: MultiImageAnalysisResult,
  snapshot: AnalysisMarketSnapshot | null,
  tradeAllocation?: { amount: number; currency: string } | null,
): Promise<MultiImageAnalysisResult> {
  if (!snapshot) {
    const guidedResponse = buildGuidedAnalysisResponse({
      source: {
        ...analysis,
        analysisProvider: "OPENAI",
        instrument: analysis.instrument,
        provider: String(analysis.provider),
      },
      tradeAllocation: tradeAllocation ?? null,
    });
    return { ...analysis, guidedResponse, assistantGuidance: null, planBundle: null };
  }
  const planned = attachPlanBundleToAnalysis(analysis, snapshot, "OPENAI");
  const enriched = await enrichAnalysisWithPositionRisk(planned, snapshot, {
    tradeAllocation: tradeAllocation ?? null,
  });
  const guidedResponse = buildGuidedAnalysisResponse({
    source: {
      ...enriched,
      analysisProvider: "OPENAI",
      instrument: enriched.instrument,
      provider: String(enriched.provider),
    },
    tradeAllocation: tradeAllocation ?? null,
  });
  const bundle = enriched.planBundle;
  const assistantGuidance = bundle
    ? buildOpenAiAssistantGuidanceItems({
      plan: selectPrimaryPlanForAssistant({
        pullback: bundle.pullback as never,
        breakout: bundle.breakout as never,
      }),
      marketDirection: bundle.marketDirection,
      supportingEvidence: enriched.keyEvidence,
      contradictingEvidence: guidedResponse.evidence.contradictingEvidence,
      tradeAllocation: tradeAllocation ?? null,
    })
    : null;
  return {
    ...enriched,
    schemaVersion: MULTI_IMAGE_ANALYSIS_SCHEMA,
    multiImage: analysis.multiImage,
    guidedResponse,
    assistantGuidance,
  } as MultiImageAnalysisResult;
}

export class MultiImageOpenAiAnalysisEngine {
  async buildReview(captureIdsRaw: unknown, snapshotId?: string | null): Promise<{
    ok: boolean;
    code: string;
    error?: string;
    review: MultiImageReviewPayload | null;
  }> {
    const ids = validateCaptureIdList(captureIdsRaw);
    if (!ids.ok) {
      return { ok: false, code: "INVALID_SELECTION", error: ids.error, review: null };
    }

    const captureStore = getChartCaptureStore();
    const config = getForexOpenAiConfigStore();
    const status = await config.getPublicStatus();
    const model = status.model || "";
    const visionOk = isOpenAiVisionEligibleModel(model);
    const warnings: string[] = [];
    const captures: MultiImageCaptureRef[] = [];
    let totalBytes = 0;

    for (const id of ids.captureIds) {
      const record = await captureStore.get(id);
      if (!record || record.status !== "STORED") {
        return {
          ok: false,
          code: "CAPTURE_NOT_FOUND",
          error: `Capture not found or not stored: ${id}`,
          review: null,
        };
      }
      const image = await captureStore.getImage(id);
      if (!image) {
        return {
          ok: false,
          code: "CAPTURE_IMAGE_MISSING",
          error: `Image bytes missing for capture ${id}. Delete and re-capture.`,
          review: null,
        };
      }
      if (image.buffer.length > MULTI_IMAGE_MAX_BYTES_PER_IMAGE) {
        return {
          ok: false,
          code: "IMAGE_TOO_LARGE",
          error: `Capture ${id} exceeds per-image size limit.`,
          review: null,
        };
      }
      totalBytes += image.buffer.length;
      if (!record.marketSnapshot.snapshotId) {
        warnings.push(
          `${record.instrument.displaySymbol} ${record.timeframe}: no capture-time market snapshot ID `
          + "(Charts capture stores quote/candle-window metadata only; immutable linkage is optional and may be null).",
        );
      }
      captures.push(toCaptureRef(record, true));
    }

    if (totalBytes > MULTI_IMAGE_MAX_TOTAL_BYTES) {
      return {
        ok: false,
        code: "PAYLOAD_TOO_LARGE",
        error: `Selected images total ${totalBytes} bytes (max ${MULTI_IMAGE_MAX_TOTAL_BYTES}). Reduce the selection.`,
        review: null,
      };
    }

    if (!visionOk) {
      warnings.push(visionCapabilityNote(model));
    }

    const analysisTime = await this.resolveAnalysisTimeContext(snapshotId, captures);
    if (!analysisTime.snapshotId) {
      warnings.push(
        "No ANALYSIS_TIME immutable snapshot linked. Prepare a snapshot on this page before confirm, or analysis will rely on capture metadata + images only.",
      );
    }

    const mtfRoster = buildMtfRoster(captures);
    if (mtfRoster.distinctTimeframes.length > 1) {
      warnings.push(`Selection spans timeframes: ${mtfRoster.distinctTimeframes.join(", ")}.`);
    }
    if (mtfRoster.sameTimeframeDuplicates) {
      warnings.push(
        "Multiple images share the same timeframe — they are not independent multi-timeframe confirmation.",
      );
    }
    if (mtfRoster.captureSpanMs != null && mtfRoster.captureSpanMs > 5 * 60_000) {
      warnings.push(
        `Capture timestamps span ${Math.round(mtfRoster.captureSpanMs / 60_000)} minutes — older screenshots are historical, not current.`,
      );
    }

    return {
      ok: true,
      code: "OK",
      review: {
        selectionFingerprint: ids.fingerprint,
        imageCount: captures.length,
        captures,
        model,
        modelVisionEligible: visionOk,
        modelVisionNote: visionCapabilityNote(model),
        analysisTime,
        mtfRoster,
        warnings,
        limits: {
          maxCaptures: MULTI_IMAGE_MAX_CAPTURES,
          maxTotalBytes: MULTI_IMAGE_MAX_TOTAL_BYTES,
          maxBytesPerImage: MULTI_IMAGE_MAX_BYTES_PER_IMAGE,
        },
        requiresExplicitConfirm: true,
        note:
          "Images and market context are sent to the configured OpenAI service only after you activate Confirm & Send to OpenAI. "
          + "Changing the selection invalidates this review.",
      },
    };
  }

  private async resolveAnalysisTimeContext(
    snapshotId: string | null | undefined,
    captures: MultiImageCaptureRef[],
  ): Promise<MultiImageDataProvenance["analysisTime"]> {
    const id = String(snapshotId ?? "").trim();
    const primary = captures[0];
    const base: MultiImageDataProvenance["analysisTime"] = {
      note:
        "ANALYSIS_TIME values are retrieved for this review/analysis request. "
        + "They are not the capture-time prices unless a capture-time snapshot ID matches.",
      snapshotId: null,
      contentFingerprint: null,
      quoteFreshness: null,
      feedHealth: null,
      bid: null,
      ask: null,
      lastPrice: null,
      observedAtUtc: new Date().toISOString(),
      provider: primary?.instrument.provider ?? null,
      symbol: primary?.instrument.symbol ?? null,
    };

    if (!id) return base;
    const snapshot = await getAnalysisSnapshotEngine().getSnapshot(id);
    if (!snapshot || !verifySnapshotFingerprint(snapshot)) {
      return {
        ...base,
        note: `${base.note} Requested snapshotId was missing or failed integrity checks.`,
      };
    }
    const quote = snapshot.latestQuote;
    return {
      ...base,
      snapshotId: snapshot.snapshotId,
      contentFingerprint: snapshot.contentFingerprint,
      quoteFreshness: quote?.freshness ?? snapshot.freshness?.quote ?? null,
      feedHealth: snapshot.marketStatus ?? quote?.freshness ?? null,
      bid: quote?.bid ?? null,
      ask: quote?.ask ?? null,
      lastPrice: quote?.last ?? quote?.mid ?? quote?.bid ?? null,
      observedAtUtc: quote?.serverReceiptTimestamp ?? snapshot.createdAt,
      provider: String(snapshot.provider),
      symbol: snapshot.instrument.displaySymbol,
      note:
        "ANALYSIS_TIME immutable snapshot loaded for this request. "
        + "Do not treat these prices as capture-time unless capture metadata lists the same snapshotId.",
    };
  }

  async analyze(raw: MultiImageAnalysisRequest): Promise<MultiImageAnalysisApiResult> {
    const started = Date.now();

    if (raw.confirmed !== true) {
      return fail(
        started,
        "CONFIRMATION_REQUIRED",
        "Explicit confirmation is required before images are sent to OpenAI. Use Confirm & Send to OpenAI.",
      );
    }

    const ids = validateCaptureIdList(raw.captureIds);
    if (!ids.ok) return fail(started, "INVALID_SELECTION", ids.error);

    const expectedFp = computeSelectionFingerprint(ids.captureIds);
    const providedFp = String(raw.selectionFingerprint ?? "").trim();
    if (!providedFp || providedFp !== expectedFp) {
      return fail(
        started,
        "SELECTION_CHANGED",
        "Selection fingerprint mismatch. Re-review the current selection before confirming.",
      );
    }

    const reviewBuilt = await this.buildReview(ids.captureIds, raw.snapshotId);
    if (!reviewBuilt.ok || !reviewBuilt.review) {
      return fail(started, reviewBuilt.code, reviewBuilt.error ?? "Review failed.");
    }
    const review = reviewBuilt.review;

    if (!review.modelVisionEligible) {
      return fail(started, "MODEL_NOT_VISION_ELIGIBLE", review.modelVisionNote);
    }

    const config = getForexOpenAiConfigStore();
    const status = await config.getPublicStatus();
    if (!status.vaultUnlocked) {
      return fail(started, "SECRETS_VAULT_LOCKED", "OpenAI secret vault is locked on the server.");
    }
    if (!status.configured) {
      return fail(started, "OPENAI_NOT_CONFIGURED", "OpenAI API key is not configured in Forex Admin.");
    }

    let apiKey: string | null;
    try {
      apiKey = await config.getApiKey();
    } catch (err) {
      return fail(
        started,
        (err as { code?: string })?.code ?? "SECRET_DECRYPT_FAILED",
        err instanceof Error ? err.message.slice(0, 200) : "Failed to load OpenAI API key.",
      );
    }
    if (!apiKey) {
      return fail(started, "OPENAI_NOT_CONFIGURED", "OpenAI API key is not configured.");
    }

    const captureStore = getChartCaptureStore();
    const images: OpenAiImagePart[] = [];
    for (const ref of review.captures) {
      const image = await captureStore.getImage(ref.captureId);
      if (!image) {
        return fail(started, "CAPTURE_IMAGE_MISSING", `Image missing for ${ref.captureId}.`);
      }
      images.push({
        mimeType: image.mimeType,
        base64: image.buffer.toString("base64"),
      });
    }

    const tradeAllocation = (() => {
      if (raw.tradeAllocation == null) return null;
      const parsed = validateTradeAllocation(raw.tradeAllocation);
      return parsed.ok ? parsed.value : null;
    })();

    let snapshot: AnalysisMarketSnapshot | null = null;
    let evidence: LocalSnapshotEvidencePackage | null = null;
    if (review.analysisTime.snapshotId) {
      snapshot = await getAnalysisSnapshotEngine().getSnapshot(review.analysisTime.snapshotId);
      if (snapshot && verifySnapshotFingerprint(snapshot)) {
        if (raw.contentFingerprint) {
          const expected = String(raw.contentFingerprint).trim();
          if (expected && expected !== snapshot.contentFingerprint) {
            return fail(
              started,
              "SNAPSHOT_FINGERPRINT_MISMATCH",
              "Provided contentFingerprint does not match the analysis-time snapshot.",
            );
          }
        }
        evidence = buildEvidenceFromSnapshot(snapshot);
      } else {
        snapshot = null;
      }
    }

    const provenance: MultiImageDataProvenance = {
      captureTime: {
        note: "CAPTURE_TIME metadata was stored with each screenshot at capture. Snapshot IDs may be null.",
        captures: review.captures,
      },
      analysisTime: review.analysisTime,
      onlineResearch: {
        included: false,
        note: "No online news/web research integration is included in this request.",
      },
    };

    const analysisId = randomUUID();
    const timeoutMs = clampTimeout(raw.timeoutMs);
    const model = review.model;
    const confirmedAtUtc = new Date().toISOString();
    const store = getMultiImageAnalysisStore();

    const mtfRoster = review.mtfRoster ?? buildMtfRoster(review.captures);

    const attachMulti = (
      base: Awaited<ReturnType<typeof buildOpenAiNoTradeResult>>,
      mtfReasoning?: MultiImageMtfReasoning,
    ): MultiImageAnalysisResult => ({
      ...base,
      schemaVersion: MULTI_IMAGE_ANALYSIS_SCHEMA,
      multiImage: {
        captureIds: ids.captureIds,
        selectionFingerprint: expectedFp,
        imageCount: images.length,
        provenance,
        visionModel: model,
        confirmedAtUtc,
        mtfReasoning: mtfReasoning ?? parseMtfReasoningFromModel(null, mtfRoster),
      },
    });

    // When no snapshot evidence package exists, synthesize a minimal evidence shell from capture metadata
    // so normalize/plan attach have instrument identity — decision should lean WAIT.
    if (!evidence) {
      const primary = review.captures[0];
      const provider = parseMarketProviderId(primary?.instrument.provider ?? "FOREXCONNECT") ?? "FOREXCONNECT";
      const tf = parseCanonicalTimeframe(primary?.timeframe ?? "1h") ?? "1h";
      const sym = primary?.instrument.symbol ?? "UNKNOWN";
      const display = primary?.instrument.displaySymbol ?? sym;
      evidence = {
        schemaVersion: "forex-local-snapshot-evidence-v1",
        snapshotId: "multi-image-no-snapshot",
        contentFingerprint: expectedFp,
        provider,
        instrument: {
          providerSymbol: sym,
          displaySymbol: display,
          canonicalSymbol: sym.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
        },
        candleTimeframe: tf,
        analysisPeriod: "6h",
        requestedRange: { startUtc: primary?.capturedAtUtc ?? confirmedAtUtc, endUtc: confirmedAtUtc },
        returnedRange: null,
        priceBasis: "unknown",
        environment: "unknown",
        quoteFreshness: primary?.quote.feedHealth ?? "UNAVAILABLE",
        marketStatus: primary?.quote.feedHealth ?? "UNAVAILABLE",
        candleCount: primary?.candleWindow.totalCount ?? 0,
        candlesRequestedEstimate: primary?.candleWindow.totalCount ?? 0,
        closedCandleCount: primary?.candleWindow.closedCount ?? 0,
        expectedClosedCandles: primary?.candleWindow.totalCount ?? 0,
        formingCandleCount: primary?.candleWindow.formingCount ?? 0,
        historicalCoverageRatio: 0,
        candles: [],
        evidenceCandleSubset: false,
        dataGaps: [],
        warnings: [
          "No ANALYSIS_TIME immutable snapshot was linked for this multi-image request.",
          "Structure/pattern detectors were not run against an immutable snapshot.",
          ...review.warnings,
        ],
        validationStatus: "VALID_WITH_WARNINGS",
        evidenceReady: true,
        detectorSummary: "unavailable — no analysis-time snapshot",
        categories: {
          snapshotMeta: false,
          candles: false,
          quote: Boolean(primary?.quote.lastPrice != null || primary?.quote.bid != null),
          validation: false,
          patterns: false,
          structure: false,
          knowledge: false,
          unavailable: ["structure", "patterns", "analysis_snapshot", "candles"],
        },
      };
    }

    const gate = getOpenAiInferenceGate();
    const gateKey = `multi-image:${expectedFp.slice(0, 16)}`;

    try {
      const analysis = await withPlans(await gate.runExclusive(gateKey, async () => {
        const chat = await openAiChatMultimodalJson({
          apiKey: apiKey!,
          model,
          system: buildMultiImageSystemPrompt(),
          userText: buildMultiImageUserText({
            captures: review.captures,
            provenance,
            evidence,
            mtfRoster,
          }),
          images,
          timeoutMs,
        });

        if (!chat.ok || !chat.data) {
          const failed = attachMulti(buildOpenAiNoTradeResult({
            analysisId,
            evidence: evidence!,
            model,
            reason: chat.error ?? "OpenAI multimodal request failed.",
            newsResearchStatus: "unavailable",
          }));
          failed.status = "failed";
          failed.error = chat.error ?? "OpenAI multimodal request failed.";
          failed.decision = "WAIT";
          return failed;
        }

        const mtfReasoning = parseMtfReasoningFromModel(chat.data, mtfRoster);

        const normalized = normalizeOpenAiAnalysisFromModel({
          raw: chat.data,
          evidence: evidence!,
          analysisId,
          model: chat.model,
          inferenceLatencyMs: chat.latencyMs,
          newsResearchStatus: "unavailable",
        });

        if (!normalized.ok) {
          const failed = attachMulti(buildOpenAiNoTradeResult({
            analysisId,
            evidence: evidence!,
            model,
            reason: normalized.error,
            newsResearchStatus: "unavailable",
          }), mtfReasoning);
          failed.status = "failed";
          failed.error = normalized.error;
          return failed;
        }

        let analysis = attachMulti(normalized.analysis, mtfReasoning);
        if (shouldForceWaitForMtf(analysis.decision, mtfReasoning)) {
          const reason =
            mtfReasoning.timeframeAgreement === "CONFLICTING"
              ? "Multi-timeframe evidence conflicts — directional decision downgraded to WAIT."
              : "Multi-timeframe evidence is insufficient — directional decision downgraded to WAIT.";
          analysis = {
            ...analysis,
            decision: "WAIT",
            decisionRationale: `${reason} ${analysis.decisionRationale}`.trim(),
            limitations: [...analysis.limitations, reason],
            warnings: [...analysis.warnings, reason],
          };
        }
        // Prefer MTF scenario text when the model supplied it.
        if (mtfReasoning.bullishScenario) {
          analysis = { ...analysis, bullishScenario: mtfReasoning.bullishScenario };
        }
        if (mtfReasoning.bearishScenario) {
          analysis = { ...analysis, bearishScenario: mtfReasoning.bearishScenario };
        }
        if (mtfReasoning.invalidationConditions.length) {
          analysis = {
            ...analysis,
            invalidationConditions: [
              ...mtfReasoning.invalidationConditions,
              ...analysis.invalidationConditions,
            ].slice(0, 16),
          };
        }
        return analysis;
      }), snapshot, tradeAllocation);

      await store.save(analysis, evidence);
      const ok = analysis.status === "completed" && !analysis.error;
      if (ok) await config.recordValidation(true);
      else if (analysis.error && /authentication|API key/i.test(analysis.error)) {
        await config.recordValidation(false);
      }

      return {
        ok,
        code: ok ? "OK" : "OPENAI_ERROR",
        error: analysis.error ?? undefined,
        latencyMs: Date.now() - started,
        analysis,
        review,
      };
    } catch (err) {
      const code = (err as { code?: string })?.code === "AI_QUEUE_FULL"
        ? "AI_QUEUE_FULL"
        : "OPENAI_ERROR";
      return fail(
        started,
        code,
        err instanceof Error ? err.message.slice(0, 240) : "Multi-image analysis failed.",
      );
    }
  }
}

let engineSingleton: MultiImageOpenAiAnalysisEngine | null = null;

export function getMultiImageOpenAiAnalysisEngine(): MultiImageOpenAiAnalysisEngine {
  engineSingleton ??= new MultiImageOpenAiAnalysisEngine();
  return engineSingleton;
}
