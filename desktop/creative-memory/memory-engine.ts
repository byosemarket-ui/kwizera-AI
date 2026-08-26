/**
 * Phase 6 Step 4 — Creative Memory & Final Integration Engine.
 * Composes Steps 1–3 + existing project memory / preferences. No duplicate engines.
 */

import { refreshAssistantContext } from "../creative-assistant/context";
import { creativeReviewEngine } from "../creative-review/review-engine";
import { creativeDecisionEngine } from "../creative-decision/decision-engine";
import { DECISION_PREFS_KEY, emptyPreferences, type ProjectPreferenceMemory } from "../creative-decision/types";
import { productionFinalEngine, listProductionHistory } from "../production-final/final-engine";
import { projectMemoryStore } from "../shell/workspace-state/project-memory";
import {
  buildCreativeProfile,
  buildStartupSummary,
  detectWorkflowPhase,
  formatCreativeProfile,
  resolveMemoryConflicts,
  resolveNextAction,
  retrieveRelevantMemory,
} from "./profile";
import type {
  AutomationRuleResult,
  CreativeIntelligenceSnapshot,
  CreativeMemoryEntry,
  IntegrationAuditEntry,
  MemoryCategory,
  MemoryConfidence,
  MemoryImportance,
  MemorySource,
  MemoryContextPacket,
  StartupSummary,
} from "./types";
import {
  CREATIVE_MEMORY_AUDIT_KEY,
  CREATIVE_MEMORY_KEY,
  PHASE6_COMPLETE_KEY,
} from "./types";

type NotifyFn = (
  tone: "success" | "warning" | "error" | "info",
  title: string,
  detail: string,
  category?: "information" | "warnings" | "errors" | "production-complete" | "updates" | "ai-suggestions",
) => void;

type Listener = (snap: CreativeIntelligenceSnapshot) => void;

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

type MemoryBlob = {
  byProject: Record<string, CreativeMemoryEntry[]>;
};

export class CreativeMemoryEngine {
  private listeners = new Set<Listener>();
  private notify: NotifyFn | null = null;
  private emitEvents: ((type: string, payload: Record<string, unknown>) => void) | null = null;
  private blob: MemoryBlob = { byProject: {} };
  private audit: IntegrationAuditEntry[] = [];
  private lastAutomation: AutomationRuleResult | null = null;
  private recommendation = "Phase 6 Step 4 — memory & integration layer.";
  private followUpTimer: ReturnType<typeof setTimeout> | null = null;

