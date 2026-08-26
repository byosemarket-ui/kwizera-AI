import { vi } from "vitest";
import { assembleMasterPackage } from "../../../desktop/master-intelligence/assemble.ts";
import type { MasterProductIntelligence } from "../../../desktop/master-intelligence/types.ts";
import type { ProductIntelligencePackage } from "../../../desktop/deep-intelligence/types.ts";
import type { ProductProfile } from "../../../desktop/product-profile/types.ts";
import { emptyFields } from "../../../desktop/product-profile/types.ts";
import type { MarketingProductionBrief } from "../../../desktop/marketing-input/types.ts";
import { emptyMarketingFields } from "../../../desktop/marketing-input/types.ts";
import { assembleMarketingStrategy } from "../../../desktop/marketing-strategy/assemble.ts";
import type { MasterMarketingStrategy } from "../../../desktop/marketing-strategy/types.ts";
import { assembleCreativeBlueprint } from "../../../desktop/creative-planner/assemble.ts";
import type { MasterCreativeBlueprint } from "../../../desktop/creative-planner/types.ts";
import type { ProductImageSet, OrganizedImage } from "../../../desktop/image-organization/types.ts";
import { assembleProductionPlan, buildProductionSnapshot } from "../../../desktop/production-plan/assemble.ts";
import { assembleProductionJob, nextProductionId } from "../../../desktop/production-queue/assemble.ts";
import type { ProductionExecutionPackage } from "../../../desktop/production-queue/types.ts";
import { QUEUE_HANDOFF_KEY } from "../../../desktop/production-queue/types.ts";

export function mockStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem(key: string) { return store[key] ?? null; },
    setItem(key: string, value: string) { store[key] = value; },
    removeItem(key: string) { delete store[key]; },
  });
  return store;
}

