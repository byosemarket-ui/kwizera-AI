/**
 * Phase 5F STEP 5 Phase B — ForexAdmin Research Results foundation (read-only).
 * Descriptive aggregation only. Not calibrated probability. Not execution.
 */
import { useCallback, useEffect, useState } from "react";
import { forexProvidersApi } from "./api";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function ForexAdminMt5HfmResearchResultsPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [symbol, setSymbol] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [calibration, setCalibration] = useState<Record<string, unknown> | null>(null);
  const [wfRuns, setWfRuns] = useState<Array<Record<string, unknown>>>([]);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const filters = {
        symbol: symbol.trim() || undefined,
        timeframe: timeframe.trim() || undefined,
      };
      const [rr, cal, wf] = await Promise.all([
        forexProvidersApi.mt5HfmMifResearchResultsList({ ...filters, generate: true, limit: 1 }),
        forexProvidersApi.mt5HfmMifCalibrationStatus(filters),
        forexProvidersApi.mt5HfmMifWfCalibrationList({ limit: 5 }),
      ]);
      const s =
        asRecord(rr.summary)
        ?? (Array.isArray(rr.items) && rr.items[0] ? asRecord(rr.items[0]) : null);
      setSummary(s);
      setCalibration(asRecord(cal.calibration) ?? { status: cal.status });
      setWfRuns(Array.isArray(wf.items) ? wf.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load research results");
    } finally {
      setBusy(false);
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const outcome = asRecord(summary?.outcomeDistribution);
  const linkage = asRecord(summary?.linkage);
  const datasets = Array.isArray(summary?.datasets) ? summary!.datasets : [];
  const backtests = Array.isArray(summary?.backtests) ? summary!.backtests : [];
  const warnings = Array.isArray(summary?.warnings) ? summary!.warnings.map(String) : [];
  const claimLabels = Array.isArray(summary?.claimLabels)
    ? summary!.claimLabels.map(String)
    : [];
  const calFromSummary = asRecord(summary?.calibration);
  const calStatus = String(
    calibration?.status ?? calFromSummary?.status ?? "NOT_CALIBRATED",
  );

  return (
    <div className="fxa-page" data-forex-admin-research-results>
      <header className="fxa-card">
        <h1>Research Results</h1>
        <p>
          Bounded descriptive HFM_MT5 research foundation. placesOrders=false · mutatesBroker=false
          · acceptsForExecution=false · costAdjusted=false · walkForwardCalibrated=false
        </p>
        <p data-research-labels>
          <strong>DESCRIPTIVE — NOT A PROBABILITY</strong>
          {" · "}
          <strong>NOT CALIBRATED</strong>
          {" · "}
          <strong>INSUFFICIENT DATA</strong>
          {" · "}
          <strong>TEMPORAL LEAKAGE — REJECTED</strong>
          {" · "}
          <strong>COST-ADJUSTED BACKTEST NOT AVAILABLE</strong>
          {" · "}
          <strong>POINT-IN-TIME METADATA LIMITED</strong>
        </p>
        {error ? <p className="fxa-error">{error}</p> : null}
      </header>

      <section className="fxa-card" data-research-filters>
        <h2>Filters</h2>
        <label>
          Symbol
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            data-research-symbol
            placeholder="e.g. EURUSD"
          />
        </label>
        <label>
          Timeframe
          <input
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            data-research-timeframe
            placeholder="e.g. M15"
          />
        </label>
        <button type="button" className="fxa-btn" disabled={busy} onClick={() => void refresh()}>
          Refresh summary
        </button>
        <p className="fxa-muted">
          Related:{" "}
          <a href="/admin/forex/mt5-hfm/analogue">Historical Analogue</a>
          {" · "}
          <a href="/admin/forex/mt5-hfm/backtesting">Backtesting &amp; Walk-Forward</a>
          {" · "}
          <a href="/admin/forex/mt5-hfm/mif">Market Intel</a>
        </p>
      </section>

      <section className="fxa-card" data-research-calibration>
        <h2>Calibration status</h2>
        <p data-calibration-status>
          Status: <strong>{calStatus}</strong> (never displayed as calibrated %)
        </p>
        <ul>
          {(Array.isArray(calibration?.reasons) ? calibration!.reasons : []).map((r, i) => (
            <li key={i}>{String(r)}</li>
          ))}
        </ul>
        <p className="fxa-muted">
          Provisional threshold=30 · Calibrated threshold=100 · Metrics-only WF evaluation may report
          PROVISIONAL_EVALUATION / CALIBRATION_EVALUATED without a CALIBRATED claim. Mid-split 5E
          scaffolding is not walk-forward calibrated. No OOS fitting.
        </p>
        <h3>Walk-forward calibration runs</h3>
        {wfRuns.length === 0 ? (
          <p className="fxa-muted" data-wf-empty>
            No WF calibration runs yet.
          </p>
        ) : (
          <ul data-wf-runs>
            {wfRuns.map((r, i) => {
              const row = asRecord(r);
              if (!row) return null;
              return (
                <li key={String(row.runId ?? i)}>
                  <code>{String(row.runId)}</code> · status={String(row.status)} · eligible=
                  {String(row.totalEligibleObservations)} · excluded={String(row.totalExcluded)} ·
                  walkForwardCalibrated=false · modelFitPerformed=
                  {String(row.modelFitPerformed)}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="fxa-card" data-research-datasets>
        <h2>Dataset provenance</h2>
        {datasets.length === 0 ? (
          <p className="fxa-muted">No datasets in bounded window.</p>
        ) : (
          <ul>
            {datasets.slice(0, 20).map((d, i) => {
              const row = asRecord(d);
              if (!row) return null;
              return (
                <li key={String(row.datasetId ?? i)}>
                  <code>{String(row.datasetId)}</code> v{String(row.version)} ·{" "}
                  {String(row.instrument)} {String(row.timeframe)} · status={String(row.status)} ·
                  hash={String(row.contentHash ?? "").slice(0, 12)} · costAdj=
                  {String(row.suitableForCostAdjustedBacktest)}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="fxa-card" data-research-outcomes>
        <h2>Outcome distribution (DESCRIPTIVE — NOT A PROBABILITY)</h2>
        {outcome ? (
          <ul>
            <li>uniquePredictions={String(outcome.uniquePredictions)}</li>
            <li>
              decisive TARGET/INVALIDATION denominator={String(outcome.decisiveDenominator)}{" "}
              (excluded non-decisive={String(outcome.excludedNonDecisive)})
            </li>
            <li>completeness={JSON.stringify(outcome.completeness ?? {})}</li>
            <li>levelResultKinds={JSON.stringify(outcome.levelResultKinds ?? {})}</li>
          </ul>
        ) : (
          <p className="fxa-muted">No outcome distribution.</p>
        )}
      </section>

      <section className="fxa-card" data-research-linkage>
        <h2>Linkage availability</h2>
        {linkage ? (
          <ul>
            <li>analogue searches={String(linkage.analogueSearchCount)}</li>
            <li>prediction snapshots={String(linkage.predictionSnapshotCount)}</li>
            <li>outcomes={String(linkage.predictionOutcomeCount)}</li>
            <li>probability assessments={String(linkage.probabilityAssessmentCount)}</li>
            <li>probability freezes={String(linkage.probabilityFreezeCount)}</li>
            <li>freeze↔prediction links={String(linkage.freezeLinkedToPredictionCount)}</li>
            <li>assessments without freeze={String(linkage.assessmentsWithoutFreezeCount)}</li>
            <li>
              missing links:{" "}
              {Array.isArray(linkage.missingLinks)
                ? linkage.missingLinks.map(String).join("; ")
                : "—"}
            </li>
          </ul>
        ) : (
          <p className="fxa-muted">No linkage report.</p>
        )}
      </section>

      <section className="fxa-card" data-research-backtests>
        <h2>Backtest / walk-forward status</h2>
        {backtests.length === 0 ? (
          <p className="fxa-muted">No backtest runs in bounded window.</p>
        ) : (
          <ul>
            {backtests.map((b, i) => {
              const row = asRecord(b);
              if (!row) return null;
              return (
                <li key={String(row.runId ?? i)}>
                  <code>{String(row.runId)}</code> · {String(row.mode)} · {String(row.status)} ·
                  folds={String(row.foldCount)} · costAdjusted=false · not calibrated probability
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="fxa-card" data-research-warnings>
        <h2>Sample-size / data-quality warnings</h2>
        <ul>
          {warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
          {claimLabels.map((c, i) => (
            <li key={`c-${i}`}>{c}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
