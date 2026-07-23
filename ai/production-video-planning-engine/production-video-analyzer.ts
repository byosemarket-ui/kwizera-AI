import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";
import type { VideoUnderstandingRecord } from "../video-understanding-engine/types.js";
import type { SceneDetectionRecord } from "../scene-detection-intelligence-engine/types.js";
import type { TimelineIntelligenceRecord } from "../timeline-intelligence-engine/types.js";
import type { CameraMovementRecord } from "../camera-movement-intelligence-engine/types.js";
import type { MotionIntelligenceRecord } from "../motion-intelligence-engine/types.js";
import type { VideoStyleIntelligenceRecord } from "../video-style-intelligence-engine/types.js";
import type { VideoEnhancementPlanRecord } from "../video-enhancement-planning-engine/types.js";
import type { CreativeVideoIntelligenceRecord } from "../creative-video-intelligence-engine/types.js";
import {
  ProductionVideoAssetInventory,
  ProductionVideoAssetItem,
  ProductionVideoDependencyCheck,
  ProductionVideoDependencyValidation,
  ProductionVideoDeliveryInstructions,
  ProductionVideoExportPreparation,
  ProductionVideoPlatform,
  ProductionVideoPlanningRecommendation,
  ProductionVideoProfile,
  ProductionVideoPlatformRules,
  ProductionVideoRecoveryPlan,
  ProductionVideoRenderPreparation,
  ProductionVideoWorkflowPlanning,
  ProductionVideoWorkflowStep,
} from "./types.js";

export interface UpstreamVideoProductionContext {
  analysis: VideoAnalysisIntelligenceRecord;
  understanding: VideoUnderstandingRecord;
  sceneDetection: SceneDetectionRecord;
  timeline: TimelineIntelligenceRecord;
  camera: CameraMovementRecord;
  motion: MotionIntelligenceRecord;
  style: VideoStyleIntelligenceRecord;
  enhancementPlan: VideoEnhancementPlanRecord;
  creativePlan: CreativeVideoIntelligenceRecord;
  foundationReady: boolean;
  knowledgeConnected: boolean;
  memoryConnected: boolean;
  productIntelligenceConnected: boolean;
  imageIntelligenceConnected: boolean;
}

export class ProductionVideoAnalyzer {
  buildFromIntelligence(
    ctx: UpstreamVideoProductionContext,
    projectId?: string,
    campaign?: string,
    platform?: ProductionVideoPlatform
  ): {
    profile: ProductionVideoProfile;
    workflow: ProductionVideoWorkflowPlanning;
    assets: ProductionVideoAssetInventory;
    dependencies: ProductionVideoDependencyValidation;
    renderPreparation: ProductionVideoRenderPreparation;
    exportPreparation: ProductionVideoExportPreparation;
    deliveryInstructions: ProductionVideoDeliveryInstructions;
    platformRules: ProductionVideoPlatformRules;
    recoveryPlan: ProductionVideoRecoveryPlan;
    recommendations: ProductionVideoPlanningRecommendation[];
    keywords: string[];
  } {
    const { analysis, creativePlan } = ctx;
    const product = analysis.relationships.relatedProducts[0] ?? creativePlan.profile.product;
    const brand = analysis.relationships.relatedBrands[0] ?? creativePlan.profile.brand;
    const campaignName =
      campaign ?? creativePlan.profile.campaign ?? analysis.relationships.relatedCampaigns[0] ?? "default-campaign";
    const targetPlatform = platform ?? this.inferPlatform(creativePlan.profile.platform);

    const dependencies = this.validateDependencies(ctx);
    const assets = this.buildAssetInventory(ctx);
    const workflow = this.buildWorkflow(ctx, dependencies);
    const renderPreparation = this.buildRenderPreparation(analysis, ctx.enhancementPlan, targetPlatform);
    const exportPreparation = this.buildExportPreparation(targetPlatform);
    const deliveryInstructions = this.buildDeliveryInstructions(targetPlatform, creativePlan);
    const platformRules = this.buildPlatformRules(targetPlatform, renderPreparation);
    const recoveryPlan = this.buildRecoveryPlan(dependencies, assets);

    const profile: ProductionVideoProfile = {
      productionPlanId: `production-video-plan-${analysis.videoId}`,
      projectId: projectId ?? creativePlan.profile.projectId,
      videoId: analysis.videoId,
      product,
      brand,
      campaign: campaignName,
      platform: targetPlatform,
      productionVersion: 1,
    };

    const recommendations = this.buildRecommendations(dependencies, assets, workflow, targetPlatform);

    const keywords = [
      ...analysis.keywords,
      ...creativePlan.keywords,
      product,
      brand,
      campaignName,
      targetPlatform,
      "production-video-planning",
      ...Object.values(ProductionVideoWorkflowStep),
      ...recommendations.map((r) => r.category),
    ].filter(Boolean);

    return {
      profile,
      workflow,
      assets,
      dependencies,
      renderPreparation,
      exportPreparation,
      deliveryInstructions,
      platformRules,
      recoveryPlan,
      recommendations,
      keywords,
    };
  }

