import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiModulePlugin } from "../core/types.js";
import { DecisionPriority, DecisionType } from "../decision/types.js";
import type {
  ConversationInput,
  ConversationIntent,
  ConversationLanguage,
  ConversationPlan,
  ConversationRecord,
  ConversationResponse,
} from "./types.js";

const MAX_MESSAGE_LENGTH = 6_000;
const MAX_CONVERSATIONS = 100;
const MAX_MESSAGES_PER_CONVERSATION = 100;

const INTENT_RULES: Array<{ intent: ConversationIntent; terms: string[]; engines: string[] }> = [
  { intent: "image-generation", terms: ["image", "photo", "picture", "generate image", "ishusho", "foto"], engines: ["image-generation", "creative-planning"] },
  { intent: "video-production-knowledge", terms: ["video production knowledge", "professional video production", "production workflow", "pre-production", "post-production", "shot planning", "scene planning", "video pacing", "explain video production", "recommend video workflow", "compare video production", "types of marketing videos", "commercial video production"], engines: ["knowledge-foundation", "video-knowledge-engine"] },
  { intent: "camera-knowledge", terms: ["camera knowledge", "camera movement", "camera settings", "recommend camera movement", "dolly", "gimbal", "pan tilt", "depth of field", "aperture", "iso", "shutter speed", "white balance", "focal length", "explain camera", "compare camera movement", "best camera movement", "camera fundamentals"], engines: ["knowledge-foundation", "video-knowledge-engine"] },
  { intent: "lighting-composition-knowledge", terms: ["lighting knowledge", "composition knowledge", "three-point lighting", "key light", "fill light", "rule of thirds", "leading lines", "recommend lighting", "recommend composition", "soft lighting", "hard lighting", "negative space", "visual hierarchy", "product lighting", "portrait lighting", "compare lighting", "compare composition"], engines: ["knowledge-foundation", "video-knowledge-engine"] },
  { intent: "storytelling-scene-knowledge", terms: ["storytelling knowledge", "scene design", "three-act structure", "story structure", "recommend scene", "scene sequence", "emotional journey", "call to action placement", "product storytelling", "brand storytelling", "opening scene", "hero scene", "product reveal", "testimonial scene", "build story", "narrative flow", "scene planning"], engines: ["knowledge-foundation", "video-knowledge-engine"] },
  { intent: "animation-motion-rendering-knowledge", terms: ["animation knowledge", "motion graphics", "rendering knowledge", "principles of animation", "logo animation", "export settings", "video codecs", "recommend animation", "recommend motion", "recommend render", "squash and stretch", "match cut", "bitrate", "frame rate export", "HDR", "text animation"], engines: ["knowledge-foundation", "video-knowledge-engine"] },
  { intent: "marketing-branding-psychology-knowledge", terms: ["marketing knowledge", "branding knowledge", "customer psychology", "sales psychology", "marketing funnel", "value proposition", "social proof", "recommend marketing", "recommend branding", "hook creation", "first 3 seconds", "cta strategy", "persuasion", "brand identity", "conversion optimization", "product demonstration"], engines: ["knowledge-foundation", "video-knowledge-engine", "marketing-knowledge-engine"] },
  { intent: "social-media-knowledge", terms: ["social media knowledge", "tiktok best practices", "instagram reels", "facebook page", "youtube shorts", "recommend platform", "content calendar", "hashtag strategy", "thumbnail best practices", "platform selection", "community building", "posting best practices", "carousel strategy", "organic reach", "watch time", "stories strategy", "feed strategy"], engines: ["knowledge-foundation", "video-knowledge-engine", "marketing-knowledge-engine"] },
  { intent: "industry-standards-quality-knowledge", terms: ["industry standards", "professional standards", "quality rules", "quality assurance", "quality evaluation", "quality checklist", "evaluate professional quality", "detect quality problems", "recommend quality improvements", "quality review", "approval process", "delivery standards", "production standards", "technical standards", "final approval checklist"], engines: ["knowledge-foundation", "video-knowledge-engine", "knowledge-validation-engine"] },
  { intent: "professional-knowledge-certification", terms: ["professional knowledge certification", "professional knowledge expansion status", "knowledge expansion maturity", "certification status", "professional knowledge gaps", "is professional knowledge complete", "certify professional knowledge"], engines: ["knowledge-foundation", "knowledge-validation-engine", "video-knowledge-engine"] },
  { intent: "professional-reasoning-certification", terms: ["professional reasoning certification", "certify professional reasoning", "reasoning decision certification", "is professional reasoning complete", "professional readiness score", "certify decision intelligence", "reasoning version 1.0"], engines: ["professional-reasoning-certification", "self-review-engine", "multi-domain-engine", "recommendation-engine", "knowledge-foundation"] },
  { intent: "professional-self-review-intelligence", terms: ["self review", "self-review", "professional evaluation", "review my recommendation", "evaluate professional quality", "quality scoring", "detect weak reasoning", "improve recommendation", "overall readiness", "explain weaknesses", "explain strengths", "self improvement"], engines: ["self-review-engine", "multi-domain-engine", "recommendation-engine", "workflow-engine", "knowledge-foundation"] },
  { intent: "professional-multi-domain-intelligence", terms: ["multi-domain reasoning", "multi domain reasoning", "cross-domain reasoning", "combine knowledge domains", "resolve domain conflict", "conflicting recommendations", "professional multi-domain", "multi-domain intelligence", "explain cross-domain", "domains participating"], engines: ["multi-domain-engine", "recommendation-engine", "workflow-engine", "decision-engine", "knowledge-foundation"] },
  { intent: "professional-recommendation-intelligence", terms: ["professional recommendation", "recommendation intelligence", "recommend a professional", "recommend professional workflow", "recommend camera settings", "recommend lighting setup", "recommend storytelling strategy", "recommend editing technique", "recommend rendering settings", "recommend marketing strategy", "explain this recommendation", "recommendation alternatives", "recommendation memory", "second best option", "third alternative"], engines: ["recommendation-engine", "workflow-engine", "planning-engine", "decision-engine", "knowledge-foundation"] },
  { intent: "professional-workflow-intelligence", terms: ["professional workflow", "workflow intelligence", "create a professional workflow", "optimize workflow", "reuse workflow", "explain this workflow", "workflow dependencies", "workflow memory", "modify workflow", "detect workflow improvements"], engines: ["workflow-engine", "planning-engine", "decision-engine", "knowledge-foundation"] },
  { intent: "professional-planning-intelligence", terms: ["professional plan", "planning intelligence", "create a professional plan", "execution plan", "task breakdown", "plan workflow", "optimize plan", "modify plan", "reuse plan", "explain this plan", "planning confidence"], engines: ["planning-engine", "decision-engine", "knowledge-foundation", "knowledge-reasoning-engine"] },
  { intent: "professional-decision-intelligence", terms: ["professional decision", "decision intelligence", "make a professional decision", "decide using knowledge foundation", "compare professional solutions", "recommend best workflow", "explain this decision", "decision confidence", "professional decision history"], engines: ["decision-engine", "knowledge-foundation", "knowledge-reasoning-engine"] },
  { intent: "professional-knowledge-reasoning", terms: ["professional reasoning", "reason using knowledge foundation", "compare professional options", "explain professional decision", "knowledge-backed recommendation", "professional solution comparison", "why was this recommendation selected"], engines: ["knowledge-foundation", "knowledge-reasoning-engine", "video-knowledge-engine"] },
  { intent: "video-generation", terms: ["video", "movie", "film", "generate video", "amashusho"], engines: ["video-audio-generation", "creative-planning"] },
  { intent: "product-analysis", terms: ["analyze product", "product analysis", "analyse", "isesengura", "sesengura"], engines: ["product-intelligence", "image-intelligence"] },
  { intent: "product-asset-preparation", terms: ["prepare product assets", "product assets", "background removal", "remove background", "cutout", "asset library", "prepare assets", "product cutout"], engines: ["product-asset-preparation", "product-intelligence", "image-intelligence"] },
  { intent: "product-scene-planning", terms: ["product scene plan", "plan product scenes", "product scene planning", "marketing scene plan", "scene sequence for product", "explain product scenes", "missing product scenes", "weak marketing flow"], engines: ["product-scene-planning", "product-asset-preparation", "product-intelligence"] },
  { intent: "product-storyboard", terms: ["product storyboard", "marketing script", "generate storyboard", "storyboard and script", "voice script", "visual script", "explain storyboard", "explain script", "storyboard improvements"], engines: ["product-storyboard", "product-scene-planning", "product-asset-preparation", "product-intelligence"] },
  { intent: "product-prompt-orchestration", terms: ["prompt orchestration", "orchestrate prompts", "prompt intelligence", "model orchestration", "execution plan", "explain prompts", "prompt conflicts", "select ai model", "optimize prompts"], engines: ["product-prompt-orchestration", "product-storyboard", "product-scene-planning", "product-asset-preparation", "product-intelligence"] },
  { intent: "product-image-generation", terms: ["product image generation", "generate scene images", "marketing stills", "enhance product images", "background generation", "compose product scenes", "explain generated images", "scene marketing images"], engines: ["product-image-generation", "product-prompt-orchestration", "product-storyboard", "product-asset-preparation", "product-intelligence"] },
  { intent: "product-video-generation", terms: ["product video generation", "generate product video", "animate product scenes", "camera motion", "cinematic product video", "explain video scenes", "video marketing flow"], engines: ["product-video-generation", "product-image-generation", "product-prompt-orchestration", "product-storyboard", "product-intelligence"] },
  { intent: "product-audio-generation", terms: ["product audio generation", "generate voice over", "background music", "sound effects", "audio mix", "narration sync", "explain voice selection", "audio synchronization"], engines: ["product-audio-generation", "product-video-generation", "product-prompt-orchestration", "product-storyboard", "product-intelligence"] },
  { intent: "product-rendering-export", terms: ["render video", "export video", "delivery package", "platform export", "render settings", "re-render", "export presets", "final marketing video"], engines: ["product-rendering-export", "product-audio-generation", "product-video-generation", "product-storyboard", "product-intelligence"] },
  { intent: "creative-generation-certification", terms: ["creative generation certification", "certify creative pipeline", "product to video certification", "production readiness", "certify marketing video pipeline", "creative generation report"], engines: ["creative-generation-certification", "product-rendering-export", "product-audio-generation", "product-video-generation", "product-intelligence"] },
  { intent: "editing", terms: ["edit", "change", "retouch", "hindura", "kosora"], engines: ["creative-workspace", "image-generation"] },
  { intent: "marketing", terms: ["marketing", "campaign", "audience", "cta", "ubukangurambaga", "abakiriya"], engines: ["marketing-intelligence", "creative-planning"] },
  { intent: "business-intelligence", terms: ["business", "sales", "revenue", "inventory", "stock", "forecast", "recommendation", "analytics", "ubucuruzi", "igurisha", "ububiko"], engines: ["business-intelligence", "decision-engine", "memory-foundation", "knowledge-foundation"] },
  { intent: "workspace-synchronization", terms: ["synchronization", "synchronize", "sync", "backup workspace", "restore workspace", "offline workspace", "cloud workspace"], engines: ["workspace-synchronization", "memory-backup-engine", "desktop-integration"] },
  { intent: "enterprise-integration", terms: ["connector", "integration", "webhook", "external api", "erp", "crm", "oauth"], engines: ["enterprise-integration", "connector-management", "plugin-management"] },
  { intent: "enterprise-collaboration", terms: ["organization", "team", "teams", "permissions", "permission", "collaboration", "collaborate", "members", "member", "audit log", "notifications", "workspace lock"], engines: ["enterprise-collaboration", "creative-workspace", "workspace-synchronization"] },
  { intent: "publishing-distribution", terms: ["publishing status", "distribution status", "schedule campaign", "content delivery", "publish", "publishing", "distribution"], engines: ["publishing-distribution", "creative-review", "connector-management"] },
  { intent: "translation", terms: ["translate", "translation", "hindura mu", "ubuhinduzi"], engines: ["language-knowledge"] },
  { intent: "knowledge-persistence", terms: ["knowledge persistence", "restart verification", "knowledge seeding", "seeding certification", "permanently remember", "knowledge certificate", "knowledge health report"], engines: ["knowledge-foundation"] },
  { intent: "knowledge-import", terms: ["import knowledge", "knowledge import", "activate knowledge", "foundation activation", "imported knowledge", "sync knowledge", "knowledge foundation active"], engines: ["knowledge-foundation", "knowledge-validation-engine"] },
  { intent: "knowledge-validation-integration", terms: ["validation integration", "integrate knowledge", "knowledge foundation update", "why was knowledge accepted", "why was knowledge rejected", "knowledge version history", "search imported knowledge", "validate staged knowledge"], engines: ["knowledge-validation-integration", "knowledge-foundation", "knowledge-research-engine"] },
  { intent: "knowledge-evolution", terms: ["knowledge evolution", "evolve knowledge", "what changed in knowledge", "compare knowledge versions", "recommend latest knowledge", "deprecated knowledge", "continuous knowledge update"], engines: ["knowledge-evolution", "knowledge-validation-integration", "knowledge-foundation"] },
  { intent: "feedback-intelligence", terms: ["feedback intelligence", "user feedback learning", "learn from feedback", "preference profile", "user preference learning", "what was learned from feedback", "feedback root cause", "project feedback history"], engines: ["feedback-intelligence", "knowledge-foundation"] },
  { intent: "performance-analytics", terms: ["performance analytics", "production intelligence", "pipeline performance", "bottleneck detection", "resource usage analytics", "model performance", "production dashboard", "predict production time", "compare production sessions"], engines: ["performance-analytics", "knowledge-foundation"] },
  { intent: "autonomous-learning", terms: ["autonomous learning", "knowledge expansion", "self learning", "learn new knowledge automatically", "expand knowledge packs", "what was newly learned", "intelligent knowledge expansion"], engines: ["autonomous-learning", "knowledge-foundation"] },
  { intent: "workflow-model-optimization", terms: ["workflow optimization", "ai model optimization", "optimize workflow", "adaptive model selection", "recommend efficient workflow", "compare workflow versions", "predict production quality", "model combination"], engines: ["workflow-model-optimization", "knowledge-foundation"] },
  { intent: "autonomous-improvement", terms: ["autonomous improvement", "self optimization", "self improvement", "apply safe improvements", "rollback improvement", "improvement memory", "why was improvement applied"], engines: ["autonomous-improvement", "knowledge-foundation"] },
  { intent: "autonomous-intelligence-validation", terms: ["autonomous intelligence validation", "production readiness", "validate autonomous capabilities", "readiness score", "learning validation", "safety validation", "production simulation"], engines: ["autonomous-intelligence-validation", "knowledge-foundation"] },
  { intent: "learning-certification", terms: ["learning certification", "continuous improvement certification", "certify learning system", "learning version 1.0", "is learning certified", "overall intelligence score"], engines: ["learning-certification", "knowledge-foundation"] },
  { intent: "personal-project-workspace", terms: ["personal workspace", "project workspace", "create local project", "resume project", "workspace dashboard", "search my projects", "project history", "continue unfinished work", "auto save workspace"], engines: ["personal-project-workspace", "knowledge-foundation"] },
  { intent: "local-asset-library", terms: ["asset library", "local assets", "find assets", "search assets", "import assets", "duplicate assets", "asset tags", "black shoe photos", "recommend assets", "asset versions"], engines: ["local-asset-library", "knowledge-foundation"] },
  { intent: "local-production-queue", terms: ["production queue", "job queue", "pause job", "resume job", "cancel job", "retry job", "queue status", "job priority", "production jobs", "why is job waiting"], engines: ["local-production-queue", "knowledge-foundation"] },
  { intent: "local-resource-manager", terms: ["resource manager", "cpu usage", "gpu usage", "production mode", "power saving", "system health", "resource forecast", "why was job delayed", "hardware upgrade", "balanced mode"], engines: ["local-resource-manager", "knowledge-foundation"] },
  { intent: "automation-engine", terms: ["automation engine", "studio maintenance", "run maintenance", "incremental backup", "cache cleanup", "log rotation", "maintenance schedule", "restore point", "auto save workspace"], engines: ["automation-engine", "knowledge-foundation"] },
  { intent: "workspace-manager", terms: ["workspace manager", "module status", "restart module", "resume session", "workspace status", "orchestrate modules", "session recovery", "active workspace"], engines: ["workspace-manager", "knowledge-foundation"] },
  { intent: "knowledge-validation", terms: ["knowledge validation", "validate knowledge", "certify knowledge", "knowledge certification", "certified packs", "pack quality", "professional readiness"], engines: ["knowledge-validation-engine", "knowledge-foundation"] },
  { intent: "knowledge-packs", terms: ["knowledge pack", "knowledge packs", "extract knowledge", "knowledge extraction", "professional knowledge", "decision rules", "best practices pack", "knowledge workflows"], engines: ["knowledge-processing-engine", "knowledge-foundation"] },
  { intent: "knowledge-documents", terms: ["document understanding", "understood documents", "search documents", "document summary", "summarize document", "explain document", "recommend documents", "missing topics", "document index"], engines: ["knowledge-processing-engine", "knowledge-foundation"] },
  { intent: "knowledge-collection", terms: ["collected resources", "knowledge collection", "local knowledge workspace", "workspace resources", "what resources collected", "missing knowledge resources", "collect knowledge", "resource metadata"], engines: ["knowledge-research-engine", "knowledge-foundation"] },
  { intent: "online-research", terms: ["online research", "research online", "professional research mode", "detect internet", "trusted online sources", "knowledge acquisition engine", "stage research download", "why was source rejected", "why was source selected", "recommend research topics"], engines: ["knowledge-research-engine", "knowledge-source-manager", "knowledge-foundation"] },
  { intent: "knowledge-sources", terms: ["trusted source", "trusted sources", "source discovery", "best source", "recommend source", "missing sources", "knowledge sources", "source ranking"], engines: ["knowledge-source-manager", "knowledge-foundation"] },
  { intent: "knowledge-domains", terms: ["knowledge domain", "knowledge domains", "domain hierarchy", "learning priorities", "available knowledge", "missing knowledge", "what knowledge do we have", "domain planning"], engines: ["knowledge-domain-planning", "knowledge-foundation"] },
  { intent: "knowledge-acquisition", terms: ["learn ", "teach our ai", "teach ai", "research ", "improve our", "improve ", "knowledge foundation"], engines: ["knowledge-acquisition", "knowledge-foundation", "knowledge-validation"] },
  { intent: "project-management", terms: ["project", "open project", "create project", "umushinga"], engines: ["creative-workspace", "project-memory"] },
  { intent: "system", terms: ["status", "health", "system", "settings", "imikorere"], engines: ["ai-core", "health-monitor"] },
];

interface ConversationStore {
  conversations: ConversationRecord[];
}

export interface ConversationExecutionDispatcher {
  dispatch(projectId: string, plan: ConversationPlan): Promise<{ jobId: string }>;
}

export interface WorkspaceSynchronizationStatusProvider {
  getSummary(): { cloudState: string; trackedFiles: number; queuedChanges: number; unresolvedConflicts: number; lastBackupAt: string | null } | null;
}

export interface EnterpriseIntegrationStatusProvider {
  getSummary(): { total: number; enabled: number; unhealthy: number; routes: number; webhooks: number } | null;
}

export interface PublishingDistributionStatusProvider {
  getSummary(): { packages: number; scheduled: number; readyLocal: number; published: number; failed: number; connectedProfiles: number } | null;
}

export interface EnterpriseCollaborationStatusProvider {
  getSummary(): { organizations: number; teams: number; users: number; activeLocks: number; activePresence: number; unreadNotifications: number } | null;
}

export interface RuntimeStatusProvider {
  getSummary(): { providers: Array<{ name: string; available: boolean; models: number; error?: string }>; gpuName?: string; vramFreeMb?: number } | null;
}

export interface ProductIntelligenceConversationProvider {
  isInitialized(): boolean;
  analyzeProductIntelligence(projectId: string): Promise<import("../product-intelligence/types.js").ProductIntelligenceProfile>;
  explainProduct(projectId: string): Promise<import("../product-intelligence/types.js").ProductIntelligenceExplainResult>;
  getAiMeProductIntelligenceAwareness(): import("../product-intelligence/types.js").AiMeProductIntelligenceAwareness;
}

export interface ProductAssetPreparationConversationProvider {
  isInitialized(): boolean;
  prepareProductAssets(projectId: string): Promise<import("../product-asset-preparation/types.js").ProductAssetPreparationResult>;
  explainAssetQuality(projectId: string): Promise<import("../product-asset-preparation/types.js").ProductAssetExplainResult>;
  detectMissingAngles(projectId: string): Promise<import("../product-asset-preparation/types.js").ProductAssetViewType[]>;
  recommendAdditionalPhotos(projectId: string): Promise<import("../product-asset-preparation/types.js").ProductAssetPreparationResult["photoRecommendations"]>;
  getAiMeProductAssetAwareness(): import("../product-asset-preparation/types.js").AiMeProductAssetAwareness;
}

