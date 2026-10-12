import { useCallback, useEffect, useState, type HTMLAttributes, type ReactNode } from "react";
import { ForexStatusBadge } from "./components/ForexStatusBadge";
import type { SelectedMarket } from "./market-data/selected-market";
import type { ChartTimeframeId } from "./chart/types";
import type { LiveTickerSnapshot } from "../../ai/market-data/binance/types";
import { LiveTickerPanel } from "./LiveTickerPanel";

const MTF_DEFAULT = ["4h", "1h", "30m", "15m", "5m"] as const;
const MTF_OPTIONS = ["4h", "1h", "30m", "15m", "5m", "1d"] as const;

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

  const analyzeLabel = phase === "analyzing"
    ? "Analyzing…"
    : mode === "decision"
      ? (decision ? "Analyze Decision again" : "Analyze Decision")
      : mode === "mtf"
        ? (mtf ? "Analyze Multi-Timeframe again" : "Analyze Multi-Timeframe")
        : (single ? "Analyze again" : "Analyze Market");

  return (
    <section
      className="fx-module-page fx-ai-analysis"
      data-forex-page="ai-analysis"
      data-forex-ai-foundation="true"
      data-forex-ai-phase20="true"
      data-forex-ai-phase21="true"
      data-forex-ai-phase22="true"
      data-ai-mode={mode}
      data-ai-phase={phase}
      data-ai-provider={marketReady ? provider : ""}
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
              <span className="fx-ai-label">Timeframe</span>
              <strong data-ai-market-timeframe="true">{tf}</strong>
            </div>
          ) : (
            <div className="fx-ai-status-item">
              <span className="fx-ai-label">Timeframes</span>
              <strong>{mtfSelected.map((t) => t.toUpperCase()).join(" · ")}</strong>
            </div>
          )}
          <div className="fx-ai-status-item">
            <span className="fx-ai-label">AI mode</span>
            <strong>{mode === "decision" ? "Decision" : mode === "mtf" ? "Multi-TF" : "Single"}</strong>
          </div>
        </div>

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
          <button
            type="button"
            className="fx-text-button fx-ai-analyze-btn"
            data-ai-analyze-btn="true"
            disabled={phase === "analyzing" || !marketReady}
            onClick={() => void runAnalysis()}
          >
            {analyzeLabel}
          </button>
        </div>
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

      {decision && mode === "decision" ? (
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
