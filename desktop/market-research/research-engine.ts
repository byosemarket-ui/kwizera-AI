import { loadStep3MarketIntelHandoff } from "../deep-intelligence/deep-intelligence-engine";
import type { Step3MarketIntelHandoffPayload, ProductIntelligencePackage } from "../deep-intelligence/types";
import type { ProductionInputPackage } from "../product-validation/types";
import type { MarketingProductionBrief } from "../marketing-input/types";
import { assembleResearchPackage } from "./assemble";
import { detectConnectivity } from "./connectivity";
import type {
  MarketResearchSnapshot,
  ResearchPackage,
  ResearchProgress,
  ResearchStage,
  SourceAction,
  Step4CreativeBriefHandoffPayload,
} from "./types";
import { RESEARCH_HANDOFF_KEY, RESEARCH_MEMORY_KEY, RESEARCH_STAGE_LABELS, RESEARCH_STAGES, RESEARCH_STORE_KEY } from "./types";
import { knowledgeDedupeKey } from "../../ai/knowledge-research-engine/product-market-research";

type NotifyFn = (
  tone: "success" | "warning" | "error" | "info",
  title: string,
  detail: string,
  category?: "information" | "warnings" | "errors" | "production-complete" | "updates" | "ai-suggestions",
) => void;
type Listener = (snap: MarketResearchSnapshot) => void;

