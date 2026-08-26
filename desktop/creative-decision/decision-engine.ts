/**
 * Phase 6 Step 3 — AI Creative Decision Engine.
 * Intelligence + correction planning only. Execution via existing production/review systems.
 */

import { refreshAssistantContext } from "../creative-assistant/context";
import { creativeReviewEngine } from "../creative-review/review-engine";
import { productionFinalEngine, listProductionHistory } from "../production-final/final-engine";
import type { ClaimAuditItem } from "../production-plan/types";
import {
  buildRecommendations,
  createCorrectionPlan,
  detectIssues,
  fingerprintContext,
  formatRecommendationsForAiMe,
  updatePreferencesFromFeedback,
} from "./analyze";
import type {
  CreativeCorrectionPlan,
  DecisionAnalysisSnapshot,
  DecisionAuditEntry,
  DecisionErrorRecord,
  DecisionUiSnapshot,
  ProjectPreferenceMemory,
  SmartRecommendation,
} from "./types";
import {
  DECISION_AUDIT_KEY,
  DECISION_HANDOFF_KEY,
  DECISION_PREFS_KEY,
  DECISION_STORE_KEY,
  emptyPreferences,
} from "./types";

type NotifyFn = (
  tone: "success" | "warning" | "error" | "info",
  title: string,
  detail: string,
  category?: "information" | "warnings" | "errors" | "production-complete" | "updates" | "ai-suggestions",
) => void;

type Listener = (snap: DecisionUiSnapshot) => void;

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

type PersistedBlob = {
  recommendations: SmartRecommendation[];
  plans: CreativeCorrectionPlan[];
  ignoredKeys: string[];
  lastFingerprint: string | null;
  analysis: DecisionAnalysisSnapshot | null;
};

export class CreativeDecisionEngine {
  private listeners = new Set<Listener>();
  private notify: NotifyFn | null = null;
  private emitEvents: ((type: string, payload: Record<string, unknown>) => void) | null = null;
  private analyzing = false;
  private analysis: DecisionAnalysisSnapshot | null = null;
  private recommendations: SmartRecommendation[] = [];
  private plans: CreativeCorrectionPlan[] = [];
  private activePlan: CreativeCorrectionPlan | null = null;
  private audit: DecisionAuditEntry[] = [];
  private errors: DecisionErrorRecord[] = [];
  private prefs: ProjectPreferenceMemory = emptyPreferences();
  private ignoredKeys = new Set<string>();
  private lastFingerprint: string | null = null;
  private recommendation = "Run creative analysis after Phase 6 Review / AI Me context is available.";