function makeProfile(): ProductProfile {
  return {
    version: 1, productId: "prod-1", projectId: "proj-1", projectName: "Demo Shoes",
    fields: { ...emptyFields(), name: "Nike Air Max", brand: "Nike", category: "Shoes", materials: ["Leather"], features: ["Air"], benefits: ["Cushion"], description: "Shoe" },
    variants: [], aiDerived: [], history: [], productImageSet: null,
    completeness: { information: 90, images: 80, specifications: 80, overall: 85, missingRecommended: [] },
    validations: [], validationStatus: "valid", canContinue: true, continueBlockedReason: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

function makeIntel(): ProductIntelligencePackage {
  return {
    version: 1, intelligenceId: "pint-1", versionLabel: "1.0", versionNumber: 1, engineId: "test",
    projectId: "proj-1", productId: "prod-1", projectName: "Demo Shoes", productName: "Nike Air Max",
    visualAnalysisId: "vana-1", productionPackageRef: "pkg-1",
    identity: [], verifiedFacts: [], visualObservations: [], inferences: [],
    features: [{ id: "f1", field: "Sole", value: "Rubber", kind: "ai-observation", confidence: 0.9, band: "high", reason: "v", evidence: [], reviewStatus: "pending" }],
    characteristics: [],
    differentiators: [{ id: "d1", field: "Look", value: "Distinct", kind: "ai-observation", confidence: 0.7, band: "medium", reason: "v", evidence: [], reviewStatus: "pending" }],
    benefits: [{ id: "b1", field: "Benefit", value: "Cushioned ride", kind: "verified", confidence: 1, band: "high", reason: "p", evidence: [], reviewStatus: "pending" }],
    unknown: [], variants: [], specificationChecks: [], logoTextChecks: [], crossValidation: [],
    consistency: { product: "consistent", images: "consistent", specifications: "consistent", variants: "consistent", note: "ok", confidence: 0.8 },
    coverage: [], coveragePercent: 80,
    scores: { identity: 98, visualUnderstanding: 90, specificationSupport: 80, imageCoverage: 80, consistency: 90, overall: 90, explanation: "t" },
    warnings: [], history: [], status: "complete", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

function makeBrief(): MarketingProductionBrief {
  return {
    version: 1, marketingBriefId: "mb-1", projectId: "proj-1", productId: "prod-1", projectName: "Demo Shoes",
    productProfile: makeProfile(),
    fields: {
      ...emptyMarketingFields(), objective: "Direct Sales", audienceType: "Pros", customerNeeds: "Comfort",
      buyingIntent: "Quality", platforms: ["TikTok"], contentFormat: "Social Media Ad", language: "English",
      tone: "Professional", cta: "Shop Now", promotionType: "None", duration: "short", voiceGender: "Female", voiceStyle: "Clear",
    },
    recommendations: [], conflicts: [], history: [],
    completeness: { objective: 1, audience: 1, platform: 1, language: 1, cta: 1, promotion: 1, overall: 1, missingRecommended: [] },
    validations: [], validationStatus: "valid", canContinue: true, continueBlockedReason: null, continueAnyway: false,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

function makeImage(fileName: string, viewType: OrganizedImage["viewType"]): OrganizedImage {
  return {
    assetId: `a-${fileName}`, projectId: "proj-1", fileName, mimeType: "image/jpeg",
    width: 800, height: 800, fileSize: 1000, viewType, confidence: 0.9, roleInGroup: "primary",
    groupId: viewType, backgroundType: "White", visibilityStatus: "clear", needsReview: false,
    analysisFailed: false, userCorrected: false, qualityScore: 80, warnings: [], analyzedAt: new Date().toISOString(),
  };
}

function makeImageSet(): ProductImageSet {
  return {
    version: 1, projectId: "proj-1", projectName: "Demo Shoes", categoryEstimate: "Shoes", groups: [],
    images: [makeImage("front.jpg", "FRONT"), makeImage("detail-01.jpg", "DETAIL")],
    missingViews: [], recommendedViews: [], coverageScore: 80, warnings: [],
    consistencyOk: true, analyzedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

function makeMaster(): MasterProductIntelligence {
  const pkg = assembleMasterPackage({
    research: null, intel: makeIntel(), visual: null, profile: makeProfile(), brief: makeBrief(), production: null,
  });
  return { ...pkg, userConfirmed: true, status: "confirmed", phase3Complete: true, readyForContentProduction: true };
}

function makeStrategy(): MasterMarketingStrategy {
  const s = assembleMarketingStrategy({ master: makeMaster(), brief: makeBrief() });
  return { ...s, userConfirmed: true, status: "confirmed", readyForCreativePlanning: true };
}

function makeBlueprint(): MasterCreativeBlueprint {
  const bp = assembleCreativeBlueprint({
    strategy: makeStrategy(), master: makeMaster(), brief: makeBrief(), imageSet: makeImageSet(),
  });
  return { ...bp, userConfirmed: true, status: "confirmed", readyForPreProduction: true, confirmedAt: new Date().toISOString() };
}

export function makeExecutionPackage(): ProductionExecutionPackage {
  const blueprint = makeBlueprint();
  const strategy = makeStrategy();
  const master = makeMaster();
  const plan = {
    ...assembleProductionPlan({ blueprint, strategy, master, brief: makeBrief(), claimSafety: master.claimSafety }),
    userConfirmed: true, status: "confirmed" as const, phase4Complete: true, readyForPhase5: true,
    confirmedAt: new Date().toISOString(),
  };
  const snapshot = buildProductionSnapshot(plan, {
    blueprint, strategy, master, brief: makeBrief(), claimSafety: master.claimSafety,
  });
  const job = assembleProductionJob({
    snapshot, productionId: nextProductionId(9), aiCoreOnline: true,
    resourceHints: { cores: 8, deviceMemoryGb: 16, jsHeapMb: 100, diskUsedGb: 20, diskTotalGb: 200 },
  });
  job.status = "READY";
  job.readyForStep2 = true;
  const dependencies: Record<string, string[]> = {};
  for (const t of job.tasks) dependencies[t.taskId] = [...t.dependencies];
  return {
    version: 1,
    step: "phase-5-step-2-pipeline-engine",
    productionId: job.productionId,
    projectId: job.projectId,
    projectName: job.projectName,
    snapshotId: snapshot.snapshotId,
    job,
    snapshot,
    taskGraph: job.tasks,
    executionQueue: job.executionOrder,
    dependencies,
    requiredAssets: job.assetChecks,
    requiredAiEngines: job.engines,
    resourceRequirements: job.resources,
    priority: "NORMAL",
    retryPolicy: { defaultMaxRetries: 3, note: "test" },
    recoveryState: "none",
    readiness: job.readiness,
    packageVersion: job.versionLabel,
    preparedAt: new Date().toISOString(),
    note: "test package",
  };
}

export function seedPackage(store: Record<string, string>) {
  const pkg = makeExecutionPackage();
  store[QUEUE_HANDOFF_KEY] = JSON.stringify(pkg);
  return pkg;
}
