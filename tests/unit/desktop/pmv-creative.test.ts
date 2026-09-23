import { describe, expect, it } from "vitest";
import {
  DEFAULT_PMV_CREATIVE_DIRECTION,
  mapPmvModeToProduction,
  mapProductionToPmvMode,
  pmvModeLabel,
  scenesFromPlan,
  toneFromEnergy,
  customerSafeError,
  audioRequirementsFromDirection,
} from "../../../desktop/pmv-creative/index.ts";
import type { CreativePlanDto } from "../../../desktop/deep-intelligence/live-api.ts";

describe("PMV creative Step 3 helpers", () => {
  it("maps Exact Product to AI_PRODUCT_MOTION by default", () => {
    const direction = DEFAULT_PMV_CREATIVE_DIRECTION();
    expect(direction.generationMode).toBe("EXACT_PRODUCT");
    expect(mapPmvModeToProduction("EXACT_PRODUCT")).toBe("AI_PRODUCT_MOTION");
    expect(mapPmvModeToProduction("CINEMATIC")).toBe("CINEMATIC_3D");
    expect(mapPmvModeToProduction("ADVANCED_CREATIVE")).toBe("CLASSIC_SHOWCASE");
    expect(mapProductionToPmvMode("AI_PRODUCT_MOTION")).toBe("EXACT_PRODUCT");
    expect(pmvModeLabel("EXACT_PRODUCT")).toMatch(/Exact/i);
  });

  it("derives creative tone from energy and goal", () => {
    expect(toneFromEnergy("calm", "product_showcase")).toBe("Minimal");
    expect(toneFromEnergy("energetic", "drive_orders")).toBe("Energetic");
    expect(toneFromEnergy("balanced", "promo_offer")).toBe("Energetic");
  });

  it("builds storyboard views from creative plan scenes", () => {
    const plan = {
      id: "plan-1",
      projectId: "p1",
      version: 1,
      createdAt: "",
      modifiedAt: "",
      creativeBrief: "",
      creativeStrategy: "",
      marketingStrategy: "",
      scenes: [
        {
          id: "s1",
          order: 1,
          durationSeconds: 4,
          purpose: "Hook",
          visual: "Product hero",
          narration: "",
          camera: "close-up",
          lighting: "",
          composition: "",
          animation: "slow-zoom",
          text: "Meet the product",
          assetId: "a1",
        },
      ],
    } as CreativePlanDto;
    const scenes = scenesFromPlan(plan);
    expect(scenes).toHaveLength(1);
    expect(scenes[0]?.purpose).toBe("Hook");
    expect(scenes[0]?.status).toBe("PLANNED");
  });

  it("sanitizes customer-facing generation errors", () => {
    expect(customerSafeError("Ollama model wan-2.2 missing API key")).toMatch(/unavailable/i);
    expect(customerSafeError("Missing plan")).toBe("Missing plan");
  });

  it("prepares Step 4 audio requirements from creative direction", () => {
    const direction = DEFAULT_PMV_CREATIVE_DIRECTION();
    direction.energy = "energetic";
    direction.voicePreference = "Short narration";
    const audio = audioRequirementsFromDirection(direction);
    expect(audio.tempo).toBe("fast");
    expect(audio.narrationRequired).toBe(true);
    expect(audio.audioPurpose).toMatch(/Step 4/i);
  });
});
