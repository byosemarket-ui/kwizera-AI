import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  classifyFileName, mapServerRoleToView, mapViewToServerRole, recommendedViewsForCategory,
} from "../../../desktop/image-organization/classify.ts";
import { ImageOrganizationEngine } from "../../../desktop/image-organization/organization-engine.ts";
import type { IntakeHandoffPayload } from "../../../desktop/product-intake/types.ts";
import { INTAKE_HANDOFF_KEY } from "../../../desktop/product-intake/types.ts";

function mockStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem(key: string) { return store[key] ?? null; },
    setItem(key: string, value: string) { store[key] = value; },
    removeItem(key: string) { delete store[key]; },
  });
  return store;
}

describe("View classification", () => {
  it("classifies front/back/side/top/bottom/detail/packaging/logo/45/unknown", () => {
    expect(classifyFileName("front-01.jpg").viewType).toBe("FRONT");
    expect(classifyFileName("product_back.png").viewType).toBe("BACK");
    expect(classifyFileName("left_view.jpg").viewType).toBe("LEFT");
    expect(classifyFileName("right.jpg").viewType).toBe("RIGHT");
    expect(classifyFileName("top-overhead.jpg").viewType).toBe("TOP");
    expect(classifyFileName("bottom-sole.jpg").viewType).toBe("BOTTOM");
    expect(classifyFileName("detail-texture.jpg").viewType).toBe("DETAIL");
    expect(classifyFileName("packaging-box.jpg").viewType).toBe("PACKAGING");
    expect(classifyFileName("brand-logo.png").viewType).toBe("LOGO");
    expect(classifyFileName("hero-45-degree.jpg").viewType).toBe("FRONT_LEFT");
    expect(classifyFileName("front-left.jpg").viewType).toBe("FRONT_LEFT");
    expect(classifyFileName("close-up-stitch.jpg").viewType).toBe("CLOSE_UP");
    expect(classifyFileName("side-profile.jpg").viewType).toBe("OTHER");
    expect(classifyFileName("random-shot.jpg").viewType).toBe("UNKNOWN");
    expect(classifyFileName("front.jpg").confidence).toBeGreaterThan(0.9);
    expect(classifyFileName("mystery.jpg").confidence).toBeLessThan(0.5);
  });

  it("maps server roles bidirectionally", () => {
    expect(mapServerRoleToView("close-up")).toBe("CLOSE_UP");
    expect(mapServerRoleToView("angle-45")).toBe("FRONT_LEFT");
    expect(mapViewToServerRole("PACKAGING")).toBe("packaging");
    expect(mapViewToServerRole("FRONT")).toBe("front");
  });

  it("recommends category-aware views without requiring every angle", () => {
    expect(recommendedViewsForCategory("running shoes")).toContain("BOTTOM");
    expect(recommendedViewsForCategory("handbag")).toContain("FRONT");
    expect(recommendedViewsForCategory("wireless earbuds")).toContain("DETAIL");
    expect(recommendedViewsForCategory("general")).toContain("FRONT");
  });
});