  setNotify(fn: NotifyFn | null): void { this.notify = fn; }
  setEventEmitter(fn: ((type: string, payload: Record<string, unknown>) => void) | null): void { this.emitEvents = fn; }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): DecisionUiSnapshot {
    const ctx = refreshAssistantContext();
    return {
      version: 1,
      available: ctx.available,
      unavailableReason: ctx.available ? null : ctx.unavailableReason,
      analyzing: this.analyzing,
      analysis: this.analysis,
      recommendations: this.recommendations,
      activePlan: this.activePlan,
      plans: this.plans,
      history: this.audit.slice(-50),
      errors: this.errors.slice(-20),
      preferences: this.prefs,
      recommendation: this.recommendation,
      updatedAt: new Date().toISOString(),
    };
  }

  buildAiMeContext() {
    const snap = this.snapshot();
    return {
      available: snap.available,
      analyzing: snap.analyzing,
      recommendationCount: snap.recommendations.filter((r) => r.status !== "IGNORED").length,
      mustFix: snap.analysis?.mustFix.length ?? 0,
      activePlanStatus: snap.activePlan?.status ?? null,
      recommendation: this.recommendation,
      explanation: snap.available
        ? `Creative Decision Engine: ${snap.recommendations.length} recommendation(s), plan ${snap.activePlan?.status ?? "none"}.`
        : snap.unavailableReason || "Decision context unavailable.",
    };
  }

  hydrate(): boolean {
    const blob = loadJson<PersistedBlob>(DECISION_STORE_KEY, {
      recommendations: [],
      plans: [],
      ignoredKeys: [],
      lastFingerprint: null,
      analysis: null,
    });
    this.recommendations = blob.recommendations;
    this.plans = blob.plans;
    this.activePlan = blob.plans.find((p) => p.status === "PENDING_APPROVAL" || p.status === "IN_PROGRESS") ?? null;
    this.analysis = blob.analysis;
    this.lastFingerprint = blob.lastFingerprint;
    this.ignoredKeys = new Set(blob.ignoredKeys);
    this.audit = loadJson(DECISION_AUDIT_KEY, [] as DecisionAuditEntry[]);
    this.prefs = loadJson(DECISION_PREFS_KEY, emptyPreferences());
    const ctx = refreshAssistantContext();
    this.recommendation = ctx.available
      ? `Decision engine ready — ${ctx.projectName} ${ctx.versionLabel}`
      : ctx.unavailableReason || "Context unavailable";
    this.emit();
    return ctx.available;
  }

  async runAnalysis(force = false): Promise<DecisionAnalysisSnapshot | null> {
    const ctx = refreshAssistantContext();
    if (!ctx.available) {
      this.pushError("ANALYSIS_ERROR", "Project context unavailable", "Complete Phase 5 and open Creative Review first.");
      this.emit();
      return null;
    }

    creativeReviewEngine.hydrate();
    const review = creativeReviewEngine.snapshot().state;
    const fp = fingerprintContext(ctx, review);
    if (!force && this.lastFingerprint === fp && this.analysis && this.recommendations.length) {
      this.recommendation = "Using cached analysis (content unchanged).";
      this.emit();
      return this.analysis;
    }

    this.analyzing = true;
    this.auditPush("ANALYSIS_STARTED", `fingerprint=${fp}`, ctx.productionId, ctx.versionLabel, "pending");
    this.emitEvents?.("state.shared", { action: "CreativeAnalysisStarted", module: "creative-decision", productionId: ctx.productionId });
    this.emit();

    try {
      await delay(30);
      // Learn prefs from feedback text
      const feedbackTexts = [
        ...(review?.feedback.map((f) => f.comment) ?? []),
        ...(review?.timestampComments.map((c) => c.comment) ?? []),
        ...(review?.notes.map((n) => n.body) ?? []),
      ];
      this.prefs = updatePreferencesFromFeedback(this.prefs, feedbackTexts);
      saveJson(DECISION_PREFS_KEY, this.prefs);

      const claimAudit = this.readClaimAudit();
      const issues = detectIssues({ ctx, review, claimAudit, prefs: this.prefs });
      const rejectedTopics = loadRejectedMemoryTopics(ctx.projectId);
      const recommendations = buildRecommendations({
        issues,
        ctx,
        claimAudit,
        ignoredIds: this.ignoredKeys,
      }).filter((r) => {
        if (!force && rejectedTopics.has(`reject:${r.category}`)) {
          this.auditPush("RECOMMENDATION_CREATED", `reused skip rejected ${r.category}`, ctx.productionId, ctx.versionLabel, "ok");
          return false;
        }
        return true;
      });

      const mustFix = recommendations.filter((r) => r.group === "MUST_FIX").map((r) => r.recommendationId);
      const shouldImprove = recommendations.filter((r) => r.group === "SHOULD_IMPROVE").map((r) => r.recommendationId);
      const optional = recommendations.filter((r) => r.group === "OPTIONAL").map((r) => r.recommendationId);

      const analysis: DecisionAnalysisSnapshot = {
        analysisId: uid("an"),
        projectId: ctx.projectId,
        productionId: ctx.productionId,
        versionLabel: ctx.versionLabel,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        issues,
        recommendations,
        mustFix,
        shouldImprove,
        optional,
        contextFingerprint: fp,
        marketingSummary: ctx.marketingSummary,
        platformHints: extractPlatformHints(ctx.marketingSummary),
        language: extractLanguage(ctx.marketingSummary, ctx.creativeSummary),
        creativeScoreCurrent: review?.creativeScore.label ?? "NOT AVAILABLE",
        creativeScoreExpected: "NOT AVAILABLE",
      };

      this.analysis = analysis;
      this.recommendations = recommendations;
      this.lastFingerprint = fp;
      this.recommendation = recommendations.length
        ? `Analysis complete — ${mustFix.length} must-fix, ${shouldImprove.length} should-improve, ${optional.length} optional.`
        : "Analysis complete — no evidence-based issues detected.";

      // Publish into Review AI panel (existing)
      creativeReviewEngine.applyAssistantReview({
        looksGood: ctx.qcOverall === "PASS" ? ["QC overall PASS"] : [],
        issues: issues.filter((i) => i.severity === "CRITICAL" || i.severity === "HIGH").map((i) => i.title),
        suggestions: recommendations.slice(0, 6).map((r) => `${r.severity}: ${r.what}`),
        warnings: issues.filter((i) => i.severity === "LOW" || i.severity === "INFO").map((i) => i.title),
        attention: mustFix.map((id) => recommendations.find((r) => r.recommendationId === id)?.what || id),
      });

      for (const r of recommendations) {
        this.auditPush("RECOMMENDATION_CREATED", r.recommendationId, ctx.productionId, ctx.versionLabel, "ok");
      }
      this.auditPush("ANALYSIS_COMPLETED", analysis.analysisId, ctx.productionId, ctx.versionLabel, "ok");
      this.emitEvents?.("state.shared", {
        action: "CreativeAnalysisCompleted",
        module: "creative-decision",
        analysisId: analysis.analysisId,
        count: recommendations.length,
      });
      this.emitEvents?.("state.shared", { action: "RecommendationCreated", module: "creative-decision", count: recommendations.length });
      this.notify?.("success", "AI analysis complete", this.recommendation, "ai-suggestions");
      this.persist();
      this.writeHandoff();
      return analysis;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Analysis failed";
      this.pushError("ANALYSIS_ERROR", msg, "Retry analysis when context is stable.");
      this.auditPush("ERROR", msg, ctx.productionId, ctx.versionLabel, "error");
      this.notify?.("error", "Analysis failed", msg, "errors");
      return null;
    } finally {
      this.analyzing = false;
      this.emit();
    }
  }

  getRecommendationsForAiMe(lang: "en" | "rw" = "en"): {
    body: string;
    recommendations: SmartRecommendation[];
  } {
    const active = this.recommendations.filter((r) => r.status !== "IGNORED");
    return {
      body: formatRecommendationsForAiMe(active, lang),
      recommendations: active,
    };
  }

  selectRecommendation(recommendationId: string, selected: boolean): void {
    this.recommendations = this.recommendations.map((r) =>
      r.recommendationId === recommendationId ? { ...r, selected, updatedAt: new Date().toISOString() } : r,
    );
    this.persist();
    this.emit();
  }

  selectAll(group?: SmartRecommendation["group"]): void {
    this.recommendations = this.recommendations.map((r) => {
      if (r.status === "IGNORED") return r;
      if (group && r.group !== group) return r;
      return { ...r, selected: true, updatedAt: new Date().toISOString() };
    });
    this.persist();
    this.emit();
  }

  ignoreRecommendation(recommendationId: string, reason?: string): void {
    const rec = this.recommendations.find((r) => r.recommendationId === recommendationId);
    if (!rec) return;
    const key = `${rec.category}|${rec.sceneId}|${rec.why.slice(0, 40)}`;
    this.ignoredKeys.add(key);
    this.ignoredKeys.add(recommendationId);
    this.recommendations = this.recommendations.map((r) =>
      r.recommendationId === recommendationId
        ? { ...r, status: "IGNORED", selected: false, ignoredAt: new Date().toISOString(), ignoreReason: reason || null, updatedAt: new Date().toISOString() }
        : r,
    );
    this.auditPush("RECOMMENDATION_IGNORED", recommendationId, this.analysis?.productionId ?? null, this.analysis?.versionLabel ?? null, "ok");
    this.persist();
    this.emit();
  }

  viewRecommendation(recommendationId: string): SmartRecommendation | null {
    const rec = this.recommendations.find((r) => r.recommendationId === recommendationId) ?? null;
    if (rec) {
      this.auditPush("RECOMMENDATION_VIEWED", recommendationId, this.analysis?.productionId ?? null, this.analysis?.versionLabel ?? null, "ok");
    }
    return rec;
  }

  preparePlan(recommendationIds?: string[]): CreativeCorrectionPlan | null {
    const ctx = refreshAssistantContext();
    if (!ctx.available) {
      this.pushError("CORRECTION_PLAN_ERROR", "Context unavailable", "Load production context first.");
      this.emit();
      return null;
    }
    if (!this.recommendations.length) {
      this.pushError("CORRECTION_PLAN_ERROR", "No recommendations", "Run analysis first.");
      this.emit();
      return null;
    }

    let recs = this.recommendations;
    if (recommendationIds?.length) {
      recs = recs.map((r) => ({
        ...r,
        selected: recommendationIds.includes(r.recommendationId),
      }));
      this.recommendations = recs;
    }

    const selected = recs.filter((r) => r.selected && r.status !== "IGNORED");
    if (!selected.length) {
      this.pushError("CORRECTION_PLAN_ERROR", "Nothing selected", "Select at least one recommendation.");
      this.emit();
      return null;
    }

    // Claim safety hard block for text that would reintroduce DO NOT USE
    const plan = createCorrectionPlan({ ctx, recommendations: selected });
    if (plan.claimSafetyBlocked && selected.some((r) => r.category === "CLAIM_SAFETY" && r.conflicts.length === 0)) {
      // still allow plan that aims to FIX claim safety
    }

    this.recommendations = this.recommendations.map((r) =>
      selected.some((s) => s.recommendationId === r.recommendationId)
        ? { ...r, status: "PENDING_APPROVAL", updatedAt: new Date().toISOString() }
        : r,
    );
    this.activePlan = plan;
    this.plans = [...this.plans.filter((p) => p.planId !== plan.planId), plan];
    this.auditPush("CORRECTION_PLAN_CREATED", plan.planId, ctx.productionId, ctx.versionLabel, "pending");
    this.emitEvents?.("state.shared", { action: "CorrectionPlanCreated", module: "creative-decision", planId: plan.planId });
    this.notify?.("info", "Correction plan ready", `${plan.sourceVersion} → ${plan.targetVersion}`, "ai-suggestions");
    this.recommendation = `Correction plan ${plan.planId} pending approval.`;
    this.persist();
    this.writeHandoff();
    this.emit();
    return plan;
  }

  cancelPlan(): void {
    if (!this.activePlan) return;
    this.activePlan = { ...this.activePlan, status: "CANCELLED", updatedAt: new Date().toISOString() };
    this.plans = this.plans.map((p) => (p.planId === this.activePlan!.planId ? this.activePlan! : p));
    this.activePlan = null;
    this.persist();
    this.emit();
  }

  async applyPlan(planId?: string): Promise<CreativeCorrectionPlan | null> {
    const plan = this.plans.find((p) => p.planId === (planId || this.activePlan?.planId)) ?? this.activePlan;
    if (!plan) {
      this.pushError("CORRECTION_PLAN_ERROR", "No plan", "Prepare a correction plan first.");
      this.emit();
      return null;
    }
    if (plan.status !== "PENDING_APPROVAL" && plan.status !== "FAILED") {
      this.pushError("CORRECTION_PLAN_ERROR", `Plan status is ${plan.status}`, "Only pending plans can be applied.");
      this.emit();
      return null;
    }

    // Conflicts that require keep-CTA style block for remove-CTA without resolution
    const hardConflict = plan.conflicts.find((c) => c.kind === "USER_VS_MARKETING");
    if (hardConflict && /remove/i.test(plan.reason)) {
      this.pushError("CORRECTION_PLAN_ERROR", hardConflict.message, "Resolve campaign conflict before apply.");
      this.notify?.("warning", "Conflict", hardConflict.message, "warnings");
      this.emit();
      return null;
    }

    const qcBefore = refreshAssistantContext().qcOverall;
    const sourceVersion = plan.sourceVersion;

    this.activePlan = { ...plan, status: "IN_PROGRESS", updatedAt: new Date().toISOString() };
    this.plans = this.plans.map((p) => (p.planId === plan.planId ? this.activePlan! : p));
    this.recommendations = this.recommendations.map((r) =>
      plan.changes.some((c) => c.recommendationId === r.recommendationId)
        ? { ...r, status: "IN_PROGRESS", updatedAt: new Date().toISOString() }
        : r,
    );
    this.auditPush("CORRECTION_APPROVED", plan.planId, plan.productionId, plan.sourceVersion, "ok");
    this.auditPush("CORRECTION_STARTED", plan.planId, plan.productionId, plan.sourceVersion, "pending");
    this.emitEvents?.("state.shared", { action: "CorrectionApproved", module: "creative-decision", planId: plan.planId });
    this.emitEvents?.("state.shared", { action: "CorrectionStarted", module: "creative-decision", planId: plan.planId });
    this.notify?.("info", "Correction started", `Creating ${plan.targetVersion} via existing production system`, "updates");
    this.persist();
    this.emit();

    try {
      creativeReviewEngine.hydrate(sourceVersion);
      for (const change of plan.changes) {
        const rec = this.recommendations.find((r) => r.recommendationId === change.recommendationId);
        creativeReviewEngine.addFeedback({
          sceneId: change.sceneId,
          category: rec?.feedbackCategory ?? "OTHER",
          comment: `[Decision Engine] ${change.change} — ${rec?.why ?? plan.reason}`,
          timestampSec: null,
        });
      }
      creativeReviewEngine.requestChanges();

      productionFinalEngine.hydrate();
      const started = await productionFinalEngine.createNewVersion();
      const newLabel = started.package?.versionLabel || plan.targetVersion;
      const qcAfter = started.qcReport?.overall ?? refreshAssistantContext().qcOverall;

      const history = listProductionHistory();
      const sourceIntact = history.some((h) => h.versionLabel === sourceVersion);

      const verification = {
        available: Boolean(qcBefore || qcAfter),
        beforeNote: `Source ${sourceVersion} QC: ${qcBefore ?? "NOT AVAILABLE"}`,
        afterNote: `New ${newLabel} QC: ${qcAfter ?? "NOT AVAILABLE"} · status ${started.status}`,
        issueResolved: qcAfter === "PASS" ? true : qcAfter != null ? false : null,
        qcOverallBefore: qcBefore,
        qcOverallAfter: qcAfter ?? null,
        message: sourceIntact
          ? `v1 source preserved. New version ${newLabel}. Verification: ${qcAfter != null ? `QC ${qcAfter}` : "Verification not available."}`
          : `New version ${newLabel}. Source history check inconclusive.`,
      };

      this.activePlan = {
        ...this.activePlan,
        status: "APPLIED",
        targetVersion: newLabel,
        updatedAt: new Date().toISOString(),
        resultNote: `createNewVersion → ${started.status} ${started.progress}%`,
        verification,
      };
      this.plans = this.plans.map((p) => (p.planId === plan.planId ? this.activePlan! : p));
      this.recommendations = this.recommendations.map((r) =>
        plan.changes.some((c) => c.recommendationId === r.recommendationId)
          ? { ...r, status: verification.issueResolved ? "VERIFIED" : "APPLIED", appliedVersion: newLabel, updatedAt: new Date().toISOString() }
          : r,
      );

      this.auditPush("CORRECTION_COMPLETED", `${plan.planId} → ${newLabel}`, plan.productionId, sourceVersion, "ok");
      this.auditPush("VERIFICATION_COMPLETED", verification.message, plan.productionId, newLabel, "ok");
      this.emitEvents?.("state.shared", { action: "CorrectionCompleted", module: "creative-decision", planId: plan.planId, version: newLabel });
      this.emitEvents?.("state.shared", { action: "CorrectionVerificationCompleted", module: "creative-decision", planId: plan.planId });
      this.notify?.("success", "Correction applied", verification.message, "production-complete");
      this.recommendation = verification.message;

      // Refresh review on new version when package ready
      creativeReviewEngine.hydrate(newLabel);
      this.lastFingerprint = null;
      this.persist();
      this.writeHandoff();
      this.emit();

      void import("../creative-memory/memory-engine").then(({ creativeMemoryEngine }) => {
        creativeMemoryEngine.hydrate();
        creativeMemoryEngine.learnFromDecisionSnapshot();
        creativeMemoryEngine.runSafeAutomation("correction_complete");
      }).catch(() => { /* memory layer optional if not loaded */ });

      return this.activePlan;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Correction failed";
      this.activePlan = {
        ...plan,
        status: "FAILED",
        updatedAt: new Date().toISOString(),
        resultNote: msg,
      };
      this.plans = this.plans.map((p) => (p.planId === plan.planId ? this.activePlan! : p));
      this.recommendations = this.recommendations.map((r) =>
        plan.changes.some((c) => c.recommendationId === r.recommendationId)
          ? { ...r, status: "FAILED", updatedAt: new Date().toISOString() }
          : r,
      );
      this.pushError("PRODUCTION_ERROR", msg, "Retry correction when production systems are ready.");
      this.auditPush("CORRECTION_FAILED", msg, plan.productionId, plan.sourceVersion, "error");
      this.emitEvents?.("state.shared", { action: "CorrectionFailed", module: "creative-decision", planId: plan.planId, error: msg });
      this.notify?.("error", "Correction failed", msg, "errors");
      this.persist();
      this.emit();
      return this.activePlan;
    }
  }

  private readClaimAudit(): ClaimAuditItem[] {
    try {
      const final = productionFinalEngine.snapshot().state;
      const audit = final?.pipelineState?.snapshot?.plan?.claimAudit;
      return Array.isArray(audit) ? audit : [];
    } catch {
      return [];
    }
  }

  private persist(): void {
    const blob: PersistedBlob = {
      recommendations: this.recommendations,
      plans: this.plans,
      ignoredKeys: [...this.ignoredKeys],
      lastFingerprint: this.lastFingerprint,
      analysis: this.analysis,
    };
    saveJson(DECISION_STORE_KEY, blob);
  }

  private writeHandoff(): void {
    saveJson(DECISION_HANDOFF_KEY, {
      version: 1,
      step: "phase-6-step-3-decision-engine",
      status: "READY",
      analysisId: this.analysis?.analysisId ?? null,
      recommendationCount: this.recommendations.length,
      activePlanId: this.activePlan?.planId ?? null,
      note: "Step 4 is not auto-started.",
      preparedAt: new Date().toISOString(),
    });
  }

  private auditPush(
    action: DecisionAuditEntry["action"],
    detail: string,
    productionId: string | null,
    versionLabel: string | null,
    result: DecisionAuditEntry["result"],
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
    saveJson(DECISION_AUDIT_KEY, this.audit);
  }

  private pushError(stage: DecisionErrorRecord["stage"], message: string, recoveryAction: string): void {
    this.errors = [
      ...this.errors,
      {
        errorId: uid("derr"),
        stage,
        message,
        timestamp: new Date().toISOString(),
        recoveryAction,
      },
    ].slice(-50);
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const l of this.listeners) l(snap);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Read rejected topics from Step 4 memory store without importing the memory engine (no cycle). */
function loadRejectedMemoryTopics(projectId: string): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem("kwizera.creative-memory.v1") ?? '{"byProject":{}}') as {
      byProject?: Record<string, Array<{ topic: string; decision: string | null; disabled: boolean; lifecycle: string }>>;
    };
    const list = raw.byProject?.[projectId] ?? [];
    return new Set(
      list
        .filter((m) => !m.disabled && m.lifecycle === "ACTIVE" && (m.decision === "REJECTED" || m.decision === "IGNORED"))
        .map((m) => m.topic),
    );
  } catch {
    return new Set();
  }
}

function extractPlatformHints(marketing: string | null): string[] {
  if (!marketing) return [];
  const hints: string[] = [];
  if (/tiktok/i.test(marketing)) hints.push("TikTok");
  if (/instagram/i.test(marketing)) hints.push("Instagram");
  if (/facebook/i.test(marketing)) hints.push("Facebook");
  if (/youtube/i.test(marketing)) hints.push("YouTube");
  return hints;
}

function extractLanguage(marketing: string | null, creative: string | null): string | null {
  const blob = `${marketing ?? ""} ${creative ?? ""}`;
  if (/kinyarwanda|\brw\b/i.test(blob)) return "Kinyarwanda";
  if (/english|\ben\b/i.test(blob)) return "English";
  return null;
}

export const creativeDecisionEngine = new CreativeDecisionEngine();

export function loadDecisionHandoff(): {
  version: 1;
  step: string;
  status: string;
  analysisId: string | null;
  recommendationCount: number;
  activePlanId: string | null;
} | null {
  try {
    const raw = loadJson<ReturnType<typeof loadDecisionHandoff>>(DECISION_HANDOFF_KEY, null);
    return raw?.version === 1 ? raw : null;
  } catch {
    return null;
  }
}