  validateDependencies(ctx: UpstreamVideoProductionContext): ProductionVideoDependencyValidation {
    const checks: ProductionVideoDependencyCheck[] = [
      this.check("video-intelligence-foundation", "Video Intelligence Foundation", ctx.foundationReady, ctx.foundationReady),
      this.check("video-analysis-engine", "Video Analysis", ctx.analysis, ctx.analysis?.validated),
      this.check("video-understanding-engine", "Video Understanding", ctx.understanding, ctx.understanding?.validated),
      this.check("scene-intelligence", "Scene Detection", ctx.sceneDetection, ctx.sceneDetection?.validated),
      this.check("timeline-intelligence", "Timeline Intelligence", ctx.timeline, ctx.timeline?.validated),
      this.check("camera-intelligence", "Camera Movement Intelligence", ctx.camera, ctx.camera?.validated),
      this.check("motion-intelligence", "Motion Intelligence", ctx.motion, ctx.motion?.validated),
      this.check("video-style-intelligence", "Video Style Intelligence", ctx.style, ctx.style?.validated),
      this.check("video-enhancement-planning", "Video Enhancement Planning", ctx.enhancementPlan, ctx.enhancementPlan?.validated),
      this.check("creative-video-intelligence", "Creative Video Intelligence", ctx.creativePlan, ctx.creativePlan?.validated),
      {
        moduleId: "knowledge-engine",
        moduleName: "Knowledge Engine",
        required: true,
        present: ctx.knowledgeConnected,
        validated: ctx.knowledgeConnected,
        status: ctx.knowledgeConnected ? "passed" : "missing",
        detail: ctx.knowledgeConnected ? "Knowledge bridge connected" : "Knowledge bridge unavailable",
      },
      {
        moduleId: "memory-engine",
        moduleName: "Memory Engine",
        required: true,
        present: ctx.memoryConnected,
        validated: ctx.memoryConnected,
        status: ctx.memoryConnected ? "passed" : "missing",
        detail: ctx.memoryConnected ? "Memory bridge connected" : "Memory bridge unavailable",
      },
      {
        moduleId: "product-intelligence",
        moduleName: "Product Intelligence",
        required: true,
        present: ctx.productIntelligenceConnected,
        validated: ctx.productIntelligenceConnected,
        status: ctx.productIntelligenceConnected ? "passed" : "missing",
        detail: ctx.productIntelligenceConnected ? "Product intelligence bridge connected" : "Product intelligence bridge unavailable",
      },
      {
        moduleId: "image-intelligence",
        moduleName: "Image Intelligence",
        required: true,
        present: ctx.imageIntelligenceConnected,
        validated: ctx.imageIntelligenceConnected,
        status: ctx.imageIntelligenceConnected ? "passed" : "missing",
        detail: ctx.imageIntelligenceConnected ? "Image intelligence bridge connected" : "Image intelligence bridge unavailable",
      },
    ];

    const required = checks.filter((c) => c.required);
    const passedCount = required.filter((c) => c.status === "passed").length;

    return {
      checks,
      allRequiredPassed: passedCount === required.length,
      passedCount,
      totalRequired: required.length,
    };
  }

  private check(
    moduleId: string,
    moduleName: string,
    record: unknown,
    validated?: boolean
  ): ProductionVideoDependencyCheck {
    const present = Boolean(record);
    const isValid = present && validated === true;
    return {
      moduleId,
      moduleName,
      required: true,
      present,
      validated: isValid,
      status: isValid ? "passed" : present ? "invalid" : "missing",
      detail: isValid ? `${moduleName} validated` : present ? `${moduleName} not validated` : `${moduleName} missing`,
    };
  }

  private inferPlatform(creativePlatform: string): ProductionVideoPlatform {
    if (creativePlatform.includes("tiktok")) return ProductionVideoPlatform.TikTok;
    if (creativePlatform.includes("instagram")) return ProductionVideoPlatform.Instagram;
    if (creativePlatform.includes("facebook")) return ProductionVideoPlatform.Facebook;
    if (creativePlatform.includes("youtube")) return ProductionVideoPlatform.YouTube;
    if (creativePlatform.includes("whatsapp")) return ProductionVideoPlatform.WhatsApp;
    if (creativePlatform.includes("television") || creativePlatform.includes("tv")) return ProductionVideoPlatform.Television;
    if (creativePlatform.includes("signage")) return ProductionVideoPlatform.DigitalSignage;
    return ProductionVideoPlatform.Website;
  }

