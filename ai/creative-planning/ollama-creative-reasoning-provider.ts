/**
 * Ollama-backed CreativeReasoningProvider for Step 5 AI Creative Director.
 * Optional — when Ollama/model is unavailable, generateCreativeScenes falls back deterministically.
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

    const context = buildProjectIntelligenceContext(input);
    if (!context.projectId || context.constraints.mustUseOnlyAssetIds.length === 0) {
      throw Object.assign(new Error("PROJECT_CONTEXT_MISSING"), { code: "PROJECT_CONTEXT_MISSING" });
    }

    const prompt = [
      "You are the KWIZERA AI Creative Director for product marketing videos.",
      "Return JSON only. Do not invent asset IDs. Use only mustUseOnlyAssetIds.",
      "Do NOT invent product facts. Use ONLY verifiedFacts.allowedFacts.",
      "Do not claim anything listed in verifiedFacts.unknownFacts.",
      "Do not add price, discount, features, materials, or certifications unless in allowedFacts.",
      "Respect productionMode, platform, duration, and language constraints.",
      "FFmpeg will render still-to-video motion — plan camera/motion that FFmpeg can approximate (zoom, pan, hold).",
      "Schema:",
      JSON.stringify({
        projectId: "must match input projectId",
        creativeDirection: "string",
        videoGoal: "string",
        primarySellingPoint: "string",
        textStrategy: { headline: "string", price: "string", cta: "string" },
        scenes: [{
          id: "scene-1",
          purpose: "HOOK|REVEAL|FEATURE|DETAIL|OFFER|CTA",
          assetId: "existing-asset-id",
          duration: 3,
          camera: "string",
          motion: "string",
          backgroundStrategy: "KEEP_ORIGINAL|REMOVE_BACKGROUND|REPLACE_BACKGROUND_LATER",
          narration: "string",
        }],
      }),
      "Project Intelligence Context:",
      JSON.stringify(context),
    ].join("\n");

    const generated = await ollamaGenerateJson({
      baseUrl: this.baseUrl,
      model,
      prompt,
      timeoutMs: ollamaTimeoutMs(),
    });
    if (!generated.ok) {
      throw Object.assign(new Error(generated.error), { code: generated.code });
    }

    const parsed = parseJsonObject(generated.text);
    if (!parsed) {
      throw Object.assign(new Error("INVALID_AI_OUTPUT"), { code: "INVALID_AI_OUTPUT" });
    }

    // Force projectId binding — reject hallucinated project references upstream via validator.
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
