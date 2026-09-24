/**
 * Admin-routed Creative Director — CREATIVE_REASONING via CapabilityRuntime.
 * Never reads provider secrets; never calls OpenAI/Google/etc. directly.
 */
import type { CapabilityRuntime } from "../admin-control-plane/capability-runtime.js";
import { parseJsonObject } from "../ai-provider/ollama-client.js";
import type {
  AiCreativePlannerInput,
  CreativeReasoningProvider,
} from "./ai-creative-planner.js";
import {
  buildCreativeDirectorContext,
  buildCreativeDirectorSystemInstructions,
  buildCreativeDirectorUserPrompt,
} from "./creative-director-prompt.js";

export type CapabilityRuntimeFactory = () => CapabilityRuntime | null;

export class AdminRuntimeCreativeReasoningProvider implements CreativeReasoningProvider {
  readonly id = "admin-runtime-creative-director";
  private lastModel: string | null = null;

  constructor(private readonly getRuntime: CapabilityRuntimeFactory) {}

  getLastModel(): string | null {
    return this.lastModel;
  }

  async isAvailable(): Promise<boolean> {
    const runtime = this.getRuntime();
    if (!runtime) return false;
    const view = runtime.describe("CREATIVE_REASONING");
    return (view.status === "READY" || view.status === "FALLBACK") && view.source === "ONLINE";
  }

  async planCreativeScenes(input: AiCreativePlannerInput): Promise<unknown> {
    const runtime = this.getRuntime();
    if (!runtime) {
      throw Object.assign(new Error("Admin capability runtime is not available"), {
        code: "CONFIGURATION_ERROR",
      });
    }

    const view = runtime.describe("CREATIVE_REASONING");
    if (view.source !== "ONLINE" || (view.status !== "READY" && view.status !== "FALLBACK")) {
      throw Object.assign(
        new Error(view.reason ?? "CREATIVE_REASONING is not mapped to an online executable provider"),
        { code: "CONFIGURATION_ERROR" },
      );
    }

    const context = await buildCreativeDirectorContext(input);
    const assetIds = Array.isArray(context.assetIds) ? context.assetIds as string[] : [];
    if (!context.projectId || assetIds.length === 0) {
      throw Object.assign(new Error("PROJECT_CONTEXT_MISSING"), { code: "PROJECT_CONTEXT_MISSING" });
    }

    const result = await runtime.execute("CREATIVE_REASONING", {
      mode: "chat",
      messages: [
        { role: "system", content: buildCreativeDirectorSystemInstructions() },
        { role: "user", content: buildCreativeDirectorUserPrompt(context) },
      ],
      projectId: input.project.id,
      timeoutMs: Math.min(90_000, Math.max(20_000, view.timeoutMs ?? 60_000)),
    });

    this.lastModel = result.modelId ?? null;

    if (!result.ok) {
      const code = result.errorCode === "AUTHENTICATION_FAILED"
        ? "AUTHENTICATION_FAILED"
        : result.errorCode === "TIMEOUT"
          ? "MODEL_TIMEOUT"
          : result.errorCode === "NOT_IMPLEMENTED"
            ? "NOT_IMPLEMENTED"
            : "CONFIGURATION_ERROR";
      throw Object.assign(
        new Error(result.errorMessage ?? `Online creative reasoning failed (${result.errorCode ?? "UNKNOWN"})`),
        { code },
      );
    }

    const parsed = parseJsonObject(result.outputText ?? "");
    if (!parsed) {
      throw Object.assign(new Error("INVALID_AI_OUTPUT"), { code: "INVALID_AI_OUTPUT" });
    }

    if (typeof parsed.projectId === "string" && parsed.projectId && parsed.projectId !== context.projectId) {
      throw Object.assign(new Error("AI plan projectId mismatch"), { code: "INVALID_AI_OUTPUT" });
    }

    // Stamp projectId for validators when the model omits it.
    if (!parsed.projectId) parsed.projectId = context.projectId;
    return parsed;
  }
}
