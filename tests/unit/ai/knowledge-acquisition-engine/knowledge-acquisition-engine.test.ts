import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AiCore, createAiCore, KnowledgeStorageType } from "@ai";

describe("AiKnowledgeAcquisitionEngine", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-knowledge-acquisition-test-"));
  });

  afterEach(() => {
    AiCore.resetInstance();
    fs.rmSync(storageRoot, { recursive: true, force: true });
  });

  it("builds a structured approval preview and imports only after approval", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-acquisition-test");
    const foundation = core.getManager().knowledgeFoundation!;
    const acquisition = foundation.getKnowledgeAcquisitionEngine();

    const preview = await acquisition.prepare({
      topic: "Product Photography",
      sources: [
        {
          type: "official-documentation",
          name: "Studio lighting guide",
          reference: "local://lighting-guide.md",
          content: "Always diffuse a key light for reflective products. Use a tripod to keep product images sharp. Avoid mixed color temperatures. Workflow: first clean the product, then set the key light, then capture a bracketed exposure. Example: photograph a glass bottle against a controlled background.",
        },
      ],
    });

    expect(preview.status).toBe("pending-approval");
    expect(preview.rules).toContain("Always diffuse a key light for reflective products.");
    expect(foundation.getStorageEngine().getRecordCount()).toBe(0);

    const imported = await acquisition.approve(preview.requestId, KnowledgeStorageType.Technical);

    expect(imported.imported).toBe(true);
    expect(imported.knowledgeId).toBeTruthy();
    expect(foundation.getStorageEngine().getRecordCount()).toBe(1);
    const stored = await foundation.getStorageEngine().getRecord(imported.knowledgeId!);
    expect(stored.record?.payload).toMatchObject({
      domain: "technical",
      concepts: expect.any(Array),
      decisionRules: expect.any(Array),
      workflowSteps: expect.any(Array),
      sourceMetadata: expect.any(Array),
    });
    await core.stop();
  });

  it("rejects acquisition without usable source content", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-acquisition-test");
    const preview = await core.getManager().knowledgeFoundation!.getKnowledgeAcquisitionEngine().prepare({ topic: "Color Theory" });

    expect(preview.status).toBe("rejected");
    expect(preview.rejectionReasons).toContain("No approved or local source content was supplied.");
    await core.stop();
  });

  it("classifies professional video learning topics into the video knowledge domain", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-acquisition-test");

    const preview = await core.getManager().knowledgeFoundation!.getKnowledgeAcquisitionEngine().prepare({
      topic: "Cinematic Camera Movement",
      sources: [{ type: "technical-manual", name: "Camera manual", content: "Always use a controlled dolly movement for a cinematic product reveal. Workflow: first stabilize the camera, then rehearse the movement." }],
    });

    expect(preview.knowledgeType).toBe(KnowledgeStorageType.Video);
    await core.stop();
  });
});