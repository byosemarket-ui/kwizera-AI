import { resolveBoundProject } from "../product-creation/workflow";
import {
  analyzeMarketingIntelligence,
  analyzeProductIntelligence,
  generateCreativePlan,
  getCreativePlan,
  getMarketingIntelligence,
  getProductIntelligence,
  updateCreativePlan,
  type CreativePlanDto,
  type MarketingIntelligenceDto,
  type ProductIntelligenceDto,
} from "./live-api";
import type {
  DeepIntelligenceSnapshot,
  IntelligenceProgress,
  IntelligenceStage,
  ProductIntelligencePackage,
  ReviewStatus,
  Step3MarketIntelHandoffPayload,
} from "./types";
import { INTEL_HANDOFF_KEY, INTEL_STAGES, INTEL_STORE_KEY } from "./types";

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

function emptyProgress(): IntelligenceProgress {
  return { total: INTEL_STAGES.length, completed: 0, percent: 0, currentLabel: "Idle", currentStage: null, running: false };
}

export class DeepIntelligenceEngine {
  private pkg: ProductIntelligencePackage | null = null;
  private historyPkgs: ProductIntelligencePackage[] = [];
  private progress = emptyProgress();
  private listeners = new Set<Listener>();
  private notify: NotifyFn | null = null;
  private emitEvents: ((type: string, payload: Record<string, unknown>) => void) | null = null;
  private handoffReady = false;
  private serviceAvailable = true;
  private recommendation = "Open a project with a product and images, then run Product Intelligence.";
  private projectId: string | null = null;
  private projectName = "";
  private analysisState = "not-analyzed";
  private product: ProductIntelligenceDto | null = null;
  private marketing: MarketingIntelligenceDto | null = null;
  private plan: CreativePlanDto | null = null;
  private limitation: string | null = null;

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
      projectId: this.projectId,
      projectName: this.projectName,
      analysisState: this.analysisState,
      product: this.product,
      marketing: this.marketing,
      plan: this.plan,
      limitation: this.limitation,
    };
  }

  buildAiMeContext() {
    if (this.progress.running) {
      return {
        running: true,
        explanation: `Product Intelligence is running — ${this.progress.percent}%. ${this.progress.currentLabel}`,
        recommendation: this.recommendation,
      };
    }
    if (!this.product) {
      return {
        running: false,
        explanation: "Product Intelligence has not been analyzed for the active project.",
        recommendation: this.recommendation,
      };
    }
    return {
      projectId: this.product.projectId,
      running: false,
      canContinue: Boolean(this.plan),
      recommendation: this.recommendation,
      explanation: [
        `Product “${this.product.productName}” analysis is ${this.analysisState}.`,
        `User facts: ${(this.product.userFacts ?? []).length}. Image observations: ${(this.product.imageObservations ?? []).length}. Inferences: ${(this.product.inferences ?? []).length}.`,
        this.plan ? `Creative Plan v${this.plan.version} has ${this.plan.scenes.length} scene(s).` : "Creative Plan is not generated yet.",
        this.limitation ?? "User facts, image observations, inferences, and marketing recommendations stay labeled separately.",
      ].join(" "),
    };
  }

  async hydrate(): Promise<boolean> {
    const bound = await resolveBoundProject();
    if (!bound) {
      this.recommendation = "No active project. Create or open a project, add a product image, then run Product Intelligence.";
      this.emit();
      return false;
    }
    this.projectId = bound.projectId;
    this.projectName = bound.projectName;
    try {
      const [product, marketing, plan] = await Promise.all([
        getProductIntelligence(bound.projectId),
        getMarketingIntelligence(bound.projectId).catch(() => ({ profile: null })),
        getCreativePlan(bound.projectId).catch(() => ({ plan: null })),
      ]);
      this.product = product.profile;
      this.analysisState = product.analysisState || (product.profile ? "ready" : "not-analyzed");
      this.marketing = marketing.profile;
      this.plan = plan.plan;
      this.serviceAvailable = true;
      this.limitation = this.product?.aiInferenceStatus === "IMAGE_ANALYSIS_UNAVAILABLE"
        ? "Advanced visual identity is unavailable. Shown results are user facts, image observations, and labeled inferences."
        : null;
      this.recommendation = this.product
        ? `Restored Product Intelligence for “${this.product.productName}”. Re-run to refresh, or edit the Creative Plan.`
        : `Ready to analyze “${bound.projectName}”. This uses real product, image, marketing, and planning engines.`;
      this.emit();
      return true;
    } catch (error) {
      this.serviceAvailable = false;
      this.limitation = error instanceof Error ? error.message : "Product Intelligence API unavailable";
      this.recommendation = this.limitation;
      this.emit();
      return false;
    }
  }

  async run(options?: { force?: boolean }): Promise<ProductIntelligencePackage | null> {
    if (!this.projectId) {
      const ok = await this.hydrate();
      if (!ok || !this.projectId) throw new Error("Open a project before running Product Intelligence");
    }
    if (this.progress.running) throw new Error("Intelligence already running");
    const projectId = this.projectId!;
    this.analysisState = "analyzing";
    this.progress = { ...emptyProgress(), running: true, currentStage: "loaded", currentLabel: "Analyzing product", completed: 1, percent: 8 };
    this.emitAction("ProductIntelligenceStarted", { projectId });
    this.emitBus("product-analysis.started", { projectId, step: "step-7" });
    this.emit();

    try {
      this.progress = { ...this.progress, currentLabel: "Product Intelligence", percent: 25, completed: 3 };
      this.emit();
      const product = await analyzeProductIntelligence(projectId);
      this.product = product.profile;
      this.analysisState = product.analysisState || product.profile.analysisState || "ready";
      this.limitation = this.product?.aiInferenceStatus === "IMAGE_ANALYSIS_UNAVAILABLE"
        ? "Advanced visual identity is unavailable. Shown results are user facts, image observations, and labeled inferences."
        : null;

      this.progress = { ...this.progress, currentLabel: "Marketing Intelligence", percent: 55, completed: 6 };
      this.emit();
      try {
        const marketing = await analyzeMarketingIntelligence(projectId);
        this.marketing = marketing.profile;
      } catch (error) {
        this.marketing = (await getMarketingIntelligence(projectId).catch(() => ({ profile: null }))).profile;
        this.notify?.(
          "warning",
          "Marketing Intelligence limited",
          error instanceof Error ? error.message : "Marketing analysis returned a limitation",
          "warnings",
        );
      }

      this.progress = { ...this.progress, currentLabel: "Creative Plan", percent: 80, completed: 10 };
      this.emit();
      if (options?.force || !this.plan) {
        const generated = await generateCreativePlan(projectId);
        this.plan = generated.plan;
      } else {
        this.plan = (await getCreativePlan(projectId)).plan;
      }

      this.progress = { total: INTEL_STAGES.length, completed: INTEL_STAGES.length, percent: 100, currentLabel: "Saved", currentStage: "saved", running: false };
      this.recommendation = `Product Intelligence ${this.analysisState.replace("-", " ")} for “${this.product?.productName}”. Creative Plan v${this.plan?.version ?? "—"} is persisted.`;
      this.emitBus("product-analysis.completed", { projectId, phase: "product-intelligence" });
      this.markDirty();
      this.emit();
      return this.pkg;
    } catch (error) {
      this.progress.running = false;
      this.analysisState = "failed";
      this.limitation = error instanceof Error ? error.message : "Product Intelligence failed";
      this.recommendation = this.limitation;
      this.emit();
      throw error;
    }
  }

  async savePlanEdits(changes: Record<string, unknown>): Promise<CreativePlanDto> {
    if (!this.projectId) throw new Error("Open a project before editing the Creative Plan");
    const result = await updateCreativePlan(this.projectId, changes);
    this.plan = result.plan;
    this.recommendation = `Creative Plan v${result.plan.version} saved. User edits were persisted.`;
    this.markDirty();
    this.emit();
    return result.plan;
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

  async retry(): Promise<ProductIntelligencePackage | null> {
    return this.run({ force: true });
  }

  continueToStep3(): Step3MarketIntelHandoffPayload {
    if (!this.product) throw new Error("Complete Product Intelligence before continuing");
    const handoff: Step3MarketIntelHandoffPayload = {
      version: 1,
      step: "step-3-market-customer-intelligence",
      projectId: this.product.projectId,
      projectName: this.projectName || this.product.productName,
      masterIntelligence: this.pkg ?? {
        version: 1,
        intelligenceId: this.product.id,
        versionLabel: this.product.analysisVersion ?? "step7",
        versionNumber: 1,
        engineId: "product-intelligence",
        projectId: this.product.projectId,
        productId: this.product.productId ?? this.product.projectId,
        projectName: this.projectName,
        productName: this.product.productName,
        visualAnalysisId: null,
        productionPackageRef: null,
        identity: [],
        verifiedFacts: [],
        visualObservations: [],
        inferences: [],
        features: [],
        characteristics: [],
        differentiators: [],
        benefits: [],
        unknown: [],
        variants: [],
        specificationChecks: [],
        logoTextChecks: [],
        crossValidation: [],
        consistency: { product: "uncertain", images: "uncertain", specifications: "uncertain", variants: "uncertain", note: "Live STEP 7 profile", confidence: this.product.quality.confidence },
        coverage: [],
        coveragePercent: 0,
        scores: {
          identity: this.product.quality.score,
          visualUnderstanding: this.product.quality.score,
          specificationSupport: 0,
          imageCoverage: this.product.viewCount,
          consistency: this.product.quality.confidence,
          overall: this.product.quality.score,
          explanation: this.product.identifiedAs,
        },
        warnings: [],
        history: [],
        status: this.analysisState === "ready" ? "complete" : "partial",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      visualAnalysis: null,
      productionPackage: null,
      productProfile: null,
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
