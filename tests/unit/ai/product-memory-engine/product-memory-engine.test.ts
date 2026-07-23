import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  MemoryStorageType,
  ProjectType,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-product-memory-test-"));
}

describe("AiProductMemoryEngine", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = createTempStorageRoot();
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }
  });

  async function startCore() {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("product-memory-test");
    const foundation = core.getManager().memoryFoundation!;
    const projects = foundation.getProjectMemoryEngine();
    const products = foundation.getProductMemoryEngine();
    return { core, foundation, projects, products };
  }

  async function seedProject(projects: Awaited<ReturnType<typeof startCore>>["projects"]) {
    await projects.createProject({
      projectId: "proj-prod-001",
      projectName: "Product Test Project",
      projectType: ProjectType.Product,
      description: "Project for product memory tests",
      tags: ["kwizera"],
    });
  }

  it("initializes with memory foundation startup", async () => {
    const { core, products } = await startCore();
    expect(products.isInitialized()).toBe(true);
    expect(products.isStartupComplete()).toBe(true);

    const productDir = path.join(storageRoot, "memory", "products");
    expect(fs.existsSync(productDir)).toBe(true);

    await core.stop();
  });

  it("creates and stores complete product profile", async () => {
    const { core, projects, products } = await startCore();
    await seedProject(projects);

    const result = await products.createProduct({
      productId: "prod-test-001",
      projectId: "proj-prod-001",
      productName: "KWIZERA Pro License",
      brand: "KWIZERA",
      category: "software",
      subcategory: "creative-tools",
      sku: "KWZ-PRO-001",
      description: "Professional AI creative studio license for power users.",
      features: ["AI workflow", "Local storage", "Video export"],
      specifications: { version: "1.0", platform: "Windows" },
      materials: ["digital"],
      colors: ["#1a1a2e", "#e94560"],
      sizes: ["standard"],
      price: 99.99,
      currency: "USD",
      availability: "in-stock",
      countryOfOrigin: "US",
      supplier: "KWIZERA Inc",
      language: "en",
      marketingGoal: "conversion",
      tags: ["software", "pro"],
    });

    expect(result.success).toBe(true);

    const product = await products.getProduct("prod-test-001");
    expect(product).not.toBeNull();
    expect(product!.sku).toBe("KWZ-PRO-001");
    expect(product!.scores.profileScore).toBeGreaterThan(0);

    await core.stop();
  });

  it("stores visual and marketing memory", async () => {
    const { core, projects, products } = await startCore();
    await seedProject(projects);

    await products.createProduct({
      productId: "prod-visual-001",
      projectId: "proj-prod-001",
      productName: "Visual Product",
      brand: "KWIZERA",
      category: "hardware",
      visual: {
        productImages: ["img/hero-front.png", "img/hero-side.png"],
        productBackgrounds: ["bg/studio-white"],
        productAngles: ["front", "45-degree", "top"],
        lightingStyle: "studio-soft",
        presentationStyle: "hero-center",
        colorPalette: ["#ffffff", "#1a1a2e"],
        packagingStyle: "minimal-box",
        productLayout: "center-hero",
      },
      marketing: {
        bestHeadlines: ["Professional Creative Power"],
        bestHooks: ["What if your tools kept up with your ideas?"],
        bestCta: ["Get started today"],
        bestDescriptions: ["The ultimate local-first creative studio"],
        bestSellingPoints: ["Fast", "Private", "Powerful"],
        emotionalMarketingStyle: "aspirational",
        storytellingStyle: "problem-solution",
      },
    });

    const product = await products.getProduct("prod-visual-001");
    expect(product!.visual.productImages).toHaveLength(2);
    expect(product!.marketing.bestHeadlines[0]).toContain("Professional");
    expect(product!.scores.marketingScore).toBeGreaterThan(40);

    await core.stop();
  });

  it("links video and marketing relationships", async () => {
    const { core, projects, products, foundation } = await startCore();
    await seedProject(projects);

    await products.createProduct({
      productId: "prod-rel-001",
      projectId: "proj-prod-001",
      productName: "Related Product",
      brand: "KWIZERA",
      category: "software",
      videoRelationships: {
        promotionalVideos: ["vid-promo-001"],
        marketingCampaigns: ["mkt-camp-001"],
        posters: ["poster-001"],
      },
    });

    await foundation.getStorageEngine().storeRecord({
      memoryId: "vid-promo-001",
      memoryType: MemoryStorageType.Video,
      category: "promotional",
      title: "Product Promo",
      description: "Promo video",
      source: "test",
      relatedProject: "proj-prod-001",
    });

    await products.updateProduct("prod-rel-001", { marketingGoal: "awareness" });

    const product = await products.getProduct("prod-rel-001");
    expect(product!.videoRelationships.promotionalVideos).toContain("vid-promo-001");

    const relationships = products.getProductRelationships("prod-rel-001");
    expect(relationships).not.toBeNull();

    await core.stop();
  });

  it("detects product patterns", async () => {
    const { core, projects, products } = await startCore();
    await seedProject(projects);

    await products.createProduct({
      productId: "prod-pat-001",
      projectId: "proj-prod-001",
      productName: "Pattern Product",
      brand: "KWIZERA",
      category: "software",
      visual: {
        productImages: ["img/1.png"],
        presentationStyle: "hero-center",
        productLayout: "grid-3col",
      },
      marketing: {
        bestHeadlines: ["Transform Your Workflow"],
        bestCta: ["Buy now"],
        bestSellingPoints: ["Speed", "Quality"],
      },
      videoRelationships: { promotionalVideos: ["vid-001"] },
    });

    const update = await products.updateProduct("prod-pat-001", {
      presentationStyleRating: 85,
    });

    expect(update.patternsDetected).toBeGreaterThan(0);
    expect(products.getDetectedPatterns().length).toBeGreaterThan(0);
    expect(products.getReusablePatterns().length).toBeGreaterThan(0);

    await core.stop();
  });

  it("learns customer preferences and from completed projects", async () => {
    const { core, projects, products, foundation } = await startCore();
    await seedProject(projects);

    products.learnCustomerPreferences({
      preferredProducts: ["KWIZERA Pro"],
      preferredCategories: ["software"],
      preferredColors: ["#1a1a2e"],
      preferredPriceRange: "50-150",
      preferredPresentationStyle: "hero-center",
      preferredMarketingStyle: "aspirational",
    });

    const prefs = products.getCustomerPreferences();
    expect(prefs.preferredCategories).toContain("software");

    await products.createProduct({
      productId: "prod-learn-001",
      projectId: "proj-prod-001",
      productName: "Learning Product",
      brand: "KWIZERA",
      category: "software",
      visual: { presentationStyle: "lifestyle", productLayout: "hero-left" },
      marketing: {
        bestHeadlines: ["Create Faster"],
        bestCta: ["Try free"],
        emotionalMarketingStyle: "inspirational",
      },
    });

    const learning = await products.learnFromProject("prod-learn-001");
    expect(learning.success).toBe(true);
    expect(learning.recommendations.length).toBeGreaterThan(0);
    expect(learning.learningId).toBeDefined();

    const history = foundation.getLearningMemoryEngine().getLearningHistory();
    expect(history.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("supports product search by multiple criteria", async () => {
    const { core, projects, products } = await startCore();
    await seedProject(projects);

    await products.createProduct({
      productId: "prod-search-001",
      projectId: "proj-prod-001",
      productName: "Searchable Widget",
      brand: "KWIZERA",
      category: "gadgets",
      subcategory: "accessories",
      sku: "WDG-001",
      supplier: "Acme Supplies",
      price: 49.99,
      colors: ["black", "silver"],
      language: "en",
      marketingGoal: "conversion",
      tags: ["gadget"],
      keywords: ["widget", "accessory"],
    });

    expect(products.searchProducts({ name: "Searchable" }).length).toBe(1);
    expect(products.searchProducts({ brand: "KWIZERA" }).length).toBe(1);
    expect(products.searchProducts({ sku: "WDG-001" }).length).toBe(1);
    expect(products.searchProducts({ color: "silver" }).length).toBe(1);
    expect(products.searchProducts({ minPrice: 40, maxPrice: 60 }).length).toBe(1);
    expect(products.searchProducts({ supplier: "Acme" }).length).toBe(1);

    await core.stop();
  });

  it("persists products across application restart", async () => {
    const core1 = createAiCore({ storageRootOverride: storageRoot });
    await core1.start("persist");
    const p1 = core1.getManager().memoryFoundation!.getProjectMemoryEngine();
    const pr1 = core1.getManager().memoryFoundation!.getProductMemoryEngine();
    await p1.createProject({
      projectId: "proj-persist-prod",
      projectName: "Persist",
      projectType: ProjectType.Product,
      description: "Persist product",
    });
    await pr1.createProduct({
      productId: "prod-persist-001",
      projectId: "proj-persist-prod",
      productName: "Persistent Product",
      brand: "KWIZERA",
    });
    await core1.stop();

    AiCore.resetInstance();
    const core2 = createAiCore({ storageRootOverride: storageRoot });
    await core2.start("persist-restart");
    const pr2 = core2.getManager().memoryFoundation!.getProductMemoryEngine();
    const product = await pr2.getProduct("prod-persist-001");
    expect(product?.productName).toBe("Persistent Product");
    await core2.stop();
  });

  it("writes logs and builds status report", async () => {
    const { core, projects, products } = await startCore();
    await seedProject(projects);

    await products.createProduct({
      productId: "prod-report-001",
      projectId: "proj-prod-001",
      productName: "Report Product",
      brand: "KWIZERA",
      description: "For status report",
    });

    const logDir = path.join(storageRoot, "logs");
    const logFiles = fs.readdirSync(logDir).filter((f) => f.startsWith("product-memory-engine"));
    expect(logFiles.length).toBeGreaterThan(0);

    const report = products.buildStatusReport();
    expect(report.engineStatus).toBe("operational");
    expect(report.readinessScore).toBeGreaterThanOrEqual(85);
    expect(report.totalProducts).toBe(1);

    await core.stop();
  });
});
