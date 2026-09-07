import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const fetchOllamaTags = vi.fn();
const ollamaGenerateJson = vi.fn();
const isOllamaDisabled = vi.fn(() => false);

vi.mock("../../../../ai/ai-provider/ollama-client.js", () => ({
  fetchOllamaTags: (...args: unknown[]) => fetchOllamaTags(...args),
  ollamaGenerateJson: (...args: unknown[]) => ollamaGenerateJson(...args),
  isOllamaDisabled: () => isOllamaDisabled(),
  ollamaBaseUrl: () => "http://127.0.0.1:11434",
  ollamaTimeoutMs: () => 30_000,
  preferredReasoningModelId: () => "llama3.2:1b",
  preferredVisionModelId: () => "llava",
  selectPreferredReasoningModel: (models: Array<{ name: string }>, preferred: string) =>
    models.find((m) => m.name === preferred)?.name
    ?? models.find((m) => m.name.includes("llama"))?.name
    ?? null,
  parseJsonObject: (text: string) => {
    try {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start < 0 || end < 0) return null;
      return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      return null;
    }
  },
}));

import { resetOllamaAdapterForTests } from "../../../../ai/ai-provider/ollama-adapter.js";
import {
  probeCapabilityMatrix,
  probeMinimalInference,
} from "../../../../ai/ai-provider/ollama-capability-probe.js";

describe("Ollama capability probe", () => {
  beforeEach(() => {
    resetOllamaAdapterForTests();
    isOllamaDisabled.mockReturnValue(false);
    fetchOllamaTags.mockResolvedValue({
      ok: true,
      status: "READY",
      models: [{ name: "llama3.2:1b", size: 1 }],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("minimal inference succeeds with structured JSON", async () => {
    ollamaGenerateJson.mockResolvedValue({
      ok: true,
      text: '{"status":"ok"}',
    });
    const result = await probeMinimalInference();
    expect(result.verdict).toBe("SUCCESS");
    expect(result.structuredOk).toBe(true);
    expect(result.kwizeraCanConsume).toBe(true);
  });

  it("marks multimodal as MODEL_LIMITATION for text-only install", async () => {
    ollamaGenerateJson.mockResolvedValue({
      ok: true,
      text: '{"status":"ok"}',
    });
    const matrix = await probeCapabilityMatrix({ includeHeavy: false });
    expect(matrix.multimodal.verdict).toBe("MODEL_LIMITATION");
    expect(matrix.multimodal.detail).toMatch(/text-only|Image Intelligence/i);
  });

  it("classifies timeout as RESOURCE_LIMITATION", async () => {
    ollamaGenerateJson.mockResolvedValue({
      ok: false,
      error: "The operation was aborted due to timeout",
      code: "MODEL_TIMEOUT",
    });
    const result = await probeMinimalInference();
    expect(result.verdict).toBe("RESOURCE_LIMITATION");
  });
});
