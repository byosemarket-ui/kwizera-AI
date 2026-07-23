import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  CampaignType,
  createAiCore,
  MarketingPlatform,
  MemoryStorageType,
  ProjectType,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-marketing-memory-test-"));
}

describe("AiMarketingMemoryEngine", () => {
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
    await core.start("marketing-memory-test");
    const foundation = core.getManager().memoryFoundation!;
    const projects = foundation.getProjectMemoryEngine();
    const marketing = foundation.getMarketingMemoryEngine();
    return { core, foundation, projects, marketing };
  }

  async function seedProject(projects: Awaited<ReturnType<typeof startCore>>["projects"]) {
    await projects.createProject({
      projectId: "proj-mkt-001",
      projectName: "Marketing Test Project",
      projectType: ProjectType.Marketing,
      description: "Project for marketing memory tests",
      tags: ["kwizera", "brand"],
    });
  }

  it("initializes with memory foundation startup", async () => {
    const { core, marketing } = await startCore();
    expect(marketing.isInitialized()).toBe(true);
    expect(marketing.isStartupComplete()).toBe(true);

    const marketingDir = path.join(storageRoot, "memory", "marketing");
    expect(fs.existsSync(marketingDir)).toBe(true);

    await core.stop();
  });

  it("creates and stores marketing campaign memory", async () => {
    const { core, projects, marketing } = await startCore();
    await seedProject(projects);

    const result = await marketing.createCampaign({
      campaignId: "mkt-test-001",
      projectId: "proj-mkt-001",
      campaignName: "KWIZERA Launch Campaign",
      product: "AI Studio",
      brand: "KWIZERA",
      campaignType: CampaignType.BrandAwareness,
      platform: MarketingPlatform.InstagramReels,
      targetAudience: "Creative professionals",
      goal: "Brand awareness",
      language: "en",
      tags: ["launch", "brand"],
    });

    expect(result.success).toBe(true);

    const campaign = await marketing.getCampaign("mkt-test-001");
    expect(campaign).not.toBeNull();
    expect(campaign!.brand).toBe("KWIZERA");
    expect(campaign!.scores.qualityScore).toBeGreaterThan(0);

    await core.stop();
  });

  it("stores content, campaign, branding, and social media memory", async () => {
    const { core, projects, marketing } = await startCore();
    await seedProject(projects);

    await marketing.createCampaign({
      campaignId: "mkt-content-001",
      projectId: "proj-mkt-001",
      campaignName: "Full Memory Campaign",
      brand: "KWIZERA",
      platform: MarketingPlatform.TikTok,
      content: {
        headlines: ["Transform Your Creative Workflow"],
        hooks: ["What if AI could do this?"],
        captions: ["Create stunning promos in minutes"],
        callToActions: ["Start free today"],
        sellingPoints: ["Local-first", "AI-powered", "Fast"],
        hashtags: ["#kwizera", "#aicreator"],
        keywords: ["ai", "creative", "studio"],
        emotionalTriggers: ["inspiration", "empowerment"],
      },
      campaign: {
        campaignStructure: "hook-problem-solution-cta",
        campaignFlow: "attention-interest-desire-action",
        openingStyle: "bold-question",
        productPresentation: "hero-demo",
        benefits: ["Save time", "Better quality"],
        customerProblem: "Slow creative workflows",
        solution: "AI-powered automation",
        closingStrategy: "urgency-offer",
        offerStrategy: "free-trial",
      },
      branding: {
        brandVoice: "confident-inspiring",
        brandPersonality: "innovative",
        brandColors: ["#1a1a2e", "#e94560"],
        brandIdentity: "modern-tech",
        brandStyle: "bold-minimal",
        brandMessaging: "Create without limits",
        logoUsage: "corner-watermark",
        typography: "geometric-sans",
      },
      socialMedia: {
        platform: MarketingPlatform.TikTok,
        bestPractices: ["Hook in 1s", "Vertical format"],
        contentStyle: "fast-paced",
        optimalLength: "15-30s",
        postingTips: ["Post at peak hours"],
      },
    });

    const campaign = await marketing.getCampaign("mkt-content-001");
    expect(campaign!.content.headlines).toHaveLength(1);
    expect(campaign!.content.callToActions[0]).toBe("Start free today");
    expect(campaign!.campaign.campaignStructure).toContain("hook");
    expect(campaign!.branding.brandVoice).toBe("confident-inspiring");
    expect(campaign!.socialMedia.platform).toBe(MarketingPlatform.TikTok);
    expect(campaign!.scores.conversionScore).toBeGreaterThan(30);

    await core.stop();
  });

  it("detects marketing patterns from campaign content", async () => {
    const { core, projects, marketing } = await startCore();
    await seedProject(projects);

    await marketing.createCampaign({
      campaignId: "mkt-patterns-001",
      projectId: "proj-mkt-001",
      campaignName: "Pattern Test",
      brand: "KWIZERA",
      content: {
        headlines: ["Revolutionary AI Creative Studio"],
        hooks: ["Stop wasting hours on edits"],
        callToActions: ["Get started now"],
      },
      campaign: {
        campaignStructure: "aida",
        campaignFlow: "hook-demo-cta",
        customerProblem: "Slow editing",
        solution: "AI automation",
        productPresentation: "feature-showcase",
      },
    });

    const update = await marketing.updateCampaign("mkt-patterns-001", {
      contentAppend: { sellingPoints: ["Speed", "Quality"] },
    });

    expect(update.patternsDetected).toBeGreaterThan(0);
    expect(marketing.getDetectedPatterns().length).toBeGreaterThan(0);
    expect(marketing.getReusablePatterns().length).toBeGreaterThan(0);

    await core.stop();
  });

  it("learns customer memory and from completed campaigns", async () => {
    const { core, projects, marketing, foundation } = await startCore();
    await seedProject(projects);

    marketing.learnCustomerInsights({
      customerInterests: ["AI tools", "video creation"],
      preferredMarketingStyles: ["bold", "minimal"],
      preferredLanguages: ["en"],
    });

    const customer = marketing.getCustomerMemory();
    expect(customer.customerInterests).toContain("AI tools");
    expect(customer.preferredMarketingStyles).toContain("bold");

    await marketing.createCampaign({
      campaignId: "mkt-learn-001",
      projectId: "proj-mkt-001",
      campaignName: "Learning Test",
      brand: "KWIZERA",
      platform: MarketingPlatform.YouTubeShorts,
      content: {
        hooks: ["Create like a pro"],
        callToActions: ["Try KWIZERA"],
        sellingPoints: ["Fast", "Local"],
      },
      campaign: {
        campaignStructure: "problem-solution",
        customerProblem: "Complex tools",
        solution: "Simple AI studio",
      },
      branding: { brandVoice: "friendly", brandMessaging: "Create easily" },
    });

    const learning = await marketing.completeCampaign("mkt-learn-001", 88);
    expect(learning.success).toBe(true);
    expect(learning.recommendations.length).toBeGreaterThan(0);
    expect(learning.learningId).toBeDefined();

    const history = foundation.getLearningMemoryEngine().getLearningHistory();
    expect(history.some((h) => h.relatedProject === "proj-mkt-001")).toBe(true);

    await core.stop();
  });

  it("links marketing relationships to related memories", async () => {
    const { core, projects, marketing, foundation } = await startCore();
    await seedProject(projects);

    await marketing.createCampaign({
      campaignId: "mkt-rel-001",
      projectId: "proj-mkt-001",
      campaignName: "Relationship Test",
      brand: "KWIZERA",
      tags: ["brand-launch"],
    });

    await foundation.getStorageEngine().storeRecord({
      memoryId: "vid-mkt-001",
      memoryType: MemoryStorageType.Video,
      category: "promotional",
      title: "Related Video",
      description: "Video for marketing campaign",
      source: "test",
      tags: ["brand-launch"],
      relatedProject: "proj-mkt-001",
    });

    await marketing.updateCampaign("mkt-rel-001", { goal: "conversion" });

    const relationships = marketing.getCampaignRelationships("mkt-rel-001");
    expect(relationships).not.toBeNull();
    expect(relationships!.relatedMemories.length).toBeGreaterThanOrEqual(1);

    await core.stop();
  });

  it("supports campaign search by multiple criteria", async () => {
    const { core, projects, marketing } = await startCore();
    await seedProject(projects);

    await marketing.createCampaign({
      campaignId: "mkt-search-001",
      projectId: "proj-mkt-001",
      campaignName: "Searchable Campaign",
      brand: "KWIZERA",
      product: "AI Studio",
      platform: MarketingPlatform.Facebook,
      goal: "conversion",
      language: "en",
      content: {
        hooks: ["Discover the future"],
        callToActions: ["Shop now"],
        keywords: ["ai", "creative"],
      },
      branding: { brandStyle: "modern-bold" },
      tags: ["promo-style"],
    });

    expect(marketing.searchCampaigns({ name: "Searchable" }).length).toBe(1);
    expect(marketing.searchCampaigns({ brand: "KWIZERA" }).length).toBe(1);
    expect(marketing.searchCampaigns({ platform: MarketingPlatform.Facebook }).length).toBe(1);
    expect(marketing.searchCampaigns({ hook: "future" }).length).toBe(1);
    expect(marketing.searchCampaigns({ cta: "Shop" }).length).toBe(1);
    expect(marketing.searchCampaigns({ goal: "conversion" }).length).toBe(1);

    await core.stop();
  });

  it("persists campaigns across application restart", async () => {
    const core1 = createAiCore({ storageRootOverride: storageRoot });
    await core1.start("persist");
    const p1 = core1.getManager().memoryFoundation!.getProjectMemoryEngine();
    const m1 = core1.getManager().memoryFoundation!.getMarketingMemoryEngine();
    await p1.createProject({
      projectId: "proj-persist-mkt",
      projectName: "Persist",
      projectType: ProjectType.Marketing,
      description: "Persist marketing",
    });
    await m1.createCampaign({
      campaignId: "mkt-persist-001",
      projectId: "proj-persist-mkt",
      campaignName: "Persistent Campaign",
      brand: "KWIZERA",
    });
    await core1.stop();

    AiCore.resetInstance();
    const core2 = createAiCore({ storageRootOverride: storageRoot });
    await core2.start("persist-restart");
    const m2 = core2.getManager().memoryFoundation!.getMarketingMemoryEngine();
    const campaign = await m2.getCampaign("mkt-persist-001");
    expect(campaign?.campaignName).toBe("Persistent Campaign");
    await core2.stop();
  });

  it("writes logs and builds status report", async () => {
    const { core, projects, marketing } = await startCore();
    await seedProject(projects);

    await marketing.createCampaign({
      campaignId: "mkt-report-001",
      projectId: "proj-mkt-001",
      campaignName: "Report Test",
      brand: "KWIZERA",
      content: { hooks: ["Test"], callToActions: ["Go"] },
      branding: { brandVoice: "bold" },
    });

    const logDir = path.join(storageRoot, "logs");
    const logFiles = fs.readdirSync(logDir).filter((f) => f.startsWith("marketing-memory-engine"));
    expect(logFiles.length).toBeGreaterThan(0);

    const report = marketing.buildStatusReport();
    expect(report.engineStatus).toBe("operational");
    expect(report.readinessScore).toBeGreaterThanOrEqual(85);
    expect(report.totalCampaigns).toBe(1);

    await core.stop();
  });
});
