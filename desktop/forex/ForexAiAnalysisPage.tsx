import { useCallback, useEffect, useState } from "react";
import { ForexSectionHeader } from "./components/ForexSectionHeader";
import { ForexStatusBadge } from "./components/ForexStatusBadge";
import type { SelectedMarket } from "./market-data/selected-market";
import type { ChartTimeframeId } from "./chart/types";
import type { LiveTickerSnapshot } from "../../ai/market-data/binance/types";
import { LiveTickerPanel } from "./LiveTickerPanel";

type ForexAiHealthPublic = {
  state: string;
  ready: boolean;
  model: string | null;
  preferredModel: string;
  installedModels: string[];
  latencyMs: number | null;
  notes: string[];
  error?: string;
};

type ForexAiAnalysis = {
  schemaVersion: string;
  analysisId: string;
  generatedAt: string;
  analysisType: string;
  market: {
    exchange: string;
    symbol: string;
    displaySymbol: string;
    timeframe: string;
  };
  dataQuality: {
    status: string;
    stale: boolean;
    marketTimestamp: string | null;
  };
  summary: string;
  observedFacts: string[];
  trend: { direction: string; explanation: string };
  momentum: { state: string; explanation: string };
  volatility: { state: string; explanation: string };
  marketStructure: { state: string; explanation: string };
  scenarios: Array<{
    type: string;
    name?: string;
    status?: string;
    conditions: string[];
    confirmation: string[];
    invalidation: string[];
    reasoning: string;
  }>;
  confirmationNeeded: string[];
  invalidationConditions: string[];
  risks: string[];
  knowledgeSources: Array<{
    documentId: string;
    title: string;
    relevanceScore: number;
    version: number;
  }>;
  limitations: string[];
  decisionPosture: string;
  confidence: null;
  model: string | null;
  dataTimestamp: string | null;
  reasoning: string;
};

type AnalyzeResponse = {
  ok: boolean;
  code: string;
  analysis: ForexAiAnalysis | null;
  latencyMs: number;
  error?: string;
  diagnostics?: {
    promptChars?: number;
    knowledgeHits?: number;
    model?: string | null;
  };
};

type UiPhase = "idle" | "analyzing" | "ready" | "error";

