/**
 * Phase 6 Step 2 — AI Me Creative Assistant engine.
 * Orchestration / conversation only — reuses review, final, queue, and shell systems.
 */

import { creativeReviewEngine } from "../creative-review/review-engine";
import { productionFinalEngine } from "../production-final/final-engine";
import type { WorkspaceId } from "../shell/types";
import { refreshAssistantContext } from "./context";
import { detectIntent, detectLanguage, extractSceneId, extractTimestampSec, inferFeedbackCategory } from "./intent";
import { buildSuggestions, createChangeProposal, respondToIntent } from "./respond";
import { creativeDecisionEngine } from "../creative-decision/decision-engine";
import { creativeMemoryEngine } from "../creative-memory/memory-engine";
import type {
  AssistantAction,
  AssistantMessage,
  AssistantUiSnapshot,
  AuditLogEntry,
  ChangeRequestObject,
  ConversationRecord,
} from "./types";
import {
  ASSISTANT_AUDIT_KEY,
  ASSISTANT_CHAT_KEY,
  ASSISTANT_STORE_KEY,
  QUICK_COMMANDS,
} from "./types";

type NotifyFn = (
  tone: "success" | "warning" | "error" | "info",
  title: string,
  detail: string,
  category?: "information" | "warnings" | "errors" | "production-complete" | "updates" | "ai-suggestions",
) => void;

