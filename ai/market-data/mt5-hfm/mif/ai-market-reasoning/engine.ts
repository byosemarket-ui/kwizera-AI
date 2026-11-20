/**
 * Phase 5E Step 3 — AI Market Reasoning Engine.
 * Reuses Forex OpenAI vault + concurrency gate. Does not change model/credentials.
 */
import { createHash, randomUUID } from "node:crypto";
import { getOpenAiInferenceGate } from "../../../../forex-ai/snapshot-openai/concurrency.js";
import { getForexOpenAiConfigStore } from "../../../../forex-ai/snapshot-openai/config-store.js";
import { openAiChatJson } from "../../../../forex-ai/snapshot-openai/openai-client.js";
import { stableSerialize } from "../quality/stable-identity.js";
import type { MifProductionIntegrationResult } from "../production-integration/types.js";
import type { MifOpportunityRankingRun } from "../opportunity-ranking/types.js";
import type { MifProbabilityBundle } from "../probability-intelligence/types.js";
import {
  MIF_AI_MARKET_REASONING_CONTRACT_ID,
  MIF_AI_MARKET_REASONING_CONTRACT_VERSION,
  MIF_AI_MARKET_REASONING_CONTEXT_VERSION,
  MIF_AI_MARKET_REASONING_DISCLAIMER,
  MIF_AI_MARKET_REASONING_OPENAI_TIMEOUT_MS,
  MIF_AI_MARKET_REASONING_PROMPT_VERSION,
} from "./contracts.js";
import {
  buildMifAiReasoningContext,
  isContextBlocked,
  isContextInsufficient,
} from "./context-builder.js";
import { buildMifAiReasoningSystemPrompt, buildMifAiReasoningUserPrompt } from "./prompts.js";
import type {
  MifAiChatJsonFn,
  MifAiMarketReasoningRun,
  MifAiReasoningRunStatus,
} from "./types.js";
import { validateAndGroundMifAiReasoningOutput } from "./validate-output.js";

export interface RunMifAiMarketReasoningInput {
  result: MifProductionIntegrationResult;
  rankingRun?: MifOpportunityRankingRun | null;
  probabilityBundle?: MifProbabilityBundle | null;
  focusCandidateId?: string | null;
  /** Injected for tests. Production uses Forex vault + openAiChatJson. */
  chatJson?: MifAiChatJsonFn | null;
  /** Skip live model; for fixture grounding tests only. */
  fixtureModelContent?: string | null;
  reuseReasoningRunId?: string | null;
  calculatedAt?: string;
}

function baseRun(
  partial: Partial<MifAiMarketReasoningRun> &
    Pick<
      MifAiMarketReasoningRun,
      "reasoningRunId" | "reasoningId" | "providerSymbol" | "status" | "contextIdentity"
    >,
): MifAiMarketReasoningRun {
  const now = new Date().toISOString();
  return {
    contractId: MIF_AI_MARKET_REASONING_CONTRACT_ID,
    contractVersion: MIF_AI_MARKET_REASONING_CONTRACT_VERSION,
    reasoningRunId: partial.reasoningRunId,
    reasoningId: partial.reasoningId,
    providerId: "HFM_MT5",
    providerSymbol: partial.providerSymbol,
    analysisRunId: partial.analysisRunId ?? null,
    candidateId: partial.candidateId ?? null,
    rankingRunId: partial.rankingRunId ?? null,
    probabilityAssessmentId: partial.probabilityAssessmentId ?? null,
    analysisTimestamp: partial.analysisTimestamp ?? now,
    modelIdentifier: partial.modelIdentifier ?? null,
    promptVersion: MIF_AI_MARKET_REASONING_PROMPT_VERSION,
    contextVersion: MIF_AI_MARKET_REASONING_CONTEXT_VERSION,
    contextIdentity: partial.contextIdentity,
    sourceEvidenceRefs: partial.sourceEvidenceRefs ?? [],
    status: partial.status,
    validationErrors: partial.validationErrors ?? [],
    output: partial.output ?? null,
    rawModelResponseRetained: partial.rawModelResponseRetained ?? false,
    usage: partial.usage ?? null,
    calculatedAt: partial.calculatedAt ?? now,
    completedAt: partial.completedAt ?? now,
    disclaimer: MIF_AI_MARKET_REASONING_DISCLAIMER,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    isWinProbability: false,
    isGuaranteedOutcome: false,
    isExecutionApproval: false,
    executionReadiness: false,
    analyticalAiReasoningOnly: true,
    notExecutable: true,
  };
}

