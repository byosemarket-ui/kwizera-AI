/**
 * Ollama-backed CreativeReasoningProvider for Step 5 AI Creative Director.
 * Optional — when Ollama/model is unavailable, generateCreativeScenes falls back deterministically.
 *
 * Prompt is intentionally compact for tiny CPU models (llama3.2:1b on low-RAM VPS).
 */
import {
  fetchOllamaTags,
  isOllamaDisabled,
  ollamaBaseUrl,
  ollamaGenerateJson,
  ollamaTimeoutMs,
  parseJsonObject,
  preferredReasoningModelId,
  selectPreferredReasoningModel,
} from "../ai-provider/ollama-client.js";
import type { AiCreativePlannerInput, CreativeReasoningProvider } from "./ai-creative-planner.js";
import { buildProjectIntelligenceContext } from "./project-intelligence-context.js";

/** Creative-plan inference may need longer than generic generate on 1-vCPU hosts. */
export function ollamaPlanTimeoutMs(): number {
  const raw = Number(process.env.KWIZERA_OLLAMA_PLAN_TIMEOUT_MS);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return Math.max(ollamaTimeoutMs(), 180_000);
}

async function compactContext(input: AiCreativePlannerInput): Promise<Record<string, unknown>> {
  const full = buildProjectIntelligenceContext(input);
  const task = [
    full.product.category,
    full.marketing.platform,
    full.style.creativeTone,
    "product marketing video hook reveal",
  ].filter(Boolean).join(" ");
  const {
    formatKnowledgeForPrompt,
    retrieveVideoKnowledge,
  } = await import("../video-knowledge-engine/video-knowledge-pack.js");
  const { selectApplicableSkills } = await import("../video-skills/video-skills.js");
  const knowledge = retrieveVideoKnowledge(task, 4);
  const skills = selectApplicableSkills({
    task,
    hasCta: Boolean(full.marketing.cta),
    imageCount: full.assets.length,
    tone: full.style.creativeTone,
  });
  return {
    projectId: full.projectId,
    product: {
      name: full.product.name,
      category: full.product.category,
      description: (full.product.description || "").slice(0, 160),
      price: full.product.price,
      originalPrice: full.product.originalPrice,
      currency: full.product.currency,
    },
    marketing: {
      goal: full.marketing.goal,
      audience: full.marketing.audience,
      platform: full.marketing.platform,
      durationSeconds: full.marketing.durationSeconds,
      language: full.marketing.language,
      cta: full.marketing.cta,
    },
    style: full.style,
    assetIds: full.constraints.mustUseOnlyAssetIds.slice(0, 6),
    assets: full.assets.slice(0, 6).map((a) => ({
      assetId: a.assetId,
      viewRole: a.viewRole,
      qualityScore: a.qualityScore,
    })),
    verifiedFacts: {
      allowedFacts: full.verifiedFacts.allowedFacts.slice(0, 10),
      unknownFacts: full.verifiedFacts.unknownFacts.slice(0, 6),
      priceAllowed: full.verifiedFacts.priceAllowed,
    },
    // Knowledge/skills inform the model; validators + engines remain authoritative.
    videoKnowledge: formatKnowledgeForPrompt(knowledge, 4),
    videoSkills: skills.slice(0, 4).map((s) => ({
      id: s.skill.id,
      motion: s.skill.execution.motionHint ?? null,
      transition: s.skill.execution.transitionHint ?? null,
    })),
  };
}

export class OllamaCreativeReasoningProvider implements CreativeReasoningProvider {
  readonly id = "ollama-creative-director";
  private baseUrl: string;
  private preferredModel: string;
  private lastModel: string | null = null;

  constructor(opts?: { baseUrl?: string; model?: string }) {
    this.baseUrl = ollamaBaseUrl(opts?.baseUrl);
    this.preferredModel = opts?.model ?? preferredReasoningModelId();
  }

  getLastModel(): string | null {
    return this.lastModel;
  }

  async isAvailable(): Promise<boolean> {
    if (isOllamaDisabled()) return false;
    const tags = await fetchOllamaTags({ baseUrl: this.baseUrl });
    if (!tags.ok) return false;
    const model = selectPreferredReasoningModel(tags.models, this.preferredModel);
    this.lastModel = model;
    return Boolean(model);
  }

  async planCreativeScenes(input: AiCreativePlannerInput): Promise<unknown> {
    const tags = await fetchOllamaTags({ baseUrl: this.baseUrl });
    if (!tags.ok) {
      throw Object.assign(new Error(tags.error ?? "OLLAMA_UNAVAILABLE"), { code: "OLLAMA_UNAVAILABLE" });
    }
    const model = selectPreferredReasoningModel(tags.models, this.preferredModel);
    if (!model) {
      throw Object.assign(new Error("No suitable Ollama reasoning model installed"), { code: "MODEL_NOT_FOUND" });
    }
    this.lastModel = model;

    const context = await compactContext(input);
    const assetIds = Array.isArray(context.assetIds) ? context.assetIds as string[] : [];
    if (!context.projectId || assetIds.length === 0) {
      throw Object.assign(new Error("PROJECT_CONTEXT_MISSING"), { code: "PROJECT_CONTEXT_MISSING" });
    }

    const prompt = [
      "KWIZERA Creative Director. JSON only.",
      "Use only listed assetIds. Transitions: cut or fade only.",
      `Schema:{"projectId":"${context.projectId}","creativeDirection":"product-first","primarySellingPoint":"clear benefit","textStrategy":{"headline":"name","price":"","cta":"Shop"},"scenes":[{"id":"scene-1","purpose":"HOOK","assetId":"${assetIds[0]}","duration":3,"camera":"slow push","motion":"subtle zoom","narration":"","transitionOut":"cut"},{"id":"scene-2","purpose":"REVEAL","assetId":"${assetIds[Math.min(1, assetIds.length - 1)]}","duration":3,"camera":"hold","motion":"hold","narration":"","transitionOut":"fade"}]}`,
      "Context:",
      JSON.stringify({
        projectId: context.projectId,
        product: context.product,
        marketing: {
          goal: (context.marketing as { goal?: string })?.goal,
          audience: (context.marketing as { audience?: string })?.audience,
          cta: (context.marketing as { cta?: string })?.cta,
          durationSeconds: (context.marketing as { durationSeconds?: number })?.durationSeconds,
        },
        assets: context.assets,
      }),
    ].join("\n");

    const generated = await ollamaGenerateJson({
      baseUrl: this.baseUrl,
      model,
      prompt,
      timeoutMs: ollamaPlanTimeoutMs(),
      options: {
        temperature: 0.1,
        num_ctx: 1024,
        num_predict: 280,
      },
    });
    if (!generated.ok) {
      throw Object.assign(new Error(generated.error), { code: generated.code });
    }

    const parsed = parseJsonObject(generated.text);
    if (!parsed) {
      throw Object.assign(new Error("INVALID_AI_OUTPUT"), { code: "INVALID_AI_OUTPUT" });
    }

    if (typeof parsed.projectId === "string" && parsed.projectId && parsed.projectId !== context.projectId) {
      throw Object.assign(
        new Error(`AI plan projectId mismatch: ${parsed.projectId}`),
        { code: "AI_PLAN_VALIDATION_FAILED" },
      );
    }
    parsed.projectId = context.projectId;
    return parsed;
  }
}