  private buildWorkflow(
    ctx: UpstreamVideoProductionContext,
    deps: ProductionVideoDependencyValidation
  ): ProductionVideoWorkflowPlanning {
    const ready = deps.allRequiredPassed;
    return {
      analysisValidation: ready
        ? `Analysis ${ctx.analysis.analysisId} validated — proceed`
        : "Blocked — video analysis required",
      understandingValidation: ctx.understanding.validated
        ? `Understanding ${ctx.understanding.understandingId} validated`
        : "Understanding validation required",
      sceneValidation: ctx.sceneDetection.validated
        ? `Scene detection ${ctx.sceneDetection.detectionId} validated (${ctx.sceneDetection.scenes.length} scenes)`
        : "Scene validation required",
      timelineValidation: ctx.timeline.validated
        ? `Timeline ${ctx.timeline.timelineId} validated`
        : "Timeline validation required",
      cameraValidation: ctx.camera.validated
        ? `Camera analysis ${ctx.camera.intelligenceId} validated`
        : "Camera validation required",
      motionValidation: ctx.motion.validated
        ? `Motion analysis ${ctx.motion.intelligenceId} validated`
        : "Motion validation required",
      styleValidation: ctx.style.validated
        ? `Style analysis ${ctx.style.intelligenceId} validated`
        : "Style validation required",
      enhancementValidation: ctx.enhancementPlan.validated
        ? `Enhancement plan ${ctx.enhancementPlan.intelligenceId} approved (non-destructive)`
        : "Enhancement validation pending",
      creativeValidation: ctx.creativePlan.validated
        ? `Creative plan ${ctx.creativePlan.profile.creativeVideoId} production-ready`
        : "Creative validation required",
      renderingPreparation: "Render instructions prepared — no rendering performed",
      exportPreparation: "Export formats planned — MP4, MOV, WEBM primary",
      deliveryPreparation: `Delivery workflow for ${ctx.creativePlan.profile.platform} prepared`,
    };
  }

  private assetItem(
    assetType: string,
    assetId: string,
    source: string,
    ready: boolean,
    note: string
  ): ProductionVideoAssetItem {
    return {
      assetType,
      assetId,
      source,
      status: ready ? "ready" : "planned",
      validationNote: note,
    };
  }

