/**
 * Tries creative reasoning providers in order — Admin online first, then local.
 */
import type { AiCreativePlannerInput, CreativeReasoningProvider } from "./ai-creative-planner.js";

export class CascadingCreativeReasoningProvider implements CreativeReasoningProvider {
  readonly id = "cascading-creative-director";
  private lastModel: string | null = null;
  private lastProviderId: string | null = null;

  constructor(private readonly providers: CreativeReasoningProvider[]) {}

  getLastModel(): string | null {
    return this.lastModel;
  }

  getLastProviderId(): string | null {
    return this.lastProviderId;
  }

  async isAvailable(): Promise<boolean> {
    for (const provider of this.providers) {
      if (await provider.isAvailable()) return true;
    }
    return false;
  }

  async planCreativeScenes(input: AiCreativePlannerInput): Promise<unknown> {
    const errors: string[] = [];
    for (const provider of this.providers) {
      try {
        if (!(await provider.isAvailable())) {
          errors.push(`${provider.id}: unavailable`);
          continue;
        }
        const result = await provider.planCreativeScenes(input);
        this.lastProviderId = provider.id;
        this.lastModel = provider.getLastModel?.() ?? null;
        return result;
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code)
          : undefined;
        const message = error instanceof Error ? error.message : "provider error";
        errors.push(`${provider.id}: ${code ? `${code}: ` : ""}${message}`);
        // Non-retryable for this provider — try next cascade member.
        continue;
      }
    }
    throw Object.assign(
      new Error(errors.length ? errors.join(" | ") : "No creative reasoning provider available"),
      { code: "OLLAMA_UNAVAILABLE" },
    );
  }
}
