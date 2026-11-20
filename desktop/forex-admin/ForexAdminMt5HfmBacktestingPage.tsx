/**
 * Phase 5F STEP 4 — ForexAdmin Backtesting & Walk-Forward (read-only analytical).
 * Gross OHLC only. Not cost-adjusted. Not broker performance. Not calibrated probability.
 */
import { useCallback, useEffect, useState } from "react";
import { forexProvidersApi } from "./api";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function ForexAdminMt5HfmBacktestingPage() {
  const [datasets, setDatasets] = useState<Array<Record<string, unknown>>>([]);
  const [datasetId, setDatasetId] = useState("");
  const [mode, setMode] = useState<"WALK_FORWARD" | "SINGLE_WINDOW">("WALK_FORWARD");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [manifest, setManifest] = useState<Record<string, unknown> | null>(null);
  const [folds, setFolds] = useState<Array<Record<string, unknown>>>([]);
  const [runs, setRuns] = useState<Array<Record<string, unknown>>>([]);
  const [coverageHint, setCoverageHint] = useState<string>("");

  const refresh = useCallback(async () => {
    try {
      const [ds, listed, cov] = await Promise.all([
        forexProvidersApi.mt5HfmMifResearchDatasets({ status: "COMPLETE", limit: 100 }),
        forexProvidersApi.mt5HfmMifBacktestRunsList({ limit: 20 }),
        forexProvidersApi.mt5HfmMifResearchCoverage(),
      ]);
      setDatasets(Array.isArray(ds.datasets) ? ds.datasets : []);
      setRuns(Array.isArray(listed.items) ? listed.items : []);
      const summary = asRecord(cov.summary);
      if (summary) {
        setCoverageHint(
          `COMPLETE=${String(summary.completeCount ?? summary.complete ?? "?")} · cost-adjusted eligible=0 (archive gate)`,
        );
      }
      if (!datasetId && ds.datasets?.[0]) {
        setDatasetId(String(ds.datasets[0].datasetId ?? ""));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load backtesting context");
    }
  }, [datasetId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function runBacktest() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const selected = datasets.find((d) => String(d.datasetId) === datasetId);
      const res = await forexProvidersApi.mt5HfmMifBacktestRunCreate({
        datasetId,
        version: selected?.version != null ? Number(selected.version) : undefined,
        expectedContentHash:
          selected?.contentHash != null ? String(selected.contentHash) : undefined,
        mode,
        maxSteps: 40,
        maxFolds: 3,
        minOosSamples: 30,
        timeoutMs: 60_000,
      });
      if (!res.ok || !res.manifest) {
        setError(res.error?.message ?? "Backtest failed");
        return;
      }
      setManifest(res.manifest);
      setNote(res.note ?? "Gross OHLC analytical run complete.");
      const foldRes = await forexProvidersApi.mt5HfmMifBacktestFoldsGet(
        String(res.manifest.runId),
      );
      setFolds(Array.isArray(foldRes.folds) ? foldRes.folds : []);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backtest request failed");
    } finally {
      setBusy(false);
    }
  }

  async function openRun(runId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await forexProvidersApi.mt5HfmMifBacktestRunGet(runId);
      if (!res.ok || !res.manifest) {
        setError(res.error?.message ?? "Run not found");
        return;
      }
      setManifest(res.manifest);
      const foldRes = await forexProvidersApi.mt5HfmMifBacktestFoldsGet(runId);
      setFolds(Array.isArray(foldRes.folds) ? foldRes.folds : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load run");
    } finally {
      setBusy(false);
    }
  }

  const cost = asRecord(manifest?.costAvailability);
  const ledger = asRecord(manifest?.ledger);
  const agg = asRecord(manifest?.aggregateMetrics);

  return (
    <div className="fxa-page" data-forex-admin-backtesting>
      <header className="fxa-card">
        <h1>Backtesting &amp; Walk-Forward</h1>
        <p>
          Analytical <strong>GROSS_OHLC_ANALYTICAL</strong> research only. Not cost-adjusted. Not
          broker execution performance. Not calibrated probability. placesOrders=false ·
          mutatesBroker=false · acceptsForExecution=false · costAdjusted=false
        </p>
        {coverageHint ? <p data-backtest-coverage>{coverageHint}</p> : null}
        {error ? <p className="fxa-error">{error}</p> : null}
        {note ? <p data-backtest-note>{note}</p> : null}
      </header>

      <section className="fxa-card" data-backtest-config>
        <h2>Run configuration</h2>
        <label>
          COMPLETE dataset
          <select
            value={datasetId}
            onChange={(e) => setDatasetId(e.target.value)}
            data-backtest-dataset
          >
            <option value="">Select…</option>
            {datasets.map((d) => (
              <option key={String(d.datasetId)} value={String(d.datasetId)}>
                {String(d.instrument)} {String(d.timeframe)} · v{String(d.version)} ·{" "}
                {String(d.contentHash ?? "").slice(0, 12)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mode
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "WALK_FORWARD" | "SINGLE_WINDOW")}
            data-backtest-mode
          >
            <option value="WALK_FORWARD">Walk-forward (rolling)</option>
            <option value="SINGLE_WINDOW">Single window</option>
          </select>
        </label>
        <button
          type="button"
          className="fxa-btn"
          disabled={busy || !datasetId}
          onClick={() => void runBacktest()}
          data-backtest-run-submit
        >
          {busy ? "Running…" : "Run gross OHLC backtest"}
        </button>
        <p data-backtest-assumptions>
          Entry = structured entry or activation close. Outcomes reuse STEP 3 level + path metrics.
          Same-candle TP/SL stays ambiguous. MTF forming bars excluded by close-time filter.
        </p>
      </section>

      <section className="fxa-card" data-backtest-costs>
        <h2>Cost availability</h2>
        <ul>
          <li>Spread: {String(cost?.spread ?? "NOT_CONSUMED")} (not applied)</li>
          <li>Slippage: UNAVAILABLE</li>
          <li>Commission: UNAVAILABLE</li>
          <li>Swap: UNAVAILABLE</li>
          <li>suitableForCostAdjustedBacktest: false</li>
          <li>costAdjusted: false — never silently treated as zero-cost net</li>
        </ul>
      </section>

      {manifest ? (
        <section className="fxa-card" data-backtest-manifest>
          <h2>Run {String(manifest.runId)}</h2>
          <p>
            status={String(manifest.status)} · mode={String(manifest.mode)} · elapsedMs=
            {String(manifest.elapsedMs)} · predictions={String(manifest.predictionCount)} ·
            mtfClosureFilterApplied={String(manifest.mtfClosureFilterApplied)}
          </p>
          <p>
            dataset hash={String(asRecord(manifest.dataset)?.contentHash ?? "").slice(0, 24)} ·
            primaryMetric={String(manifest.primaryMetric)}
          </p>
          <p data-backtest-limitations>
            {(Array.isArray(manifest.limitations) ? manifest.limitations : [])
              .map(String)
              .join(" · ")}
          </p>
          <h3>Prediction metrics (not trade PnL)</h3>
          <ul>
            <li>
              unique={String(agg?.uniquePredictions)} complete={String(agg?.completeOutcomes)}{" "}
              partial={String(agg?.partialOutcomes)} insufficient=
              {String(agg?.insufficientOutcomes)} ambiguous={String(agg?.ambiguousCount)}
            </li>
            <li>
              FR mean H8 availability=
              {String(asRecord(agg?.pathForwardReturnMeanH8)?.availability)} value=
              {String(asRecord(agg?.pathForwardReturnMeanH8)?.value)}
            </li>
            <li>
              Sharpe={String(asRecord(agg?.sharpe)?.availability)} · Sortino=
              {String(asRecord(agg?.sortino)?.availability)} (unsupported without defensible
              periodic returns)
            </li>
          </ul>
          <h3>Ledger metrics (gross unit; research assumption)</h3>
          {ledger ? (
            <ul data-backtest-ledger>
              <li>
                finalEquity={String(ledger.finalEquity)} maxDrawdown={String(ledger.maxDrawdown)}{" "}
                closed={String(ledger.closedTradeCount)} skippedOverlap=
                {String(ledger.skippedOverlapCount)}
              </li>
              <li>
                grossExpectancy={String(ledger.grossExpectancy)} profitFactor=
                {String(ledger.profitFactor)}
              </li>
              <li>{String(ledger.note)}</li>
            </ul>
          ) : (
            <p>Ledger not present on this run.</p>
          )}
        </section>
      ) : null}

      <section className="fxa-card" data-backtest-folds>
        <h2>Walk-forward folds</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Status</th>
              <th>OOS tips</th>
              <th>Decisive</th>
              <th>Min</th>
              <th>Purge</th>
              <th>Embargo</th>
              <th>Primary</th>
            </tr>
          </thead>
          <tbody>
            {folds.map((f) => (
              <tr key={String(f.foldIndex)}>
                <td>{String(f.foldIndex)}</td>
                <td>{String(f.status)}</td>
                <td>{String(f.eligibleOosPredictions)}</td>
                <td>{String(f.decisiveOosSamples)}</td>
                <td>{String(f.minOosSamplesRequired)}</td>
                <td>{String(f.purgeBars)}</td>
                <td>{String(f.embargoBars)}</td>
                <td>{String(f.primaryMetricValue)}</td>
              </tr>
            ))}
            {!folds.length ? (
              <tr>
                <td colSpan={8}>No folds (single-window or insufficient history).</td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <p>
          VAL is never reported as OOS. INSUFFICIENT_SAMPLE folds are preserved, not relabeled
          successful.
        </p>
      </section>

      <section className="fxa-card" data-backtest-history>
        <h2>Recent runs</h2>
        <ul>
          {runs.map((r) => (
            <li key={String(r.runId)}>
              <button
                type="button"
                className="fxa-linkish"
                onClick={() => void openRun(String(r.runId))}
              >
                {String(r.runId)}
              </button>{" "}
              · {String(r.status)} · {String(r.instrument)} {String(r.primaryTimeframe)}
            </li>
          ))}
          {!runs.length ? <li>No persisted backtests yet.</li> : null}
        </ul>
      </section>

      <section className="fxa-card" data-backtest-disclaimer>
        <h2>Explicit disclaimer</h2>
        <p>
          Gross OHLC results are not cost-adjusted broker performance. Slippage, commission, and
          swap are unavailable. Spread is not consumed. No orders are placed. STEP 5 calibration
          is not included.
        </p>
      </section>
    </div>
  );
}
