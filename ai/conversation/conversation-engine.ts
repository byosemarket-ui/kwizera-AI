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
  { intent: "video-generation", terms: ["video", "movie", "film", "generate video", "amashusho"], engines: ["video-audio-generation", "creative-planning"] },
  { intent: "product-analysis", terms: ["analyze product", "product analysis", "analyse", "isesengura", "sesengura"], engines: ["product-intelligence", "image-intelligence"] },
  { intent: "editing", terms: ["edit", "change", "remove background", "retouch", "hindura", "kosora"], engines: ["creative-workspace", "image-generation"] },
  { intent: "marketing", terms: ["marketing", "campaign", "audience", "cta", "ubukangurambaga", "abakiriya"], engines: ["marketing-intelligence", "creative-planning"] },
  { intent: "business-intelligence", terms: ["business", "sales", "revenue", "inventory", "stock", "forecast", "recommendation", "analytics", "ubucuruzi", "igurisha", "ububiko"], engines: ["business-intelligence", "decision-engine", "memory-foundation", "knowledge-foundation"] },
  { intent: "workspace-synchronization", terms: ["synchronization", "synchronize", "sync", "backup workspace", "restore workspace", "offline workspace", "cloud workspace"], engines: ["workspace-synchronization", "memory-backup-engine", "desktop-integration"] },
  { intent: "enterprise-integration", terms: ["connector", "integration", "webhook", "external api", "erp", "crm", "oauth"], engines: ["enterprise-integration", "connector-management", "plugin-management"] },
  { intent: "enterprise-collaboration", terms: ["organization", "team", "teams", "permissions", "permission", "collaboration", "collaborate", "members", "member", "audit log", "notifications", "workspace lock"], engines: ["enterprise-collaboration", "creative-workspace", "workspace-synchronization"] },
  { intent: "publishing-distribution", terms: ["publishing status", "distribution status", "schedule campaign", "content delivery", "publish", "publishing", "distribution"], engines: ["publishing-distribution", "creative-review", "connector-management"] },
  { intent: "translation", terms: ["translate", "translation", "hindura mu", "ubuhinduzi"], engines: ["language-knowledge"] },
  { intent: "knowledge-persistence", terms: ["knowledge persistence", "restart verification", "knowledge seeding", "seeding certification", "permanently remember", "knowledge certificate", "knowledge health report"], engines: ["knowledge-foundation"] },
  { intent: "knowledge-import", terms: ["import knowledge", "knowledge import", "activate knowledge", "foundation activation", "imported knowledge", "sync knowledge", "knowledge foundation active"], engines: ["knowledge-foundation", "knowledge-validation-engine"] },
  { intent: "knowledge-validation", terms: ["knowledge validation", "validate knowledge", "certify knowledge", "knowledge certification", "certified packs", "pack quality", "professional readiness"], engines: ["knowledge-validation-engine", "knowledge-foundation"] },
  { intent: "knowledge-packs", terms: ["knowledge pack", "knowledge packs", "extract knowledge", "knowledge extraction", "professional knowledge", "decision rules", "best practices pack", "knowledge workflows"], engines: ["knowledge-processing-engine", "knowledge-foundation"] },
  { intent: "knowledge-documents", terms: ["document understanding", "understood documents", "search documents", "document summary", "summarize document", "explain document", "recommend documents", "missing topics", "document index"], engines: ["knowledge-processing-engine", "knowledge-foundation"] },
  { intent: "knowledge-collection", terms: ["collected resources", "knowledge collection", "local knowledge workspace", "workspace resources", "what resources collected", "missing knowledge resources", "collect knowledge", "resource metadata"], engines: ["knowledge-research-engine", "knowledge-foundation"] },
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
    const professionalKnowledge = ["image-generation", "video-generation", "marketing", "business-intelligence"].includes(intent) && this.core!.knowledgeFoundation?.isStartupComplete()
      ? await this.core!.knowledgeFoundation.getKnowledgeReasoningEngine().reason(message)
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
  if (["editing", "project-management"].includes(intent) && !projectId) missingInformation.push("Select or provide the project to work on.");
  return { intent, requiredEngines: rule?.engines ?? ["conversation-engine"], complexity: intent === "video-generation" ? "high" : ["image-generation", "marketing", "editing", "business-intelligence"].includes(intent) ? "medium" : "low", readyForWorkflow: missingInformation.length === 0 && intent !== "general" && intent !== "system" && intent !== "workspace-synchronization" && intent !== "enterprise-integration" && intent !== "enterprise-collaboration" && intent !== "publishing-distribution" && intent !== "knowledge-domains" && intent !== "knowledge-acquisition" && intent !== "knowledge-sources" && intent !== "knowledge-collection" && intent !== "knowledge-documents" && intent !== "knowledge-packs" && intent !== "knowledge-validation" && intent !== "knowledge-import" && intent !== "knowledge-persistence" && intent !== "video-production-knowledge" && intent !== "camera-knowledge" && intent !== "lighting-composition-knowledge" && intent !== "storytelling-scene-knowledge" && intent !== "animation-motion-rendering-knowledge" && intent !== "marketing-branding-psychology-knowledge" && intent !== "social-media-knowledge", missingInformation };
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

function buildVideoKnowledgeResponse(advisory: import("../video-knowledge-engine/video-production-knowledge-builder.js").VideoProductionKnowledgeAdvisory): string {
  if (!advisory.available) return ` ${advisory.learningRecommendation}`;
  const guidance = advisory.recommendations.slice(0, 3).map((recommendation) => `${recommendation.area}: ${recommendation.guidance}`).join(" ");
  return ` Validated video-production guidance (${advisory.confidenceScore}/100 confidence): ${guidance}`;
}

function buildProfessionalKnowledgeResponse(reasoning: import("../knowledge-reasoning-engine/types.js").ProfessionalKnowledgeReasoningResult): string {
  if (!reasoning.available || !reasoning.selected) return "";
  const alternatives = reasoning.alternatives.length ? ` Alternative: ${reasoning.alternatives[0].guidance}` : "";
  const risks = reasoning.risks.length ? ` Risk: ${reasoning.risks[0]}` : "";
  return ` Professional reasoning (${reasoning.confidenceScore}/100 confidence): ${reasoning.selected.guidance} Why: ${reasoning.explanation}${alternatives}${risks}`;
}