  private buildAssetInventory(ctx: UpstreamVideoProductionContext): ProductionVideoAssetInventory {
    const { analysis, creativePlan, enhancementPlan, style, motion } = ctx;
    const brand = analysis.relationships.relatedBrands[0] ?? creativePlan.profile.brand;
    const hasSource = Boolean(analysis.technical.filePath);
    const hasBrand = Boolean(brand);
    const sceneCount = ctx.sceneDetection.scenes.length;

    return {
      sourceVideos: [
        this.assetItem(
          "source-video",
          analysis.videoId,
          analysis.technical.filePath,
          hasSource,
          hasSource ? "Source video validated — original preserved" : "Source video path missing"
        ),
      ],
      images: [
        this.assetItem(
          "thumbnail",
          `thumb-${analysis.videoId}`,
          "planned",
          true,
          "Thumbnail and still frames planned from source"
        ),
      ],
      audio: [
        this.assetItem(
          "audio-track",
          `audio-${analysis.videoId}`,
          analysis.technical.audioCodec ?? "aac",
          Boolean(analysis.technical.audioCodec),
          "Primary audio track from source"
        ),
      ],
      voice: [
        this.assetItem(
          "voice",
          `voice-${analysis.videoId}`,
          "creative-plan",
          Boolean(creativePlan.audioPlan.voiceStyle),
          creativePlan.audioPlan.voiceStyle
        ),
      ],
      music: [
        this.assetItem(
          "music",
          `music-${analysis.videoId}`,
          "creative-plan",
          Boolean(creativePlan.audioPlan.musicStyle),
          creativePlan.audioPlan.musicStyle
        ),
      ],
      soundEffects: [
        this.assetItem(
          "sfx",
          `sfx-${analysis.videoId}`,
          "creative-plan",
          Boolean(creativePlan.audioPlan.soundEffects),
          creativePlan.audioPlan.soundEffects
        ),
      ],
      logos: [
        this.assetItem("logo", `logo-${brand}`, brand ?? "brand", hasBrand, "Brand logo placement planned"),
      ],
      fonts: [
        this.assetItem(
          "font-primary",
          style.brandStyle.brandTypography ?? "brand-font",
          "style-intelligence",
          Boolean(style.brandStyle.brandTypography),
          creativePlan.visualPlan.typographyStyle
        ),
      ],
      templates: [
        this.assetItem(
          "template",
          creativePlan.profile.creativeVideoId,
          "creative-plan",
          creativePlan.validated,
          creativePlan.templates[0]?.name ?? "Creative template"
        ),
      ],
      motionGraphics: [
        this.assetItem(
          "motion-graphic",
          motion.intelligenceId,
          "motion-intelligence",
          motion.validated,
          creativePlan.visualPlan.motionStyle
        ),
      ],
      effects: [
        this.assetItem(
          "effect",
          `fx-${analysis.videoId}`,
          "enhancement-plan",
          enhancementPlan.validated,
          creativePlan.visualPlan.effectStyle
        ),
      ],
      luts: [
        this.assetItem(
          "lut",
          `lut-${analysis.videoId}`,
          "style-intelligence",
          Boolean(style.visualStyle.colorGradingStyle),
          style.visualStyle.colorGradingStyle ?? creativePlan.visualPlan.colorStyle
        ),
      ],
      captions: [
        this.assetItem(
          "captions",
          `captions-${analysis.videoId}`,
          "planned",
          sceneCount >= 1,
          "Captions planned per scene timing"
        ),
      ],
      subtitles: [
        this.assetItem(
          "subtitles",
          `subtitles-${analysis.videoId}`,
          "planned",
          sceneCount >= 1,
          "Subtitle tracks planned for delivery platforms"
        ),
      ],
      brandAssets: [
        this.assetItem(
          "brand",
          brand ?? creativePlan.profile.brand,
          "brand-profile",
          hasBrand,
          "Brand assets aligned with creative plan"
        ),
      ],
    };
  }

  private buildRenderPreparation(
    analysis: VideoAnalysisIntelligenceRecord,
    enhancementPlan: VideoEnhancementPlanRecord,
    platform: ProductionVideoPlatform
  ): ProductionVideoRenderPreparation {
    const width = analysis.technical.width ?? 1920;
    const height = analysis.technical.height ?? 1080;
    const fps = analysis.technical.fps ?? 30;
    const aspect = width && height ? `${width}:${height}` : "16:9";

    const isVertical = height > width;
    const resolution =
      platform === ProductionVideoPlatform.Television
        ? `${width}x${height} broadcast`
        : platform === ProductionVideoPlatform.TikTok || isVertical
          ? `${width}x${height} vertical`
          : `${width}x${height}`;

    return {
      resolution,
      frameRate: fps,
      aspectRatio: aspect,
      codec: analysis.technical.videoCodec ?? "h264",
      bitrate: enhancementPlan.scores.enhancementReadinessScore >= 80 ? "high (12-20 Mbps)" : "standard (8-12 Mbps)",
      audioFormat: analysis.technical.audioCodec ?? "aac",
      colorProfile: "Rec.709",
      compressionStrategy: enhancementPlan.nonDestructive.preserveOriginal
        ? "Non-destructive master; platform-optimized derivatives"
        : "Balanced compression for platform delivery",
      renderPriority: platform === ProductionVideoPlatform.Website ? "hero-quality" : "platform-optimized",
    };
  }

  private buildExportPreparation(platform: ProductionVideoPlatform): ProductionVideoExportPreparation {
    const base = "Planned export — no files generated";
    return {
      mp4: `${base}; H.264/AAC MP4 for ${platform} delivery`,
      mov: `${base}; ProRes/DNxHD MOV for editing master`,
      mkv: `${base}; MKV for archival and lossless workflows`,
      webm: `${base}; VP9/Opus WEBM for web streaming`,
      gif: platform === ProductionVideoPlatform.WhatsApp ? `${base}; GIF preview for messaging` : "GIF preview planned for social snippets",
      additionalFormatsSupported: true,
    };
  }

  private buildDeliveryInstructions(
    platform: ProductionVideoPlatform,
    creativePlan: CreativeVideoIntelligenceRecord
  ): ProductionVideoDeliveryInstructions {
    return {
      primaryPlatform: platform,
      deliveryNotes: [
        ...creativePlan.productionInstructions.delivery,
        `Primary CTA: ${creativePlan.marketingPlan.ctaStrategy.slice(0, 60)}`,
        `Ending strategy: ${creativePlan.storyboard.endingStrategy.slice(0, 60)}`,
      ],
      packagingStrategy: "Master + platform derivatives + metadata sidecar",
    };
  }

