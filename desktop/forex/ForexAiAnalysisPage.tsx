import { useCallback, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { ForexStatusBadge } from "./components/ForexStatusBadge";
import type { SelectedMarket } from "./market-data/selected-market";
import type { ChartTimeframeId } from "./chart/types";
import type { LiveTickerSnapshot } from "../../ai/market-data/binance/types";
import { LiveTickerPanel } from "./LiveTickerPanel";
import {
  SnapshotProviderResultPanel,
  type SnapshotAnalysisPanelData,
  type SnapshotPlanBundleUi,
  type GuidedAnalysisUi,
  type OpenAiAssistantGuidanceUi,
} from "./SnapshotAiResultPanels";

const MTF_DEFAULT = ["4h", "1h", "30m", "15m", "5m"] as const;
const MTF_OPTIONS = ["4h", "1h", "30m", "15m", "5m", "1d"] as const;
/** Must stay aligned with ANALYSIS_PERIOD_IDS (server). Unsupported ads are omitted. */
const ANALYSIS_PERIODS = [
  "5m", "30m", "2h", "3h", "4h", "5h", "6h", "12h", "24h",
  "2d", "3d", "4d", "5d", "6d", "7d", "custom",
] as const;
/** Native canonical candle timeframes only (unsupported sub-minute/hour variants omitted). */
const CANDLE_TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"] as const;
const MAX_SNAPSHOT_CANDLES = 300;

const PERIOD_MS: Record<Exclude<(typeof ANALYSIS_PERIODS)[number], "custom">, number> = {
  "5m": 5 * 60_000,
  "30m": 30 * 60_000,
  "2h": 2 * 60 * 60_000,
  "3h": 3 * 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "5h": 5 * 60 * 60_000,
  "6h": 6 * 60 * 60_000,
  "12h": 12 * 60 * 60_000,
  "24h": 24 * 60 * 60_000,
  "2d": 2 * 24 * 60 * 60_000,
  "3d": 3 * 24 * 60 * 60_000,
  "4d": 4 * 24 * 60 * 60_000,
  "5d": 5 * 24 * 60 * 60_000,
  "6d": 6 * 24 * 60 * 60_000,
  "7d": 7 * 24 * 60 * 60_000,
};

const TF_MS: Record<(typeof CANDLE_TIMEFRAMES)[number], number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "30m": 30 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
  "1w": 7 * 24 * 60 * 60_000,
};

function estimateCandlesClient(
  candleTimeframe: (typeof CANDLE_TIMEFRAMES)[number],
  analysisPeriod: (typeof ANALYSIS_PERIODS)[number],
  customStart?: string,
  customEnd?: string,
): number | null {
  let spanMs: number | null = null;
  if (analysisPeriod === "custom") {
    const a = Date.parse(customStart ?? "");
    const b = Date.parse(customEnd ?? "");
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
    spanMs = b - a;
  } else {
    spanMs = PERIOD_MS[analysisPeriod];
  }
  return Math.max(1, Math.ceil(spanMs / TF_MS[candleTimeframe]));
}

type SnapshotSummary = {
  snapshotId: string;
  contentFingerprint: string;
  validationStatus: string;
  evidenceReady: boolean;
  candleCount: number;
  candlesRequestedEstimate: number;
  coverageRatio: number;
  closedCandleCount: number | null;
  expectedClosedCandles: number | null;
  formingCandleCount: number | null;
  windowBoundaryPolicy: string | null;
  quoteFreshness: string;
  analysisPeriod: string;
  candleTimeframe: string;
  requestedStartUtc: string;
  requestedEndUtc: string;
  returnedStartUtc: string | null;
  returnedEndUtc: string | null;
  gapCount: number;
  closureGapCount: number;
  resampled: boolean;
  warnings: string[];
  latencyMs: number | null;
};

type LocalSnapshotAnalysisUi = SnapshotAnalysisPanelData;

/** Phase 43F — which engine(s) run against the prepared snapshot. */
type AiProviderMode = "LOCAL" | "OPENAI" | "COMPARE";
const AI_PROVIDER_MODE_KEY = "kwizera.forex.aiProviderMode";

function readAiProviderMode(): AiProviderMode {
  try {
    const v = localStorage.getItem(AI_PROVIDER_MODE_KEY);
    if (v === "LOCAL" || v === "OPENAI" || v === "COMPARE") return v;
  } catch {
    /* ignore */
  }
  return "COMPARE";
}

