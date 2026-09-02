/**
 * Optional local Ollama vision provider — only used when Ollama is installed and reachable.
 * Does not install models; fails safely when unavailable.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { VisionCapability, VisionAnalysisInput, VisionAnalysisResult, VisionProvider } from "./vision-capabilities.js";

const execFileAsync = promisify(execFile);

const DEFAULT_MODEL = process.env.KWIZERA_OLLAMA_VISION_MODEL ?? "llava";

export class OllamaVisionProvider implements VisionProvider {
  readonly id = "ollama";
  readonly capabilities: VisionCapability[] = ["image-understanding", "structured-json", "product-reasoning"];

  private baseUrl: string;
  private model: string;

  constructor(opts?: { baseUrl?: string; model?: string }) {
    this.baseUrl = (opts?.baseUrl ?? process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434").replace(/\/$/, "");
    this.model = opts?.model ?? DEFAULT_MODEL;
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (process.platform === "win32") {
        await execFileAsync("where", ["ollama"], { timeout: 3000 });
      } else {
        await execFileAsync("which", ["ollama"], { timeout: 3000 });
      }
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(4000) });
      return res.ok;
    } catch {
      return false;
    }
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
      ].filter(Boolean).join("\n");

      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(60_000),
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          format: "json",
        }),
      });

      if (!res.ok) {
        return {
          provider: this.id,
          model: this.model,
          available: true,
          notes: [`Ollama request failed (${res.status}) — using heuristics.`],
        };
      }

      const body = await res.json() as { response?: string };
      const parsed = parseVisionJson(body.response ?? "");
      return {
        provider: this.id,
        model: this.model,
        available: true,
        views: parsed.view ? [{ view: parsed.view, confidence: clamp(parsed.viewConfidence) }] : undefined,
        dominantColors: parsed.dominantColors,
        backgroundType: parsed.backgroundType
          ? { type: parsed.backgroundType, confidence: clamp(parsed.backgroundConfidence) }
          : undefined,
        productCategory: parsed.category
          ? { category: parsed.category, confidence: clamp(parsed.categoryConfidence) }
          : undefined,
        notes: ["Ollama vision enrichment applied."],
      };
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

function clamp(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function parseVisionJson(text: string): Record<string, unknown> {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return {};
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return {};
  }
}
