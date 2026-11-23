/**
 * P8.D — Forex Admin Performance Analytics (read-only).
 * Historical Charts prediction outcomes. Not broker P&L. Not calibrated probability.
 */
import { useCallback, useEffect, useState } from "react";
import { forexProvidersApi } from "./api";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function fmtRate(v: unknown): string {
  if (v == null || typeof v !== "number" || !Number.isFinite(v)) return "unavailable";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtNum(v: unknown): string {
  if (v == null || typeof v !== "number" || !Number.isFinite(v)) return "unavailable";
  return v.toFixed(4);
}

function fmtInt(v: unknown): string {
  if (v == null || typeof v !== "number" || !Number.isFinite(v)) return "0";
  return String(v);
}

type BreakdownKey = "symbol" | "timeframe" | "direction" | "setupFingerprint" | "analyticalConfidence";

function BreakdownTable(props: {
  title: string;
  rows: unknown;
  note?: string;
}) {
  const items = Array.isArray(props.rows) ? props.rows : [];
  return (
    <section className="fxa-card" data-perf-breakdown={props.title}>
      <h2>{props.title}</h2>
      {props.note ? <p className="fxa-muted">{props.note}</p> : null}
      {items.length === 0 ? (
        <p className="fxa-muted">No groups in current population.</p>
      ) : (
        <table className="fxa-table" data-perf-table="true">
          <thead>
            <tr>
              <th>Group</th>
              <th>N</th>
              <th>Triggered</th>
              <th>Win N/D</th>
              <th>Win rate</th>
              <th>Mean signed R</th>
              <th>Warning</th>
            </tr>
          </thead>
          <tbody>
            {items.map((raw, i) => {
              const row = asRecord(raw);
              if (!row) return null;
              const wr = asRecord(row.decisiveWinRate);
              return (
                <tr key={String(row.key ?? i)}>
                  <td>
                    <code>{String(row.key)}</code>
                  </td>
                  <td>{fmtInt(row.observationCount)}</td>
                  <td>{fmtInt(row.triggered)}</td>
                  <td>
                    {fmtInt(wr?.numerator)}/{fmtInt(wr?.denominator)}
                  </td>
                  <td>{fmtRate(wr?.winRate)}</td>
                  <td>{fmtNum(row.signedRMean)}</td>
                  <td>{row.sampleWarning ? String(row.sampleWarning) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function ForexAdminMt5HfmPerformanceAnalyticsPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);

  const [symbol, setSymbol] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [direction, setDirection] = useState("");
  const [timeBasis, setTimeBasis] = useState<"activationOpenTimeSec" | "computationTimestamp">(
    "activationOpenTimeSec",
  );
  const [populationMode, setPopulationMode] = useState<
    "LATEST_PER_PREDICTION" | "PER_PIT_MANIFEST"
  >("LATEST_PER_PREDICTION");
  const [startUtc, setStartUtc] = useState("");
  const [endUtc, setEndUtc] = useState("");
  const [evaluatorVersion, setEvaluatorVersion] = useState("");
  const [signedRPolicyVersion, setSignedRPolicyVersion] = useState("");
  const [confidenceBucket, setConfidenceBucket] = useState("");

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await forexProvidersApi.mt5HfmMifChartsPerformance({
        symbol: symbol.trim() || undefined,
        timeframe: timeframe.trim() || undefined,
        direction:
          direction === "BUY" || direction === "SELL" ? direction : undefined,
        timeBasis,
        populationMode,
        startUtc: startUtc.trim() || undefined,
        endUtc: endUtc.trim() || undefined,
        evaluatorVersion: evaluatorVersion.trim() || undefined,
        signedRPolicyVersion: signedRPolicyVersion.trim() || undefined,
        confidenceBucket: confidenceBucket.trim() || undefined,
      });
      setSummary(asRecord(res.summary));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load performance analytics");
      setSummary(null);
    } finally {
      setBusy(false);
    }
  }, [
    symbol,
    timeframe,
    direction,
    timeBasis,
    populationMode,
    startUtc,
    endUtc,
    evaluatorVersion,
    signedRPolicyVersion,
    confidenceBucket,
  ]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const reset = () => {
    setSymbol("");
    setTimeframe("");
    setDirection("");
    setTimeBasis("activationOpenTimeSec");
    setPopulationMode("LATEST_PER_PREDICTION");
    setStartUtc("");
    setEndUtc("");
    setEvaluatorVersion("");
    setSignedRPolicyVersion("");
    setConfidenceBucket("");
  };

  const pop = asRecord(summary?.population);
  const trigger = asRecord(summary?.trigger);
  const win = asRecord(summary?.winRate) ?? asRecord(summary?.decisiveWinRate);
  const signedR = asRecord(summary?.signedR);
  const mae = asRecord(summary?.mae);
  const mfe = asRecord(summary?.mfe);
  const outcomes = asRecord(summary?.outcomeDistribution);
  const breakdowns = asRecord(summary?.breakdowns);
  const warnings = Array.isArray(summary?.warnings)
    ? summary!.warnings.map(String)
    : [];
  const reasoning = asRecord(summary?.reasoningCounts);
  const eligible = Number(pop?.eligibleDirectional ?? summary?.eligibleDirectionalPredictions ?? 0);

  return (
    <div className="fxa-page" data-forex-admin-performance-analytics>
      <header className="fxa-card">
        <h1>Performance Analytics</h1>
        <p>
          Historical prediction outcomes and deterministic performance statistics. Data source:
          HFM MT5 Market Intelligence · <strong>READ-ONLY</strong> · placesOrders=false ·
          mutatesBroker=false · notBrokerAccountPnl=true
        </p>
        <p className="fxa-muted">
          Time basis: <strong>{String(summary?.timeBasis ?? timeBasis)}</strong>
          {" · "}
          Population: <strong>{String(summary?.populationMode ?? populationMode)}</strong>
          {" · "}
          Policy: <code>{String(summary?.policyVersion ?? "—")}</code>
          {" · "}
          Schema: <code>{String(summary?.schemaVersion ?? "—")}</code>
        </p>
        {error ? <p className="fxa-error">{error}</p> : null}
      </header>

      <section className="fxa-card" data-perf-filters>
        <h2>Filters (UTC)</h2>
        <div className="fxa-form-grid">
          <label>
            Start UTC
            <input
              value={startUtc}
              onChange={(e) => setStartUtc(e.target.value)}
              placeholder="2026-11-01T00:00:00.000Z"
              data-perf-start
            />
          </label>
          <label>
            End UTC
            <input
              value={endUtc}
              onChange={(e) => setEndUtc(e.target.value)}
              placeholder="2026-11-30T23:59:59.000Z"
              data-perf-end
            />
          </label>
          <label>
            Time basis
            <select
              value={timeBasis}
              onChange={(e) =>
                setTimeBasis(e.target.value as "activationOpenTimeSec" | "computationTimestamp")
              }
              data-perf-time-basis
            >
              <option value="activationOpenTimeSec">Prediction activation (default)</option>
              <option value="computationTimestamp">Evaluation persistence</option>
            </select>
          </label>
          <label>
            Population mode
            <select
              value={populationMode}
              onChange={(e) =>
                setPopulationMode(
                  e.target.value as "LATEST_PER_PREDICTION" | "PER_PIT_MANIFEST",
                )
              }
              data-perf-population-mode
            >
              <option value="LATEST_PER_PREDICTION">Latest per prediction (default)</option>
              <option value="PER_PIT_MANIFEST">Per PIT manifest (advanced)</option>
            </select>
          </label>
          <label>
            Symbol
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="EURUSD"
              data-perf-symbol
            />
          </label>
          <label>
            Timeframe
            <input
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              placeholder="H1"
              data-perf-timeframe
            />
          </label>
          <label>
            Direction
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              data-perf-direction
            >
              <option value="">All</option>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </label>
          <label>
            Evaluator version
            <input
              value={evaluatorVersion}
              onChange={(e) => setEvaluatorVersion(e.target.value)}
              placeholder="1.0.0"
              data-perf-evaluator
            />
          </label>
          <label>
            Signed-R policy version
            <input
              value={signedRPolicyVersion}
              onChange={(e) => setSignedRPolicyVersion(e.target.value)}
              placeholder="1.0.0"
              data-perf-signed-r-policy
            />
          </label>
          <label>
            Confidence bucket
            <select
              value={confidenceBucket}
              onChange={(e) => setConfidenceBucket(e.target.value)}
              data-perf-confidence
            >
              <option value="">All</option>
              <option value="UNKNOWN">Unknown</option>
              <option value="<50">Below 50</option>
              <option value="50–<75">50 to below 75</option>
              <option value=">=75">75 and above</option>
            </select>
          </label>
        </div>
        <p>
          <button type="button" className="fxa-btn" disabled={busy} onClick={() => void refresh()}>
            {busy ? "Loading…" : "Apply filters"}
          </button>{" "}
          <button type="button" className="fxa-btn" disabled={busy} onClick={reset}>
            Reset
          </button>
        </p>
        <p className="fxa-muted">
          Related:{" "}
          <a href="/admin/forex/mt5-hfm/research-results">Research Results</a>
          {" · "}
          <a href="/admin/forex/mt5-hfm/backtesting">Backtesting</a>
          {" · "}
          <a href="/forex/automated-trading/hfm/charts">Charts</a>
        </p>
      </section>

      {eligible === 0 ? (
        <section className="fxa-card" data-perf-empty>
          <h2>Empty population</h2>
          <p>
            No eligible Charts P8.C evaluations match the current filters. Win rate, trigger rate and
            signed-R statistics are <strong>unavailable</strong> (not zero). Research archive
            coverage is not a substitute for evaluated predictions. Legacy MIF outcomes are not
            mixed into this dashboard.
          </p>
        </section>
      ) : null}

      <section className="fxa-card" data-perf-kpis>
        <h2>Overview KPIs</h2>
        <ul data-perf-kpi-list>
          <li>Eligible directional: <strong>{fmtInt(pop?.eligibleDirectional ?? summary?.eligibleDirectionalPredictions)}</strong></li>
          <li>Triggered: <strong>{fmtInt(pop?.triggered ?? summary?.triggered)}</strong></li>
          <li>Untriggered: <strong>{fmtInt(pop?.untriggered ?? summary?.untriggered)}</strong></li>
          <li>
            Trigger rate: <strong>{fmtRate(trigger?.rate)}</strong> (
            {fmtInt(trigger?.numerator)}/{fmtInt(trigger?.denominator)})
          </li>
          <li>
            Historical win rate (decisive): <strong>{fmtRate(win?.winRate)}</strong> (
            {fmtInt(win?.numerator)}/{fmtInt(win?.denominator)})
            <span className="fxa-muted"> — observed outcomes, not estimated probability or analytical confidence</span>
          </li>
          <li>Mean signed R: <strong>{fmtNum(signedR?.mean)}</strong> (n={fmtInt(signedR?.count)})</li>
          <li>MAE mean: <strong>{fmtNum(mae?.mean ?? summary?.maeMean)}</strong> (n={fmtInt(mae?.count ?? summary?.maeSampleCount)})</li>
          <li>MFE mean: <strong>{fmtNum(mfe?.mean ?? summary?.mfeMean)}</strong> (n={fmtInt(mfe?.count ?? summary?.mfeSampleCount)})</li>
        </ul>
      </section>

      <section className="fxa-card" data-perf-outcomes>
        <h2>Outcome distribution</h2>
        {outcomes ? (
          <ul>
            {Object.entries(outcomes).map(([k, v]) => (
              <li key={k}>
                {k}={fmtInt(v)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="fxa-muted">No outcome distribution.</p>
        )}
        <p className="fxa-muted">
          Ambiguous same-candle outcomes are never counted as wins or losses.
        </p>
      </section>

      <section className="fxa-card" data-perf-signed-r>
        <h2>Signed R</h2>
        <p className="fxa-muted">
          Evaluator: <code>{String(signedR?.evaluatorVersion ?? "—")}</code>
          {" · "}
          Policy: <code>{String(signedR?.signedRPolicyVersion ?? "—")}</code>
        </p>
        <ul>
          <li>count={fmtInt(signedR?.count)}</li>
          <li>mean={fmtNum(signedR?.mean)}</li>
          <li>median={fmtNum(signedR?.median)}</li>
          <li>min={fmtNum(signedR?.min)}</li>
          <li>max={fmtNum(signedR?.max)}</li>
          <li>positive={fmtInt(signedR?.positive)}</li>
          <li>negative={fmtInt(signedR?.negative)}</li>
          <li>zero={fmtInt(signedR?.zero)}</li>
          <li>unavailable={fmtInt(signedR?.unavailable)}</li>
        </ul>
      </section>

      <section className="fxa-card" data-perf-mae-mfe>
        <h2>MAE / MFE (triggered with finite values only)</h2>
        <ul>
          <li>
            MAE n={fmtInt(mae?.count)} mean={fmtNum(mae?.mean)} median={fmtNum(mae?.median)} min=
            {fmtNum(mae?.min)} max={fmtNum(mae?.max)} unavailable={fmtInt(mae?.unavailable)}
          </li>
          <li>
            MFE n={fmtInt(mfe?.count)} mean={fmtNum(mfe?.mean)} median={fmtNum(mfe?.median)} min=
            {fmtNum(mfe?.min)} max={fmtNum(mfe?.max)} unavailable={fmtInt(mfe?.unavailable)}
          </li>
        </ul>
      </section>

      <BreakdownTable title="Symbol breakdown" rows={breakdowns?.symbol} />
      <BreakdownTable title="Timeframe breakdown" rows={breakdowns?.timeframe} />
      <BreakdownTable title="Direction breakdown" rows={breakdowns?.direction} />
      <BreakdownTable
        title="Setup fingerprint breakdown"
        rows={breakdowns?.setupFingerprint}
        note="Opaque fingerprint IDs. UNKNOWN = missing setup identity."
      />
      <BreakdownTable
        title="Analytical confidence breakdown"
        rows={breakdowns?.analyticalConfidence}
        note={String(
          summary?.analyticalConfidenceLabel
            ?? "Analytical confidence — not win probability.",
        )}
      />
      {Array.isArray(breakdowns?.pitManifest) ? (
        <BreakdownTable
          title="PIT manifest breakdown (advanced population)"
          rows={breakdowns?.pitManifest}
        />
      ) : null}

      <section className="fxa-card" data-perf-reasoning>
        <h2>Reasoning-store census</h2>
        {reasoning ? (
          <ul>
            <li>authority={String(reasoning.authority)}</li>
            <li>unavailableReason={String(reasoning.unavailableReason ?? "—")}</li>
            <li>scanned={fmtInt(reasoning.scanned)}</li>
            <li>completed={fmtInt(reasoning.completed)}</li>
            <li>failed={fmtInt(reasoning.failed)}</li>
            <li>rejected={fmtInt(reasoning.rejected)}</li>
            <li>BUY={fmtInt(reasoning.buy)}</li>
            <li>SELL={fmtInt(reasoning.sell)}</li>
            <li>NO_TRADE={fmtInt(reasoning.noTrade)}</li>
            <li>WAITING={fmtInt(reasoning.waiting)}</li>
            <li>withPredictionLinkage={fmtInt(reasoning.withPredictionLinkage)}</li>
            <li>withoutPredictionLinkage={fmtInt(reasoning.withoutPredictionLinkage)}</li>
          </ul>
        ) : (
          <p className="fxa-muted">Reasoning counts unavailable.</p>
        )}
      </section>

      <section className="fxa-card" data-perf-warnings>
        <h2>Sample-size / data-quality warnings</h2>
        <ul>
          {warnings.length === 0 ? <li>No warnings.</li> : null}
          {warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
        <p className="fxa-muted">
          Calibration minimum remains 100 observations per bucket and is not implemented in P8.D.
          Groups below that threshold show INSUFFICIENT_SAMPLE.
        </p>
      </section>
    </div>
  );
}

export type { BreakdownKey };
