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
  { intent: "translation", terms: ["translate", "translation", "hindura mu", "ubuhinduzi"], engines: ["language-knowledge"] },
  { intent: "project-management", terms: ["project", "open project", "create project", "umushinga"], engines: ["creative-workspace", "project-memory"] },
  { intent: "system", terms: ["status", "health", "system", "settings", "imikorere"], engines: ["ai-core", "health-monitor"] },
];

interface ConversationStore {
  conversations: ConversationRecord[];
}

export interface ConversationExecutionDispatcher {
  dispatch(projectId: string, plan: ConversationPlan): Promise<{ jobId: string }>;
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
    if (confirmation && conversation.pendingPlan && conversation.projectId) {
      const execution = await this.dispatch(conversation);
      const response = execution.dispatched
        ? `I started the ${conversation.pendingPlan.intent} workflow for this project. I will keep its progress available in the workspace.`
        : `I could not start the prepared workflow: ${execution.error ?? "the local execution runtime is unavailable"}.`;
      conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent: conversation.pendingPlan.intent });
      conversation.updatedAt = new Date().toISOString();
      await this.persist();
      return { conversation: structuredClone(conversation), language, plan: conversation.pendingPlan, response, context: await this.retrieveContext(message, conversation.projectId), execution };
    }

    const context = await this.retrieveContext(message, conversation.projectId);
    const plan = buildPlan(intent, message, conversation.projectId, context.projectKnown);
    if (plan.readyForWorkflow) await this.attachDecisionPreview(plan, message, conversation.projectId);
    const response = buildResponse(language, plan, context);
    conversation.pendingPlan = plan.readyForWorkflow ? structuredClone(plan) : undefined;
    conversation.messages.push({ id: randomUUID(), role: "assistant", text: response, createdAt: new Date().toISOString(), intent });
    conversation.messages.splice(0, Math.max(0, conversation.messages.length - MAX_MESSAGES_PER_CONVERSATION));
    conversation.updatedAt = new Date().toISOString();
    await this.persist();

    return { conversation: structuredClone(conversation), language, plan, response, context };
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
  return { intent, requiredEngines: rule?.engines ?? ["conversation-engine"], complexity: intent === "video-generation" ? "high" : ["image-generation", "marketing", "editing"].includes(intent) ? "medium" : "low", readyForWorkflow: missingInformation.length === 0 && intent !== "general" && intent !== "system", missingInformation };
}

function buildResponse(language: ConversationLanguage, plan: ConversationPlan, context: ConversationResponse["context"]): string {
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