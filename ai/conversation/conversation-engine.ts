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
    if (intent === "knowledge-acquisition") {
      const acquisition = this.core!.knowledgeFoundation?.isStartupComplete()
        ? await this.core!.knowledgeFoundation.getKnowledgeAcquisitionEngine().prepare({ topic: extractKnowledgeTopic(message), sources: input.knowledgeSources, requesterId: "conversation-engine" })
        : null;
      const plan: ConversationPlan = { intent, requiredEngines: ["knowledge-acquisition", "knowledge-foundation", "knowledge-validation"], complexity: "medium", readyForWorkflow: false, missingInformation: acquisition?.status === "rejected" ? acquisition.rejectionReasons : [] };
      conversation.pendingKnowledgeRequestId = acquisition?.status === "pending-approval" ? acquisition.requestId : undefined;
      const response = acquisition
        ? buildKnowledgeAcquisitionResponse(acquisition)
        : "Knowledge research is unavailable until the local Knowledge Foundation has completed startup.";
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return { conversation: structuredClone(conversation), language, plan, response, context, knowledgeAcquisition: acquisition ?? undefined };
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
  return { intent, requiredEngines: rule?.engines ?? ["conversation-engine"], complexity: intent === "video-generation" ? "high" : ["image-generation", "marketing", "editing", "business-intelligence"].includes(intent) ? "medium" : "low", readyForWorkflow: missingInformation.length === 0 && intent !== "general" && intent !== "system" && intent !== "workspace-synchronization" && intent !== "enterprise-integration" && intent !== "enterprise-collaboration" && intent !== "publishing-distribution", missingInformation };
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