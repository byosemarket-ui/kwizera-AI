import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  generateResearchQueries,
  dedupeQueries,
  classifySourceQuality,
  freshnessFromIso,
  knowledgeDedupeKey,
  localCategoryKnowledge,
} from "../../../ai/knowledge-research-engine/product-market-research.ts";
import { assembleResearchPackage, buildResearchContext } from "../../../desktop/market-research/assemble.ts";
import { MarketResearchEngine, loadStep4CreativeBriefHandoff } from "../../../desktop/market-research/research-engine.ts";
import { RESEARCH_HANDOFF_KEY, RESEARCH_STORE_KEY } from "../../../desktop/market-research/types.ts";
import { INTEL_HANDOFF_KEY } from "../../../desktop/deep-intelligence/types.ts";
import type { ProductIntelligencePackage, Step3MarketIntelHandoffPayload } from "../../../desktop/deep-intelligence/types.ts";
import type { ProductProfile } from "../../../desktop/product-profile/types.ts";

function mockStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem(key: string) { return store[key] ?? null; },
    setItem(key: string, value: string) { store[key] = value; },
    removeItem(key: string) { delete store[key]; },
  });
  vi.stubGlobal("navigator", { onLine: false });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  return store;
}

function makeIntel(): ProductIntelligencePackage {
  return {
    version: 1,
    intelligenceId: "pint-1",
    versionLabel: "1.0",
    versionNumber: 1,
    engineId: "test",
    projectId: "proj-1",
    productId: "proj-1",
    projectName: "Demo Shoes",
    productName: "Nike Air Max",
    visualAnalysisId: "vana-1",
    productionPackageRef: "pkg-1",
    identity: [],
    verifiedFacts: [
      { id: "1", field: "Category", value: "Shoes", kind: "verified", confidence: 1, band: "high", reason: "", evidence: [], reviewStatus: "pending" },
      { id: "2", field: "Brand", value: "Nike", kind: "verified", confidence: 1, band: "high", reason: "", evidence: [], reviewStatus: "pending" },
      { id: "3", field: "Colors", value: "Black, White", kind: "verified", confidence: 1, band: "high", reason: "", evidence: [], reviewStatus: "pending" },
    ],
    visualObservations: [],
    inferences: [],
    features: [
      { id: "f1", field: "Sole", value: "Visible", kind: "ai-observation", confidence: 0.7, band: "medium", reason: "", evidence: [], reviewStatus: "pending" },
    ],
    characteristics: [],
    differentiators: [],
    benefits: [
      { id: "b1", field: "Verified benefit", value: "Cushioned ride", kind: "verified", confidence: 1, band: "high", reason: "profile", evidence: [], reviewStatus: "pending" },
      { id: "b2", field: "AI-inferred benefit", value: "May provide grip", kind: "ai-inference", confidence: 0.55, band: "low", reason: "inference", evidence: [], reviewStatus: "pending" },
    ],
    unknown: [],
    variants: [],
    specificationChecks: [],
    logoTextChecks: [],
    crossValidation: [],
    consistency: { product: "consistent", images: "consistent", specifications: "consistent", variants: "consistent", note: "ok", confidence: 0.8 },
    coverage: [],
    coveragePercent: 80,
    scores: { identity: 90, visualUnderstanding: 88, specificationSupport: 80, imageCoverage: 80, consistency: 90, overall: 86, explanation: "test" },
    warnings: [],
    history: [],
    status: "complete",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("product market research helpers", () => {
  it("1–6. internet helpers, queries, dedupe, quality, freshness", () => {
    const q = generateResearchQueries({
      productName: "Nike Air Max",
      category: "Running Shoes",
      brand: "Nike",
      features: ["cushion"],
      audience: "young adults",
      objective: "awareness",
      platforms: ["TikTok"],
      language: "English",
      promotion: "discount",
      verifiedColors: ["Black"],
    });
    expect(q.length).toBeGreaterThan(5);
    expect(dedupeQueries([...q, q[0]!]).length).toBe(q.length);
    expect(classifySourceQuality({ curatedKnowledgeBase: true })).toBe("HIGH");
    expect(classifySourceQuality({ anonymous: true })).toBe("LOW");
    expect(freshnessFromIso(new Date().toISOString())).toBe("CURRENT");
    expect(knowledgeDedupeKey("Comfort is common")).toBeTruthy();
  });

  it("7–14. assemble product/customer/market layers without inventing stats", () => {
    const intel = makeIntel();
    const pkg = assembleResearchPackage({
      researchId: "r1",
      versionNumber: 1,
      versionLabel: "1.0",
      internetAvailable: false,
      usedLocalKnowledge: true,
      intel,
      brief: null,
      history: [],
    });
    expect(pkg.researchMode).toBe("offline");
    expect(pkg.queries.length).toBeGreaterThan(0);
    expect(pkg.sources.length).toBeGreaterThan(0);
    expect(pkg.sources.every((s) => s.quality === "HIGH" || s.quality === "MEDIUM" || s.quality === "LOW")).toBe(true);
    expect(pkg.knowledge.some((k) => k.kind === "user-provided-fact")).toBe(true);
    expect(pkg.knowledge.some((k) => k.kind === "researched-fact" || k.kind === "market-insight")).toBe(true);
    expect(pkg.customerInsights.length).toBeGreaterThan(0);
    expect(pkg.insufficientMarketData || pkg.marketInsights.length > 0).toBe(true);
    expect(pkg.marketingAngles.some((a) => a.verificationFlag)).toBe(true);
    expect(localCategoryKnowledge("Shoes").some((r) => /comfort/i.test(r.claim))).toBe(true);
  });

  it("audience context builder", () => {
    const ctx = buildResearchContext(makeIntel(), null);
    expect(ctx.category).toBe("Shoes");
    expect(ctx.productName).toBe("Nike Air Max");
  });
});

describe("market research engine", () => {
  beforeEach(() => {
    mockStorage();
  });

  function seedStep3() {
    const intel = makeIntel();
    const handoff: Step3MarketIntelHandoffPayload = {
      version: 1,
      step: "step-3-market-customer-intelligence",
      projectId: "proj-1",
      projectName: "Demo Shoes",
      masterIntelligence: intel,
      visualAnalysis: null,
      productionPackage: null,
      productProfile: { projectId: "proj-1", fields: { category: "Shoes" } } as ProductProfile,
      preparedAt: new Date().toISOString(),
    };
    localStorage.setItem(INTEL_HANDOFF_KEY, JSON.stringify(handoff));
    return intel;
  }

  it("15–34. offline run, events, autosave, resume, AI Me, handoff, versioning, dedupe memory", async () => {
    seedStep3();
    const events: Array<{ action?: string }> = [];
    const engine = new MarketResearchEngine();
    engine.setEventEmitter((_t, payload) => {
      events.push({ action: typeof payload.action === "string" ? payload.action : undefined });
    });
    expect(engine.hydrate()).toBe(true);
    const pkg = await engine.run();
    expect(pkg.internetAvailable).toBe(false);
    expect(pkg.researchMode).toBe("offline");
    expect(pkg.status).toBe("complete");
    expect(JSON.parse(localStorage.getItem(RESEARCH_STORE_KEY) ?? "{}")["proj-1"]).toBeTruthy();
    expect(events.some((e) => e.action === "InternetStatusDetected")).toBe(true);
    expect(events.some((e) => e.action === "ResearchCompleted")).toBe(true);
    expect(engine.buildAiMeContext().explanation).toMatch(/UNAVAILABLE|offline|local/i);

    engine.setSourceAction(pkg.sources[0]!.id, "important");
    expect(engine.snapshot().package!.sources[0]!.action).toBe("important");

    const v2 = await engine.retry();
    expect(v2.versionLabel).toBe("2.0");

    const engine2 = new MarketResearchEngine();
    expect(engine2.hydrate()).toBe(true);
    expect(engine2.snapshot().package?.versionLabel).toBe("2.0");

    const handoff = engine2.continueToStep4();
    expect(handoff.step).toBe("step-4-master-intelligence-report");
    expect(loadStep4CreativeBriefHandoff()?.projectId).toBe("proj-1");
    expect(localStorage.getItem(RESEARCH_HANDOFF_KEY)).toBeTruthy();
  });

  it("online hybrid mode when navigator is online", async () => {
    seedStep3();
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    const engine = new MarketResearchEngine();
    engine.hydrate();
    const pkg = await engine.run();
    expect(pkg.internetAvailable).toBe(true);
    expect(pkg.researchMode).toBe("hybrid");
  });
});
