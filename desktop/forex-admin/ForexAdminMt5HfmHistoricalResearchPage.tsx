/**
 * Phase 08 — Historical Research & Strategy Intelligence overview (Admin).
 * Compact research workspace; no execution controls; no probability badges.
 */
import { useCallback, useEffect, useState } from "react";
import { forexProvidersApi } from "./api";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function metricCell(m: unknown): string {
  const r = asRecord(m);
  if (!r) return "—";
  const avail = String(r.availability ?? "");
  if (r.value == null) return `${avail || "UNAVAILABLE"}`;
  const v = typeof r.value === "number" ? r.value.toFixed(4) : String(r.value);
  return `${v} (${avail})`;
}

export function ForexAdminMt5HfmHistoricalResearchPage() {
  const [cap, setCap] = useState<Record<string, unknown> | null>(null);
  const [assessment, setAssessment] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [symbol, setSymbol] = useState("XAUUSD");
  const [strategyId, setStrategyId] = useState("TREND_CONTINUATION");

  const refreshCap = useCallback(async () => {
    try {
      const c = await forexProvidersApi.mt5HfmMifStrategyResearchCapability();
      setCap(c as unknown as Record<string, unknown>);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Capability load failed");
    }
  }, []);

  useEffect(() => {
    void refreshCap();
  }, [refreshCap]);

  async function runFixtureResearch() {
    setBusy(true);
    setError(null);
    try {
      const base = Math.floor(Date.now() / 1000) - 3600 * 40;
      const fixtureBars = Array.from({ length: 40 }, (_, i) => {
        const t = base + i * 3600;
        const open = 2000 + i * 0.5;
        return {
          time: t,
          open,
          high: open + 2,
          low: open - 2,
          close: open + (i % 2 === 0 ? 1 : -0.5),
        };
      });
      const simulatedTrades = Array.from({ length: 12 }, (_, i) => ({
        direction: i % 2 === 0 ? "BUY" : "SELL",
        entryPrice: 2000 + i,
        exitPrice: 2000 + i + (i % 3 === 0 ? -2 : 3),
        entryTimeSec: base + i * 7200,
        exitTimeSec: base + i * 7200 + 3600,
        unitReturn: i % 3 === 0 ? -0.001 : 0.0015,
        status: i === 5 ? "AMBIGUOUS" : "CLOSED",
        exitReason: i === 5 ? "BOTH_AMBIGUOUS_SAME_CANDLE" : "TARGET",
        holdingBars: 2,
        regimeLabel: i < 6 ? "TRENDING" : "RANGING",
      }));
      const eventTs = base + 20 * 3600;
      const res = await forexProvidersApi.mt5HfmMifStrategyResearch({
        symbol,
        timeframe: "H1",
        strategyId,
        fixtureBars,
        simulatedTrades,
        fixtureEvents: [
          {
            ts: eventTs,
            time: new Date(eventTs * 1000).toISOString(),
            currency: "USD",
            impact: "high",
            title: "Fixture CPI",
            forecast: "0.3%",
            previous: "0.2%",
            actual: "0.4%",
            id: `fixture-cpi.${eventTs}`,
            status: "released",
            moved_from: "",
            period: "2026-11",
            confidence: "sources_agree",
          },
        ],
        multipleComparisonsCount: 3,
      });
      if (!res.ok) {
        setError("Strategy research failed");
        return;
      }
      setAssessment(asRecord(res.assessment));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research request failed");
    } finally {
      setBusy(false);
    }
  }

  const perf = asRecord(assessment?.performance);
  const dataset = asRecord(assessment?.dataset);
  const wf = asRecord(assessment?.walkForward);
  const regimes = Array.isArray(assessment?.regimeBreakdown)
    ? (assessment!.regimeBreakdown as unknown[])
    : [];
  const events = Array.isArray(assessment?.eventPriceResearch)
    ? (assessment!.eventPriceResearch as unknown[])
    : [];
  const costs = Array.isArray(assessment?.costSensitivity)
    ? (assessment!.costSensitivity as unknown[])
    : [];

  return (
    <div className="fxa-page" data-forex-admin-historical-research>
      <header className="fxa-page-header">
        <h1>Historical Research</h1>
        <p className="fxa-muted">
          Phase 08 strategy intelligence — RESEARCH_ONLY. Not win probability. Not broker execution.
        </p>
      </header>

      <section className="fxa-card" style={{ marginBottom: 12 }}>
        <h2>Overview</h2>
        <div className="fxa-muted" style={{ fontSize: 12 }}>
          continuousWorker={String(cap?.continuousResearchWorker ?? "…")} · brokerExecution=
          {String(cap?.brokerExecution ?? "…")} · calibration=
          {String(cap?.isProbabilityCalibration ?? false)}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, fontSize: 13 }}>
          <a href="/admin/forex/mt5-hfm/backtesting">Backtesting &amp; Walk-Forward</a>
          <a href="/admin/forex/mt5-hfm/research-reliability">Research Reliability</a>
          <a href="/admin/forex/mt5-hfm/research-results">Research Results</a>
          <a href="/admin/forex/mt5-hfm/performance-analytics">Performance Analytics</a>
        </div>
      </section>

      <section className="fxa-card" style={{ marginBottom: 12 }}>
        <h2>Fixture research run</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label>
            Symbol{" "}
            <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
          </label>
          <label>
            Strategy{" "}
            <input value={strategyId} onChange={(e) => setStrategyId(e.target.value)} />
          </label>
          <button type="button" disabled={busy} onClick={() => void runFixtureResearch()}>
            {busy ? "Running…" : "Run fixture assessment"}
          </button>
        </div>
        {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
        <p className="fxa-muted" style={{ fontSize: 12 }}>
          Fixture/synthetic results are never labeled as live market history. Phase 07 calendar gates unchanged.
        </p>
      </section>

      {assessment ? (
        <>
          <section className="fxa-card" style={{ marginBottom: 12 }}>
            <h2>Dataset</h2>
            <table className="fxa-table">
              <tbody>
                <tr>
                  <th>Quality</th>
                  <td>{String(dataset?.qualityStatus ?? "—")}</td>
                </tr>
                <tr>
                  <th>Source mode</th>
                  <td>{String(assessment.sourceMode ?? "—")}</td>
                </tr>
                <tr>
                  <th>Candles</th>
                  <td>{String(dataset?.candleCount ?? "—")}</td>
                </tr>
                <tr>
                  <th>Reliability</th>
                  <td>{String(assessment.reliabilityStatus ?? "—")}</td>
                </tr>
                <tr>
                  <th>Run status</th>
                  <td>{String(assessment.status ?? "—")}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="fxa-card" style={{ marginBottom: 12 }}>
            <h2>Backtest metrics (historical, not probability)</h2>
            <table className="fxa-table">
              <tbody>
                <tr>
                  <th>Trades</th>
                  <td>
                    {String(perf?.totalTrades ?? 0)} (W {String(perf?.winningTrades ?? 0)} / L{" "}
                    {String(perf?.losingTrades ?? 0)} / Amb {String(perf?.ambiguousTrades ?? 0)})
                  </td>
                </tr>
                <tr>
                  <th>Win rate</th>
                  <td>{metricCell(perf?.winRate)}</td>
                </tr>
                <tr>
                  <th>Expectancy</th>
                  <td>{metricCell(perf?.expectancy)}</td>
                </tr>
                <tr>
                  <th>Profit factor</th>
                  <td>{metricCell(perf?.profitFactor)}</td>
                </tr>
                <tr>
                  <th>Max drawdown</th>
                  <td>{metricCell(perf?.maxDrawdown)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="fxa-card" style={{ marginBottom: 12 }}>
            <h2>Walk-forward</h2>
            <p style={{ fontSize: 13 }}>
              status={String(wf?.status ?? "NOT_RUN")} · {String(wf?.note ?? "")}
            </p>
          </section>

          <section className="fxa-card" style={{ marginBottom: 12 }}>
            <h2>Regime breakdown</h2>
            <table className="fxa-table">
              <thead>
                <tr>
                  <th>Regime</th>
                  <th>N</th>
                  <th>Win rate</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {regimes.map((raw, i) => {
                  const r = asRecord(raw);
                  return (
                    <tr key={i}>
                      <td>{String(r?.regimeLabel ?? "—")}</td>
                      <td>{String(r?.tradeCount ?? 0)}</td>
                      <td>{metricCell(r?.winRate)}</td>
                      <td style={{ fontSize: 11 }}>{String(r?.note ?? "")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="fxa-card" style={{ marginBottom: 12 }}>
            <h2>Cost sensitivity (assumptions)</h2>
            <table className="fxa-table">
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th>Adj expectancy</th>
                  <th>Material?</th>
                </tr>
              </thead>
              <tbody>
                {costs.map((raw, i) => {
                  const r = asRecord(raw);
                  const a = asRecord(r?.assumption);
                  return (
                    <tr key={i}>
                      <td>{String(a?.label ?? "—")}</td>
                      <td>
                        {r?.adjustedExpectancy == null
                          ? "—"
                          : Number(r.adjustedExpectancy).toFixed(6)}
                      </td>
                      <td>{String(r?.materialDegradation ?? "—")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="fxa-card" style={{ marginBottom: 12 }}>
            <h2>Event→price (no causation)</h2>
            <table className="fxa-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Window</th>
                  <th>Δ%</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {events.slice(0, 8).map((raw, i) => {
                  const r = asRecord(raw);
                  return (
                    <tr key={i}>
                      <td>{String(r?.eventTitle ?? "—")}</td>
                      <td>{String(r?.windowLabel ?? "—")}</td>
                      <td>
                        {r?.priceChangePct == null ? "UNAVAILABLE" : Number(r.priceChangePct).toFixed(3)}
                      </td>
                      <td>{String(r?.sourceMode ?? "—")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </div>
  );
}
