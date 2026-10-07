import { useCallback, useEffect, useState } from "react";
import { ForexSectionHeader } from "./components/ForexSectionHeader";
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
  knowledgeSources: Array<{ documentId: string; title: string; relevanceScore: number; version: number }>;
  limitations: string[];
  decisionPosture: string;
  confidence: null;
  model: string | null;
  reasoning: string;
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
  knowledgeSources: Array<{ documentId: string; title: string; relevanceScore: number; version: number }>;
  limitations: string[];
  decisionPosture: string;
  confidence: null;
  model: string | null;
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
  knowledgeSources: Array<{ documentId: string; title: string; relevanceScore: number; version: number }>;
  limitations: string[];
  confidence: null;
  model: string | null;
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
    if (!binanceSelected || !selectedMarket) {
      setPhase("error");
      setAnalyzeCode("DATA_UNAVAILABLE");
      setAnalyzeError("Select a Binance Spot symbol from Markets before analyzing.");
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
        ? { symbol: selectedMarket.symbol, timeframes: mtfSelected, analysisType: "MARKET_OVERVIEW" }
        : { symbol: selectedMarket.symbol, timeframe: tf, analysisType: "MARKET_OVERVIEW" };
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
  }, [binanceSelected, selectedMarket, mode, mtfSelected, tf]);

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
      aria-labelledby="fx-page-ai-analysis"
    >
      <ForexSectionHeader
        eyebrow="AI Trading"
        title="AI Market Analysis"
        description="Single-timeframe, multi-timeframe, and decision analysis from Binance Market State + Forex Knowledge. Interpretive only — not trade execution."
      />
      <h2 id="fx-page-ai-analysis" className="fx-sr-only">AI Market Analysis</h2>

      <div className="fx-placeholder-panel">
        <div className="fx-ai-toolbar">
          <div>
            <p className="fx-panel-meta">
              Market: <strong data-ai-market-symbol="true">{binanceSelected ? selectedMarket!.displaySymbol : "None selected"}</strong>
              {mode === "single" ? <> · Timeframe <strong data-ai-market-timeframe="true">{tf}</strong></> : null}
            </p>
            <div className="fx-ai-mode-toggle" role="group" aria-label="Analysis mode">
              <button type="button" className="fx-text-button" data-active={mode === "single" ? "true" : "false"} onClick={() => setMode("single")}>
                Single Timeframe
              </button>
              <button type="button" className="fx-text-button" data-active={mode === "mtf" ? "true" : "false"} onClick={() => setMode("mtf")}>
                Multi-Timeframe
              </button>
              <button type="button" className="fx-text-button" data-active={mode === "decision" ? "true" : "false"} onClick={() => setMode("decision")}>
                Decision
              </button>
            </div>
            {mode === "mtf" || mode === "decision" ? (
              <div className="fx-ai-mtf-checks" data-ai-mtf-timeframes="true">
                {MTF_OPTIONS.map((id) => (
                  <label key={id}>
                    <input
                      type="checkbox"
                      checked={mtfSelected.includes(id)}
                      onChange={() => toggleTf(id)}
                    />
                    {" "}
                    {id.toUpperCase()}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="fx-text-button fx-ai-analyze-btn"
            data-ai-analyze-btn="true"
            disabled={phase === "analyzing" || !binanceSelected}
            onClick={() => void runAnalysis()}
          >
            {phase === "analyzing"
              ? "Analyzing…"
              : mode === "decision"
                ? (decision ? "Analyze Decision again" : "Analyze Decision")
                : mode === "mtf"
                  ? (mtf ? "Analyze Multi-Timeframe again" : "Analyze Multi-Timeframe")
                  : (single ? "Analyze again" : "Analyze Market")}
          </button>
        </div>
        {healthError ? <p data-ai-health-error="true"><ForexStatusBadge tone="offline">AI unavailable</ForexStatusBadge> {healthError}</p> : null}
        {health ? (
          <p>
            <ForexStatusBadge tone={toneForState(health.state)}>{health.state}</ForexStatusBadge>
            {" · Model "}
            <strong>{health.preferredModel}</strong>
          </p>
        ) : null}
      </div>

      {binanceSelected && liveTicker ? (
        <div className="fx-placeholder-panel" data-ai-live-ticker="true">
          <h3>Live market (separate from AI snapshot)</h3>
          <LiveTickerPanel snapshot={liveTicker} expectedSymbol={selectedMarket!.symbol} />
        </div>
      ) : null}

      {phase === "analyzing" ? (
        <div className="fx-placeholder-panel" data-ai-analyzing="true">
          <ForexStatusBadge tone="future">ANALYZING</ForexStatusBadge>
          <p>
            {mode === "decision"
              ? "Building Market States, running scenario/entry/confirmation engines, retrieving knowledge, waiting for Ollama…"
              : mode === "mtf"
                ? "Building Market States per timeframe, computing alignment, retrieving knowledge, waiting for Ollama…"
                : "Building Market State, retrieving knowledge, waiting for Ollama…"}
          </p>
          <p className="fx-panel-meta">No fake progress percentage. Ollama may take 1–3 minutes.</p>
        </div>
      ) : null}

      {phase === "error" ? (
        <div className="fx-placeholder-panel" data-ai-analyze-error="true">
          <ForexStatusBadge tone="offline">{analyzeCode || "ERROR"}</ForexStatusBadge>
          <p>{analyzeError}</p>
        </div>
      ) : null}

      {single && mode === "single" ? (
        <div className="fx-ai-result" data-ai-analysis-result="true">
          <div className="fx-placeholder-panel">
            <h3>AI MARKET ANALYSIS</h3>
            <dl className="fx-ohlc">
              <div><dt>Market</dt><dd data-ai-result-symbol="true">{single.market.displaySymbol}</dd></div>
              <div><dt>Timeframe</dt><dd data-ai-result-timeframe="true">{single.market.timeframe}</dd></div>
              <div><dt>Data status</dt><dd><ForexStatusBadge tone={toneForState(single.dataQuality.status)}>{single.dataQuality.status}</ForexStatusBadge></dd></div>
              <div><dt>Market update</dt><dd>{formatTs(single.dataQuality.marketTimestamp)}</dd></div>
              <div><dt>Analysis generated</dt><dd>{formatTs(single.generatedAt)}</dd></div>
              <div><dt>Decision posture</dt><dd>{single.decisionPosture}</dd></div>
            </dl>
            {latencyMs != null ? <p className="fx-panel-meta">Inference latency: {latencyMs} ms</p> : null}
          </div>
          <div className="fx-placeholder-panel"><h3>Summary</h3><p data-ai-summary="true">{single.summary}</p></div>
          <div className="fx-placeholder-panel">
            <h3>Observed Market Facts</h3>
            <ul>{single.observedFacts.map((f) => <li key={f}>{f}</li>)}</ul>
          </div>
          <div className="fx-ai-grid">
            <div className="fx-placeholder-panel"><h3>Trend</h3><p><strong>{single.trend.direction}</strong></p><p className="fx-panel-meta">{single.trend.explanation || "—"}</p></div>
            <div className="fx-placeholder-panel"><h3>Momentum</h3><p><strong>{single.momentum.state}</strong></p><p className="fx-panel-meta">{single.momentum.explanation || "—"}</p></div>
            <div className="fx-placeholder-panel"><h3>Volatility</h3><p><strong>{single.volatility.state}</strong></p><p className="fx-panel-meta">{single.volatility.explanation || "—"}</p></div>
            <div className="fx-placeholder-panel"><h3>Market Structure</h3><p><strong>{single.marketStructure.state}</strong></p><p className="fx-panel-meta">{single.marketStructure.explanation || "—"}</p></div>
          </div>
          <div className="fx-placeholder-panel">
            <h3>Scenarios</h3>
            <ul>{single.scenarios.map((s, i) => <li key={`${s.type}-${i}`}><strong>{s.name || s.type}</strong> — {s.reasoning}</li>)}</ul>
          </div>
          <div className="fx-placeholder-panel">
            <h3>Knowledge Sources</h3>
            {single.knowledgeSources.length === 0 ? <p className="fx-panel-meta">None matched.</p> : (
              <ul>{single.knowledgeSources.map((k) => <li key={k.documentId}>{k.title}</li>)}</ul>
            )}
          </div>
        </div>
      ) : null}

      {mtf && mode === "mtf" ? (
        <div className="fx-ai-result" data-ai-mtf-result="true" data-ai-analysis-result="true">
          <div className="fx-placeholder-panel">
            <h3>MULTI-TIMEFRAME AI ANALYSIS</h3>
            <dl className="fx-ohlc">
              <div><dt>Market</dt><dd data-ai-result-symbol="true">{mtf.market.displaySymbol}</dd></div>
              <div><dt>Overall alignment</dt><dd data-ai-mtf-alignment="true"><ForexStatusBadge tone={toneForState(mtf.overallAlignment.overall)}>{mtf.overallAlignment.overall}</ForexStatusBadge></dd></div>
              <div><dt>Data quality</dt><dd><ForexStatusBadge tone={toneForState(mtf.dataQuality.status)}>{mtf.dataQuality.status}</ForexStatusBadge></dd></div>
              <div><dt>Narrative</dt><dd data-ai-mtf-narrative="true">{mtf.narrativeStatus}</dd></div>
              <div><dt>Analysis generated</dt><dd>{formatTs(mtf.generatedAt)}</dd></div>
              <div><dt>Decision posture</dt><dd>{mtf.decisionPosture}</dd></div>
            </dl>
            {latencyMs != null ? (
              <p className="fx-panel-meta" data-ai-latency="true">
                Latency: {latencyMs} ms
                {diagnostics?.promptChars != null ? ` · prompt ${String(diagnostics.promptChars)} chars` : ""}
                {diagnostics?.marketStateMs != null ? ` · market-state ${String(diagnostics.marketStateMs)} ms` : ""}
                {diagnostics?.knowledgeHits != null ? ` · knowledge ${String(diagnostics.knowledgeHits)}` : ""}
              </p>
            ) : null}
          </div>

          <div className="fx-placeholder-panel">
            <h3>Higher timeframe bias</h3>
            <p><strong>{mtf.higherTimeframeBias.direction}</strong></p>
            <ul>{mtf.higherTimeframeBias.basis.map((b) => <li key={b}>{b}</li>)}</ul>
            <p className="fx-panel-meta">Intermediate: {mtf.intermediateTimeframeState} · Lower: {mtf.lowerTimeframeState}</p>
          </div>

          <div className="fx-ai-mtf-cards" data-ai-mtf-cards="true">
            {mtf.timeframeStates.map((state) => (
              <article key={state.timeframe} className="fx-placeholder-panel" data-ai-mtf-card={state.timeframe}>
                <h3>{state.timeframe.toUpperCase()} · {state.role}</h3>
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
                  <p className="fx-panel-meta">NO DATA — {state.reason || state.status}</p>
                )}
                <p className="fx-panel-meta">
                  {mtf.timeframeAnalysis.find((t) => t.timeframe === state.timeframe)?.interpretation || "—"}
                </p>
              </article>
            ))}
          </div>

          <div className="fx-ai-grid">
            <div className="fx-placeholder-panel">
              <h3>Confluence</h3>
              <ul>{(mtf.confluence.length ? mtf.confluence : ["None"]).map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
            <div className="fx-placeholder-panel">
              <h3>Conflicts</h3>
              <ul>{(mtf.conflicts.length ? mtf.conflicts : ["None"]).map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
          </div>

          <div className="fx-placeholder-panel">
            <h3>Scenarios</h3>
            <p className="fx-panel-meta">Analytical only — not trade execution.</p>
            <ul>
              {mtf.scenarios.map((s, i) => (
                <li key={`${s.type}-${i}`}>
                  <strong>{s.name || s.type}</strong> — {s.reasoning}
                </li>
              ))}
            </ul>
          </div>

          <div className="fx-ai-grid">
            <div className="fx-placeholder-panel">
              <h3>Confirmation needed</h3>
              <ul>{(mtf.confirmationNeeded.length ? mtf.confirmationNeeded : ["—"]).map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            <div className="fx-placeholder-panel">
              <h3>Invalidation</h3>
              <ul>{(mtf.invalidationConditions.length ? mtf.invalidationConditions : ["—"]).map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          </div>

          <div className="fx-placeholder-panel">
            <h3>Risks / Limitations</h3>
            <ul>{[...mtf.risks, ...mtf.limitations].map((x, i) => <li key={`${x}-${i}`}>{x}</li>)}</ul>
          </div>

          <div className="fx-placeholder-panel">
            <h3>Knowledge Sources</h3>
            {mtf.knowledgeSources.length === 0 ? (
              <p className="fx-panel-meta">No published indexed knowledge matched.</p>
            ) : (
              <ul data-ai-knowledge-sources="true">
                {mtf.knowledgeSources.map((k) => (
                  <li key={k.documentId}>{k.title} · v{k.version}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {decision && mode === "decision" ? (
        <div className="fx-ai-result" data-ai-decision-result="true" data-ai-analysis-result="true">
          <div className="fx-placeholder-panel">
            <h3>DECISION ANALYSIS</h3>
            <dl className="fx-ohlc">
              <div><dt>Market</dt><dd data-ai-result-symbol="true">{decision.market.displaySymbol}</dd></div>
              <div><dt>Current price</dt><dd data-ai-decision-price="true">{decision.market.currentPrice ?? "UNAVAILABLE"}</dd></div>
              <div><dt>Data quality</dt><dd><ForexStatusBadge tone={toneForState(decision.dataQuality.status)}>{decision.dataQuality.status}</ForexStatusBadge></dd></div>
              <div><dt>Alignment</dt><dd><ForexStatusBadge tone={toneForState(decision.alignment.overall)}>{decision.alignment.overall}</ForexStatusBadge></dd></div>
              <div><dt>Decision posture</dt><dd data-ai-decision-posture="true"><ForexStatusBadge tone={toneForState(decision.decisionPosture)}>{decision.decisionPosture}</ForexStatusBadge></dd></div>
              <div><dt>Narrative</dt><dd>{decision.narrativeStatus}</dd></div>
              <div><dt>Generated</dt><dd>{formatTs(decision.generatedAt)}</dd></div>
              <div><dt>Confidence</dt><dd data-ai-confidence="true">{decision.confidence === null ? "null" : String(decision.confidence)}</dd></div>
            </dl>
            {latencyMs != null ? (
              <p className="fx-panel-meta" data-ai-latency="true">
                Latency: {latencyMs} ms
                {diagnostics?.promptChars != null ? ` · prompt ${String(diagnostics.promptChars)} chars` : ""}
                {diagnostics?.marketStateMs != null ? ` · market-state ${String(diagnostics.marketStateMs)} ms` : ""}
                {diagnostics?.deterministicMs != null ? ` · deterministic ${String(diagnostics.deterministicMs)} ms` : ""}
                {diagnostics?.knowledgeHits != null ? ` · knowledge ${String(diagnostics.knowledgeHits)}` : ""}
              </p>
            ) : null}
          </div>

          <div className="fx-placeholder-panel" data-ai-decision-scenario="true">
            <h3>Scenario</h3>
            <p><strong>{decision.scenario.name}</strong> · {decision.scenario.direction}</p>
            <p className="fx-panel-meta">{decision.scenario.type}</p>
            <ul>{decision.scenario.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
            {decision.scenario.notes.length ? (
              <ul className="fx-panel-meta">{decision.scenario.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            ) : null}
          </div>

          <div className="fx-placeholder-panel" data-ai-decision-entry="true">
            <h3>Entry zone</h3>
            <p><ForexStatusBadge tone={toneForState(decision.entryZone.status)}>{decision.entryZone.status}</ForexStatusBadge></p>
            {decision.entryZone.status === "UNAVAILABLE" ? (
              <p className="fx-panel-meta">{decision.entryZone.unavailableReason || "ENTRY_ZONE_UNAVAILABLE"}</p>
            ) : (
              <dl className="fx-ohlc">
                <div><dt>Range</dt><dd>{decision.entryZone.lowerBound} – {decision.entryZone.upperBound}</dd></div>
                <div><dt>Reference</dt><dd>{decision.entryZone.referencePrice ?? "—"}</dd></div>
                <div><dt>Timeframe</dt><dd>{decision.entryZone.timeframe ?? "—"}</dd></div>
                <div><dt>Invalidation level</dt><dd>{decision.entryZone.invalidationLevel ?? "—"}</dd></div>
              </dl>
            )}
            {decision.entryZone.basis.length ? (
              <ul className="fx-panel-meta">{decision.entryZone.basis.map((b) => <li key={b}>{b}</li>)}</ul>
            ) : null}
          </div>

          <div className="fx-ai-grid">
            <div className="fx-placeholder-panel" data-ai-decision-confirmation="true">
              <h3>Confirmation</h3>
              <p className="fx-panel-meta">{decision.confirmation.summary}</p>
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
            </div>
            <div className="fx-placeholder-panel" data-ai-decision-invalidation="true">
              <h3>Invalidation</h3>
              <p className="fx-panel-meta">{decision.invalidation.summary}</p>
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
            </div>
          </div>

          <div className="fx-placeholder-panel" data-ai-decision-risk="true">
            <h3>Risk context</h3>
            <dl className="fx-ohlc">
              <div><dt>Volatility</dt><dd>{decision.riskContext.volatility ?? "—"}</dd></div>
              <div><dt>ATR</dt><dd>{decision.riskContext.atr ?? "—"}</dd></div>
              <div><dt>Distance to entry</dt><dd>{decision.riskContext.distanceToEntry ?? "—"}</dd></div>
              <div><dt>Distance to invalidation</dt><dd>{decision.riskContext.distanceToInvalidation ?? "—"}</dd></div>
              <div><dt>Risk/Reward</dt><dd data-ai-decision-rr="true">{decision.riskReward.ratio ?? decision.riskReward.unavailableReason ?? "null"}</dd></div>
              <div><dt>SL candidate</dt><dd>{decision.stopLossCandidate ?? "null"}</dd></div>
              <div><dt>TP candidates</dt><dd>{decision.takeProfitCandidates.length ? decision.takeProfitCandidates.join(", ") : "none"}</dd></div>
            </dl>
            <ul>{decision.riskContext.factors.map((f) => <li key={f}>{f}</li>)}</ul>
          </div>

          <div className="fx-placeholder-panel">
            <h3>Observed facts</h3>
            <ul>{decision.observedFacts.map((f) => <li key={f}>{f}</li>)}</ul>
            <h3>Deterministic summary</h3>
            <p data-ai-decision-deterministic="true">{decision.deterministicSummary}</p>
          </div>

          <div className="fx-placeholder-panel">
            <h3>AI interpretation</h3>
            {decision.aiInterpretation ? (
              <p data-ai-decision-interpretation="true">{decision.aiInterpretation}</p>
            ) : (
              <p className="fx-panel-meta">None — deterministic engines only (Ollama narrative unavailable or skipped).</p>
            )}
          </div>

          <div className="fx-ai-mtf-cards">
            {decision.timeframeStates.map((state) => (
              <article key={state.timeframe} className="fx-placeholder-panel" data-ai-mtf-card={state.timeframe}>
                <h3>{state.timeframe.toUpperCase()}</h3>
                <p><ForexStatusBadge tone={toneForState(state.status)}>{state.status}</ForexStatusBadge></p>
                {state.usable ? (
                  <ul>
                    <li>Trend: {state.trend ?? "—"}</li>
                    <li>Momentum: {state.momentum ?? "—"}</li>
                    <li>RSI: {state.rsi == null ? "unavailable" : state.rsi}</li>
                    <li>Updated: {formatTs(state.timestamp)}</li>
                  </ul>
                ) : (
                  <p className="fx-panel-meta">NO DATA</p>
                )}
              </article>
            ))}
          </div>

          <div className="fx-placeholder-panel">
            <h3>Knowledge Sources</h3>
            {decision.knowledgeSources.length === 0 ? (
              <p className="fx-panel-meta">No published indexed knowledge matched.</p>
            ) : (
              <ul data-ai-knowledge-sources="true">
                {decision.knowledgeSources.map((k) => (
                  <li key={k.documentId}>{k.title} · v{k.version}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="fx-placeholder-panel">
            <h3>Limitations</h3>
            <ul>{decision.limitations.map((x, i) => <li key={`${x}-${i}`}>{x}</li>)}</ul>
          </div>
        </div>
      ) : null}

      {!binanceSelected ? (
        <div className="fx-placeholder-panel">
          <p className="fx-panel-meta">Select a Binance Spot symbol from Markets to run AI analysis.</p>
        </div>
      ) : null}
    </section>
  );
}
