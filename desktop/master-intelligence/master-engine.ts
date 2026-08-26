import { loadStep4CreativeBriefHandoff } from "../market-research/research-engine";
import type { Step4CreativeBriefHandoffPayload, ResearchPackage } from "../market-research/types";
import { INTEL_STORE_KEY } from "../deep-intelligence/types";
import type { ProductIntelligencePackage } from "../deep-intelligence/types";
import { VISUAL_STORE_KEY } from "../visual-analysis/types";
import type { VisualProductAnalysisPackage } from "../visual-analysis/types";
import type { ProductionInputPackage } from "../product-validation/types";
import type { ProductProfile } from "../product-profile/types";
import type { MarketingProductionBrief } from "../marketing-input/types";
import { assembleMasterPackage, buildAiMeMasterExplanation } from "./assemble";
import type {
  ClaimSafetyEntry,
  ContentProductionHandoffPayload,
  MasterIntelligenceSnapshot,
  MasterProductIntelligence,
  MasterProgress,
  MasterStage,
} from "./types";
import { MASTER_HANDOFF_KEY, MASTER_MEMORY_KEY, MASTER_STAGE_LABELS, MASTER_STAGES, MASTER_STORE_KEY } from "./types";

type NotifyFn = (
  tone: "success" | "warning" | "error" | "info",
  title: string,
  detail: string,
  category?: "information" | "warnings" | "errors" | "production-complete" | "updates" | "ai-suggestions",
) => void;
type Listener = (snap: MasterIntelligenceSnapshot) => void;

interface StoreEntry {
  current: MasterProductIntelligence;
  history: MasterProductIntelligence[];
}

function loadStore(): Record<string, StoreEntry> {
  try {
    return JSON.parse(localStorage.getItem(MASTER_STORE_KEY) ?? "{}") as Record<string, StoreEntry>;
  } catch {
    return {};
  }
}

function saveEntry(entry: StoreEntry): void {
  const map = loadStore();
  map[entry.current.projectId] = entry;
  localStorage.setItem(MASTER_STORE_KEY, JSON.stringify(map));
}

function loadMemory(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(MASTER_MEMORY_KEY) ?? "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function saveMemory(projectId: string, payload: Record<string, unknown>): void {
  const mem = loadMemory();
  mem[projectId] = { ...payload, updatedAt: new Date().toISOString() };
  localStorage.setItem(MASTER_MEMORY_KEY, JSON.stringify(mem));
}

function loadVisualStore(projectId: string): VisualProductAnalysisPackage | null {
  try {
    const map = JSON.parse(localStorage.getItem(VISUAL_STORE_KEY) ?? "{}") as Record<string, VisualProductAnalysisPackage>;
    return map[projectId] ?? null;
  } catch {
    return null;
  }
}

function loadIntelStore(projectId: string): ProductIntelligencePackage | null {
  try {
    const map = JSON.parse(localStorage.getItem(INTEL_STORE_KEY) ?? "{}") as Record<string, { current?: ProductIntelligencePackage }>;
    return map[projectId]?.current ?? null;
  } catch {
    return null;
  }
}

