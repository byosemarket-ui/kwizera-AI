import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AiWorkspaceManagerEngine } from "../../../../ai/workspace-manager/index.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map(async (root) => {
      try {
        await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {
        /* ignore */
      }
    }),
  );
});

describe("AiWorkspaceManagerEngine (Platform Step 6)", () => {
  it("registers modules uniquely, recovers sessions, organizes outputs, backs up config", () => {
    const root = path.join(os.tmpdir(), `kwizera-wm-${Date.now()}`);
    roots.push(root);
    const engine = new AiWorkspaceManagerEngine();
    engine.initialize(root);

    expect(engine.getModules()).toHaveLength(13);
    const count = engine.getModules().length;
    engine.registerModule("knowledge-foundation");
    expect(engine.getModules()).toHaveLength(count);

    engine.markModuleFailed("image-generation", "boom");
    expect(engine.restartModule("image-generation")?.health).toBe("healthy");

    const session = engine.startSession("p1");
    engine.endSession(session.sessionId);
    expect(engine.resumeSession(session.sessionId)?.openProjects).toContain("p1");

    const out = engine.organizeOutput("generated-images", "a.png", "x");
    expect(out).toContain("generated-images");

    engine.setConfig("ai", "mode", "fast");
    engine.setConfig("ai", "mode", "quality");
    expect(engine.getConfig("ai").mode).toBe("quality");

    expect(engine.getAiMeAwareness().studioMonitoringSecurityDeferred).toBe(true);
    expect(engine.runQualityAssurance().criticalIssues).toHaveLength(0);
  });
});