  private buildPlatformRules(
    platform: ProductionVideoPlatform,
    render: ProductionVideoRenderPreparation
  ): ProductionVideoPlatformRules {
    const base = `Production rules for ${render.resolution} @ ${render.frameRate}fps`;
    return {
      tiktok: platform === ProductionVideoPlatform.TikTok ? `${base}; 9:16, under 60s, hook in 3s` : base,
      instagram: platform === ProductionVideoPlatform.Instagram ? `${base}; 9:16 Reels, captions burned-in option` : base,
      facebook: platform === ProductionVideoPlatform.Facebook ? `${base}; 1:1 and 16:9 variants` : base,
      youtube: platform === ProductionVideoPlatform.YouTube ? `${base}; 16:9, chapters from scene timing` : base,
      whatsapp: platform === ProductionVideoPlatform.WhatsApp ? `${base}; compressed under 16MB` : base,
      website: platform === ProductionVideoPlatform.Website ? `${base}; adaptive bitrate streaming prep` : base,
      television: platform === ProductionVideoPlatform.Television ? `${base}; broadcast safe levels, 29.97/30fps` : "TV broadcast rules prepared",
      digitalSignage: platform === ProductionVideoPlatform.DigitalSignage ? `${base}; loop-friendly, no audio dependency option` : "Digital signage rules prepared",
    };
  }

  private buildRecoveryPlan(
    deps: ProductionVideoDependencyValidation,
    assets: ProductionVideoAssetInventory
  ): ProductionVideoRecoveryPlan {
    const missingAssets = this.countMissingAssets(assets);
    return {
      dependencyRecovery: deps.allRequiredPassed
        ? "All dependencies validated — recovery not required"
        : "Re-run upstream video intelligence pipeline for failed modules",
      assetRecovery: missingAssets > 0 ? `Recover ${missingAssets} planned asset(s) before production` : "Asset inventory complete",
      workflowRecovery: "Resume from last validated workflow step on failure",
      renderRecovery: "Preserve original source; retry render with fallback resolution",
      exportRecovery: "Re-export from validated master with alternate format",
      rollbackStrategy: "Non-destructive rollback to original video and validated plans",
    };
  }

  private countMissingAssets(assets: ProductionVideoAssetInventory): number {
    const all = [
      ...assets.sourceVideos,
      ...assets.logos,
      ...assets.fonts,
      ...assets.templates,
      ...assets.brandAssets,
    ];
    return all.filter((a) => a.status === "missing").length;
  }

  private buildRecommendations(
    deps: ProductionVideoDependencyValidation,
    assets: ProductionVideoAssetInventory,
    workflow: ProductionVideoWorkflowPlanning,
    platform: ProductionVideoPlatform
  ): ProductionVideoPlanningRecommendation[] {
    const recs: ProductionVideoPlanningRecommendation[] = [];

    const failed = deps.checks.filter((c) => c.required && c.status !== "passed");
    if (failed.length > 0) {
      recs.push({
        category: "dependency",
        suggestion: `Resolve ${failed.length} dependency issue(s) before production`,
        priority: "high",
        reason: failed.map((f) => f.moduleName).join(", "),
      });
    }

    if (assets.sourceVideos.some((a) => a.status !== "ready")) {
      recs.push({
        category: "asset",
        suggestion: "Validate source video asset before production",
        priority: "high",
        reason: "Source video required for non-destructive production",
      });
    }

    recs.push({
      category: "workflow",
      suggestion: workflow.renderingPreparation,
      priority: "medium",
      reason: "Production workflow sequencing prepared",
    });
    recs.push({
      category: "render",
      suggestion: "Render master at source resolution — no rendering performed in planning",
      priority: "medium",
      reason: "Render instructions prepared for downstream execution",
    });
    recs.push({
      category: "export",
      suggestion: "Primary export: MP4 H.264, MOV editing master, WEBM web derivative",
      priority: "medium",
      reason: "Multi-format export architecture ready",
    });
    recs.push({
      category: "delivery",
      suggestion: `Delivery instructions prepared for ${platform}`,
      priority: "low",
      reason: "Platform delivery workflow planned",
    });
    recs.push({
      category: "platform",
      suggestion: `Platform production rules prepared for ${platform}`,
      priority: "low",
      reason: "Platform optimization planned",
    });
    recs.push({
      category: "recovery",
      suggestion: "Recovery plan prepared — rollback preserves original source",
      priority: "low",
      reason: "Non-destructive production planning",
    });

    return recs;
  }
}
