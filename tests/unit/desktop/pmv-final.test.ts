import { describe, expect, it } from "vitest";
import {
  energyLabel,
  mapIntelligence,
  mapLibraryItem,
  produceStageLabel,
  resolveStageByProgress,
} from "../../../desktop/pmv-final/index.ts";

describe("PMV final Step 4 helpers", () => {
  it("maps audio library items without exposing provider metadata", () => {
    const item = mapLibraryItem({
      assetId: "a1",
      title: "Shop Beat",
      durationMs: 15000,
      playbackUrl: "/api/audio/a1",
      status: "READY",
      metadata: { bpm: 118, bpmConfidence: 0.82, analysisStatus: "READY", provider: "secret-provider" },
    });
    expect(item.assetId).toBe("a1");
    expect(item.bpm).toBe(118);
    expect(item).not.toHaveProperty("provider");
    expect(JSON.stringify(item)).not.toMatch(/secret-provider|api.?key/i);
  });

  it("maps audio intelligence summary", () => {
    const intel = mapIntelligence({
      status: "READY",
      bpm: 120,
      bpmConfidence: 0.9,
      beats: [0, 0.5, 1],
      meanEnergy: 0.4,
    });
    expect(intel?.beatCount).toBe(3);
    expect(intel?.energyLabel).toBe("Medium");
    expect(energyLabel(0.1)).toBe("Low");
  });

  it("resolves produce stage labels from progress", () => {
    expect(produceStageLabel(0, "NOT_STARTED")).toMatch(/Audio/i);
    expect(produceStageLabel(100, "FINAL_READY")).toMatch(/ready/i);
    expect(produceStageLabel(50, "RENDERING")).toBe(resolveStageByProgress(50).label);
    expect(produceStageLabel(0, "FAILED")).toMatch(/failed/i);
  });
});
