import { loadContentProductionHandoff } from "../master-intelligence/master-engine";
import type { ContentProductionHandoffPayload } from "../master-intelligence/types";
import type { MasterProductIntelligence } from "../master-intelligence/types";
import type { MarketingProductionBrief } from "../marketing-input/types";
import { assembleMarketingStrategy, buildAiMeStrategyExplanation } from "./assemble";
import type {
  MarketingStrategySnapshot,
  MasterMarketingStrategy,
  RecDecision,
  Step2CreativePlannerHandoffPayload,
  StrategyProgress,
  StrategyStage,
} from "./types";
import { STRATEGY_HANDOFF_KEY, STRATEGY_MEMORY_KEY, STRATEGY_STAGE_LABELS, STRATEGY_STAGES, STRATEGY_STORE_KEY } from "./types";

type NotifyFn = (
  tone: "success" | "warning" | "error" | "info",
  title: string,
  detail: string,
  category?: "information" | "warnings" | "errors" | "production-complete" | "updates" | "ai-suggestions",
) => void;
type Listener = (snap: MarketingStrategySnapshot) => void;

interface StoreEntry {
  current: MasterMarketingStrategy;
  history: MasterMarketingStrategy[];
}

function loadStore(): Record<string, StoreEntry> {
  try {
    return JSON.parse(localStorage.getItem(STRATEGY_STORE_KEY) ?? "{}") as Record<string, StoreEntry>;
  } catch {
    return {};
  }
}

function saveEntry(entry: StoreEntry): void {
  const map = loadStore();
  map[entry.current.projectId] = entry;
  localStorage.setItem(STRATEGY_STORE_KEY, JSON.stringify(map));
}

function loadMemory(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(STRATEGY_MEMORY_KEY) ?? "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function saveMemory(projectId: string, payload: Record<string, unknown>): void {
  const mem = loadMemory();
  mem[projectId] = { ...payload, updatedAt: new Date().toISOString() };
  localStorage.setItem(STRATEGY_MEMORY_KEY, JSON.stringify(mem));
}

