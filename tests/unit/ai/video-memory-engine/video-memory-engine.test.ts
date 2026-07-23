import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AiCore, createAiCore, MemoryStorageType, ProjectType, VideoStatus } from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-video-memory-test-"));
}

const sampleScenes = [
  {
    sceneOrder: 1,
    sceneDuration: 5,
    scenePurpose: "hook",
    productFocus: "hero-product",
    background: "gradient-dark",
    cameraMovement: "zoom-in",
    animationStyle: "kinetic-text",
    visualEffects: "glow",
    transitionType: "fade",
    textPlacement: "center",
    subtitleStyle: "bold-white",
  },
  {
    sceneOrder: 2,
    sceneDuration: 8,
    scenePurpose: "product-showcase",
    productFocus: "hero-product",
    background: "studio",
    cameraMovement: "pan-right",
    animationStyle: "slide-up",
    visualEffects: "none",
    transitionType: "slide",
    textPlacement: "bottom",
    subtitleStyle: "minimal",
  },
  {
    sceneOrder: 3,
    sceneDuration: 4,
    scenePurpose: "call-to-action",
    productFocus: "logo",
    background: "brand-color",
    cameraMovement: "static",
    animationStyle: "pulse",
    visualEffects: "sparkle",
    transitionType: "fade",
    textPlacement: "center",
    subtitleStyle: "bold-white",
  },
];

