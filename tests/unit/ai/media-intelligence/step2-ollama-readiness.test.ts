import { describe, expect, it } from "vitest";
import { UnconfiguredVisionProvider } from "../../../../ai/ai-provider/vision-capabilities.js";
import { assessOllamaReadiness } from "../../../../ai/media-intelligence/ollama-readiness.js";

describe("AI provider vision capabilities", () => {
  it("returns unavailable without crashing when unconfigured", async () => {
    const provider = new UnconfiguredVisionProvider();
    expect(await provider.isAvailable()).toBe(false);
    const result = await provider.analyzeImage({
      projectId: "p",
      assetId: "a",
      mimeType: "image/png",
      fileName: "x.png",
    });
    expect(result.available).toBe(false);
    expect(result.notes.length).toBeGreaterThan(0);
  });
});

describe("Ollama readiness assessment", () => {
  it("assesses resources without installing Ollama", async () => {
    const report = await assessOllamaReadiness();
    expect(report.cpuCores).toBeGreaterThan(0);
    expect(report.totalMemoryGb).toBeGreaterThan(0);
    expect(["defer", "install-small-model", "insufficient-resources"]).toContain(report.recommendedAction);
  });
});