function toneForState(state: string): "live" | "future" | "offline" {
  if (state === "AI_READY" || state === "LIVE" || state === "CONNECTED" || state === "OK") return "live";
  if (state === "AI_DISABLED" || state === "WAIT" || state === "OBSERVE") return "future";
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
  const [health, setHealth] = useState<ForexAiHealthPublic | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [phase, setPhase] = useState<UiPhase>("idle");
  const [analysis, setAnalysis] = useState<ForexAiAnalysis | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzeCode, setAnalyzeCode] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [diagnostics, setDiagnostics] = useState<AnalyzeResponse["diagnostics"]>(undefined);

  const tf = String(timeframe || "15m");
  const binanceSelected = selectedMarket?.venue === "binance-spot";

  useEffect(() => {
    let cancelled = false;
    setHealthLoading(true);
    setHealthError(null);
    void fetch("/api/forex/ai/health")
      .then(async (res) => {
        const body = await res.json() as { ok?: boolean; health?: ForexAiHealthPublic; error?: { message?: string } };
        if (!res.ok || !body.health) {
          throw new Error(body.error?.message ?? `Health check failed (${res.status})`);
        }
        if (!cancelled) setHealth(body.health);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setHealth(null);
          setHealthError(err instanceof Error ? err.message : "AI health unavailable");
        }
      })
      .finally(() => {
        if (!cancelled) setHealthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    setAnalysis(null);
    try {
      const res = await fetch("/api/forex/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          symbol: selectedMarket.symbol,
          timeframe: tf,
          analysisType: "MARKET_OVERVIEW",
        }),
      });
      const body = await res.json() as AnalyzeResponse;
      setLatencyMs(body.latencyMs ?? null);
      setDiagnostics(body.diagnostics);
      if (!body.ok || !body.analysis) {
        setPhase("error");
        setAnalyzeCode(body.code || "AI_ERROR");
        setAnalyzeError(body.error || "AI analysis unavailable");
        setAnalysis(null);
        return;
      }
      setAnalysis(body.analysis);
      setPhase("ready");
    } catch (err) {
      setPhase("error");
      setAnalyzeCode("AI_ERROR");
      setAnalyzeError(err instanceof Error ? err.message : "AI analysis request failed");
    }
  }, [binanceSelected, selectedMarket, tf]);

  return (
    <section
      className="fx-module-page fx-ai-analysis"
      data-forex-page="ai-analysis"
      data-forex-ai-foundation="true"
      data-forex-ai-phase20="true"
      data-ai-state={health?.state ?? (healthLoading ? "LOADING" : "AI_ERROR")}
      data-ai-ready={health?.ready ? "true" : "false"}
      data-ai-phase={phase}
      aria-labelledby="fx-page-ai-analysis"
    >
      <ForexSectionHeader
        eyebrow="AI Trading"
        title="AI Market Analysis"
        description="Grounded analysis from Binance Market State + Forex Knowledge via the shared Ollama adapter. Interpretive only — not trade execution."
      />
      <h2 id="fx-page-ai-analysis" className="fx-sr-only">AI Market Analysis</h2>

      <div className="fx-placeholder-panel" data-forex-ai-health="true">
        <div className="fx-ai-toolbar">
          <div>
            <p className="fx-panel-meta">
              Market: <strong data-ai-market-symbol="true">{binanceSelected ? selectedMarket!.displaySymbol : "None selected"}</strong>
              {" · Timeframe "}
              <strong data-ai-market-timeframe="true">{tf}</strong>
            </p>
            <p className="fx-panel-meta">
              Server builds Market State authoritatively. Browser never calls Ollama.
            </p>
          </div>
          <button
            type="button"
            className="fx-text-button fx-ai-analyze-btn"
            data-ai-analyze-btn="true"
            disabled={phase === "analyzing" || !binanceSelected}
            onClick={() => void runAnalysis()}
          >
            {phase === "analyzing" ? "Analyzing…" : analysis ? "Analyze again" : "Analyze Market"}
          </button>
        </div>

        {healthLoading ? <p data-ai-health-loading="true">Checking Forex AI / Ollama health…</p> : null}
        {healthError ? (
          <p data-ai-health-error="true">
            <ForexStatusBadge tone="offline">AI unavailable</ForexStatusBadge>
            {" "}
            {healthError}
          </p>
        ) : null}
        {health ? (
          <p>
            <ForexStatusBadge tone={toneForState(health.state)}>{health.state}</ForexStatusBadge>
            {" · Model "}
            <strong data-ai-preferred-model="true">{health.preferredModel}</strong>
            {health.model ? <> · Resolved <strong data-ai-model="true">{health.model}</strong></> : null}
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
          <p>Building Market State, retrieving published Forex knowledge, and waiting for Ollama…</p>
          <p className="fx-panel-meta">No fake progress percentage — wait until the model responds or times out.</p>
        </div>
      ) : null}

      {phase === "error" ? (
        <div className="fx-placeholder-panel" data-ai-analyze-error="true">
          <ForexStatusBadge tone="offline">{analyzeCode || "ERROR"}</ForexStatusBadge>
          <p>{analyzeError}</p>
          <p className="fx-panel-meta">No fake fallback analysis is shown.</p>
        </div>
      ) : null}

      {analysis ? (
        <div className="fx-ai-result" data-ai-analysis-result="true" data-analysis-id={analysis.analysisId}>
          <div className="fx-placeholder-panel">
            <h3>AI MARKET ANALYSIS</h3>
            <dl className="fx-ohlc" aria-label="Analysis identity">
              <div>
                <dt>Market</dt>
                <dd data-ai-result-symbol="true">{analysis.market.displaySymbol}</dd>
              </div>
              <div>
                <dt>Timeframe</dt>
                <dd data-ai-result-timeframe="true">{analysis.market.timeframe}</dd>
              </div>
              <div>
                <dt>Data status</dt>
                <dd>
                  <ForexStatusBadge tone={toneForState(analysis.dataQuality.status)}>
                    {analysis.dataQuality.status}
                  </ForexStatusBadge>
                </dd>
              </div>
              <div>
                <dt>Market update</dt>
                <dd data-ai-market-timestamp="true">{formatTs(analysis.dataQuality.marketTimestamp)}</dd>
              </div>
              <div>
                <dt>Analysis generated</dt>
                <dd data-ai-generated-at="true">{formatTs(analysis.generatedAt)}</dd>
              </div>
              <div>
                <dt>Decision posture</dt>
                <dd data-ai-decision-posture="true">{analysis.decisionPosture}</dd>
              </div>
            </dl>
            {latencyMs != null ? (
              <p className="fx-panel-meta" data-ai-latency="true">
                Inference latency: {latencyMs} ms
                {diagnostics?.promptChars != null ? ` · prompt ${diagnostics.promptChars} chars` : ""}
                {diagnostics?.knowledgeHits != null ? ` · knowledge hits ${diagnostics.knowledgeHits}` : ""}
              </p>
            ) : null}
          </div>

          <div className="fx-placeholder-panel">
            <h3>Summary</h3>
            <p data-ai-summary="true">{analysis.summary}</p>
          </div>

          <div className="fx-placeholder-panel">
            <h3>Observed Market Facts</h3>
            <ul data-ai-observed-facts="true">
              {analysis.observedFacts.map((fact) => <li key={fact}>{fact}</li>)}
            </ul>
          </div>

          <div className="fx-ai-grid">
            <div className="fx-placeholder-panel">
              <h3>Trend</h3>
              <p><strong>{analysis.trend.direction}</strong></p>
              <p className="fx-panel-meta">{analysis.trend.explanation || "—"}</p>
            </div>
            <div className="fx-placeholder-panel">
              <h3>Momentum</h3>
              <p><strong>{analysis.momentum.state}</strong></p>
              <p className="fx-panel-meta">{analysis.momentum.explanation || "—"}</p>
            </div>
            <div className="fx-placeholder-panel">
              <h3>Volatility</h3>
              <p><strong>{analysis.volatility.state}</strong></p>
              <p className="fx-panel-meta">{analysis.volatility.explanation || "—"}</p>
            </div>
            <div className="fx-placeholder-panel">
              <h3>Market Structure</h3>
              <p><strong>{analysis.marketStructure.state}</strong></p>
              <p className="fx-panel-meta">{analysis.marketStructure.explanation || "—"}</p>
            </div>
          </div>

          <div className="fx-placeholder-panel">
            <h3>Possible Scenarios</h3>
            <p className="fx-panel-meta">Conditional analytical scenarios — not automatic trade signals.</p>
            {analysis.scenarios.length === 0 ? (
              <p className="fx-panel-meta">No scenarios returned.</p>
            ) : (
              <ul data-ai-scenarios="true">
                {analysis.scenarios.map((scenario, index) => (
                  <li key={`${scenario.type}-${index}`}>
                    <strong>{scenario.name || scenario.type}</strong>
                    {" "}
                    <ForexStatusBadge tone="future">{scenario.status || "POSSIBLE"}</ForexStatusBadge>
                    <div className="fx-panel-meta">{scenario.reasoning}</div>
                    {scenario.conditions.length ? (
                      <div className="fx-panel-meta">Conditions: {scenario.conditions.join("; ")}</div>
                    ) : null}
                    {scenario.invalidation.length ? (
                      <div className="fx-panel-meta">Invalidation: {scenario.invalidation.join("; ")}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="fx-ai-grid">
            <div className="fx-placeholder-panel">
              <h3>Confirmation needed</h3>
              <ul>{analysis.confirmationNeeded.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
            <div className="fx-placeholder-panel">
              <h3>Invalidation conditions</h3>
              <ul>{analysis.invalidationConditions.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          </div>

          <div className="fx-placeholder-panel">
            <h3>Risks / Limitations</h3>
            <ul data-ai-limitations="true">
              {[...analysis.risks, ...analysis.limitations].map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="fx-placeholder-panel">
            <h3>Knowledge Sources</h3>
            {analysis.knowledgeSources.length === 0 ? (
              <p className="fx-panel-meta" data-ai-knowledge-empty="true">
                No published indexed knowledge matched this analysis query.
              </p>
            ) : (
              <ul data-ai-knowledge-sources="true">
                {analysis.knowledgeSources.map((source) => (
                  <li key={source.documentId}>
                    {source.title}
                    <span className="fx-panel-meta">
                      {" "}· v{source.version} · score {source.relevanceScore.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="fx-placeholder-panel">
            <h3>Reasoning</h3>
            <p data-ai-reasoning="true">{analysis.reasoning}</p>
            <p className="fx-panel-meta">
              Schema {analysis.schemaVersion} · confidence {String(analysis.confidence)} · model {analysis.model || "—"}
            </p>
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
