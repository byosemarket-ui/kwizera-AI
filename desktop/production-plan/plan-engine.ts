import { loadStep3PreProductionHandoff } from "../creative-planner/planner-engine";
import type { Step3PreProductionHandoffPayload } from "../creative-planner/types";
import type { MasterCreativeBlueprint } from "../creative-planner/types";
import type { MasterMarketingStrategy } from "../marketing-strategy/types";
import type { MasterProductIntelligence, ClaimSafetyEntry } from "../master-intelligence/types";
import type { MarketingProductionBrief } from "../marketing-input/types";
import {
  assembleProductionPlan,
  buildAiMePlanExplanation,
  buildProductionSnapshot,
  recalcAssets,
} from "./assemble";
import type {
  MasterProductionPlan,
  Phase5ProductionHandoffPayload,
  PlanProgress,
  PlanStage,
  ProductionPlanSnapshot,
  ProductionSnapshot,
} from "./types";
import {
  PLAN_HANDOFF_KEY,
  PLAN_MEMORY_KEY,
  PLAN_SNAPSHOT_KEY,
  PLAN_STAGE_LABELS,
  PLAN_STAGES,
  PLAN_STORE_KEY,
} from "./types";

type NotifyFn = (
  tone: "success" | "warning" | "error" | "info",
  title: string,
  detail: string,
  category?: "information" | "warnings" | "errors" | "production-complete" | "updates" | "ai-suggestions",
) => void;
type Listener = (snap: ProductionPlanSnapshot) => void;

interface StoreEntry {
  current: MasterProductionPlan;
  history: MasterProductionPlan[];
  snapshot: ProductionSnapshot | null;
  snapshots: ProductionSnapshot[];
  blueprint: MasterCreativeBlueprint;
  strategy: MasterMarketingStrategy | null;
  master: MasterProductIntelligence | null;
  brief: MarketingProductionBrief | null;
  claimSafety: ClaimSafetyEntry[];
}

function loadStore(): Record<string, StoreEntry> {
  try {
    return JSON.parse(localStorage.getItem(PLAN_STORE_KEY) ?? "{}") as Record<string, StoreEntry>;
  } catch {
    return {};
  }
}

function saveEntry(entry: StoreEntry): void {
  const map = loadStore();
  map[entry.current.projectId] = entry;
  localStorage.setItem(PLAN_STORE_KEY, JSON.stringify(map));
}

function loadMemory(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(PLAN_MEMORY_KEY) ?? "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function saveMemory(projectId: string, payload: Record<string, unknown>): void {
  const mem = loadMemory();
  mem[projectId] = { ...payload, updatedAt: new Date().toISOString() };
  localStorage.setItem(PLAN_MEMORY_KEY, JSON.stringify(mem));
}

function loadSnapshotArchive(): Record<string, ProductionSnapshot[]> {
  try {
    return JSON.parse(localStorage.getItem(PLAN_SNAPSHOT_KEY) ?? "{}") as Record<string, ProductionSnapshot[]>;
  } catch {
    return {};
  }
}

function saveSnapshotArchive(projectId: string, snapshots: ProductionSnapshot[]): void {
  const map = loadSnapshotArchive();
  map[projectId] = snapshots;
  localStorage.setItem(PLAN_SNAPSHOT_KEY, JSON.stringify(map));
}

function emptyProgress(): PlanProgress {
  return { total: PLAN_STAGES.length, completed: 0, percent: 0, currentLabel: "Idle", currentStage: null, running: false };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function readExportSettings(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem("kwizera.workspace-state.v1");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { projectMemory?: { exportSettings?: Record<string, unknown> } };
    return parsed.projectMemory?.exportSettings ?? null;
  } catch {
    return null;
  }
}

export class ProductionPlanEngine {
  private pkg: MasterProductionPlan | null = null;
  private historyPkgs: MasterProductionPlan[] = [];
  private snapshotObj: ProductionSnapshot | null = null;
  private snapshotArchive: ProductionSnapshot[] = [];
  private step3: Step3PreProductionHandoffPayload | null = null;
  private blueprint: MasterCreativeBlueprint | null = null;
  private strategy: MasterMarketingStrategy | null = null;
  private master: MasterProductIntelligence | null = null;
  private brief: MarketingProductionBrief | null = null;
  private claimSafety: ClaimSafetyEntry[] = [];
  private progress = emptyProgress();
  private listeners = new Set<Listener>();
  private notify: NotifyFn | null = null;
  private emitEvents: ((type: string, payload: Record<string, unknown>) => void) | null = null;
  private handoffReady = false;
  private reviewOpen = false;
  private recommendation = "Confirm Creative Blueprint (Phase 4 Step 2), then compile the Master Production Plan.";
  private resumeStageIndex = 0;

