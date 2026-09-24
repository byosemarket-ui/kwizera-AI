/**
 * Tries vision providers in order — online Admin runtime first, then local fallbacks.
 */
import type { VisionAnalysisInput, VisionAnalysisResult, VisionCapability, VisionProvider } from "./vision-capabilities.js";

export class CascadingVisionProvider implements VisionProvider {
  readonly id = "cascading";
  readonly capabilities: VisionCapability[];

  constructor(private readonly providers: VisionProvider[]) {
    const caps = new Set<VisionCapability>();
    for (const provider of providers) {
      for (const cap of provider.capabilities) caps.add(cap);
    }
    this.capabilities = [...caps];
  }

  async isAvailable(): Promise<boolean> {
    for (const provider of this.providers) {
      if (await provider.isAvailable()) return true;
    }
    return false;
  }

  async analyzeImage(input: VisionAnalysisInput): Promise<VisionAnalysisResult> {
    const notes: string[] = [];
    for (const provider of this.providers) {
      try {
        if (!(await provider.isAvailable())) {
          notes.push(`${provider.id}: unavailable`);
          continue;
        }
        const result = await provider.analyzeImage(input);
        if (result.available) {
          return {
            ...result,
            notes: [...(result.notes ?? []), ...notes],
          };
        }
        notes.push(...(result.notes ?? [`${provider.id}: analysis unavailable`]));
      } catch (error) {
        notes.push(
          `${provider.id}: ${error instanceof Error ? error.message : "vision provider error"}`,
        );
      }
    }
    return {
      provider: this.id,
      model: null,
      available: false,
      source: "UNAVAILABLE",
      notes: notes.length
        ? notes
        : ["No vision provider available — deterministic image intelligence remains authoritative."],
    };
  }
}