function emptyProgress(): MasterProgress {
  return { total: MASTER_STAGES.length, completed: 0, percent: 0, currentLabel: "Idle", currentStage: null, running: false };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class MasterIntelligenceEngine {
  private pkg: MasterProductIntelligence | null = null;
  private historyPkgs: MasterProductIntelligence[] = [];
  private step4: Step4CreativeBriefHandoffPayload | null = null;
  private research: ResearchPackage | null = null;
  private intel: ProductIntelligencePackage | null = null;
  private visual: VisualProductAnalysisPackage | null = null;
  private production: ProductionInputPackage | null = null;
  private profile: ProductProfile | null = null;
  private brief: MarketingProductionBrief | null = null;
  private progress = emptyProgress();
  private listeners = new Set<Listener>();
  private notify: NotifyFn | null = null;
  private emitEvents: ((type: string, payload: Record<string, unknown>) => void) | null = null;
  private handoffReady = false;
  private reviewOpen = false;
  private recommendation = "Complete Phase 3 Step 3 Product Research, then compile Master Product Intelligence.";
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

  snapshot(): MasterIntelligenceSnapshot {
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
        explanation: `Master Product Intelligence is compiling — ${this.progress.percent}%. ${this.progress.currentLabel}`,
        recommendation: this.recommendation,
      };
    }
    if (!this.pkg) {
      return {
        running: false,
        explanation: "Master Product Intelligence has not been compiled. Complete Product Research (Step 3), then compile the Master Report.",
        recommendation: this.recommendation,
      };
    }
    return {
      projectId: this.pkg.projectId,
      productName: this.pkg.productName,
      score: this.pkg.scores.overall,
      confidence: this.pkg.sectionConfidence.overall,
      confirmed: this.pkg.userConfirmed,
      phase3Complete: this.pkg.phase3Complete,
      running: false,
      canContinue: this.pkg.status === "draft" || this.pkg.status === "review",
      recommendation: this.recommendation,
      explanation: buildAiMeMasterExplanation(this.pkg),
    };
  }

  hydrate(): boolean {
    const handoff = loadStep4CreativeBriefHandoff();
    this.step4 = handoff;
    this.research = handoff?.research ?? null;
    this.intel = handoff?.masterIntelligence ?? null;
    this.production = handoff?.productionPackage ?? null;
    this.profile = handoff?.productProfile ?? this.production?.productProfile ?? null;
    this.brief = handoff?.marketingBrief ?? this.production?.marketingBrief ?? null;
    const projectId = this.profile?.projectId || this.intel?.projectId || this.research?.projectId;
    if (projectId) {
      this.visual = loadVisualStore(projectId);
      if (!this.intel) this.intel = loadIntelStore(projectId);
    }
    if (!this.research && !this.intel && !this.profile) {
      this.recommendation = "No Step 3 Research Package found. Complete Phase 3 Step 3 first.";
      this.emit();
      return false;
    }
    if (projectId) {
      const stored = loadStore()[projectId];
      if (stored?.current) {
        if (stored.current.status === "running") {
          stored.current.status = stored.current.userConfirmed ? "confirmed" : "draft";
          saveEntry(stored);
        }
        this.pkg = stored.current;
        this.historyPkgs = stored.history ?? [];
        this.handoffReady = stored.current.phase3Complete;
        this.reviewOpen = stored.current.status === "review" || stored.current.status === "draft";
        this.recommendation = stored.current.userConfirmed
          ? `Restored confirmed Master Intelligence ${stored.current.versionLabel}. Phase 3 complete.`
          : `Restored Master Intelligence draft ${stored.current.versionLabel}. Review and confirm.`;
        this.emitAction("MasterIntelligenceCompilationStarted", { restored: true, projectId });
        this.emit();
        return true;
      }
    }
    this.recommendation = `Ready to compile Master Product Intelligence for “${this.profile?.fields.name || this.intel?.productName || "this product"}”.`;
    this.emit();
    return true;
  }

  async run(options?: { force?: boolean }): Promise<MasterProductIntelligence> {
    if (!this.research && !this.intel && !this.profile) {
      if (!this.hydrate()) throw new Error("Product Research or Product Intelligence required");
    }
    if (this.progress.running) throw new Error("Compilation already running");

    const previousConfirmed = this.pkg?.userConfirmed ? this.pkg : this.historyPkgs.find((p) => p.userConfirmed) ?? null;
    const previous = options?.force ? previousConfirmed : (this.pkg?.userConfirmed ? this.pkg : previousConfirmed);

    this.progress = {
      total: MASTER_STAGES.length,
      completed: 0,
      percent: 4,
      currentLabel: MASTER_STAGE_LABELS.loaded,
      currentStage: "loaded",
      running: true,
    };
    this.resumeStageIndex = 0;
    this.reviewOpen = false;
    this.emitAction("MasterIntelligenceCompilationStarted", {
      projectId: this.profile?.projectId || this.intel?.projectId,
    });
    this.emitBus("product-analysis.started", { phase: "master-intelligence" });
    this.emit();

    const assembled = assembleMasterPackage({
      research: this.research,
      intel: this.intel,
      visual: this.visual,
      profile: this.profile,
      brief: this.brief,
      production: this.production,
      previous: previous ?? null,
    });
    assembled.status = "running";
    this.pkg = assembled;

    const start = options?.force ? 1 : Math.max(1, this.resumeStageIndex);
    for (let i = start; i < MASTER_STAGES.length - 1; i++) {
      const stage = MASTER_STAGES[i]!;
      this.progress.currentStage = stage;
      this.progress.currentLabel = MASTER_STAGE_LABELS[stage];
      this.progress.completed = i + 1;
      this.progress.percent = Math.round(((i + 1) / MASTER_STAGES.length) * 94);
      this.resumeStageIndex = i;
      this.emitSection(stage, assembled);
      this.emitBus("production.progress", { percent: this.progress.percent, label: this.progress.currentLabel });
      saveMemory(assembled.projectId, {
        masterId: assembled.masterId,
        stage,
        percent: this.progress.percent,
        status: "running",
      });
      this.emit();
      await delay(18);
    }

    assembled.status = "review";
    assembled.updatedAt = new Date().toISOString();
    this.pkg = assembled;
    this.reviewOpen = true;
    saveEntry({ current: assembled, history: this.historyPkgs });
    saveMemory(assembled.projectId, {
      masterId: assembled.masterId,
      stage: "saved",
      percent: 100,
      status: "review",
    });

    this.progress = {
      total: MASTER_STAGES.length,
      completed: MASTER_STAGES.length,
      percent: 100,
      currentLabel: MASTER_STAGE_LABELS.saved,
      currentStage: "saved",
      running: false,
    };
    this.resumeStageIndex = MASTER_STAGES.length;
    this.recommendation = "Draft ready. Review claims, then confirm. Confirmation is required before Phase 3 completes.";
    this.emitAction("MasterIntelligenceReviewOpened", {
      projectId: assembled.projectId,
      version: assembled.versionLabel,
      score: assembled.scores.overall,
    });
    this.emitBus("product-analysis.completed", {
      projectId: assembled.projectId,
      phase: "master-intelligence-draft",
      score: assembled.scores.overall,
    });
    this.markDirty();
    this.emit();
    return assembled;
  }

  setClaimDecision(id: string, decision: ClaimSafetyEntry["userDecision"]): void {
    if (!this.pkg || this.pkg.userConfirmed) return;
    this.pkg = {
      ...this.pkg,
      claimSafety: this.pkg.claimSafety.map((c) => (c.id === id ? { ...c, userDecision: decision } : c)),
      updatedAt: new Date().toISOString(),
    };
    saveEntry({ current: this.pkg, history: this.historyPkgs });
    saveMemory(this.pkg.projectId, { masterId: this.pkg.masterId, claimId: id, decision });
    this.markDirty();
    this.emit();
  }

  confirm(): MasterProductIntelligence {
    if (!this.pkg) throw new Error("Compile Master Intelligence before confirming");
    if (this.pkg.status !== "review" && this.pkg.status !== "draft") {
      throw new Error("Review the draft before confirming");
    }
    const confirmed: MasterProductIntelligence = {
      ...this.pkg,
      status: "confirmed",
      userConfirmed: true,
      confirmedAt: new Date().toISOString(),
      phase3Complete: true,
      readyForContentProduction: true,
      updatedAt: new Date().toISOString(),
    };
    const history = [...this.historyPkgs, this.pkg];
    this.historyPkgs = history;
    this.pkg = confirmed;
    this.reviewOpen = false;
    this.handoffReady = true;
    saveEntry({ current: confirmed, history });
    saveMemory(confirmed.projectId, {
      masterId: confirmed.masterId,
      status: "confirmed",
      version: confirmed.versionLabel,
    });

    const handoff: ContentProductionHandoffPayload = {
      version: 1,
      step: "ready-for-content-production",
      phase3Complete: true,
      projectId: confirmed.projectId,
      projectName: confirmed.projectName,
      master: confirmed,
      research: this.research,
      deepIntelligence: this.intel,
      visualAnalysis: this.visual,
      productionPackage: this.production,
      productProfile: this.profile,
      marketingBrief: this.brief,
      preparedAt: new Date().toISOString(),
    };
    localStorage.setItem(MASTER_HANDOFF_KEY, JSON.stringify(handoff));

    this.recommendation = `Phase 3 complete. Master Intelligence ${confirmed.versionLabel} is READY FOR CONTENT PRODUCTION. Story/script/video are not started.`;
    this.emitAction("MasterIntelligenceConfirmed", {
      projectId: confirmed.projectId,
      version: confirmed.versionLabel,
      masterId: confirmed.masterId,
    });
    this.emitAction("MasterIntelligenceVersionCreated", {
      version: confirmed.versionLabel,
      masterId: confirmed.masterId,
    });
    this.emitAction("MasterIntelligenceCompleted", {
      projectId: confirmed.projectId,
      phase3Complete: true,
      readyForContentProduction: true,
    });
    this.emitBus("product-analysis.completed", {
      projectId: confirmed.projectId,
      phase: "phase-3-complete",
      version: confirmed.versionLabel,
    });
    this.markDirty();
    this.emit();
    return confirmed;
  }

  private emitSection(stage: MasterStage, pkg: MasterProductIntelligence): void {
    const payload = { projectId: pkg.projectId, stage, version: pkg.versionLabel };
    this.emitAction("MasterIntelligenceSectionCompleted", payload);
    if (stage === "claim-safety") this.emitAction("ClaimSafetyGenerated", { count: pkg.claimSafety.length, ...payload });
    if (stage === "creative") this.emitAction("CreativeBriefGenerated", { note: pkg.creativeDirection.note, ...payload });
  }

  private emitAction(action: string, payload: Record<string, unknown>): void {
    this.emitEvents?.("state.shared", { action, module: "master-intelligence", ...payload });
    this.emitEvents?.("product.updated", { action, module: "master-intelligence", ...payload });
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

export const masterIntelligenceEngine = new MasterIntelligenceEngine();

export function loadContentProductionHandoff(): ContentProductionHandoffPayload | null {
  try {
    const raw = JSON.parse(localStorage.getItem(MASTER_HANDOFF_KEY) ?? "null") as ContentProductionHandoffPayload | null;
    return raw?.version === 1 && raw.step === "ready-for-content-production" ? raw : null;
  } catch {
    return null;
  }
}