describe("AiVideoMemoryEngine", () => {
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
    await core.start("video-memory-test");
    const foundation = core.getManager().memoryFoundation!;
    const projects = foundation.getProjectMemoryEngine();
    const videos = foundation.getVideoMemoryEngine();
    return { core, foundation, projects, videos };
  }

  async function seedProject(projects: ReturnType<Awaited<ReturnType<typeof startCore>>["projects"]>) {
    await projects.createProject({
      projectId: "proj-video-001",
      projectName: "Video Test Project",
      projectType: ProjectType.Promotional,
      description: "Project for video memory tests",
      tags: ["kwizera", "brand"],
    });
  }

  it("initializes with memory foundation startup", async () => {
    const { core, videos } = await startCore();
    expect(videos.isInitialized()).toBe(true);
    expect(videos.isStartupComplete()).toBe(true);

    const videoDir = path.join(storageRoot, "memory", "videos");
    expect(fs.existsSync(videoDir)).toBe(true);

    await core.stop();
  });

  it("creates and stores video memory with profile", async () => {
    const { core, projects, videos } = await startCore();
    await seedProject(projects);

    const result = await videos.createVideo({
      videoId: "vid-test-001",
      projectId: "proj-video-001",
      videoName: "KWIZERA Launch Promo",
      productType: "software",
      brand: "KWIZERA",
      category: "promotional",
      targetAudience: "Creators",
      marketingGoal: "Brand awareness",
      language: "en",
      duration: 30,
      resolution: "1920x1080",
      aspectRatio: "16:9",
      exportFormat: "mp4",
      tags: ["launch", "promo"],
    });

    expect(result.success).toBe(true);

    const video = await videos.getVideo("vid-test-001");
    expect(video).not.toBeNull();
    expect(video!.brand).toBe("KWIZERA");
    expect(video!.scores.videoQualityScore).toBeGreaterThan(0);

    await core.stop();
  });

  it("stores scene, audio, marketing, and visual memory", async () => {
    const { core, projects, videos } = await startCore();
    await seedProject(projects);

    await videos.createVideo({
      videoId: "vid-scenes-001",
      projectId: "proj-video-001",
      videoName: "Scene Memory Test",
      brand: "KWIZERA",
      scenes: sampleScenes,
      audio: {
        backgroundMusic: "upbeat-corporate",
        voiceStyle: "professional",
        voiceLanguage: "en",
        narration: "Discover KWIZERA AI STUDIO",
        soundEffects: ["whoosh", "click"],
        audioTiming: "sync-to-scenes",
        audioQuality: "high",
      },
      marketing: {
        hook: "Transform your creative workflow",
        callToAction: "Start creating today",
        sellingPoints: ["AI-powered", "Local-first", "Fast exports"],
        emotionalStrategy: "inspiration",
        brandingStyle: "modern-bold",
        productPresentationStyle: "hero-focus",
        marketingStructure: "hook-problem-solution-cta",
      },
      visual: {
        productPosition: "center",
        lightingStyle: "studio-bright",
        colorPalette: ["#1a1a2e", "#e94560", "#ffffff"],
        typography: "sans-bold",
        iconStyle: "flat",
        motionStyle: "dynamic",
        introStyle: "logo-reveal",
        outroStyle: "brand-lockup",
        logoAnimation: "scale-fade",
      },
    });

    const video = await videos.getVideo("vid-scenes-001");
    expect(video!.scenes).toHaveLength(3);
    expect(video!.audio.backgroundMusic).toBe("upbeat-corporate");
    expect(video!.marketing.hook).toContain("Transform");
    expect(video!.visual.colorPalette).toHaveLength(3);
    expect(video!.scores.marketingScore).toBeGreaterThan(50);

    await core.stop();
  });

  it("detects patterns from video structure", async () => {
    const { core, projects, videos } = await startCore();
    await seedProject(projects);

    await videos.createVideo({
      videoId: "vid-patterns-001",
      projectId: "proj-video-001",
      videoName: "Pattern Detection Test",
      brand: "KWIZERA",
      scenes: sampleScenes,
      marketing: {
        hook: "See the future of creation",
        callToAction: "Download now",
        brandingStyle: "bold",
      },
      visual: { introStyle: "fade-in", logoAnimation: "spin" },
    });

    const update = await videos.updateVideo("vid-patterns-001", {
      scenes: sampleScenes,
    });

    expect(update.patternsDetected).toBeGreaterThan(0);
    expect(videos.getDetectedPatterns().length).toBeGreaterThan(0);
    expect(videos.getReusablePatterns().length).toBeGreaterThan(0);

    await core.stop();
  });

  it("learns from completed videos", async () => {
    const { core, projects, videos, foundation } = await startCore();
    await seedProject(projects);

    await videos.createVideo({
      videoId: "vid-learn-001",
      projectId: "proj-video-001",
      videoName: "Learning Test Video",
      brand: "KWIZERA",
      scenes: sampleScenes,
      marketing: {
        hook: "Create faster",
        callToAction: "Try free",
        sellingPoints: ["Speed", "Quality"],
      },
    });

    const learning = await videos.completeVideo("vid-learn-001", 90);
    expect(learning.success).toBe(true);
    expect(learning.strengths.length).toBeGreaterThan(0);
    expect(learning.learningId).toBeDefined();

    const history = foundation.getLearningMemoryEngine().getLearningHistory();
    expect(history.some((h) => h.relatedProject === "proj-video-001")).toBe(true);

    await core.stop();
  });

  it("links video relationships", async () => {
    const { core, projects, videos, foundation } = await startCore();
    await seedProject(projects);

    await videos.createVideo({
      videoId: "vid-rel-001",
      projectId: "proj-video-001",
      videoName: "Relationship Test",
      brand: "KWIZERA",
      category: "promotional",
      tags: ["brand-launch"],
    });

    await foundation.getStorageEngine().storeRecord({
      memoryId: "mkt-vid-001",
      memoryType: MemoryStorageType.Marketing,
      category: "marketing",
      title: "Video Marketing",
      description: "Related marketing",
      source: "test",
      tags: ["brand-launch"],
      relatedProject: "proj-video-001",
    });

    await videos.updateVideo("vid-rel-001", { status: VideoStatus.Editing });

    const relationships = videos.getVideoRelationships("vid-rel-001");
    expect(relationships).not.toBeNull();
    expect(relationships!.relatedMemories.length).toBeGreaterThanOrEqual(1);

    await core.stop();
  });

  it("supports video search by multiple criteria", async () => {
    const { core, projects, videos } = await startCore();
    await seedProject(projects);

    await videos.createVideo({
      videoId: "vid-search-001",
      projectId: "proj-video-001",
      videoName: "Searchable Promo",
      brand: "KWIZERA",
      category: "promotional",
      language: "en",
      marketingGoal: "conversion",
      scenes: sampleScenes,
      audio: { backgroundMusic: "cinematic-epic" },
      tags: ["promo-style"],
    });

    expect(videos.searchVideos({ name: "Searchable" }).length).toBe(1);
    expect(videos.searchVideos({ brand: "KWIZERA" }).length).toBe(1);
    expect(videos.searchVideos({ animation: "kinetic" }).length).toBe(1);
    expect(videos.searchVideos({ transition: "fade" }).length).toBe(1);
    expect(videos.searchVideos({ music: "cinematic" }).length).toBe(1);
    expect(videos.searchVideos({ callToAction: "Start" }).length).toBe(0);

    await core.stop();
  });

  it("persists video memory across restart", async () => {
    const core1 = createAiCore({ storageRootOverride: storageRoot });
    await core1.start("persist");
    const p1 = core1.getManager().memoryFoundation!.getProjectMemoryEngine();
    const v1 = core1.getManager().memoryFoundation!.getVideoMemoryEngine();
    await p1.createProject({
      projectId: "proj-persist-vid",
      projectName: "Persist",
      projectType: ProjectType.Promotional,
      description: "Persist video",
    });
    await v1.createVideo({
      videoId: "vid-persist-001",
      projectId: "proj-persist-vid",
      videoName: "Persistent Video",
      brand: "KWIZERA",
    });
    await core1.stop();

    AiCore.resetInstance();
    const core2 = createAiCore({ storageRootOverride: storageRoot });
    await core2.start("persist-restart");
    const v2 = core2.getManager().memoryFoundation!.getVideoMemoryEngine();
    const video = await v2.getVideo("vid-persist-001");
    expect(video?.videoName).toBe("Persistent Video");
    await core2.stop();
  });

  it("writes logs and builds status report", async () => {
    const { core, projects, videos } = await startCore();
    await seedProject(projects);

    await videos.createVideo({
      videoId: "vid-report-001",
      projectId: "proj-video-001",
      videoName: "Report Test",
      brand: "KWIZERA",
      scenes: sampleScenes,
      marketing: { hook: "Test", callToAction: "Go" },
    });

    const logDir = path.join(storageRoot, "logs");
    const logFiles = fs.readdirSync(logDir).filter((f) => f.startsWith("video-memory-engine"));
    expect(logFiles.length).toBeGreaterThan(0);

    const report = videos.buildStatusReport();
    expect(report.engineStatus).toBe("operational");
    expect(report.readinessScore).toBeGreaterThanOrEqual(85);
    expect(report.totalVideos).toBe(1);

    await core.stop();
  });
});