function writeAiProviderMode(mode: AiProviderMode): void {
  try {
    localStorage.setItem(AI_PROVIDER_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

const TRADE_ALLOCATION_KEY = "kwizera.forex.tradeAllocation";

type TradeAllocationStored = { amount: string; currency: string };

function readTradeAllocation(): TradeAllocationStored {
  try {
    const raw = localStorage.getItem(TRADE_ALLOCATION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TradeAllocationStored>;
      if (parsed && typeof parsed === "object") {
        return {
          amount: typeof parsed.amount === "string" ? parsed.amount : "",
          currency: typeof parsed.currency === "string" && parsed.currency ? parsed.currency : "USD",
        };
      }
    }
  } catch {
    /* ignore */
  }
  return { amount: "", currency: "USD" };
}

function writeTradeAllocation(value: TradeAllocationStored): void {
  try {
    localStorage.setItem(TRADE_ALLOCATION_KEY, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

type CompareUi = {
  status: string;
  snapshotId: string;
  contentFingerprint: string;
  decisionsAgree: boolean;
  biasAgree: boolean;
  localDecision: string | null;
  openaiDecision: string | null;
  localBias: string | null;
  openaiBias: string | null;
  sharedEvidence: string[];
  localOnlyEvidence: string[];
  openaiOnlyEvidence: string[];
  confidenceComparable: boolean;
  note: string;
  warnings: string[];
  latencyMs: number | null;
  comparisonComplete?: boolean;
  planVerdict?: string | null;
  waitConflict?: boolean;
  waitConflictReason?: string | null;
};

function mapPlanBundle(raw: unknown): SnapshotPlanBundleUi | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as SnapshotPlanBundleUi;
  if (!b.pullback || !b.breakout || !b.marketDirection) return null;
  return b;
}

function mapGuidedResponse(raw: unknown): GuidedAnalysisUi | null | undefined {
  if (raw == null) return raw as null | undefined;
  if (typeof raw !== "object") return undefined;
  const g = raw as Record<string, unknown>;
  if (typeof g.schemaVersion !== "string" || !g.marketSummary || typeof g.marketSummary !== "object") {
    return undefined;
  }
  return raw as GuidedAnalysisUi;
}

function mapAssistantGuidance(raw: unknown): OpenAiAssistantGuidanceUi | null | undefined {
  if (raw == null) return raw as null | undefined;
  if (typeof raw !== "object") return undefined;
  const g = raw as Record<string, unknown>;
  if (typeof g.schemaVersion !== "string" || !Array.isArray(g.items) || !g.finalSummary) {
    return undefined;
  }
  return raw as OpenAiAssistantGuidanceUi;
}

function mapAnalysisUi(analysis: LocalSnapshotAnalysisUi, latencyMs?: number | null): LocalSnapshotAnalysisUi {
  return {
    analysisId: analysis.analysisId,
    snapshotId: analysis.snapshotId,
    contentFingerprint: analysis.contentFingerprint,
    decision: analysis.decision,
    decisionRationale: analysis.decisionRationale,
    marketBias: analysis.marketBias,
    marketStructureSummary: analysis.marketStructureSummary,
    keyEvidence: Array.isArray(analysis.keyEvidence) ? analysis.keyEvidence : [],
    bullishScenario: analysis.bullishScenario,
    bearishScenario: analysis.bearishScenario,
    invalidationConditions: Array.isArray(analysis.invalidationConditions)
      ? analysis.invalidationConditions
      : [],
    confidence: analysis.confidence ?? null,
    limitations: Array.isArray(analysis.limitations) ? analysis.limitations : [],
    dataQuality: analysis.dataQuality,
    status: analysis.status,
    model: analysis.model ?? null,
    inferenceLatencyMs: analysis.inferenceLatencyMs ?? latencyMs ?? null,
    warnings: Array.isArray(analysis.warnings) ? analysis.warnings : [],
    newsResearchStatus: analysis.newsResearchStatus,
    analysisProvider: analysis.analysisProvider,
    planBundle: mapPlanBundle(analysis.planBundle),
    guidedResponse: mapGuidedResponse(analysis.guidedResponse),
    assistantGuidance: mapAssistantGuidance(
      (analysis as SnapshotAnalysisPanelData).assistantGuidance,
    ),
  };
}

type ForexAiHealthPublic = {
  state: string;
  ready: boolean;
  model: string | null;
  preferredModel: string;
  notes: string[];
  error?: string;
};

type EvidencePackUi = {
  schemaVersion?: string;
  provider?: string;
  symbol?: string;
  timeframe?: string;
  insufficientHistory?: boolean;
  warnings?: string[];
  patterns?: { detections?: Array<{ id: string; name: string; direction: string; status: string }> };
  structure?: {
    trendState?: string;
    events?: Array<{ type: string; direction: string; status: string; level: number }>;
    zones?: Array<{ side: string; low: number; high: number; status: string; touches: number }>;
    swingSummary?: { confirmedCount?: number; provisionalCount?: number };
  };
  knowledge?: Array<{
    documentId: string;
    chunkId: string;
    title: string;
    sourceName?: string;
    version?: number;
    pageNumber?: number | null;
  }>;
};

type SingleAnalysis = {
  schemaVersion: string;
  analysisId: string;
  generatedAt: string;
  market: { displaySymbol: string; symbol: string; timeframe: string };
  dataQuality: { status: string; marketTimestamp: string | null };
  summary: string;
  observedFacts: string[];
  trend: { direction: string; explanation: string };
  momentum: { state: string; explanation: string };
  volatility: { state: string; explanation: string };
  marketStructure: { state: string; explanation: string };
  scenarios: Array<{ type: string; name?: string; status?: string; reasoning: string; conditions: string[]; invalidation: string[] }>;
  confirmationNeeded: string[];
  invalidationConditions: string[];
  risks: string[];
  knowledgeSources: Array<{
    documentId: string;
    title: string;
    relevanceScore: number;
    version: number;
    chunkId?: string;
    sourceName?: string;
    pageNumber?: number | null;
  }>;
  limitations: string[];
  decisionPosture: string;
  confidence: null;
  model: string | null;
  reasoning: string;
  evidencePack?: EvidencePackUi;
  inferenceLatencyMs?: number | null;
  inferenceStatus?: string;
};

type MtfAnalysis = {
  schemaVersion: string;
  analysisId: string;
  generatedAt: string;
  narrativeStatus: string;
  market: { displaySymbol: string; symbol: string };
  timeframes: string[];
  timeframeStates: Array<{
    timeframe: string;
    role: string;
    usable: boolean;
    status: string;
    trend: string | null;
    momentum: string | null;
    volatility: string | null;
    rsi: number | null;
    structure: string | null;
    timestamp: string | null;
    reason?: string;
  }>;
  dataQuality: {
    status: string;
    perTimeframe: Array<{ timeframe: string; status: string; timestamp: string | null }>;
  };
  overallAlignment: {
    overall: string;
    higherBias: string;
    higherBasis: string[];
    intermediateState: string;
    lowerState: string;
    confluence: string[];
    conflicts: string[];
  };
  higherTimeframeBias: { direction: string; basis: string[] };
  intermediateTimeframeState: string;
  lowerTimeframeState: string;
  timeframeAnalysis: Array<{ timeframe: string; role: string; observedFacts: string[]; interpretation: string }>;
  confluence: string[];
  conflicts: string[];
  scenarios: Array<{ type: string; name: string; reasoning: string; conditions: string[]; invalidation: string[] }>;
  confirmationNeeded: string[];
  invalidationConditions: string[];
  risks: string[];
  knowledgeSources: Array<{
    documentId: string;
    title: string;
    relevanceScore: number;
    version: number;
    chunkId?: string;
    sourceName?: string;
  }>;
  limitations: string[];
  decisionPosture: string;
  confidence: null;
  model: string | null;
  evidencePack?: EvidencePackUi;
  inferenceLatencyMs?: number | null;
  inferenceStatus?: string;
};

type DecisionAnalysis = {
  schemaVersion: string;
  analysisId: string;
  generatedAt: string;
  narrativeStatus: string;
  market: { displaySymbol: string; symbol: string; currentPrice: number | null };
  timeframes: string[];
  timeframeStates: MtfAnalysis["timeframeStates"];
  dataQuality: MtfAnalysis["dataQuality"];
  alignment: MtfAnalysis["overallAlignment"];
  scenario: { type: string; direction: string; name: string; evidence: string[]; notes: string[] };
  entryZone: {
    status: string;
    lowerBound: number | null;
    upperBound: number | null;
    referencePrice: number | null;
    currentPrice: number | null;
    invalidationLevel: number | null;
    timeframe: string | null;
    basis: string[];
    unavailableReason: string | null;
  };
  confirmation: {
    conditions: Array<{
      id: string;
      category: string;
      description: string;
      status: string;
      observedValue: string | null;
      requiredValue: string | null;
      timeframe: string | null;
    }>;
    allRequiredMet: boolean;
    summary: string;
  };
  invalidation: {
    conditions: Array<{
      id: string;
      description: string;
      status: string;
      level: number | null;
      timeframe: string | null;
      basis: string;
    }>;
    triggered: boolean;
    summary: string;
  };
  riskContext: {
    volatility: string | null;
    atr: number | null;
    distanceToEntry: number | null;
    distanceToInvalidation: number | null;
    timeframeConflict: boolean;
    dataQuality: string;
    factors: string[];
  };
  riskReward: {
    risk: number | null;
    reward: number | null;
    ratio: number | null;
    method: string | null;
    unavailableReason: string | null;
  };
  stopLossCandidate: number | null;
  takeProfitCandidates: number[];
  decisionPosture: string;
  observedFacts: string[];
  deterministicSummary: string;
  aiInterpretation: string | null;
  knowledgeSources: Array<{
    documentId: string;
    title: string;
    relevanceScore: number;
    version: number;
    chunkId?: string;
    sourceName?: string;
  }>;
  limitations: string[];
  confidence: null;
  model: string | null;
  evidencePack?: EvidencePackUi;
  inferenceLatencyMs?: number | null;
  inferenceStatus?: string;
};

type UiPhase = "idle" | "analyzing" | "ready" | "error";
type Mode = "single" | "mtf" | "decision";

function toneForState(state: string): "live" | "future" | "offline" {
  if (["AI_READY", "LIVE", "CONNECTED", "OK", "ALIGNED_BULLISH", "ALIGNED_BEARISH", "COMPLETE_LIVE", "COMPLETE_CONNECTED", "SCENARIO_ACTIVE", "MET"].includes(state)) return "live";
  if (["AI_DISABLED", "WAIT", "WATCH", "OBSERVE", "MIXED", "PARTIALLY_STALE", "CONFIRMATION_REQUIRED", "NOT_MET", "CANDIDATE", "WAITING_CONFIRMATION"].includes(state)) return "future";
  return "offline";
}

function formatTs(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function AiPanel({
  title,
  children,
  meta,
  className = "",
  ...rest
}: {
  title?: string;
  children: ReactNode;
  meta?: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLElement>) {
  return (
    <article className={`fx-ai-panel ${className}`.trim()} {...rest}>
      {title || meta ? (
        <header className="fx-ai-panel-head">
          {title ? <h3 className="fx-ai-panel-title">{title}</h3> : null}
          {meta ? <div className="fx-ai-panel-meta">{meta}</div> : null}
        </header>
      ) : null}
      <div className="fx-ai-panel-body">{children}</div>
    </article>
  );
}

function EvidencePanel({
  pack,
  model,
  inferenceLatencyMs,
  inferenceStatus,
}: {
  pack?: EvidencePackUi | null;
  model?: string | null;
  inferenceLatencyMs?: number | null;
  inferenceStatus?: string | null;
}) {
  if (!pack) {
    return (
      <AiPanel title="Detector evidence" data-forex-ai-evidence="true">
        <p className="fx-ai-muted">No detector evidence attached to this result.</p>
      </AiPanel>
    );
  }
  const patterns = pack.patterns?.detections ?? [];
  const events = pack.structure?.events ?? [];
  const zones = pack.structure?.zones ?? [];
  const knowledge = pack.knowledge ?? [];
  const warnings = pack.warnings ?? [];
  return (
    <AiPanel
      title="Detector evidence"
      data-forex-ai-evidence="true"
      meta={(
        <span>
          {pack.provider ?? "—"} · {pack.symbol ?? "—"} · {pack.timeframe ?? "—"}
          {pack.insufficientHistory ? " · insufficient history" : ""}
        </span>
      )}
    >
      <dl className="fx-ai-kv">
        <div>
          <dt>Structure</dt>
          <dd data-evidence-trend="true">{pack.structure?.trendState ?? "UNKNOWN"}</dd>
        </div>
        <div>
          <dt>Swings</dt>
          <dd>
            conf={pack.structure?.swingSummary?.confirmedCount ?? 0}
            {" · "}
            prov={pack.structure?.swingSummary?.provisionalCount ?? 0}
          </dd>
        </div>
        <div>
          <dt>Inference</dt>
          <dd>
            {inferenceStatus ?? "—"}
            {inferenceLatencyMs != null ? ` · ${inferenceLatencyMs} ms` : ""}
            {model ? ` · ${model}` : ""}
          </dd>
        </div>
      </dl>
      <div className="fx-ai-evidence-grid">
        <div>
          <h4>Patterns</h4>
          {patterns.length === 0 ? (
            <p className="fx-ai-muted">None detected</p>
          ) : (
            <ul data-evidence-patterns="true">
              {patterns.map((p) => (
                <li key={`${p.id}-${p.status}`}>{p.name} · {p.direction} · {p.status}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4>BOS / CHoCH</h4>
          {events.length === 0 ? (
            <p className="fx-ai-muted">None</p>
          ) : (
            <ul data-evidence-events="true">
              {events.map((e, i) => (
                <li key={`${e.type}-${e.level}-${i}`}>{e.type} · {e.direction} · {e.status} @ {e.level}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4>Zones</h4>
          {zones.length === 0 ? (
            <p className="fx-ai-muted">None</p>
          ) : (
            <ul data-evidence-zones="true">
              {zones.map((z, i) => (
                <li key={`${z.side}-${i}`}>{z.side} {z.low}–{z.high} · {z.status} · touches {z.touches}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4>Knowledge</h4>
          {knowledge.length === 0 ? (
            <p className="fx-ai-muted">None matched</p>
          ) : (
            <ul data-evidence-knowledge="true">
              {knowledge.map((k) => (
                <li key={`${k.documentId}:${k.chunkId}`}>
                  {k.title}
                  {k.sourceName ? ` · ${k.sourceName}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {warnings.length ? (
        <>
          <h4>Warnings</h4>
          <ul data-evidence-warnings="true">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </>
      ) : null}
    </AiPanel>
  );
}

export function ForexAiAnalysisPage({
  selectedMarket,
  timeframe,
  liveTicker,
}: {
  selectedMarket?: SelectedMarket | null;
  timeframe?: ChartTimeframeId | string;
  liveTicker?: LiveTickerSnapshot | null;
}) {
  const [mode, setMode] = useState<Mode>("decision");
  const [mtfSelected, setMtfSelected] = useState<string[]>([...MTF_DEFAULT]);
  const [health, setHealth] = useState<ForexAiHealthPublic | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [phase, setPhase] = useState<UiPhase>("idle");
  const [single, setSingle] = useState<SingleAnalysis | null>(null);
  const [mtf, setMtf] = useState<MtfAnalysis | null>(null);
  const [decision, setDecision] = useState<DecisionAnalysis | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzeCode, setAnalyzeCode] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [diagnostics, setDiagnostics] = useState<Record<string, unknown> | null>(null);
  const [analysisPeriod, setAnalysisPeriod] = useState<(typeof ANALYSIS_PERIODS)[number]>("6h");
  const [candleTf, setCandleTf] = useState<(typeof CANDLE_TIMEFRAMES)[number]>("15m");
  const [customStartUtc, setCustomStartUtc] = useState("");
  const [customEndUtc, setCustomEndUtc] = useState("");
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SnapshotSummary | null>(null);
  const [snapshotStale, setSnapshotStale] = useState(false);
  const snapshotRequestSeq = useRef(0);
  const [aiProviderMode, setAiProviderModeState] = useState<AiProviderMode>(() => readAiProviderMode());
  const setAiProviderMode = useCallback((next: AiProviderMode) => {
    setAiProviderModeState(next);
    writeAiProviderMode(next);
  }, []);
  const [tradeAllocAmount, setTradeAllocAmount] = useState(() => readTradeAllocation().amount);
  const [tradeAllocCurrency, setTradeAllocCurrency] = useState(() => readTradeAllocation().currency);
  const [tradeAllocError, setTradeAllocError] = useState<string | null>(null);
  const buildTradeAllocationPayload = useCallback((): { amount: number; currency: string } | null => {
    const trimmedAmount = tradeAllocAmount.trim();
    if (!trimmedAmount) {
      setTradeAllocError(null);
      return null;
    }
    const amount = Number(trimmedAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setTradeAllocError("Enter a positive trade allocation amount.");
      return null;
    }
    const currency = tradeAllocCurrency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      setTradeAllocError("Currency must be a 3-letter ISO code (e.g. USD).");
      return null;
    }
    setTradeAllocError(null);
    return { amount, currency };
  }, [tradeAllocAmount, tradeAllocCurrency]);
  const [localAiBusy, setLocalAiBusy] = useState(false);
  const [localAiError, setLocalAiError] = useState<string | null>(null);
  const [localAi, setLocalAi] = useState<LocalSnapshotAnalysisUi | null>(null);
  const localAiRequestSeq = useRef(0);
  const [openAiBusy, setOpenAiBusy] = useState(false);
  const [openAiError, setOpenAiError] = useState<string | null>(null);
  const [openAi, setOpenAi] = useState<(LocalSnapshotAnalysisUi & {
    newsResearchStatus?: string;
    analysisProvider?: string;
  }) | null>(null);
  const [openAiConfigured, setOpenAiConfigured] = useState<boolean | null>(null);
  const [openAiVaultUnlocked, setOpenAiVaultUnlocked] = useState<boolean | null>(null);
  const [openAiModel, setOpenAiModel] = useState<string | null>(null);
  const [openAiModelEligible, setOpenAiModelEligible] = useState<boolean | null>(null);
  const openAiRequestSeq = useRef(0);
  const [compareBusy, setCompareBusy] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [compareUi, setCompareUi] = useState<CompareUi | null>(null);
  const compareRequestSeq = useRef(0);
  const anyProviderBusy = localAiBusy || openAiBusy || compareBusy;

  const tf = String(timeframe || "15m");
  const binanceSelected = selectedMarket?.venue === "binance-spot";
  const fxcmSelected = selectedMarket?.venue === "fxcm";
  const forexConnectSelected = selectedMarket?.venue === "forexconnect";
  const marketReady = Boolean(binanceSelected || fxcmSelected || forexConnectSelected);
  const provider = forexConnectSelected
    ? "FOREXCONNECT" as const
    : fxcmSelected
      ? "FXCM" as const
      : "BINANCE" as const;

  // Seed candle timeframe from chart once when chart TF is a supported canonical value.
  useEffect(() => {
    const chartTf = String(timeframe || "").toLowerCase();
    if ((CANDLE_TIMEFRAMES as readonly string[]).includes(chartTf)) {
      setCandleTf(chartTf as (typeof CANDLE_TIMEFRAMES)[number]);
    }
  }, [timeframe]);

  // Changing selection invalidates displayed snapshot identity (do not reuse incompatible data).
  useEffect(() => {
    setSnapshotStale(true);
    setSnapshotError(null);
    setLocalAiError(null);
    setOpenAiError(null);
  }, [provider, selectedMarket?.symbol, analysisPeriod, candleTf, customStartUtc, customEndUtc, mode]);

  const estimatedCandles = estimateCandlesClient(
    candleTf,
    analysisPeriod,
    customStartUtc,
    customEndUtc,
  );
  const combinationBlocked = estimatedCandles != null && estimatedCandles > MAX_SNAPSHOT_CANDLES;

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/forex/ai/health")
      .then(async (res) => {
        const body = await res.json() as { health?: ForexAiHealthPublic; error?: { message?: string } };
        if (!res.ok || !body.health) throw new Error(body.error?.message ?? `Health failed (${res.status})`);
        if (!cancelled) setHealth(body.health);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setHealth(null);
          setHealthError(err instanceof Error ? err.message : "AI health unavailable");
        }
      });
    void fetch("/api/forex/ai-analysis/openai/meta")
      .then(async (res) => {
        const body = await res.json() as {
          status?: {
            configured?: boolean;
            vaultUnlocked?: boolean;
            model?: string;
            modelEligible?: boolean;
          };
        };
        if (!cancelled) {
          setOpenAiConfigured(Boolean(body.status?.configured));
          setOpenAiVaultUnlocked(Boolean(body.status?.vaultUnlocked));
          setOpenAiModel(body.status?.model ?? null);
          setOpenAiModelEligible(
            body.status?.modelEligible == null ? null : Boolean(body.status.modelEligible),
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOpenAiConfigured(null);
          setOpenAiVaultUnlocked(null);
          setOpenAiModel(null);
          setOpenAiModelEligible(null);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const toggleTf = (id: string) => {
    setMtfSelected((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };

  const prepareSnapshot = useCallback(async () => {
    if (!marketReady || !selectedMarket) {
      setSnapshotError("Select a market instrument before preparing a snapshot.");
      return;
    }
    if (combinationBlocked) {
      setSnapshotError(
        `Selection needs ~${estimatedCandles} ${candleTf} candles (max ${MAX_SNAPSHOT_CANDLES}). `
        + "Choose a coarser timeframe or shorter period.",
      );
      return;
    }
    if (analysisPeriod === "custom") {
      const a = Date.parse(customStartUtc);
      const b = Date.parse(customEndUtc);
      if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) {
        setSnapshotError("Custom period requires a valid UTC start and end (end after start).");
        return;
      }
    }

    const seq = ++snapshotRequestSeq.current;
    setSnapshotBusy(true);
    setSnapshotError(null);
    try {
      const body: Record<string, unknown> = {
        provider,
        symbol: selectedMarket.symbol,
        candleTimeframe: candleTf,
        analysisPeriod,
        higherTimeframes: mode === "single"
          ? undefined
          : mtfSelected.filter((t) => t !== candleTf),
        requireLiveQuote: false,
      };
      if (analysisPeriod === "custom") {
        body.rangeStartUtc = new Date(customStartUtc).toISOString();
        body.rangeEndUtc = new Date(customEndUtc).toISOString();
      }
      const res = await fetch("/api/forex/analysis-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as {
        ok?: boolean;
        code?: string;
        error?: string | null;
        latencyMs?: number;
        snapshot?: {
          snapshotId: string;
          contentFingerprint: string;
          evidenceReady: boolean;
          candleCount: number;
          candlesRequestedEstimate?: number;
          analysisPeriod: string;
          candleTimeframe: string;
          requestedRange?: { startUtc?: string; endUtc?: string };
          returnedRange?: { startUtc?: string; endUtc?: string } | null;
          dataGaps?: Array<{ reason?: string }>;
          warnings?: string[];
          validation?: { status?: string; warnings?: string[] };
          freshness?: {
            quote?: string;
            historicalCoverageRatio?: number;
            closedCandleCount?: number;
            expectedClosedCandles?: number;
            formingCandleCount?: number;
            windowBoundaryPolicy?: string;
          };
          sourceMetadata?: { resampled?: boolean };
        } | null;
      };
      if (seq !== snapshotRequestSeq.current) return; // stale response
      if (!data.snapshot) {
        // Keep prior snapshot visible when a later attempt fails.
        setSnapshotError(data.error || data.code || "Snapshot unavailable");
        return;
      }
      const gaps = data.snapshot.dataGaps ?? [];
      setSnapshot({
        snapshotId: data.snapshot.snapshotId,
        contentFingerprint: data.snapshot.contentFingerprint,
        validationStatus: data.snapshot.validation?.status || data.code || "UNKNOWN",
        evidenceReady: Boolean(data.snapshot.evidenceReady),
        candleCount: data.snapshot.candleCount,
        candlesRequestedEstimate: data.snapshot.candlesRequestedEstimate ?? 0,
        coverageRatio: data.snapshot.freshness?.historicalCoverageRatio ?? 0,
        closedCandleCount: data.snapshot.freshness?.closedCandleCount ?? null,
        expectedClosedCandles: data.snapshot.freshness?.expectedClosedCandles ?? null,
        formingCandleCount: data.snapshot.freshness?.formingCandleCount ?? null,
        windowBoundaryPolicy: data.snapshot.freshness?.windowBoundaryPolicy ?? null,
        quoteFreshness: data.snapshot.freshness?.quote || "UNAVAILABLE",
        analysisPeriod: data.snapshot.analysisPeriod,
        candleTimeframe: data.snapshot.candleTimeframe,
        requestedStartUtc: data.snapshot.requestedRange?.startUtc ?? "",
        requestedEndUtc: data.snapshot.requestedRange?.endUtc ?? "",
        returnedStartUtc: data.snapshot.returnedRange?.startUtc ?? null,
        returnedEndUtc: data.snapshot.returnedRange?.endUtc ?? null,
        gapCount: gaps.length,
        closureGapCount: gaps.filter((g) => g.reason === "MARKET_CLOSURE").length,
        resampled: Boolean(data.snapshot.sourceMetadata?.resampled),
        warnings: data.snapshot.warnings
          ?? data.snapshot.validation?.warnings
          ?? [],
        latencyMs: data.latencyMs ?? null,
      });
      setSnapshotStale(false);
      if (!data.ok) {
        setSnapshotError(data.error || data.code || "Snapshot completed with validation issues");
      }
    } catch (err) {
      if (seq !== snapshotRequestSeq.current) return;
      setSnapshotError(err instanceof Error ? err.message : "Snapshot request failed");
    } finally {
      if (seq === snapshotRequestSeq.current) setSnapshotBusy(false);
    }
  }, [
    marketReady,
    selectedMarket,
    provider,
    mode,
    mtfSelected,
    analysisPeriod,
    candleTf,
    customStartUtc,
    customEndUtc,
    combinationBlocked,
    estimatedCandles,
  ]);

  const snapshotUsableForLocalAi = Boolean(
    snapshot
    && !snapshotStale
    && snapshot.evidenceReady
    && !snapshotBusy,
  );

  const runLocalSnapshotAi = useCallback(async () => {
    if (!snapshot || snapshotStale) {
      setLocalAiError("Prepare a current snapshot before running Local AI.");
      return;
    }
    if (!snapshot.evidenceReady) {
      setLocalAiError("Snapshot evidence is not ready for Local AI analysis.");
      return;
    }
    if (anyProviderBusy) return;

    const tradeAllocation = buildTradeAllocationPayload();
    if (tradeAllocAmount.trim() && tradeAllocation === null) return;

    const seq = ++localAiRequestSeq.current;
    setLocalAiBusy(true);
    setLocalAiError(null);
    setCompareUi(null);
    setCompareError(null);
    try {
      const res = await fetch("/api/forex/ai-analysis/local", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          snapshotId: snapshot.snapshotId,
          contentFingerprint: snapshot.contentFingerprint,
          provider,
          symbol: selectedMarket?.symbol,
          candleTimeframe: snapshot.candleTimeframe,
          analysisPeriod: snapshot.analysisPeriod,
          tradeAllocation,
        }),
      });
      const data = await res.json() as {
        ok?: boolean;
        code?: string;
        error?: string | null;
        latencyMs?: number;
        analysis?: LocalSnapshotAnalysisUi | null;
      };
      if (seq !== localAiRequestSeq.current) return;
      if (!data.analysis) {
        setLocalAiError(data.error || data.code || "Local AI analysis unavailable");
        return;
      }
      setLocalAi(mapAnalysisUi(data.analysis, data.latencyMs));
      if (!data.ok) {
        setLocalAiError(data.error || data.code || "Local AI completed with issues");
      }
    } catch (err) {
      if (seq !== localAiRequestSeq.current) return;
      setLocalAiError(err instanceof Error ? err.message : "Local AI request failed");
    } finally {
      if (seq === localAiRequestSeq.current) setLocalAiBusy(false);
    }
  }, [snapshot, snapshotStale, anyProviderBusy, provider, selectedMarket?.symbol, buildTradeAllocationPayload, tradeAllocAmount]);

  const runOpenAiSnapshotAi = useCallback(async () => {
    if (!snapshot || snapshotStale) {
      setOpenAiError("Prepare a current snapshot before running OpenAI analysis.");
      return;
    }
    if (!snapshot.evidenceReady) {
      setOpenAiError("Snapshot evidence is not ready for OpenAI analysis.");
      return;
    }
    if (openAiConfigured === false) {
      setOpenAiError("OpenAI is not configured. Set the API key in Forex Admin → AI Configuration.");
      return;
    }
    if (anyProviderBusy) return;

    const tradeAllocation = buildTradeAllocationPayload();
    if (tradeAllocAmount.trim() && tradeAllocation === null) return;

    const seq = ++openAiRequestSeq.current;
    setOpenAiBusy(true);
    setOpenAiError(null);
    setCompareUi(null);
    setCompareError(null);
    try {
      const res = await fetch("/api/forex/ai-analysis/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          snapshotId: snapshot.snapshotId,
          contentFingerprint: snapshot.contentFingerprint,
          provider,
          symbol: selectedMarket?.symbol,
          candleTimeframe: snapshot.candleTimeframe,
          analysisPeriod: snapshot.analysisPeriod,
          tradeAllocation,
        }),
      });
      const data = await res.json() as {
        ok?: boolean;
        code?: string;
        error?: string | null;
        latencyMs?: number;
        analysis?: (LocalSnapshotAnalysisUi & {
          newsResearchStatus?: string;
          analysisProvider?: string;
        }) | null;
      };
      if (seq !== openAiRequestSeq.current) return;
      if (!data.analysis) {
        setOpenAiError(data.error || data.code || "OpenAI analysis unavailable");
        return;
      }
      setOpenAi({
        ...mapAnalysisUi(data.analysis, data.latencyMs),
        newsResearchStatus: data.analysis.newsResearchStatus,
        analysisProvider: data.analysis.analysisProvider ?? "OPENAI",
      });
      if (data.analysis.model) setOpenAiModel(data.analysis.model);
      if (!data.ok) {
        setOpenAiError(data.error || data.code || "OpenAI completed with issues");
      }
    } catch (err) {
      if (seq !== openAiRequestSeq.current) return;
      setOpenAiError(err instanceof Error ? err.message : "OpenAI request failed");
    } finally {
      if (seq === openAiRequestSeq.current) setOpenAiBusy(false);
    }
  }, [snapshot, snapshotStale, anyProviderBusy, openAiConfigured, provider, selectedMarket?.symbol, buildTradeAllocationPayload, tradeAllocAmount]);

  const runCompareSnapshotAi = useCallback(async () => {
    if (!snapshot || snapshotStale) {
      setCompareError("Prepare a current snapshot before comparing providers.");
      return;
    }
    if (!snapshot.evidenceReady) {
      setCompareError("Snapshot evidence is not ready for comparison.");
      return;
    }
    if (anyProviderBusy) return;

    const tradeAllocation = buildTradeAllocationPayload();
    if (tradeAllocAmount.trim() && tradeAllocation === null) return;

    const seq = ++compareRequestSeq.current;
    setCompareBusy(true);
    setLocalAiBusy(true);
    setOpenAiBusy(true);
    setCompareError(null);
    setLocalAiError(null);
    setOpenAiError(null);
    try {
      const res = await fetch("/api/forex/ai-analysis/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          snapshotId: snapshot.snapshotId,
          contentFingerprint: snapshot.contentFingerprint,
          provider,
          symbol: selectedMarket?.symbol,
          candleTimeframe: snapshot.candleTimeframe,
          analysisPeriod: snapshot.analysisPeriod,
          tradeAllocation,
        }),
      });
      const data = await res.json() as {
        ok?: boolean;
        code?: string;
        error?: string | null;
        latencyMs?: number;
        compare?: {
          status: string;
          snapshotId: string;
          contentFingerprint: string;
          localResult: {
            ok: boolean;
            code: string;
            error: string | null;
            latencyMs: number;
            analysis: LocalSnapshotAnalysisUi | null;
          };
          openaiResult: {
            ok: boolean;
            code: string;
            error: string | null;
            latencyMs: number;
            analysis: (LocalSnapshotAnalysisUi & {
              newsResearchStatus?: string;
              analysisProvider?: string;
            }) | null;
          };
          comparison: {
            decisionsAgree: boolean;
            biasAgree: boolean;
            localDecision: string | null;
            openaiDecision: string | null;
            localBias: string | null;
            openaiBias: string | null;
            sharedEvidence: string[];
            localOnlyEvidence: string[];
            openaiOnlyEvidence: string[];
            confidenceComparable: boolean;
            note: string;
            warnings: string[];
            comparisonComplete?: boolean;
            planComparison?: {
              verdict?: string;
              waitConflict?: boolean;
              waitConflictReason?: string | null;
            } | null;
          };
        } | null;
      };
      if (seq !== compareRequestSeq.current) return;

      if (!data.compare) {
        setCompareError(data.error || data.code || "Compare unavailable");
        return;
      }

      const c = data.compare;
      if (c.localResult.analysis) {
        setLocalAi(mapAnalysisUi(c.localResult.analysis, c.localResult.latencyMs));
      }
      if (!c.localResult.ok) {
        setLocalAiError(c.localResult.error || c.localResult.code);
      }
      if (c.openaiResult.analysis) {
        setOpenAi({
          ...mapAnalysisUi(c.openaiResult.analysis, c.openaiResult.latencyMs),
          newsResearchStatus: c.openaiResult.analysis.newsResearchStatus,
          analysisProvider: c.openaiResult.analysis.analysisProvider ?? "OPENAI",
        });
        if (c.openaiResult.analysis.model) setOpenAiModel(c.openaiResult.analysis.model);
      }
      if (!c.openaiResult.ok) {
        setOpenAiError(c.openaiResult.error || c.openaiResult.code);
      }

      setCompareUi({
        status: c.status,
        snapshotId: c.snapshotId,
        contentFingerprint: c.contentFingerprint,
        decisionsAgree: c.comparison.decisionsAgree,
        biasAgree: c.comparison.biasAgree,
        localDecision: c.comparison.localDecision,
        openaiDecision: c.comparison.openaiDecision,
        localBias: c.comparison.localBias,
        openaiBias: c.comparison.openaiBias,
        sharedEvidence: c.comparison.sharedEvidence ?? [],
        localOnlyEvidence: c.comparison.localOnlyEvidence ?? [],
        openaiOnlyEvidence: c.comparison.openaiOnlyEvidence ?? [],
        confidenceComparable: c.comparison.confidenceComparable,
        note: c.comparison.note,
        warnings: c.comparison.warnings ?? [],
        latencyMs: data.latencyMs ?? null,
        comparisonComplete: Boolean(c.comparison.comparisonComplete),
        planVerdict: c.comparison.planComparison?.verdict ?? null,
        waitConflict: Boolean(c.comparison.planComparison?.waitConflict),
        waitConflictReason: c.comparison.planComparison?.waitConflictReason ?? null,
      });
      if (!data.ok && data.code === "BOTH_FAILED") {
        setCompareError(data.error || "Both providers failed");
      } else if (data.code === "PARTIAL_SUCCESS") {
        setCompareError(null);
      }
    } catch (err) {
      if (seq !== compareRequestSeq.current) return;
      setCompareError(err instanceof Error ? err.message : "Compare request failed");
    } finally {
      if (seq === compareRequestSeq.current) {
        setCompareBusy(false);
        setLocalAiBusy(false);
        setOpenAiBusy(false);
      }
    }
  }, [snapshot, snapshotStale, anyProviderBusy, provider, selectedMarket?.symbol, buildTradeAllocationPayload, tradeAllocAmount]);

  const runAnalysis = useCallback(async () => {
    if (!marketReady || !selectedMarket) {
      setPhase("error");
      setAnalyzeCode("DATA_UNAVAILABLE");
      setAnalyzeError("Select a BINANCE, FXCM, or FOREXCONNECT instrument from Markets before analyzing.");
      return;
    }
    setPhase("analyzing");
    setAnalyzeError(null);
    setAnalyzeCode(null);
    setSingle(null);
    setMtf(null);
    setDecision(null);
    try {
      const endpoint = mode === "decision"
        ? "/api/forex/ai/decision"
        : mode === "mtf"
          ? "/api/forex/ai/multi-timeframe"
          : "/api/forex/ai/analyze";
      const body = mode === "decision" || mode === "mtf"
        ? {
          provider,
          symbol: selectedMarket.symbol,
          timeframes: mtfSelected,
          analysisType: "MARKET_OVERVIEW",
        }
        : {
          provider,
          symbol: selectedMarket.symbol,
          timeframe: tf,
          analysisType: "MARKET_OVERVIEW",
        };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as {
        ok: boolean;
        code: string;
        analysis: SingleAnalysis | MtfAnalysis | DecisionAnalysis | null;
        latencyMs: number;
        error?: string;
        diagnostics?: Record<string, unknown>;
      };
      setLatencyMs(data.latencyMs ?? null);
      setDiagnostics(data.diagnostics ?? null);
      if (!data.ok || !data.analysis) {
        setPhase("error");
        setAnalyzeCode(data.code || "AI_ERROR");
        setAnalyzeError(data.error || "AI analysis unavailable");
        return;
      }
      if (mode === "decision") setDecision(data.analysis as DecisionAnalysis);
      else if (mode === "mtf") setMtf(data.analysis as MtfAnalysis);
      else setSingle(data.analysis as SingleAnalysis);
      setPhase("ready");
    } catch (err) {
      setPhase("error");
      setAnalyzeCode("AI_ERROR");
      setAnalyzeError(err instanceof Error ? err.message : "AI analysis request failed");
    }
  }, [marketReady, provider, selectedMarket, mode, mtfSelected, tf]);

  const analyzeLabel = anyProviderBusy || phase === "analyzing"
    ? "Analyzing…"
    : aiProviderMode === "OPENAI"
      ? (openAi ? "Analyze Decision again" : "Analyze Decision")
      : aiProviderMode === "LOCAL"
        ? (localAi ? "Analyze with Local AI again" : "Analyze with Local AI")
        : aiProviderMode === "COMPARE"
          ? (compareUi ? "Compare Both again" : "Compare Both")
          : mode === "decision"
            ? (decision ? "Analyze Decision again" : "Analyze Decision")
            : mode === "mtf"
              ? (mtf ? "Analyze Multi-Timeframe again" : "Analyze Multi-Timeframe")
              : (single ? "Analyze again" : "Analyze Market");

  const runPrimaryAnalyze = useCallback(() => {
    if (aiProviderMode === "OPENAI") {
      void runOpenAiSnapshotAi();
      return;
    }
    if (aiProviderMode === "LOCAL") {
      void runLocalSnapshotAi();
      return;
    }
    if (aiProviderMode === "COMPARE") {
      void runCompareSnapshotAi();
      return;
    }
    void runAnalysis();
  }, [
    aiProviderMode,
    runOpenAiSnapshotAi,
    runLocalSnapshotAi,
    runCompareSnapshotAi,
    runAnalysis,
  ]);

  return (
    <section
      className="fx-module-page fx-ai-analysis"
      data-forex-page="ai-analysis"
      data-forex-ai-foundation="true"
      data-forex-ai-phase20="true"
      data-forex-ai-phase21="true"
      data-forex-ai-phase22="true"
      data-forex-ai-phase43b="true"
      data-forex-ai-phase43c="true"
      data-forex-ai-phase43d="true"
      data-forex-ai-phase43e="true"
      data-forex-ai-phase43f="true"
      data-forex-ai-phase44="true"
      data-ai-mode={mode}
      data-ai-phase={phase}
      data-ai-provider={marketReady ? provider : ""}
      data-ai-candle-tf={candleTf}
      data-ai-period-value={analysisPeriod}
      aria-labelledby="fx-page-ai-analysis"
    >
      <header className="fx-ai-page-header">
        <div className="fx-ai-page-header-text">
          <h1 id="fx-page-ai-analysis" className="fx-ai-page-title">AI Market Analysis</h1>
          <p className="fx-ai-page-sub">Interpretive market analysis · not trade execution</p>
        </div>
        {health ? (
          <div className="fx-ai-health-chip" data-ai-health="true">
            <ForexStatusBadge tone={toneForState(health.state)}>{health.state}</ForexStatusBadge>
            <span className="fx-ai-muted">Model {health.preferredModel}</span>
          </div>
        ) : null}
      </header>

      <div className="fx-ai-config" data-ai-config="true">
        <div className="fx-ai-status-row" aria-label="Market and AI status">
          <div className="fx-ai-status-item">
            <span className="fx-ai-label">Provider</span>
            <strong data-ai-market-provider="true">{marketReady ? provider : "None"}</strong>
          </div>
          <div className="fx-ai-status-item">
            <span className="fx-ai-label">Instrument</span>
            <strong data-ai-market-symbol="true" className="fx-ai-symbol">
              {marketReady ? selectedMarket!.displaySymbol : "None selected"}
            </strong>
          </div>
          {mode === "single" ? (
            <div className="fx-ai-status-item">
              <span className="fx-ai-label">Chart TF</span>
              <strong data-ai-market-timeframe="true">{tf}</strong>
            </div>
          ) : (
            <div className="fx-ai-status-item">
              <span className="fx-ai-label">AI timeframes</span>
              <strong>{mtfSelected.map((t) => t.toUpperCase()).join(" · ")}</strong>
            </div>
          )}
          <div className="fx-ai-status-item">
            <span className="fx-ai-label">AI mode</span>
            <strong>{mode === "decision" ? "Decision" : mode === "mtf" ? "Multi-TF" : "Single"}</strong>
          </div>
        </div>

        <div className="fx-ai-snapshot-config" data-ai-snapshot-config="true">
          <div className="fx-ai-status-item">
            <span className="fx-ai-label">Candle TF</span>
            <label className="fx-ai-period-label">
              <select
                aria-label="Candle timeframe"
                data-ai-candle-timeframe="true"
                value={candleTf}
                onChange={(e) => setCandleTf(e.target.value as (typeof CANDLE_TIMEFRAMES)[number])}
              >
                {CANDLE_TIMEFRAMES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="fx-ai-status-item">
            <span className="fx-ai-label">Analysis period</span>
            <label className="fx-ai-period-label">
              <select
                aria-label="Analysis period"
                data-ai-analysis-period="true"
                value={analysisPeriod}
                onChange={(e) => setAnalysisPeriod(e.target.value as (typeof ANALYSIS_PERIODS)[number])}
              >
                {ANALYSIS_PERIODS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="fx-ai-status-item">
            <span className="fx-ai-label">Est. candles</span>
            <strong data-ai-candle-estimate="true" className={combinationBlocked ? "fx-ai-estimate-blocked" : undefined}>
              {estimatedCandles == null ? "—" : `~${estimatedCandles}`}
              <span className="fx-ai-muted"> / {MAX_SNAPSHOT_CANDLES}</span>
            </strong>
          </div>
        </div>

        {analysisPeriod === "custom" ? (
          <div className="fx-ai-custom-range" data-ai-custom-range="true">
            <label className="fx-ai-period-label">
              <span className="fx-ai-label">Start UTC</span>
              <input
                type="datetime-local"
                aria-label="Custom range start UTC"
                value={customStartUtc}
                onChange={(e) => setCustomStartUtc(e.target.value)}
              />
            </label>
            <label className="fx-ai-period-label">
              <span className="fx-ai-label">End UTC</span>
              <input
                type="datetime-local"
                aria-label="Custom range end UTC"
                value={customEndUtc}
                onChange={(e) => setCustomEndUtc(e.target.value)}
              />
            </label>
          </div>
        ) : null}

        {combinationBlocked ? (
          <p className="fx-ai-snapshot-warn" role="status" data-ai-combo-blocked="true">
            Combination exceeds the {MAX_SNAPSHOT_CANDLES}-candle limit. Shorten the period or use a coarser candle timeframe.
          </p>
        ) : null}

        <div className="fx-ai-toolbar">
          <div className="fx-ai-controls">
            <div className="fx-ai-mode-toggle" role="group" aria-label="Analysis mode">
              <button type="button" className="fx-text-button" data-active={mode === "single" ? "true" : "false"} onClick={() => setMode("single")}>
                Single
              </button>
              <button type="button" className="fx-text-button" data-active={mode === "mtf" ? "true" : "false"} onClick={() => setMode("mtf")}>
                Multi-TF
              </button>
              <button type="button" className="fx-text-button" data-active={mode === "decision" ? "true" : "false"} onClick={() => setMode("decision")}>
                Decision
              </button>
            </div>
            {mode === "mtf" || mode === "decision" ? (
              <div className="fx-ai-mtf-checks" data-ai-mtf-timeframes="true">
                {MTF_OPTIONS.map((id) => (
                  <label key={id} className="fx-ai-check">
                    <input
                      type="checkbox"
                      checked={mtfSelected.includes(id)}
                      onChange={() => toggleTf(id)}
                    />
                    <span>{id.toUpperCase()}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          <div className="fx-ai-action-stack">
            <button
              type="button"
              className="fx-text-button"
              data-ai-prepare-snapshot-btn="true"
              disabled={snapshotBusy || !marketReady || combinationBlocked}
              onClick={() => void prepareSnapshot()}
            >
              {snapshotBusy ? "Preparing…" : "Prepare snapshot"}
            </button>
            {aiProviderMode === "LOCAL" ? (
              <button
                type="button"
                className="fx-text-button"
                data-ai-local-snapshot-btn="true"
                disabled={!snapshotUsableForLocalAi || anyProviderBusy}
                onClick={() => void runLocalSnapshotAi()}
                title={snapshotUsableForLocalAi ? "Analyze with Local AI only" : "Prepare a usable snapshot first"}
              >
                {localAiBusy ? "Local AI running…" : "Run Local AI"}
              </button>
            ) : null}
            {aiProviderMode === "OPENAI" ? (
              <button
                type="button"
                className="fx-text-button"
                data-ai-openai-snapshot-btn="true"
                disabled={
                  !snapshotUsableForLocalAi
                  || anyProviderBusy
                  || openAiConfigured === false
                }
                onClick={() => void runOpenAiSnapshotAi()}
                title={
                  openAiConfigured === false
                    ? "Configure OpenAI API key in Forex Admin → AI Configuration"
                    : snapshotUsableForLocalAi
                      ? `Analyze with OpenAI (${openAiModel || "saved model"})`
                      : "Prepare a usable snapshot first"
                }
              >
                {openAiBusy ? "OpenAI running…" : `Run OpenAI${openAiModel ? ` (${openAiModel})` : ""}`}
              </button>
            ) : null}
            {aiProviderMode === "COMPARE" ? (
              <button
                type="button"
                className="fx-text-button"
                data-ai-compare-snapshot-btn="true"
                disabled={!snapshotUsableForLocalAi || anyProviderBusy}
                onClick={() => void runCompareSnapshotAi()}
                title="Run Local AI and OpenAI independently on the same snapshot"
              >
                {compareBusy ? "Comparing…" : "Compare Both"}
              </button>
            ) : null}
            <button
              type="button"
              className="fx-text-button fx-ai-analyze-btn"
              data-ai-analyze-btn="true"
              disabled={
                anyProviderBusy
                || phase === "analyzing"
                || !marketReady
                || ((aiProviderMode === "OPENAI" || aiProviderMode === "LOCAL" || aiProviderMode === "COMPARE")
                  && !snapshotUsableForLocalAi)
              }
              onClick={() => runPrimaryAnalyze()}
              title={
                aiProviderMode === "OPENAI"
                  ? "Run OpenAI snapshot analysis and show FXCM ticket guidance"
                  : undefined
              }
            >
              {analyzeLabel}
            </button>
          </div>
        </div>
      </div>

      <div
        className="fx-ai-provider-mode"
        data-ai-provider-mode={aiProviderMode}
        data-ai-provider-busy={anyProviderBusy ? "true" : "false"}
      >
        <span className="fx-ai-label">AI engine</span>
        <div className="fx-ai-provider-toggle" role="group" aria-label="AI provider mode">
          <button
            type="button"
            className="fx-text-button"
            data-active={aiProviderMode === "LOCAL" ? "true" : "false"}
            data-ai-provider-local="true"
            disabled={anyProviderBusy}
            onClick={() => setAiProviderMode("LOCAL")}
          >
            Local AI
          </button>
          <button
            type="button"
            className="fx-text-button"
            data-active={aiProviderMode === "OPENAI" ? "true" : "false"}
            data-ai-provider-openai="true"
            disabled={anyProviderBusy}
            onClick={() => setAiProviderMode("OPENAI")}
          >
            OpenAI
          </button>
          <button
            type="button"
            className="fx-text-button"
            data-active={aiProviderMode === "COMPARE" ? "true" : "false"}
            data-ai-provider-compare="true"
            disabled={anyProviderBusy}
            onClick={() => setAiProviderMode("COMPARE")}
          >
            Compare Both
          </button>
        </div>
        <strong data-ai-provider-selected="true">
          {aiProviderMode === "LOCAL"
            ? "Local AI only"
            : aiProviderMode === "OPENAI"
              ? "OpenAI only"
              : "Compare Both"}
        </strong>
        {aiProviderMode !== "LOCAL" && openAiModel ? (
          <span className="fx-ai-muted" data-ai-openai-model-will-use="true">
            OpenAI model: {openAiModel}
            {openAiModelEligible === false ? " (ineligible — update in Admin)" : ""}
          </span>
        ) : null}
      </div>

      <div className="fx-ai-trade-budget" data-ai-trade-budget="true">
        <span className="fx-ai-label">Trade allocation</span>
        <input
          type="number"
          min="0"
          step="any"
          aria-label="Trade allocation amount"
          data-ai-trade-alloc-amount="true"
          value={tradeAllocAmount}
          disabled={anyProviderBusy}
          onChange={(e) => {
            const amount = e.target.value;
            setTradeAllocAmount(amount);
            writeTradeAllocation({ amount, currency: tradeAllocCurrency });
            if (tradeAllocError) setTradeAllocError(null);
          }}
        />
        <input
          type="text"
          maxLength={3}
          aria-label="Trade allocation currency"
          data-ai-trade-alloc-currency="true"
          value={tradeAllocCurrency}
          disabled={anyProviderBusy}
          onChange={(e) => {
            const currency = e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
            setTradeAllocCurrency(currency);
            writeTradeAllocation({ amount: tradeAllocAmount, currency });
            if (tradeAllocError) setTradeAllocError(null);
          }}
        />
        <span className="fx-ai-muted">
          Capital set aside for this trade — not an acceptable loss. Risk budget remains Admin Phase 45 settings.
        </span>
        {tradeAllocError ? (
          <span className="fx-ai-snapshot-warn" role="status">{tradeAllocError}</span>
        ) : null}
      </div>

      {snapshot || snapshotError ? (
        <div
          className="fx-ai-snapshot-status"
          data-ai-snapshot-status="true"
          data-ai-snapshot-stale={snapshotStale ? "true" : "false"}
        >
          {snapshot ? (
            <>
              <ForexStatusBadge tone={snapshot.evidenceReady && !snapshotStale ? "live" : "future"}>
                {snapshotStale ? "STALE_SELECTION" : snapshot.validationStatus}
              </ForexStatusBadge>
              <span className="fx-ai-muted" data-ai-snapshot-coverage="true">
                closed {snapshot.closedCandleCount ?? "—"}/
                {(snapshot.expectedClosedCandles ?? snapshot.candlesRequestedEstimate) || "?"}
                {snapshot.formingCandleCount != null
                  ? ` · forming ${snapshot.formingCandleCount}`
                  : ""}
                {" · "}{snapshot.candleTimeframe}/{snapshot.analysisPeriod}
                {" · "}cov {(snapshot.coverageRatio * 100).toFixed(0)}%
                {" · "}quote {snapshot.quoteFreshness}
                {snapshot.windowBoundaryPolicy ? ` · ${snapshot.windowBoundaryPolicy}` : ""}
                {snapshot.resampled ? " · resampled" : ""}
                {snapshot.latencyMs != null ? ` · ${snapshot.latencyMs} ms` : ""}
              </span>
              {snapshot.requestedStartUtc && snapshot.requestedEndUtc ? (
                <span className="fx-ai-mono" data-ai-snapshot-range="true" title="Requested UTC range">
                  req {snapshot.requestedStartUtc.replace(".000Z", "Z")} → {snapshot.requestedEndUtc.replace(".000Z", "Z")}
                </span>
              ) : null}
              {snapshot.returnedStartUtc && snapshot.returnedEndUtc ? (
                <span className="fx-ai-mono" data-ai-snapshot-returned="true" title="Returned candle coverage">
                  ret {snapshot.returnedStartUtc.replace(".000Z", "Z")} → {snapshot.returnedEndUtc.replace(".000Z", "Z")}
                </span>
              ) : null}
              {snapshot.gapCount > 0 ? (
                <span className="fx-ai-muted">
                  gaps {snapshot.gapCount}
                  {snapshot.closureGapCount ? ` (${snapshot.closureGapCount} closure)` : ""}
                </span>
              ) : null}
              <span className="fx-ai-mono" title={snapshot.snapshotId}>
                id {snapshot.snapshotId.slice(0, 8)}
              </span>
              <span className="fx-ai-mono" title={snapshot.contentFingerprint}>
                fp {snapshot.contentFingerprint.slice(0, 12)}
              </span>
              {snapshotStale ? (
                <span className="fx-ai-snapshot-warn">Selection changed — prepare a new snapshot.</span>
              ) : null}
              {!snapshotStale && snapshot.warnings.length ? (
                <span className="fx-ai-snapshot-warn" title={snapshot.warnings.join(" · ")}>
                  {snapshot.warnings[0]}
                </span>
              ) : null}
            </>
          ) : null}
          {snapshotError ? (
            <span className="fx-ai-snapshot-warn" role="status">{snapshotError}</span>
          ) : null}
        </div>
      ) : null}

      {openAiConfigured != null && aiProviderMode !== "LOCAL" ? (
        <div className="fx-ai-openai-status" data-ai-openai-config-status="true">
          <span className="fx-ai-label">OpenAI</span>
          <ForexStatusBadge tone={openAiConfigured && openAiVaultUnlocked ? "live" : "future"}>
            {openAiConfigured ? (openAiVaultUnlocked ? "CONFIGURED" : "VAULT LOCKED") : "NOT CONFIGURED"}
          </ForexStatusBadge>
          <span className="fx-ai-muted">
            {openAiConfigured
              ? `Key stored server-side. Model: ${openAiModel || "—"}`
              : "Set key in Forex Admin → AI Configuration (/admin/forex/ai-configuration)."}
          </span>
        </div>
      ) : null}

      {compareUi || compareError ? (
        <div className="fx-ai-compare-result" data-ai-compare-result="true" data-ai-compare-status={compareUi?.status ?? "error"}>
          {compareUi ? (
            <>
              <div className="fx-ai-local-head">
                <ForexStatusBadge tone={compareUi.status === "both_ok" ? "live" : "future"}>
                  {compareUi.status.toUpperCase()}
                </ForexStatusBadge>
                <span className="fx-ai-muted">
                  decisions {compareUi.decisionsAgree ? "agree" : "differ"}
                  {" · "}bias {compareUi.biasAgree ? "agree" : "differ"}
                  {compareUi.latencyMs != null ? ` · ${compareUi.latencyMs} ms` : ""}
                </span>
                <span className="fx-ai-mono" title={compareUi.snapshotId}>
                  snap {compareUi.snapshotId.slice(0, 8)}
                </span>
                <span className="fx-ai-mono" title={compareUi.contentFingerprint}>
                  fp {compareUi.contentFingerprint.slice(0, 12)}
                </span>
              </div>
              <p className="fx-ai-local-rationale">{compareUi.note}</p>
              <div className="fx-ai-compare-grid">
                <div>
                  <span className="fx-ai-label">Local</span>
                  <p>{compareUi.localDecision ?? "—"} / {compareUi.localBias ?? "—"}</p>
                </div>
                <div>
                  <span className="fx-ai-label">OpenAI</span>
                  <p>{compareUi.openaiDecision ?? "—"} / {compareUi.openaiBias ?? "—"}</p>
                </div>
                <div>
                  <span className="fx-ai-label">Plan verdict</span>
                  <p>{compareUi.planVerdict ?? (compareUi.comparisonComplete ? "—" : "INSUFFICIENT_DATA")}</p>
                </div>
                <div>
                  <span className="fx-ai-label">Comparison</span>
                  <p>{compareUi.comparisonComplete ? "COMPLETE" : "INCOMPLETE (partial)"}</p>
                </div>
              </div>
              {compareUi.waitConflict ? (
                <p className="fx-ai-snapshot-warn" data-ai-wait-conflict="true" role="status">
                  {compareUi.waitConflictReason || "WAIT / CONFLICT — material provider disagreement."}
                </p>
              ) : null}
              {compareUi.sharedEvidence.length ? (
                <p className="fx-ai-muted">
                  <span className="fx-ai-label">Shared evidence</span>{" "}
                  {compareUi.sharedEvidence.slice(0, 4).join(" · ")}
                </p>
              ) : null}
              {compareUi.warnings[0] ? (
                <p className="fx-ai-snapshot-warn">{compareUi.warnings[0]}</p>
              ) : null}
            </>
          ) : null}
          {compareError ? (
            <div className="fx-ai-local-error" role="alert">
              <span className="fx-ai-snapshot-warn">{compareError}</span>
              <button
                type="button"
                className="fx-text-button"
                disabled={!snapshotUsableForLocalAi || anyProviderBusy}
                onClick={() => void runCompareSnapshotAi()}
              >
                Retry compare
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className="fx-ai-provider-panels"
        data-compare={aiProviderMode === "COMPARE" ? "true" : "false"}
        data-forex-ai-phase44="true"
      >
        {(aiProviderMode === "LOCAL" || aiProviderMode === "COMPARE")
          && (localAiBusy || localAi || localAiError) ? (
          <SnapshotProviderResultPanel
            title="Local AI"
            busy={localAiBusy}
            error={localAiError}
            data={localAi}
            dataAttr="local"
            retryDisabled={!snapshotUsableForLocalAi || anyProviderBusy}
            onRetry={() => void (aiProviderMode === "COMPARE" ? runCompareSnapshotAi() : runLocalSnapshotAi())}
          />
        ) : null}
        {(aiProviderMode === "OPENAI" || aiProviderMode === "COMPARE")
          && (openAiBusy || openAi || openAiError) ? (
          <SnapshotProviderResultPanel
            title="OpenAI"
            busy={openAiBusy}
            error={openAiError}
            data={openAi}
            dataAttr="openai"
            retryDisabled={!snapshotUsableForLocalAi || anyProviderBusy || openAiConfigured === false}
            onRetry={() => void (aiProviderMode === "COMPARE" ? runCompareSnapshotAi() : runOpenAiSnapshotAi())}
          />
        ) : null}
      </div>

      {healthError ? (
        <div className="fx-ai-alert" data-ai-health-error="true" role="alert">
          <ForexStatusBadge tone="offline">AI unavailable</ForexStatusBadge>
          <span>{healthError}</span>
        </div>
      ) : null}

      {!marketReady ? (
        <div className="fx-ai-alert fx-ai-alert-info">
          <span className="fx-ai-muted">Select a BINANCE, FXCM, or FOREXCONNECT instrument from Markets to run analysis.</span>
        </div>
      ) : null}

      {binanceSelected && liveTicker ? (
        <AiPanel title="Live ticker" data-ai-live-ticker="true" meta={<span className="fx-ai-muted">Separate from AI snapshot</span>}>
          <LiveTickerPanel snapshot={liveTicker} expectedSymbol={selectedMarket!.symbol} />
        </AiPanel>
      ) : null}

      {phase === "analyzing" ? (
        <div className="fx-ai-alert fx-ai-alert-busy" data-ai-analyzing="true" role="status">
          <ForexStatusBadge tone="future">ANALYZING</ForexStatusBadge>
          <div>
            <p>
              {mode === "decision"
                ? "Building market states, scenario engines, and local AI narrative…"
                : mode === "mtf"
                  ? "Building per-timeframe market states and alignment…"
                  : "Building market state and waiting for local AI…"}
            </p>
            <p className="fx-ai-muted">Local inference may take 1–3 minutes. No fake progress.</p>
          </div>
        </div>
      ) : null}

      {phase === "error" ? (
        <div className="fx-ai-alert" data-ai-analyze-error="true" role="alert">
          <ForexStatusBadge tone="offline">{analyzeCode || "ERROR"}</ForexStatusBadge>
          <span>{analyzeError}</span>
        </div>
      ) : null}

      {single && mode === "single" ? (
        <div className="fx-ai-result" data-ai-analysis-result="true">
          <AiPanel title="Local AI analysis">
            <dl className="fx-ai-kv">
              <div><dt>Market</dt><dd data-ai-result-symbol="true">{single.market.displaySymbol}</dd></div>
              <div><dt>Timeframe</dt><dd data-ai-result-timeframe="true">{single.market.timeframe}</dd></div>
              <div><dt>Data</dt><dd><ForexStatusBadge tone={toneForState(single.dataQuality.status)}>{single.dataQuality.status}</ForexStatusBadge></dd></div>
              <div><dt>Market update</dt><dd>{formatTs(single.dataQuality.marketTimestamp)}</dd></div>
              <div><dt>Generated</dt><dd>{formatTs(single.generatedAt)}</dd></div>
              <div><dt>Posture</dt><dd>{single.decisionPosture}</dd></div>
            </dl>
            {latencyMs != null ? <p className="fx-ai-muted">Latency {latencyMs} ms</p> : null}
          </AiPanel>
          <EvidencePanel
            pack={single.evidencePack}
            model={single.model}
            inferenceLatencyMs={single.inferenceLatencyMs}
            inferenceStatus={single.inferenceStatus}
          />
          <AiPanel title="Summary">
            <p data-ai-summary="true" className="fx-ai-body-text">{single.summary}</p>
          </AiPanel>
          <AiPanel title="Observed facts">
            <ul>{single.observedFacts.map((f) => <li key={f}>{f}</li>)}</ul>
          </AiPanel>
          <div className="fx-ai-grid">
            <AiPanel title="Trend"><p><strong>{single.trend.direction}</strong></p><p className="fx-ai-muted">{single.trend.explanation || "—"}</p></AiPanel>
            <AiPanel title="Momentum"><p><strong>{single.momentum.state}</strong></p><p className="fx-ai-muted">{single.momentum.explanation || "—"}</p></AiPanel>
            <AiPanel title="Volatility"><p><strong>{single.volatility.state}</strong></p><p className="fx-ai-muted">{single.volatility.explanation || "—"}</p></AiPanel>
            <AiPanel title="Structure"><p><strong>{single.marketStructure.state}</strong></p><p className="fx-ai-muted">{single.marketStructure.explanation || "—"}</p></AiPanel>
          </div>
          <AiPanel title="Scenarios">
            <ul>{single.scenarios.map((s, i) => <li key={`${s.type}-${i}`}><strong>{s.name || s.type}</strong> — {s.reasoning}</li>)}</ul>
          </AiPanel>
          <AiPanel title="Knowledge sources">
            {single.knowledgeSources.length === 0 ? <p className="fx-ai-muted">None matched.</p> : (
              <ul>{single.knowledgeSources.map((k) => <li key={k.documentId}>{k.title}</li>)}</ul>
            )}
          </AiPanel>
        </div>
      ) : null}

      {mtf && mode === "mtf" ? (
        <div className="fx-ai-result" data-ai-mtf-result="true" data-ai-analysis-result="true">
          <AiPanel title="Multi-timeframe analysis">
            <dl className="fx-ai-kv">
              <div><dt>Market</dt><dd data-ai-result-symbol="true">{mtf.market.displaySymbol}</dd></div>
              <div><dt>Alignment</dt><dd data-ai-mtf-alignment="true"><ForexStatusBadge tone={toneForState(mtf.overallAlignment.overall)}>{mtf.overallAlignment.overall}</ForexStatusBadge></dd></div>
              <div><dt>Data</dt><dd><ForexStatusBadge tone={toneForState(mtf.dataQuality.status)}>{mtf.dataQuality.status}</ForexStatusBadge></dd></div>
              <div><dt>Narrative</dt><dd data-ai-mtf-narrative="true">{mtf.narrativeStatus}</dd></div>
              <div><dt>Generated</dt><dd>{formatTs(mtf.generatedAt)}</dd></div>
              <div><dt>Posture</dt><dd>{mtf.decisionPosture}</dd></div>
            </dl>
            {latencyMs != null ? (
              <p className="fx-ai-muted" data-ai-latency="true">
                Latency {latencyMs} ms
                {diagnostics?.promptChars != null ? ` · prompt ${String(diagnostics.promptChars)} chars` : ""}
                {diagnostics?.marketStateMs != null ? ` · market-state ${String(diagnostics.marketStateMs)} ms` : ""}
                {diagnostics?.knowledgeHits != null ? ` · knowledge ${String(diagnostics.knowledgeHits)}` : ""}
              </p>
            ) : null}
          </AiPanel>

          <EvidencePanel
            pack={mtf.evidencePack}
            model={mtf.model}
            inferenceLatencyMs={mtf.inferenceLatencyMs}
            inferenceStatus={mtf.inferenceStatus}
          />

          <AiPanel title="Higher timeframe bias">
            <p><strong>{mtf.higherTimeframeBias.direction}</strong></p>
            <ul>{mtf.higherTimeframeBias.basis.map((b) => <li key={b}>{b}</li>)}</ul>
            <p className="fx-ai-muted">Intermediate: {mtf.intermediateTimeframeState} · Lower: {mtf.lowerTimeframeState}</p>
          </AiPanel>

          <div className="fx-ai-mtf-cards" data-ai-mtf-cards="true">
            {mtf.timeframeStates.map((state) => (
              <AiPanel key={state.timeframe} title={`${state.timeframe.toUpperCase()} · ${state.role}`} data-ai-mtf-card={state.timeframe}>
                <p><ForexStatusBadge tone={toneForState(state.status)}>{state.status}</ForexStatusBadge></p>
                {state.usable ? (
                  <ul>
                    <li>Trend: {state.trend ?? "—"}</li>
                    <li>Momentum: {state.momentum ?? "—"}</li>
                    <li>Volatility: {state.volatility ?? "—"}</li>
                    <li>RSI: {state.rsi == null ? "unavailable" : state.rsi}</li>
                    <li>Structure: {state.structure ?? "—"}</li>
                    <li>Updated: {formatTs(state.timestamp)}</li>
                  </ul>
                ) : (
                  <p className="fx-ai-muted">NO DATA — {state.reason || state.status}</p>
                )}
                <p className="fx-ai-muted">
                  {mtf.timeframeAnalysis.find((t) => t.timeframe === state.timeframe)?.interpretation || "—"}
                </p>
              </AiPanel>
            ))}
          </div>

          <div className="fx-ai-grid">
            <AiPanel title="Confluence">
              <ul>{(mtf.confluence.length ? mtf.confluence : ["None"]).map((c) => <li key={c}>{c}</li>)}</ul>
            </AiPanel>
            <AiPanel title="Conflicts">
              <ul>{(mtf.conflicts.length ? mtf.conflicts : ["None"]).map((c) => <li key={c}>{c}</li>)}</ul>
            </AiPanel>
          </div>

          <AiPanel title="Scenarios" meta={<span className="fx-ai-muted">Analytical only</span>}>
            <ul>
              {mtf.scenarios.map((s, i) => (
                <li key={`${s.type}-${i}`}>
                  <strong>{s.name || s.type}</strong> — {s.reasoning}
                </li>
              ))}
            </ul>
          </AiPanel>

          <div className="fx-ai-grid">
            <AiPanel title="Confirmation needed">
              <ul>{(mtf.confirmationNeeded.length ? mtf.confirmationNeeded : ["—"]).map((x) => <li key={x}>{x}</li>)}</ul>
            </AiPanel>
            <AiPanel title="Invalidation">
              <ul>{(mtf.invalidationConditions.length ? mtf.invalidationConditions : ["—"]).map((x) => <li key={x}>{x}</li>)}</ul>
            </AiPanel>
          </div>

          <AiPanel title="Risks / limitations">
            <ul>{[...mtf.risks, ...mtf.limitations].map((x, i) => <li key={`${x}-${i}`}>{x}</li>)}</ul>
          </AiPanel>

          <AiPanel title="Knowledge sources">
            {mtf.knowledgeSources.length === 0 ? (
              <p className="fx-ai-muted">No published indexed knowledge matched.</p>
            ) : (
              <ul data-ai-knowledge-sources="true">
                {mtf.knowledgeSources.map((k) => (
                  <li key={k.documentId}>{k.title} · v{k.version}</li>
                ))}
              </ul>
            )}
          </AiPanel>
        </div>
      ) : null}

      {decision && mode === "decision" && aiProviderMode !== "OPENAI" ? (
        <div className="fx-ai-result" data-ai-decision-result="true" data-ai-analysis-result="true">
          <AiPanel title="Decision analysis">
            <dl className="fx-ai-kv">
              <div><dt>Market</dt><dd data-ai-result-symbol="true">{decision.market.displaySymbol}</dd></div>
              <div><dt>Price</dt><dd data-ai-decision-price="true">{decision.market.currentPrice ?? "UNAVAILABLE"}</dd></div>
              <div><dt>Data</dt><dd><ForexStatusBadge tone={toneForState(decision.dataQuality.status)}>{decision.dataQuality.status}</ForexStatusBadge></dd></div>
              <div><dt>Alignment</dt><dd><ForexStatusBadge tone={toneForState(decision.alignment.overall)}>{decision.alignment.overall}</ForexStatusBadge></dd></div>
              <div><dt>Posture</dt><dd data-ai-decision-posture="true"><ForexStatusBadge tone={toneForState(decision.decisionPosture)}>{decision.decisionPosture}</ForexStatusBadge></dd></div>
              <div><dt>Narrative</dt><dd>{decision.narrativeStatus}</dd></div>
              <div><dt>Generated</dt><dd>{formatTs(decision.generatedAt)}</dd></div>
              <div><dt>Confidence</dt><dd data-ai-confidence="true">{decision.confidence === null ? "null" : String(decision.confidence)}</dd></div>
            </dl>
            {latencyMs != null ? (
              <p className="fx-ai-muted" data-ai-latency="true">
                Latency {latencyMs} ms
                {diagnostics?.promptChars != null ? ` · prompt ${String(diagnostics.promptChars)} chars` : ""}
                {diagnostics?.marketStateMs != null ? ` · market-state ${String(diagnostics.marketStateMs)} ms` : ""}
                {diagnostics?.deterministicMs != null ? ` · deterministic ${String(diagnostics.deterministicMs)} ms` : ""}
                {diagnostics?.knowledgeHits != null ? ` · knowledge ${String(diagnostics.knowledgeHits)}` : ""}
              </p>
            ) : null}
          </AiPanel>

          <EvidencePanel
            pack={decision.evidencePack}
            model={decision.model}
            inferenceLatencyMs={decision.inferenceLatencyMs}
            inferenceStatus={decision.inferenceStatus}
          />

          <div className="fx-ai-grid fx-ai-grid-primary">
            <AiPanel title="Scenario" data-ai-decision-scenario="true">
              <p><strong>{decision.scenario.name}</strong> · {decision.scenario.direction}</p>
              <p className="fx-ai-muted">{decision.scenario.type}</p>
              <ul>{decision.scenario.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
              {decision.scenario.notes.length ? (
                <ul className="fx-ai-muted">{decision.scenario.notes.map((n) => <li key={n}>{n}</li>)}</ul>
              ) : null}
            </AiPanel>

            <AiPanel title="Entry zone" data-ai-decision-entry="true">
              <p><ForexStatusBadge tone={toneForState(decision.entryZone.status)}>{decision.entryZone.status}</ForexStatusBadge></p>
              {decision.entryZone.status === "UNAVAILABLE" ? (
                <p className="fx-ai-muted">{decision.entryZone.unavailableReason || "ENTRY_ZONE_UNAVAILABLE"}</p>
              ) : (
                <dl className="fx-ai-kv">
                  <div><dt>Range</dt><dd>{decision.entryZone.lowerBound} – {decision.entryZone.upperBound}</dd></div>
                  <div><dt>Reference</dt><dd>{decision.entryZone.referencePrice ?? "—"}</dd></div>
                  <div><dt>Timeframe</dt><dd>{decision.entryZone.timeframe ?? "—"}</dd></div>
                  <div><dt>Invalidation</dt><dd>{decision.entryZone.invalidationLevel ?? "—"}</dd></div>
                </dl>
              )}
              {decision.entryZone.basis.length ? (
                <ul className="fx-ai-muted">{decision.entryZone.basis.map((b) => <li key={b}>{b}</li>)}</ul>
              ) : null}
            </AiPanel>
          </div>

          <div className="fx-ai-grid">
            <AiPanel title="Confirmation" data-ai-decision-confirmation="true">
              <p className="fx-ai-muted">{decision.confirmation.summary}</p>
              <ul>
                {decision.confirmation.conditions.map((c) => (
                  <li key={c.id}>
                    <ForexStatusBadge tone={toneForState(c.status)}>{c.status}</ForexStatusBadge>
                    {" "}
                    {c.description}
                    {c.observedValue ? ` · observed ${c.observedValue}` : ""}
                  </li>
                ))}
              </ul>
            </AiPanel>
            <AiPanel title="Invalidation" data-ai-decision-invalidation="true">
              <p className="fx-ai-muted">{decision.invalidation.summary}</p>
              <ul>
                {decision.invalidation.conditions.map((c) => (
                  <li key={c.id}>
                    <ForexStatusBadge tone={toneForState(c.status)}>{c.status}</ForexStatusBadge>
                    {" "}
                    {c.description}
                    {c.level != null ? ` · level ${c.level}` : ""}
                  </li>
                ))}
              </ul>
            </AiPanel>
          </div>

          <AiPanel title="Risk context" data-ai-decision-risk="true">
            <dl className="fx-ai-kv">
              <div><dt>Volatility</dt><dd>{decision.riskContext.volatility ?? "—"}</dd></div>
              <div><dt>ATR</dt><dd>{decision.riskContext.atr ?? "—"}</dd></div>
              <div><dt>To entry</dt><dd>{decision.riskContext.distanceToEntry ?? "—"}</dd></div>
              <div><dt>To invalidation</dt><dd>{decision.riskContext.distanceToInvalidation ?? "—"}</dd></div>
              <div><dt>R:R</dt><dd data-ai-decision-rr="true">{decision.riskReward.ratio ?? decision.riskReward.unavailableReason ?? "null"}</dd></div>
              <div><dt>SL</dt><dd>{decision.stopLossCandidate ?? "null"}</dd></div>
              <div><dt>TP</dt><dd>{decision.takeProfitCandidates.length ? decision.takeProfitCandidates.join(", ") : "none"}</dd></div>
            </dl>
            <ul>{decision.riskContext.factors.map((f) => <li key={f}>{f}</li>)}</ul>
          </AiPanel>

          <div className="fx-ai-grid">
            <AiPanel title="Observed facts">
              <ul>{decision.observedFacts.map((f) => <li key={f}>{f}</li>)}</ul>
              <h4>Deterministic summary</h4>
              <p data-ai-decision-deterministic="true" className="fx-ai-body-text">{decision.deterministicSummary}</p>
            </AiPanel>
            <AiPanel title="Local AI interpretation">
              {decision.aiInterpretation ? (
                <p data-ai-decision-interpretation="true" className="fx-ai-body-text">{decision.aiInterpretation}</p>
              ) : (
                <p className="fx-ai-muted">None — deterministic engines only (local AI narrative unavailable or skipped).</p>
              )}
            </AiPanel>
          </div>

          <div className="fx-ai-mtf-cards">
            {decision.timeframeStates.map((state) => (
              <AiPanel key={state.timeframe} title={state.timeframe.toUpperCase()} data-ai-mtf-card={state.timeframe}>
                <p><ForexStatusBadge tone={toneForState(state.status)}>{state.status}</ForexStatusBadge></p>
                {state.usable ? (
                  <ul>
                    <li>Trend: {state.trend ?? "—"}</li>
                    <li>Momentum: {state.momentum ?? "—"}</li>
                    <li>RSI: {state.rsi == null ? "unavailable" : state.rsi}</li>
                    <li>Updated: {formatTs(state.timestamp)}</li>
                  </ul>
                ) : (
                  <p className="fx-ai-muted">NO DATA</p>
                )}
              </AiPanel>
            ))}
          </div>

          <div className="fx-ai-grid">
            <AiPanel title="Knowledge sources">
              {decision.knowledgeSources.length === 0 ? (
                <p className="fx-ai-muted">No published indexed knowledge matched.</p>
              ) : (
                <ul data-ai-knowledge-sources="true">
                  {decision.knowledgeSources.map((k) => (
                    <li key={k.documentId}>{k.title} · v{k.version}</li>
                  ))}
                </ul>
              )}
            </AiPanel>
            <AiPanel title="Limitations">
              <ul>{decision.limitations.map((x, i) => <li key={`${x}-${i}`}>{x}</li>)}</ul>
            </AiPanel>
          </div>
        </div>
      ) : null}
    </section>
  );
}
