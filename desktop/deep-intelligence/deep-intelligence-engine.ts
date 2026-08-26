import { loadStep2DeepIntelHandoff } from "../visual-analysis/visual-analysis-engine";
import type { Step2DeepIntelHandoffPayload, VisualProductAnalysisPackage } from "../visual-analysis/types";
import { VISUAL_STORE_KEY } from "../visual-analysis/types";
import { loadProductionPackage } from "../product-validation/validation-engine";
import type { ProductionInputPackage } from "../product-validation/types";
import type { ProductProfile } from "../product-profile/types";
import { fetchProductIntelligence } from "../visual-analysis/api";
import type { ServerProductIntel } from "../visual-analysis/analyze";
import { assembleIntelligence } from "./assemble";
import type {
  DeepIntelligenceSnapshot,
  IntelligenceProgress,
  IntelligenceStage,
  IntelligenceVersionMeta,
  ProductIntelligencePackage,
  ReviewStatus,
  Step3MarketIntelHandoffPayload,
} from "./types";
import { INTEL_HANDOFF_KEY, INTEL_STAGE_LABELS, INTEL_STAGES, INTEL_STORE_KEY } from "./types";

type NotifyFn = (
  tone: "success" | "warning" | "error" | "info",
  title: string,
  detail: string,
  category?: "information" | "warnings" | "errors" | "production-complete" | "updates" | "ai-suggestions",
) => void;

type Listener = (snap: DeepIntelligenceSnapshot) => void;

