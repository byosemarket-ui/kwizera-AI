/**
 * Phase 3 — HFM AI Reasoning Engine (Chat Completions + vision; analysis-only).
 */
import { randomUUID } from "node:crypto";
import { getOpenAiInferenceGate } from "../../../../forex-ai/snapshot-openai/concurrency.js";
import { getForexOpenAiConfigStore } from "../../../../forex-ai/snapshot-openai/config-store.js";
import {
  openAiChatJson,
  openAiChatMultimodalJson,
} from "../../../../forex-ai/snapshot-openai/openai-client.js";
import { isOpenAiVisionEligibleModel } from "../../../../forex-ai/multi-image-openai/vision-policy.js";
import { getHfmCatalogService } from "../../catalog-service.js";
import {
  HFM_REASONING_OPENAI_TIMEOUT_MS,
  HFM_REASONING_PROMPT_VERSION,
  HFM_REASONING_SCHEMA_VERSION,
} from "./constants.js";
import { loadAndValidateHfmReasoningContext } from "./context-gate.js";
import { buildHfmReasoningEvidencePackage } from "./evidence.js";
import {
  getActiveReasoningRecord,
  isReasoningLocked,
  patchActiveStatus,
  releaseReasoningLock,
  setActiveReasoningRecord,
  tryAcquireReasoningLock,
} from "./job.js";
import type { HfmReasoningInstrumentMeta } from "./price-precision.js";
import { buildHfmReasoningSystemPrompt, buildHfmReasoningUserPrompt } from "./prompts.js";
import { getHfmReasoningStorage } from "./storage.js";
import type { HfmReasoningErrorCode, HfmReasoningRecord } from "./types.js";
import { validateHfmReasoningModelResponse } from "./validate-response.js";

