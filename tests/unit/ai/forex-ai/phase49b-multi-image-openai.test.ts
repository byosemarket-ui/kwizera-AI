/**
 * Phase 49B — Multi-image selection, confirmation, vision policy.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  MULTI_IMAGE_MAX_CAPTURES,
  computeSelectionFingerprint,
  isOpenAiVisionEligibleModel,
  validateCaptureIdList,
  visionCapabilityNote,
} from "../../../../ai/forex-ai/multi-image-openai/index.ts";
import { buildOpenAiMultimodalChatJsonBody } from "../../../../ai/forex-ai/snapshot-openai/openai-client.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 49B vision policy", () => {
  it("allows gpt-4o / gpt-6 family and rejects gpt-3.5", () => {
    expect(isOpenAiVisionEligibleModel("gpt-4o")).toBe(true);
    expect(isOpenAiVisionEligibleModel("gpt-4.1-mini")).toBe(true);
    expect(isOpenAiVisionEligibleModel("gpt-6-luna")).toBe(true);
    expect(isOpenAiVisionEligibleModel("gpt-5.2")).toBe(true);
    expect(isOpenAiVisionEligibleModel("gpt-3.5-turbo")).toBe(false);
    expect(visionCapabilityNote("gpt-3.5-turbo")).toMatch(/not eligible/i);
  });
});

describe("Phase 49B selection fingerprint", () => {
  it("normalizes order and enforces max image count", () => {
    const a = computeSelectionFingerprint(["b", "a"]);
    const b = computeSelectionFingerprint(["a", "b"]);
    expect(a).toBe(b);
    expect(validateCaptureIdList([]).ok).toBe(false);
    expect(validateCaptureIdList(["one"]).ok).toBe(true);
    const tooMany = Array.from({ length: MULTI_IMAGE_MAX_CAPTURES + 1 }, (_, i) => `id-${i}`);
    expect(validateCaptureIdList(tooMany).ok).toBe(false);
  });
});

describe("Phase 49B multimodal request body", () => {
  it("includes image_url parts and does not strip images", () => {
    const body = buildOpenAiMultimodalChatJsonBody({
      model: "gpt-4o",
      system: "sys",
      userText: "user",
      images: [{ mimeType: "image/png", base64: "AAAA" }],
    });
    const messages = body.messages as Array<{ role: string; content: unknown }>;
    expect(messages[0].role).toBe("system");
    const user = messages[1].content as Array<{ type: string }>;
    expect(user.some((p) => p.type === "text")).toBe(true);
    expect(user.some((p) => p.type === "image_url")).toBe(true);
  });
});

describe("Phase 49B wiring contracts", () => {
  it("requires confirmed=true and wires review UI without auto-send", () => {
    const engine = read("ai/forex-ai/multi-image-openai/engine.ts");
    expect(engine).toContain("CONFIRMATION_REQUIRED");
    expect(engine).toContain("raw.confirmed !== true");
    expect(engine).toContain("SELECTION_CHANGED");

    const api = read("dev/server/forex-ai-openai-snapshot-api.ts");
    expect(api).toContain("/api/forex/ai-analysis/openai/multi-image/review");
    expect(api).toContain("confirmed: body.confirmed === true");

    const panel = read("desktop/forex/capture-library/MultiImageAnalysisPanel.tsx");
    expect(panel).toContain("Confirm & Send to OpenAI");
    expect(panel).toContain("confirmed: true");
    expect(panel).toContain("Selection changed");
    expect(panel).toContain("will be transmitted to the configured OpenAI service");

    const page = read("desktop/forex/ForexAiAnalysisPage.tsx");
    expect(page).toContain("ForexCaptureLibrary");
    expect(page).toContain("MultiImageAnalysisPanel");

    const library = read("desktop/forex/capture-library/ForexCaptureLibrary.tsx");
    expect(library).toContain("Delete capture");
    expect(library).toContain("Deselect does not delete");
    expect(library).toContain("Loading preview image");
    expect(library).toContain("onLoad");
    expect(library).toContain("onError");
    expect(library).toContain("naturalWidth");

    const captureApi = read("dev/server/forex-chart-capture-api.ts");
    expect(captureApi).toMatch(/imageSubmissionImplemented:\s*true/);
    expect(captureApi).toContain("requiresExplicitConfirm: true");

    // Phase 49C additive contracts remain compatible with 49B confirmation gate.
    const prompts = read("ai/forex-ai/multi-image-openai/prompts.ts");
    expect(prompts).toContain("mtfReasoning");
    expect(read("ai/forex-ai/multi-image-openai/limits.ts")).toContain(
      "forex-openai-multi-image-analysis-v2",
    );
  });
});
