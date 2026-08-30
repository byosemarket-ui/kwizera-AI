import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { CanonicalProductManager } from "../../../../ai/product-record/canonical-product-manager.js";
import { humanizeValue } from "../../../../ai/product-record/humanize.js";
import { MarketingBriefManager } from "../../../../ai/marketing-brief/marketing-brief-manager.js";
import { resolveWithPriority } from "../../../../ai/marketing-brief/resolve-brief.js";
import { suggestedOutputFromPlatforms } from "../../../../ai/marketing-brief/platform-presets.js";

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("priority resolution", () => {
  it("uses USER > CONFIRMED > ACCEPTED > INFERRED and ignores empty user values", () => {
    expect(resolveWithPriority({
      field: "cta",
      userValue: "ORDER_NOW",
      confirmed: "Shop",
      accepted: "DISCOVER_PRODUCT",
      inferred: "Learn More",
      lockedFields: ["cta"],
    })).toBe("ORDER_NOW");
    expect(resolveWithPriority({
      field: "cta",
      userValue: "",
      confirmed: "Shop now",
      accepted: "DISCOVER_PRODUCT",
      inferred: "Learn More",
      lockedFields: [],
    })).toBe("Shop now");
    expect(resolveWithPriority({
      field: "cta",
      userValue: "",
      accepted: "DISCOVER_PRODUCT",
      inferred: "Learn More",
      lockedFields: [],
    })).toBe("DISCOVER_PRODUCT");
    expect(resolveWithPriority({
      field: "cta",
      userValue: "",
      inferred: "Learn More",
      lockedFields: [],
    })).toBe("Learn More");
  });
});

describe("platform presets stay separate from format", () => {
  it("suggests a default ratio without treating platform as the format", () => {
    const tiktok = suggestedOutputFromPlatforms(["TikTok"]);
    expect(tiktok.aspectRatio).toBe("9:16");
    expect(tiktok.contentFormat).toBe("SHORT_PRODUCT_VIDEO");
    const youtube = suggestedOutputFromPlatforms(["YouTube"]);
    expect(youtube.aspectRatio).toBe("16:9");
    expect(youtube.contentFormat).not.toBe("YouTube");
  });
});

