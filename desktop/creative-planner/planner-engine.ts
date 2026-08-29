import { loadStep2CreativePlannerHandoff } from "../marketing-strategy/strategy-engine";
import { resolveBoundProject } from "../product-creation/workflow";
import {
  generateCreativePlan,
  getCreativePlan,
  type CreativePlanDto,
} from "../deep-intelligence/live-api";
import type { Step2CreativePlannerHandoffPayload } from "../marketing-strategy/types";
import type { MasterMarketingStrategy } from "../marketing-strategy/types";
import type { MasterProductIntelligence } from "../master-intelligence/types";
import type { MarketingProductionBrief } from "../marketing-input/types";
import type { ProductImageSet } from "../image-organization/types";
import { ORG_STORE_KEY } from "../image-organization/types";
import { assembleCreativeBlueprint, buildAiMePlannerExplanation, rebuildScene } from "./assemble";
import type {
  CreativePlannerSnapshot,
  MasterCreativeBlueprint,
  PlannerProgress,
  PlannerStage,
  Step3PreProductionHandoffPayload,
} from "./types";
import { PLANNER_HANDOFF_KEY, PLANNER_MEMORY_KEY, PLANNER_STAGE_LABELS, PLANNER_STAGES, PLANNER_STORE_KEY } from "./types";

type NotifyFn = (
  tone: "success" | "warning" | "error" | "info",
  title: string,
  detail: string,
  category?: "information" | "warnings" | "errors" | "production-complete" | "updates" | "ai-suggestions",
) => void;
type Listener = (snap: CreativePlannerSnapshot) => void;

interface StoreEntry {
  current: MasterCreativeBlueprint;
  history: MasterCreativeBlueprint[];
}

function loadStore(): Record<string, StoreEntry> {
  try {
    return JSON.parse(localStorage.getItem(PLANNER_STORE_KEY) ?? "{}") as Record<string, StoreEntry>;
  } catch {
    return {};
  }
}

function saveEntry(entry: StoreEntry): void {
  const map = loadStore();
  map[entry.current.projectId] = entry;
  localStorage.setItem(PLANNER_STORE_KEY, JSON.stringify(map));
}

function loadMemory(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(PLANNER_MEMORY_KEY) ?? "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function saveMemory(projectId: string, payload: Record<string, unknown>): void {
  const mem = loadMemory();
  mem[projectId] = { ...payload, updatedAt: new Date().toISOString() };
  localStorage.setItem(PLANNER_MEMORY_KEY, JSON.stringify(mem));
}

function loadImageSet(projectId: string): ProductImageSet | null {
  try {
    const map = JSON.parse(localStorage.getItem(ORG_STORE_KEY) ?? "{}") as Record<string, ProductImageSet>;
    return map[projectId] ?? null;
  } catch {
    return null;
  }
}

