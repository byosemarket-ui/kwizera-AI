/**
 * Phase 09 — Live Data & Research Reliability workspace (Admin).
 * Compact request-driven validation; no execution controls; no probability badges.
 */
import { useCallback, useEffect, useState } from "react";
import { forexProvidersApi } from "./api";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function cell(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "number" && Number.isFinite(v)) return String(Number(v.toFixed(6)));
  return String(v);
}

export function ForexAdminMt5HfmResearchReliabilityPage() {
  const [cap, setCap] = useState<Record<string, unknown> | null>(null);
  const [assessment, setAssessment] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [symbol, setSymbol] = useState("XAUUSD");

  const refreshCap = useCallback(async () => {
    try {
      const c = await forexProvidersApi.mt5HfmMifResearchReliabilityCapability();
      setCap(c as unknown as Record<string, unknown>);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Capability load failed");
    }
  }, []);

  useEffect(() => {
    void refreshCap();
  }, [refreshCap]);

  async function runFixtureValidation() {
    setBusy(true);
    setError(null);
    try {
      const nowSec = Math.floor(Date.now() / 1000);
      const base = nowSec - 3600 * 40;
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
      const last = fixtureBars[fixtureBars.length - 1]!;
      const mid = (last.high + last.low) / 2;
      const res = await forexProvidersApi.mt5HfmMifResearchReliability({
        symbol,
        timeframe: "H1",
        quote: {
          providerId: "HFM_MT5",
          symbol,
          bid: mid - 0.05,
          ask: mid + 0.05,
          providerTimestampSec: nowSec - 2,
          receivedAt: new Date().toISOString(),
        },
        recentSpreads: [0.08, 0.1, 0.09, 0.11, 0.1],
        fixtureBars,
        lastClosedCandle: last,
        historicalRegime: "TRENDING",
        currentRegime: "TRENDING",
        eventsProvided: false,
        liveCalendarAllowed: false,
        sourceMode: "FIXTURE",
      });
      if (!res.ok) {
        setError("Research reliability assessment failed");
        return;
      }
      setAssessment(asRecord(res.assessment));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reliability request failed");
    } finally {
      setBusy(false);
    }
  }

  const quote = asRecord(assessment?.quote);
  const candles = asRecord(asRecord(assessment?.candles)?.dataset);
  const compare = asRecord(assessment?.liveHistoricalCompare);
  const gate = asRecord(assessment?.researchGate);
  const robustness = asRecord(assessment?.strategyRobustness);
  const regime = asRecord(assessment?.regimeShift);
  const events = asRecord(assessment?.eventReliability);
  const score = asRecord(assessment?.reliabilityScore);
  const alerts = Array.isArray(assessment?.alerts) ? (assessment!.alerts as unknown[]) : [];

  return (
    <div className="fxa-page" data-forex-admin-research-reliability>
      <header className="fxa-page-header">
        <h1>Live Data &amp; Research Reliability</h1>
        <p className="fxa-muted">
          Phase 09 — request-driven validation. Evidence completeness only — not win probability.
          Not broker execution.
        </p>
      </header>

      <section className="fxa-card" style={{ marginBottom: 12 }}>
        <h2>Capability</h2>
        <div className="fxa-muted" style={{ fontSize: 12 }}>
          continuousWorker={String(cap?.continuousReliabilityWorker ?? "…")} · brokerExecution=
          {String(cap?.brokerExecution ?? "…")} · calibration=
          {String(cap?.isProbabilityCalibration ?? false)}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, fontSize: 13 }}>
          <a href="/admin/forex/mt5-hfm/historical-research">Historical Research</a>
          <a href="/admin/forex/mt5-hfm/mif">HFM Market Intel</a>
        </div>
      </section>

      <section className="fxa-card" style={{ marginBottom: 12 }}>
        <h2>Run fixture validation</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label>
            Symbol{" "}
            <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
          </label>
          <button type="button" disabled={busy} onClick={() => void runFixtureValidation()}>
            {busy ? "Running…" : "Validate (fixture)"}
          </button>
        </div>
        {error ? (
          <p style={{ color: "var(--fxa-danger, #b00020)", marginTop: 8 }}>{error}</p>
        ) : null}
        {!assessment && !error && !busy ? (
          <p className="fxa-muted" style={{ marginTop: 8, fontSize: 13 }}>
            No assessment yet — invoke explicitly. No continuous polling.
          </p>
        ) : null}
      </section>

      {assessment ? (
        <>
          <section className="fxa-card" style={{ marginBottom: 12 }}>
            <h2>A. Live Market Health</h2>
            <table className="fxa-table" style={{ width: "100%", fontSize: 13 }}>
              <tbody>
                <tr>
                  <td>Provider</td>
                  <td>{cell(quote?.providerId)}</td>
                  <td>Classification</td>
                  <td>
                    <strong>{cell(quote?.classification)}</strong>
                  </td>
                </tr>
                <tr>
                  <td>Bid</td>
                  <td>{cell(quote?.bid)}</td>
                  <td>Ask</td>
                  <td>{cell(quote?.ask)}</td>
                </tr>
                <tr>
                  <td>Spread</td>
                  <td>
                    {cell(quote?.spread)}{" "}
                    {quote?.spreadValid === false ? "(invalid)" : ""}
                    {quote?.spreadAbnormal === true ? " · abnormal" : ""}
                  </td>
                  <td>Age (sec)</td>
                  <td>{cell(quote?.ageSec)}</td>
                </tr>
                <tr>
                  <td>Provider ts</td>
                  <td>{cell(quote?.providerTimestampSec)}</td>
                  <td>Received</td>
                  <td>{cell(quote?.receivedAt)}</td>
                </tr>
                <tr>
                  <td>HTTP≠LIVE</td>
                  <td>{cell(quote?.httpOkIsNotLive)}</td>
                  <td>Evidence</td>
                  <td>{cell(quote?.evidenceKind)}</td>
                </tr>
              </tbody>
            </table>
            <div className="fxa-muted" style={{ fontSize: 12, marginTop: 4 }}>
              Findings: {Array.isArray(quote?.findings) ? (quote!.findings as string[]).join("; ") : "—"}
            </div>
          </section>

          <section className="fxa-card" style={{ marginBottom: 12 }}>
            <h2>B. Historical Data Quality</h2>
            <table className="fxa-table" style={{ width: "100%", fontSize: 13 }}>
              <tbody>
                <tr>
                  <td>Symbol / TF</td>
                  <td>
                    {cell(candles?.symbol)} / {cell(candles?.timeframe)}
                  </td>
                  <td>Quality</td>
                  <td>
                    <strong>{cell(candles?.qualityStatus)}</strong>
                  </td>
                </tr>
                <tr>
                  <td>Provider</td>
                  <td>{cell(candles?.providerId)}</td>
                  <td>Source</td>
                  <td>{cell(candles?.sourceMode)}</td>
                </tr>
                <tr>
                  <td>Candles</td>
                  <td>{cell(candles?.candleCount)}</td>
                  <td>Missing / Dup / Invalid / Forming</td>
                  <td>
                    {cell(candles?.missingCandleCount)} / {cell(candles?.duplicateCount)} /{" "}
                    {cell(candles?.invalidOhlcCount)} / {cell(candles?.formingCandleCount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="fxa-card" style={{ marginBottom: 12 }}>
            <h2>C. Live vs Historical Consistency</h2>
            <div style={{ fontSize: 13 }}>
              Status: <strong>{cell(compare?.status)}</strong> · {cell(compare?.note)}
            </div>
            <div className="fxa-muted" style={{ fontSize: 12 }}>
              Guard: {cell(compare?.semanticGuard)} · Tolerance not auto-widened
            </div>
          </section>

          <section className="fxa-card" style={{ marginBottom: 12 }}>
            <h2>D. Research Input Reliability</h2>
            <div style={{ fontSize: 13 }}>
              Gate: <strong>{cell(gate?.gate)}</strong> · validationRecord=
              {cell(gate?.validationRecordId)}
            </div>
            <div className="fxa-muted" style={{ fontSize: 12 }}>
              Blocks:{" "}
              {Array.isArray(gate?.blockReasons) ? (gate!.blockReasons as string[]).join("; ") || "—" : "—"}
              {" · "}
              Warnings:{" "}
              {Array.isArray(gate?.warnings) ? (gate!.warnings as string[]).join("; ") || "—" : "—"}
            </div>
          </section>

          <section className="fxa-card" style={{ marginBottom: 12 }}>
            <h2>E. Strategy Robustness</h2>
            <div style={{ fontSize: 13 }}>
              Status: <strong>{cell(robustness?.status)}</strong>
            </div>
            <div className="fxa-muted" style={{ fontSize: 12 }}>
              Samples baseline/recent: {cell(robustness?.baselineSampleSize)} /{" "}
              {cell(robustness?.recentSampleSize)} · expectancy Δ frac=
              {cell(robustness?.expectancyChangeFrac)}
            </div>
            <div style={{ fontSize: 12 }}>{cell(robustness?.explanation)}</div>
          </section>

          <section className="fxa-card" style={{ marginBottom: 12 }}>
            <h2>F. Regime Shift</h2>
            <div style={{ fontSize: 13 }}>
              {cell(regime?.historicalRegime)} → {cell(regime?.currentRegime)} ·{" "}
              <strong>{cell(regime?.status)}</strong>
            </div>
            <div className="fxa-muted" style={{ fontSize: 12 }}>
              Limitations:{" "}
              {Array.isArray(regime?.sampleLimitations)
                ? (regime!.sampleLimitations as string[]).join("; ")
                : "—"}
            </div>
          </section>

          <section className="fxa-card" style={{ marginBottom: 12 }}>
            <h2>G. Event Data Quality</h2>
            <div style={{ fontSize: 13 }}>
              Status: <strong>{cell(events?.status)}</strong> · source={cell(events?.sourceMode)} ·
              count={cell(events?.eventCount)}
            </div>
            <div className="fxa-muted" style={{ fontSize: 12 }}>
              Calendar gates unchanged={cell(events?.calendarGatesUnchanged)} ·{" "}
              {Array.isArray(events?.notes) ? (events!.notes as string[]).join("; ") : "—"}
            </div>
          </section>

          <section className="fxa-card" style={{ marginBottom: 12 }}>
            <h2>Reliability score (evidence completeness)</h2>
            <div style={{ fontSize: 13 }}>
              {cell(score?.value)} ({cell(score?.availability)}) — not probability · calibration=
              {cell(score?.isProbabilityCalibration)}
            </div>
            <div className="fxa-muted" style={{ fontSize: 12 }}>
              {cell(score?.definition)}
            </div>
          </section>

          <section className="fxa-card" style={{ marginBottom: 12 }}>
            <h2>H. Reliability Alerts</h2>
            {alerts.length === 0 ? (
              <p className="fxa-muted" style={{ fontSize: 13 }}>
                No open reliability alerts.
              </p>
            ) : (
              <table className="fxa-table" style={{ width: "100%", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Category</th>
                    <th>Symbol</th>
                    <th>Explanation</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((a, i) => {
                    const r = asRecord(a);
                    return (
                      <tr key={String(r?.alertId ?? i)}>
                        <td>{cell(r?.severity)}</td>
                        <td>{cell(r?.category)}</td>
                        <td>{cell(r?.symbol)}</td>
                        <td>{cell(r?.explanation)}</td>
                        <td>{cell(r?.status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
