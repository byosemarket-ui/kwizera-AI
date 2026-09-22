import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ALL_WORKSPACE_IDS } from "../../../desktop/shell/types.ts";
import { assertNavIconsComplete, NAV_ICONS } from "../../../desktop/shell/nav-icons.ts";
import { customerServiceRegistry } from "../../../desktop/customer-platform/index.ts";
import {
  AUDIO_SERVICE_STEPS,
  DESIGN_SERVICE_STEPS,
  DESIGN_TYPE_CATALOG,
  IMAGE_SERVICE_STEPS,
  PASSPORT_SERVICE_STEPS,
  VIDEO_SERVICE_STEPS,
} from "../../../desktop/customer-platform/workspace/index.ts";
import { getNavItem } from "../../../desktop/shell/workspace-registry.ts";

describe("Customer service workspace foundation", () => {
  it("registers customer service workspace ids with nav icons and labels", () => {
    for (const id of [
      "service-create-video",
      "service-product-marketing-video",
      "service-edit-photo",
      "service-passport",
      "service-design",
      "service-audio",
    ] as const) {
      expect(ALL_WORKSPACE_IDS).toContain(id);
      expect(NAV_ICONS[id]).toBeTruthy();
      expect(getNavItem(id).label.length).toBeGreaterThan(0);
    }
    expect(() => assertNavIconsComplete()).not.toThrow();
  });

  it("wires Create Video and Edit Photo to customer service workspaces", () => {
    expect(customerServiceRegistry.getService("create-video")?.workspace).toBe("service-create-video");
    expect(customerServiceRegistry.getService("product-marketing-video")?.workspace).toBe("service-product-marketing-video");
    expect(customerServiceRegistry.getService("edit-photo")?.workspace).toBe("service-edit-photo");
    expect(customerServiceRegistry.getService("remove-background")?.workspace).toBe("service-edit-photo");
    expect(customerServiceRegistry.getService("passport-photo")?.workspace).toBe("service-passport");
    expect(customerServiceRegistry.getService("design-studio")?.status).toBe("COMING_SOON");
    expect(customerServiceRegistry.getService("design-studio")?.workspace).toBeUndefined();
  });

  it("defines reusable step catalogs without inventing engine capabilities", () => {
    expect(VIDEO_SERVICE_STEPS.map((step) => step.id)).toEqual([
      "upload", "plan", "style", "create", "preview",
    ]);
    expect(IMAGE_SERVICE_STEPS.length).toBeGreaterThanOrEqual(3);
    expect(PASSPORT_SERVICE_STEPS[0]?.id).toBe("capture");
    expect(DESIGN_SERVICE_STEPS[0]?.id).toBe("choose");
    expect(AUDIO_SERVICE_STEPS[0]?.id).toBe("choose");
    expect(DESIGN_TYPE_CATALOG).toContain("Flyer");
  });

  it("routes customer service workspaces through WorkspaceRouter and reuses engines", () => {
    const router = fs.readFileSync(path.resolve("desktop/shell/WorkspaceRouter.tsx"), "utf8");
    expect(router).toContain("CreateVideoServiceWorkspace");
    expect(router).toContain("ProductMarketingVideoWorkspace");
    expect(router).toContain("EditPhotoServiceWorkspace");
    expect(router).toContain("PassportPhotoServiceWorkspace");
    expect(router).toContain("DesignStudioServiceWorkspace");
    expect(router).toContain("AudioServiceWorkspace");
    expect(router).toContain('case "service-create-video"');
    expect(router).toContain('case "service-product-marketing-video"');
    expect(router).not.toMatch(/AdminControlCenter/);

    const createVideo = fs.readFileSync(
      path.resolve("desktop/customer-platform/workspace/CreateVideoServiceWorkspace.tsx"),
      "utf8",
    );
    expect(createVideo).toContain("ProductSetupWorkspace");
    expect(createVideo).toContain('serviceKey: "create-video"');
    expect(createVideo).not.toMatch(/VideoProductionManager|FFmpeg/i);

    const pmv = fs.readFileSync(
      path.resolve("desktop/customer-platform/workspace/ProductMarketingVideoWorkspace.tsx"),
      "utf8",
    );
    expect(pmv).toContain('serviceKey: "product-marketing-video"');
    expect(pmv).toContain("productSetupEngine");
    expect(pmv).toContain("setHeroImage");
    expect(pmv).toContain("markReadyForIntelligence");
    expect(pmv).toContain("Brand &");
    expect(pmv).not.toMatch(/Ollama|API key|provider credential|Admin Control/i);

    const editPhoto = fs.readFileSync(
      path.resolve("desktop/customer-platform/workspace/EditPhotoServiceWorkspace.tsx"),
      "utf8",
    );
    expect(editPhoto).toContain("VisualAnalysisWorkspace");

    const passport = fs.readFileSync(
      path.resolve("desktop/customer-platform/workspace/PassportPhotoServiceWorkspace.tsx"),
      "utf8",
    );
    expect(passport).toContain("Upload Photo");
    expect(passport).toContain("Camera — Coming Soon");
    expect(passport).toContain("disabled");

    const shell = fs.readFileSync(
      path.resolve("desktop/customer-platform/workspace/ServiceWorkspace.tsx"),
      "utf8",
    );
    expect(shell).toContain("data-customer-service-workspace");
    expect(shell).toContain("Back");
    expect(shell).toContain("cp-sw-preview");
    expect(shell).toContain("cp-sw-actions");
  });

  it("keeps Coming Soon audio tools from claiming fake generation", () => {
    const audio = customerServiceRegistry.listByCategory("AUDIO");
    expect(audio.every((item) => item.status === "COMING_SOON")).toBe(true);
    const designTypes = customerServiceRegistry.listByCategory("DESIGN")
      .filter((item) => item.key !== "design-studio");
    expect(designTypes.every((item) => item.status === "COMING_SOON")).toBe(true);
  });
});
