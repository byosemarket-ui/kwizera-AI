import { describe, expect, it } from "vitest";
import {
  extractBrandIdentity,
  normalizeWebsiteUrl,
  isDisplayablePhone,
  isBrandLogoAsset,
  validateBrandIdentityForEndCard,
} from "../../../../ai/creative-workspace/brand-identity.js";
import { isOriginalProductImage } from "../../../../ai/creative-workspace/project-asset.js";
import { buildEndCardPlan } from "../../../../ai/video-production/end-card.js";
import type { CreativeProject } from "../../../../ai/creative-workspace/creative-workspace-manager.js";

function project(overrides: Partial<CreativeProject> = {}): CreativeProject {
  return {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    name: "Proj",
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    productImages: [],
    productInformation: { name: "Shoe", category: "Footwear", description: "Trail" },
    brandInformation: { name: "" },
    campaignInformation: { name: "Camp", objective: "sales" },
    targetAudience: "",
    language: "English",
    platform: "tiktok",
    workspaceSettings: {},
    ...overrides,
  } as CreativeProject;
}

describe("STEP 2A brand identity", () => {
  it("normalizes bare domains to https", () => {
    expect(normalizeWebsiteUrl("byosemarket.com")).toBe("https://byosemarket.com");
    expect(normalizeWebsiteUrl("https://example.com/shop")).toBe("https://example.com/shop");
    expect(normalizeWebsiteUrl("")).toBe("");
  });

  it("accepts Rwanda-style phone displays", () => {
    expect(isDisplayablePhone("+250 780 000 000")).toBe(true);
    expect(isDisplayablePhone("0780000000")).toBe(true);
    expect(isDisplayablePhone("abc")).toBe(false);
  });

  it("extracts brand identity from brandInformation over product specs", () => {
    const identity = extractBrandIdentity(project({
      brandInformation: {
        name: "TEST BRAND",
        website: "https://example.com",
        phone: "+250 780 000 000",
        logoAssetId: "logo-1",
      },
      campaignInformation: { name: "C", objective: "o", callToAction: "SHOP NOW" },
      productInformation: {
        name: "Shoe",
        category: "Footwear",
        description: "x",
        specifications: { website: "https://wrong.example" },
      },
    }));
    expect(identity.brandName).toBe("TEST BRAND");
    expect(identity.websiteUrl).toBe("https://example.com");
    expect(identity.phone).toBe("+250 780 000 000");
    expect(identity.cta).toBe("SHOP NOW");
    expect(identity.logoAssetId).toBe("logo-1");
  });

  it("falls back to specifications.website when brand website missing", () => {
    const identity = extractBrandIdentity(project({
      brandInformation: { name: "Alpha" },
      productInformation: {
        name: "Shoe",
        category: "Footwear",
        description: "x",
        specifications: { website: "alpha.example" },
      },
    }));
    expect(identity.websiteUrl).toBe("https://alpha.example");
  });

  it("excludes brand logos from product image selection", () => {
    expect(isBrandLogoAsset({ assetType: "document", assetRole: "brand-logo", origin: "upload" })).toBe(true);
    expect(isOriginalProductImage({
      assetType: "document",
      assetRole: "brand-logo",
      origin: "upload",
      mimeType: "image/png",
    })).toBe(false);
  });

  it("builds end card lines with hierarchy brand → cta → website → phone", () => {
    const plan = buildEndCardPlan({
      project: project({
        brandInformation: {
          name: "TEST BRAND",
          website: "https://example.com",
          phone: "+250 780 000 000",
          logoAssetId: "logo-1",
        },
        campaignInformation: { name: "C", objective: "o", callToAction: "SHOP NOW" },
      }),
      preset: "standard",
      productionMode: "AI_PRODUCT_MOTION",
      logoFileExists: true,
    });
    expect(plan.lines.map((l) => l.role)).toEqual(["brand", "cta", "website", "phone"]);
    expect(plan.companyName).toBe("TEST BRAND");
    expect(plan.hasLogo).toBe(true);
    expect(plan.lines.some((l) => /undefined|null/i.test(l.content))).toBe(false);
  });

  it("omits empty labels when fields missing and CTA is None", () => {
    const plan = buildEndCardPlan({
      project: project({
        brandInformation: { name: "Only Brand" },
        campaignInformation: { name: "C", objective: "o", callToAction: "" },
      }),
      preset: "standard",
      productionMode: "AI_PRODUCT_MOTION",
    });
    expect(plan.lines).toEqual([{ role: "brand", content: "Only Brand" }]);
    expect(plan.cta).toBe("");
    expect(plan.website).toBe("");
    expect(plan.phone).toBe("");
  });

  it("warns when logo id is set but file missing", () => {
    const identity = extractBrandIdentity(project({
      brandInformation: { name: "A", logoAssetId: "missing" },
    }));
    const check = validateBrandIdentityForEndCard(identity, false);
    expect(check.ok).toBe(true);
    expect(check.warnings.some((w) => /logo/i.test(w))).toBe(true);
  });

  it("keeps project A/B brand data isolated in extractBrandIdentity", () => {
    const a = extractBrandIdentity(project({
      id: "11111111-1111-1111-1111-111111111111",
      brandInformation: { name: "ALPHA", website: "https://alpha.example", phone: "+250 111 111 111" },
    }));
    const b = extractBrandIdentity(project({
      id: "22222222-2222-2222-2222-222222222222",
      brandInformation: { name: "BETA", website: "https://beta.example", phone: "+250 222 222 222" },
    }));
    expect(a.brandName).toBe("ALPHA");
    expect(b.brandName).toBe("BETA");
    expect(a.phone).not.toBe(b.phone);
    expect(a.projectId).not.toBe(b.projectId);
  });
});
