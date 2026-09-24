/**
 * Admin-routed vision provider — Product Intelligence requests VISION_ANALYSIS.
 * Credentials and provider/model selection stay in the Admin Control Plane.
 */
import type { CapabilityRuntime } from "../admin-control-plane/capability-runtime.js";
import type {
  VisionAnalysisInput,
  VisionAnalysisResult,
  VisionCapability,
  VisionProvider,
} from "./vision-capabilities.js";
import { buildVisionAnalysisPrompt, normalizeVisionModelOutput } from "./vision-normalize.js";

export type CapabilityRuntimeFactory = () => CapabilityRuntime | null;

export class AdminRuntimeVisionProvider implements VisionProvider {
  readonly id = "admin-runtime";
  readonly capabilities: VisionCapability[] = [
    "image-understanding",
    "structured-json",
    "product-reasoning",
  ];

  constructor(private readonly getRuntime: CapabilityRuntimeFactory) {}

  async isAvailable(): Promise<boolean> {
    const runtime = this.getRuntime();
    if (!runtime) return false;
    const view = runtime.describe("VISION_ANALYSIS");
    return (view.status === "READY" || view.status === "FALLBACK") && view.source === "ONLINE";
  }

  async analyzeImage(input: VisionAnalysisInput): Promise<VisionAnalysisResult> {
    const runtime = this.getRuntime();
    if (!runtime) {
      return {
        provider: this.id,
        model: null,
        available: false,
        source: "CONFIGURATION_ERROR",
        notes: ["Admin capability runtime is not available"],
      };
    }

    const view = runtime.describe("VISION_ANALYSIS");
    if (view.source !== "ONLINE" || (view.status !== "READY" && view.status !== "FALLBACK")) {
      return {
        provider: this.id,
        model: view.modelId,
        available: false,
        source: view.status === "UNAVAILABLE" ? "UNAVAILABLE" : "CONFIGURATION_ERROR",
        notes: [
          view.reason
            ? `VISION_ANALYSIS not ready for online execution: ${view.reason}`
            : "VISION_ANALYSIS is not mapped to an online executable provider",
        ],
      };
    }

    if (!input.imageBase64) {
      return {
        provider: this.id,
        model: view.modelId,
        available: false,
        source: "CONFIGURATION_ERROR",
        notes: ["Product image bytes were not available for online vision analysis"],
      };
    }

    const result = await runtime.execute("VISION_ANALYSIS", {
      mode: "vision",
      prompt: buildVisionAnalysisPrompt({
        userProductName: input.userProductName,
        userCategory: input.userCategory,
        fileName: input.fileName,
      }),
      images: [
        {
          mimeType: input.mimeType || "image/jpeg",
          base64: input.imageBase64,
        },
      ],
      projectId: input.projectId,
      timeoutMs: Math.min(90_000, Math.max(15_000, view.timeoutMs ?? 60_000)),
    });

    if (!result.ok) {
      const source =
        result.errorCode === "AUTHENTICATION_FAILED"
          ? "UNAVAILABLE"
          : result.errorCode === "CONFIGURATION_ERROR" || result.errorCode === "NOT_IMPLEMENTED"
            ? "CONFIGURATION_ERROR"
            : "UNAVAILABLE";
      return {
        provider: result.providerType ?? this.id,
        model: result.modelId,
        available: false,
        source,
        notes: [
          result.errorMessage
            ? `Online vision failed: ${result.errorMessage}`
            : `Online vision failed (${result.errorCode ?? "UNKNOWN"})`,
        ],
      };
    }

    return normalizeVisionModelOutput({
      provider: result.providerType ?? this.id,
      model: result.modelId,
      outputText: result.outputText,
      source: "ONLINE",
      notes: [
        `Online vision via Admin VISION_ANALYSIS (${result.providerId ?? "provider"} / ${result.modelId ?? "model"})`,
      ],
    });
  }
}
