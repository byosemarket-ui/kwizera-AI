/**
 * Optional local Ollama vision provider — only used when Ollama is installed and reachable.
 * Does not install models; fails safely when unavailable.
 */
import type { VisionCapability, VisionAnalysisInput, VisionAnalysisResult, VisionProvider } from "./vision-capabilities.js";
import { fetchOllamaTags, ollamaBaseUrl, ollamaGenerateJson, parseJsonObject } from "./ollama-client.js";

const DEFAULT_MODEL = process.env.KWIZERA_OLLAMA_VISION_MODEL ?? "llava";

export class OllamaVisionProvider implements VisionProvider {
  readonly id = "ollama";
  readonly capabilities: VisionCapability[] = ["image-understanding", "structured-json", "product-reasoning"];

  private baseUrl: string;
  private model: string;

  constructor(opts?: { baseUrl?: string; model?: string }) {
    this.baseUrl = ollamaBaseUrl(opts?.baseUrl);
    this.model = opts?.model ?? DEFAULT_MODEL;
  }

  async isAvailable(): Promise<boolean> {
    const tags = await fetchOllamaTags({ baseUrl: this.baseUrl });
    if (!tags.ok) return false;
    return tags.models.some((m) => m.name === this.model || m.name.startsWith(`${this.model}:`))
      || tags.models.length > 0;
  }

  async analyzeImage(input: VisionAnalysisInput): Promise<VisionAnalysisResult> {
    const available = await this.isAvailable();
    if (!available) {
      return {
        provider: this.id,
        model: this.model,
        available: false,
        notes: ["Ollama is not reachable — deterministic image intelligence remains authoritative."],
      };
    }

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
        model: this.model,
        prompt,
        stream: false,
        format: "json",
      };
      if (input.imageBase64) {
        body.images = [input.imageBase64];
      }

      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(60_000),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        if (input.imageBase64) {
          const textOnly = await ollamaGenerateJson({
            baseUrl: this.baseUrl,
            model: this.model,
            prompt,
            timeoutMs: 60_000,
          });
          if (!textOnly.ok) {
            return {
              provider: this.id,
              model: this.model,
              available: true,
              notes: [`Ollama request failed (${res.status}) — using heuristics.`],
            };
          }
          return toVisionResult(
            this.id,
            this.model,
            parseVisionJson(textOnly.text),
            ["Ollama text enrichment applied (vision payload rejected)."],
          );
        }
        return {
          provider: this.id,
          model: this.model,
          available: true,
          notes: [`Ollama request failed (${res.status}) — using heuristics.`],
        };
      }

      const responseBody = await res.json() as { response?: string };
      return toVisionResult(
        this.id,
        this.model,
        parseVisionJson(responseBody.response ?? ""),
        [input.imageBase64 ? "Ollama vision enrichment applied." : "Ollama metadata enrichment applied (no image bytes)."],
      );
    } catch (error) {
      return {
        provider: this.id,
        model: this.model,
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
