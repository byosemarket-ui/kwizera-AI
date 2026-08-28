import { describe, expect, it } from "vitest";
import { deriveProjectStatus, resolveActiveProjectName } from "../../../desktop/shell/project-context.ts";
import { QUICK_ACTIONS } from "../../../desktop/shell/navigation/navigation-engine.ts";
import { getSidebarNavByGroup } from "../../../desktop/shell/workspace-registry.ts";
import { primaryAiMeRecommendation } from "../../../desktop/shell/aime-awareness.ts";
import { defaultShellLayout } from "../../../desktop/shell/layout-store.ts";
import { buildAiMeWorkspaceContext } from "../../../desktop/shell/aime-awareness.ts";

describe("STEP 4 project context", () => {
  it("treats API sentinels as no active project", () => {
    expect(resolveActiveProjectName("No active project")).toBeNull();
    expect(resolveActiveProjectName("")).toBeNull();
    expect(resolveActiveProjectName("ddd")).toBe("ddd");
  });

  it("does not mark production active just because a name string exists", () => {
    expect(deriveProjectStatus(null, 0)).toBe("idle");
    expect(deriveProjectStatus("ddd", 0)).toBe("draft");
    expect(deriveProjectStatus("ddd", 2)).toBe("in-production");
  });
});

describe("STEP 4 navigation wiring", () => {
  it("routes generate/import actions to live workspaces", () => {
    const byId = Object.fromEntries(QUICK_ACTIONS.map((action) => [action.id, action]));
    expect(byId["new-project"].workspace).toBe("new-project");
    expect(byId["import-images"].workspace).toBe("new-project");
    expect(byId["analyze-product"].workspace).toBe("deep-intelligence");
    expect(byId["generate-images"].workspace).toBe("image-organization");
    expect(byId["generate-video"].workspace).toBe("storyboard");
  });

  it("keeps Core items reachable in the sidebar", () => {
    const core = getSidebarNavByGroup().find((g) => g.label === "Core");
    expect(core?.items.map((item) => item.id)).toEqual([
      "home", "ai-me", "new-project", "open-project", "production",
    ]);
  });
});

describe("STEP 4 AI Me recommendation", () => {
  it("asks for a project when none is selected", () => {
    const context = buildAiMeWorkspaceContext(defaultShellLayout, {
      aiCore: true,
      workflowEngine: true,
      communicationBus: true,
      moduleManager: true,
      memoryFoundation: true,
      knowledgeFoundation: true,
      activeProject: "",
    });
    expect(primaryAiMeRecommendation(context)).toMatch(/project/i);
  });
});
