import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AiCore, createAiCore } from "@ai";

const TEST_TIMEOUT_MS = 1_200_000;

describe("Professional Reasoning & Decision Certification (Step 8)", () => {
  let storageRoot: string;
  let core: ReturnType<typeof createAiCore>;

  beforeAll(async () => {
    storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-professional-reasoning-cert-"));
    core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("professional-reasoning-cert-test");
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    await core.stop();
    AiCore.resetInstance();
    fs.rmSync(storageRoot, { recursive: true, force: true });
  }, 120_000);

  it(
    "certifies the professional reasoning chain and keeps next phase disabled",
    async () => {
      const engine = core.getManager().professionalReasoningCertification!;
      const awareness = engine.getAiMeProfessionalReasoningCertificationAwareness();
      expect(awareness.enabled).toBe(true);
      expect(awareness.nextDevelopmentPhaseEnabled).toBe(false);

      const result = await engine.certify({ autoRepair: true });
      expect(result.version).toBe("1.0");
      expect(Object.values(result.capabilities).every((item) => item.status === "passed")).toBe(true);
      expect(result.scenarios.length).toBe(8);
      expect(result.scenarios.filter((item) => item.passed).length).toBeGreaterThanOrEqual(7);
      expect(result.systemHealth.professionalReadinessScore).toBeGreaterThanOrEqual(70);
      expect(result.aiMeAnswers.canThinkProfessionally).toBe(true);
      expect(result.aiMeAnswers.canMakeExplainableDecisions).toBe(true);
      expect(result.certified).toBe(result.aiMeAnswers.isVersionOneComplete);
      expect(fs.existsSync(result.verificationPath)).toBe(true);
      expect(core.getManager().selfReviewEngine!.getAiMeProfessionalSelfReviewAwareness().professionalReasoningCertificationEnabled).toBe(true);
    },
    TEST_TIMEOUT_MS
  );
});