describe("Organization engine", () => {
  beforeEach(() => {
    mockStorage();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const demoProject = {
        id: "proj-1",
        name: "Demo Shoe",
        createdAt: "2026-01-01T00:00:00.000Z",
        modifiedAt: "2026-01-01T00:00:00.000Z",
        productImages: [
          { id: "a1", fileName: "front.jpg", mimeType: "image/jpeg", sizeBytes: 1000, uploadedAt: "2026-01-01T00:00:00.000Z", url: "/img/a1" },
          { id: "a2", fileName: "mystery.jpg", mimeType: "image/jpeg", sizeBytes: 500, uploadedAt: "2026-01-01T00:00:00.000Z", url: "/img/a2" },
        ],
        productInformation: { name: "Demo Shoe", category: "footwear", description: "" },
      };
      if (String(url) === "/api/workspace") {
        return { ok: true, json: async () => ({ activeProject: demoProject, projects: [demoProject] }) };
      }
      if (String(url).includes("/api/workspace/projects/proj-1") && String(url).includes("assets") === false) {
        return { ok: true, json: async () => ({ project: demoProject }) };
      }
      if (String(url).includes("/image-intelligence/") && String(url).includes("/analyze")) {
        return {
          ok: true,
          json: async () => ({
            profiles: [
              {
                imageId: "a1",
                fileName: "front.jpg",
                viewRole: "front",
                quality: { score: 88 },
                background: { type: "white studio" },
                defects: [],
                metadata: { viewConfidence: 96 },
                resolution: { tier: "high" },
              },
              {
                imageId: "a2",
                fileName: "mystery.jpg",
                viewRole: "unknown",
                quality: { score: 60 },
                background: { type: "complex" },
                defects: ["soft focus"],
                metadata: { viewConfidence: 35 },
                resolution: { tier: "low" },
              },
            ],
          }),
        };
      }
      if (String(url).includes("/product-intelligence/") && String(url).includes("/analyze")) {
        return {
          ok: true,
          json: async () => ({
            profile: { category: "footwear", productType: "shoe", identifiedAs: "sneaker" },
          }),
        };
      }
      if (String(url).includes("/view-role")) {
        return { ok: true, json: async () => ({ profile: {} }) };
      }
      return { ok: false, json: async () => ({ error: "not found" }) };
    }));
  });

  it("hydrates Step 1 handoff, analyzes, allows reclassify and Step 3 handoff", async () => {
    const handoff: IntakeHandoffPayload = {
      version: 1,
      step: "step-2-image-organization",
      projectId: "proj-1",
      projectName: "Demo Shoe",
      preparedAt: new Date().toISOString(),
      assets: [
        {
          assetId: "a1",
          projectId: "proj-1",
          originalFilename: "front.jpg",
          fileType: "image/jpeg",
          width: 1200,
          height: 900,
          fileSize: 1000,
          importDate: new Date().toISOString(),
          sourceReference: "x",
          validationStatus: "valid",
          duplicateStatus: "none",
          processingStatus: "saved",
          checksum: "c1",
          warnings: [],
          remoteUrl: "/img/a1",
        },
        {
          assetId: "a2",
          projectId: "proj-1",
          originalFilename: "mystery.jpg",
          fileType: "image/jpeg",
          width: 200,
          height: 200,
          fileSize: 500,
          importDate: new Date().toISOString(),
          sourceReference: "x",
          validationStatus: "warning",
          duplicateStatus: "none",
          processingStatus: "saved",
          checksum: "c2",
          warnings: [],
          remoteUrl: "/img/a2",
        },
      ],
    };
    localStorage.setItem(INTAKE_HANDOFF_KEY, JSON.stringify(handoff));

    const engine = new ImageOrganizationEngine();
    expect(await engine.hydrateFromHandoff()).toBe(true);
    const set = await engine.runAnalysis();
    expect(set.images).toHaveLength(2);
    expect(set.images.find((i) => i.assetId === "a1")?.viewType).toBe("FRONT");
    expect(set.images.find((i) => i.assetId === "a2")?.needsReview).toBe(true);
    expect(set.coverageScore).toBeGreaterThanOrEqual(0);
    expect(set.missingViews.length).toBeGreaterThan(0);

    await engine.reclassify("a2", "DETAIL");
    expect(engine.snapshot().productImageSet?.images.find((i) => i.assetId === "a2")?.viewType).toBe("DETAIL");
    expect(engine.snapshot().productImageSet?.images.find((i) => i.assetId === "a2")?.userCorrected).toBe(true);

    await engine.setPrimary("a1");
    expect(engine.snapshot().productImageSet?.images.find((i) => i.assetId === "a1")?.roleInGroup).toBe("primary");

    expect(engine.snapshot().canContinue).toBe(true);
    const step3 = await engine.continueToStep3();
    expect(step3.step).toBe("step-3-product-information");
    expect(step3.projectId).toBe("proj-1");
  });
});