export interface ProductScenePlanningConversationProvider {
  isInitialized(): boolean;
  planProductScenes(projectId: string): Promise<import("../product-scene-planning/types.js").ProductScenePlanResult>;
  explainScenes(projectId: string): Promise<import("../product-scene-planning/types.js").ProductSceneExplainResult>;
  recommendSceneOrder(projectId: string): Promise<string[]>;
  detectMissingScenes(projectId: string): Promise<import("../product-scene-planning/types.js").ProductSceneType[]>;
  detectWeakMarketingFlow(projectId: string): Promise<string[]>;
  getAiMeProductScenePlanningAwareness(): import("../product-scene-planning/types.js").AiMeProductScenePlanningAwareness;
}

export interface ProductStoryboardConversationProvider {
  isInitialized(): boolean;
  generateStoryboardAndScript(projectId: string): Promise<import("../product-storyboard/types.js").ProductStoryboardResult>;
  explainStoryboard(projectId: string): Promise<import("../product-storyboard/types.js").ProductStoryboardExplainResult>;
  recommendImprovements(projectId: string): Promise<string[]>;
  detectMissingScenes(projectId: string): Promise<string[]>;
  detectWeakMarketingFlow(projectId: string): Promise<string[]>;
  getAiMeProductStoryboardAwareness(): import("../product-storyboard/types.js").AiMeProductStoryboardAwareness;
}

export interface ProductPromptOrchestrationConversationProvider {
  isInitialized(): boolean;
  orchestratePromptsAndModels(projectId: string): Promise<import("../product-prompt-orchestration/types.js").ProductPromptOrchestrationResult>;
  explainOrchestration(projectId: string): Promise<import("../product-prompt-orchestration/types.js").ProductPromptOrchestrationExplainResult>;
  recommendPromptImprovements(projectId: string): Promise<string[]>;
  detectPromptConflicts(projectId: string): Promise<string[]>;
  detectOrchestrationFailures(projectId: string): Promise<string[]>;
  getAiMeProductPromptOrchestrationAwareness(): import("../product-prompt-orchestration/types.js").AiMeProductPromptOrchestrationAwareness;
}

export interface ProductImageGenerationConversationProvider {
  isInitialized(): boolean;
  generateProductSceneImages(projectId: string): Promise<import("../product-image-generation/types.js").ProductImageGenerationResult>;
  explainGeneration(projectId: string): Promise<import("../product-image-generation/types.js").ProductImageGenerationExplainResult>;
  recommendImageImprovements(projectId: string): Promise<string[]>;
  getAiMeProductImageGenerationAwareness(): import("../product-image-generation/types.js").AiMeProductImageGenerationAwareness;
}

export interface ProductVideoGenerationConversationProvider {
  isInitialized(): boolean;
  generateProductSceneVideos(projectId: string): Promise<import("../product-video-generation/types.js").ProductVideoGenerationResult>;
  explainGeneration(projectId: string): Promise<import("../product-video-generation/types.js").ProductVideoGenerationExplainResult>;
  recommendImprovements(projectId: string): Promise<string[]>;
  getAiMeProductVideoGenerationAwareness(): import("../product-video-generation/types.js").AiMeProductVideoGenerationAwareness;
}

export interface ProductAudioGenerationConversationProvider {
  isInitialized(): boolean;
  generateProductAudio(projectId: string): Promise<import("../product-audio-generation/types.js").ProductAudioGenerationResult>;
  explainGeneration(projectId: string): Promise<import("../product-audio-generation/types.js").ProductAudioGenerationExplainResult>;
  recommendBetterAudio(projectId: string): Promise<string[]>;
  detectAudioQualityProblems(projectId: string): Promise<string[]>;
  getAiMeProductAudioGenerationAwareness(): import("../product-audio-generation/types.js").AiMeProductAudioGenerationAwareness;
}

export interface ProductRenderingExportConversationProvider {
  isInitialized(): boolean;
  renderAndPackage(projectId: string): Promise<import("../product-rendering-export/types.js").ProductRenderingExportResult>;
  explainRender(projectId: string): Promise<import("../product-rendering-export/types.js").ProductRenderingExportExplainResult>;
  recommendExportSettings(projectId: string): Promise<string[]>;
  detectRenderingProblems(projectId: string): Promise<string[]>;
  comparePresets(projectId: string): Promise<Array<{ platform: string; why: string; width: number; height: number }>>;
  rerender(projectId: string): Promise<import("../product-rendering-export/types.js").ProductRenderingExportResult>;
  getAiMeProductRenderingExportAwareness(): import("../product-rendering-export/types.js").AiMeProductRenderingExportAwareness;
}

export interface CreativeGenerationCertificationConversationProvider {
  isInitialized(): boolean;
  certify(options?: {
    autoRepair?: boolean;
    kinds?: Array<"shoe" | "bag" | "phone" | "watch">;
  }): Promise<import("../creative-generation-certification/types.js").CreativeGenerationCertificationResult>;
  explainCertification(): Promise<import("../creative-generation-certification/types.js").CreativeGenerationCertificationExplainResult>;
  getLatest(): Promise<import("../creative-generation-certification/types.js").CreativeGenerationCertificationResult | null>;
  getAiMeCreativeGenerationCertificationAwareness(): import("../creative-generation-certification/types.js").AiMeCreativeGenerationCertificationAwareness;
}

/**
 * The single AI Me conversation owner. It preserves user turns locally,
 * retrieves existing foundation context, and prepares - but never silently
 * executes - workflow work.
 */
export class AiConversationEngine {
  private core: AiCoreManager | null = null;
  private root = "";
  private store: ConversationStore = { conversations: [] };
  private executionDispatcher: ConversationExecutionDispatcher | null = null;
  private workspaceSynchronizationStatusProvider: WorkspaceSynchronizationStatusProvider | null = null;
  private enterpriseIntegrationStatusProvider: EnterpriseIntegrationStatusProvider | null = null;
  private enterpriseCollaborationStatusProvider: EnterpriseCollaborationStatusProvider | null = null;
  private publishingDistributionStatusProvider: PublishingDistributionStatusProvider | null = null;
  private runtimeStatusProvider: RuntimeStatusProvider | null = null;
  private productIntelligenceProvider: ProductIntelligenceConversationProvider | null = null;
  private productAssetPreparationProvider: ProductAssetPreparationConversationProvider | null = null;
  private productScenePlanningProvider: ProductScenePlanningConversationProvider | null = null;
  private productStoryboardProvider: ProductStoryboardConversationProvider | null = null;
  private productPromptOrchestrationProvider: ProductPromptOrchestrationConversationProvider | null = null;
  private productImageGenerationProvider: ProductImageGenerationConversationProvider | null = null;
  private productVideoGenerationProvider: ProductVideoGenerationConversationProvider | null = null;
  private productAudioGenerationProvider: ProductAudioGenerationConversationProvider | null = null;
  private productRenderingExportProvider: ProductRenderingExportConversationProvider | null = null;
  private creativeGenerationCertificationProvider: CreativeGenerationCertificationConversationProvider | null = null;

  async initialize(core: AiCoreManager, storageRoot: string): Promise<void> {
    this.core = core;
    this.root = path.join(storageRoot, "conversation-engine");
    await fs.mkdir(this.root, { recursive: true });
    this.store = await this.readStore();
  }

  isInitialized(): boolean {
    return Boolean(this.core && this.root);
  }

  list(): ConversationRecord[] {
    return this.store.conversations.map((conversation) => structuredClone(conversation));
  }

  setExecutionDispatcher(dispatcher: ConversationExecutionDispatcher | null): void {
    this.executionDispatcher = dispatcher;
  }

  setWorkspaceSynchronizationStatusProvider(provider: WorkspaceSynchronizationStatusProvider | null): void {
    this.workspaceSynchronizationStatusProvider = provider;
  }

  setEnterpriseIntegrationStatusProvider(provider: EnterpriseIntegrationStatusProvider | null): void {
    this.enterpriseIntegrationStatusProvider = provider;
  }

  setEnterpriseCollaborationStatusProvider(provider: EnterpriseCollaborationStatusProvider | null): void {
    this.enterpriseCollaborationStatusProvider = provider;
  }

  setPublishingDistributionStatusProvider(provider: PublishingDistributionStatusProvider | null): void {
    this.publishingDistributionStatusProvider = provider;
  }

  setRuntimeStatusProvider(provider: RuntimeStatusProvider | null): void {
    this.runtimeStatusProvider = provider;
  }

  setProductIntelligenceProvider(provider: ProductIntelligenceConversationProvider | null): void {
    this.productIntelligenceProvider = provider;
  }

  setProductAssetPreparationProvider(provider: ProductAssetPreparationConversationProvider | null): void {
    this.productAssetPreparationProvider = provider;
  }

  setProductScenePlanningProvider(provider: ProductScenePlanningConversationProvider | null): void {
    this.productScenePlanningProvider = provider;
  }

  setProductStoryboardProvider(provider: ProductStoryboardConversationProvider | null): void {
    this.productStoryboardProvider = provider;
  }

  setProductPromptOrchestrationProvider(provider: ProductPromptOrchestrationConversationProvider | null): void {
    this.productPromptOrchestrationProvider = provider;
  }

  setProductImageGenerationProvider(provider: ProductImageGenerationConversationProvider | null): void {
    this.productImageGenerationProvider = provider;
  }

  setProductVideoGenerationProvider(provider: ProductVideoGenerationConversationProvider | null): void {
    this.productVideoGenerationProvider = provider;
  }

  setProductAudioGenerationProvider(provider: ProductAudioGenerationConversationProvider | null): void {
    this.productAudioGenerationProvider = provider;
  }

  setProductRenderingExportProvider(provider: ProductRenderingExportConversationProvider | null): void {
    this.productRenderingExportProvider = provider;
  }

  setCreativeGenerationCertificationProvider(provider: CreativeGenerationCertificationConversationProvider | null): void {
    this.creativeGenerationCertificationProvider = provider;
  }

