/**
 * Optional local Ollama vision provider — only used when a vision-capable model is installed.
 * Does not install models; fails safely when unavailable.
 */
import type { VisionCapability, VisionAnalysisInput, VisionAnalysisResult, VisionProvider } from "./vision-capabilities.js";
import {
  fetchOllamaTags,
  isOllamaDisabled,
  ollamaBaseUrl,
  ollamaGenerateJson,
  ollamaTimeoutMs,
  parseJsonObject,
  preferredVisionModelId,
  selectPreferredVisionModel,
  withOllamaSlot,
} from "./ollama-client.js";

export class OllamaVisionProvider implements VisionProvider {
  readonly id = "ollama";
  readonly capabilities: VisionCapability[] = ["image-understanding", "structured-json", "product-reasoning"];

  private baseUrl: string;
  private preferredModel: string;
  private lastModel: string | null = null;

  constructor(opts?: { baseUrl?: string; model?: string }) {
    this.baseUrl = ollamaBaseUrl(opts?.baseUrl);
    this.preferredModel = opts?.model ?? preferredVisionModelId();
  }

  getLastModel(): string | null {
    return this.lastModel;
  }

  async isAvailable(): Promise<boolean> {
    if (isOllamaDisabled()) return false;
    const tags = await fetchOllamaTags({ baseUrl: this.baseUrl });
    if (!tags.ok) return false;
    const model = selectPreferredVisionModel(tags.models, this.preferredModel);
    this.lastModel = model;
    return Boolean(model);
  }

  async analyzeImage(input: VisionAnalysisInput): Promise<VisionAnalysisResult> {
    const available = await this.isAvailable();
    if (!available || !this.lastModel) {
      return {
        provider: this.id,
        model: this.preferredModel,
        available: false,
        notes: ["No vision-capable Ollama model is installed — deterministic image intelligence remains authoritative."],
      };
    }
    const model = this.lastModel;

    try {
      const prompt = [
        "Analyze this product image. Reply with JSON only:",
        "{",
        '  "view": "front|side|back|top|bottom|detail|lifestyle|unknown",',
        '  "viewConfidence": 0.0,',
        '  "backgroundType": "plain|studio|complex|lifestyle|cluttered|unknown",',
        '  "backgroundConfidence": 0.0,',
        '  "category": "string or unknown",',
        '  "categoryConfidence": 0.0,',
        '  "dominantColors": [{"name":"color","confidence":0.0}]',
        "}",
        input.userProductName ? `User product name: ${input.userProductName}` : "",
        input.userCategory ? `User category: ${input.userCategory}` : "",
        input.imageBase64
          ? "An image payload was provided — prioritize visual product cues."
          : "Image bytes were not attached; reason from product metadata only and keep confidence low.",
      ].filter(Boolean).join("\n");

      const body: Record<string, unknown> = {
        model,
        prompt,
        stream: false,
        format: "json",
      };
      if (input.imageBase64) {
        body.images = [input.imageBase64];
      }

      const timeoutMs = Math.min(ollamaTimeoutMs(), 60_000);
      const res = await withOllamaSlot(async () => fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify(body),
      }));

      if (!res.ok) {
        if (input.imageBase64) {
          const textOnly = await ollamaGenerateJson({
            baseUrl: this.baseUrl,
            model,
            prompt,
            timeoutMs,
          });
          if (!textOnly.ok) {
            return {
              provider: this.id,
              model,
              available: true,
              notes: [`Ollama request failed (${res.status}) — using heuristics.`],
            };
          }
          return toVisionResult(
            this.id,
            model,
            parseVisionJson(textOnly.text),
            ["Ollama text enrichment applied (vision payload rejected)."],
          );
        }
        return {
          provider: this.id,
          model,
          available: true,
          notes: [`Ollama request failed (${res.status}) — using heuristics.`],
        };
      }

      const responseBody = await res.json() as { response?: string };
      return toVisionResult(
        this.id,
        model,
        parseVisionJson(responseBody.response ?? ""),
        [input.imageBase64 ? "Ollama vision enrichment applied." : "Ollama metadata enrichment applied (no image bytes)."],
      );
    } catch (error) {
      return {
        provider: this.id,
        model,
        available: true,
        notes: [error instanceof Error ? error.message : "Ollama vision failed — heuristics remain authoritative."],
      };
    }
  }
}

function toVisionResult(
  provider: string,
  model: string,
  parsed: Record<string, unknown>,
  notes: string[],
): VisionAnalysisResult {
  return {
    provider,
    model,
    available: true,
    views: parsed.view ? [{ view: String(parsed.view), confidence: clamp(parsed.viewConfidence) }] : undefined,
    dominantColors: Array.isArray(parsed.dominantColors)
      ? parsed.dominantColors
          .filter((item): item is { name: string; confidence?: number } => Boolean(item) && typeof item === "object")
          .map((item) => ({ name: String(item.name ?? ""), confidence: clamp(item.confidence) }))
          .filter((item) => item.name)
      : undefined,
    backgroundType: parsed.backgroundType
      ? { type: String(parsed.backgroundType), confidence: clamp(parsed.backgroundConfidence) }
      : undefined,
    productCategory: parsed.category
      ? { category: String(parsed.category), confidence: clamp(parsed.categoryConfidence) }
      : undefined,
    notes,
  };
}

function clamp(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function parseVisionJson(text: string): Record<string, unknown> {
  return parseJsonObject(text) ?? {};
}