function emptyProgress(): PlannerProgress {
  return { total: PLANNER_STAGES.length, completed: 0, percent: 0, currentLabel: "Idle", currentStage: null, running: false };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class CreativePlannerEngine {
  private pkg: MasterCreativeBlueprint | null = null;
  private historyPkgs: MasterCreativeBlueprint[] = [];
  private step2: Step2CreativePlannerHandoffPayload | null = null;
  private strategy: MasterMarketingStrategy | null = null;
  private master: MasterProductIntelligence | null = null;
  private brief: MarketingProductionBrief | null = null;
  private imageSet: ProductImageSet | null = null;
  private progress = emptyProgress();
  private listeners = new Set<Listener>();
  private notify: NotifyFn | null = null;
  private emitEvents: ((type: string, payload: Record<string, unknown>) => void) | null = null;
  private handoffReady = false;
  private reviewOpen = false;
  private recommendation = "Confirm Marketing Strategy (Phase 4 Step 1), then compile the Creative Blueprint.";
  private resumeStageIndex = 0;
  private livePlan: CreativePlanDto | null = null;
  private projectId: string | null = null;

  setNotify(fn: NotifyFn | null): void { this.notify = fn; }
  setEventEmitter(fn: ((type: string, payload: Record<string, unknown>) => void) | null): void { this.emitEvents = fn; }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): CreativePlannerSnapshot {
    return {
      version: 1,
      package: this.pkg,
      progress: { ...this.progress },
      recommendation: this.recommendation,
      handoffReady: this.handoffReady,
      reviewOpen: this.reviewOpen,
      updatedAt: new Date().toISOString(),
      livePlan: this.livePlan,
      projectId: this.projectId,
    };
  }

  buildAiMeContext() {
    if (this.progress.running) {
      return { running: true, explanation: `Creative planner compiling — ${this.progress.percent}%. ${this.progress.currentLabel}`, recommendation: this.recommendation };
    }
    if (!this.pkg) {
      return { running: false, explanation: "Creative Blueprint has not been compiled. Confirm Marketing Strategy first.", recommendation: this.recommendation };
    }
    return {
      projectId: this.pkg.projectId,
      confirmed: this.pkg.userConfirmed,
      readiness: this.pkg.validation.readinessPercent,
      running: false,
      canContinue: this.pkg.status === "draft" || this.pkg.status === "review",
      recommendation: this.recommendation,
      explanation: buildAiMePlannerExplanation(this.pkg),
    };
  }

  async hydrateLive(): Promise<void> {
    const bound = await resolveBoundProject();
    if (!bound) return;
    this.projectId = bound.projectId;
    try {
      this.livePlan = (await getCreativePlan(bound.projectId)).plan;
      if (this.livePlan && (!this.strategy || !this.strategy.userConfirmed)) {
        this.recommendation = `Live Creative Plan v${this.livePlan.version} restored for “${bound.projectName}”.`;
        this.emit();
      }
    } catch {
      this.livePlan = null;
    }
  }

  hydrate(): boolean {
    void this.hydrateLive();
    const handoff = loadStep2CreativePlannerHandoff();
    this.step2 = handoff;
    this.strategy = handoff?.strategy ?? null;
    this.master = handoff?.master ?? null;
    this.brief = handoff?.marketingBrief ?? null;
    if (!this.strategy || !this.strategy.userConfirmed) {
      this.recommendation = this.livePlan
        ? `Live Creative Plan v${this.livePlan.version} is loaded from the project. Generate or edit scenes here, or compile a Phase 4 blueprint after Marketing Strategy.`
        : "No confirmed Marketing Strategy. A live Creative Plan can still be generated from Product Intelligence.";
      this.emit();
      return Boolean(this.livePlan);
    }
    this.imageSet = loadImageSet(this.strategy.projectId) ?? this.brief?.productProfile?.productImageSet ?? null;
    const stored = loadStore()[this.strategy.projectId];
    if (stored?.current) {
      if (stored.current.status === "running") {
        stored.current.status = stored.current.userConfirmed ? "confirmed" : "draft";
        saveEntry(stored);
      }
      this.pkg = stored.current;
      this.historyPkgs = stored.history ?? [];
      this.handoffReady = stored.current.readyForPreProduction;
      this.reviewOpen = stored.current.status === "review" || stored.current.status === "draft";
      this.recommendation = stored.current.userConfirmed
        ? `Restored confirmed Creative Blueprint ${stored.current.versionLabel}. Step 3 is not started.`
        : `Restored Creative Blueprint draft ${stored.current.versionLabel}. Review and confirm.`;
      this.emitAction("CreativePlanningStarted", { restored: true, projectId: this.strategy.projectId });
      this.emit();
      return true;
    }
    this.recommendation = `Ready to plan story, script, and scenes for “${this.strategy.productName}”. No video will be rendered.`;
    this.emit();
    return true;
  }

  async run(options?: { force?: boolean }): Promise<MasterCreativeBlueprint> {
    if (!this.strategy) {
      if (this.projectId || (await resolveBoundProject())?.projectId) {
        const projectId = this.projectId || (await resolveBoundProject())!.projectId;
        this.projectId = projectId;
        this.progress = { total: PLANNER_STAGES.length, completed: 1, percent: 20, currentLabel: "Generating live Creative Plan", currentStage: "loaded", running: true };
        this.emit();
        this.livePlan = (await generateCreativePlan(projectId)).plan;
        this.progress = { total: PLANNER_STAGES.length, completed: PLANNER_STAGES.length, percent: 100, currentLabel: "Live plan saved", currentStage: "saved", running: false };
        this.recommendation = `Live Creative Plan v${this.livePlan.version} generated. No video was rendered.`;
        this.emit();
        if (this.pkg) return this.pkg;
        throw new Error("Live Creative Plan generated. Open Product Intelligence to review scenes, or confirm Marketing Strategy for the Phase 4 blueprint.");
      }
      if (!this.hydrate()) throw new Error("Confirmed Marketing Strategy required");
    }
    if (this.progress.running) throw new Error("Planning already running");
    const previousConfirmed = this.pkg?.userConfirmed ? this.pkg : this.historyPkgs.find((p) => p.userConfirmed) ?? null;
    const previous = options?.force ? previousConfirmed : (this.pkg?.userConfirmed ? this.pkg : previousConfirmed);

    this.progress = { total: PLANNER_STAGES.length, completed: 0, percent: 4, currentLabel: PLANNER_STAGE_LABELS.loaded, currentStage: "loaded", running: true };
    this.resumeStageIndex = 0;
    this.reviewOpen = false;
    this.emitAction("CreativePlanningStarted", { projectId: this.strategy?.projectId });
    this.emitBus("product-analysis.started", { phase: "creative-planner" });
    this.emit();

    let assembled: MasterCreativeBlueprint;
    try {
      assembled = assembleCreativeBlueprint({
        strategy: this.strategy!,
        master: this.master,
        brief: this.brief,
        imageSet: this.imageSet,
        previous: previous ?? null,
        primaryHookId: !options?.force ? this.pkg?.primaryHookId : null,
        selectedCtaId: !options?.force ? this.pkg?.selectedCtaId : null,
        selectedStoryAltId: !options?.force ? this.pkg?.selectedStoryAltId : null,
      });
      assembled.status = "running";
      this.pkg = assembled;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Planning failed";
      if (this.pkg) {
        this.pkg = { ...this.pkg, lastError: msg, status: "partial" };
        saveEntry({ current: this.pkg, history: this.historyPkgs });
      }
      this.progress.running = false;
      this.recommendation = `Planning failed: ${msg}. Successful sections were kept. Retry when ready.`;
      this.emit();
      throw error;
    }

    const start = options?.force ? 1 : Math.max(1, this.resumeStageIndex);
    for (let i = start; i < PLANNER_STAGES.length - 1; i++) {
      const stage = PLANNER_STAGES[i]!;
      this.progress.currentStage = stage;
      this.progress.currentLabel = PLANNER_STAGE_LABELS[stage];
      this.progress.completed = i + 1;
      this.progress.percent = Math.round(((i + 1) / PLANNER_STAGES.length) * 94);
      this.resumeStageIndex = i;
      this.emitSection(stage, assembled);
      this.emitBus("production.progress", { percent: this.progress.percent, label: this.progress.currentLabel });
      saveMemory(assembled.projectId, { blueprintId: assembled.blueprintId, stage, percent: this.progress.percent, status: "running" });
      this.emit();
      await delay(12);
    }

    assembled.status = "review";
    assembled.updatedAt = new Date().toISOString();
    this.pkg = assembled;
    this.reviewOpen = true;
    saveEntry({ current: assembled, history: this.historyPkgs });
    saveMemory(assembled.projectId, { blueprintId: assembled.blueprintId, stage: "saved", percent: 100, status: "review" });
    this.progress = { total: PLANNER_STAGES.length, completed: PLANNER_STAGES.length, percent: 100, currentLabel: PLANNER_STAGE_LABELS.saved, currentStage: "saved", running: false };
    this.resumeStageIndex = PLANNER_STAGES.length;
    this.recommendation = assembled.validation.canConfirm
      ? "Draft ready. Review story, script, and scenes, then confirm. Step 3 will not start."
      : `Readiness ${assembled.validation.readinessPercent}%. Blocking: ${assembled.validation.blocking.join(", ") || "none"}.`;
    this.emitAction("CreativeReviewOpened", { projectId: assembled.projectId, version: assembled.versionLabel });
    this.emitAction("CreativeValidationCompleted", { readiness: assembled.validation.readinessPercent, canConfirm: assembled.validation.canConfirm });
    this.markDirty();
    this.emit();
    return assembled;
  }

  setPrimaryHook(id: string): void {
    if (!this.pkg || this.pkg.userConfirmed) return;
    if (!this.pkg.hooks.some((h) => h.id === id)) return;
    this.pkg = { ...this.pkg, primaryHookId: id, updatedAt: new Date().toISOString() };
    this.persistDraft();
    this.emitAction("HookGenerated", { hookId: id, selected: true });
  }

  setCta(id: string): void {
    if (!this.pkg || this.pkg.userConfirmed) return;
    const alt = this.pkg.ctaAlternatives.find((c) => c.id === id);
    if (!alt) return;
    this.pkg = { ...this.pkg, selectedCtaId: id, cta: { ...this.pkg.cta, text: alt.text }, updatedAt: new Date().toISOString() };
    this.persistDraft();
  }

  setStoryAlt(id: string): void {
    if (!this.pkg || this.pkg.userConfirmed) return;
    if (!this.pkg.storyAlternatives.some((s) => s.id === id)) return;
    this.pkg = { ...this.pkg, selectedStoryAltId: id, updatedAt: new Date().toISOString() };
    this.persistDraft();
  }

  regenerateScene(sceneId: string): void {
    if (!this.pkg || this.pkg.userConfirmed || !this.strategy) return;
    this.pkg = rebuildScene(this.pkg, sceneId, {
      strategy: this.strategy,
      master: this.master,
      brief: this.brief,
      imageSet: this.imageSet,
    });
    this.persistDraft();
    this.emitAction("ScenePlanGenerated", { sceneId, partial: true });
  }

  confirm(): MasterCreativeBlueprint {
    if (!this.pkg) throw new Error("Compile the Creative Blueprint before confirming");
    if (this.pkg.status !== "review" && this.pkg.status !== "draft") throw new Error("Review the draft before confirming");
    this.emitAction("CreativeValidationStarted", { projectId: this.pkg.projectId });
    if (!this.pkg.validation.canConfirm) {
      throw new Error(`Cannot confirm: ${this.pkg.validation.blocking.join("; ")}`);
    }
    const confirmed: MasterCreativeBlueprint = {
      ...this.pkg,
      status: "confirmed",
      userConfirmed: true,
      confirmedAt: new Date().toISOString(),
      readyForPreProduction: true,
      lastError: null,
      updatedAt: new Date().toISOString(),
    };
    const history = [...this.historyPkgs, this.pkg];
    this.historyPkgs = history;
    this.pkg = confirmed;
    this.reviewOpen = false;
    this.handoffReady = true;
    saveEntry({ current: confirmed, history });
    saveMemory(confirmed.projectId, { blueprintId: confirmed.blueprintId, status: "confirmed", version: confirmed.versionLabel });

    const handoff: Step3PreProductionHandoffPayload = {
      version: 1,
      step: "step-3-final-production-plan",
      projectId: confirmed.projectId,
      projectName: confirmed.projectName,
      blueprint: confirmed,
      strategy: this.strategy,
      master: this.master,
      marketingBrief: this.brief,
      claimSafety: this.master?.claimSafety ?? this.step2?.claimSafety ?? [],
      productionRestrictions: this.master?.restrictions ?? confirmed.restrictions,
      preparedAt: new Date().toISOString(),
    };
    localStorage.setItem(PLANNER_HANDOFF_KEY, JSON.stringify(handoff));
    this.recommendation = `Creative Blueprint ${confirmed.versionLabel} confirmed. Ready for Master Production Plan (Phase 4 Step 3).`;
    this.emitAction("CreativeBlueprintConfirmed", { projectId: confirmed.projectId, version: confirmed.versionLabel });
    this.emitAction("CreativeBlueprintVersionCreated", { version: confirmed.versionLabel });
    this.emitAction("CreativePlanningCompleted", { projectId: confirmed.projectId, readyForPreProduction: true });
    this.emitBus("product-analysis.completed", { projectId: confirmed.projectId, phase: "creative-planner", version: confirmed.versionLabel });
    this.markDirty();
    this.emit();
    return confirmed;
  }

  private persistDraft(): void {
    if (!this.pkg) return;
    saveEntry({ current: this.pkg, history: this.historyPkgs });
    this.markDirty();
    this.emit();
  }

  private emitSection(stage: PlannerStage, pkg: MasterCreativeBlueprint): void {
    const payload = { projectId: pkg.projectId, stage, version: pkg.versionLabel };
    if (stage === "hooks") this.emitAction("HookGenerated", { count: pkg.hooks.length, ...payload });
    else if (stage === "story") this.emitAction("StoryGenerated", payload);
    else if (stage === "script") this.emitAction("ScriptGenerated", { lines: pkg.script.length, ...payload });
    else if (stage === "scenes") this.emitAction("ScenePlanGenerated", { count: pkg.scenes.length, ...payload });
    else if (stage === "assets") {
      this.emitAction("AssetMapped", { mapped: pkg.scenes.filter((s) => s.sourceAsset.status === "mapped").length, ...payload });
      if (pkg.missingAssets.length) this.emitAction("MissingAssetDetected", { count: pkg.missingAssets.length, ...payload });
    } else if (stage === "validation") this.emitAction("CreativeValidationStarted", payload);
  }

  private emitAction(action: string, payload: Record<string, unknown>): void {
    this.emitEvents?.("state.shared", { action, module: "creative-planner", ...payload });
    this.emitEvents?.("product.updated", { action, module: "creative-planner", ...payload });
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

export const creativePlannerEngine = new CreativePlannerEngine();

export function loadStep3PreProductionHandoff(): Step3PreProductionHandoffPayload | null {
  try {
    const raw = JSON.parse(localStorage.getItem(PLANNER_HANDOFF_KEY) ?? "null") as Step3PreProductionHandoffPayload | null;
    return raw?.version === 1 && raw.step === "step-3-final-production-plan" ? raw : null;
  } catch {
    return null;
  }
}