describe("MarketingBriefManager", () => {
  it("builds a persistent production brief from canonical product intelligence", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-marketing-brief-"));
    roots.push(root);
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(root);
    const project = await workspace.createProject("Oxford Launch");
    await workspace.updateProject(project.id, {
      productInformation: {
        name: "Chestnut Oxford",
        category: "shoes",
        description: "Brown leather lace-up oxford shoe",
      },
    });
    const front = await workspace.uploadImage(project.id, {
      fileName: "oxford-front.png",
      mimeType: "image/png",
      dataBase64: PNG_1X1,
    });
    const side = await workspace.uploadImage(project.id, {
      fileName: "oxford-left.png",
      mimeType: "image/png",
      dataBase64: PNG_1X1,
    });

    const canonical = new CanonicalProductManager();
    await canonical.initialize(root, { workspace });
    const product = await canonical.sync(project.id);
    expect(product.productId).toBe(project.id);
    expect(product.originalAssets.map((item) => item.assetId)).toEqual(
      expect.arrayContaining([front.id, side.id]),
    );

    const briefs = new MarketingBriefManager();
    await briefs.initialize(root, { workspace, canonical });
    const analyzed = await briefs.analyze(project.id);

    expect(analyzed.productId).toBe(product.productId);
    const allAssetIds = Object.values(analyzed.productAssets).flat();
    expect(allAssetIds).toEqual(expect.arrayContaining([front.id, side.id]));

    const blob = JSON.stringify(analyzed.intelligence);
    expect(blob).not.toMatch(/italian/i);
    expect(blob).not.toMatch(/waterproof/i);
    expect(blob).not.toMatch(/handmade/i);
    expect(blob).not.toMatch(/\[object Object\]/);
    expect(analyzed.intelligence?.mainSellingPoint.source).toMatch(/CONFIRMED|INFERRED/);
    expect(analyzed.intelligence?.category.text.toLowerCase()).toContain("shoe");
    expect(analyzed.recommendations.length).toBeGreaterThan(0);
    expect(analyzed.recommendations.every((item) => item.status === "PENDING")).toBe(true);
    expect(analyzed.campaign.cta).toBe("");

    await briefs.updateSettings(project.id, {
      campaign: {
        objective: "Product Awareness",
        platforms: ["Instagram", "TikTok"],
        audience: { general: "People shopping for shoes", location: "", ageRange: "", gender: "", customerType: "", interests: [] },
      },
      lockFields: ["objective", "platforms", "audienceType"],
    });

    const pendingCta = analyzed.recommendations.find((item) => item.field === "cta");
    const pendingTone = analyzed.recommendations.find((item) => item.field === "tone");
    expect(pendingCta).toBeTruthy();
    expect(pendingTone).toBeTruthy();

    const afterAccept = await briefs.acceptRecommendation(project.id, pendingCta!.id);
    expect(afterAccept.recommendations.find((item) => item.id === pendingCta!.id)?.status).toBe("ACCEPTED");
    expect(afterAccept.campaign.cta).toBeTruthy();
    expect(afterAccept.campaign.lockedFields).toContain("cta");

    const afterReject = await briefs.rejectRecommendation(project.id, pendingTone!.id);
    expect(afterReject.recommendations.find((item) => item.id === pendingTone!.id)?.status).toBe("REJECTED");
    expect(afterReject.campaign.tone).not.toBe(String(pendingTone!.value));

    const userOverride = await briefs.updateSettings(project.id, {
      campaign: { cta: "ORDER_NOW" },
      userDefined: { message: "Complete your look with refined everyday style" },
      lockFields: ["cta", "message"],
    });
    expect(userOverride.campaign.cta).toBe("ORDER_NOW");
    expect(userOverride.marketing.cta).toBe("ORDER_NOW");
    expect(userOverride.marketing.message).toContain("refined everyday style");

    const discover = afterAccept.recommendations.find((item) => item.field === "cta");
    expect(discover?.status).toBe("ACCEPTED");
    expect(userOverride.marketing.cta).not.toBe("DISCOVER_PRODUCT");

    const withRatio = await briefs.updateSettings(project.id, {
      output: { aspectRatio: "9:16", contentFormat: "SHORT_PRODUCT_VIDEO" },
      lockFields: ["aspectRatio", "contentFormat"],
    });
    expect(withRatio.output.aspectRatio).toBe("9:16");
    expect(withRatio.campaign.platforms).toEqual(["Instagram", "TikTok"]);
    expect(withRatio.output.contentFormat).not.toBe("Instagram");

    const youtube = await briefs.updateSettings(project.id, {
      campaign: { platforms: ["YouTube"] },
      output: { aspectRatio: "16:9" },
      lockFields: ["platforms", "aspectRatio"],
    });
    expect(youtube.campaign.platforms).toEqual(["YouTube"]);
    expect(youtube.output.aspectRatio).toBe("16:9");

    const instagramVertical = await briefs.updateSettings(project.id, {
      campaign: { platforms: ["Instagram"] },
      output: { aspectRatio: "9:16" },
      lockFields: ["platforms", "aspectRatio"],
    });
    expect(instagramVertical.campaign.platforms).toEqual(["Instagram"]);
    expect(instagramVertical.output.aspectRatio).toBe("9:16");

    const ready = await briefs.finalize(project.id);
    expect(ready.status).toBe("READY_FOR_SCRIPT");
    expect(ready.briefId).toMatch(/^brief_/);
    expect(ready.productId).toBe(product.productId);
    expect(ready.briefVersion).toBe(1);

    const restoredManager = new MarketingBriefManager();
    await restoredManager.initialize(root, { workspace, canonical });
    const restored = await restoredManager.get(project.id);
    expect(restored?.briefId).toBe(ready.briefId);
    expect(restored?.status).toBe("READY_FOR_SCRIPT");
    expect(restored?.campaign.cta).toBe("ORDER_NOW");
    const restoredAssets = Object.values(restored?.productAssets ?? {}).flat();
    expect(restoredAssets).toEqual(expect.arrayContaining([front.id, side.id]));

    const v2 = await restoredManager.updateSettings(project.id, {
      campaign: { objective: "Sales", cta: "Shop Now" },
      lockFields: ["objective", "cta"],
    });
    expect(v2.briefVersion).toBe(2);
    expect(v2.activeVersion).toBe(2);
    expect(v2.versions).toHaveLength(1);
    expect(v2.versions[0].campaign.objective).toBe("Product Awareness");
    expect(v2.status).toBe("READY_FOR_SCRIPT");

    expect(humanizeValue(v2.marketing.mainSellingPoint)).not.toBe("[object Object]");
    expect(humanizeValue(v2.marketing.mainSellingPoint).length).toBeGreaterThan(0);
  });
});