interface StoreEntry {
  current: ResearchPackage;
  history: ResearchPackage[];
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function loadStore(): Record<string, StoreEntry> {
  try {
    return JSON.parse(localStorage.getItem(RESEARCH_STORE_KEY) ?? "{}") as Record<string, StoreEntry>;
  } catch {
    return {};
  }
}

function saveEntry(entry: StoreEntry): void {
  const map = loadStore();
  map[entry.current.projectId] = entry;
  localStorage.setItem(RESEARCH_STORE_KEY, JSON.stringify(map));
}

function loadMemory(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(RESEARCH_MEMORY_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function rememberKnowledge(pkg: ResearchPackage): void {
  const mem = loadMemory();
  for (const k of pkg.knowledge) {
    const key = knowledgeDedupeKey(k.claim);
    if (key && !mem[key]) mem[key] = k.id;
  }
  localStorage.setItem(RESEARCH_MEMORY_KEY, JSON.stringify(mem));
}

function emptyProgress(): ResearchProgress {
  return { total: RESEARCH_STAGES.length, completed: 0, percent: 0, currentLabel: "Idle", currentStage: null, running: false };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class MarketResearchEngine {
  private pkg: ResearchPackage | null = null;
  private historyPkgs: ResearchPackage[] = [];
  private step3: Step3MarketIntelHandoffPayload | null = null;
  private intel: ProductIntelligencePackage | null = null;
  private production: ProductionInputPackage | null = null;
  private brief: MarketingProductionBrief | null = null;
  private progress = emptyProgress();
  private internetAvailable: boolean | null = null;
  private listeners = new Set<Listener>();
  private notify: NotifyFn | null = null;
  private emitEvents: ((type: string, payload: Record<string, unknown>) => void) | null = null;
  private handoffReady = false;
  private recommendation = "Complete Phase 3 Step 2, then run Product Research.";

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

  snapshot(): MarketResearchSnapshot {
    return {
      version: 1,
      package: this.pkg,
      progress: { ...this.progress },
      internetAvailable: this.internetAvailable,
      researchMode: this.pkg?.researchMode ?? null,
      recommendation: this.recommendation,
      handoffReady: this.handoffReady,
      updatedAt: new Date().toISOString(),
    };
  }

  buildAiMeContext() {
    if (this.progress.running) {
      return {
        running: true,
        explanation: `Product research is running (${this.progress.percent}%). ${this.progress.currentLabel} Internet ${this.internetAvailable ? "AVAILABLE" : "UNAVAILABLE"}.`,
        recommendation: this.recommendation,
      };
    }
    if (!this.pkg) {
      return {
        running: false,
        explanation: "Product research has not started. Load Master Product Intelligence from Step 2 first.",
        recommendation: this.recommendation,
      };
    }
    const p = this.pkg;
    const explanation = [
      `Research mode: ${p.researchMode}. Internet ${p.internetAvailable ? "AVAILABLE" : "UNAVAILABLE"}.`,
      `I used ${p.queries.length} targeted queries and ${p.sources.filter((s) => s.action !== "ignore").length} sources.`,
      `Learned ${p.knowledge.length} knowledge items from the local Knowledge Base and category packs — not invented live statistics.`,
      p.insufficientMarketData ? "Market statistics: INSUFFICIENT VERIFIED MARKET DATA." : "",
      `Recommendations (${p.marketingAngles.length} angles) do not overwrite the Marketing Brief.`,
      p.localKnowledgeAge ? `LOCAL KNOWLEDGE age/version: ${p.localKnowledgeAge}.` : "",
      this.recommendation,
    ].filter(Boolean).join(" ");
    return {
      projectId: p.projectId,
      mode: p.researchMode,
      sources: p.sources.length,
      knowledge: p.knowledge.length,
      running: false,
      canContinue: p.status === "complete" || p.status === "partial",
      recommendation: this.recommendation,
      explanation,
    };
  }

  hydrate(): boolean {
    const step3 = loadStep3MarketIntelHandoff();
    this.step3 = step3;
    this.intel = step3?.masterIntelligence ?? null;
    this.production = step3?.productionPackage ?? null;
    this.brief = step3?.productionPackage?.marketingBrief ?? null;
    if (!this.intel) {
      this.recommendation = "No Master Product Intelligence Input found. Complete Phase 3 Step 2 first.";
      this.emit();
      return false;
    }
    const stored = loadStore()[this.intel.projectId];
    if (stored?.current) {
      if (stored.current.status === "running") {
        stored.current.status = "complete";
        saveEntry(stored);
      }
      this.pkg = stored.current;
      this.historyPkgs = stored.history ?? [];
      this.internetAvailable = stored.current.internetAvailable;
      this.recommendation = `Restored research ${stored.current.versionLabel}.`;
      this.emitAction("ProductResearchStarted", { restored: true });
      this.emit();
      return true;
    }
    this.recommendation = `Ready to research “${this.intel.productName}” using Product Intelligence + Marketing Brief + local knowledge.`;
    this.emit();
    return true;
  }

  async run(options?: { force?: boolean }): Promise<ResearchPackage> {
    if (!this.intel) {
      if (!this.hydrate()) throw new Error("Master Product Intelligence required");
    }
    if (this.progress.running) throw new Error("Research already running");

    this.progress = {
      ...emptyProgress(),
      running: true,
      currentStage: "understand-product",
      currentLabel: RESEARCH_STAGE_LABELS["understand-product"],
      completed: 1,
      percent: 8,
    };
    this.emitAction("ProductResearchStarted", { projectId: this.intel!.projectId });
    this.emitBus("product-analysis.started", { projectId: this.intel!.projectId, step: "phase-3-step-3" });
    this.emit();

    const conn = await detectConnectivity();
    this.internetAvailable = conn.internetAvailable;
    this.emitAction("InternetStatusDetected", { internetAvailable: conn.internetAvailable, detail: conn.detail });
    this.emitAction("ResearchModeChanged", { mode: conn.internetAvailable ? "hybrid" : "offline" });
    if (!conn.internetAvailable) {
      this.notify?.("info", "OFFLINE", "Internet unavailable. Continuing with local Knowledge Base.", "information");
    }

    const prev = this.pkg;
    const versionNumber = options?.force && prev ? prev.versionNumber + 1 : prev?.versionNumber ?? 1;
    const assembled = assembleResearchPackage({
      researchId: prev && !options?.force ? prev.researchId : uid("res"),
      versionNumber,
      versionLabel: `${versionNumber}.0`,
      internetAvailable: conn.internetAvailable,
      usedLocalKnowledge: true,
      intel: this.intel!,
      brief: this.brief,
      history: prev
        ? [{ versionLabel: prev.versionLabel, researchId: prev.researchId, createdAt: prev.createdAt }, ...prev.history].slice(0, 8)
        : [],
    });

    if (prev && options?.force) this.historyPkgs = [prev, ...this.historyPkgs].slice(0, 5);
    if (assembled.noLocalKnowledge) {
      this.notify?.("warning", "NO LOCAL KNOWLEDGE AVAILABLE", "No matching Knowledge Base topics or category pack. Nothing was fabricated.", "warnings");
    }

    assembled.status = "running";
    this.pkg = assembled;
    saveEntry({ current: assembled, history: this.historyPkgs });
    this.markDirty();
    this.emitAction("ResearchQueryGenerated", { count: assembled.queries.length });
    this.emitAction("ResearchSourceFound", { count: assembled.sources.length });

    for (let i = 1; i < RESEARCH_STAGES.length - 1; i++) {
      const stage = RESEARCH_STAGES[i]!;
      this.progress.currentStage = stage;
      this.progress.currentLabel = RESEARCH_STAGE_LABELS[stage];
      this.progress.completed = i + 1;
      this.progress.percent = Math.round(((i + 1) / RESEARCH_STAGES.length) * 92);
      if (stage === "extract-knowledge") this.emitAction("KnowledgeExtracted", { count: assembled.knowledge.length });
      if (stage === "customer-intelligence") this.emitAction("CustomerIntelligenceGenerated", { count: assembled.customerInsights.length });
      if (stage === "market-intelligence") this.emitAction("MarketIntelligenceGenerated", { count: assembled.marketInsights.length });
      if (stage === "marketing-insights") this.emitAction("MarketingInsightGenerated", { count: assembled.marketingAngles.length });
      this.emitBus("production.progress", { percent: this.progress.percent, label: this.progress.currentLabel });
      this.emit();
      await delay(20);
    }

    assembled.status = "complete";
    assembled.updatedAt = new Date().toISOString();
    this.pkg = assembled;
    saveEntry({ current: assembled, history: this.historyPkgs });
    rememberKnowledge(assembled);
    this.emitAction("KnowledgeStored", { count: assembled.knowledge.length });

    this.progress = {
      total: RESEARCH_STAGES.length,
      completed: RESEARCH_STAGES.length,
      percent: 100,
      currentLabel: RESEARCH_STAGE_LABELS.saved,
      currentStage: "saved",
      running: false,
    };
    this.recommendation = "Research complete — review sources, then save the Research Package for Step 4 (not started).";
    this.emitAction("ResearchCompleted", { projectId: assembled.projectId, mode: assembled.researchMode });
    this.emitBus("product-analysis.completed", { projectId: assembled.projectId, phase: "market-research" });
    this.markDirty();
    this.emit();
    return assembled;
  }

  setSourceAction(id: string, action: SourceAction): void {
    if (!this.pkg) return;
    this.pkg = {
      ...this.pkg,
      sources: this.pkg.sources.map((s) => (s.id === id ? { ...s, action } : s)),
      updatedAt: new Date().toISOString(),
    };
    saveEntry({ current: this.pkg, history: this.historyPkgs });
    this.markDirty();
    this.emit();
  }

  async retry(): Promise<ResearchPackage> {
    return this.run({ force: true });
  }

  continueToStep4(): Step4CreativeBriefHandoffPayload {
    if (!this.pkg || (this.pkg.status !== "complete" && this.pkg.status !== "partial")) {
      throw new Error("Complete research before continuing");
    }
    const handoff: Step4CreativeBriefHandoffPayload = {
      version: 1,
      step: "step-4-master-intelligence-report",
      projectId: this.pkg.projectId,
      projectName: this.pkg.projectName,
      research: this.pkg,
      masterIntelligence: this.intel,
      productionPackage: this.production ?? this.step3?.productionPackage ?? null,
      productProfile: this.step3?.productProfile ?? null,
      marketingBrief: this.brief,
      preparedAt: new Date().toISOString(),
    };
    localStorage.setItem(RESEARCH_HANDOFF_KEY, JSON.stringify(handoff));
    this.handoffReady = true;
    this.emitAction("ResearchCompleted", { handoff: true, step: "step-4" });
    this.emit();
    return handoff;
  }

  private emitAction(action: string, payload: Record<string, unknown>): void {
    this.emitEvents?.("state.shared", { action, module: "market-research", ...payload });
    this.emitEvents?.("product.updated", { action, module: "market-research", ...payload });
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

export const marketResearchEngine = new MarketResearchEngine();

export function loadStep4CreativeBriefHandoff(): Step4CreativeBriefHandoffPayload | null {
  try {
    const raw = JSON.parse(localStorage.getItem(RESEARCH_HANDOFF_KEY) ?? "null") as Step4CreativeBriefHandoffPayload | null;
    return raw?.version === 1 ? raw : null;
  } catch {
    return null;
  }
}

export type { ResearchStage };