function emptyProgress(): StrategyProgress {
  return { total: STRATEGY_STAGES.length, completed: 0, percent: 0, currentLabel: "Idle", currentStage: null, running: false };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class MarketingStrategyEngine {
  private pkg: MasterMarketingStrategy | null = null;
  private historyPkgs: MasterMarketingStrategy[] = [];
  private phase3: ContentProductionHandoffPayload | null = null;
  private master: MasterProductIntelligence | null = null;
  private brief: MarketingProductionBrief | null = null;
  private progress = emptyProgress();
  private listeners = new Set<Listener>();
  private notify: NotifyFn | null = null;
  private emitEvents: ((type: string, payload: Record<string, unknown>) => void) | null = null;
  private handoffReady = false;
  private reviewOpen = false;
  private recommendation = "Confirm Master Product Intelligence (Phase 3 Step 4), then compile the Marketing Strategy.";
  private keepUserSettings = false;
  private resumeStageIndex = 0;

  setNotify(fn: NotifyFn | null): void {
    this.notify = fn;
  }

  setEventEmitter(fn: ((type: string, payload: Record<string, unknown>) => void) | null): void {
    this.emitEvents = fn;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): MarketingStrategySnapshot {
    return {
      version: 1,
      package: this.pkg,
      progress: { ...this.progress },
      recommendation: this.recommendation,
      handoffReady: this.handoffReady,
      reviewOpen: this.reviewOpen,
      updatedAt: new Date().toISOString(),
    };
  }

  buildAiMeContext() {
    if (this.progress.running) {
      return {
        running: true,
        explanation: `Marketing strategy is compiling — ${this.progress.percent}%. ${this.progress.currentLabel}`,
        recommendation: this.recommendation,
      };
    }
    if (!this.pkg) {
      return {
        running: false,
        explanation: "Master Marketing Strategy has not been compiled. Confirm Phase 3 Master Intelligence first.",
        recommendation: this.recommendation,
      };
    }
    return {
      projectId: this.pkg.projectId,
      objective: this.pkg.objective.activeObjective,
      audience: this.pkg.audience.primaryAudience,
      confirmed: this.pkg.userConfirmed,
      confidence: this.pkg.confidence.overall,
      running: false,
      canContinue: this.pkg.status === "draft" || this.pkg.status === "review",
      recommendation: this.recommendation,
      explanation: buildAiMeStrategyExplanation(this.pkg),
    };
  }

  hydrate(): boolean {
    const handoff = loadContentProductionHandoff();
    this.phase3 = handoff;
    this.master = handoff?.master ?? null;
    this.brief = handoff?.marketingBrief ?? handoff?.productionPackage?.marketingBrief ?? null;
    if (!this.master || !this.master.userConfirmed) {
      this.recommendation = "No confirmed Master Product Intelligence found. Complete Phase 3 Step 4 first.";
      this.emit();
      return false;
    }
    const stored = loadStore()[this.master.projectId];
    if (stored?.current) {
      if (stored.current.status === "running") {
        stored.current.status = stored.current.userConfirmed ? "confirmed" : "draft";
        saveEntry(stored);
      }
      this.pkg = stored.current;
      this.historyPkgs = stored.history ?? [];
      this.keepUserSettings = stored.current.keepUserSettings;
      this.handoffReady = stored.current.readyForCreativePlanning;
      this.reviewOpen = stored.current.status === "review" || stored.current.status === "draft";
      this.recommendation = stored.current.userConfirmed
        ? `Restored confirmed Marketing Strategy ${stored.current.versionLabel}. Step 2 is not started.`
        : `Restored Marketing Strategy draft ${stored.current.versionLabel}. Review and confirm.`;
      this.emitAction("MarketingStrategyStarted", { restored: true, projectId: this.master.projectId });
      this.emit();
      return true;
    }
    this.recommendation = `Ready to compile Master Marketing Strategy for “${this.master.productName}”. User objective and CTA stay authoritative.`;
    this.emit();
    return true;
  }

  async run(options?: { force?: boolean; keepUserSettings?: boolean }): Promise<MasterMarketingStrategy> {
    if (!this.master) {
      if (!this.hydrate()) throw new Error("Confirmed Master Product Intelligence required");
    }
    if (this.progress.running) throw new Error("Compilation already running");
    if (options?.keepUserSettings != null) this.keepUserSettings = options.keepUserSettings;

    const previousConfirmed = this.pkg?.userConfirmed ? this.pkg : this.historyPkgs.find((p) => p.userConfirmed) ?? null;
    const previous = options?.force ? previousConfirmed : (this.pkg?.userConfirmed ? this.pkg : previousConfirmed);
    const keepAngle = !options?.force && this.pkg && !this.pkg.userConfirmed ? this.pkg.primaryAngleId : previous?.primaryAngleId;

    this.progress = {
      total: STRATEGY_STAGES.length,
      completed: 0,
      percent: 4,
      currentLabel: STRATEGY_STAGE_LABELS.loaded,
      currentStage: "loaded",
      running: true,
    };
    this.resumeStageIndex = 0;
    this.reviewOpen = false;
    this.emitAction("MarketingStrategyStarted", { projectId: this.master?.projectId });
    this.emitBus("product-analysis.started", { phase: "marketing-strategy" });
    this.emit();

    const assembled = assembleMarketingStrategy({
      master: this.master,
      brief: this.brief,
      keepUserSettings: this.keepUserSettings,
      previous: previous ?? null,
      primaryAngleId: keepAngle ?? null,
    });
    assembled.status = "running";
    this.pkg = assembled;

    const start = options?.force ? 1 : Math.max(1, this.resumeStageIndex);
    for (let i = start; i < STRATEGY_STAGES.length - 1; i++) {
      const stage = STRATEGY_STAGES[i]!;
      this.progress.currentStage = stage;
      this.progress.currentLabel = STRATEGY_STAGE_LABELS[stage];
      this.progress.completed = i + 1;
      this.progress.percent = Math.round(((i + 1) / STRATEGY_STAGES.length) * 94);
      this.resumeStageIndex = i;
      this.emitSection(stage, assembled);
      this.emitBus("production.progress", { percent: this.progress.percent, label: this.progress.currentLabel });
      saveMemory(assembled.projectId, { strategyId: assembled.strategyId, stage, percent: this.progress.percent, status: "running" });
      this.emit();
      await delay(14);
    }

    assembled.status = "review";
    assembled.updatedAt = new Date().toISOString();
    this.pkg = assembled;
    this.reviewOpen = true;
    saveEntry({ current: assembled, history: this.historyPkgs });
    saveMemory(assembled.projectId, { strategyId: assembled.strategyId, stage: "saved", percent: 100, status: "review" });

    this.progress = {
      total: STRATEGY_STAGES.length,
      completed: STRATEGY_STAGES.length,
      percent: 100,
      currentLabel: STRATEGY_STAGE_LABELS.saved,
      currentStage: "saved",
      running: false,
    };
    this.resumeStageIndex = STRATEGY_STAGES.length;
    this.recommendation = "Draft ready. Review the strategy, then confirm. Step 2 will not start automatically.";
    this.emitAction("MarketingStrategyReviewed", { projectId: assembled.projectId, version: assembled.versionLabel });
    this.markDirty();
    this.emit();
    return assembled;
  }

  setPrimaryAngle(id: string): void {
    if (!this.pkg || this.pkg.userConfirmed) return;
    if (!this.pkg.angles.some((a) => a.id === id)) return;
    this.pkg = { ...this.pkg, primaryAngleId: id, updatedAt: new Date().toISOString() };
    saveEntry({ current: this.pkg, history: this.historyPkgs });
    this.emitAction("PrimaryAngleSelected", { angleId: id, projectId: this.pkg.projectId });
    this.markDirty();
    this.emit();
  }

  setObjectiveDecision(decision: RecDecision): void {
    if (!this.pkg || this.pkg.userConfirmed) return;
    const rec = this.pkg.objective.aiRecommendation;
    this.pkg = {
      ...this.pkg,
      objective: {
        ...this.pkg.objective,
        recDecision: decision,
        activeObjective: decision === "accepted" && rec ? rec : this.pkg.objective.userObjective,
      },
      updatedAt: new Date().toISOString(),
    };
    saveEntry({ current: this.pkg, history: this.historyPkgs });
    this.markDirty();
    this.emit();
  }

  setCtaDecision(decision: RecDecision): void {
    if (!this.pkg || this.pkg.userConfirmed) return;
    const rec = this.pkg.cta.aiRecommendation;
    this.pkg = {
      ...this.pkg,
      cta: {
        ...this.pkg.cta,
        recDecision: decision,
        activeCta: decision === "accepted" && rec ? rec : this.pkg.cta.userCta,
      },
      updatedAt: new Date().toISOString(),
    };
    saveEntry({ current: this.pkg, history: this.historyPkgs });
    this.emitAction("CTAEvaluated", { decision, projectId: this.pkg.projectId });
    this.markDirty();
    this.emit();
  }

  keepMySettings(): void {
    this.keepUserSettings = true;
    if (!this.pkg || this.pkg.userConfirmed) return;
    this.pkg = {
      ...this.pkg,
      keepUserSettings: true,
      objective: { ...this.pkg.objective, recDecision: "kept-user", activeObjective: this.pkg.objective.userObjective },
      cta: { ...this.pkg.cta, recDecision: "kept-user", activeCta: this.pkg.cta.userCta },
      promotion: { ...this.pkg.promotion, recDecision: "kept-user" },
      updatedAt: new Date().toISOString(),
    };
    saveEntry({ current: this.pkg, history: this.historyPkgs });
    this.markDirty();
    this.emit();
  }

  confirm(): MasterMarketingStrategy {
    if (!this.pkg) throw new Error("Compile Marketing Strategy before confirming");
    if (this.pkg.status !== "review" && this.pkg.status !== "draft") {
      throw new Error("Review the draft before confirming");
    }
    const confirmed: MasterMarketingStrategy = {
      ...this.pkg,
      status: "confirmed",
      userConfirmed: true,
      confirmedAt: new Date().toISOString(),
      readyForCreativePlanning: true,
      updatedAt: new Date().toISOString(),
    };
    const history = [...this.historyPkgs, this.pkg];
    this.historyPkgs = history;
    this.pkg = confirmed;
    this.reviewOpen = false;
    this.handoffReady = true;
    saveEntry({ current: confirmed, history });
    saveMemory(confirmed.projectId, { strategyId: confirmed.strategyId, status: "confirmed", version: confirmed.versionLabel });

    const handoff: Step2CreativePlannerHandoffPayload = {
      version: 1,
      step: "step-2-story-script-creative-planner",
      projectId: confirmed.projectId,
      projectName: confirmed.projectName,
      strategy: confirmed,
      master: this.master,
      marketingBrief: this.brief,
      productProfile: this.phase3?.productProfile ?? this.phase3?.productionPackage?.productProfile ?? null,
      research: this.phase3?.research ?? null,
      claimSafety: this.master?.claimSafety ?? [],
      productionRestrictions: this.master?.restrictions ?? confirmed.restrictions,
      preparedAt: new Date().toISOString(),
    };
    localStorage.setItem(STRATEGY_HANDOFF_KEY, JSON.stringify(handoff));

    this.recommendation = `Marketing Strategy ${confirmed.versionLabel} confirmed. READY FOR CREATIVE PLANNING — Step 2 is not started.`;
    this.emitAction("MarketingStrategyConfirmed", { projectId: confirmed.projectId, version: confirmed.versionLabel });
    this.emitAction("MarketingStrategyVersionCreated", { version: confirmed.versionLabel, strategyId: confirmed.strategyId });
    this.emitAction("MarketingStrategyCompleted", { projectId: confirmed.projectId, readyForCreativePlanning: true });
    this.emitBus("product-analysis.completed", { projectId: confirmed.projectId, phase: "marketing-strategy", version: confirmed.versionLabel });
    this.markDirty();
    this.emit();
    return confirmed;
  }

  private emitSection(stage: StrategyStage, pkg: MasterMarketingStrategy): void {
    const payload = { projectId: pkg.projectId, stage, version: pkg.versionLabel };
    if (stage === "audience") this.emitAction("AudienceStrategyGenerated", payload);
    else if (stage === "positioning") this.emitAction("PositioningGenerated", payload);
    else if (stage === "angles") this.emitAction("MarketingAngleGenerated", { count: pkg.angles.length, ...payload });
    else if (stage === "primary-angle") this.emitAction("PrimaryAngleSelected", { angleId: pkg.primaryAngleId, ...payload });
    else if (stage === "message") this.emitAction("MessageStrategyGenerated", payload);
    else if (stage === "cta") this.emitAction("CTAEvaluated", payload);
    else if (stage === "promotion") this.emitAction("PromotionStrategyGenerated", { status: pkg.promotion.status, ...payload });
    else if (stage === "creative") this.emitAction("CreativeStrategyGenerated", payload);
    else if (stage === "risks") this.emitAction("MarketingRiskDetected", { count: pkg.risks.length, ...payload });
  }

  private emitAction(action: string, payload: Record<string, unknown>): void {
    this.emitEvents?.("state.shared", { action, module: "marketing-strategy", ...payload });
    this.emitEvents?.("product.updated", { action, module: "marketing-strategy", ...payload });
  }

  private emitBus(type: string, payload: Record<string, unknown>): void {
    this.emitEvents?.(type, payload);
  }

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

export const marketingStrategyEngine = new MarketingStrategyEngine();

export function loadStep2CreativePlannerHandoff(): Step2CreativePlannerHandoffPayload | null {
  try {
    const raw = JSON.parse(localStorage.getItem(STRATEGY_HANDOFF_KEY) ?? "null") as Step2CreativePlannerHandoffPayload | null;
    return raw?.version === 1 && raw.step === "step-2-story-script-creative-planner" ? raw : null;
  } catch {
    return null;
  }
}