  async respond(input: ConversationInput): Promise<ConversationResponse> {
    this.ensureReady();
    const message = normalizeMessage(input.message);
    const language = detectLanguage(message);
    const intent = detectIntent(message);
    const conversation = this.getOrCreate(input.conversationId, input.projectId, language);
    conversation.projectId ??= input.projectId;
    conversation.language = language === "unknown" ? conversation.language : language;
    conversation.messages.push({ id: randomUUID(), role: "user", text: message, createdAt: new Date().toISOString(), intent });

    const confirmation = isConfirmation(message);
    if (confirmation && conversation.pendingKnowledgeRequestId) {
      const imported = await this.core!.knowledgeFoundation?.getKnowledgeAcquisitionEngine().approve(conversation.pendingKnowledgeRequestId);
      conversation.pendingKnowledgeRequestId = undefined;
      const response = imported?.imported
        ? `I imported validated structured knowledge into the Knowledge Foundation as ${imported.knowledgeId}.`
        : `I did not import knowledge: ${imported?.reason ?? "the Knowledge Foundation is unavailable"}.`;
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent: "knowledge-acquisition" });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan: { intent: "knowledge-acquisition", requiredEngines: ["knowledge-acquisition"], complexity: "medium", readyForWorkflow: false, missingInformation: [] },
        response,
        context: await this.retrieveContext(message, conversation.projectId),
        knowledgeAcquisition: imported,
      };
    }
    if (confirmation && conversation.pendingPlan && conversation.projectId) {
      const confirmedPlan = structuredClone(conversation.pendingPlan);
      const execution = await this.dispatch(conversation);
      const response = execution.dispatched
        ? `I started the ${confirmedPlan.intent} workflow for this project. I will keep its progress available in the workspace.`
        : `I could not start the prepared workflow: ${execution.error ?? "the local execution runtime is unavailable"}.`;
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent: confirmedPlan.intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return { conversation: structuredClone(conversation), language, plan: confirmedPlan, response, context: await this.retrieveContext(message, conversation.projectId), execution };
    }

    const context = await this.retrieveContext(message, conversation.projectId);
    if (intent === "creative-generation-certification") {
      const provider = this.creativeGenerationCertificationProvider;
      const awareness = provider?.getAiMeCreativeGenerationCertificationAwareness();
      const missingInformation = !provider?.isInitialized()
        ? ["Creative Generation Certification runtime is not initialized."]
        : [];
      let certification: import("../creative-generation-certification/types.js").CreativeGenerationCertificationResult | undefined;
      let explanation: import("../creative-generation-certification/types.js").CreativeGenerationCertificationExplainResult | undefined;
      if (provider?.isInitialized() && missingInformation.length === 0) {
        certification = await provider.certify({ autoRepair: true });
        explanation = await provider.explainCertification();
      }
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["creative-generation-certification", "product-rendering-export", "product-audio-generation", "product-video-generation", "product-intelligence"],
        complexity: "high",
        readyForWorkflow: false,
        missingInformation: [
          ...missingInformation,
          ...(explanation?.blockers.slice(0, 3) ?? []),
        ],
      };
      const response = explanation
        ? buildCreativeGenerationCertificationResponse(explanation, awareness, certification)
        : missingInformation.length
          ? `Before Creative Generation Certification can run: ${missingInformation.join(" ")}`
          : "Creative Generation Certification is unavailable until the runtime is attached.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        creativeGenerationCertification: explanation,
        creativeGenerationCertificationAwareness: awareness ?? undefined,
        creativeGenerationCertificationResult: certification,
      };
    }
    if (intent === "product-rendering-export") {
      const provider = this.productRenderingExportProvider;
      const productRenderingExportAwareness = provider?.getAiMeProductRenderingExportAwareness();
      const projectId = conversation.projectId ?? input.projectId;
      const missingInformation = !projectId
        ? ["Select or provide the creative project with audio and video ready for rendering."]
        : !provider?.isInitialized()
          ? ["Product Rendering & Export runtime is not initialized."]
          : [];
      let productRenderingExportResult: import("../product-rendering-export/types.js").ProductRenderingExportResult | undefined;
      let productRenderingExport: import("../product-rendering-export/types.js").ProductRenderingExportExplainResult | undefined;
      if (projectId && provider?.isInitialized() && missingInformation.length === 0) {
        productRenderingExportResult = await provider.renderAndPackage(projectId);
        productRenderingExport = await provider.explainRender(projectId);
      }
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["product-rendering-export", "product-audio-generation", "product-video-generation", "product-storyboard", "product-intelligence"],
        complexity: "high",
        readyForWorkflow: false,
        missingInformation: [
          ...missingInformation,
          ...(productRenderingExport?.problems.slice(0, 3) ?? []),
        ],
      };
      const response = productRenderingExport
        ? buildProductRenderingExportResponse(productRenderingExport, productRenderingExportAwareness)
        : missingInformation.length
          ? `Before product rendering can run: ${missingInformation.join(" ")}`
          : "Product Rendering & Export is unavailable until the runtime is attached.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        productRenderingExport,
        productRenderingExportAwareness,
        productRenderingExportResult,
      };
    }
    if (intent === "product-audio-generation") {
      const provider = this.productAudioGenerationProvider;
      const productAudioGenerationAwareness = provider?.getAiMeProductAudioGenerationAwareness();
      const projectId = conversation.projectId ?? input.projectId;
      const missingInformation = !projectId
        ? ["Select or provide the creative project with generated video for audio generation."]
        : !provider?.isInitialized()
          ? ["Product Audio Generation runtime is not initialized."]
          : [];
      let productAudioGenerationResult: import("../product-audio-generation/types.js").ProductAudioGenerationResult | undefined;
      let productAudioGeneration: import("../product-audio-generation/types.js").ProductAudioGenerationExplainResult | undefined;
      if (projectId && provider?.isInitialized() && missingInformation.length === 0) {
        productAudioGenerationResult = await provider.generateProductAudio(projectId);
        productAudioGeneration = await provider.explainGeneration(projectId);
      }
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["product-audio-generation", "product-video-generation", "product-prompt-orchestration", "product-storyboard", "product-intelligence"],
        complexity: "high",
        readyForWorkflow: false,
        missingInformation: [
          ...missingInformation,
          ...(productAudioGeneration?.syncProblems.slice(0, 3) ?? []),
        ],
      };
      const response = productAudioGeneration
        ? buildProductAudioGenerationResponse(productAudioGeneration, productAudioGenerationAwareness)
        : missingInformation.length
          ? `Before product audio generation can run: ${missingInformation.join(" ")}`
          : "Product Audio Generation is unavailable until the runtime is attached.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        productAudioGeneration,
        productAudioGenerationAwareness,
        productAudioGenerationResult,
      };
    }
    if (intent === "product-video-generation") {
      const provider = this.productVideoGenerationProvider;
      const productVideoGenerationAwareness = provider?.getAiMeProductVideoGenerationAwareness();
      const projectId = conversation.projectId ?? input.projectId;
      const missingInformation = !projectId
        ? ["Select or provide the creative project with scene images for video generation."]
        : !provider?.isInitialized()
          ? ["Product Video Generation runtime is not initialized."]
          : [];
      let productVideoGenerationResult: import("../product-video-generation/types.js").ProductVideoGenerationResult | undefined;
      let productVideoGeneration: import("../product-video-generation/types.js").ProductVideoGenerationExplainResult | undefined;
      if (projectId && provider?.isInitialized() && missingInformation.length === 0) {
        productVideoGenerationResult = await provider.generateProductSceneVideos(projectId);
        productVideoGeneration = await provider.explainGeneration(projectId);
      }
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["product-video-generation", "product-image-generation", "product-prompt-orchestration", "product-storyboard", "product-intelligence"],
        complexity: "high",
        readyForWorkflow: false,
        missingInformation,
      };
      const response = productVideoGeneration
        ? buildProductVideoGenerationResponse(productVideoGeneration, productVideoGenerationAwareness)
        : missingInformation.length
          ? `Before product video generation can run: ${missingInformation.join(" ")}`
          : "Product Video Generation is unavailable until the runtime is attached.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        productVideoGeneration,
        productVideoGenerationAwareness,
        productVideoGenerationResult,
      };
    }
    if (intent === "product-image-generation") {
      const provider = this.productImageGenerationProvider;
      const productImageGenerationAwareness = provider?.getAiMeProductImageGenerationAwareness();
      const projectId = conversation.projectId ?? input.projectId;
      const missingInformation = !projectId
        ? ["Select or provide the creative project with orchestrated prompts for image generation."]
        : !provider?.isInitialized()
          ? ["Product Image Generation runtime is not initialized."]
          : [];
      let productImageGenerationResult: import("../product-image-generation/types.js").ProductImageGenerationResult | undefined;
      let productImageGeneration: import("../product-image-generation/types.js").ProductImageGenerationExplainResult | undefined;
      if (projectId && provider?.isInitialized() && missingInformation.length === 0) {
        productImageGenerationResult = await provider.generateProductSceneImages(projectId);
        productImageGeneration = await provider.explainGeneration(projectId);
      }
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["product-image-generation", "product-prompt-orchestration", "product-storyboard", "product-asset-preparation", "product-intelligence"],
        complexity: "high",
        readyForWorkflow: false,
        missingInformation,
      };
      const response = productImageGeneration
        ? buildProductImageGenerationResponse(productImageGeneration, productImageGenerationAwareness)
        : missingInformation.length
          ? `Before product image generation can run: ${missingInformation.join(" ")}`
          : "Product Image Generation is unavailable until the runtime is attached.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        productImageGeneration,
        productImageGenerationAwareness,
        productImageGenerationResult,
      };
    }
    if (intent === "product-prompt-orchestration") {
      const provider = this.productPromptOrchestrationProvider;
      const productPromptOrchestrationAwareness = provider?.getAiMeProductPromptOrchestrationAwareness();
      const projectId = conversation.projectId ?? input.projectId;
      const missingInformation = !projectId
        ? ["Select or provide the creative project with a storyboard for prompt orchestration."]
        : !provider?.isInitialized()
          ? ["Product Prompt Orchestration runtime is not initialized."]
          : [];
      let productPromptOrchestrationResult: import("../product-prompt-orchestration/types.js").ProductPromptOrchestrationResult | undefined;
      let productPromptOrchestration: import("../product-prompt-orchestration/types.js").ProductPromptOrchestrationExplainResult | undefined;
      if (projectId && provider?.isInitialized() && missingInformation.length === 0) {
        productPromptOrchestrationResult = await provider.orchestratePromptsAndModels(projectId);
        productPromptOrchestration = await provider.explainOrchestration(projectId);
      }
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["product-prompt-orchestration", "product-storyboard", "product-scene-planning", "product-asset-preparation", "product-intelligence"],
        complexity: "high",
        readyForWorkflow: false,
        missingInformation: [
          ...missingInformation,
          ...(productPromptOrchestration?.promptConflicts.slice(0, 3) ?? []),
          ...(productPromptOrchestration?.orchestrationFailures.slice(0, 3) ?? []),
        ],
      };
      const response = productPromptOrchestration
        ? buildProductPromptOrchestrationResponse(productPromptOrchestration, productPromptOrchestrationAwareness)
        : missingInformation.length
          ? `Before prompt orchestration can run: ${missingInformation.join(" ")}`
          : "Product Prompt Orchestration is unavailable until the runtime is attached.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        productPromptOrchestration,
        productPromptOrchestrationAwareness,
        productPromptOrchestrationResult,
      };
    }
    if (intent === "product-storyboard") {
      const provider = this.productStoryboardProvider;
      const productStoryboardAwareness = provider?.getAiMeProductStoryboardAwareness();
      const projectId = conversation.projectId ?? input.projectId;
      const missingInformation = !projectId
        ? ["Select or provide the creative project with scene plans for storyboard generation."]
        : !provider?.isInitialized()
          ? ["Product Storyboard runtime is not initialized."]
          : [];
      let productStoryboardResult: import("../product-storyboard/types.js").ProductStoryboardResult | undefined;
      let productStoryboard: import("../product-storyboard/types.js").ProductStoryboardExplainResult | undefined;
      if (projectId && provider?.isInitialized() && missingInformation.length === 0) {
        productStoryboardResult = await provider.generateStoryboardAndScript(projectId);
        productStoryboard = await provider.explainStoryboard(projectId);
      }
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["product-storyboard", "product-scene-planning", "product-asset-preparation", "product-intelligence"],
        complexity: "medium",
        readyForWorkflow: false,
        missingInformation: [
          ...missingInformation,
          ...(productStoryboard?.missingScenes.slice(0, 3) ?? []),
          ...(productStoryboard?.weakFlowNotes.slice(0, 3) ?? []),
        ],
      };
      const response = productStoryboard
        ? buildProductStoryboardResponse(productStoryboard, productStoryboardAwareness)
        : missingInformation.length
          ? `Before product storyboard generation can run: ${missingInformation.join(" ")}`
          : "Product Storyboard is unavailable until the runtime is attached.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        productStoryboard,
        productStoryboardAwareness,
        productStoryboardResult,
      };
    }
    if (intent === "product-scene-planning") {
      const provider = this.productScenePlanningProvider;
      const productScenePlanningAwareness = provider?.getAiMeProductScenePlanningAwareness();
      const projectId = conversation.projectId ?? input.projectId;
      const missingInformation = !projectId
        ? ["Select or provide the creative project with prepared product assets for scene planning."]
        : !provider?.isInitialized()
          ? ["Product Scene Planning runtime is not initialized."]
          : [];
      let productScenePlanResult: import("../product-scene-planning/types.js").ProductScenePlanResult | undefined;
      let productScenePlanning: import("../product-scene-planning/types.js").ProductSceneExplainResult | undefined;
      if (projectId && provider?.isInitialized() && missingInformation.length === 0) {
        productScenePlanResult = await provider.planProductScenes(projectId);
        productScenePlanning = await provider.explainScenes(projectId);
      }
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["product-scene-planning", "product-asset-preparation", "product-intelligence"],
        complexity: "medium",
        readyForWorkflow: false,
        missingInformation: [
          ...missingInformation,
          ...(productScenePlanning?.missingScenes.map((scene) => `Missing scene: ${scene}`) ?? []),
          ...(productScenePlanning?.weakFlowNotes.slice(0, 3) ?? []),
        ],
      };
      const response = productScenePlanning
        ? buildProductScenePlanningResponse(productScenePlanning, productScenePlanningAwareness)
        : missingInformation.length
          ? `Before product scene planning can run: ${missingInformation.join(" ")}`
          : "Product Scene Planning is unavailable until the runtime is attached.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        productScenePlanning,
        productScenePlanningAwareness,
        productScenePlanResult,
      };
    }
    if (intent === "product-asset-preparation") {
      const provider = this.productAssetPreparationProvider;
      const productAssetPreparationAwareness = provider?.getAiMeProductAssetAwareness();
      const projectId = conversation.projectId ?? input.projectId;
      const missingInformation = !projectId
        ? ["Select or provide the creative project that contains product images for asset preparation."]
        : !provider?.isInitialized()
          ? ["Product Asset Preparation runtime is not initialized."]
          : [];
      let productAssetPreparationResult: import("../product-asset-preparation/types.js").ProductAssetPreparationResult | undefined;
      let productAssetPreparation: import("../product-asset-preparation/types.js").ProductAssetExplainResult | undefined;
      if (projectId && provider?.isInitialized() && missingInformation.length === 0) {
        productAssetPreparationResult = await provider.prepareProductAssets(projectId);
        productAssetPreparation = await provider.explainAssetQuality(projectId);
      }
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["product-asset-preparation", "product-intelligence", "image-intelligence"],
        complexity: "medium",
        readyForWorkflow: false,
        missingInformation: [
          ...missingInformation,
          ...(productAssetPreparation?.missingViews.map((view) => `Missing ${view} view`) ?? []),
        ],
      };
      const response = productAssetPreparation
        ? buildProductAssetPreparationResponse(productAssetPreparation, productAssetPreparationAwareness)
        : missingInformation.length
          ? `Before product asset preparation can run: ${missingInformation.join(" ")}`
          : "Product Asset Preparation is unavailable until the runtime is attached.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        productAssetPreparation,
        productAssetPreparationAwareness,
        productAssetPreparationResult,
      };
    }
    if (intent === "product-analysis") {
      const provider = this.productIntelligenceProvider;
      const productIntelligenceAwareness = provider?.getAiMeProductIntelligenceAwareness();
      const projectId = conversation.projectId ?? input.projectId;
      const missingInformation = !projectId
        ? ["Select or provide the creative project that contains the product images and product information."]
        : !provider?.isInitialized()
          ? ["Product Intelligence runtime is not initialized."]
          : [];
      let productIntelligenceProfile: import("../product-intelligence/types.js").ProductIntelligenceProfile | undefined;
      let productIntelligence: import("../product-intelligence/types.js").ProductIntelligenceExplainResult | undefined;
      if (projectId && provider?.isInitialized() && missingInformation.length === 0) {
        productIntelligenceProfile = await provider.analyzeProductIntelligence(projectId);
        productIntelligence = await provider.explainProduct(projectId);
      }
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["product-intelligence", "image-intelligence"],
        complexity: "medium",
        readyForWorkflow: false,
        missingInformation: [
          ...missingInformation,
          ...(productIntelligence?.missingInformation.map((item) => `${item.field}: ${item.recommendation}`) ?? []),
        ],
      };
      const response = productIntelligence
        ? buildProductIntelligenceResponse(productIntelligence, productIntelligenceAwareness)
        : missingInformation.length
          ? `Before product analysis can run: ${missingInformation.join(" ")}`
          : "Product Intelligence is unavailable until the creative product intelligence runtime is attached.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        productIntelligence,
        productIntelligenceAwareness,
        productIntelligenceProfile,
      };
    }
    if (intent === "professional-reasoning-certification") {
      const certificationEngine = this.core!.professionalReasoningCertification;
      const professionalReasoningCertificationAwareness =
        certificationEngine?.getAiMeProfessionalReasoningCertificationAwareness();
      const professionalReasoningCertification =
        certificationEngine && this.core!.knowledgeFoundation?.isStartupComplete()
          ? await certificationEngine.certify({ autoRepair: true })
          : undefined;
      const plan: ConversationPlan = {
        intent,
        requiredEngines: [
          "professional-reasoning-certification",
          "self-review-engine",
          "multi-domain-engine",
          "recommendation-engine",
          "knowledge-foundation",
        ],
        complexity: "high",
        readyForWorkflow: false,
        missingInformation: professionalReasoningCertification?.blockers ?? [],
      };
      const response = professionalReasoningCertification
        ? `${professionalReasoningCertificationAwareness?.summary ?? "Professional Reasoning Certification ready."} ${buildProfessionalReasoningCertificationResponse(professionalReasoningCertification)}`
        : "Professional Reasoning Certification is unavailable until the Certification Engine and Knowledge Foundation complete startup.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        professionalReasoningCertification,
        professionalReasoningCertificationAwareness,
      };
    }
    if (intent === "professional-self-review-intelligence") {
      const selfReviewEngine = this.core!.selfReviewEngine;
      const professionalSelfReviewAwareness = selfReviewEngine?.getAiMeProfessionalSelfReviewAwareness();
      let professionalSelfReview =
        selfReviewEngine && this.core!.knowledgeFoundation?.isStartupComplete()
          ? await selfReviewEngine.reviewProfessional({
              request: message,
              objective: message,
              includeDomainModules: true,
              reuseSimilarReviews: true,
              context: {
                product: context.projectKnown ? conversation.projectId : undefined,
              },
            })
          : undefined;
      if (professionalSelfReview && /explain weaknesses|explain strengths|explain this review|explain self-review/i.test(message)) {
        const explained = selfReviewEngine!.explainProfessionalSelfReview(professionalSelfReview.reviewId);
        professionalSelfReview = {
          ...professionalSelfReview,
          explanation: {
            whyReviewed: explained.whyReviewed,
            objectiveReviewed: explained.objectiveReviewed,
            processesReviewed: explained.processesReviewed,
            knowledgeReferenced: explained.knowledgeReferenced,
            standardsApplied: explained.standardsApplied,
            strengths: explained.strengths,
            weaknesses: explained.weaknesses,
            improvementsMade: explained.improvementsMade,
            confidenceScore: explained.confidenceScore,
          },
        };
      }
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["self-review-engine", "multi-domain-engine", "recommendation-engine", "workflow-engine", "knowledge-foundation"],
        complexity: "medium",
        readyForWorkflow: false,
        missingInformation: professionalSelfReview?.missingInformation.map((item) => item.field) ?? [],
      };
      const response = professionalSelfReview
        ? `${professionalSelfReviewAwareness?.summary ?? "Professional Self-Review ready."} ${buildProfessionalSelfReviewResponse(professionalSelfReview)}`
        : "Professional Self-Review is unavailable until the Self-Review Engine and Knowledge Foundation complete startup.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        professionalSelfReview,
        professionalSelfReviewAwareness,
      };
    }
    if (intent === "professional-multi-domain-intelligence") {
      const multiDomainEngine = this.core!.multiDomainEngine;
      const professionalMultiDomainAwareness = multiDomainEngine?.getAiMeProfessionalMultiDomainAwareness();
      let professionalMultiDomain =
        multiDomainEngine && this.core!.knowledgeFoundation?.isStartupComplete()
          ? await multiDomainEngine.reasonMultiDomain({
              request: message,
              objective: message,
              includeDomainModules: true,
              reuseSimilarReasoning: true,
              context: {
                product: context.projectKnown ? conversation.projectId : undefined,
              },
            })
          : undefined;
      if (professionalMultiDomain && /explain cross-domain|explain this multi-domain|explain multi-domain/i.test(message)) {
        const explained = multiDomainEngine!.explainMultiDomainReasoning(professionalMultiDomain.reasoningId);
        professionalMultiDomain = {
          ...professionalMultiDomain,
          explanation: {
            whySelected: explained.whySelected,
            domainsParticipating: explained.domainsParticipating,
            knowledgePacksUsed: explained.knowledgePacksUsed,
            knowledgeIdsUsed: explained.knowledgeIdsUsed,
            workflowsReferenced: explained.workflowsReferenced,
            decisionRulesApplied: explained.decisionRulesApplied,
            conflictsResolved: explained.conflictsResolved,
            expectedBenefits: explained.expectedBenefits,
            confidenceScore: explained.confidenceScore,
          },
        };
      }
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["multi-domain-engine", "recommendation-engine", "workflow-engine", "decision-engine", "knowledge-foundation"],
        complexity: "medium",
        readyForWorkflow: false,
        missingInformation: professionalMultiDomain?.missingInformation.map((item) => item.field) ?? [],
      };
      const response = professionalMultiDomain
        ? `${professionalMultiDomainAwareness?.summary ?? "Professional Multi-Domain Reasoning ready."} ${buildProfessionalMultiDomainResponse(professionalMultiDomain)}`
        : "Professional Multi-Domain Reasoning is unavailable until the Multi-Domain Engine and Knowledge Foundation complete startup.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        professionalMultiDomain,
        professionalMultiDomainAwareness,
      };
    }
    if (intent === "professional-recommendation-intelligence") {
      const recommendationEngine = this.core!.recommendationEngine;
      const professionalRecommendationAwareness = recommendationEngine?.getAiMeProfessionalRecommendationAwareness();
      let professionalRecommendation =
        recommendationEngine && this.core!.knowledgeFoundation?.isStartupComplete()
          ? await recommendationEngine.recommendProfessional({
              request: message,
              objective: message,
              includeDomainModules: true,
              reuseSimilarRecommendations: true,
              context: {
                product: context.projectKnown ? conversation.projectId : undefined,
              },
            })
          : undefined;
      if (professionalRecommendation && /explain this recommendation|explain recommendation/i.test(message)) {
        const explained = recommendationEngine!.explainProfessionalRecommendation(professionalRecommendation.recommendationId);
        professionalRecommendation = {
          ...professionalRecommendation,
          explanation: {
            whySelected: explained.whySelected,
            knowledgePacksUsed: explained.knowledgePacksUsed,
            knowledgeIdsUsed: explained.knowledgeIdsUsed,
            workflowsConsidered: explained.workflowsConsidered,
            decisionsInfluenced: explained.decisionsInfluenced,
            professionalStandardsApplied: explained.professionalStandardsApplied,
            expectedBenefits: explained.expectedBenefits,
            domainsUsed: explained.domainsUsed,
            rankingReason: explained.rankingReason,
            confidenceScore: explained.confidenceScore,
          },
        };
      }
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["recommendation-engine", "workflow-engine", "planning-engine", "decision-engine", "knowledge-foundation"],
        complexity: "medium",
        readyForWorkflow: false,
        missingInformation: professionalRecommendation?.missingInformation.map((item) => item.field) ?? [],
      };
      const response = professionalRecommendation
        ? `${professionalRecommendationAwareness?.summary ?? "Professional Recommendation Intelligence ready."} ${buildProfessionalRecommendationResponse(professionalRecommendation)}`
        : "Professional Recommendation Intelligence is unavailable until the Recommendation Engine and Knowledge Foundation complete startup.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        professionalRecommendation,
        professionalRecommendationAwareness,
      };
    }
    if (intent === "professional-workflow-intelligence") {
      const workflowEngine = this.core!.workflowEngine;
      const professionalWorkflowAwareness = workflowEngine?.getAiMeProfessionalWorkflowAwareness();
      let professionalWorkflow =
        workflowEngine && this.core!.knowledgeFoundation?.isStartupComplete()
          ? await workflowEngine.createProfessionalWorkflow({
              request: message,
              objective: message,
              includeDomainModules: true,
              reuseSimilarWorkflows: true,
              context: {
                product: context.projectKnown ? conversation.projectId : undefined,
              },
            })
          : undefined;
      if (professionalWorkflow && /optimize workflow|optimize this workflow/i.test(message)) {
        professionalWorkflow = workflowEngine!.optimizeProfessionalWorkflow(professionalWorkflow.workflowId);
      }
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["workflow-engine", "planning-engine", "decision-engine", "knowledge-foundation"],
        complexity: "medium",
        readyForWorkflow: false,
        missingInformation: [],
      };
      const response = professionalWorkflow
        ? `${professionalWorkflowAwareness?.summary ?? "Professional Workflow Intelligence ready."} ${buildProfessionalWorkflowResponse(professionalWorkflow)}`
        : "Professional Workflow Intelligence is unavailable until the Workflow Engine and Knowledge Foundation complete startup.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        professionalWorkflow,
        professionalWorkflowAwareness,
      };
    }
    if (intent === "professional-planning-intelligence") {
      const planningEngine = this.core!.planningEngine;
      const professionalPlanningAwareness = planningEngine?.getAiMeProfessionalPlanningAwareness();
      let professionalPlan =
        planningEngine && this.core!.knowledgeFoundation?.isStartupComplete()
          ? await planningEngine.planProfessional({
              request: message,
              objective: message,
              includeDomainModules: true,
              reuseSimilarPlans: true,
              context: {
                product: context.projectKnown ? conversation.projectId : undefined,
              },
            })
          : undefined;
      if (professionalPlan && /optimize plan|optimize this plan/i.test(message)) {
        professionalPlan = planningEngine!.optimizeProfessionalPlan(professionalPlan.planId);
      }
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["planning-engine", "decision-engine", "knowledge-foundation", "knowledge-reasoning-engine"],
        complexity: "medium",
        readyForWorkflow: false,
        missingInformation: professionalPlan?.missingInformation.map((item) => item.field) ?? [],
      };
      const response = professionalPlan
        ? `${professionalPlanningAwareness?.summary ?? "Professional Planning Intelligence ready."} ${buildProfessionalPlanningResponse(professionalPlan)}`
        : "Professional Planning Intelligence is unavailable until the Planning Engine and Knowledge Foundation complete startup.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        professionalPlan,
        professionalPlanningAwareness,
      };
    }
    if (intent === "professional-decision-intelligence") {
      const decisionEngine = this.core!.decisionEngine;
      const professionalDecisionAwareness = decisionEngine?.getAiMeProfessionalDecisionAwareness();
      const professionalDecision =
        decisionEngine && this.core!.knowledgeFoundation?.isStartupComplete()
          ? await decisionEngine.decideProfessional({
              request: message,
              objective: message,
              includeDomainModules: true,
              context: {
                product: context.projectKnown ? conversation.projectId : undefined,
              },
            })
          : undefined;
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["decision-engine", "knowledge-foundation", "knowledge-reasoning-engine"],
        complexity: "medium",
        readyForWorkflow: false,
        missingInformation: professionalDecision?.missingInformation.map((item) => item.field) ?? [],
      };
      const response = professionalDecision
        ? `${professionalDecisionAwareness?.summary ?? "Professional Decision Intelligence ready."} ${buildProfessionalDecisionResponse(professionalDecision)}`
        : "Professional Decision Intelligence is unavailable until the Decision Engine and Knowledge Foundation complete startup.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        professionalDecision,
        professionalDecisionAwareness,
      };
    }
    if (intent === "professional-knowledge-reasoning") {
      const reasoningEngine = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getKnowledgeReasoningEngine()
        : null;
      const professionalReasoningAwareness = reasoningEngine?.getAiMeAwareness();
      const professionalKnowledge = reasoningEngine
        ? await reasoningEngine.reasonProfessional({
            request: message,
            objective: message,
            includeDomainModules: true,
            context: {
              product: context.projectKnown ? conversation.projectId : undefined,
            },
          })
        : undefined;
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["knowledge-foundation", "knowledge-reasoning-engine", "video-knowledge-engine"],
        complexity: "medium",
        readyForWorkflow: false,
        missingInformation: professionalKnowledge?.missingInformation.map((item) => item.field) ?? [],
      };
      const response = professionalKnowledge
        ? `${professionalReasoningAwareness?.summary ?? "Professional Reasoning Engine ready."} ${buildProfessionalKnowledgeResponse(professionalKnowledge)}`
        : "Professional Reasoning is unavailable until the Knowledge Foundation completes startup.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        professionalKnowledge,
        professionalReasoningAwareness,
      };
    }
    if (intent === "professional-knowledge-certification") {
      const certification = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getProfessionalKnowledgeCertificationEngine()
        : null;
      const professionalKnowledgeCertificationAwareness = certification?.getAiMeAwareness();
      const result = certification?.getLastResult();
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["knowledge-foundation", "knowledge-validation-engine", "video-knowledge-engine"],
        complexity: "low",
        readyForWorkflow: false,
        missingInformation: [],
      };
      const response = professionalKnowledgeCertificationAwareness
        ? buildProfessionalCertificationResponse(professionalKnowledgeCertificationAwareness, result)
        : "Professional Knowledge Certification is unavailable until the Knowledge Foundation completes startup.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        professionalKnowledgeCertificationAwareness,
      };
    }
    if (intent === "industry-standards-quality-knowledge") {
      const industry = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getProfessionalIndustryStandardsQualityKnowledge()
        : null;
      const industryStandardsQualityAwareness = industry?.getAiMeAwareness();
      const quality = industry?.evaluateProfessionalQuality(message);
      const improvement = industry?.recommendImprovement(message);
      const problems = industry?.detectQualityProblems(message);
      const standard = industry?.explainIndustryStandard(message);
      const practices = industry?.recommendBestPractices(message);
      const answered = industry?.answer(message);
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["knowledge-foundation", "video-knowledge-engine", "knowledge-validation-engine"],
        complexity: "low",
        readyForWorkflow: false,
        missingInformation: [],
      };
      const response = industryStandardsQualityAwareness
        ? buildIsqResponse(
            industryStandardsQualityAwareness,
            quality,
            improvement,
            problems,
            standard,
            practices,
            answered
          )
        : "Industry Standards & Professional Quality Knowledge is unavailable until the Knowledge Foundation completes startup.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        industryStandardsQualityAwareness,
      };
    }
    if (intent === "social-media-knowledge") {
      const sm = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getProfessionalSocialMediaKnowledge()
        : null;
      const socialMediaKnowledgeAwareness = sm?.getAiMeAwareness();
      const platform = sm?.recommendPlatform(message);
      const format = sm?.recommendContentFormat(message);
      const posting = sm?.recommendPostingStrategy(message);
      const engagement = sm?.recommendEngagementStrategy(message);
      const explained = sm?.explainPlatformDecision(message);
      const answered = sm?.answer(message);
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["knowledge-foundation", "video-knowledge-engine", "marketing-knowledge-engine"],
        complexity: "low",
        readyForWorkflow: false,
        missingInformation: [],
      };
      const response = socialMediaKnowledgeAwareness
        ? buildSmResponse(socialMediaKnowledgeAwareness, platform, format, posting, engagement, explained, answered)
        : "Professional Social Media Knowledge is unavailable until the Knowledge Foundation completes startup.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        socialMediaKnowledgeAwareness,
      };
    }
    if (intent === "marketing-branding-psychology-knowledge") {
      const mbp = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getProfessionalMarketingBrandingPsychologyKnowledge()
        : null;
      const marketingBrandingPsychologyAwareness = mbp?.getAiMeAwareness();
      const marketing = mbp?.recommendMarketingStrategy(message);
      const branding = mbp?.recommendBrandingStrategy(message);
      const customerPsych = mbp?.explainCustomerPsychology(message);
      const salesPsych = mbp?.explainSalesPsychology(message);
      const cta = mbp?.recommendCta(message);
      const productPresentation = mbp?.recommendProductPresentation(message);
      const answered = mbp?.answer(message);
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["knowledge-foundation", "video-knowledge-engine", "marketing-knowledge-engine"],
        complexity: "low",
        readyForWorkflow: false,
        missingInformation: [],
      };
      const response = marketingBrandingPsychologyAwareness
        ? buildMbpResponse(
            marketingBrandingPsychologyAwareness,
            marketing,
            branding,
            customerPsych,
            salesPsych,
            cta,
            productPresentation,
            answered
          )
        : "Professional Marketing, Branding & Psychology Knowledge is unavailable until the Knowledge Foundation completes startup.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        marketingBrandingPsychologyAwareness,
      };
    }
    if (intent === "animation-motion-rendering-knowledge") {
      const amr = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getProfessionalAnimationMotionRenderingKnowledge()
        : null;
      const animationMotionRenderingAwareness = amr?.getAiMeAwareness();
      const animation = amr?.recommendAnimationStyle(message);
      const motion = amr?.recommendMotionGraphics(message);
      const rendering = amr?.recommendRenderingSettings(message);
      const exportSettings = amr?.recommendExportSettings(message);
      const explained = amr?.explain(message);
      const answered = amr?.answer(message);
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["knowledge-foundation", "video-knowledge-engine"],
        complexity: "low",
        readyForWorkflow: false,
        missingInformation: [],
      };
      const response = animationMotionRenderingAwareness
        ? buildAmrResponse(
            animationMotionRenderingAwareness,
            animation,
            motion,
            rendering,
            exportSettings,
            explained,
            answered
          )
        : "Professional Animation, Motion Graphics & Rendering Knowledge is unavailable until the Knowledge Foundation completes startup.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        animationMotionRenderingAwareness,
      };
    }
    if (intent === "storytelling-scene-knowledge") {
      const ss = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getProfessionalStorytellingSceneKnowledge()
        : null;
      const storytellingSceneAwareness = ss?.getAiMeAwareness();
      const structure = ss?.buildStoryStructure(message);
      const sequence = ss?.recommendSceneSequence(message);
      const emotionalFlow = ss?.recommendEmotionalFlow(message);
      const layout = ss?.recommendSceneLayout(message);
      const explained = ss?.explain(message);
      const answered = ss?.answer(message);
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["knowledge-foundation", "video-knowledge-engine"],
        complexity: "low",
        readyForWorkflow: false,
        missingInformation: [],
      };
      const response = storytellingSceneAwareness
        ? buildStorytellingSceneResponse(
            storytellingSceneAwareness,
            structure,
            sequence,
            emotionalFlow,
            layout,
            explained,
            answered
          )
        : "Professional Storytelling & Scene Design Knowledge is unavailable until the Knowledge Foundation completes startup.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        storytellingSceneAwareness,
      };
    }
    if (intent === "lighting-composition-knowledge") {
      const lc = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getProfessionalLightingCompositionKnowledge()
        : null;
      const lightingCompositionAwareness = lc?.getAiMeAwareness();
      const lighting = lc?.recommendLighting(message);
      const composition = lc?.recommendComposition(message);
      const explained = lc?.explain(message);
      const answered = lc?.answer(message);
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["knowledge-foundation", "video-knowledge-engine"],
        complexity: "low",
        readyForWorkflow: false,
        missingInformation: [],
      };
      const response = lightingCompositionAwareness
        ? buildLightingCompositionResponse(lightingCompositionAwareness, lighting, composition, explained, answered)
        : "Professional Lighting & Composition Knowledge is unavailable until the Knowledge Foundation completes startup.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        lightingCompositionAwareness,
      };
    }
    if (intent === "camera-knowledge") {
      const camera = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getProfessionalCameraKnowledge()
        : null;
      const cameraKnowledgeAwareness = camera?.getAiMeAwareness();
      const movement = camera?.recommendMovement(message);
      const settings = camera?.recommendSettings(message);
      const explained = camera?.explain(message);
      const answered = camera?.answer(message);
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["knowledge-foundation", "video-knowledge-engine"],
        complexity: "low",
        readyForWorkflow: false,
        missingInformation: [],
      };
      const response = cameraKnowledgeAwareness
        ? buildCameraKnowledgeResponse(cameraKnowledgeAwareness, movement, settings, explained, answered)
        : "Professional Camera Knowledge is unavailable until the Knowledge Foundation completes startup.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        cameraKnowledgeAwareness,
      };
    }
    if (intent === "video-production-knowledge") {
      const professional = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getProfessionalVideoProductionKnowledge()
        : null;
      const builder = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getVideoProductionKnowledgeBuilder()
        : null;
      const videoProductionKnowledgeAwareness = professional?.getAiMeAwareness();
      const explained = builder?.explain(message);
      const workflow = builder?.recommendWorkflow(message);
      const practices = builder?.recommendBestPractices(message);
      const answered = builder?.answer(message);
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["knowledge-foundation", "video-knowledge-engine"],
        complexity: "low",
        readyForWorkflow: false,
        missingInformation: [],
      };
      const response = videoProductionKnowledgeAwareness
        ? buildVideoProductionKnowledgeResponse(
            videoProductionKnowledgeAwareness,
            explained,
            workflow,
            practices,
            answered
          )
        : "Professional Video Production Knowledge is unavailable until the Knowledge Foundation completes startup.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        videoProductionKnowledgeAwareness,
        videoKnowledge: builder ? await builder.advise(message, 5) : undefined,
      };
    }
    if (intent === "knowledge-persistence") {
      const certifier = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getKnowledgeSeedingCertifier()
        : null;
      const knowledgePersistenceAwareness = certifier?.getAiMeAwareness();
      const stats = certifier?.getStatistics();
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["knowledge-foundation"],
        complexity: "low",
        readyForWorkflow: false,
        missingInformation: [],
      };
      const response = knowledgePersistenceAwareness
        ? buildKnowledgePersistenceResponse(knowledgePersistenceAwareness, stats, certifier?.getLastCertification() ?? null)
        : "Knowledge persistence certification is unavailable until the local Knowledge Foundation has completed startup.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        knowledgePersistenceAwareness,
      };
    }
    if (intent === "knowledge-import") {
      const importer = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getKnowledgePackImportEngine()
        : null;
      if (importer) {
        await importer.importAllCertified().catch(() => undefined);
        await importer.synchronizeEcosystem().catch(() => undefined);
      }
      const knowledgeImportAwareness = importer?.getAiMeAwareness();
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["knowledge-foundation", "knowledge-validation-engine"],
        complexity: "low",
        readyForWorkflow: false,
        missingInformation: [],
      };
      const response = knowledgeImportAwareness
        ? buildKnowledgeImportResponse(knowledgeImportAwareness)
        : "Knowledge import is unavailable until the local Knowledge Foundation has completed startup.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        knowledgeImportAwareness,
      };
    }
    if (intent === "knowledge-validation") {
      const packValidation = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getKnowledgePackValidationEngine()
        : null;
      if (packValidation) {
        await packValidation.validateAllPacks({ improve: true }).catch(() => undefined);
      }
      const knowledgePackValidationAwareness = packValidation?.getAiMeAwareness();
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["knowledge-validation-engine", "knowledge-foundation"],
        complexity: "low",
        readyForWorkflow: false,
        missingInformation: [],
      };
      const response = knowledgePackValidationAwareness
        ? buildKnowledgePackValidationResponse(knowledgePackValidationAwareness, packValidation)
        : "Knowledge pack validation is unavailable until the local Knowledge Foundation has completed startup.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        knowledgePackValidationAwareness,
      };
    }
    if (intent === "knowledge-packs") {
      const extraction = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getKnowledgeExtractionEngine()
        : null;
      if (extraction) {
        await extraction.extractAllUnderstood().catch(() => undefined);
      }
      const knowledgePackAwareness = extraction?.getAiMeAwareness();
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["knowledge-processing-engine", "knowledge-foundation"],
        complexity: "low",
        readyForWorkflow: false,
        missingInformation: [],
      };
      const response = knowledgePackAwareness
        ? buildKnowledgePackResponse(knowledgePackAwareness)
        : "Knowledge pack extraction is unavailable until the local Knowledge Foundation has completed startup.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        knowledgePackAwareness,
      };
    }
    if (intent === "knowledge-documents") {
      const understanding = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getDocumentUnderstandingEngine()
        : null;
      if (understanding) {
        await understanding.understandAllCollected().catch(() => undefined);
      }
      const documentAwareness = understanding?.getAiMeAwareness();
      const searchQuery = extractDocumentQuery(message);
      const searchHits = understanding && searchQuery ? understanding.searchDocuments(searchQuery) : [];
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["knowledge-processing-engine", "knowledge-foundation"],
        complexity: "low",
        readyForWorkflow: false,
        missingInformation: [],
      };
      const response = documentAwareness
        ? buildDocumentUnderstandingResponse(documentAwareness, searchHits, searchQuery)
        : "Document understanding is unavailable until the local Knowledge Foundation has completed startup.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        documentAwareness,
      };
    }
    if (intent === "online-research") {
      const research = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getKnowledgeResearchEngine()
        : null;
      const missingInformation = !research
        ? ["Online Research Engine is unavailable until the local Knowledge Foundation has completed startup."]
        : [];
      let onlineResearchSession: import("../knowledge-research-engine/types.js").OnlineResearchSessionResult | undefined;
      const onlineResearchAwareness = research?.getAiMeOnlineResearchAwareness();
      if (research && missingInformation.length === 0) {
        const topicMatch = message.match(/(?:research|learn about|study)\s+(.+)$/i);
        onlineResearchSession = await research.runOnlineResearchSession({
          topic: topicMatch?.[1]?.trim() || "Product Marketing Video Production",
          probeLiveNetwork: false,
        });
      }
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["knowledge-research-engine", "knowledge-source-manager", "knowledge-foundation"],
        complexity: "medium",
        readyForWorkflow: false,
        missingInformation: [
          ...missingInformation,
          ...(onlineResearchSession?.issuesFound.slice(0, 2) ?? []),
        ],
      };
      const response = onlineResearchSession
        ? buildOnlineResearchResponse(onlineResearchSession, onlineResearchAwareness)
        : missingInformation.length
          ? `Before online research can run: ${missingInformation.join(" ")}`
          : "Online Research Engine is unavailable.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        onlineResearchAwareness,
        onlineResearchSession,
      };
    }
    if (intent === "knowledge-evolution") {
      const engine = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getKnowledgeEvolutionEngine()
        : null;
      const missingInformation = !engine
        ? ["Knowledge Evolution is unavailable until the Knowledge Foundation has completed startup."]
        : [];
      const knowledgeEvolutionAwareness = engine?.getAiMeKnowledgeEvolutionAwareness();
      const knowledgeEvolutionResult = engine?.getLatestRun() ?? undefined;
      const sampleId = knowledgeEvolutionResult?.newKnowledgeAdded[0]?.id
        ?? knowledgeEvolutionResult?.updatedPacks[0]?.itemId;
      const explanation = sampleId && engine ? engine.explainEvolution(sampleId) : null;
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["knowledge-evolution", "knowledge-validation-integration", "knowledge-foundation"],
        complexity: "medium",
        readyForWorkflow: false,
        missingInformation,
      };
      const response = knowledgeEvolutionAwareness
        ? buildKnowledgeEvolutionResponse(knowledgeEvolutionAwareness, knowledgeEvolutionResult, explanation)
        : missingInformation.join(" ");
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        knowledgeEvolutionAwareness,
        knowledgeEvolutionResult,
      };
    }
    if (intent === "feedback-intelligence") {
      const engine = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getFeedbackIntelligenceEngine()
        : null;
      const missingInformation = !engine
        ? ["Feedback Intelligence is unavailable until the Knowledge Foundation has completed startup."]
        : [];
      const feedbackIntelligenceAwareness = engine?.getAiMeAwareness();
      const feedbackIntelligenceResult = engine?.getLatestRun() ?? undefined;
      const sampleId = feedbackIntelligenceResult?.analyzed[0]?.id
        ?? engine?.getAllFeedback()[0]?.id;
      const explanation = engine ? engine.explain(sampleId) : null;
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["feedback-intelligence", "knowledge-foundation"],
        complexity: "medium",
        readyForWorkflow: false,
        missingInformation,
      };
      const response = feedbackIntelligenceAwareness
        ? buildFeedbackIntelligenceResponse(feedbackIntelligenceAwareness, feedbackIntelligenceResult, explanation)
        : missingInformation.join(" ");
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        feedbackIntelligenceAwareness,
        feedbackIntelligenceResult,
      };
    }
    if (intent === "performance-analytics") {
      const engine = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getPerformanceAnalyticsEngine()
        : null;
      const missingInformation = !engine
        ? ["Performance Analytics is unavailable until the Knowledge Foundation has completed startup."]
        : [];
      const performanceAnalyticsAwareness = engine?.getAiMeAwareness();
      const performanceAnalyticsResult = engine?.getLatestRun() ?? undefined;
      const sampleId = performanceAnalyticsResult?.sessions[0]?.id
        ?? engine?.getSessions()[0]?.id;
      const explanation = engine ? engine.explain(sampleId) : null;
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["performance-analytics", "knowledge-foundation"],
        complexity: "medium",
        readyForWorkflow: false,
        missingInformation,
      };
      const response = performanceAnalyticsAwareness
        ? buildPerformanceAnalyticsResponse(performanceAnalyticsAwareness, performanceAnalyticsResult, explanation)
        : missingInformation.join(" ");
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        performanceAnalyticsAwareness,
        performanceAnalyticsResult,
      };
    }
    if (intent === "autonomous-learning") {
      const engine = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getAutonomousLearningEngine()
        : null;
      const missingInformation = !engine
        ? ["Autonomous Learning is unavailable until the Knowledge Foundation has completed startup."]
        : [];
      const autonomousLearningAwareness = engine?.getAiMeAwareness();
      const autonomousLearningResult = engine?.getLatestRun() ?? undefined;
      const sampleId = autonomousLearningResult?.discovered.find((d) => d.accepted)?.id
        ?? engine?.getDiscoveries().find((d) => d.accepted)?.id;
      const explanation = engine ? engine.explain(sampleId) : null;
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["autonomous-learning", "knowledge-foundation"],
        complexity: "medium",
        readyForWorkflow: false,
        missingInformation,
      };
      const response = autonomousLearningAwareness
        ? buildAutonomousLearningResponse(autonomousLearningAwareness, autonomousLearningResult, explanation)
        : missingInformation.join(" ");
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        autonomousLearningAwareness,
        autonomousLearningResult,
      };
    }
    if (intent === "workflow-model-optimization") {
      const engine = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getWorkflowModelOptimizationEngine()
        : null;
      const missingInformation = !engine
        ? ["Workflow & Model Optimization is unavailable until the Knowledge Foundation has completed startup."]
        : [];
      const workflowModelOptimizationAwareness = engine?.getAiMeAwareness();
      const workflowModelOptimizationResult = engine?.getLatestRun() ?? undefined;
      const sampleId = workflowModelOptimizationResult?.optimizedWorkflows[0]?.workflowId
        ?? engine?.getOptimizedWorkflows()[0]?.workflowId;
      const explanation = engine ? engine.explain(sampleId) : null;
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["workflow-model-optimization", "knowledge-foundation"],
        complexity: "medium",
        readyForWorkflow: false,
        missingInformation,
      };
      const response = workflowModelOptimizationAwareness
        ? buildWorkflowModelOptimizationResponse(workflowModelOptimizationAwareness, workflowModelOptimizationResult, explanation)
        : missingInformation.join(" ");
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        workflowModelOptimizationAwareness,
        workflowModelOptimizationResult,
      };
    }
    if (intent === "autonomous-improvement") {
      const engine = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getAutonomousImprovementEngine()
        : null;
      const missingInformation = !engine
        ? ["Autonomous Improvement is unavailable until the Knowledge Foundation has completed startup."]
        : [];
      const autonomousImprovementAwareness = engine?.getAiMeAwareness();
      const autonomousImprovementResult = engine?.getLatestRun() ?? undefined;
      const sampleId = autonomousImprovementResult?.applied[0]?.id
        ?? engine?.getMemory().find((m) => m.applied)?.id;
      const explanation = engine ? engine.explain(sampleId) : null;
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["autonomous-improvement", "knowledge-foundation"],
        complexity: "medium",
        readyForWorkflow: false,
        missingInformation,
      };
      const response = autonomousImprovementAwareness
        ? buildAutonomousImprovementResponse(autonomousImprovementAwareness, autonomousImprovementResult, explanation)
        : missingInformation.join(" ");
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        autonomousImprovementAwareness,
        autonomousImprovementResult,
      };
    }
    if (intent === "autonomous-intelligence-validation") {
      const engine = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getAutonomousIntelligenceValidationEngine()
        : null;
      const missingInformation = !engine
        ? ["Autonomous Intelligence Validation is unavailable until the Knowledge Foundation has completed startup."]
        : [];
      const autonomousIntelligenceValidationAwareness = engine?.getAiMeAwareness();
      const autonomousIntelligenceValidationResult = engine?.getLatestRun() ?? undefined;
      const explanation = engine
        ? engine.explain(autonomousIntelligenceValidationResult?.runId)
        : null;
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["autonomous-intelligence-validation", "knowledge-foundation"],
        complexity: "medium",
        readyForWorkflow: false,
        missingInformation,
      };
      const response = autonomousIntelligenceValidationAwareness
        ? buildAutonomousIntelligenceValidationResponse(
          autonomousIntelligenceValidationAwareness,
          autonomousIntelligenceValidationResult,
          explanation,
        )
        : missingInformation.join(" ");
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        autonomousIntelligenceValidationAwareness,
        autonomousIntelligenceValidationResult,
      };
    }
    if (intent === "learning-certification") {
      const engine = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getLearningCertificationEngine()
        : null;
      const missingInformation = !engine
        ? ["Learning Certification is unavailable until the Knowledge Foundation has completed startup."]
        : [];
      const learningCertificationResult = engine?.getLatestRun() ?? undefined;
      const learningCertificationAwareness = engine?.getAiMeAwareness(learningCertificationResult);
      const explanation = engine ? engine.explain(learningCertificationResult?.runId) : null;
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["learning-certification", "knowledge-foundation"],
        complexity: "medium",
        readyForWorkflow: false,
        missingInformation,
      };
      const response = learningCertificationAwareness
        ? buildLearningCertificationResponse(learningCertificationAwareness, learningCertificationResult, explanation)
        : missingInformation.join(" ");
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        learningCertificationAwareness,
        learningCertificationResult,
      };
    }
    if (intent === "personal-project-workspace") {
      const engine = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getPersonalProjectWorkspaceEngine()
        : null;
      const missingInformation = !engine
        ? ["Personal Project Workspace is unavailable until the Knowledge Foundation has completed startup."]
        : [];
      const personalProjectWorkspaceAwareness = engine?.getAiMeAwareness();
      const personalProjectWorkspaceResult = engine?.runWorkspaceCycle();
      const unfinished = engine?.continueUnfinishedWork() ?? null;
      const explanation = engine
        ? engine.explain(unfinished?.projectId ?? personalProjectWorkspaceResult?.projects[0]?.projectId)
        : null;
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["personal-project-workspace", "knowledge-foundation"],
        complexity: "medium",
        readyForWorkflow: false,
        missingInformation,
      };
      const response = personalProjectWorkspaceAwareness
        ? buildPersonalProjectWorkspaceResponse(
          personalProjectWorkspaceAwareness,
          personalProjectWorkspaceResult,
          explanation,
        )
        : missingInformation.join(" ");
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        personalProjectWorkspaceAwareness,
        personalProjectWorkspaceResult,
      };
    }
    if (intent === "local-asset-library") {
      const engine = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getLocalAssetLibraryEngine()
        : null;
      const missingInformation = !engine
        ? ["Local Asset Library is unavailable until the Knowledge Foundation has completed startup."]
        : [];
      const localAssetLibraryAwareness = engine?.getAiMeAwareness();
      const localAssetLibraryResult = engine?.autoImportWatchFolders();
      const nlHits = engine?.search({ naturalLanguage: message }) ?? [];
      const explanation = engine
        ? engine.explain(nlHits[0]?.assetId ?? localAssetLibraryResult?.indexed[0]?.assetId)
        : null;
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["local-asset-library", "knowledge-foundation"],
        complexity: "medium",
        readyForWorkflow: false,
        missingInformation,
      };
      const response = localAssetLibraryAwareness
        ? buildLocalAssetLibraryResponse(
          localAssetLibraryAwareness,
          localAssetLibraryResult,
          explanation,
          nlHits.length,
        )
        : missingInformation.join(" ");
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        localAssetLibraryAwareness,
        localAssetLibraryResult,
      };
    }
    if (intent === "local-production-queue") {
      const engine = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getLocalProductionQueueEngine()
        : null;
      const missingInformation = !engine
        ? ["Local Production Queue is unavailable until the Knowledge Foundation has completed startup."]
        : [];
      const localProductionQueueAwareness = engine?.getAiMeAwareness();
      const localProductionQueueResult = engine?.runQueueCycle();
      const explanation = engine?.explain();
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["local-production-queue", "knowledge-foundation"],
        complexity: "medium",
        readyForWorkflow: false,
        missingInformation,
      };
      const response = localProductionQueueAwareness
        ? buildLocalProductionQueueResponse(
          localProductionQueueAwareness,
          localProductionQueueResult,
          explanation,
        )
        : missingInformation.join(" ");
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        localProductionQueueAwareness,
        localProductionQueueResult,
      };
    }
    if (intent === "local-resource-manager") {
      const engine = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getLocalResourceManagerEngine()
        : null;
      const missingInformation = !engine
        ? ["Local Resource Manager is unavailable until the Knowledge Foundation has completed startup."]
        : [];
      const localResourceManagerAwareness = engine?.getAiMeAwareness();
      const localResourceManagerResult = engine?.runCycle();
      const explanation = engine?.explain();
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["local-resource-manager", "knowledge-foundation"],
        complexity: "medium",
        readyForWorkflow: false,
        missingInformation,
      };
      const response = localResourceManagerAwareness
        ? buildLocalResourceManagerResponse(
          localResourceManagerAwareness,
          localResourceManagerResult,
          explanation,
        )
        : missingInformation.join(" ");
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        localResourceManagerAwareness,
        localResourceManagerResult,
      };
    }
    if (intent === "automation-engine") {
      const engine = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getAutomationEngine()
        : null;
      const missingInformation = !engine
        ? ["Automation Engine is unavailable until the Knowledge Foundation has completed startup."]
        : [];
      const automationEngineAwareness = engine?.getAiMeAwareness();
      const automationEngineResult = engine?.runManual();
      const explanation = engine?.explain();
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["automation-engine", "knowledge-foundation"],
        complexity: "medium",
        readyForWorkflow: false,
        missingInformation,
      };
      const response = automationEngineAwareness
        ? buildAutomationEngineResponse(
          automationEngineAwareness,
          automationEngineResult,
          explanation,
        )
        : missingInformation.join(" ");
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        automationEngineAwareness,
        automationEngineResult,
      };
    }
    if (intent === "workspace-manager") {
      const engine = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getWorkspaceManagerEngine()
        : null;
      const missingInformation = !engine
        ? ["Workspace Manager is unavailable until the Knowledge Foundation has completed startup."]
        : [];
      const workspaceManagerAwareness = engine?.getAiMeAwareness();
      const workspaceManagerResult = engine?.runCycle();
      const explanation = engine?.explain();
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["workspace-manager", "knowledge-foundation"],
        complexity: "medium",
        readyForWorkflow: false,
        missingInformation,
      };
      const response = workspaceManagerAwareness
        ? buildWorkspaceManagerResponse(
          workspaceManagerAwareness,
          workspaceManagerResult,
          explanation,
        )
        : missingInformation.join(" ");
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        workspaceManagerAwareness,
        workspaceManagerResult,
      };
    }
    if (intent === "knowledge-validation-integration") {
      const engine = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getKnowledgeValidationIntegrationEngine()
        : null;
      const missingInformation = !engine
        ? ["Knowledge Validation & Integration is unavailable until the Knowledge Foundation has completed startup."]
        : [];
      let knowledgeValidationIntegrationResult: import("../knowledge-validation-integration/types.js").KnowledgeValidationIntegrationResult | undefined;
      const knowledgeValidationIntegrationAwareness = engine?.getAiMeKnowledgeValidationIntegrationAwareness();
      if (engine && missingInformation.length === 0) {
        const latest = engine.getLatestRun();
        knowledgeValidationIntegrationResult = latest ?? undefined;
      }
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["knowledge-validation-integration", "knowledge-foundation", "knowledge-research-engine"],
        complexity: "medium",
        readyForWorkflow: false,
        missingInformation,
      };
      const response = knowledgeValidationIntegrationAwareness
        ? buildKnowledgeValidationIntegrationResponse(knowledgeValidationIntegrationAwareness, knowledgeValidationIntegrationResult, engine)
        : missingInformation.join(" ");
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        knowledgeValidationIntegrationAwareness,
        knowledgeValidationIntegrationResult,
      };
    }
    if (intent === "knowledge-collection") {
      const research = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getKnowledgeResearchEngine()
        : null;
      const knowledgeCollectionAwareness = research?.getAiMeCollectionAwareness();
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["knowledge-research-engine", "knowledge-foundation"],
        complexity: "low",
        readyForWorkflow: false,
        missingInformation: [],
      };
      const response = knowledgeCollectionAwareness
        ? buildKnowledgeCollectionResponse(knowledgeCollectionAwareness)
        : "Knowledge collection workspace is unavailable until the local Knowledge Foundation has completed startup.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        knowledgeCollectionAwareness,
      };
    }
    if (intent === "knowledge-sources") {
      const manager = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getKnowledgeSourceManager()
        : null;
      const topic = extractSourceTopic(message);
      const trustedSourceAwareness = manager?.getAiMeTrustedSourceAwareness();
      const trustedSourceRecommendation = manager?.recommendBestTrustedSource(topic || "marketing") ?? null;
      const explanation = manager?.explainTrustedSourceSelection(topic || "marketing");
      const additional = manager?.recommendAdditionalTrustedSources(topic || "marketing", 3) ?? [];
      const missing = manager?.detectMissingTrustedSources() ?? [];
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["knowledge-source-manager", "knowledge-foundation"],
        complexity: "low",
        readyForWorkflow: false,
        missingInformation: [],
      };
      const response = trustedSourceAwareness
        ? buildTrustedSourceResponse(trustedSourceAwareness, trustedSourceRecommendation, explanation?.summary, additional, missing, topic)
        : "Trusted source discovery is unavailable until the local Knowledge Foundation has completed startup.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        trustedSourceAwareness,
        trustedSourceRecommendation,
      };
    }
    if (intent === "knowledge-domains") {
      const domainAwareness = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getKnowledgeDomainPlanner().getAiMeAwareness()
        : null;
      const plan: ConversationPlan = {
        intent,
        requiredEngines: ["knowledge-domain-planning", "knowledge-foundation"],
        complexity: "low",
        readyForWorkflow: false,
        missingInformation: [],
      };
      const response = domainAwareness
        ? buildDomainAwarenessResponse(domainAwareness)
        : "Knowledge domain planning is unavailable until the local Knowledge Foundation has completed startup.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return {
        conversation: structuredClone(conversation),
        language,
        plan,
        response,
        context,
        domainAwareness: domainAwareness ?? undefined,
      };
    }
    if (intent === "knowledge-acquisition") {
      const acquisition = this.core!.knowledgeFoundation?.isStartupComplete()
        ? await this.core!.knowledgeFoundation.getKnowledgeAcquisitionEngine().prepare({ topic: extractKnowledgeTopic(message), sources: input.knowledgeSources, requesterId: "conversation-engine" })
        : null;
      const domainAwareness = this.core!.knowledgeFoundation?.isStartupComplete()
        ? this.core!.knowledgeFoundation.getKnowledgeDomainPlanner().getAiMeAwareness()
        : undefined;
      const plan: ConversationPlan = { intent, requiredEngines: ["knowledge-acquisition", "knowledge-foundation", "knowledge-validation", "knowledge-domain-planning"], complexity: "medium", readyForWorkflow: false, missingInformation: acquisition?.status === "rejected" ? acquisition.rejectionReasons : [] };
      conversation.pendingKnowledgeRequestId = acquisition?.status === "pending-approval" ? acquisition.requestId : undefined;
      const response = acquisition
        ? `${buildKnowledgeAcquisitionResponse(acquisition)}${domainAwareness ? ` ${domainAwareness.summary}` : ""}`
        : "Knowledge research is unavailable until the local Knowledge Foundation has completed startup.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return { conversation: structuredClone(conversation), language, plan, response, context, knowledgeAcquisition: acquisition ?? undefined, domainAwareness };
    }
    const plan = buildPlan(intent, message, conversation.projectId, context.projectKnown);
    if (plan.readyForWorkflow) await this.attachDecisionPreview(plan, message, conversation.projectId);
    const synchronization = intent === "workspace-synchronization"
      ? this.workspaceSynchronizationStatusProvider?.getSummary() ?? null
      : null;
    const integration = intent === "enterprise-integration"
      ? this.enterpriseIntegrationStatusProvider?.getSummary() ?? null
      : null;
    const enterprise = intent === "enterprise-collaboration"
      ? this.enterpriseCollaborationStatusProvider?.getSummary() ?? null
      : null;
    const publishing = intent === "publishing-distribution"
      ? this.publishingDistributionStatusProvider?.getSummary() ?? null
      : null;
    const runtime = intent === "system" ? this.runtimeStatusProvider?.getSummary() ?? null : null;
    const videoKnowledge = intent === "video-generation" && this.core!.knowledgeFoundation?.isStartupComplete()
      ? await this.core!.knowledgeFoundation.getVideoProductionKnowledgeBuilder().advise(message)
      : undefined;
    const professionalKnowledge = ["image-generation", "video-generation", "marketing", "business-intelligence", "professional-knowledge-reasoning"].includes(intent) && this.core!.knowledgeFoundation?.isStartupComplete()
      ? await this.core!.knowledgeFoundation.getKnowledgeReasoningEngine().reasonProfessional({ request: message, objective: message, includeDomainModules: true })
      : undefined;
    const response = `${buildResponse(language, plan, context, synchronization, integration, enterprise, publishing, runtime)}${videoKnowledge ? buildVideoKnowledgeResponse(videoKnowledge) : ""}${professionalKnowledge ? buildProfessionalKnowledgeResponse(professionalKnowledge) : ""}`;
    conversation.pendingPlan = plan.readyForWorkflow ? structuredClone(plan) : undefined;
    conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
    conversation.messages.splice(0, Math.max(0, conversation.messages.length - MAX_MESSAGES_PER_CONVERSATION));
    conversation.updatedAt = new Date().toISOString();
    await this.persist();

    return { conversation: structuredClone(conversation), language, plan, response, context, videoKnowledge, professionalKnowledge };
  }

  private async dispatch(conversation: ConversationRecord): Promise<NonNullable<ConversationResponse["execution"]>> {
    const plan = conversation.pendingPlan;
    if (!plan || !conversation.projectId) return { dispatched: false, error: "No confirmed project workflow is available." };
    if (!this.executionDispatcher) return { dispatched: false, error: "The local execution runtime is not ready." };
    try {
      const result = await this.executionDispatcher.dispatch(conversation.projectId, plan);
      conversation.pendingPlan = undefined;
      return { dispatched: true, jobId: result.jobId };
    } catch (error) {
      return { dispatched: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private getOrCreate(id: string | undefined, projectId: string | undefined, language: ConversationLanguage): ConversationRecord {
    const existing = id ? this.store.conversations.find((conversation) => conversation.id === id) : undefined;
    if (existing) return existing;
    const coreSessionId = this.core!.coordinator.beginSession({ purpose: "conversation", projectId });
    const now = new Date().toISOString();
    const conversation: ConversationRecord = { id: randomUUID(), coreSessionId, projectId, language, createdAt: now, updatedAt: now, messages: [] };
    this.store.conversations.unshift(conversation);
    this.store.conversations.splice(MAX_CONVERSATIONS);
    return conversation;
  }

  private async retrieveContext(message: string, projectId?: string): Promise<ConversationResponse["context"]> {
    const memory = this.core!.memoryFoundation;
    const knowledge = this.core!.knowledgeFoundation;
    const [memoryResult, knowledgeResult] = await Promise.all([
      memory?.isStartupComplete() ? memory.getRetrievalEngine().search({ text: message, project: projectId, limit: 3, requesterId: "conversation-engine" }).catch(() => null) : Promise.resolve(null),
      knowledge?.isStartupComplete() ? knowledge.getRetrievalEngine().search({ text: message, limit: 3, requesterId: "conversation-engine" }).catch(() => null) : Promise.resolve(null),
    ]);
    const projectKnown = Boolean(projectId && memory?.getProjectMemoryEngine().searchProjects({}).some((project) => project.projectId === projectId));
    return { memoryMatches: memoryResult?.results.length ?? 0, knowledgeMatches: knowledgeResult?.results.length ?? 0, projectKnown };
  }

  private async attachDecisionPreview(plan: ConversationPlan, message: string, projectId?: string): Promise<void> {
    const decisionEngine = this.core!.decisionEngine;
    if (!decisionEngine?.isInitialized()) return;
    try {
      const result = await decisionEngine.decide({
        requestId: randomUUID(),
        type: DecisionType.General,
        priority: priorityFor(plan.complexity),
        userRequest: message,
        statedObjective: message,
        availableData: {
          objective: message,
          projectId,
          brandProfile: { name: "KWIZERA AI STUDIO" },
          requestedIntent: plan.intent,
          requiredEngines: plan.requiredEngines,
        },
        requiredModules: plan.requiredEngines,
      });
      plan.decision = {
        decisionId: result.decisionId,
        status: result.status,
        approved: result.approved,
        canExecute: result.canExecute,
        taskCount: result.planningResult?.executionPlan?.taskList.length ?? 0,
        estimatedProcessingMs: result.planningResult?.executionPlan?.estimatedTime.totalMs,
        alternatives: result.rationale?.rejectedAlternatives.length ?? 0,
        risks: result.planningResult?.riskAnalysis.possibleRisks ?? [],
      };
      if (!result.canExecute) {
        plan.readyForWorkflow = false;
        plan.missingInformation.push(...result.missingInformation.map((item) => item.message));
      }
    } catch {
      plan.readyForWorkflow = false;
      plan.missingInformation.push("The planning services are temporarily unavailable; try again after the local runtime is ready.");
    }
  }

  private async readStore(): Promise<ConversationStore> {
    try {
      const parsed = JSON.parse(await fs.readFile(path.join(this.root, "conversations.json"), "utf8")) as Partial<ConversationStore>;
      return { conversations: parsed.conversations ?? [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { conversations: [] };
      throw error;
    }
  }

  private async persist(): Promise<void> {
    const target = path.join(this.root, "conversations.json");
    const temporary = `${target}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(this.store, null, 2)}\n`, "utf8");
    await fs.rename(temporary, target);
  }

  private ensureReady(): void {
    if (!this.core || !this.root) throw new Error("Conversation Engine is not initialized");
  }
}

export function createConversationEnginePlugin(engine: AiConversationEngine): AiModulePlugin {
  return {
    id: "conversation-engine",
    name: "AI Me Conversation & Understanding Engine",
    version: "1.0.0",
    async initialize(): Promise<void> {},
    async shutdown(): Promise<void> {},
    async healthCheck() {
      return { healthy: engine.isInitialized(), message: engine.isInitialized() ? "Conversation engine operational" : "Conversation engine not initialized" };
    },
  };
}

function normalizeMessage(value: string): string {
  const message = value.trim().replace(/\s+/g, " ");
  if (!message || message.length > MAX_MESSAGE_LENGTH || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(message)) throw new Error("Conversation message is invalid");
  return message;
}

function detectLanguage(message: string): ConversationLanguage {
  const lower = message.toLowerCase();
  const rw = ["muraho", "ndashaka", "kora", "ishusho", "video", "umushinga", "hindura", "ubukangurambaga"].some((word) => lower.includes(word));
  const en = ["please", "create", "generate", "image", "video", "project", "marketing", "translate"].some((word) => lower.includes(word));
  return rw && en ? "mixed" : rw ? "rw" : en ? "en" : "unknown";
}

function detectIntent(message: string): ConversationIntent {
  const lower = message.toLowerCase();
  return INTENT_RULES.find((rule) => rule.terms.some((term) => lower.includes(term)))?.intent ?? "general";
}

function buildPlan(intent: ConversationIntent, message: string, projectId: string | undefined, projectKnown: boolean): ConversationPlan {
  const rule = INTENT_RULES.find((candidate) => candidate.intent === intent);
  const missingInformation: string[] = [];
  if (["image-generation", "video-generation", "editing", "marketing"].includes(intent) && message.split(" ").length < 4) missingInformation.push("Describe the product, goal, or desired outcome.");
  if (["editing", "project-management", "product-analysis", "product-asset-preparation", "product-scene-planning", "product-storyboard", "product-prompt-orchestration", "product-image-generation", "product-video-generation", "product-audio-generation", "product-rendering-export"].includes(intent) && !projectId) missingInformation.push("Select or provide the project to work on.");
  return { intent, requiredEngines: rule?.engines ?? ["conversation-engine"], complexity: intent === "video-generation" || intent === "product-prompt-orchestration" || intent === "product-image-generation" || intent === "product-video-generation" || intent === "product-audio-generation" || intent === "product-rendering-export" || intent === "creative-generation-certification" ? "high" : ["image-generation", "marketing", "editing", "business-intelligence", "product-analysis", "product-asset-preparation", "product-scene-planning", "product-storyboard"].includes(intent) ? "medium" : "low", readyForWorkflow: missingInformation.length === 0 && intent !== "general" && intent !== "system" && intent !== "product-analysis" && intent !== "product-asset-preparation" && intent !== "product-scene-planning" && intent !== "product-storyboard" && intent !== "product-prompt-orchestration" && intent !== "product-image-generation" && intent !== "product-video-generation" && intent !== "product-audio-generation" && intent !== "product-rendering-export" && intent !== "creative-generation-certification" && intent !== "workspace-synchronization" && intent !== "enterprise-integration" && intent !== "enterprise-collaboration" && intent !== "publishing-distribution" && intent !== "knowledge-domains" && intent !== "knowledge-acquisition" && intent !== "knowledge-sources" && intent !== "knowledge-collection" && intent !== "knowledge-documents" && intent !== "knowledge-packs" && intent !== "knowledge-validation" && intent !== "knowledge-validation-integration" && intent !== "knowledge-evolution" && intent !== "knowledge-import" && intent !== "knowledge-persistence" && intent !== "video-production-knowledge" && intent !== "camera-knowledge" && intent !== "lighting-composition-knowledge" && intent !== "storytelling-scene-knowledge" && intent !== "animation-motion-rendering-knowledge" && intent !== "marketing-branding-psychology-knowledge" && intent !== "social-media-knowledge" && intent !== "industry-standards-quality-knowledge" && intent !== "professional-knowledge-certification" && intent !== "professional-knowledge-reasoning" && intent !== "professional-decision-intelligence" && intent !== "professional-planning-intelligence" && intent !== "professional-workflow-intelligence" && intent !== "professional-recommendation-intelligence" && intent !== "professional-multi-domain-intelligence" && intent !== "professional-self-review-intelligence" && intent !== "professional-reasoning-certification", missingInformation };
}

function buildResponse(language: ConversationLanguage, plan: ConversationPlan, context: ConversationResponse["context"], synchronization: { cloudState: string; trackedFiles: number; queuedChanges: number; unresolvedConflicts: number; lastBackupAt: string | null } | null, integration: { total: number; enabled: number; unhealthy: number; routes: number; webhooks: number } | null, enterprise: { organizations: number; teams: number; users: number; activeLocks: number; activePresence: number; unreadNotifications: number } | null, publishing: { packages: number; scheduled: number; readyLocal: number; published: number; failed: number; connectedProfiles: number } | null, runtime: { providers: Array<{ name: string; available: boolean; models: number; error?: string }>; gpuName?: string; vramFreeMb?: number } | null): string {
  if (plan.intent === "system") {
    if (!runtime) return "Runtime diagnostics are restoring. Configure a local Automatic1111, ComfyUI, or Ollama provider before requesting inference.";
    const available = runtime.providers.filter((provider) => provider.available);
    const unavailable = runtime.providers.filter((provider) => !provider.available);
    const availableDetail = available.length ? available.map((provider) => `${provider.name} (${provider.models} model(s))`).join(", ") : "none";
    const unavailableDetail = unavailable.length ? unavailable.map((provider) => `${provider.name}${provider.error ? `: ${provider.error}` : ""}`).join("; ") : "none";
    return `Local AI runtime: ${available.length} provider(s) available: ${availableDetail}. Unavailable: ${unavailableDetail}. GPU: ${runtime.gpuName ?? "not reported"}${runtime.vramFreeMb === undefined ? "" : `, ${runtime.vramFreeMb} MB VRAM free`}. Configure a healthy loopback provider and compatible installed model before generation.`;
  }
  if (plan.intent === "enterprise-collaboration") {
    if (!enterprise) return "Enterprise collaboration diagnostics are restoring. The local workspace remains available to its single local owner.";
    return `Enterprise collaboration is local-first: ${enterprise.organizations} organization(s), ${enterprise.teams} team(s), and ${enterprise.users} active user(s). ${enterprise.activeLocks} project lock(s), ${enterprise.activePresence} active collaborator(s), and ${enterprise.unreadNotifications} unread notification(s) are recorded locally. I can explain permissions and collaboration health, but will not change membership, permissions, or project locks directly.`;
  }
  if (plan.intent === "publishing-distribution") {
    if (!publishing) return "Publishing distribution diagnostics are restoring. Approved local exports remain available and external publishing is not started.";
    return `Publishing distribution is offline-first: ${publishing.packages} local package(s), ${publishing.scheduled} scheduled job(s), ${publishing.readyLocal} package(s) ready for manual delivery, ${publishing.published} delivered, and ${publishing.failed} failed. ${publishing.connectedProfiles} enabled profile(s) have connector delivery available. I can explain this status, but will not publish content or enable a connector directly.`;
  }
  if (plan.intent === "enterprise-integration") {
    if (!integration) return "Enterprise integration diagnostics are restoring. External integrations remain optional and disabled until configured locally.";
    return `Enterprise integration is local-first: ${integration.total} connector(s) registered, ${integration.enabled} enabled, ${integration.unhealthy} unhealthy, ${integration.routes} gateway route(s), and ${integration.webhooks} webhook(s). I can explain the status, but will not enable or recover an integration without explicit approved configuration.`;
  }
  if (plan.intent === "workspace-synchronization") {
    if (!synchronization) return "Workspace synchronization is restoring. Local files remain authoritative and cloud synchronization is not started.";
    return `Workspace synchronization is local-first. Cloud is ${synchronization.cloudState}; ${synchronization.trackedFiles} file(s) are tracked, ${synchronization.queuedChanges} change(s) are queued, and ${synchronization.unresolvedConflicts} conflict(s) require local upload. Last workspace backup: ${synchronization.lastBackupAt ?? "not created"}.`;
  }
  if (plan.missingInformation.length) return language === "rw" ? `Mbanje nkeneye ibi bisobanuro: ${plan.missingInformation.join(" ")}` : `Before I prepare the workflow, I need: ${plan.missingInformation.join(" ")}`;
  if (plan.readyForWorkflow) return language === "rw" ? `Nabyumvise. Nateguye gahunda ya ${plan.intent}; nzakoresha ${plan.requiredEngines.join(", ")}. Emeza ibisobanuro mbere yo gutangira.` : `I understand the ${plan.intent} request. I prepared a plan using ${plan.requiredEngines.join(", ")}. Confirm the details before execution begins.`;
  return language === "rw" ? `Niteguye kugufasha. Sobanura icyo ushaka gukora cyangwa uhitemo umushinga.` : `I am ready to help. Describe the outcome you want, or select a project so I can prepare the appropriate workflow.`;
}

function priorityFor(complexity: ConversationPlan["complexity"]): DecisionPriority {
  return complexity === "high" ? DecisionPriority.High : complexity === "medium" ? DecisionPriority.Normal : DecisionPriority.Low;
}

function isConfirmation(message: string): boolean {
  return /^(yes|y|confirm|confirmed|approve|approved|go ahead|start|continue|yego|emeza|tangira)\b/i.test(message.trim());
}

function extractKnowledgeTopic(message: string): string {
  return message.replace(/^(learn|research|improve(?: our)?|teach(?: our)? ai(?: about)?|teach)\s+/i, "").replace(/[.!?]+$/, "").trim() || message;
}

function buildProductPromptOrchestrationResponse(
  explanation: import("../product-prompt-orchestration/types.js").ProductPromptOrchestrationExplainResult,
  awareness?: import("../product-prompt-orchestration/types.js").AiMeProductPromptOrchestrationAwareness,
): string {
  const models = explanation.modelExplanations.slice(0, 4).map((item) => item.why).join(" ");
  const improvements = explanation.improvementRecommendations.slice(0, 3).join(" ") || "none";
  return (
    `${awareness?.summary ?? "Prompt Orchestration ready."} ` +
    `${explanation.summary} ` +
    `Model selection: ${models} ` +
    `Improvements: ${improvements} ` +
    `Ready for image generation: ${explanation.readyForImageGeneration ? "yes" : "not yet"}. ` +
    `Image Generation Pipeline is available as Step 6.`
  );
}

function buildProductImageGenerationResponse(
  explanation: import("../product-image-generation/types.js").ProductImageGenerationExplainResult,
  awareness?: import("../product-image-generation/types.js").AiMeProductImageGenerationAwareness,
): string {
  const images = explanation.imageExplanations.slice(0, 4).map((item) => item.why).join(" ");
  const backgrounds = explanation.backgroundExplanations.slice(0, 3).map((item) => `Scene ${item.sceneNumber}: ${item.style}`).join("; ");
  const improvements = explanation.improvementRecommendations.slice(0, 3).join(" ") || "none";
  return (
    `${awareness?.summary ?? "Product Image Generation ready."} ` +
    `${explanation.summary} ` +
    `Images: ${images} ` +
    `Backgrounds: ${backgrounds}. ` +
    `Improvements: ${improvements} ` +
    `Ready for video generation: ${explanation.readyForVideoGeneration ? "yes" : "not yet"}. ` +
    `Product Video Generation is available as Step 7.`
  );
}

function buildProductVideoGenerationResponse(
  explanation: import("../product-video-generation/types.js").ProductVideoGenerationExplainResult,
  awareness?: import("../product-video-generation/types.js").AiMeProductVideoGenerationAwareness,
): string {
  const scenes = explanation.sceneExplanations.slice(0, 4).map((item) => item.why).join(" ");
  const cameras = explanation.cameraExplanations.slice(0, 3).map((item) => `Scene ${item.sceneNumber}: ${item.move}`).join("; ");
  const improvements = explanation.improvementRecommendations.slice(0, 3).join(" ") || "none";
  return (
    `${awareness?.summary ?? "Product Video Generation ready."} ` +
    `${explanation.summary} ` +
    `Scenes: ${scenes} ` +
    `Cameras: ${cameras}. ` +
    `Improvements: ${improvements} ` +
    `Ready for audio/voice: ${explanation.readyForAudioVoice ? "yes" : "not yet"}. ` +
    `Audio and Voice Generation are available as Step 8.`
  );
}

function buildProductAudioGenerationResponse(
  explanation: import("../product-audio-generation/types.js").ProductAudioGenerationExplainResult,
  awareness?: import("../product-audio-generation/types.js").AiMeProductAudioGenerationAwareness,
): string {
  const effects = explanation.effectExplanations.slice(0, 3).map((item) => `Scene ${item.sceneNumber}: ${item.kind}`).join("; ");
  const improvements = explanation.improvementRecommendations.slice(0, 3).join(" ") || "none";
  return (
    `${awareness?.summary ?? "Product Audio Generation ready."} ` +
    `${explanation.summary} ` +
    `Voice: ${explanation.voiceExplanation} ` +
    `Music: ${explanation.musicExplanation} ` +
    `Effects: ${effects}. ` +
    `Improvements: ${improvements} ` +
    `Ready for rendering: ${explanation.readyForRendering ? "yes" : "not yet"}. ` +
    `Rendering and Export Pipeline is available as Step 9.`
  );
}

function buildProductRenderingExportResponse(
  explanation: import("../product-rendering-export/types.js").ProductRenderingExportExplainResult,
  awareness?: import("../product-rendering-export/types.js").AiMeProductRenderingExportAwareness,
): string {
  const presets = explanation.platformComparisons.slice(0, 4).map((item) => `${item.platform} ${item.width}x${item.height}`).join("; ");
  const improvements = explanation.improvementRecommendations.slice(0, 3).join(" ") || "none";
  return (
    `${awareness?.summary ?? "Product Rendering & Export ready."} ` +
    `${explanation.summary} ` +
    `Settings: ${explanation.settingsExplanation} ` +
    `Presets: ${presets}. ` +
    `Improvements: ${improvements} ` +
    `Ready for certification: ${explanation.readyForCertification ? "yes" : "not yet"}. ` +
    `Creative Generation Certification (Step 10) certifies the full Product-to-Video pipeline.`
  );
}

function buildCreativeGenerationCertificationResponse(
  explanation: import("../creative-generation-certification/types.js").CreativeGenerationCertificationExplainResult,
  awareness?: import("../creative-generation-certification/types.js").AiMeCreativeGenerationCertificationAwareness,
  result?: import("../creative-generation-certification/types.js").CreativeGenerationCertificationResult,
): string {
  const scenarios = explanation.scenarioSummaries
    .map((item) => `${item.kind}:${item.passed ? "PASS" : "FAIL"}`)
    .join(", ");
  const blockers = explanation.blockers.slice(0, 3).join("; ") || "none";
  return (
    `${awareness?.summary ?? "Creative Generation Certification ready."} ` +
    `${explanation.summary} ` +
    `Scenarios: ${scenarios}. ` +
    `Overall: ${result?.overallCreativeGenerationScore ?? "n/a"}/100. ` +
    `Preservation: ${result?.productPreservationScore ?? "n/a"}/100. ` +
    `Marketing: ${result?.marketingQualityScore ?? "n/a"}/100. ` +
    `Production ready: ${explanation.productionReady ? "YES" : "NO"}. ` +
    `Blockers: ${blockers}.`
  );
}

function buildProductStoryboardResponse(
  explanation: import("../product-storyboard/types.js").ProductStoryboardExplainResult,
  awareness?: import("../product-storyboard/types.js").AiMeProductStoryboardAwareness,
): string {
  const decisions = explanation.storyboardDecisions.slice(0, 4).map((item) => `Scene ${item.sceneNumber}: ${item.decision}`).join(" ");
  const improvements = explanation.improvementRecommendations.slice(0, 3).join(" ") || "none";
  return (
    `${awareness?.summary ?? "Product Storyboard ready."} ` +
    `${explanation.summary} ` +
    `Key decisions: ${decisions} ` +
    `Improvements: ${improvements} ` +
    `Ready for prompt orchestration: ${explanation.readyForPromptOrchestration ? "yes" : "not yet"}. ` +
    `Prompt orchestration and video generation are not started in this step.`
  );
}

function buildProductScenePlanningResponse(
  explanation: import("../product-scene-planning/types.js").ProductSceneExplainResult,
  awareness?: import("../product-scene-planning/types.js").AiMeProductScenePlanningAwareness,
): string {
  const scenes = explanation.sceneExplanations.slice(0, 6).map((scene) => `${scene.sceneName} (${scene.flowStage})`).join("; ");
  const missing = explanation.missingScenes.slice(0, 4).join(", ") || "none";
  const weak = explanation.weakFlowNotes.slice(0, 2).join(" ") || "none";
  return (
    `${awareness?.summary ?? "Product Scene Planning ready."} ` +
    `${explanation.summary} ` +
    `Scenes: ${scenes}. ` +
    `Recommended order: ${explanation.recommendedOrder.slice(0, 6).join(" → ") || "n/a"}. ` +
    `Missing scenes: ${missing}. Weak flow notes: ${weak}. ` +
    `Ready for storyboard: ${explanation.readyForStoryboard ? "yes" : "not yet"}. ` +
    `Storyboard generation is not started in this step.`
  );
}

function buildProductAssetPreparationResponse(
  explanation: import("../product-asset-preparation/types.js").ProductAssetExplainResult,
  awareness?: import("../product-asset-preparation/types.js").AiMeProductAssetAwareness,
): string {
  const missing = explanation.missingViews.slice(0, 5).join(", ") || "none";
  const photos = explanation.photoRecommendations.slice(0, 4).map((item) => item.view).join(", ") || "none";
  return (
    `${awareness?.summary ?? "Product Asset Preparation ready."} ` +
    `${explanation.summary} ` +
    `Quality notes: ${explanation.qualityNotes.slice(0, 4).join("; ") || "n/a"}. ` +
    `Missing views: ${missing}. Recommended photos: ${photos}. ` +
    `Ready for scene planning context: ${explanation.readyForScenePlanning ? "yes" : "not yet"}. ` +
    `Product Scene Planning and video generation are not started in this step.`
  );
}

function buildProductIntelligenceResponse(
  explanation: import("../product-intelligence/types.js").ProductIntelligenceExplainResult,
  awareness?: import("../product-intelligence/types.js").AiMeProductIntelligenceAwareness,
): string {
  const missing = explanation.missingInformation.slice(0, 5).map((item) => item.field).join(", ") || "none critical";
  const photos = explanation.photoRecommendations.slice(0, 4).map((item) => item.view).join(", ") || "none";
  return (
    `${awareness?.summary ?? "Product Intelligence ready."} ` +
    `${explanation.summary} ` +
    `Characteristics: ${explanation.characteristics.slice(0, 8).join("; ")}. ` +
    `Missing information focus: ${missing}. ` +
    `Recommended additional photos: ${photos}. ` +
    `Ready for creative generation context: ${explanation.readyForCreativeGeneration ? "yes" : "not yet"}. ` +
    `Background removal and video generation are not started in this step.`
  );
}

function buildKnowledgeAcquisitionResponse(preview: import("../knowledge-acquisition-engine/types.js").KnowledgeAcquisitionPreview): string {
  if (preview.status === "rejected") return `I prepared a research assessment for ${preview.topic}, but it is not eligible for import: ${preview.rejectionReasons.join(" ")} Provide local documents, extracted PDF or Word text, or user-approved website content so I can build a reliable preview.`;
  return `Research preview for ${preview.topic}: ${preview.sources.length} source(s), ${preview.rules.length} rule(s), ${preview.techniques.length} technique(s), ${preview.bestPractices.length} best practice(s), and confidence ${preview.confidenceScore}/100. Review this structured preview and confirm before I import it into the Knowledge Foundation.`;
}

function buildDomainAwarenessResponse(awareness: import("../knowledge-domain-planning/types.js").AiMeDomainAwareness): string {
  const priorities = awareness.futureLearningPriorities
    .slice(0, 8)
    .map((item) => `${item.name} (${item.priority})`)
    .join("; ");
  const relatedCount = awareness.relationships.filter((relation) => relation.relation === "related-to").length;
  return (
    `${awareness.summary} ` +
    `${awareness.availableDomainIds.length} domain architecture slot(s) are defined. ` +
    `${awareness.missingDomainIds.length} domain(s) still need professional knowledge content. ` +
    `Domain relationships tracked: ${awareness.relationships.length} (including ${relatedCount} cross-links). ` +
    `Future learning priorities: ${priorities || "none"}.`
  );
}

function extractSourceTopic(message: string): string {
  return message
    .replace(/^(recommend|find|show|list|detect|explain)?\s*(the\s+)?(best\s+|trusted\s+|additional\s+)?(source|sources|knowledge sources)?\s*(for|about|on)?\s*/i, "")
    .replace(/[.!?]+$/, "")
    .trim() || message;
}

function buildTrustedSourceResponse(
  awareness: import("../knowledge-source-manager/types.js").AiMeTrustedSourceAwareness,
  recommendation: import("../knowledge-source-manager/types.js").TrustedSourceDiscoveryRecommendation | null,
  explanation: string | undefined,
  additional: import("../knowledge-source-manager/types.js").TrustedSourceDiscoveryRecommendation[],
  missing: import("../knowledge-source-manager/types.js").TrustedSourceMissingReport[],
  topic: string
): string {
  const best = recommendation
    ? ` Best source for ${topic || "general studio topics"}: ${recommendation.name} (${recommendation.trustClass}, trust ${recommendation.trustScore}/100, quality ${recommendation.qualityScore}/100). ${explanation ?? recommendation.whySelected}`
    : ` No ranked source matched "${topic}" yet.`;
  const more = additional.length
    ? ` Additional trusted candidates: ${additional.map((item) => `${item.name} (${item.trustClass})`).join("; ")}.`
    : "";
  const gaps = missing.length
    ? ` Missing/weak coverage topics: ${missing.slice(0, 5).map((item) => item.topicLabel).join(", ")}.`
    : " All discovery topics have at least adequate source coverage.";
  return `${awareness.summary}${best}${more}${gaps} No sources were downloaded or auto-approved.`;
}

function buildKnowledgeCollectionResponse(
  awareness: import("../knowledge-research-engine/types.js").AiMeKnowledgeCollectionAwareness
): string {
  const missing = awareness.missingKnowledge.length
    ? ` Missing/weak domains: ${awareness.missingKnowledge.slice(0, 6).map((item) => item.domainLabel).join(", ")}.`
    : " Domain collection coverage is healthy.";
  const recs = awareness.recommendations.length
    ? ` Recommended next collections: ${awareness.recommendations
        .slice(0, 4)
        .map((item) => `${item.sourceName} → ${item.domainId}`)
        .join("; ")}.`
    : "";
  return `${awareness.summary} Workspace: ${awareness.workspaceRoot}.${missing}${recs} Resources are stored locally without extraction.`;
}

function buildOnlineResearchResponse(
  session: import("../knowledge-research-engine/types.js").OnlineResearchSessionResult,
  awareness?: import("../knowledge-research-engine/types.js").AiMeOnlineResearchAwareness,
): string {
  const selected = session.acceptedSources[0]
    ? ` Selected example: ${session.acceptedSources[0].name} — trust ${session.acceptedSources[0].trustScore}, authority ${session.acceptedSources[0].authorityScore}.`
    : " No approved sources passed quality gates yet.";
  const rejected = session.rejectedSources[0]
    ? ` Rejected example: ${session.rejectedSources[0].name} because ${session.rejectedSources[0].reason}`
    : "";
  const topics = session.recommendedTopics.slice(0, 4).join(", ") || "none";
  return (
    `${awareness?.summary ?? "Online Research ready."} ${session.summary} ` +
    `Mode: ${session.connectivity.mode}; quality=${session.connectivity.networkQuality}.` +
    selected +
    rejected +
    ` Recommended next topics: ${topics}. ` +
    `Knowledge Foundation modified: no. Knowledge Validation & Integration (Step 2) can accept staged review items into the foundation ledger.`
  );
}

function buildKnowledgeValidationIntegrationResponse(
  awareness: import("../knowledge-validation-integration/types.js").AiMeKnowledgeValidationIntegrationAwareness,
  result?: import("../knowledge-validation-integration/types.js").KnowledgeValidationIntegrationResult,
  engine?: import("../knowledge-validation-integration/knowledge-validation-integration-engine.js").KnowledgeValidationIntegrationEngine | null,
): string {
  const accepted = result?.accepted[0];
  const rejected = result?.rejected[0];
  const acceptExplain = accepted ? engine?.explainDecision(accepted.id).explanation : "No accepted item in the latest run yet.";
  const rejectExplain = rejected ? engine?.explainDecision(rejected.id).explanation : "No rejected item in the latest run yet.";
  const history = engine?.getVersionHistory().slice(0, 3).map((entry) => `${entry.itemId}@v${entry.version}:${entry.action}`).join("; ") || "none";
  const search = engine?.searchImportedKnowledge("lighting marketing camera", 3).map((hit) => hit.title).join("; ") || "none";
  return (
    `${awareness.summary} ` +
    `${result?.summary ?? "Run integrateCandidates to validate staged or local knowledge."} ` +
    `Accepted reason: ${acceptExplain} ` +
    `Rejected reason: ${rejectExplain} ` +
    `Version history: ${history}. ` +
    `Search sample: ${search}. ` +
    `Knowledge Evolution (Step 3) is available for continuous versioned updates. Feedback Intelligence (Step 4) is available.`
  );
}

function buildKnowledgeEvolutionResponse(
  awareness: import("../knowledge-evolution/types.js").AiMeKnowledgeEvolutionAwareness,
  result?: import("../knowledge-evolution/types.js").KnowledgeEvolutionResult,
  explanation?: import("../knowledge-evolution/types.js").KnowledgeEvolutionExplainResult | null,
): string {
  return (
    `${awareness.summary} ` +
    `${result?.summary ?? "No evolution run yet. Provide verified candidates to evolve knowledge."} ` +
    (explanation
      ? `What changed: ${explanation.whatChanged} Why: ${explanation.whyUpdated} Recommend latest: ${explanation.recommendLatest ? "yes" : "no"}. `
      : "") +
    `Feedback Intelligence (Step 4) is available for user learning.`
  );
}

function buildFeedbackIntelligenceResponse(
  awareness: import("../feedback-intelligence/types.js").AiMeFeedbackIntelligenceAwareness,
  result?: import("../feedback-intelligence/types.js").FeedbackIntelligenceResult,
  explanation?: import("../feedback-intelligence/types.js").FeedbackIntelligenceExplainResult | null,
): string {
  return (
    `${awareness.summary} ` +
    `${result?.summary ?? "No feedback run yet. Submit reviews, ratings, comments, or corrections to learn."} ` +
    (explanation
      ? `Learned: ${explanation.whatWasLearned} Recommendation changes: ${explanation.howRecommendationsChanged} Preference reason: ${explanation.whyPreferenceExists} Next: ${explanation.recommendedImprovements.slice(0, 2).join("; ")}. `
      : "") +
    `Professional Knowledge is never overwritten. Performance Analytics (Step 5) is available.`
  );
}

function buildPerformanceAnalyticsResponse(
  awareness: import("../performance-analytics/types.js").AiMePerformanceAnalyticsAwareness,
  result?: import("../performance-analytics/types.js").PerformanceAnalyticsResult,
  explanation?: import("../performance-analytics/types.js").PerformanceAnalyticsExplainResult | null,
): string {
  return (
    `${awareness.summary} ` +
    `${result?.summary ?? "No analytics run yet. Ingest production sessions to measure pipeline, resources, quality, and models."} ` +
    (explanation
      ? `Issues: ${explanation.performanceIssues} Bottlenecks: ${explanation.bottlenecksExplanation} Optimizations: ${explanation.optimizations.slice(0, 2).join("; ")} Compare: ${explanation.sessionComparison} Predict: ${explanation.predictedProductionTimeMs}ms. `
      : "") +
    `Production history is preserved. Autonomous Learning (Step 6) is available.`
  );
}

function buildAutonomousLearningResponse(
  awareness: import("../autonomous-learning/types.js").AiMeAutonomousLearningAwareness,
  result?: import("../autonomous-learning/types.js").AutonomousLearningResult,
  explanation?: import("../autonomous-learning/types.js").AutonomousLearningExplainResult | null,
): string {
  return (
    `${awareness.summary} ` +
    `${result?.summary ?? "No autonomous learning cycle yet. Run when online for discovery, or offline for self-learning expansion."} ` +
    (explanation
      ? `Learned: ${explanation.whatWasLearned} Source: ${explanation.whereItCameFrom} Value: ${explanation.whyValuable} Recommend: ${explanation.recommendUse ? "yes" : "no"} (${explanation.recommendUseReason}). `
      : "") +
    `Unverified knowledge is never imported. Workflow & Model Optimization (Step 7) is available.`
  );
}

function buildWorkflowModelOptimizationResponse(
  awareness: import("../workflow-model-optimization/types.js").AiMeWorkflowModelOptimizationAwareness,
  result?: import("../workflow-model-optimization/types.js").WorkflowModelOptimizationResult,
  explanation?: import("../workflow-model-optimization/types.js").WorkflowModelOptimizationExplainResult | null,
): string {
  return (
    `${awareness.summary} ` +
    `${result?.summary ?? "No optimization run yet. Provide workflow and model history to optimize execution order and model selection."} ` +
    (explanation
      ? `Workflow: ${explanation.workflowOptimizationExplanation} Models: ${explanation.modelSelectionExplanation} Recommend: ${explanation.recommendedWorkflow}. Predicted quality: ${explanation.predictedProductionQuality}. `
      : "") +
    `Professional quality is never reduced automatically. Autonomous Improvement (Step 8) is available.`
  );
}

function buildAutonomousImprovementResponse(
  awareness: import("../autonomous-improvement/types.js").AiMeAutonomousImprovementAwareness,
  result?: import("../autonomous-improvement/types.js").AutonomousImprovementResult,
  explanation?: import("../autonomous-improvement/types.js").AutonomousImprovementExplainResult | null,
): string {
  return (
    `${awareness.summary} ` +
    `${result?.summary ?? "No improvement cycle yet. Provide analytics and optimization signals to propose safe self-improvements."} ` +
    (explanation
      ? `Improved: ${explanation.whatImproved} Why: ${explanation.whyApplied} Expected: ${explanation.expectedBenefits} Actual: ${explanation.actualBenefits}. `
      : "") +
    `User projects are never modified. Autonomous Intelligence Validation (Step 9) is available.`
  );
}

function buildAutonomousIntelligenceValidationResponse(
  awareness: import("../autonomous-intelligence-validation/types.js").AiMeAutonomousIntelligenceValidationAwareness,
  result?: import("../autonomous-intelligence-validation/types.js").AutonomousIntelligenceValidationResult,
  explanation?: import("../autonomous-intelligence-validation/types.js").AutonomousIntelligenceValidationExplainResult | null,
): string {
  return (
    `${awareness.summary} ` +
    `${result?.summary ?? "No validation run yet. Run production-readiness validation before trusting autonomous capabilities."} ` +
    (explanation
      ? `Overview: ${explanation.validationOverview} Failures: ${explanation.failedValidations.slice(0, 2).join("; ")} Actions: ${explanation.correctiveActions.slice(0, 2).join("; ")} Health: ${explanation.longTermHealthPrediction} `
      : "") +
    `Unsafe systems are never certified. Learning Certification (Step 10) is available.`
  );
}

function buildLearningCertificationResponse(
  awareness: import("../learning-certification/types.js").AiMeLearningCertificationAwareness,
  result?: import("../learning-certification/types.js").LearningCertificationResult,
  explanation?: import("../learning-certification/types.js").LearningCertificationExplainResult | null,
): string {
  return (
    `${awareness.summary} ` +
    `${result?.summary ?? "No certification run yet. Run Learning Certification to determine Version 1.0 completeness."} ` +
    (explanation
      ? `Overview: ${explanation.overview} Certified: ${explanation.certified ? "YES" : "NO"}. `
      : "") +
    (result?.certified
      ? result.certificationStatement.replace(/\n/g, " ")
      : `Blockers: ${(explanation?.blockers ?? result?.blockers.map((b) => b.evidence) ?? ["none"]).slice(0, 3).join("; ")}.`)
  );
}

function buildPersonalProjectWorkspaceResponse(
  awareness: import("../personal-project-workspace/types.js").AiMePersonalWorkspaceAwareness,
  result?: import("../personal-project-workspace/types.js").PersonalProjectWorkspaceResult,
  explanation?: import("../personal-project-workspace/types.js").PersonalWorkspaceExplainResult | null,
): string {
  return (
    `${awareness.summary} ` +
    `${result?.summary ?? "Local personal workspace ready. Create or resume a project to continue."} ` +
    (explanation
      ? `Project: ${explanation.projectSummary} History: ${explanation.historyExplanation} Next: ${explanation.nextAction} `
      : "") +
    `Single-user local storage only. Local Asset Library is available (Platform Step 2).`
  );
}

function buildLocalAssetLibraryResponse(
  awareness: import("../local-asset-library/types.js").AiMeLocalAssetLibraryAwareness,
  result?: import("../local-asset-library/types.js").LocalAssetLibraryResult,
  explanation?: import("../local-asset-library/types.js").LocalAssetLibraryExplainResult | null,
  searchHits = 0,
): string {
  return (
    `${awareness.summary} ` +
    `${result?.summary ?? "Local Asset Library ready. Drop files into watch folders to index."} ` +
    `Search hits for this message: ${searchHits}. ` +
    (explanation
      ? `Why selected: ${explanation.whySelected} Recommendation: ${explanation.recommendation} `
      : "") +
    `Originals are never overwritten. Local Production Queue is available (Platform Step 3).`
  );
}

function buildLocalProductionQueueResponse(
  awareness: import("../local-production-queue/types.js").AiMeLocalProductionQueueAwareness,
  result?: import("../local-production-queue/types.js").LocalProductionQueueResult,
  explanation?: import("../local-production-queue/types.js").LocalProductionQueueExplainResult | null,
): string {
  return (
    `${awareness.summary} ` +
    `${result?.summary ?? "Local production queue ready."} ` +
    (explanation
      ? `${explanation.queueSummary} Predicted completion ~${Math.round(explanation.predictedCompletionMs / 1000)}s. Optimization: ${explanation.optimizationRecommendation} `
      : "") +
    `Progress is never discarded. Local Resource Manager is available (Platform Step 4).`
  );
}

function buildLocalResourceManagerResponse(
  awareness: import("../local-resource-manager/types.js").AiMeLocalResourceManagerAwareness,
  result?: import("../local-resource-manager/types.js").LocalResourceManagerResult,
  explanation?: import("../local-resource-manager/types.js").LocalResourceManagerExplainResult | null,
): string {
  return (
    `${awareness.summary} ` +
    `${result?.summary ?? "Local resource manager ready."} ` +
    (explanation
      ? `${explanation.usageExplanation} Recommended mode: ${explanation.recommendedMode}. Predicted completion ~${Math.round(explanation.predictedCompletionMs / 1000)}s. ${explanation.hardwareUpgradeRecommendation ?? "No hardware upgrade required right now."} `
      : "") +
    `Critical jobs are never interrupted without saving progress. Automation Engine is available (Platform Step 5).`
  );
}

function buildAutomationEngineResponse(
  awareness: import("../automation-engine/types.js").AiMeAutomationEngineAwareness,
  result?: import("../automation-engine/types.js").AutomationEngineResult,
  explanation?: import("../automation-engine/types.js").AutomationEngineExplainResult | null,
): string {
  return (
    `${awareness.summary} ` +
    `${result?.summary ?? "Automation Engine ready."} ` +
    (explanation
      ? `${explanation.completedTasksExplanation} ${explanation.storagePrediction} ${explanation.backupFrequencyRecommendation} `
      : "") +
    `User projects, assets, and validated knowledge are never deleted. Workspace Manager remains deferred to Platform Step 6.`
  );
}

function extractDocumentQuery(message: string): string {
  return message
    .replace(/^(search|find|summarize|explain|recommend|show)?\s*(documents?|document summary|document understanding)?\s*(for|about|on)?\s*/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
}

function buildDocumentUnderstandingResponse(
  awareness: import("../knowledge-processing-engine/document-understanding-types.js").AiMeDocumentAwareness,
  searchHits: import("../knowledge-processing-engine/document-understanding-types.js").DocumentUnderstandingResult[],
  query: string
): string {
  const hits = searchHits.length
    ? ` Search hits for "${query}": ${searchHits
        .slice(0, 5)
        .map((hit) => `${hit.structure.title} (${hit.analysis.difficultyLevel})`)
        .join("; ")}.`
    : query
      ? ` No indexed document matched "${query}".`
      : "";
  const missing = awareness.missingTopics.length
    ? ` Missing topics: ${awareness.missingTopics.join(", ")}.`
    : " Expected creative topics are represented.";
  const recs = awareness.recommendations.length
    ? ` Recommended documents: ${awareness.recommendations.map((item) => item.title).join("; ")}.`
    : "";
  return `${awareness.summary}${hits}${missing}${recs} Original documents were not modified and Knowledge Packs were not created.`;
}

function buildKnowledgePackResponse(
  awareness: import("../knowledge-processing-engine/knowledge-extraction-types.js").AiMeKnowledgePackAwareness
): string {
  const domains = Object.entries(awareness.packsByDomain)
    .map(([slug, count]) => `${slug} (${count})`)
    .join("; ");
  const workflows = awareness.topWorkflows.length ? ` Workflows: ${awareness.topWorkflows.join("; ")}.` : "";
  const practices = awareness.topBestPractices.length ? ` Best practices: ${awareness.topBestPractices.join("; ")}.` : "";
  const decisions = awareness.topDecisionRules.length ? ` Decision rules: ${awareness.topDecisionRules.join("; ")}.` : "";
  const relationships = awareness.relationships.length ? ` Relationships: ${awareness.relationships.slice(0, 5).join("; ")}.` : "";
  return `${awareness.summary} Domains: ${domains || "none"}.${workflows}${practices}${decisions}${relationships} Original documents were not modified. Use knowledge validation to certify packs before Foundation import.`;
}

function buildKnowledgePackValidationResponse(
  awareness: import("../knowledge-validation-engine/knowledge-pack-validation-types.js").AiMePackValidationAwareness,
  engine: import("../knowledge-validation-engine/knowledge-pack-validation-engine.js").KnowledgePackValidationEngine | null
): string {
  const capabilities = [
    awareness.canExplain ? "explain" : null,
    awareness.canCompare ? "compare" : null,
    awareness.canRecommend ? "recommend" : null,
    awareness.canApplyDecisionRules ? "apply decision rules" : null,
  ]
    .filter(Boolean)
    .join(", ");
  const practices = engine?.recommendBestPractices(undefined, 3) ?? [];
  const practiceText = practices.length ? ` Sample best practices: ${practices.join("; ")}.` : "";
  return (
    `${awareness.summary} Avg quality ${awareness.averageQuality}, confidence ${awareness.averageConfidence}, ` +
    `completeness ${awareness.averageCompleteness}, readiness ${awareness.averageProfessionalReadiness}. ` +
    `AI Me can: ${capabilities || "await validation"}.${practiceText} Certified packs are ready for Knowledge Import into the permanent Knowledge Foundation.`
  );
}

function buildKnowledgeImportResponse(
  awareness: import("../knowledge-foundation/knowledge-import-types.js").AiMeKnowledgeImportAwareness
): string {
  const engines = Object.entries(awareness.engines)
    .filter(([key, value]) => key !== "summary" && value === true)
    .map(([key]) => key)
    .slice(0, 8)
    .join(", ");
  return (
    `${awareness.summary} AI Me can find/explain/apply/recommend imported knowledge. ` +
    `Planning=${awareness.canUseInPlanning}, image=${awareness.canUseInImageGeneration}, video=${awareness.canUseInVideoGeneration}. ` +
    `Engines ready: ${engines || "foundation"}. Run knowledge persistence certification to confirm restart durability.`
  );
}

function buildKnowledgePersistenceResponse(
  awareness: import("../knowledge-foundation/knowledge-seeding-types.js").AiMeKnowledgePersistenceAwareness,
  stats: import("../knowledge-foundation/knowledge-seeding-types.js").KnowledgeSeedingStatistics | undefined,
  certification: import("../knowledge-foundation/knowledge-seeding-types.js").KnowledgeSeedingCertificationResult | null
): string {
  const statsText = stats
    ? ` Domains=${stats.totalKnowledgeDomains}, packs=${stats.totalKnowledgePacks}, items=${stats.totalKnowledgeItems}, relationships=${stats.totalRelationships}, rules=${stats.totalDecisionRules}, workflows=${stats.totalWorkflows}, examples=${stats.totalExamples}, sources=${stats.totalSources}, documents=${stats.totalDocuments}, metadata=${stats.totalMetadataEntries}.`
    : "";
  const certText = certification?.certified
    ? ` Knowledge Seeding Version ${certification.version} is CERTIFIED.`
    : " Knowledge Seeding certification is pending restart verification.";
  return `${awareness.summary}${statsText}${certText}`;
}

function buildVideoProductionKnowledgeResponse(
  awareness: import("../video-knowledge-engine/professional-video-production-types.js").AiMeVideoProductionKnowledgeAwareness,
  explained:
    | import("../video-knowledge-engine/professional-video-production-types.js").VideoProductionKnowledgeExplainResult
    | undefined,
  workflow: { available: boolean; workflow: string[]; reason: string; confidenceScore: number } | undefined,
  practices: { available: boolean; practices: string[]; reason: string; confidenceScore: number } | undefined,
  answered: { available: boolean; answer: string; knowledgeIds: string[]; confidenceScore: number } | undefined
): string {
  const explainText = explained?.available
    ? ` ${explained.title}: ${explained.explanation} Best practice: ${explained.bestPractices[0] ?? "n/a"}.`
    : "";
  const workflowText = workflow?.available ? ` Workflow: ${workflow.workflow.slice(0, 3).join(" → ")}.` : "";
  const practiceText = practices?.available ? ` Practices: ${practices.practices.slice(0, 2).join("; ")}.` : "";
  const answerText = answered?.available ? ` Answer: ${answered.answer}` : "";
  return `${awareness.summary}${explainText}${workflowText}${practiceText}${answerText}`;
}

function buildCameraKnowledgeResponse(
  awareness: import("../video-knowledge-engine/professional-camera-knowledge-types.js").AiMeCameraKnowledgeAwareness,
  movement:
    | import("../video-knowledge-engine/professional-camera-knowledge-types.js").CameraMovementRecommendation
    | undefined,
  settings:
    | import("../video-knowledge-engine/professional-camera-knowledge-types.js").CameraSettingsRecommendation
    | undefined,
  explained:
    | import("../video-knowledge-engine/professional-camera-knowledge-types.js").CameraKnowledgeExplainResult
    | undefined,
  answered: { available: boolean; answer: string; knowledgeIds: string[]; confidenceScore: number } | undefined
): string {
  const movementText = movement?.available
    ? ` Recommended movement: ${movement.name}. Why: ${movement.reason}`
    : "";
  const settingsText = settings?.available
    ? ` Settings guidance (${settings.title}): ${settings.settingsGuidance.slice(0, 2).join("; ")}.`
    : "";
  const explainText = explained?.available ? ` ${explained.title}: ${explained.explanation}` : "";
  const answerText = answered?.available ? ` Answer: ${answered.answer}` : "";
  return `${awareness.summary}${movementText}${settingsText}${explainText}${answerText}`;
}

function buildLightingCompositionResponse(
  awareness: import("../video-knowledge-engine/professional-lighting-composition-types.js").AiMeLightingCompositionAwareness,
  lighting:
    | import("../video-knowledge-engine/professional-lighting-composition-types.js").LightingCompositionRecommendation
    | undefined,
  composition:
    | import("../video-knowledge-engine/professional-lighting-composition-types.js").LightingCompositionRecommendation
    | undefined,
  explained:
    | import("../video-knowledge-engine/professional-lighting-composition-types.js").LightingCompositionExplainResult
    | undefined,
  answered: { available: boolean; answer: string; knowledgeIds: string[]; confidenceScore: number } | undefined
): string {
  const lightingText = lighting?.available
    ? ` Recommended lighting: ${lighting.name}. Why: ${lighting.reason}`
    : "";
  const compositionText = composition?.available
    ? ` Recommended composition: ${composition.name}. Why: ${composition.reason}`
    : "";
  const explainText = explained?.available ? ` ${explained.title}: ${explained.explanation}` : "";
  const answerText = answered?.available ? ` Answer: ${answered.answer}` : "";
  return `${awareness.summary}${lightingText}${compositionText}${explainText}${answerText}`;
}

function buildStorytellingSceneResponse(
  awareness: import("../video-knowledge-engine/professional-storytelling-scene-types.js").AiMeStorytellingSceneAwareness,
  structure:
    | import("../video-knowledge-engine/professional-storytelling-scene-types.js").StoryStructureResult
    | undefined,
  sequence:
    | import("../video-knowledge-engine/professional-storytelling-scene-types.js").SceneSequenceRecommendation
    | undefined,
  emotionalFlow:
    | import("../video-knowledge-engine/professional-storytelling-scene-types.js").EmotionalFlowRecommendation
    | undefined,
  layout:
    | import("../video-knowledge-engine/professional-storytelling-scene-types.js").SceneLayoutRecommendation
    | undefined,
  explained:
    | import("../video-knowledge-engine/professional-storytelling-scene-types.js").StorytellingExplainResult
    | undefined,
  answered: { available: boolean; answer: string; knowledgeIds: string[]; confidenceScore: number } | undefined
): string {
  const structureText = structure?.available
    ? ` Story structure (${structure.structureName}): ${structure.acts.map((a) => a.name).join(" → ")}.`
    : "";
  const sequenceText = sequence?.available
    ? ` Scene sequence (${sequence.sequenceName}): ${sequence.scenes.map((s) => s.name).join(" → ")}.`
    : "";
  const emotionText = emotionalFlow?.available
    ? ` Emotional flow (${emotionalFlow.flowName}): ${emotionalFlow.stages.join(" → ")}.`
    : "";
  const layoutText = layout?.available
    ? ` Scene layout (${layout.sceneName}): ${layout.layoutGuidance.slice(0, 2).join("; ")}.`
    : "";
  const explainText = explained?.available ? ` ${explained.title}: ${explained.explanation}` : "";
  const answerText = answered?.available ? ` Answer: ${answered.answer}` : "";
  return `${awareness.summary}${structureText}${sequenceText}${emotionText}${layoutText}${explainText}${answerText}`;
}

function buildAmrResponse(
  awareness: import("../video-knowledge-engine/professional-animation-motion-rendering-types.js").AiMeAmrAwareness,
  animation:
    | import("../video-knowledge-engine/professional-animation-motion-rendering-types.js").AmrRecommendation
    | undefined,
  motion:
    | import("../video-knowledge-engine/professional-animation-motion-rendering-types.js").AmrRecommendation
    | undefined,
  rendering:
    | import("../video-knowledge-engine/professional-animation-motion-rendering-types.js").AmrRecommendation
    | undefined,
  exportSettings:
    | import("../video-knowledge-engine/professional-animation-motion-rendering-types.js").AmrRecommendation
    | undefined,
  explained:
    | import("../video-knowledge-engine/professional-animation-motion-rendering-types.js").AmrExplainResult
    | undefined,
  answered: { available: boolean; answer: string; knowledgeIds: string[]; confidenceScore: number } | undefined
): string {
  const animText = animation?.available ? ` Animation: ${animation.name}. ${animation.reason}` : "";
  const motionText = motion?.available ? ` Motion: ${motion.name}. ${motion.reason}` : "";
  const renderText = rendering?.available ? ` Rendering: ${rendering.name}. ${rendering.reason}` : "";
  const exportText = exportSettings?.available
    ? ` Export: ${exportSettings.name}. ${exportSettings.bestPractices.slice(0, 2).join("; ")}.`
    : "";
  const explainText = explained?.available ? ` ${explained.title}: ${explained.explanation}` : "";
  const answerText = answered?.available ? ` Answer: ${answered.answer}` : "";
  return `${awareness.summary}${animText}${motionText}${renderText}${exportText}${explainText}${answerText}`;
}

function buildMbpResponse(
  awareness: import("../video-knowledge-engine/professional-marketing-branding-psychology-types.js").AiMeMbpAwareness,
  marketing:
    | import("../video-knowledge-engine/professional-marketing-branding-psychology-types.js").MbpRecommendation
    | undefined,
  branding:
    | import("../video-knowledge-engine/professional-marketing-branding-psychology-types.js").MbpRecommendation
    | undefined,
  customerPsych:
    | import("../video-knowledge-engine/professional-marketing-branding-psychology-types.js").MbpExplainResult
    | undefined,
  salesPsych:
    | import("../video-knowledge-engine/professional-marketing-branding-psychology-types.js").MbpExplainResult
    | undefined,
  cta:
    | import("../video-knowledge-engine/professional-marketing-branding-psychology-types.js").MbpRecommendation
    | undefined,
  productPresentation:
    | import("../video-knowledge-engine/professional-marketing-branding-psychology-types.js").MbpRecommendation
    | undefined,
  answered: { available: boolean; answer: string; knowledgeIds: string[]; confidenceScore: number } | undefined
): string {
  const marketingText = marketing?.available ? ` Marketing: ${marketing.name}. ${marketing.reason}` : "";
  const brandingText = branding?.available ? ` Branding: ${branding.name}. ${branding.reason}` : "";
  const customerText = customerPsych?.available
    ? ` Customer psychology (${customerPsych.title}): ${customerPsych.explanation}`
    : "";
  const salesText = salesPsych?.available
    ? ` Sales psychology (${salesPsych.title}): ${salesPsych.explanation}`
    : "";
  const ctaText = cta?.available ? ` CTA: ${cta.name}. ${cta.bestPractices.slice(0, 2).join("; ")}.` : "";
  const productText = productPresentation?.available
    ? ` Product presentation: ${productPresentation.name}. ${productPresentation.reason}`
    : "";
  const answerText = answered?.available ? ` Answer: ${answered.answer}` : "";
  return `${awareness.summary}${marketingText}${brandingText}${customerText}${salesText}${ctaText}${productText}${answerText}`;
}

function buildSmResponse(
  awareness: import("../video-knowledge-engine/professional-social-media-types.js").AiMeSocialMediaAwareness,
  platform:
    | import("../video-knowledge-engine/professional-social-media-types.js").SmRecommendation
    | undefined,
  format:
    | import("../video-knowledge-engine/professional-social-media-types.js").SmRecommendation
    | undefined,
  posting:
    | import("../video-knowledge-engine/professional-social-media-types.js").SmRecommendation
    | undefined,
  engagement:
    | import("../video-knowledge-engine/professional-social-media-types.js").SmRecommendation
    | undefined,
  explained:
    | import("../video-knowledge-engine/professional-social-media-types.js").SmExplainResult
    | undefined,
  answered: { available: boolean; answer: string; knowledgeIds: string[]; confidenceScore: number } | undefined
): string {
  const platformText = platform?.available ? ` Platform: ${platform.name}. ${platform.reason}` : "";
  const formatText = format?.available ? ` Format: ${format.name}. ${format.reason}` : "";
  const postingText = posting?.available
    ? ` Posting: ${posting.name}. ${posting.bestPractices.slice(0, 2).join("; ")}.`
    : "";
  const engagementText = engagement?.available
    ? ` Engagement: ${engagement.name}. ${engagement.reason}`
    : "";
  const explainText = explained?.available ? ` ${explained.title}: ${explained.explanation}` : "";
  const answerText = answered?.available ? ` Answer: ${answered.answer}` : "";
  return `${awareness.summary}${platformText}${formatText}${postingText}${engagementText}${explainText}${answerText}`;
}

function buildIsqResponse(
  awareness: import("../video-knowledge-engine/professional-industry-standards-quality-types.js").AiMeIndustryStandardsAwareness,
  quality:
    | import("../video-knowledge-engine/professional-industry-standards-quality-types.js").IsqQualityEvaluation
    | undefined,
  improvement:
    | import("../video-knowledge-engine/professional-industry-standards-quality-types.js").IsqRecommendation
    | undefined,
  problems:
    | import("../video-knowledge-engine/professional-industry-standards-quality-types.js").IsqQualityEvaluation
    | undefined,
  standard:
    | import("../video-knowledge-engine/professional-industry-standards-quality-types.js").IsqExplainResult
    | undefined,
  practices:
    | import("../video-knowledge-engine/professional-industry-standards-quality-types.js").IsqRecommendation
    | undefined,
  answered: { available: boolean; answer: string; knowledgeIds: string[]; confidenceScore: number } | undefined
): string {
  const qualityText = quality?.available
    ? ` Quality criteria (${quality.title}): ${quality.evaluationCriteria.slice(0, 2).join("; ")}.`
    : "";
  const improvementText = improvement?.available
    ? ` Improvement: ${improvement.name}. ${improvement.bestPractices.slice(0, 2).join("; ")}.`
    : "";
  const problemsText = problems?.available && problems.detectedRisks.length
    ? ` Likely risks: ${problems.detectedRisks.slice(0, 2).join("; ")}.`
    : "";
  const standardText = standard?.available ? ` Standard: ${standard.title}. ${standard.explanation}` : "";
  const practicesText = practices?.available ? ` Best practice: ${practices.name}. ${practices.reason}` : "";
  const answerText = answered?.available ? ` Answer: ${answered.answer}` : "";
  return `${awareness.summary}${qualityText}${improvementText}${problemsText}${standardText}${practicesText}${answerText}`;
}

function buildProfessionalCertificationResponse(
  awareness: import("../knowledge-foundation/professional-knowledge-certification-types.js").AiMeProfessionalKnowledgeCertificationAwareness,
  result:
    | import("../knowledge-foundation/professional-knowledge-certification-types.js").ProfessionalKnowledgeCertificationResult
    | null
    | undefined
): string {
  if (!result) return awareness.summary;
  const status = result.certified ? "CERTIFIED" : "NOT CERTIFIED";
  const gaps = result.remainingGaps.length ? ` Remaining gaps: ${result.remainingGaps.slice(0, 3).join("; ")}.` : "";
  return `${awareness.summary} Status: ${status}. Maturity: ${result.maturityPercentage}%. Domains: ${result.totalKnowledgeDomains}; packs: ${result.totalKnowledgePacks}; relationships: ${result.totalKnowledgeRelationships}.${gaps}`;
}

function buildVideoKnowledgeResponse(advisory: import("../video-knowledge-engine/video-production-knowledge-builder.js").VideoProductionKnowledgeAdvisory): string {
  if (!advisory.available) return ` ${advisory.learningRecommendation}`;
  const guidance = advisory.recommendations.slice(0, 3).map((recommendation) => `${recommendation.area}: ${recommendation.guidance}`).join(" ");
  return ` Validated video-production guidance (${advisory.confidenceScore}/100 confidence): ${guidance}`;
}

function buildProfessionalKnowledgeResponse(reasoning: import("../knowledge-reasoning-engine/types.js").ProfessionalKnowledgeReasoningResult): string {
  if (!reasoning.available || !reasoning.selected) {
    const missing = reasoning.missingInformation.length
      ? ` Missing: ${reasoning.missingInformation
          .slice(0, 2)
          .map((item) => item.field)
          .join(", ")}.`
      : "";
    return ` Professional reasoning unavailable from verified Knowledge Foundation evidence.${missing}`;
  }
  const domains = reasoning.domainsUsed.length ? ` Domains: ${reasoning.domainsUsed.slice(0, 5).join(", ")}.` : "";
  const alternatives = reasoning.rejectedOptions.length
    ? ` Rejected: ${reasoning.rejectedOptions[0].title} — ${reasoning.rejectedOptions[0].rejectionReason ?? reasoning.rejectedOptions[0].reason}`
    : "";
  const standards = reasoning.professionalStandards.length ? ` Standard: ${reasoning.professionalStandards[0]}` : "";
  const risks = reasoning.risks.length ? ` Risk: ${reasoning.risks[0]}` : "";
  const improvements = reasoning.improvements.length ? ` Improve: ${reasoning.improvements[0]}` : "";
  return ` Professional reasoning (${reasoning.confidenceScore}/100 confidence${reasoning.multiDomain ? ", multi-domain" : ""}): ${reasoning.selected.guidance} Why: ${reasoning.explanation}${domains}${standards}${alternatives}${risks}${improvements}`;
}

function buildProfessionalDecisionResponse(decision: import("../decision/professional-decision-types.js").ProfessionalDecisionResult): string {
  if (!decision.grounded || decision.unsupported) {
    const missing = decision.missingInformation.length
      ? ` Missing: ${decision.missingInformation
          .slice(0, 2)
          .map((item) => item.field)
          .join(", ")}.`
      : "";
    return ` Professional decision unsupported without verified Knowledge Foundation evidence.${missing}`;
  }
  const packs = decision.explanation.knowledgePacksUsed.length
    ? ` Knowledge packs: ${decision.explanation.knowledgePacksUsed.slice(0, 4).join(", ")}.`
    : "";
  const rejected = decision.explanation.alternativesRejected.length
    ? ` Rejected: ${decision.explanation.alternativesRejected[0].title} — ${decision.explanation.alternativesRejected[0].reason}`
    : "";
  const standards = decision.framework.professionalStandards.length
    ? ` Standard: ${decision.framework.professionalStandards[0]}`
    : "";
  const risks = decision.framework.risks.length ? ` Risk: ${decision.framework.risks[0]}` : "";
  const history = decision.learnedFromHistory ? " Learned from prior professional decisions." : "";
  return ` Professional decision ${decision.decisionId} (${decision.confidenceScore}/100 confidence${decision.multiDomain ? ", multi-domain" : ""}): ${decision.framework.finalRecommendation} Why: ${decision.explanation.whySelected} Outcome: ${decision.explanation.expectedOutcome}${packs}${standards}${rejected}${risks}${history}`;
}

function buildProfessionalPlanningResponse(plan: import("../planning/professional-planning-types.js").ProfessionalPlanningResult): string {
  if (!plan.grounded || plan.unsupported) {
    const missing = plan.missingInformation.length
      ? ` Missing: ${plan.missingInformation
          .slice(0, 2)
          .map((item) => item.field)
          .join(", ")}.`
      : "";
    return ` Professional plan unsupported without verified Knowledge Foundation evidence.${missing}`;
  }
  const tasks = ` Tasks: ${plan.framework.taskBreakdown.length} (${plan.framework.complexity} complexity, ~${plan.framework.estimatedExecutionMinutes} min).`;
  const deps = plan.framework.dependencies.length ? ` Dependencies: ${plan.framework.dependencies.length}.` : "";
  const packs = plan.explanation.knowledgePacksUsed.length
    ? ` Knowledge packs: ${plan.explanation.knowledgePacksUsed.slice(0, 4).join(", ")}.`
    : "";
  const parallel = plan.framework.parallelTasks.length ? ` Parallel groups: ${plan.framework.parallelTasks.length}.` : "";
  return ` Professional plan ${plan.planId} (${plan.confidenceScore}/100 confidence${plan.multiDomain ? ", multi-domain" : ""}): ${plan.framework.goal} Why: ${plan.explanation.whySelected} Order: ${plan.explanation.taskOrderReason} Outcome: ${plan.explanation.expectedOutcome}${tasks}${deps}${parallel}${packs}`;
}

function buildProfessionalWorkflowResponse(workflow: import("../workflow/professional-workflow-types.js").ProfessionalWorkflowResult): string {
  if (!workflow.grounded || workflow.unsupported) {
    return " Professional workflow unsupported without verified Knowledge Foundation evidence.";
  }
  const tasks = ` Tasks: ${workflow.definition.allTasks.length} (main ${workflow.definition.mainTasks.length}, sub ${workflow.definition.subTasks.length}, validation ${workflow.definition.validationSteps.length}).`;
  const deps = ` Dependencies: ${workflow.definition.dependencies.length}.`;
  const parallel = workflow.definition.parallelGroups.length ? ` Parallel groups: ${workflow.definition.parallelGroups.length}.` : "";
  const packs = workflow.explanation.knowledgePacksUsed.length
    ? ` Knowledge packs: ${workflow.explanation.knowledgePacksUsed.slice(0, 4).join(", ")}.`
    : "";
  const reuse = workflow.reused ? " Reused existing workflow." : "";
  return ` Professional workflow ${workflow.workflowId} (${workflow.confidenceScore}/100 confidence${workflow.multiDomain ? ", multi-domain" : ""}): ${workflow.definition.workflowName} — ${workflow.definition.goal} Why: ${workflow.explanation.whySelected} Order: ${workflow.explanation.taskOrderReason} Outcome: ${workflow.explanation.expectedOutcome}${tasks}${deps}${parallel}${packs}${reuse}`;
}

function buildProfessionalReasoningCertificationResponse(
  result: import("../professional-reasoning-certification/professional-reasoning-certification-types.js").ProfessionalReasoningCertificationResult
): string {
  const answers = result.aiMeAnswers;
  const health = result.systemHealth;
  const scenarios = `${result.scenarios.filter((item) => item.passed).length}/${result.scenarios.length} scenarios passed`;
  const cert = result.certified
    ? " CERTIFIED: Professional Reasoning & Decision Intelligence Version 1.0."
    : ` NOT CERTIFIED. Blockers: ${result.blockers.slice(0, 3).join("; ") || "see report"}.`;
  return ` Certification ${result.version} (readiness ${health.professionalReadinessScore}/100, confidence ${health.confidenceScore}/100): ${scenarios}. Think professionally: ${answers.canThinkProfessionally ? "YES" : "NO"}. Explainable decisions: ${answers.canMakeExplainableDecisions ? "YES" : "NO"}. Version 1.0 complete: ${answers.isVersionOneComplete ? "YES" : "NO"}.${cert}`;
}

function buildProfessionalSelfReviewResponse(
  review: import("../self-review/professional-self-review-types.js").ProfessionalSelfReviewResult
): string {
  if (!review.grounded || review.unsupported) {
    return " Professional self-review unsupported without verified Knowledge Foundation evidence.";
  }
  const scores = review.framework.qualityScores;
  const issues = ` Issues: ${review.framework.detectedIssues.length} (${review.framework.detectedIssues.filter((i) => i.repaired).length} repaired).`;
  const readiness = ` Overall readiness: ${scores.overallReadiness}/100.`;
  const delivery = review.readyForDelivery ? " Ready for delivery." : " Not ready for delivery.";
  const reuse = review.reused ? " Reused prior self-review." : "";
  return ` Professional self-review ${review.reviewId} (${review.confidenceScore}/100 confidence): ${review.framework.improvedRecommendation} Strengths: ${review.framework.strengths.slice(0, 2).join("; ") || "n/a"}.${issues}${readiness}${delivery}${reuse}`;
}

function buildProfessionalMultiDomainResponse(
  reasoning: import("../multi-domain/professional-multi-domain-types.js").ProfessionalMultiDomainResult
): string {
  if (!reasoning.grounded || reasoning.unsupported) {
    return " Multi-domain reasoning unsupported without verified Knowledge Foundation evidence across relevant domains.";
  }
  const domains = reasoning.framework.domainsParticipating.slice(0, 6).join(", ");
  const conflicts = reasoning.framework.conflicts.length
    ? ` Conflicts resolved: ${reasoning.framework.conflicts.length}.`
    : " No hard conflicts.";
  const packs = reasoning.explanation.knowledgePacksUsed.length
    ? ` Knowledge packs: ${reasoning.explanation.knowledgePacksUsed.slice(0, 4).join(", ")}.`
    : "";
  const reuse = reasoning.reused ? " Reused prior multi-domain reasoning." : "";
  return ` Multi-domain reasoning ${reasoning.reasoningId} (${reasoning.confidenceScore}/100 confidence): ${reasoning.framework.combinedRecommendation} Domains: ${domains}.${conflicts} Why: ${reasoning.explanation.whySelected}${packs}${reuse}`;
}

function buildProfessionalRecommendationResponse(
  recommendation: import("../recommendation/professional-recommendation-types.js").ProfessionalRecommendationResult
): string {
  if (!recommendation.grounded || recommendation.unsupported) {
    return " Professional recommendation unsupported without verified Knowledge Foundation evidence.";
  }
  const alts = recommendation.framework.alternativeSolutions
    .map((alt) => `Rank ${alt.rank}: ${alt.title}`)
    .join("; ");
  const packs = recommendation.explanation.knowledgePacksUsed.length
    ? ` Knowledge packs: ${recommendation.explanation.knowledgePacksUsed.slice(0, 4).join(", ")}.`
    : "";
  const workflows = recommendation.explanation.workflowsConsidered.length
    ? ` Workflows considered: ${recommendation.explanation.workflowsConsidered.slice(0, 3).join(", ")}.`
    : "";
  const decisions = recommendation.explanation.decisionsInfluenced.length
    ? ` Decisions: ${recommendation.explanation.decisionsInfluenced.slice(0, 2).join(", ")}.`
    : "";
  const reuse = recommendation.reused ? " Reused existing recommendation." : "";
  return ` Professional recommendation ${recommendation.recommendationId} (${recommendation.confidenceScore}/100 confidence${recommendation.multiDomain ? ", multi-domain" : ""}): ${recommendation.framework.recommendedSolution} Why: ${recommendation.explanation.whySelected} Alternatives: ${alts}. Benefits: ${recommendation.explanation.expectedBenefits.slice(0, 2).join("; ")}.${packs}${workflows}${decisions}${reuse}`;
}