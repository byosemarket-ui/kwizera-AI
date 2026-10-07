import { useEffect, useState } from "react";
import { forexAdminMemoryApi, forexIntelligenceApi } from "./api";

function Badge({ value }: { value: string }) {
  const v = value.toUpperCase();
  const tone = ["CONFIRMED", "STORED", "MET", "OK"].includes(v)
    ? "ok"
    : ["PENDING", "WATCH", "FALLBACK", "INSUFFICIENT_SAMPLE", "PARTIALLY_CONFIRMED"].includes(v)
      ? "warn"
      : ["INVALIDATED", "HIGH", "FAILED", "STALE"].includes(v)
        ? "danger"
        : undefined;
  return <span className="fxa-badge" data-tone={tone}>{value}</span>;
}

export function ForexAdminMemoryPage({ onOpen }: { onOpen: (path: string) => void }) {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [symbol, setSymbol] = useState("");

  useEffect(() => {
    void forexAdminMemoryApi.listAnalyses({ symbol: symbol || undefined, limit: 40 })
      .then((res) => {
        setItems(res.items as Array<Record<string, unknown>>);
        setTotal(res.total);
      })
      .catch((err: Error) => setError(err.message));
  }, [symbol]);

  if (error) return <div className="fxa-error" role="alert">{error}</div>;

  return (
    <div data-forex-admin-memory>
      <section className="fxa-card">
        <h2>AI Memory</h2>
        <p className="fxa-muted">
          Persistent analysis snapshots. Historical context only — not model training, not trade execution.
        </p>
        <div className="fxa-row" style={{ gap: 8, flexWrap: "wrap" }}>
          <input
            className="fxa-input"
            placeholder="Filter symbol (e.g. BTCUSDT)"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.trim().toUpperCase())}
          />
          <span className="fxa-muted">{total} records</span>
        </div>
      </section>
      <section className="fxa-card">
        <div className="fxa-table-wrap">
          <table className="fxa-table">
            <thead>
              <tr>
                <th>Generated</th>
                <th>Symbol</th>
                <th>Type</th>
                <th>Scenario</th>
                <th>Posture</th>
                <th>Outcome</th>
                <th>DQ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={8} className="fxa-muted">No memory records yet. Run Decision / MTF / Single analysis first.</td></tr>
              ) : items.map((row) => (
                <tr key={String(row.id)}>
                  <td>{String(row.generatedAt ?? "—")}</td>
                  <td>{String(row.symbol)}</td>
                  <td>{String(row.analysisType)}</td>
                  <td>{String(row.scenario ?? "—")}</td>
                  <td><Badge value={String(row.decisionPosture ?? "—")} /></td>
                  <td><Badge value={String(row.outcomeStatus ?? "NONE")} /></td>
                  <td>{String(row.dataQuality)}</td>
                  <td>
                    <button type="button" className="fxa-btn" onClick={() => onOpen(`/admin/forex/journal/${row.id}`)}>
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function ForexAdminJournalPage({ onOpen }: { onOpen: (path: string) => void }) {
  return <ForexAdminMemoryPage onOpen={onOpen} />;
}

export function ForexAdminJournalDetailPage({
  analysisId,
  onOpen,
}: {
  analysisId: string;
  onOpen: (path: string) => void;
}) {
  const [data, setData] = useState<{
    analysis: Record<string, unknown>;
    outcomes: Array<Record<string, unknown>>;
    mistakes: Array<Record<string, unknown>>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  const load = () => {
    void forexAdminMemoryApi.getAnalysis(analysisId)
      .then((res) => setData(res as typeof data))
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => { load(); }, [analysisId]);

  if (error) return <div className="fxa-error" role="alert">{error}</div>;
  if (!data) return <p className="fxa-muted">Loading journal entry…</p>;
  const a = data.analysis;

  return (
    <div data-forex-admin-journal-detail>
      <section className="fxa-card">
        <div className="fxa-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <h2>Journal · {String(a.symbol)}</h2>
          <div className="fxa-row" style={{ gap: 8 }}>
            <button type="button" className="fxa-btn-secondary" onClick={() => onOpen("/admin/forex/journal")}>Back</button>
            <button
              type="button"
              className="fxa-btn"
              disabled={evaluating}
              onClick={() => {
                setEvaluating(true);
                void forexAdminMemoryApi.evaluate(analysisId)
                  .then(() => load())
                  .catch((err: Error) => setError(err.message))
                  .finally(() => setEvaluating(false));
              }}
            >
              {evaluating ? "Evaluating…" : "Evaluate outcome"}
            </button>
          </div>
        </div>
        <p className="fxa-muted">Original analysis is immutable. Outcomes and mistakes are linked separately.</p>
      </section>

      <section className="fxa-card">
        <h3>ORIGINAL ANALYSIS</h3>
        <dl className="fxa-dl">
          <div><dt>Generated</dt><dd>{String(a.generatedAt)}</dd></div>
          <div><dt>Type</dt><dd>{String(a.analysisType)}</dd></div>
          <div><dt>Scenario</dt><dd>{String(a.scenario ?? "—")} · {String(a.scenarioDirection ?? "")}</dd></div>
          <div><dt>Posture</dt><dd><Badge value={String(a.decisionPosture ?? "—")} /></dd></div>
          <div><dt>Alignment</dt><dd>{String(a.alignment ?? "—")}</dd></div>
          <div><dt>Regime</dt><dd>{String(a.marketRegime)}</dd></div>
          <div><dt>Data quality</dt><dd>{String(a.dataQuality)}</dd></div>
          <div><dt>Model</dt><dd>{String(a.modelId ?? "—")}</dd></div>
          <div><dt>Contract</dt><dd>{String(a.contractVersion ?? "—")}</dd></div>
          <div><dt>Confidence</dt><dd>null</dd></div>
        </dl>
        <h4>Deterministic summary</h4>
        <p>{String(a.deterministicSummary ?? "—")}</p>
        <h4>AI interpretation</h4>
        <p>{String(a.aiInterpretation ?? "None (deterministic-only / unavailable)")}</p>
        {a.entryZone ? (
          <>
            <h4>Entry zone</h4>
            <pre className="fxa-pre">{JSON.stringify(a.entryZone, null, 2)}</pre>
          </>
        ) : null}
      </section>

      <section className="fxa-card">
        <h3>OUTCOME</h3>
        {data.outcomes.length === 0 ? (
          <p className="fxa-muted">No outcome yet — status remains unevaluated / PENDING until evaluation.</p>
        ) : data.outcomes.map((o) => (
          <article key={String(o.id)} style={{ marginBottom: 12 }}>
            <p><Badge value={String(o.status)} /> · evaluated {String(o.evaluatedAt)}</p>
            <p className="fxa-muted">{String(o.learningNote ?? "")}</p>
            <ul>{(o.evidence as string[] | undefined)?.map((e) => <li key={e}>{e}</li>)}</ul>
          </article>
        ))}
      </section>

      <section className="fxa-card">
        <h3>MISTAKES</h3>
        {data.mistakes.length === 0 ? (
          <p className="fxa-muted">No mistakes recorded for this analysis.</p>
        ) : (
          <ul>
            {data.mistakes.map((m) => (
              <li key={String(m.id)}>
                <Badge value={String(m.severity)} /> <strong>{String(m.category)}</strong> — {String(m.description)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function ForexAdminOutcomesPage() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void forexAdminMemoryApi.listOutcomes({ limit: 50 })
      .then((res) => setItems(res.items as Array<Record<string, unknown>>))
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <div className="fxa-error" role="alert">{error}</div>;

  return (
    <div data-forex-admin-outcomes>
      <section className="fxa-card">
        <h2>Outcomes</h2>
        <p className="fxa-muted">Deterministic scenario evaluation. Browser cannot submit outcomes.</p>
      </section>
      <section className="fxa-card">
        <div className="fxa-table-wrap">
          <table className="fxa-table">
            <thead>
              <tr>
                <th>Evaluated</th>
                <th>Symbol</th>
                <th>Scenario</th>
                <th>Status</th>
                <th>Zone</th>
                <th>Confirm</th>
                <th>Invalidation</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={7} className="fxa-muted">No outcomes yet.</td></tr>
              ) : items.map((o) => (
                <tr key={String(o.id)}>
                  <td>{String(o.evaluatedAt)}</td>
                  <td>{String(o.symbol)}</td>
                  <td>{String(o.scenario ?? "—")}</td>
                  <td><Badge value={String(o.status)} /></td>
                  <td>{o.zoneTouched ? "yes" : "no"}</td>
                  <td>{o.confirmationReached ? "yes" : "no"}</td>
                  <td>{o.invalidationReached ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function ForexAdminMistakesPage() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void forexAdminMemoryApi.listMistakes({ limit: 50 })
      .then((res) => setItems(res.items as Array<Record<string, unknown>>))
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <div className="fxa-error" role="alert">{error}</div>;

  return (
    <div data-forex-admin-mistakes>
      <section className="fxa-card">
        <h2>Mistakes</h2>
        <p className="fxa-muted">Deterministic mistake flags from analysis/outcome facts. Not fabricated.</p>
      </section>
      <section className="fxa-card">
        <ul>
          {items.length === 0 ? (
            <li className="fxa-muted">No mistakes recorded.</li>
          ) : items.map((m) => (
            <li key={String(m.id)}>
              <Badge value={String(m.severity)} /> <strong>{String(m.category)}</strong>
              {" · "}{String(m.symbol)} · {String(m.scenario ?? "—")}
              <div className="fxa-muted">{String(m.description)}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function ForexAdminLearningPage() {
  const [learning, setLearning] = useState<Record<string, unknown> | null>(null);
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = () => {
    void Promise.all([forexAdminMemoryApi.learning(), forexAdminMemoryApi.overview()])
      .then(([l, o]) => {
        setLearning(l.learning as Record<string, unknown>);
        setOverview(o.overview as Record<string, unknown>);
      })
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => { load(); }, []);

  const rebuild = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await forexIntelligenceApi.rebuildLearning();
      setLearning(res.learning);
      setNote(res.note);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="fxa-error" role="alert">{error}</div>;
  if (!learning || !overview) return <p className="fxa-muted">Loading learning statistics…</p>;

  const scenarios = (learning.scenarioPerformance as Array<Record<string, unknown>>) ?? [];
  const timeframes = (learning.timeframePerformance as Array<Record<string, unknown>>) ?? [];
  const regimes = (learning.regimePerformance as Array<Record<string, unknown>>) ?? [];
  const mistakes = (learning.mistakePatterns as Array<Record<string, unknown>>) ?? [];
  const models = (learning.modelPerformance as Array<Record<string, unknown>>) ?? [];

  return (
    <div data-forex-admin-learning>
      <section className="fxa-card">
        <div className="fxa-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h2>Learning</h2>
            <p className="fxa-muted">
              External learning analytics only. Model weights are never modified.
              {" "}MODEL TRAINING: Not active · MEMORY LEARNING: Active.
              {" "}modelTraining={String(overview.modelTraining)} · min sample threshold applies.
            </p>
          </div>
          <button type="button" className="fxa-btn" disabled={busy} onClick={() => void rebuild()}>
            Rebuild Learning Aggregates
          </button>
        </div>
        {note ? <p className="fxa-muted">{note}</p> : null}
      </section>

      <section className="fxa-grid">
        {[
          ["Analyses", overview.analyses],
          ["Outcomes", overview.outcomes],
          ["Mistakes", overview.mistakes],
          ["Pending", overview.pendingOutcomes],
        ].map(([label, value]) => (
          <article className="fxa-card fxa-stat" key={String(label)}>
            <strong>{String(value)}</strong>
            <span>{label}</span>
          </article>
        ))}
      </section>

      <section className="fxa-card">
        <h3>AI system performance</h3>
        {models.length === 0 ? <p className="fxa-muted">No model samples yet.</p> : (
          <ul>
            {models.map((m) => (
              <li key={String(m.modelId)}>
                <strong>{String(m.modelId)}</strong>
                {" · samples "}{String(m.sampleSize)}
                {" · fallback "}{m.fallbackRate == null ? "—" : Number(m.fallbackRate).toFixed(2)}
                {" · avg latency "}{m.avgLatencyMs == null ? "—" : `${Math.round(Number(m.avgLatencyMs))} ms`}
                {" · "}<Badge value={String(m.statisticalConfidence)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="fxa-card">
        <h3>Scenario performance</h3>
        {scenarios.length === 0 ? <p className="fxa-muted">No evaluated scenarios yet.</p> : (
          <div className="fxa-table-wrap">
            <table className="fxa-table">
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th>n</th>
                  <th>Confirmed</th>
                  <th>Invalidated</th>
                  <th>Inconcl.</th>
                  <th>Pending</th>
                  <th>Stats</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s) => (
                  <tr key={String(s.key)}>
                    <td>{String(s.key)}</td>
                    <td>{String(s.sampleSize)}</td>
                    <td>{String(s.confirmed)}</td>
                    <td>{String(s.invalidated)}</td>
                    <td>{String(s.inconclusive)}</td>
                    <td>{String(s.pending)}</td>
                    <td><Badge value={String(s.statisticalConfidence)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="fxa-card">
        <h3>Timeframe / Regime</h3>
        <p className="fxa-muted">Timeframes: {timeframes.map((t) => `${t.key}(n=${t.sampleSize})`).join(", ") || "—"}</p>
        <p className="fxa-muted">Regimes: {regimes.map((t) => `${t.key}(n=${t.sampleSize})`).join(", ") || "—"}</p>
      </section>

      <section className="fxa-card">
        <h3>Mistake patterns</h3>
        {mistakes.length === 0 ? <p className="fxa-muted">None yet.</p> : (
          <ul>
            {mistakes.map((m) => (
              <li key={String(m.category)}>{String(m.category)} · count {String(m.count)} · high {String(m.severityHigh)}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