  setNotify(fn: NotifyFn | null): void { this.notify = fn; }
  setEventEmitter(fn: ((type: string, payload: Record<string, unknown>) => void) | null): void { this.emitEvents = fn; }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): ProductionPlanSnapshot {
    return {
      version: 1,
      package: this.pkg,
      snapshot: this.snapshotObj,
      progress: { ...this.progress },
      recommendation: this.recommendation,
      handoffReady: this.handoffReady,
      reviewOpen: this.reviewOpen,
      updatedAt: new Date().toISOString(),
    };
  }

  buildAiMeContext() {
    if (this.progress.running) {
      return { running: true, explanation: `Production plan compiling — ${this.progress.percent}%. ${this.progress.currentLabel}`, recommendation: this.recommendation };
    }
    if (!this.pkg) {
      return { running: false, explanation: "Master Production Plan has not been compiled. Confirm Creative Blueprint first.", recommendation: this.recommendation };
    }
    return {
      projectId: this.pkg.projectId,
      confirmed: this.pkg.userConfirmed,
      readiness: this.pkg.readiness,
      overall: this.pkg.scores.overall,
      phase4Complete: this.pkg.phase4Complete,
      readyForPhase5: this.pkg.readyForPhase5,
      running: false,
      canContinue: this.pkg.status === "draft" || this.pkg.status === "review",
      recommendation: this.recommendation,
      explanation: buildAiMePlanExplanation(this.pkg),
    };
  }

  hydrate(): boolean {
    const handoff = loadStep3PreProductionHandoff();
    this.step3 = handoff;
    this.blueprint = handoff?.blueprint ?? null;
    this.strategy = handoff?.strategy ?? null;
    this.master = handoff?.master ?? null;
    this.brief = handoff?.marketingBrief ?? null;
    this.claimSafety = handoff?.claimSafety ?? [];
    if (!this.blueprint || !this.blueprint.userConfirmed) {
      this.recommendation = "No confirmed Creative Blueprint found. Complete Phase 4 Step 2 first.";
      this.emit();
      return false;
    }
    const stored = loadStore()[this.blueprint.projectId];
    if (stored?.current) {
      if (stored.current.status === "running") {
        stored.current.status = stored.current.userConfirmed ? "confirmed" : "draft";
        saveEntry(stored);
      }
      this.pkg = stored.current;
      this.historyPkgs = stored.history ?? [];
      this.snapshotObj = stored.snapshot ?? null;
      this.snapshotArchive = stored.snapshots ?? loadSnapshotArchive()[this.blueprint.projectId] ?? [];
      this.blueprint = stored.blueprint ?? this.blueprint;
      this.strategy = stored.strategy ?? this.strategy;
      this.master = stored.master ?? this.master;
      this.brief = stored.brief ?? this.brief;
      this.claimSafety = stored.claimSafety ?? this.claimSafety;
      this.handoffReady = stored.current.readyForPhase5;
      this.reviewOpen = stored.current.status === "review" || stored.current.status === "draft";
      this.recommendation = stored.current.userConfirmed
        ? `Restored confirmed Master Production Plan ${stored.current.versionLabel}. Phase 5 is not started.`
        : `Restored Production Plan draft ${stored.current.versionLabel}. Review and confirm.`;
      this.emitAction("MasterProductionPlanStarted", { restored: true, projectId: this.blueprint.projectId });
      this.emit();
      return true;
    }
    this.recommendation = `Ready to compile the Master Production Plan for “${this.blueprint.productName}”. No video will be rendered.`;
    this.emit();
    return true;
  }

  async run(options?: { force?: boolean }): Promise<MasterProductionPlan> {
    if (!this.blueprint) {
      if (!this.hydrate()) throw new Error("Confirmed Creative Blueprint required");
    }
    if (this.progress.running) throw new Error("Planning already running");
    const previousConfirmed = this.pkg?.userConfirmed ? this.pkg : this.historyPkgs.find((p) => p.userConfirmed) ?? null;
    const previous = options?.force ? previousConfirmed : (this.pkg?.userConfirmed ? this.pkg : previousConfirmed);

    this.progress = { total: PLAN_STAGES.length, completed: 0, percent: 4, currentLabel: PLAN_STAGE_LABELS.loaded, currentStage: "loaded", running: true };
    this.resumeStageIndex = 0;
    this.reviewOpen = false;
    this.emitAction("MasterProductionPlanStarted", { projectId: this.blueprint?.projectId });
    this.emitBus("product-analysis.started", { phase: "production-plan" });
    this.emit();

    let assembled: MasterProductionPlan;
    try {
      assembled = assembleProductionPlan({
        blueprint: this.blueprint!,
        strategy: this.strategy,
        master: this.master,
        brief: this.brief,
        claimSafety: this.claimSafety.length ? this.claimSafety : this.master?.claimSafety ?? [],
        previous: previous ?? null,
        exportSettings: readExportSettings(),
        productionRestrictions: this.step3?.productionRestrictions,
      });
      assembled.status = "running";
      this.pkg = assembled;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Planning failed";
      if (this.pkg) {
        this.pkg = { ...this.pkg, lastError: msg, status: "partial" };
        this.persist();
      }
      this.progress.running = false;
      this.recommendation = `Planning failed: ${msg}. Successful sections were kept. Retry when ready.`;
      this.emit();
      throw error;
    }

    const start = options?.force ? 1 : Math.max(1, this.resumeStageIndex);
    for (let i = start; i < PLAN_STAGES.length - 1; i++) {
      const stage = PLAN_STAGES[i]!;
      this.progress.currentStage = stage;
      this.progress.currentLabel = PLAN_STAGE_LABELS[stage];
      this.progress.completed = i + 1;
      this.progress.percent = Math.round(((i + 1) / PLAN_STAGES.length) * 94);
      this.resumeStageIndex = i;
      this.emitSection(stage, assembled);
      this.emitBus("production.progress", { percent: this.progress.percent, label: this.progress.currentLabel });
      saveMemory(assembled.projectId, { planId: assembled.planId, stage, percent: this.progress.percent, status: "running" });
      this.emit();
      await delay(12);
    }

    assembled.status = "review";
    assembled.updatedAt = new Date().toISOString();
    this.pkg = assembled;
    this.reviewOpen = true;
    this.persist();
    saveMemory(assembled.projectId, { planId: assembled.planId, stage: "saved", percent: 100, status: "review" });
    this.progress = { total: PLAN_STAGES.length, completed: PLAN_STAGES.length, percent: 100, currentLabel: PLAN_STAGE_LABELS.saved, currentStage: "saved", running: false };
    this.resumeStageIndex = PLAN_STAGES.length;
    this.recommendation = assembled.readiness === "BLOCKED"
      ? `Readiness ${assembled.scores.overall}%. BLOCKED — fix required items before production.`
      : `Draft ready (${assembled.scores.overall}%, ${assembled.readiness}). Review and confirm. Phase 5 will not start.`;
    this.emitAction("ProductionPlanReviewOpened", { projectId: assembled.projectId, version: assembled.versionLabel, readiness: assembled.readiness });
    this.emitAction("ProductionReadinessCalculated", { overall: assembled.scores.overall, status: assembled.readiness });
    this.markDirty();
    this.emit();
    return assembled;
  }

  /** Incremental: only timeline, assets, dependencies, and readiness when scenes change. */
  applySceneChange(blueprint: MasterCreativeBlueprint): MasterProductionPlan | null {
    if (!this.pkg || this.pkg.userConfirmed) return this.pkg;
    this.blueprint = blueprint;
    this.pkg = {
      ...recalcAssets(this.pkg, blueprint),
      story: blueprint.story,
      script: blueprint.script,
      scenes: blueprint.scenes,
    };
    this.pkg.checklist = this.pkg.checklist.map((c) => (
      c.id === "y3" ? { ...c, ok: false } : c
    ));
    this.persist();
    this.emitAction("ProductionRequirementCalculated", { incremental: true, projectId: this.pkg.projectId });
    this.emitAction("AssetRequirementCalculated", { incremental: true, count: this.pkg.assets.length });
    this.emit();
    return this.pkg;
  }

  confirm(): MasterProductionPlan {
    if (!this.pkg) throw new Error("Compile the Master Production Plan before confirming");
    if (this.pkg.status !== "review" && this.pkg.status !== "draft") throw new Error("Review the draft before confirming");
    if (!this.blueprint) throw new Error("Creative Blueprint required");
    this.emitAction("ClaimAuditStarted", { projectId: this.pkg.projectId });
    this.emitAction("ClaimAuditCompleted", { blocking: this.pkg.claimAudit.filter((c) => c.blocks).length });
    if (this.pkg.readiness === "BLOCKED") {
      throw new Error("Cannot confirm: production is BLOCKED. Fix required items.");
    }
    const confirmed: MasterProductionPlan = {
      ...this.pkg,
      status: "confirmed",
      userConfirmed: true,
      confirmedAt: new Date().toISOString(),
      phase4Complete: true,
      readyForPhase5: true,
      lastError: null,
      checklist: this.pkg.checklist.map((c) => (c.id === "y3" ? { ...c, ok: true } : c)),
      updatedAt: new Date().toISOString(),
    };
    const snap = buildProductionSnapshot(confirmed, {
      blueprint: this.blueprint,
      strategy: this.strategy,
      master: this.master,
      brief: this.brief,
      claimSafety: this.claimSafety,
    });
    const history = [...this.historyPkgs, this.pkg];
    this.historyPkgs = history;
    this.pkg = confirmed;
    this.snapshotObj = snap;
    this.snapshotArchive = [...this.snapshotArchive, snap];
    this.reviewOpen = false;
    this.handoffReady = true;
    this.persist();
    saveSnapshotArchive(confirmed.projectId, this.snapshotArchive);
    saveMemory(confirmed.projectId, { planId: confirmed.planId, status: "confirmed", version: confirmed.versionLabel, snapshotId: snap.snapshotId });

    const handoff: Phase5ProductionHandoffPayload = {
      version: 1,
      step: "phase-5-ai-production",
      phase4Complete: true,
      projectId: confirmed.projectId,
      projectName: confirmed.projectName,
      snapshot: snap,
      preparedAt: new Date().toISOString(),
    };
    localStorage.setItem(PLAN_HANDOFF_KEY, JSON.stringify(handoff));
    this.recommendation = `Master Production Plan ${confirmed.versionLabel} confirmed. Opening Production Queue (Phase 5 Step 1).`;
    this.emitAction("ProductionPlanConfirmed", { projectId: confirmed.projectId, version: confirmed.versionLabel, readiness: confirmed.readiness });
    this.emitAction("ProductionSnapshotCreated", { snapshotId: snap.snapshotId, version: confirmed.versionLabel });
    this.emitAction("ProductionPlanCompleted", { projectId: confirmed.projectId, phase4Complete: true, readyForPhase5: true });
    this.emitBus("product-analysis.completed", { projectId: confirmed.projectId, phase: "production-plan", version: confirmed.versionLabel });
    this.markDirty();
    this.emit();
    return confirmed;
  }

  private persist(): void {
    if (!this.pkg || !this.blueprint) return;
    saveEntry({
      current: this.pkg,
      history: this.historyPkgs,
      snapshot: this.snapshotObj,
      snapshots: this.snapshotArchive,
      blueprint: this.blueprint,
      strategy: this.strategy,
      master: this.master,
      brief: this.brief,
      claimSafety: this.claimSafety,
    });
    this.markDirty();
  }

  private emitSection(stage: PlanStage, pkg: MasterProductionPlan): void {
    const payload = { projectId: pkg.projectId, stage, version: pkg.versionLabel };
    if (stage === "assets") {
      this.emitAction("AssetRequirementCalculated", { count: pkg.assets.length, ...payload });
      const missing = pkg.assets.filter((a) => a.status === "MISSING");
      if (missing.length) this.emitAction("MissingAssetDetected", { count: missing.length, ...payload });
    } else if (stage === "timeline" || stage === "dependencies") {
      this.emitAction("ProductionRequirementCalculated", payload);
    } else if (stage === "claims") {
      this.emitAction("ClaimAuditStarted", payload);
      this.emitAction("ClaimAuditCompleted", { blocking: pkg.claimAudit.filter((c) => c.blocks).length, ...payload });
    } else if (stage === "consistency") {
      this.emitAction("CreativeConsistencyCheckStarted", payload);
      this.emitAction("CreativeConsistencyCheckCompleted", { warnings: pkg.consistency.length, ...payload });
    } else if (stage === "readiness") {
      this.emitAction("ProductionReadinessCalculated", { overall: pkg.scores.overall, status: pkg.readiness, ...payload });
    }
  }

  private emitAction(action: string, payload: Record<string, unknown>): void {
    this.emitEvents?.("state.shared", { action, module: "production-plan", ...payload });
    this.emitEvents?.("product.updated", { action, module: "production-plan", ...payload });
  }
  private emitBus(type: string, payload: Record<string, unknown>): void { this.emitEvents?.(type, payload); }
  private markDirty(): void {
    void import("../shell/workspace-state/workspace-state-engine").then(({ workspaceStateEngine }) => {
      workspaceStateEngine.autoSave.markDirty();
    });
  }
  private emit(): void {
    const snap = this.snapshot();
    for (const listener of this.listeners) listener(snap);
  }
}

export const productionPlanEngine = new ProductionPlanEngine();

export function loadPhase5ProductionHandoff(): Phase5ProductionHandoffPayload | null {
  try {
    const raw = JSON.parse(localStorage.getItem(PLAN_HANDOFF_KEY) ?? "null") as Phase5ProductionHandoffPayload | null;
    return raw?.version === 1 && raw.step === "phase-5-ai-production" && raw.phase4Complete === true ? raw : null;
  } catch {
    return null;
  }
}
