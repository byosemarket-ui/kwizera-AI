/**
 * STEP 12 — Final Review workspace integration helpers and READY gates.
 */
import { describe, expect, it } from "vitest";
import {
  displayProductionProgress,
  isProductionOutputReady,
  resolveStageByProgress,
  withOutputCacheBust,
} from "../../../../desktop/final-review/final-review-engine.js";
import { getWorkspaceIntegrationDiagnostics } from "../../../../ai/video-production/production-capabilities.js";
import { VIDEO_PRODUCTION_VERSION } from "../../../../ai/video-production/types.js";
import type { VideoProject } from "../../../../ai/video-production/types.js";

describe("STEP 12 workspace integration", () => {
  it("versions and diagnostics advertise STEP 12 workspace finalization", () => {
    expect(VIDEO_PRODUCTION_VERSION).toBe("step12-workspace-final-v1");
    const diag = getWorkspaceIntegrationDiagnostics();
    expect(diag.workspaceIntegrationAvailable).toBe(true);
    expect(diag.readyGate).toContain("validated");
    expect(diag.duplicateRenderProtection).toContain("409");
    expect(diag.rangeServing).toBe(true);
  });

  it("progress stays below 100 until verified and reaches 100 after", () => {
    expect(displayProductionProgress({
      verified: false,
      uiStage: "rendering",
      jobProgress: 100,
      localProgress: 100,
    })).toBeLessThan(100);
    expect(displayProductionProgress({
      verified: false,
      uiStage: "awaiting-output",
      jobProgress: 100,
      localProgress: 95,
    })).toBeLessThanOrEqual(95);
    expect(displayProductionProgress({
      verified: true,
      uiStage: "completed",
      jobProgress: 100,
      localProgress: 100,
    })).toBe(100);
  });

  it("stage checklist resolves by highest matching progress threshold", () => {
    expect(resolveStageByProgress(0).id).toBe("preparing-project");
    expect(resolveStageByProgress(45).id).toBe("rendering");
    expect(resolveStageByProgress(80).id).toBe("end-card");
    expect(resolveStageByProgress(88).id).toBe("verifying-output");
    expect(resolveStageByProgress(100).id).toBe("complete");
  });

  it("cache-busts output URLs with asset identity", () => {
    const url = withOutputCacheBust("/api/workspace/projects/p1/videos/a1.mp4", {
      assetId: "a1",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(url).toContain("?v=a1");
    expect(withOutputCacheBust(url, { assetId: "a1" })).toContain("&v=a1");
  });

  it("READY requires completed CURRENT output with URL", () => {
    const ready = {
      renderState: "completed",
      outputStatus: "CURRENT",
      output: {
        url: "/api/workspace/projects/p1/videos/x.mp4",
        validationStatus: "TECHNICALLY_VALIDATED",
      },
    } as VideoProject;
    expect(isProductionOutputReady(ready)).toBe(true);
    expect(isProductionOutputReady({
      ...ready,
      outputStatus: "OUTDATED",
    })).toBe(false);
    expect(isProductionOutputReady({
      ...ready,
      output: { ...ready.output!, validationStatus: "FAILED" },
    })).toBe(false);
    expect(isProductionOutputReady({
      ...ready,
      output: undefined,
    })).toBe(false);
  });
});
