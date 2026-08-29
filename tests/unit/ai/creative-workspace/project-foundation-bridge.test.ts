import { describe, expect, it } from "vitest";
import { linkProjectFoundation } from "../../../../ai/creative-workspace/project-foundation-bridge.js";
import type { CreativeProject } from "../../../../ai/creative-workspace/creative-workspace-manager.js";

describe("STEP 5 Memory/Knowledge foundation bridge", () => {
  it("records unavailable links without failing when engines are not ready", async () => {
    const project = {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      name: "Bridge Probe",
      createdAt: "2026-01-01T00:00:00.000Z",
      modifiedAt: "2026-01-01T00:00:00.000Z",
      productImages: [],
      productInformation: { name: "", category: "", description: "" },
      brandInformation: { name: "" },
      campaignInformation: { name: "", objective: "" },
      targetAudience: "",
      language: "en",
      platform: "instagram",
      workspaceSettings: {},
    } as CreativeProject;

    const links = await linkProjectFoundation(project, null, "create");
    expect(links.memoryStatus).toBe("unavailable");
    expect(links.knowledgeStatus).toBe("unavailable");
    expect(links.knowledgeScope).toBe("project");
    expect(links.memoryId).toBeNull();
  });
});
