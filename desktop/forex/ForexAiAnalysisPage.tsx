import { useEffect, useState } from "react";
import { ForexSectionHeader } from "./components/ForexSectionHeader";
import { ForexStatusBadge } from "./components/ForexStatusBadge";
import type { SelectedMarket } from "./market-data/selected-market";
import type { LiveTickerSnapshot } from "../../ai/market-data/binance/types";
import { LiveTickerPanel } from "./LiveTickerPanel";

type ForexAiHealthPublic = {
  state: string;
  ready: boolean;
  model: string | null;
  preferredModel: string;
  installedModels: string[];
  latencyMs: number | null;
  probedInference: boolean;
  baseUrlBound: string;
  publicOllamaExposed: boolean;
  notes: string[];
  error?: string;
  ollamaCode?: string;
};

function toneForState(state: string): "live" | "future" | "offline" {
  if (state === "AI_READY") return "live";
  if (state === "AI_DISABLED") return "future";
  return "offline";
}

export function ForexAiAnalysisPage({
  selectedMarket,
  liveTicker,
}: {
  selectedMarket?: SelectedMarket | null;
  liveTicker?: LiveTickerSnapshot | null;
}) {
  const [health, setHealth] = useState<ForexAiHealthPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
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
          setError(err instanceof Error ? err.message : "AI health unavailable");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const binanceSelected = selectedMarket?.venue === "binance-spot";

  return (
    <section
      className="fx-module-page fx-ai-analysis"
      data-forex-page="ai-analysis"
      data-forex-ai-foundation="true"
      data-ai-state={health?.state ?? (loading ? "LOADING" : "AI_ERROR")}
      data-ai-ready={health?.ready ? "true" : "false"}
      aria-labelledby="fx-page-ai-analysis"
    >
      <ForexSectionHeader
        eyebrow="AI Trading"
        title="AI Analysis"
        description="Foundation for Ollama-backed Forex reasoning over structured Binance market state. Not a trading signal."
      />
      <h2 id="fx-page-ai-analysis" className="fx-sr-only">AI Analysis</h2>

      <div className="fx-placeholder-panel" data-forex-ai-health="true">
        <p className="fx-panel-meta">
          Uses the shared KWIZERA Ollama adapter on the server. The browser never calls Ollama directly.
        </p>

        {loading ? (
          <p data-ai-health-loading="true">Checking Forex AI / Ollama health…</p>
        ) : null}

        {error ? (
          <p data-ai-health-error="true">
            <ForexStatusBadge tone="offline">AI unavailable</ForexStatusBadge>
            {" "}
            {error}
          </p>
        ) : null}

        {health ? (
          <>
            <p>
              <ForexStatusBadge tone={toneForState(health.state)}>{health.state}</ForexStatusBadge>
              {" · Preferred model "}
              <strong data-ai-preferred-model="true">{health.preferredModel}</strong>
              {health.model ? (
                <>
                  {" · Resolved "}
                  <strong data-ai-model="true">{health.model}</strong>
                </>
              ) : null}
            </p>
            <dl className="fx-ohlc" aria-label="Forex AI health details">
              <div>
                <dt>Ready</dt>
                <dd data-ai-ready-value="true">{health.ready ? "yes" : "no"}</dd>
              </div>
              <div>
                <dt>Probe latency</dt>
                <dd>{health.latencyMs == null ? "—" : `${health.latencyMs} ms`}</dd>
              </div>
              <div>
                <dt>Ollama bind</dt>
                <dd>{health.baseUrlBound} (not public)</dd>
              </div>
              <div>
                <dt>Installed models</dt>
                <dd data-ai-installed-models="true">
                  {health.installedModels.length ? health.installedModels.join(", ") : "none reported"}
                </dd>
              </div>
            </dl>
            {health.error ? <p className="fx-panel-meta" data-ai-error-detail="true">{health.error}</p> : null}
            <ul className="fx-panel-meta">
              {health.notes.slice(0, 4).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      <div className="fx-placeholder-panel" data-forex-ai-boundary="true">
        <h3>Architecture boundary</h3>
        <p>
          Binance market data remains the authoritative source. Technical Analysis calculates indicators.
          Forex AI will reason over structured market state in later phases — it must not invent prices or indicator values.
        </p>
        <p className="fx-panel-meta">
          Live market-state analysis and scenario generation are not auto-run in Phase 17.
          No BUY/SELL execution is available.
        </p>
        {binanceSelected ? (
          <div data-ai-selected-market={selectedMarket.symbol}>
            <p className="fx-panel-meta">
              Selected market context: {selectedMarket.displaySymbol} · Binance Spot
            </p>
            {liveTicker ? (
              <LiveTickerPanel snapshot={liveTicker} expectedSymbol={selectedMarket.symbol} />
            ) : (
              <p className="fx-panel-meta">Waiting for live ticker…</p>
            )}
          </div>
        ) : (
          <p className="fx-panel-meta">Select a Binance Spot symbol from Markets to attach market context.</p>
        )}
      </div>
    </section>
  );
}