  setNotify(fn: NotifyFn | null): void { this.notify = fn; }
  setEventEmitter(fn: ((type: string, payload: Record<string, unknown>) => void) | null): void {
    this.emitEvents = fn;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  hydrate(): boolean {
    this.blob = loadJson<MemoryBlob>(CREATIVE_MEMORY_KEY, { byProject: {} });
    this.audit = loadJson(CREATIVE_MEMORY_AUDIT_KEY, [] as IntegrationAuditEntry[]);
    creativeDecisionEngine.hydrate();
    creativeReviewEngine.hydrate();
    const ctx = refreshAssistantContext();
    this.recommendation = ctx.available
      ? `Integrated intelligence ready — ${ctx.projectName} ${ctx.versionLabel}`
      : ctx.unavailableReason || "Context unavailable";
    this.emit();
    // Phase 7 Step 2 — restore empty project slots from durable disk after restart
    void this.hydrateFromDisk();
    return ctx.available;
  }

  private async hydrateFromDisk(): Promise<void> {
    try {
      const { hydrateCreativeMemoryFromDisk } = await import("../persistent-memory/sync-bridge");
      const before = Object.keys(this.blob.byProject).length;
      const result = await hydrateCreativeMemoryFromDisk(this.blob as {
        byProject: Record<string, Array<Record<string, unknown>>>;
      });
      if (result.restoredEntries > 0 || Object.keys(this.blob.byProject).length > before) {
        saveJson(CREATIVE_MEMORY_KEY, this.blob);
        this.emit();
      }
    } catch {
      /* offline / center not ready */
    }
  }

  snapshot(): CreativeIntelligenceSnapshot {
    const ctx = refreshAssistantContext();
    const decision = creativeDecisionEngine.snapshot();
    const review = creativeReviewEngine.snapshot().state;
    const prefs = this.loadPrefs();
    const memories = ctx.projectId ? (this.blob.byProject[ctx.projectId] ?? []) : [];
    const profile = buildCreativeProfile({ ctx, prefs, memories });
    const recs = decision.recommendations.filter((r) => r.status !== "IGNORED");
    const high = recs.filter((r) => r.severity === "CRITICAL" || r.severity === "HIGH").length;
    const phase = detectWorkflowPhase({
      ctx,
      review,
      finalStatus: productionFinalEngine.snapshot().state?.status ?? null,
      hasRecommendations: recs.length > 0,
      pendingPlan: decision.activePlan?.status === "PENDING_APPROVAL",
    });
    const next = resolveNextAction({
      phase,
      highPriority: high,
      recommendationCount: recs.length,
      reviewStatus: ctx.reviewStatus,
      qcOverall: ctx.qcOverall,
    });
    const relevant = retrieveRelevantMemory(memories, ctx.projectId, null);
    const summary = ctx.available
      ? buildStartupSummary({
        ctx,
        phase,
        recommendationCount: recs.length,
        highPriorityCount: high,
        next,
        memoriesUsed: relevant.length,
      })
      : null;

    return {
      version: 1,
      available: ctx.available,
      unavailableReason: ctx.available ? null : ctx.unavailableReason,
      memories: memories.filter((m) => m.lifecycle !== "ARCHIVED"),
      profile,
      summary,
      nextAction: ctx.available ? next : null,
      workflowPhase: phase,
      lastAutomation: this.lastAutomation,
      audit: this.audit.slice(-40),
      recommendation: this.recommendation,
      phase6Complete: Boolean(loadJson(PHASE6_COMPLETE_KEY, null)),
      updatedAt: new Date().toISOString(),
    };
  }

  buildAiMeContext() {
    const snap = this.snapshot();
    return {
      available: snap.available,
      workflowPhase: snap.workflowPhase,
      memoryCount: snap.memories.length,
      nextAction: snap.nextAction?.label ?? null,
      phase6Complete: snap.phase6Complete,
      recommendation: this.recommendation,
      explanation: snap.summary
        ? `Phase 6 integration: ${snap.summary.lines.join(" ")}`
        : snap.unavailableReason || "Creative memory unavailable.",
    };
  }

  /** Focused context for AI Me — never dumps entire memory DB. */
  buildMemoryContext(userRequest: string | null, topicHint: string | null): MemoryContextPacket {
    const ctx = refreshAssistantContext();
    const prefs = this.loadPrefs();
    const memories = this.blob.byProject[ctx.projectId] ?? [];
    let relevant = retrieveRelevantMemory(memories, ctx.projectId, topicHint || userRequest);
    relevant = resolveMemoryConflicts(relevant);
    const profile = buildCreativeProfile({ ctx, prefs, memories });
    return {
      projectId: ctx.projectId,
      productionId: ctx.productionId,
      versionLabel: ctx.versionLabel,
      reviewStatus: ctx.reviewStatus,
      relevant,
      profile,
      transparencyNote: relevant.length
        ? "Based on this project's previous decisions..."
        : null,
      userRequest,
    };
  }

  getStartupSummary(): StartupSummary | null {
    return this.snapshot().summary;
  }

  getCreativeProfileText(lang: "en" | "rw" = "en"): string {
    return formatCreativeProfile(this.snapshot().profile, lang);
  }

  getSmartSummary(lang: "en" | "rw" = "en"): string {
    const s = this.snapshot().summary;
    if (!s) {
      return lang === "rw"
        ? "Project context ntiboneka."
        : "Project context unavailable.";
    }
    return s.lines.join("\n");
  }

  explainRecommendation(recommendationId: string): string {
    const rec = creativeDecisionEngine.snapshot().recommendations.find((r) => r.recommendationId === recommendationId);
    if (!rec) return "Recommendation not found in the current decision snapshot.";
    const mem = this.buildMemoryContext(null, rec.category.toLowerCase());
    const memNote = mem.relevant[0]
      ? ` Based on prior ${mem.relevant[0].source.toLowerCase()} memory: “${mem.relevant[0].content}”.`
      : "";
    return `I recommend ${rec.what} because ${rec.why} (observation: ${rec.observation}).${memNote}`;
  }

  remember(input: {
    projectId: string;
    category: MemoryCategory;
    content: string;
    importance: MemoryImportance;
    source: MemorySource;
    confidence: MemoryConfidence;
    topic: string;
    versionLabel?: string | null;
    relatedRecommendationId?: string | null;
    decision?: CreativeMemoryEntry["decision"];
  }): CreativeMemoryEntry {
    const now = new Date().toISOString();
    const list = this.blob.byProject[input.projectId] ?? [];

    // Duplicate detection — update existing active memory with same topic+content stem
    const stem = input.content.slice(0, 64).toLowerCase();
    const existing = list.find(
      (m) => m.lifecycle === "ACTIVE" && !m.disabled && m.topic === input.topic && m.content.slice(0, 64).toLowerCase() === stem,
    );
    if (existing) {
      const updated: CreativeMemoryEntry = {
        ...existing,
        content: input.content,
        importance: input.importance,
        confidence: input.confidence,
        decision: input.decision ?? existing.decision,
        versionLabel: input.versionLabel ?? existing.versionLabel,
        relatedRecommendationId: input.relatedRecommendationId ?? existing.relatedRecommendationId,
        updatedAt: now,
      };
      this.blob.byProject[input.projectId] = list.map((m) => (m.memoryId === existing.memoryId ? updated : m));
      this.persist();
      this.auditPush("MEMORY_UPDATED", updated.memoryId, input.projectId, "ok");
      this.emitEvents?.("state.shared", { action: "MemoryUpdated", module: "creative-memory", memoryId: updated.memoryId });
      this.emit();
      return updated;
    }

    const entry: CreativeMemoryEntry = {
      memoryId: uid("mem"),
      projectId: input.projectId,
      category: input.category,
      content: input.content,
      importance: input.importance,
      source: input.source,
      confidence: input.confidence,
      lifecycle: "ACTIVE",
      topic: input.topic,
      versionLabel: input.versionLabel ?? null,
      relatedRecommendationId: input.relatedRecommendationId ?? null,
      decision: input.decision ?? null,
      createdAt: now,
      updatedAt: now,
      disabled: false,
    };
    this.blob.byProject[input.projectId] = [entry, ...list].slice(0, 200);
    this.persist();
    this.auditPush("MEMORY_CREATED", entry.memoryId, input.projectId, "ok");
    this.emitEvents?.("state.shared", { action: "MemoryCreated", module: "creative-memory", memoryId: entry.memoryId });
    try {
      projectMemoryStore.recordAiDecision(`[${entry.category}] ${entry.content}`);
    } catch {
      // continue without blocking if project memory write fails
    }
    this.emit();
    return entry;
  }

  disableMemory(memoryId: string, projectId: string): void {
    const list = this.blob.byProject[projectId] ?? [];
    this.blob.byProject[projectId] = list.map((m) =>
      m.memoryId === memoryId ? { ...m, disabled: true, updatedAt: new Date().toISOString() } : m,
    );
    this.persist();
    this.auditPush("MEMORY_DISABLED", memoryId, projectId, "ok");
    this.emit();
  }

  archiveMemory(memoryId: string, projectId: string): void {
    const list = this.blob.byProject[projectId] ?? [];
    this.blob.byProject[projectId] = list.map((m) =>
      m.memoryId === memoryId
        ? { ...m, lifecycle: "ARCHIVED", updatedAt: new Date().toISOString() }
        : m,
    );
    this.persist();
    this.auditPush("MEMORY_ARCHIVED", memoryId, projectId, "ok");
    this.emit();
  }

  correctMemory(memoryId: string, projectId: string, content: string): void {
    const list = this.blob.byProject[projectId] ?? [];
    this.blob.byProject[projectId] = list.map((m) =>
      m.memoryId === memoryId
        ? {
          ...m,
          content,
          source: "USER",
          confidence: "CONFIRMED",
          lifecycle: "ACTIVE",
          disabled: false,
          updatedAt: new Date().toISOString(),
        }
        : m,
    );
    this.persist();
    this.auditPush("PREFERENCE_UPDATED", memoryId, projectId, "ok");
    this.emitEvents?.("state.shared", { action: "PreferenceUpdated", module: "creative-memory", memoryId });
    this.emit();
  }

  /** Learn from decision engine outcomes (approved / rejected / applied / failed). */
  learnFromDecisionSnapshot(): void {
    const ctx = refreshAssistantContext();
    if (!ctx.available || !ctx.projectId) return;
    const decision = creativeDecisionEngine.snapshot();
    const prefs = this.loadPrefs();

    for (const rec of decision.recommendations) {
      if (rec.status === "IGNORED" || rec.status === "REJECTED") {
        this.remember({
          projectId: ctx.projectId,
          category: "DECISION_MEMORY",
          content: `Rejected/ignored: ${rec.what}`,
          importance: "MEDIUM",
          source: "USER",
          confidence: "CONFIRMED",
          topic: `reject:${rec.category}`,
          versionLabel: ctx.versionLabel,
          relatedRecommendationId: rec.recommendationId,
          decision: rec.status === "IGNORED" ? "IGNORED" : "REJECTED",
        });
      }
      if (rec.status === "APPLIED" || rec.status === "VERIFIED") {
        this.remember({
          projectId: ctx.projectId,
          category: "DECISION_MEMORY",
          content: `Approved correction: ${rec.what}`,
          importance: "HIGH",
          source: "USER",
          confidence: "CONFIRMED",
          topic: `approve:${rec.category}`,
          versionLabel: rec.appliedVersion || ctx.versionLabel,
          relatedRecommendationId: rec.recommendationId,
          decision: "APPLIED",
        });
        if (rec.category === "CTA_VISIBILITY" || prefs.preferStrongerCta) {
          this.remember({
            projectId: ctx.projectId,
            category: "PREFERENCE_MEMORY",
            content: "User prefers stronger CTA visibility.",
            importance: "MEDIUM",
            source: "AI",
            confidence: "INFERRED",
            topic: "cta-style",
            versionLabel: ctx.versionLabel,
            decision: "APPROVED",
          });
        }
        if (rec.category === "PRODUCT_VISIBILITY") {
          this.remember({
            projectId: ctx.projectId,
            category: "PREFERENCE_MEMORY",
            content: "User requires product to remain clearly visible.",
            importance: "HIGH",
            source: "USER",
            confidence: "CONFIRMED",
            topic: "product-presentation",
            versionLabel: ctx.versionLabel,
            decision: "APPROVED",
          });
        }
      }
      if (rec.status === "FAILED") {
        this.remember({
          projectId: ctx.projectId,
          category: "PRODUCTION_MEMORY",
          content: `Correction failed: ${rec.what}`,
          importance: "HIGH",
          source: "SYSTEM",
          confidence: "CONFIRMED",
          topic: `fail:${rec.category}`,
          versionLabel: ctx.versionLabel,
          relatedRecommendationId: rec.recommendationId,
          decision: "FAILED",
        });
      }
    }

    const plan = decision.activePlan;
    if (plan?.status === "APPLIED" && plan.verification) {
      this.remember({
        projectId: ctx.projectId,
        category: "VERSION_MEMORY",
        content: `Correction ${plan.sourceVersion}→${plan.targetVersion}: ${plan.verification.message}`,
        importance: "HIGH",
        source: "VERSION",
        confidence: "CONFIRMED",
        topic: "correction-result",
        versionLabel: plan.targetVersion,
        decision: "APPLIED",
      });
    }

    this.recommendation = "Learning loop updated from decision outcomes.";
    this.emit();
  }

  /** Safe automation: analyze / notify / prepare — never auto-create versions. */
  runSafeAutomation(trigger: "production_complete" | "qc_complete" | "correction_complete" | "open_project"): AutomationRuleResult {
    const ctx = refreshAssistantContext();
    this.auditPush("AUTOMATION_TRIGGERED", trigger, ctx.projectId || null, "pending");
    this.emitEvents?.("state.shared", { action: "AutomationTriggered", module: "creative-memory", trigger });

    try {
      if (!ctx.available && trigger !== "open_project") {
        const fail: AutomationRuleResult = {
          ruleId: uid("auto"),
          triggered: true,
          action: trigger,
          requiresApproval: false,
          executed: false,
          detail: "Context unavailable — automation skipped.",
        };
        this.lastAutomation = fail;
        this.auditPush("AUTOMATION_FAILED", fail.detail, null, "error");
        return fail;
      }

      if (trigger === "open_project" || trigger === "production_complete" || trigger === "qc_complete") {
        void creativeDecisionEngine.runAnalysis(false).then(() => {
          const n = creativeDecisionEngine.snapshot().recommendations.filter((r) => r.status !== "IGNORED").length;
          if (n > 0) {
            this.notify?.("info", "AI recommendations ready", `${n} recommendation(s) available`, "ai-suggestions");
          }
        });
        const result: AutomationRuleResult = {
          ruleId: uid("auto"),
          triggered: true,
          action: "analyze_and_notify",
          requiresApproval: false,
          executed: true,
          detail: "Safe analysis scheduled; version creation still requires approval.",
        };
        this.lastAutomation = result;
        this.auditPush("AUTOMATION_COMPLETED", result.detail, ctx.projectId || null, "ok");
        this.emitEvents?.("state.shared", { action: "AutomationCompleted", module: "creative-memory", trigger });
        this.emit();
        return result;
      }

      if (trigger === "correction_complete") {
        this.learnFromDecisionSnapshot();
        this.scheduleFollowUp();
        const result: AutomationRuleResult = {
          ruleId: uid("auto"),
          triggered: true,
          action: "verify_and_learn",
          requiresApproval: false,
          executed: true,
          detail: "Follow-up verification + memory learning scheduled.",
        };
        this.lastAutomation = result;
        this.auditPush("AUTOMATION_COMPLETED", result.detail, ctx.projectId || null, "ok");
        this.notify?.("success", "Correction follow-up", result.detail, "updates");
        this.emit();
        return result;
      }

      return {
        ruleId: uid("auto"),
        triggered: false,
        action: trigger,
        requiresApproval: true,
        executed: false,
        detail: "No matching safe automation rule.",
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Automation failed";
      this.auditPush("AUTOMATION_FAILED", msg, ctx.projectId || null, "error");
      this.emitEvents?.("state.shared", { action: "AutomationFailed", module: "creative-memory", error: msg });
      this.notify?.("error", "Automation failed", msg, "errors");
      const fail: AutomationRuleResult = {
        ruleId: uid("auto"),
        triggered: true,
        action: trigger,
        requiresApproval: false,
        executed: false,
        detail: msg,
      };
      this.lastAutomation = fail;
      this.emit();
      return fail;
    }
  }

  scheduleFollowUp(): void {
    if (this.followUpTimer) clearTimeout(this.followUpTimer);
    this.followUpTimer = setTimeout(() => {
      void this.runFollowUp();
    }, 50);
  }

  async runFollowUp(): Promise<void> {
    const ctx = refreshAssistantContext();
    const decision = creativeDecisionEngine.snapshot();
    const plan = decision.activePlan;
    const history = listProductionHistory();
    const lines = [
      `Correction complete? ${plan?.status === "APPLIED" ? "yes" : plan?.status ?? "n/a"}`,
      `QC complete? ${ctx.qcOverall ?? "NOT AVAILABLE"}`,
      `Verification? ${plan?.verification?.message ?? "Verification not available."}`,
      `History versions: ${history.map((h) => h.versionLabel).join(", ") || "none"}`,
    ];
    this.auditPush("FOLLOW_UP", lines.join(" · "), ctx.projectId || null, "ok");
    this.learnFromDecisionSnapshot();
    this.notify?.("info", "Verification follow-up", lines[2], "ai-suggestions");
    this.markPhase6Complete(ctx.projectId, ctx.productionId);
    this.emit();
  }

  markPhase6Complete(projectId: string, productionId: string): void {
    saveJson(PHASE6_COMPLETE_KEY, {
      version: 1,
      phase: 6,
      status: "COMPLETE",
      projectId,
      productionId,
      completedAt: new Date().toISOString(),
      note: "Phase 6 complete. Phase 7 is not started.",
      steps: {
        step1: "creative-review",
        step2: "creative-assistant",
        step3: "creative-decision",
        step4: "creative-memory",
      },
    });
    this.emit();
  }

  /** Sync preference flags into memory entries (project-scoped). */
  syncPreferencesToMemory(): void {
    const ctx = refreshAssistantContext();
    if (!ctx.projectId) return;
    const prefs = this.loadPrefs();
    if (prefs.preferProductCentered) {
      this.remember({
        projectId: ctx.projectId,
        category: "PREFERENCE_MEMORY",
        content: "Prefer product-centered visuals.",
        importance: "HIGH",
        source: "AI",
        confidence: "INFERRED",
        topic: "product-presentation",
        versionLabel: ctx.versionLabel,
      });
    }
    if (prefs.preferStrongerCta) {
      this.remember({
        projectId: ctx.projectId,
        category: "PREFERENCE_MEMORY",
        content: "Prefer stronger CTA.",
        importance: "MEDIUM",
        source: "AI",
        confidence: "INFERRED",
        topic: "cta-style",
        versionLabel: ctx.versionLabel,
      });
    }
    if (prefs.preferMinimalMusic) {
      this.remember({
        projectId: ctx.projectId,
        category: "PREFERENCE_MEMORY",
        content: "Prefer minimal music.",
        importance: "MEDIUM",
        source: "AI",
        confidence: "INFERRED",
        topic: "music-style",
        versionLabel: ctx.versionLabel,
      });
    }
    if (prefs.preferShorterVideos) {
      this.remember({
        projectId: ctx.projectId,
        category: "PREFERENCE_MEMORY",
        content: "Prefer shorter videos.",
        importance: "MEDIUM",
        source: "AI",
        confidence: "INFERRED",
        topic: "pacing",
        versionLabel: ctx.versionLabel,
      });
    }
    this.auditPush("PREFERENCE_UPDATED", "synced from decision prefs", ctx.projectId, "ok");
  }

  private loadPrefs(): ProjectPreferenceMemory {
    return loadJson(DECISION_PREFS_KEY, emptyPreferences());
  }

  private persist(): void {
    saveJson(CREATIVE_MEMORY_KEY, this.blob);
    // Phase 7 Step 2 — durable disk sync (non-blocking; localStorage remains fast cache)
    void import("../persistent-memory/sync-bridge")
      .then(({ syncCreativeMemoryBlobToDisk }) => syncCreativeMemoryBlobToDisk(this.blob))
      .catch(() => { /* offline / API not ready — local cache still holds data */ });
  }

  private auditPush(
    action: IntegrationAuditEntry["action"],
    detail: string,
    projectId: string | null,
    result: IntegrationAuditEntry["result"],
  ): void {
    this.audit = [
      ...this.audit,
      {
        id: uid("iaud"),
        at: new Date().toISOString(),
        action,
        detail,
        projectId,
        result,
      },
    ].slice(-200);
    saveJson(CREATIVE_MEMORY_AUDIT_KEY, this.audit);
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const l of this.listeners) l(snap);
  }
}

export const creativeMemoryEngine = new CreativeMemoryEngine();

export function loadPhase6Complete(): {
  version: 1;
  phase: number;
  status: string;
  projectId?: string;
  productionId?: string;
} | null {
  try {
    const raw = loadJson<{ version: 1; phase: number; status: string; projectId?: string; productionId?: string } | null>(
      PHASE6_COMPLETE_KEY,
      null,
    );
    return raw?.version === 1 && raw.status === "COMPLETE" ? raw : null;
  } catch {
    return null;
  }
}