function mapModelError(code?: string): MifAiReasoningRunStatus {
  switch (code) {
    case "OPENAI_TIMEOUT":
      return "MODEL_TIMEOUT";
    case "OPENAI_NOT_CONFIGURED":
    case "OPENAI_AUTH_ERROR":
    case "OPENAI_RATE_LIMIT":
    case "OPENAI_BILLING_BLOCKED":
    case "OPENAI_UNAVAILABLE":
    case "OPENAI_ERROR":
    case "OPENAI_INVALID_RESPONSE":
      return "MODEL_UNAVAILABLE";
    default:
      return "MODEL_UNAVAILABLE";
  }
}

function extractModelContent(chat: {
  ok?: boolean;
  data?: Record<string, unknown> | null;
  rawText?: string;
}): string | null {
  // Prefer parsed `data` — openAiChatJson only keeps a short rawText slice (e.g. 400).
  if (chat.data && typeof chat.data === "object") return JSON.stringify(chat.data);
  if (typeof chat.rawText === "string" && chat.rawText.trim()) return chat.rawText;
  return null;
}

/**
 * Run AI Market Reasoning over a MIF production result.
 * Never fabricates fallback analysis on model failure.
 */
export async function runMifAiMarketReasoning(
  input: RunMifAiMarketReasoningInput,
): Promise<MifAiMarketReasoningRun> {
  const calculatedAt = input.calculatedAt ?? new Date().toISOString();
  const ctx = buildMifAiReasoningContext({
    result: input.result,
    rankingRun: input.rankingRun,
    probabilityBundle: input.probabilityBundle,
    focusCandidateId: input.focusCandidateId,
  });

  const reasoningRunId = input.reuseReasoningRunId || `air:${randomUUID()}`;
  const reasoningId = createHash("sha256")
    .update(
      stableSerialize({
        contextIdentity: ctx.contextIdentity,
        promptVersion: MIF_AI_MARKET_REASONING_PROMPT_VERSION,
        contractVersion: MIF_AI_MARKET_REASONING_CONTRACT_VERSION,
      }),
    )
    .digest("hex")
    .slice(0, 32);

  const common = {
    reasoningRunId,
    reasoningId,
    providerSymbol: ctx.providerSymbol,
    contextIdentity: ctx.contextIdentity,
    analysisRunId: ctx.analysisRunId,
    candidateId: input.focusCandidateId ?? ctx.candidates[0]?.candidateId ?? null,
    rankingRunId: ctx.ranking?.rankingRunId ?? null,
    probabilityAssessmentId: ctx.probability?.assessmentId ?? null,
    analysisTimestamp: ctx.analysisTimestamp,
    sourceEvidenceRefs: ctx.availableEvidenceIds,
    calculatedAt,
  };

  if (isContextBlocked(ctx)) {
    return baseRun({
      ...common,
      status: "BLOCKED_BY_DATA_QUALITY",
      validationErrors: [`dataQualityStatus=${ctx.dataQualityStatus}`],
      completedAt: new Date().toISOString(),
    });
  }
  if (isContextInsufficient(ctx)) {
    return baseRun({
      ...common,
      status: "INSUFFICIENT_CONTEXT",
      validationErrors: ["no_evidence_candidates_or_assessments"],
      completedAt: new Date().toISOString(),
    });
  }

  const system = buildMifAiReasoningSystemPrompt();
  const user = buildMifAiReasoningUserPrompt(ctx);

  let content: string | null = input.fixtureModelContent ?? null;
  let modelIdentifier: string | null = null;
  let usage: MifAiMarketReasoningRun["usage"] = null;

  if (content == null) {
    try {
      let apiKey = "test-injected-key";
      let model = "fixture-model";
      if (!input.chatJson) {
        const config = getForexOpenAiConfigStore();
        const status = await config.getPublicStatus();
        if (!status.configured || !status.vaultUnlocked) {
          return baseRun({
            ...common,
            status: "MODEL_UNAVAILABLE",
            validationErrors: [
              `openai_configured=${status.configured}`,
              `vaultUnlocked=${status.vaultUnlocked}`,
            ],
            modelIdentifier: status.model ?? null,
            completedAt: new Date().toISOString(),
          });
        }
        const key = await config.getApiKey();
        if (!key) {
          return baseRun({
            ...common,
            status: "MODEL_UNAVAILABLE",
            validationErrors: ["api_key_unavailable"],
            modelIdentifier: status.model ?? null,
            completedAt: new Date().toISOString(),
          });
        }
        apiKey = key;
        model = status.model;
      }
      modelIdentifier = model;
      const chat = input.chatJson ?? openAiChatJson;
      const gate = getOpenAiInferenceGate();
      const chatResult = await gate.runExclusive(reasoningRunId, () =>
        chat({
          apiKey,
          model,
          system,
          user,
          timeoutMs: MIF_AI_MARKET_REASONING_OPENAI_TIMEOUT_MS,
        }),
      );
      const extracted = extractModelContent(chatResult);
      if (!chatResult.ok || !extracted) {
        return baseRun({
          ...common,
          status: mapModelError(chatResult.code),
          validationErrors: [
            chatResult.code ?? "chat_failed",
            chatResult.error ?? "no_content",
          ],
          modelIdentifier: chatResult.model ?? modelIdentifier,
          completedAt: new Date().toISOString(),
        });
      }
      content = extracted;
      modelIdentifier = chatResult.model ?? modelIdentifier;
      usage = {
        promptTokens: chatResult.usage?.prompt_tokens ?? null,
        completionTokens: chatResult.usage?.completion_tokens ?? null,
      };
    } catch (err) {
      return baseRun({
        ...common,
        status: "MODEL_UNAVAILABLE",
        validationErrors: [err instanceof Error ? err.message : String(err)],
        completedAt: new Date().toISOString(),
      });
    }
  } else {
    modelIdentifier = "fixture";
  }

  const grounded = validateAndGroundMifAiReasoningOutput(content, ctx);
  if (!grounded.ok || !grounded.output) {
    const status: MifAiReasoningRunStatus = grounded.errors.some((e) =>
      /unknown_evidence|invented|probability_mismatch|null_probability|ranking_score_labeled|execution/
        .test(e),
    )
      ? "EVIDENCE_VALIDATION_FAILED"
      : "INVALID_MODEL_OUTPUT";
    return baseRun({
      ...common,
      status,
      validationErrors: grounded.errors,
      output: grounded.output,
      modelIdentifier,
      usage,
      rawModelResponseRetained: false,
      completedAt: new Date().toISOString(),
    });
  }

  const softErrors = grounded.errors.filter((e) => !e.startsWith("missing_or_empty="));
  const status: MifAiReasoningRunStatus =
    softErrors.length > 0 ? "PARTIAL_RESULT" : "SUCCESS";

  return baseRun({
    ...common,
    status,
    validationErrors: grounded.errors,
    output: grounded.output,
    modelIdentifier,
    usage,
    rawModelResponseRetained: false,
    completedAt: new Date().toISOString(),
  });
}
