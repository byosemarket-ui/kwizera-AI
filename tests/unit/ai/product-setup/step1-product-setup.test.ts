import { describe, expect, it } from "vitest";
import { calculateDiscount, parsePriceInput } from "../../../../desktop/product-setup/discount.ts";
import {
  buildImageCards,
  computeReadiness,
  deriveAnalysisStatus,
  suggestProductName,
} from "../../../../desktop/product-setup/readiness.ts";
import type { IntakeSnapshot } from "../../../../desktop/product-intake/types.ts";
import type { OrganizationSnapshot } from "../../../../desktop/image-organization/types.ts";

const baseIntake = (overrides: Partial<IntakeSnapshot> = {}): IntakeSnapshot => ({
  version: 1,
  projectId: "proj-1",
  projectName: "Chestnut Oxford Campaign",
  assets: [{
    assetId: "a1",
    projectId: "proj-1",
    originalFilename: "front.jpg",
    fileType: "image/jpeg",
    width: 800,
    height: 600,
    fileSize: 1000,
    importDate: new Date().toISOString(),
    sourceReference: "test",
    validationStatus: "valid",
    duplicateStatus: "none",
    processingStatus: "saved",
    checksum: "abc",
    warnings: [],
    keepDespiteDuplicate: true,
  }],
  queue: [],
  progress: { total: 0, completed: 0, percent: 100, running: false, paused: false, remaining: 0, statusLabel: "Idle", bytesPerSecond: 0, currentFile: null },
  canContinue: true,
  continueBlockedReason: null,
  handoffReady: false,
  recommendation: "",
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const baseOrg = (overrides: Partial<OrganizationSnapshot> = {}): OrganizationSnapshot => ({
  version: 1,
  projectId: "proj-1",
  projectName: "Chestnut Oxford Campaign",
  progress: { total: 1, completed: 1, percent: 100, running: false, currentFile: null, currentClassification: "FRONT", currentConfidence: 0.9, statusLabel: "Complete" },
  productImageSet: {
    version: 1,
    projectId: "proj-1",
    projectName: "Test",
    categoryEstimate: "Footwear",
    groups: [],
    images: [{
      assetId: "a1",
      projectId: "proj-1",
      fileName: "front.jpg",
      mimeType: "image/jpeg",
      width: 800,
      height: 600,
      fileSize: 1000,
      viewType: "FRONT",
      confidence: 0.92,
      roleInGroup: "primary",
      groupId: "view-FRONT",
      backgroundType: "plain",
      visibilityStatus: "clear",
      needsReview: false,
      analysisFailed: false,
      userCorrected: false,
      qualityScore: 80,
      warnings: [],
      analyzedAt: new Date().toISOString(),
      origin: "original",
      processingState: "ready",
      analysisState: "ready",
      aiVisionStatus: "OK",
    }],
    missingViews: ["BACK"],
    recommendedViews: ["FRONT", "BACK", "OTHER"],
    coverageScore: 66,
    warnings: [],
    consistencyOk: true,
    analyzedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  canContinue: true,
  continueBlockedReason: null,
  handoffReady: false,
  recommendation: "",
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe("STEP 1 Product Setup — discount", () => {
  it("calculates discount when previous price is greater", () => {
    const d = calculateDiscount(25000, 20000);
    expect(d.valid).toBe(true);
    expect(d.percent).toBe(20);
    expect(d.label).toBe("SAVE 20%");
  });

  it("does not generate discount when previous <= current", () => {
    expect(calculateDiscount(20000, 25000).valid).toBe(false);
    expect(calculateDiscount(20000, 20000).valid).toBe(false);
    expect(calculateDiscount(null, 20000).valid).toBe(false);
  });

  it("parses price input with commas", () => {
    expect(parsePriceInput("25,000")).toBe(25000);
  });
});

describe("STEP 1 Product Setup — readiness", () => {
  it("blocks when no valid images", () => {
    const intake = baseIntake({ assets: [] });
    const org = baseOrg({ productImageSet: null });
    const readiness = computeReadiness(intake, org, {
      productName: "Oxford",
      currentPrice: null,
      previousPrice: null,
      currency: "RWF",
      size: "",
      shortDescription: "",
    }, "NOT_STARTED");
    expect(readiness.ready).toBe(false);
    expect(readiness.blockingIssues.some((i) => /image/i.test(i))).toBe(true);
  });

  it("allows continue with non-critical warnings", () => {
    const intake = baseIntake();
    const org = baseOrg();
    const readiness = computeReadiness(intake, org, {
      productName: "Chestnut Oxford",
      currentPrice: 20000,
      previousPrice: null,
      currency: "RWF",
      size: "",
      shortDescription: "",
    }, "COMPLETE");
    expect(readiness.ready).toBe(true);
    expect(readiness.warnings.length).toBeGreaterThan(0);
    expect(readiness.statusLabel).toMatch(/RECOMMENDATIONS|CONTINUE/);
  });

  it("requires product name", () => {
    const readiness = computeReadiness(baseIntake(), baseOrg(), {
      productName: "",
      currentPrice: null,
      previousPrice: null,
      currency: "RWF",
      size: "",
      shortDescription: "",
    }, "COMPLETE");
    expect(readiness.ready).toBe(false);
  });

  it("suggests product name from campaign project name", () => {
    expect(suggestProductName("Chestnut Oxford Campaign")).toBe("Chestnut Oxford");
  });
});

describe("STEP 1 Product Setup — analysis status", () => {
  it("reports UPLOADING when import queue is running", () => {
    const intake = baseIntake({ progress: { ...baseIntake().progress, running: true } });
    expect(deriveAnalysisStatus(intake, baseOrg(), false)).toBe("UPLOADING");
  });

  it("builds image cards from real intake and org data", () => {
    const cards = buildImageCards(baseIntake(), baseOrg());
    expect(cards).toHaveLength(1);
    expect(cards[0]?.displayLabel).toBe("Front");
    expect(cards[0]?.finalViewType).toBe("FRONT");
  });
});