function emptyRecord(partial: Partial<HfmReasoningRecord> & Pick<HfmReasoningRecord, "analysisId" | "contextId" | "symbol">): HfmReasoningRecord {
  return {
    analysisId: partial.analysisId,
    contextId: partial.contextId,
    snapshotId: partial.snapshotId ?? partial.contextId,
    snapshotHash: partial.snapshotHash ?? "",
    symbol: partial.symbol,
    provider: "HFM_MT5",
    status: partial.status ?? "QUEUED",
    createdAt: partial.createdAt ?? new Date().toISOString(),
    completedAt: partial.completedAt ?? null,
    promptVersion: HFM_REASONING_PROMPT_VERSION,
    schemaVersion: HFM_REASONING_SCHEMA_VERSION,
    model: partial.model ?? null,
    errorCode: partial.errorCode ?? null,
    errorMessage: partial.errorMessage ?? null,
    dataQualityStatus: partial.dataQualityStatus ?? null,
    synchronizationStatus: partial.synchronizationStatus ?? null,
    candleCounts: partial.candleCounts ?? {},
    imageRefs: partial.imageRefs ?? [],
    usage: partial.usage ?? null,
    result: partial.result ?? null,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}

function mapOpenAiCode(code: string): HfmReasoningErrorCode {
  switch (code) {
    case "OPENAI_NOT_CONFIGURED":
      return "OPENAI_NOT_CONFIGURED";
    case "OPENAI_RATE_LIMIT":
      return "OPENAI_RATE_LIMITED";
    case "OPENAI_TIMEOUT":
      return "OPENAI_TIMEOUT";
    case "OPENAI_AUTH_ERROR":
      return "OPENAI_NOT_CONFIGURED";
    default:
      return "OPENAI_REQUEST_FAILED";
  }
}

export async function runHfmAiReasoning(input: {
  contextId: string;
}): Promise<HfmReasoningRecord> {
  if (!tryAcquireReasoningLock()) {
    const active = getActiveReasoningRecord();
    return emptyRecord({
      analysisId: active?.analysisId ?? randomUUID(),
      contextId: input.contextId,
      symbol: active?.symbol ?? "UNKNOWN",
      status: "REJECTED",
      errorCode: "REASONING_JOB_ALREADY_RUNNING",
      errorMessage: "Another HFM AI reasoning job is already running",
      completedAt: new Date().toISOString(),
    });
  }

  const analysisId = randomUUID();
  let record = emptyRecord({
    analysisId,
    contextId: String(input.contextId || "").trim(),
    symbol: "PENDING",
    status: "VALIDATING_CONTEXT",
  });
  setActiveReasoningRecord(record);

  const storage = getHfmReasoningStorage();

  try {
    const gate = await loadAndValidateHfmReasoningContext(input.contextId);
    if (!gate.ok) {
      record = {
        ...record,
        status: "REJECTED",
        errorCode: gate.code,
        errorMessage: gate.message,
        completedAt: new Date().toISOString(),
      };
      setActiveReasoningRecord(record);
      await storage.save(record).catch(() => undefined);
      return record;
    }

    const { evidence } = gate;
    record = {
      ...record,
      contextId: evidence.contextId,
      snapshotId: evidence.snapshotId,
      snapshotHash: evidence.snapshotHash,
      symbol: evidence.symbol,
      status: "PREPARING_EVIDENCE",
      dataQualityStatus: evidence.context.snapshot?.dataQuality.status ?? null,
      synchronizationStatus: evidence.context.snapshot?.synchronization.status ?? null,
      imageRefs: evidence.imageRefs,
    };
    setActiveReasoningRecord(record);

    const packed = buildHfmReasoningEvidencePackage({
      context: evidence.context,
      imageRefs: evidence.imageRefs,
    });
    record = { ...record, candleCounts: packed.candleCounts };
    setActiveReasoningRecord(record);

    const config = getForexOpenAiConfigStore();
    const publicStatus = await config.getPublicStatus();
    if (!publicStatus.vaultUnlocked) {
      record = {
        ...record,
        status: "FAILED",
        errorCode: "OPENAI_VAULT_LOCKED",
        errorMessage: "OpenAI secret vault is locked",
        completedAt: new Date().toISOString(),
      };
      setActiveReasoningRecord(record);
      await storage.save(record);
      return record;
    }
    if (!publicStatus.configured) {
      record = {
        ...record,
        status: "FAILED",
        errorCode: "OPENAI_NOT_CONFIGURED",
        errorMessage: "OpenAI API key is not configured",
        completedAt: new Date().toISOString(),
      };
      setActiveReasoningRecord(record);
      await storage.save(record);
      return record;
    }
    const model = publicStatus.model;
    if (!isOpenAiVisionEligibleModel(model)) {
      record = {
        ...record,
        status: "FAILED",
        model,
        errorCode: "OPENAI_MODEL_UNSUPPORTED",
        errorMessage: `Configured model "${model}" is not vision-eligible for chart image analysis`,
        completedAt: new Date().toISOString(),
      };
      setActiveReasoningRecord(record);
      await storage.save(record);
      return record;
    }

    const apiKey = await config.getApiKey();
    if (!apiKey) {
      record = {
        ...record,
        status: "FAILED",
        model,
        errorCode: "OPENAI_NOT_CONFIGURED",
        errorMessage: "OpenAI API key unavailable",
        completedAt: new Date().toISOString(),
      };
      setActiveReasoningRecord(record);
      await storage.save(record);
      return record;
    }

    record = { ...record, status: "WAITING_FOR_OPENAI", model };
    patchActiveStatus("WAITING_FOR_OPENAI");

    const system = buildHfmReasoningSystemPrompt();
    const userText = buildHfmReasoningUserPrompt(packed.json);
    // Images in TF order H1→M5; do not log base64.
    const images = evidence.images.map((img) => ({
      mimeType: img.mimeType,
      base64: img.base64,
    }));

    const gateExclusive = getOpenAiInferenceGate();
    record = { ...record, status: "REASONING" };
    setActiveReasoningRecord(record);

    const chat = await gateExclusive.runExclusive(evidence.snapshotId, async () =>
      openAiChatMultimodalJson({
        apiKey,
        model,
        system,
        userText,
        images,
        timeoutMs: HFM_REASONING_OPENAI_TIMEOUT_MS,
      }),
    );

    // Drop image buffers from local scope ASAP (GC); evidence.images still held until return.
    images.length = 0;

    if (!chat.ok || !chat.data) {
      record = {
        ...record,
        status: "FAILED",
        errorCode: mapOpenAiCode(chat.code),
        errorMessage: chat.error ?? chat.code,
        usage: {
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          latencyMs: chat.latencyMs,
        },
        completedAt: new Date().toISOString(),
      };
      setActiveReasoningRecord(record);
      await storage.save(record);
      return record;
    }

    record = { ...record, status: "VALIDATING_RESPONSE" };
    setActiveReasoningRecord(record);

    const usageObj = (chat.data.usage as Record<string, unknown> | undefined) ?? undefined;
    const expectedIds = {
      symbol: evidence.symbol,
      contextId: evidence.contextId,
      snapshotId: evidence.snapshotId,
      snapshotHash: evidence.snapshotHash,
      model,
    };
    let instrument: HfmReasoningInstrumentMeta | null = null;
    try {
      const cat = await getHfmCatalogService().getSymbol(evidence.symbol);
      if (cat && cat.symbol) {
        instrument = {
          symbol: cat.symbol,
          digits: cat.digits ?? null,
          point: cat.point ?? null,
          tickSize: cat.tickSize ?? null,
          source: "HFM_CATALOG",
        };
      }
    } catch {
      instrument = null;
    }
    let validated = validateHfmReasoningModelResponse({
      raw: chat.data,
      expected: expectedIds,
      instrument,
    });
    if (!validated.ok && typeof chat.rawText === "string") {
      validated = validateHfmReasoningModelResponse({
        raw: chat.rawText,
        expected: expectedIds,
        instrument,
      });
    }
    if (!validated.ok) {
      const keys = chat.data && typeof chat.data === "object"
        ? Object.keys(chat.data as object).slice(0, 20).join(",")
        : "none";
      // One bounded text-only repair attempt (no images) to reformat into schema.
      const repair = await gateExclusive.runExclusive(`${evidence.snapshotId}:repair`, async () =>
        openAiChatJson({
          apiKey,
          model,
          system: buildHfmReasoningSystemPrompt(),
          user: [
            "Your previous JSON did not match the required schema.",
            `Validation error: ${validated.error}`,
            `Observed top-level keys: ${keys}`,
            "Return ONLY a corrected JSON object with the required top-level keys, including decision{action,confidence,confidenceLabel,summary}.",
            "Reuse the same market conclusions; do not invent new OHLC.",
            `contextId=${evidence.contextId}`,
            `snapshotId=${evidence.snapshotId}`,
            `snapshotHash=${evidence.snapshotHash}`,
            `symbol=${evidence.symbol}`,
            `provider=HFM_MT5`,
            "Previous JSON (truncated):",
            JSON.stringify(chat.data).slice(0, 6000),
          ].join("\n"),
          timeoutMs: HFM_REASONING_OPENAI_TIMEOUT_MS,
        }),
      );
      if (repair.ok && repair.data) {
        validated = validateHfmReasoningModelResponse({
          raw: repair.data,
          expected: expectedIds,
          instrument,
        });
      }
      if (!validated.ok) {
        const fieldDiag = (() => {
          const src = repair.ok && repair.data ? repair.data : chat.data;
          if (!src || typeof src !== "object") return "payload=missing";
          const root = src as Record<string, unknown>;
          const typeOf = (k: string) => {
            const v = root[k];
            if (v === null) return `${k}=null`;
            if (Array.isArray(v)) return `${k}=array(${v.length})`;
            if (typeof v === "object") return `${k}=object(${Object.keys(v as object).slice(0, 8).join(",")})`;
            return `${k}=${typeof v}`;
          };
          const parts = [
            typeOf("decision"),
            typeOf("marketOverview"),
            typeOf("timeframeAnalysis"),
            typeOf("scenarios"),
            typeOf("tradePlan"),
            typeOf("evidence"),
            typeOf("riskAssessment"),
            typeOf("nextConfirmation"),
          ];
          const dec = root.decision;
          if (dec && typeof dec === "object") {
            const o = dec as Record<string, unknown>;
            parts.push(`action=${String(o.action)} label=${String(o.confidenceLabel)}`);
          }
          return parts.join("; ");
        })();
        record = {
          ...record,
          status: "FAILED",
          errorCode: validated.code as HfmReasoningErrorCode,
          errorMessage: `${validated.error} (topKeys=${keys}; ${fieldDiag})`.slice(0, 500),
          usage: {
            promptTokens: numOrNull(usageObj?.prompt_tokens),
            completionTokens: numOrNull(usageObj?.completion_tokens),
            totalTokens: numOrNull(usageObj?.total_tokens),
            latencyMs: (chat.latencyMs ?? 0) + (repair.latencyMs ?? 0),
          },
          completedAt: new Date().toISOString(),
        };
        setActiveReasoningRecord(record);
        await storage.save(record);
        return record;
      }
    }

    // Force trusted identity fields (never trust model alone).
    const result = {
      ...validated.result,
      provider: "HFM_MT5" as const,
      symbol: evidence.symbol,
      contextId: evidence.contextId,
      snapshotId: evidence.snapshotId,
      snapshotHash: evidence.snapshotHash,
      model,
      placesOrders: false as const,
      mutatesBroker: false as const,
      acceptsForExecution: false as const,
    };

    record = {
      ...record,
      status: "COMPLETED",
      result,
      errorCode: null,
      errorMessage: null,
      usage: {
        promptTokens: numOrNull(usageObj?.prompt_tokens),
        completionTokens: numOrNull(usageObj?.completion_tokens),
        totalTokens: numOrNull(usageObj?.total_tokens),
        latencyMs: chat.latencyMs,
      },
      completedAt: new Date().toISOString(),
    };
    setActiveReasoningRecord(record);
    await storage.save(record);
    return record;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code =
      /queue is full/i.test(message)
        ? "REASONING_JOB_ALREADY_RUNNING"
        : ("OPENAI_REQUEST_FAILED" as HfmReasoningErrorCode);
    record = {
      ...record,
      status: "FAILED",
      errorCode: code,
      errorMessage: message.slice(0, 500),
      completedAt: new Date().toISOString(),
    };
    setActiveReasoningRecord(record);
    try {
      await storage.save(record);
    } catch {
      record = {
        ...record,
        errorCode: "REASONING_STORAGE_FAILED",
      };
    }
    return record;
  } finally {
    releaseReasoningLock();
  }
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function getHfmReasoningStatus(): {
  locked: boolean;
  active: HfmReasoningRecord | null;
} {
  return { locked: isReasoningLocked(), active: getActiveReasoningRecord() };
}