interface StoreEntry {
  current: ProductIntelligencePackage;
  history: ProductIntelligencePackage[];
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadStore(): Record<string, StoreEntry> {
  try {
    return JSON.parse(localStorage.getItem(INTEL_STORE_KEY) ?? "{}") as Record<string, StoreEntry>;
  } catch {
    return {};
  }
}

function saveEntry(entry: StoreEntry): void {
  const map = loadStore();
  map[entry.current.projectId] = entry;
  localStorage.setItem(INTEL_STORE_KEY, JSON.stringify(map));
}

function loadVisualStore(projectId: string): VisualProductAnalysisPackage | null {
  try {
    const map = JSON.parse(localStorage.getItem(VISUAL_STORE_KEY) ?? "{}") as Record<string, VisualProductAnalysisPackage>;
    return map[projectId] ?? null;
  } catch {
    return null;
  }
}

function emptyProgress(): IntelligenceProgress {
  return { total: INTEL_STAGES.length, completed: 0, percent: 0, currentLabel: "Idle", currentStage: null, running: false };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class DeepIntelligenceEngine {
  private pkg: ProductIntelligencePackage | null = null;
  private historyPkgs: ProductIntelligencePackage[] = [];
  private handoff: Step2DeepIntelHandoffPayload | null = null;
  private production: ProductionInputPackage | null = null;
  private visual: VisualProductAnalysisPackage | null = null;
  private profile: ProductProfile | null = null;
  private progress = emptyProgress();
  private listeners = new Set<Listener>();
  private notify: NotifyFn | null = null;
  private emitEvents: ((type: string, payload: Record<string, unknown>) => void) | null = null;
  private handoffReady = false;
  private serviceAvailable = true;
  private recommendation = "Complete Phase 3 Step 1 Visual Analysis, then run Deep Product Intelligence.";
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

  snapshot(): DeepIntelligenceSnapshot {
    return {
      version: 1,
      package: this.pkg,
      progress: { ...this.progress },
      recommendation: this.recommendation,
      handoffReady: this.handoffReady,
      serviceAvailable: this.serviceAvailable,
      updatedAt: new Date().toISOString(),
    };
  }

  buildAiMeContext() {
    const p = this.pkg;
    if (this.progress.running) {
      return {
        running: true,
        explanation: [
          `Deep Product Intelligence is cross-validating — ${this.progress.percent}%.`,
          this.progress.currentLabel,
          "Verified Product Profile facts remain authoritative.",
        ].join(" "),
        recommendation: this.recommendation,
      };
    }
    if (!p) {
      return {
        running: false,
        explanation: "Deep Product Intelligence has not started. Load the Visual Product Analysis Package from Step 1 first.",
        recommendation: this.recommendation,
      };
    }
    const conflicts = p.crossValidation.filter((c) => c.mark === "conflict").length
      + p.logoTextChecks.filter((c) => c.mark === "conflict").length;
    const explanation = [
      `Product “${p.productName}” intelligence score ${p.scores.overall}%.`,
      `We know for certain: ${p.verifiedFacts.slice(0, 4).map((f) => f.field).join(", ")}.`,
      `AI visually observed: ${p.visualObservations.slice(0, 3).map((f) => f.field).join(", ")}.`,
      p.inferences.length
        ? `Inferences (not verified): ${p.inferences.map((i) => `${i.value} (${Math.round(i.confidence * 100)}%)`).join("; ")}.`
        : "No AI inferences recorded.",
      conflicts ? `${conflicts} conflict(s) require review — user values were not overwritten.` : "No hard conflicts with the Product Profile.",
      p.unknown.length ? `Unknown/unverified: ${p.unknown.slice(0, 2).map((u) => u.field).join("; ")}.` : "",
      "Claims that are only inferences should not yet be used as product facts.",
      this.recommendation,
    ].filter(Boolean).join(" ");
    return {
      projectId: p.projectId,
      overallScore: p.scores.overall,
      conflicts,
      versionLabel: p.versionLabel,
      running: false,
      canContinue: p.status === "complete" || p.status === "partial",
      recommendation: this.recommendation,
      explanation,
    };
  }

  hydrate(): boolean {
    const handoff = loadStep2DeepIntelHandoff();
    const production = loadProductionPackage();
    this.handoff = handoff;
    this.production = production ?? handoff?.productionPackage ?? null;

    const visual = handoff?.visualAnalysis
      ?? (production ? loadVisualStore(production.projectId) : null)
      ?? Object.values((() => {
        try {
          return JSON.parse(localStorage.getItem(VISUAL_STORE_KEY) ?? "{}") as Record<string, VisualProductAnalysisPackage>;
        } catch {
          return {};
        }
      })())[0]
      ?? null;

    if (!visual) {
      this.recommendation = "No Visual Product Analysis Package found. Complete Phase 3 Step 1 first.";
      this.emit();
      return false;
    }

    this.visual = visual;
    this.profile = handoff?.productionPackage?.productProfile
      ?? production?.productProfile
      ?? visual.productProfile;
    if (!this.profile) {
      this.recommendation = "Product Profile missing from the analysis package.";
      this.emit();
      return false;
    }

    const stored = loadStore()[visual.projectId];
    if (stored?.current) {
      if (stored.current.status === "running") {
        stored.current.status = "complete";
        stored.current.updatedAt = new Date().toISOString();
        saveEntry(stored);
      }
      this.pkg = stored.current;
      this.historyPkgs = stored.history ?? [];
      this.resumeStageIndex = INTEL_STAGES.length - 1;
      this.recommendation = `Restored Product Intelligence ${stored.current.versionLabel} — re-run to refresh or save the Master Product Intelligence Input.`;
      this.emitAction("ProductIntelligenceUpdated", { restored: true, projectId: visual.projectId });
      this.emit();
      return true;
    }

    this.recommendation = `Ready to cross-validate “${this.profile.fields.name || visual.productName}” (${visual.aggregate.imagesTotal} images).`;
    this.emitAction("ProductIntelligenceStarted", { projectId: visual.projectId, phase: "hydrated" });
    this.emit();
    return true;
  }

  async run(options?: { force?: boolean }): Promise<ProductIntelligencePackage> {
    if (!this.visual || !this.profile) {
      if (!this.hydrate()) throw new Error("Visual Product Analysis Package required");
    }
    if (this.progress.running) throw new Error("Intelligence already running");

    const visual = this.visual!;
    const profile = this.profile!;
    this.progress = {
      ...emptyProgress(),
      running: true,
      currentStage: "loaded",
      currentLabel: INTEL_STAGE_LABELS.loaded,
      completed: 1,
      percent: 5,
    };
    this.emitAction("ProductIntelligenceStarted", { projectId: profile.projectId });
    this.emitBus("product-analysis.started", { projectId: profile.projectId, step: "phase-3-step-2" });
    this.emit();

    let intel: ServerProductIntel | null = null;
    this.serviceAvailable = true;
    try {
      intel = await fetchProductIntelligence(profile.projectId);
      if (!intel) {
        this.serviceAvailable = false;
        this.notify?.(
          "warning",
          "Product Intelligence service unavailable",
          "Using Visual Analysis Package + Product Profile locally. Retry when the service is online.",
          "warnings",
        );
      }
    } catch (error) {
      this.serviceAvailable = false;
      this.notify?.(
        "warning",
        "ANALYSIS SERVICE UNAVAILABLE",
        error instanceof Error ? error.message : "Falling back to local cross-validation",
        "warnings",
      );
    }

    const prev = this.pkg;
    const versionNumber = options?.force && prev ? prev.versionNumber + 1 : prev?.versionNumber ?? 1;
    const versionLabel = `${versionNumber}.0`;
    const historyMeta: IntelligenceVersionMeta[] = [
      ...(prev
        ? [{
            versionLabel: prev.versionLabel,
            versionNumber: prev.versionNumber,
            intelligenceId: prev.intelligenceId,
            overallScore: prev.scores.overall,
            createdAt: prev.createdAt,
          }]
        : []),
      ...((prev?.history ?? []).slice(0, 8)),
    ];

    if (prev && options?.force) {
      this.historyPkgs = [prev, ...this.historyPkgs].slice(0, 5);
    }

    const assembled = assembleIntelligence({
      intelligenceId: prev && !options?.force ? prev.intelligenceId : uid("pint"),
      versionNumber,
      versionLabel,
      history: historyMeta,
      profile,
      visual,
      intel,
      productionPackageRef: this.production?.packageId ?? this.handoff?.productionPackage?.packageId ?? null,
    });

    if (prev && !options?.force) {
      const prevXv = new Map(prev.crossValidation.map((c) => [c.id, c.reviewStatus]));
      assembled.crossValidation = assembled.crossValidation.map((c) => ({
        ...c,
        reviewStatus: prevXv.get(c.id) ?? c.reviewStatus,
      }));
    }

    assembled.status = "running";
    this.pkg = assembled;
    saveEntry({ current: assembled, history: this.historyPkgs });
    this.markDirty();

    const start = options?.force ? 1 : Math.max(1, this.resumeStageIndex);
    for (let i = start; i < INTEL_STAGES.length - 1; i++) {
      const stage = INTEL_STAGES[i]!;
      this.progress.currentStage = stage;
      this.progress.currentLabel = INTEL_STAGE_LABELS[stage];
      this.progress.completed = i + 1;
      this.progress.percent = Math.round(((i + 1) / INTEL_STAGES.length) * 92);
      this.resumeStageIndex = i;
      if (stage === "identity") this.emitAction("ProductIdentityAnalyzed", { projectId: profile.projectId });
      if (stage === "cross-validation") {
        this.emitAction("ProductCrossValidationStarted", { projectId: profile.projectId });
      }
      this.emitBus("production.progress", { percent: this.progress.percent, label: this.progress.currentLabel });
      this.emit();
      await delay(22);
    }

    if (assembled.crossValidation.some((c) => c.mark === "conflict")
      || assembled.logoTextChecks.some((c) => c.mark === "conflict")) {
      this.emitAction("ProductConflictDetected", {
        count: assembled.warnings.filter((w) => w.severity !== "info").length,
      });
    }
    this.emitAction("ProductCrossValidationCompleted", { overall: assembled.scores.overall });
    this.emitAction("ProductFeatureDetected", { count: assembled.features.length });
    this.emitAction("ProductDifferentiatorDetected", { count: assembled.differentiators.length });
    this.emitAction("ProductUncertaintyDetected", { count: assembled.unknown.length });

    assembled.status = "complete";
    assembled.updatedAt = new Date().toISOString();
    this.pkg = assembled;
    saveEntry({ current: assembled, history: this.historyPkgs });

    this.progress = {
      total: INTEL_STAGES.length,
      completed: INTEL_STAGES.length,
      percent: 100,
      currentLabel: INTEL_STAGE_LABELS.saved,
      currentStage: "saved",
      running: false,
    };
    this.resumeStageIndex = INTEL_STAGES.length;
    this.recommendation = "Product Intelligence complete — review conflicts, then save the Master Product Intelligence Input for Step 3 (not started).";
    this.emitAction("ProductIntelligenceCompleted", {
      projectId: assembled.projectId,
      score: assembled.scores.overall,
      version: assembled.versionLabel,
    });
    this.emitBus("product-analysis.completed", {
      projectId: assembled.projectId,
      phase: "deep-intelligence",
      score: assembled.scores.overall,
    });
    this.markDirty();
    this.emit();
    return assembled;
  }

  setCrossReview(id: string, status: ReviewStatus): void {
    if (!this.pkg) return;
    this.pkg = {
      ...this.pkg,
      crossValidation: this.pkg.crossValidation.map((c) => (c.id === id ? { ...c, reviewStatus: status } : c)),
      logoTextChecks: this.pkg.logoTextChecks.map((c) => (c.id === id ? { ...c, reviewStatus: status } : c)),
      specificationChecks: this.pkg.specificationChecks.map((c) => (c.id === id ? { ...c, reviewStatus: status } : c)),
      updatedAt: new Date().toISOString(),
    };
    saveEntry({ current: this.pkg, history: this.historyPkgs });
    this.markDirty();
    this.emit();
  }

  setItemReview(id: string, status: ReviewStatus): void {
    if (!this.pkg) return;
    const mapItems = (items: typeof this.pkg.verifiedFacts) =>
      items.map((i) => (i.id === id ? { ...i, reviewStatus: status } : i));
    this.pkg = {
      ...this.pkg,
      inferences: mapItems(this.pkg.inferences),
      differentiators: mapItems(this.pkg.differentiators),
      benefits: mapItems(this.pkg.benefits),
      unknown: mapItems(this.pkg.unknown),
      updatedAt: new Date().toISOString(),
    };
    saveEntry({ current: this.pkg, history: this.historyPkgs });
    this.markDirty();
    this.emit();
  }

  async retry(): Promise<ProductIntelligencePackage> {
    return this.run({ force: true });
  }

  continueToStep3(): Step3MarketIntelHandoffPayload {
    if (!this.pkg || (this.pkg.status !== "complete" && this.pkg.status !== "partial")) {
      throw new Error("Complete Product Intelligence before continuing");
    }
    const handoff: Step3MarketIntelHandoffPayload = {
      version: 1,
      step: "step-3-market-customer-intelligence",
      projectId: this.pkg.projectId,
      projectName: this.pkg.projectName,
      masterIntelligence: this.pkg,
      visualAnalysis: this.visual,
      productionPackage: this.production ?? this.handoff?.productionPackage ?? null,
      productProfile: this.profile,
      preparedAt: new Date().toISOString(),
    };
    localStorage.setItem(INTEL_HANDOFF_KEY, JSON.stringify(handoff));
    this.handoffReady = true;
    this.emitAction("ProductIntelligenceCompleted", { handoff: true, step: "step-3" });
    this.emit();
    return handoff;
  }

  private emitAction(action: string, payload: Record<string, unknown>): void {
    this.emitEvents?.("state.shared", { action, module: "deep-intelligence", ...payload });
    this.emitEvents?.("product.updated", { action, module: "deep-intelligence", ...payload });
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

export const deepIntelligenceEngine = new DeepIntelligenceEngine();

export function loadStep3MarketIntelHandoff(): Step3MarketIntelHandoffPayload | null {
  try {
    const raw = JSON.parse(localStorage.getItem(INTEL_HANDOFF_KEY) ?? "null") as Step3MarketIntelHandoffPayload | null;
    return raw?.version === 1 ? raw : null;
  } catch {
    return null;
  }
}

export type { IntelligenceStage };