type Listener = (snap: AssistantUiSnapshot) => void;
type NavigateFn = (workspace: WorkspaceId) => void;

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export class CreativeAssistantEngine {
  private listeners = new Set<Listener>();
  private notify: NotifyFn | null = null;
  private emitEvents: ((type: string, payload: Record<string, unknown>) => void) | null = null;
  private navigate: NavigateFn | null = null;
  private thinking = false;
  private streamingText: string | null = null;
  private lastError: string | null = null;
  private recommendation = "Open Creative Review, then ask AI Me about this production.";
  private conversation: ConversationRecord | null = null;
  private pendingProposal: ChangeRequestObject | null = null;
  private proposals: ChangeRequestObject[] = [];
  private audit: AuditLogEntry[] = [];
  private contextCacheId: string | null = null;
  private lastContextAt = "";

  setNotify(fn: NotifyFn | null): void { this.notify = fn; }
  setEventEmitter(fn: ((type: string, payload: Record<string, unknown>) => void) | null): void { this.emitEvents = fn; }
  setNavigate(fn: NavigateFn | null): void { this.navigate = fn; }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): AssistantUiSnapshot {
    const context = this.refreshContext(false);
    return {
      version: 1,
      context,
      conversation: this.conversation,
      pendingProposal: this.pendingProposal,
      proposals: this.proposals,
      audit: this.audit.slice(-40),
      thinking: this.thinking,
      streamingText: this.streamingText,
      lastError: this.lastError,
      recommendation: this.recommendation,
      updatedAt: new Date().toISOString(),
    };
  }

  buildAiMeContext() {
    const context = this.refreshContext(false);
    return {
      available: context.available,
      productionId: context.productionId,
      versionLabel: context.versionLabel,
      reviewStatus: context.reviewStatus,
      qcOverall: context.qcOverall,
      pendingProposal: this.pendingProposal?.status ?? null,
      messageCount: this.conversation?.messages.length ?? 0,
      recommendation: this.recommendation,
      explanation: context.available
        ? `AI Me Creative Assistant is active for ${context.projectName} ${context.versionLabel}. Review: ${context.reviewStatus}. QC: ${context.qcOverall ?? "N/A"}.`
        : context.unavailableReason || "Project context unavailable.",
    };
  }

  hydrate(): boolean {
    creativeReviewEngine.hydrate();
    const context = this.refreshContext(true);
    this.proposals = loadJson(ASSISTANT_STORE_KEY, [] as ChangeRequestObject[]);
    this.audit = loadJson(ASSISTANT_AUDIT_KEY, [] as AuditLogEntry[]);
    const chats = loadJson<Record<string, ConversationRecord>>(ASSISTANT_CHAT_KEY, {});
    const key = this.conversationKey(context.projectId, context.productionId, context.versionLabel);
    this.conversation = chats[key] ?? null;
    if (!this.conversation && context.available) {
      this.conversation = this.createConversation(context.projectId, context.productionId, context.versionLabel);
      this.pushMessage({
        id: uid("msg"),
        role: "assistant",
        title: "AI ME",
        body: context.contract?.explanation
          || "How can I help with this production? I answer from live review/production state only.",
        language: "en",
        createdAt: new Date().toISOString(),
      });
    }
    this.pendingProposal = this.proposals.find((p) => p.status === "PENDING_APPROVAL") ?? null;
    this.recommendation = context.available
      ? `Ready — ${context.projectName} · ${context.versionLabel} · ${context.reviewStatus}`
      : context.unavailableReason || "Context unavailable";
    this.emit();
    return context.available;
  }

  refreshContext(force = true) {
    if (!force && this.contextCacheId && this.lastContextAt) {
      const age = Date.now() - Date.parse(this.lastContextAt);
      if (age < 1500) {
        return refreshAssistantContext();
      }
    }
    const ctx = refreshAssistantContext();
    this.contextCacheId = `${ctx.productionId}:${ctx.versionLabel}:${ctx.reviewStatus}:${ctx.feedbackCount}`;
    this.lastContextAt = ctx.refreshedAt;
    return ctx;
  }

  async sendQuickCommand(id: string): Promise<void> {
    const cmd = QUICK_COMMANDS.find((c) => c.id === id);
    if (!cmd) return;
    await this.sendMessage(cmd.message);
  }

  async sendMessage(raw: string): Promise<void> {
    const text = raw.trim();
    if (!text) return;

    const lang = detectLanguage(text);
    const ctx = this.refreshContext(true);
    this.ensureConversation(ctx.projectId, ctx.productionId, ctx.versionLabel);

    this.pushMessage({
      id: uid("msg"),
      role: "user",
      body: text,
      language: lang,
      createdAt: new Date().toISOString(),
    });
    this.auditPush("USER_REQUEST", text, ctx.productionId, ctx.versionLabel, "pending");

    this.thinking = true;
    this.streamingText = "AI is thinking...";
    this.lastError = null;
    this.emit();

    try {
      await delay(40);
      const detected = detectIntent(text);
      this.auditPush("INTENT_DETECTED", `${detected.intent} (${detected.confidence})`, ctx.productionId, ctx.versionLabel, "ok");

      // Immediate structured feedback for visibility/issue statements (E2E Step 2)
      if (detected.intent === "CREATE_FEEDBACK" || (detected.intent === "GENERAL" && /ntabwo igaragara|not visible|can't see|cannot see/i.test(text))) {
        const sceneId = extractSceneId(text, ctx.scenes) ?? ctx.selectedSceneId;
        const ts = extractTimestampSec(text);
        const category = inferFeedbackCategory(text);
        if (ctx.available) {
          creativeReviewEngine.hydrate();
          if (ts != null) {
            creativeReviewEngine.addTimestampComment(ts, text, sceneId);
          }
          const fb = creativeReviewEngine.addFeedback({
            sceneId,
            category,
            comment: text,
            timestampSec: ts,
          });
          if (fb) {
            this.auditPush("FEEDBACK_SAVED", fb.feedbackId, ctx.productionId, ctx.versionLabel, "ok");
            this.notify?.("success", "Feedback saved", `${category} · Scene feedback recorded`, "ai-suggestions");
            creativeReviewEngine.requestChanges();
            this.applyAiReviewPanel(ctx);
          }
        }
        const refreshed = this.refreshContext(true);
        const proposal = createChangeProposal(refreshed, text, { category, sceneId });
        this.pendingProposal = proposal;
        this.proposals = [...this.proposals.filter((p) => p.changeId !== proposal.changeId), proposal];
        this.persistProposals();
        this.auditPush("CHANGE_PROPOSAL_CREATED", proposal.changeId, refreshed.productionId, refreshed.versionLabel, "pending");
        this.notify?.("info", "Change proposal ready", `Proposed ${proposal.requestedVersion}`, "ai-suggestions");

        this.streamAssistant({
          id: uid("msg"),
          role: "assistant",
          title: "Feedback recorded",
          body: [
            lang === "rw"
              ? `Nanditse ikibazo nk'feedback:`
              : `I'll record this as structured review feedback:`,
            "",
            `Scene: ${sceneId ? (refreshed.scenes.find((s) => s.id === sceneId)?.number ?? sceneId) : "—"}`,
            `Category: ${category}`,
            ts != null ? `Timestamp: ${formatClock(ts)}` : null,
            `Comment: ${text}`,
            `Status: OPEN`,
            "",
            lang === "rw"
              ? `Nashobora gutegura ${proposal.requestedVersion}. Emeza niba ushaka.`
              : `I can prepare a fix for ${proposal.requestedVersion} without overwriting ${proposal.sourceVersionId}.`,
          ].filter(Boolean).join("\n"),
          language: lang,
          intent: "CREATE_FEEDBACK",
          createdAt: new Date().toISOString(),
          proposalId: proposal.changeId,
          actions: [
            { id: "proceed", label: "PREPARE / PROCEED", kind: "proceed", payload: { changeId: proposal.changeId } },
            { id: "cancel", label: "CANCEL", kind: "cancel", payload: { changeId: proposal.changeId } },
            { id: "nav", label: "Open Review", kind: "navigate", payload: { workspace: "creative-review" } },
          ],
        });
        return;
      }

      // Phase 6 Step 4 — startup / next-action / smart summary
      if (/nkora iki ubu|what (should|can) i do now|smart summary|project status/i.test(text)
        || (detected.intent === "PRODUCTION_QUERY" && /ubu|now|status|summary/i.test(text))) {
        creativeMemoryEngine.hydrate();
        const summary = creativeMemoryEngine.getSmartSummary(lang);
        const next = creativeMemoryEngine.snapshot().nextAction;
        this.streamAssistant({
          id: uid("msg"),
          role: "assistant",
          title: "Smart Summary",
          body: summary,
          language: lang,
          intent: "PRODUCTION_QUERY",
          createdAt: new Date().toISOString(),
          actions: next?.workspace
            ? [{ id: "next", label: next.label, kind: "navigate", payload: { workspace: next.workspace } }]
            : [],
        });
        return;
      }

      if (/creative profile|buryo dukoresha|ni ubuhe buryo/i.test(text)) {
        creativeMemoryEngine.hydrate();
        this.streamAssistant({
          id: uid("msg"),
          role: "assistant",
          title: "Creative Profile",
          body: creativeMemoryEngine.getCreativeProfileText(lang),
          language: lang,
          intent: "EXPLAIN",
          createdAt: new Date().toISOString(),
        });
        return;
      }

      if (/why (are you|do you) recommend|sobanura recommendation|why this recommendation/i.test(text)) {
        creativeMemoryEngine.hydrate();
        const top = creativeDecisionEngine.snapshot().recommendations.find((r) => r.status !== "IGNORED");
        const body = top
          ? creativeMemoryEngine.explainRecommendation(top.recommendationId)
          : (lang === "rw" ? "Nta recommendation iriho ubu." : "No active recommendation to explain.");
        this.streamAssistant({
          id: uid("msg"),
          role: "assistant",
          title: "Explanation",
          body,
          language: lang,
          intent: "EXPLAIN",
          createdAt: new Date().toISOString(),
        });
        return;
      }

      // Phase 6 Step 3 — Decision Engine for suggest / improve queries
      if (detected.intent === "SUGGEST" || detected.intent === "REVIEW" || /ni iki nakosora|what should i improve/i.test(text)) {
        creativeMemoryEngine.hydrate();
        creativeDecisionEngine.hydrate();
        await creativeDecisionEngine.runAnalysis(false);
        const packed = creativeDecisionEngine.getRecommendationsForAiMe(lang);
        const memCtx = creativeMemoryEngine.buildMemoryContext(text, "recommendation");
        const top = packed.recommendations.slice(0, 5);
        this.applyAiReviewPanel(ctx);
        this.streamAssistant({
          id: uid("msg"),
          role: "assistant",
          title: "AI Recommendations",
          body: [
            packed.body,
            memCtx.transparencyNote ? `\n${memCtx.transparencyNote}` : null,
            memCtx.relevant[0] ? `Memory: ${memCtx.relevant[0].content}` : null,
          ].filter(Boolean).join("\n"),
          language: lang,
          intent: "SUGGEST",
          createdAt: new Date().toISOString(),
          suggestionCards: top.map((r) => ({
            id: r.recommendationId,
            title: `${r.severity} — ${r.what}`,
            reason: r.why,
            affectedArea: r.where,
            expectedBenefit: r.expectedResult,
            preparePayload: {
              category: r.feedbackCategory,
              sceneId: r.sceneId,
              comment: r.what,
            },
          })),
          actions: [
            { id: "prep-all", label: "PREPARE CHANGES", kind: "prepare", payload: { decisionPrepare: true } },
            { id: "nav-review", label: "VIEW IN REVIEW", kind: "navigate", payload: { workspace: "creative-review" } },
          ],
        });
        return;
      }

      if (detected.intent === "PREPARE_CHANGE" && /prepare changes|prepare a fix|tegur/i.test(text)) {
        creativeDecisionEngine.hydrate();
        if (!creativeDecisionEngine.snapshot().recommendations.length) {
          await creativeDecisionEngine.runAnalysis(false);
        }
        const plan = creativeDecisionEngine.preparePlan();
        if (plan) {
          this.streamAssistant({
            id: uid("msg"),
            role: "assistant",
            title: "Correction Plan",
            body: [
              "CREATIVE CORRECTION PLAN",
              `Source: ${plan.sourceVersion}`,
              `Target: ${plan.targetVersion}`,
              `Risk: ${plan.risk}`,
              "",
              ...plan.changes.map((c) => c.change),
              "",
              plan.dependencies.length ? `Dependencies: ${plan.dependencies.join(", ")}` : null,
              "",
              "IMPACT",
              `Affected: ${plan.impact.affected.join(", ")}`,
              `Not affected: ${plan.impact.notAffected.join(", ")}`,
              plan.impact.expectedProcessing,
              "",
              "APPLY THIS CORRECTION?",
            ].filter(Boolean).join("\n"),
            language: lang,
            intent: "PREPARE_CHANGE",
            createdAt: new Date().toISOString(),
            actions: [
              { id: "apply-plan", label: "APPLY", kind: "proceed", payload: { decisionPlanId: plan.planId } },
              { id: "cancel-plan", label: "CANCEL", kind: "cancel", payload: { decisionPlanId: plan.planId } },
            ],
          });
          return;
        }
      }

      const result = respondToIntent({ intent: detected.intent, text, lang, ctx });
      if (result.proposal) {
        this.pendingProposal = result.proposal;
        this.proposals = [...this.proposals.filter((p) => p.changeId !== result.proposal!.changeId), result.proposal];
        this.persistProposals();
        this.auditPush("CHANGE_PROPOSAL_CREATED", result.proposal.changeId, ctx.productionId, ctx.versionLabel, "pending");
        this.notify?.("info", "Change proposal ready", `Proposed ${result.proposal.requestedVersion}`, "ai-suggestions");
      }
      if (result.navigateTo) {
        this.navigate?.(result.navigateTo as WorkspaceId);
        this.auditPush("NAVIGATION", result.navigateTo, ctx.productionId, ctx.versionLabel, "ok");
      }
      if (detected.intent === "REVIEW" || detected.intent === "SUGGEST") {
        this.applyAiReviewPanel(ctx);
      }
      this.streamAssistant(result.message);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error";
      this.lastError = reason;
      this.auditPush("ERROR", reason, ctx.productionId, ctx.versionLabel, "error");
      this.streamAssistant({
        id: uid("msg"),
        role: "assistant",
        title: "AI ME",
        body: "I couldn't analyze this right now because the AI service is unavailable.",
        language: lang,
        intent: "HELP",
        createdAt: new Date().toISOString(),
        actions: [{ id: "retry", label: "RETRY", kind: "retry" }],
      });
      this.notify?.("error", "AI Me error", reason, "errors");
    } finally {
      this.thinking = false;
      this.streamingText = null;
      this.emit();
    }
  }

  async handleAction(action: AssistantAction): Promise<void> {
    const ctx = this.refreshContext(true);
    if (action.kind === "retry") {
      const lastUser = [...(this.conversation?.messages ?? [])].reverse().find((m) => m.role === "user");
      if (lastUser) await this.sendMessage(lastUser.body);
      return;
    }
    if (action.kind === "navigate") {
      const workspace = String(action.payload?.workspace ?? "creative-review") as WorkspaceId;
      const sceneId = action.payload?.sceneId;
      if (typeof sceneId === "string" && sceneId) creativeReviewEngine.selectScene(sceneId);
      this.navigate?.(workspace);
      this.auditPush("NAVIGATION", workspace, ctx.productionId, ctx.versionLabel, "ok");
      this.pushMessage({
        id: uid("msg"),
        role: "assistant",
        body: `Opened ${workspace}.`,
        language: "en",
        createdAt: new Date().toISOString(),
      });
      this.emit();
      return;
    }
    if (action.kind === "cancel") {
      if (action.payload?.decisionPlanId) {
        creativeDecisionEngine.cancelPlan();
        this.pushMessage({
          id: uid("msg"),
          role: "assistant",
          title: "Cancelled",
          body: "Correction plan cancelled. No production command was executed.",
          language: "en",
          createdAt: new Date().toISOString(),
        });
        this.emit();
        return;
      }
      const changeId = String(action.payload?.changeId ?? this.pendingProposal?.changeId ?? "");
      this.updateProposal(changeId, "CANCELLED");
      this.pendingProposal = null;
      this.auditPush("USER_CANCELLED", changeId || "proposal", ctx.productionId, ctx.versionLabel, "ok");
      this.pushMessage({
        id: uid("msg"),
        role: "assistant",
        title: "Cancelled",
        body: "Change request cancelled. No production command was executed.",
        language: "en",
        createdAt: new Date().toISOString(),
      });
      this.emit();
      return;
    }
    if (action.kind === "edit") {
      this.pushMessage({
        id: uid("msg"),
        role: "assistant",
        title: "Edit request",
        body: "Describe the revised change. I will replace the pending proposal.",
        language: "en",
        createdAt: new Date().toISOString(),
      });
      this.emit();
      return;
    }
    if (action.kind === "prepare") {
      if (action.payload?.decisionPrepare) {
        creativeDecisionEngine.hydrate();
        if (!creativeDecisionEngine.snapshot().recommendations.length) {
          await creativeDecisionEngine.runAnalysis(false);
        }
        creativeDecisionEngine.selectAll("MUST_FIX");
        const plan = creativeDecisionEngine.preparePlan();
        if (plan) {
          this.pushMessage({
            id: uid("msg"),
            role: "assistant",
            title: "Correction Plan",
            body: [
              "CREATIVE CORRECTION PLAN",
              `${plan.sourceVersion} → ${plan.targetVersion}`,
              ...plan.changes.map((c) => c.change),
              "",
              "APPLY THIS CORRECTION?",
            ].join("\n"),
            language: "en",
            createdAt: new Date().toISOString(),
            actions: [
              { id: "apply-plan", label: "APPLY", kind: "proceed", payload: { decisionPlanId: plan.planId } },
              { id: "cancel-plan", label: "CANCEL", kind: "cancel", payload: { decisionPlanId: plan.planId } },
            ],
          });
          this.emit();
        }
        return;
      }
      const topic = action.payload?.topic;
      const comment = typeof topic === "string"
        ? `Improve ${topic.replace(/_/g, " ").toLowerCase()}.`
        : (action.payload?.comment as string) || "Prepare a creative fix for the main issue.";
      const category = (action.payload?.category as ReturnType<typeof inferFeedbackCategory> | undefined)
        || (typeof topic === "string" ? inferFeedbackCategory(topic) : undefined);
      const sceneId = (action.payload?.sceneId as string | null | undefined) ?? ctx.selectedSceneId;
      const proposal = createChangeProposal(ctx, comment, { category, sceneId: sceneId ?? null });
      this.pendingProposal = proposal;
      this.proposals = [...this.proposals, proposal];
      this.persistProposals();
      const result = respondToIntent({ intent: "PREPARE_CHANGE", text: comment, lang: "en", ctx });
      if (result.proposal) {
        this.pendingProposal = result.proposal;
        this.proposals = [...this.proposals.filter((p) => p.changeId !== result.proposal!.changeId), result.proposal];
        this.persistProposals();
      }
      this.streamAssistant(result.message);
      return;
    }
    if (action.kind === "proceed") {
      if (action.payload?.decisionPlanId) {
        this.thinking = true;
        this.streamingText = "Applying correction plan via existing production systems...";
        this.emit();
        const applied = await creativeDecisionEngine.applyPlan(String(action.payload.decisionPlanId));
        this.thinking = false;
        this.streamingText = null;
        this.pushMessage({
          id: uid("msg"),
          role: "assistant",
          title: applied?.status === "APPLIED" ? "Correction applied" : "COMMAND FAILED",
          body: applied?.verification?.message
            || applied?.resultNote
            || "Correction plan execution finished.",
          language: "en",
          createdAt: new Date().toISOString(),
          actions: [
            { id: "out", label: "Open Outputs", kind: "navigate", payload: { workspace: "output" } },
            { id: "rev", label: "Open Review", kind: "navigate", payload: { workspace: "creative-review" } },
          ],
        });
        this.emit();
        return;
      }
      if (action.payload?.approve) {
        creativeReviewEngine.hydrate();
        creativeReviewEngine.approve();
        this.auditPush("COMMAND_EXECUTED", "approve", ctx.productionId, ctx.versionLabel, "ok");
        this.pushMessage({
          id: uid("msg"),
          role: "assistant",
          title: "Approved",
          body: `${ctx.versionLabel} marked APPROVED in Review Center. Files were not overwritten.`,
          language: "en",
          createdAt: new Date().toISOString(),
        });
        this.emit();
        return;
      }
      await this.applyPendingProposal(String(action.payload?.changeId ?? this.pendingProposal?.changeId ?? ""));
    }
  }

  private async applyPendingProposal(changeId: string): Promise<void> {
    const ctx = this.refreshContext(true);
    const proposal = this.proposals.find((p) => p.changeId === changeId) ?? this.pendingProposal;
    if (!proposal) {
      this.pushMessage({
        id: uid("msg"),
        role: "assistant",
        title: "COMMAND FAILED",
        body: "Command: APPLY\nReason: No pending change request.",
        language: "en",
        createdAt: new Date().toISOString(),
      });
      this.emit();
      return;
    }

    this.thinking = true;
    this.streamingText = "Applying through existing production systems...";
    this.emit();
    this.auditPush("USER_CONFIRMED", proposal.changeId, proposal.productionId, proposal.sourceVersionId, "ok");

    try {
      creativeReviewEngine.hydrate();
      creativeReviewEngine.addFeedback({
        sceneId: proposal.sceneId,
        category: proposal.category,
        comment: `[AI Me change] ${proposal.requestedChange} — ${proposal.aiInterpretation}`,
        timestampSec: proposal.timestampSec,
      });
      if (proposal.timestampSec != null) {
        creativeReviewEngine.addTimestampComment(
          proposal.timestampSec,
          proposal.requestedChange,
          proposal.sceneId,
        );
      }
      creativeReviewEngine.requestChanges();
      this.notify?.("success", "Feedback saved", "Structured feedback stored in Review Center", "ai-suggestions");

      // Hand off to existing finalization / version system — never overwrite source version files.
      productionFinalEngine.hydrate();
      const started = await productionFinalEngine.createNewVersion();
      const newLabel = started.package?.versionLabel
        || proposal.requestedVersion;

      this.updateProposal(proposal.changeId, "APPLIED", `Version production started → ${newLabel}`);
      this.pendingProposal = null;
      this.auditPush(
        "COMMAND_EXECUTED",
        `createNewVersion → ${newLabel}`,
        proposal.productionId,
        proposal.sourceVersionId,
        "ok",
      );
      this.notify?.("success", "New version started", `${proposal.sourceVersionId} intact · producing ${newLabel}`, "production-complete");
      this.emitEvents?.("state.shared", {
        action: "AiMeChangeApplied",
        module: "creative-assistant",
        sourceVersion: proposal.sourceVersionId,
        requestedVersion: newLabel,
        changeId: proposal.changeId,
      });

      this.pushMessage({
        id: uid("msg"),
        role: "assistant",
        title: "Change applied via production system",
        body: [
          "COMMAND EXECUTED",
          `Command: createNewVersion (existing Final Assembly engine)`,
          `Source version preserved: ${proposal.sourceVersionId}`,
          `New version: ${newLabel}`,
          `Status: ${started.status}`,
          `Progress: ${started.progress}%`,
          "",
          "AI Me did not manipulate low-level render workers directly.",
        ].join("\n"),
        language: "en",
        createdAt: new Date().toISOString(),
        actions: [
          { id: "out", label: "Open Outputs", kind: "navigate", payload: { workspace: "output" } },
          { id: "rev", label: "Open Review", kind: "navigate", payload: { workspace: "creative-review" } },
        ],
      });
      creativeReviewEngine.hydrate(proposal.sourceVersionId);
      this.applyAiReviewPanel(this.refreshContext(true));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Command failed";
      this.updateProposal(proposal.changeId, "FAILED", reason);
      this.auditPush("ERROR", reason, proposal.productionId, proposal.sourceVersionId, "error");
      this.lastError = reason;
      this.notify?.("error", "COMMAND FAILED", reason, "errors");
      this.pushMessage({
        id: uid("msg"),
        role: "assistant",
        title: "COMMAND FAILED",
        body: `Command: createNewVersion\nReason: ${reason}\n\nThe change was not completed.`,
        language: "en",
        createdAt: new Date().toISOString(),
        actions: [{ id: "retry", label: "RETRY", kind: "retry" }],
      });
    } finally {
      this.thinking = false;
      this.streamingText = null;
      this.emit();
    }
  }

  private applyAiReviewPanel(ctx: ReturnType<typeof refreshAssistantContext>): void {
    const suggestions = buildSuggestions(ctx);
    creativeReviewEngine.applyAssistantReview({
      looksGood: ctx.qcOverall === "PASS" ? ["QC overall PASS"] : [],
      issues: ctx.qcFailures,
      suggestions: suggestions.map((s) => s.title),
      warnings: ctx.qcWarnings,
      attention: ctx.scenes.filter((s) => !s.hasVisual).map((s) => `Scene ${s.number} needs visual attention`),
    });
  }

  private updateProposal(changeId: string, status: ChangeRequestObject["status"], resultNote?: string): void {
    this.proposals = this.proposals.map((p) => (
      p.changeId === changeId
        ? { ...p, status, updatedAt: new Date().toISOString(), resultNote: resultNote ?? p.resultNote }
        : p
    ));
    this.persistProposals();
  }

  private persistProposals(): void {
    saveJson(ASSISTANT_STORE_KEY, this.proposals);
  }

  private persistChat(): void {
    if (!this.conversation) return;
    const chats = loadJson<Record<string, ConversationRecord>>(ASSISTANT_CHAT_KEY, {});
    const key = this.conversationKey(
      this.conversation.projectId,
      this.conversation.productionId,
      this.conversation.versionLabel,
    );
    chats[key] = this.conversation;
    saveJson(ASSISTANT_CHAT_KEY, chats);
  }

  private auditPush(
    action: AuditLogEntry["action"],
    detail: string,
    productionId: string | null,
    versionLabel: string | null,
    result: AuditLogEntry["result"],
  ): void {
    this.audit = [
      ...this.audit,
      {
        id: uid("aud"),
        at: new Date().toISOString(),
        action,
        detail,
        productionId,
        versionLabel,
        result,
      },
    ].slice(-200);
    saveJson(ASSISTANT_AUDIT_KEY, this.audit);
  }

  private ensureConversation(projectId: string, productionId: string, versionLabel: string): void {
    const key = this.conversationKey(projectId, productionId, versionLabel);
    const currentKey = this.conversation
      ? this.conversationKey(this.conversation.projectId, this.conversation.productionId, this.conversation.versionLabel)
      : null;
    if (!this.conversation || currentKey !== key) {
      const chats = loadJson<Record<string, ConversationRecord>>(ASSISTANT_CHAT_KEY, {});
      this.conversation = chats[key] ?? this.createConversation(projectId, productionId, versionLabel);
    }
  }

  private createConversation(projectId: string, productionId: string, versionLabel: string): ConversationRecord {
    const now = new Date().toISOString();
    return {
      conversationId: uid("conv"),
      projectId,
      productionId,
      versionLabel,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  private conversationKey(projectId: string, productionId: string, versionLabel: string): string {
    return `${projectId || "none"}::${productionId || "none"}::${versionLabel || "none"}`;
  }

  private pushMessage(message: AssistantMessage): void {
    if (!this.conversation) return;
    this.conversation = {
      ...this.conversation,
      messages: [...this.conversation.messages, message],
      updatedAt: new Date().toISOString(),
    };
    this.persistChat();
  }

  private streamAssistant(message: AssistantMessage): void {
    // Progressive display simulation when no remote streaming provider is wired.
    this.streamingText = "";
    const chunks = chunkText(message.body, 48);
    let acc = "";
    for (const part of chunks) {
      acc += part;
      this.streamingText = acc;
      this.emit();
    }
    this.streamingText = null;
    this.pushMessage(message);
    this.notify?.("info", "AI analysis complete", message.title || "AI Me responded", "ai-suggestions");
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const l of this.listeners) l(snap);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function chunkText(text: string, size: number): string[] {
  if (!text) return [""];
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export const creativeAssistantEngine = new CreativeAssistantEngine();
export { QUICK_COMMANDS };
