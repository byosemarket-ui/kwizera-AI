/**
 * Phase 5F STEP 2 — ForexAdmin Historical Analogue Research (read-only UI).
 * Backend is source of truth for ranking/similarity/outcomes.
 * Similarity is NOT probability. No execution controls.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { forexProvidersApi } from "./api";
import {
  ANALOGUE_DOCUMENTED_LIMITATIONS,
  ANALOGUE_MODE_OPTIONS,
  ANALOGUE_SIMILARITY_LABEL,
  asRecord,
  formatPct,
  formatScore,
  formatUnixSec,
  partitionDatasets,
  shortId,
  similarityNeverProbabilityCopy,
  summarizeCoverage,
  validateAnalogueReferenceInput,
} from "./analogue-ui-helpers";

type Busy =
  | "overview"
  | "reference"
  | "search"
  | "history"
  | "detail"
  | null;

function Badge({ value, tone }: { value: string; tone?: "ok" | "warn" | "danger" }) {
  return (
    <span className="fxa-badge" data-tone={tone}>
      {value}
    </span>
  );
}

function ContributionBars({
  contributions,
}: {
  contributions: Array<Record<string, unknown>>;
}) {
  if (!contributions.length) {
    return <p className="fxa-muted">No feature contributions returned.</p>;
  }
  const max = Math.max(
    0.001,
    ...contributions.map((c) => Math.abs(Number(c.contribution) || 0)),
  );
  return (
    <div className="fxa-stack" style={{ gap: 6 }}>
      {contributions.map((c) => {
        const name = String(c.name ?? "");
        const available = c.available === true;
        const contrib = Number(c.contribution);
        const width = available && Number.isFinite(contrib) ? (Math.abs(contrib) / max) * 100 : 0;
        return (
          <div key={name} style={{ display: "grid", gridTemplateColumns: "140px 1fr 64px", gap: 8, alignItems: "center" }}>
            <code style={{ fontSize: 11 }}>{name}</code>
            <div
              style={{
                height: 8,
                background: "var(--fxa-border, #333)",
                borderRadius: 2,
                overflow: "hidden",
              }}
              title={
                available
                  ? `ref=${String(c.referenceValue)} cand=${String(c.candidateValue)} weight=${String(c.weight)}`
                  : "Feature unavailable — not treated as a match"
              }
            >
              <div
                style={{
                  width: `${width}%`,
                  height: "100%",
                  background: available ? "var(--fxa-accent, #6af)" : "transparent",
                }}
              />
            </div>
            <span className="fxa-muted" style={{ fontSize: 11 }}>
              {available ? formatScore(contrib) : "n/a"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ForexAdminMt5HfmAnaloguePage() {
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [apiDown, setApiDown] = useState(false);

  const [coverageSummary, setCoverageSummary] = useState<Record<string, unknown> | null>(null);
  const [datasets, setDatasets] = useState<Array<Record<string, unknown>>>([]);
  const [history, setHistory] = useState<
    Array<{ searchId: string; searchHash: string; createdAt: string; status: string }>
  >([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyOffset, setHistoryOffset] = useState(0);

  const [datasetId, setDatasetId] = useState("");
  const [tipOpenTimeSec, setTipOpenTimeSec] = useState("");
  const [lookbackBars, setLookbackBars] = useState("16");
  const [warmupBars, setWarmupBars] = useState("24");
  const [eligibilityMode, setEligibilityMode] = useState("PRICE_ACTION");
  const [maxResults, setMaxResults] = useState("10");
  const [maxCandidates, setMaxCandidates] = useState("800");
  const [stride, setStride] = useState("4");
  const [timeoutMs, setTimeoutMs] = useState("12000");
  const [allowCrossInstrument, setAllowCrossInstrument] = useState(true);

  const [reference, setReference] = useState<Record<string, unknown> | null>(null);
  const [search, setSearch] = useState<Record<string, unknown> | null>(null);
  const [selectedAnalogue, setSelectedAnalogue] = useState<Record<string, unknown> | null>(null);

  const { complete, incomplete } = useMemo(() => partitionDatasets(datasets), [datasets]);
  const cov = summarizeCoverage(coverageSummary);
  const analogues = useMemo(() => {
    const list = search?.analogues;
    return Array.isArray(list) ? (list as Array<Record<string, unknown>>) : [];
  }, [search]);
  const stats = asRecord(search?.stats);
  const searchRef = asRecord(search?.reference);

  const loadOverview = useCallback(async () => {
    setBusy("overview");
    setError(null);
    setApiDown(false);
    try {
      const [covRes, dsRes, hist] = await Promise.all([
        forexProvidersApi.mt5HfmMifResearchCoverage(),
        forexProvidersApi.mt5HfmMifResearchDatasets({ limit: 200, offset: 0 }),
        forexProvidersApi.mt5HfmMifAnalogueSearchesList({ limit: 20, offset: historyOffset }),
      ]);
      setCoverageSummary(asRecord(covRes.summary));
      setDatasets(dsRes.datasets ?? []);
      setHistory(hist.searches ?? []);
      setHistoryTotal(hist.total ?? 0);
      if (!datasetId && (dsRes.datasets?.length ?? 0) > 0) {
        const firstComplete = (dsRes.datasets ?? []).find(
          (d) => d.status === "COMPLETE" && d.suitableForCandleResearch === true,
        );
        if (firstComplete) {
          setDatasetId(String(firstComplete.datasetId ?? ""));
          if (firstComplete.endTime != null) setTipOpenTimeSec(String(firstComplete.endTime));
        }
      }
      setNote("Research overview refreshed from live HFM_MT5 archive APIs.");
    } catch (err) {
      setApiDown(true);
      setError(err instanceof Error ? err.message : "Failed to load research overview.");
    } finally {
      setBusy(null);
    }
  }, [datasetId, historyOffset]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  function onPickDataset(id: string) {
    setDatasetId(id);
    const row = datasets.find((d) => String(d.datasetId) === id);
    if (row?.endTime != null) setTipOpenTimeSec(String(row.endTime));
    setReference(null);
  }

  async function buildReference() {
    const v = validateAnalogueReferenceInput({
      datasetId,
      tipOpenTimeSec,
      lookbackBars,
      warmupBars,
      eligibilityMode,
    });
    if (!v.ok) {
      setError(v.message);
      return;
    }
    setBusy("reference");
    setError(null);
    setNote(null);
    try {
      const row = datasets.find((d) => String(d.datasetId) === datasetId);
      const res = await forexProvidersApi.mt5HfmMifAnalogueReference({
        datasetId,
        tipOpenTimeSec: Number(tipOpenTimeSec),
        version: row?.version != null ? Number(row.version) : undefined,
        lookbackBars: Number(lookbackBars),
        warmupBars: Number(warmupBars),
        eligibilityMode,
      });
      setReference(asRecord(res.reference));
      setNote(`Reference frozen: ${shortId(asRecord(res.reference).referenceId, 24)}`);
    } catch (err) {
      const e = err as Error & { code?: string };
      setError(e.code ? `${e.code}: ${e.message}` : e.message || "Reference build failed.");
      setReference(null);
    } finally {
      setBusy(null);
    }
  }

  async function runSearch() {
    const v = validateAnalogueReferenceInput({
      datasetId,
      tipOpenTimeSec,
      lookbackBars,
      warmupBars,
      eligibilityMode,
    });
    if (!v.ok) {
      setError(v.message);
      return;
    }
    if (busy === "search") return;
    setBusy("search");
    setError(null);
    setNote(null);
    setSelectedAnalogue(null);
    try {
      const row = datasets.find((d) => String(d.datasetId) === datasetId);
      const res = await forexProvidersApi.mt5HfmMifAnalogueSearch({
        datasetId,
        tipOpenTimeSec: Number(tipOpenTimeSec),
        version: row?.version != null ? Number(row.version) : undefined,
        lookbackBars: Number(lookbackBars),
        warmupBars: Number(warmupBars),
        eligibilityMode,
        params: {
          maxResults: Math.min(100, Math.max(1, Number(maxResults) || 10)),
          maxCandidatesScanned: Math.min(50000, Math.max(1, Number(maxCandidates) || 800)),
          stride: Math.max(1, Number(stride) || 4),
          timeoutMs: Math.max(100, Number(timeoutMs) || 12000),
          allowCrossInstrument,
          maxDatasets: 54,
        },
      });
      const s = asRecord(res.search);
      setSearch(s);
      setReference(asRecord(s.reference));
      setNote(
        `Search ${String(s.status)} · results=${Array.isArray(s.analogues) ? s.analogues.length : 0} · ${res.note ?? ANALOGUE_SIMILARITY_LABEL}`,
      );
      await loadOverview();
    } catch (err) {
      const e = err as Error & { code?: string; status?: number };
      if (e.status === 403) {
        setError("Unauthorized or admin token missing — cannot run analogue search.");
      } else {
        setError(e.code ? `${e.code}: ${e.message}` : e.message || "Analogue search failed.");
      }
    } finally {
      setBusy(null);
    }
  }

  async function openSearch(searchId: string) {
    setBusy("history");
    setError(null);
    try {
      const res = await forexProvidersApi.mt5HfmMifAnalogueSearchGet(searchId);
      const s = asRecord(res.search);
      setSearch(s);
      setReference(asRecord(s.reference));
      setSelectedAnalogue(null);
      setNote(`Loaded persisted search ${shortId(searchId, 28)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load search.");
    } finally {
      setBusy(null);
    }
  }

  async function openAnalogue(analogueId: string) {
    const sid = String(search?.searchId ?? "");
    if (!sid) return;
    setBusy("detail");
    setError(null);
    try {
      const res = await forexProvidersApi.mt5HfmMifAnalogueResultGet(sid, analogueId);
      setSelectedAnalogue(asRecord(res.analogue));
    } catch (err) {
      // Fall back to in-memory row if GET fails
      const local = analogues.find((a) => String(a.analogueId) === analogueId) ?? null;
      setSelectedAnalogue(local);
      if (!local) setError(err instanceof Error ? err.message : "Failed to load analogue detail.");
    } finally {
      setBusy(null);
    }
  }

  const detailSim = asRecord(selectedAnalogue?.similarity);
  const detailOutcome = asRecord(selectedAnalogue?.outcome);
  const detailContribs = Array.isArray(detailSim.contributions)
    ? (detailSim.contributions as Array<Record<string, unknown>>)
    : [];
  const detailHorizons = Array.isArray(detailOutcome.horizons)
    ? (detailOutcome.horizons as Array<Record<string, unknown>>)
    : [];

  return (
    <div className="fxa-page" data-forex-admin-historical-analogue>
      <header className="fxa-page-header">
        <h1>Historical Analogue Research</h1>
        <p className="fxa-muted">
          Phase 5F STEP 2 — HFM_MT5 research archive only. Analytical / read-only.
          {" "}
          <strong>{ANALOGUE_SIMILARITY_LABEL}.</strong>
          {" "}
          Probability calibration is not implemented. No execution controls.
        </p>
      </header>

      {apiDown ? (
        <section className="fxa-card" data-tone="danger">
          <h2>API unavailable</h2>
          <p className="fxa-muted">
            Could not reach research/analogue endpoints. ForexAdmin remains usable; retry when the
            service is healthy. No mock results are shown.
          </p>
          <button type="button" className="fxa-btn" disabled={busy != null} onClick={() => void loadOverview()}>
            Retry overview
          </button>
        </section>
      ) : null}

      {error ? (
        <div className="fxa-error" role="alert">
          {error}
        </div>
      ) : null}
      {note ? <p className="fxa-muted">{note}</p> : null}

      <section className="fxa-card" data-analogue-overview>
        <div className="fxa-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <h2>Research overview</h2>
          <button type="button" className="fxa-btn" disabled={busy != null} onClick={() => void loadOverview()}>
            Refresh
          </button>
        </div>
        <div className="fxa-row" style={{ gap: 12, flexWrap: "wrap" }}>
          <Badge value={`cells ${cov.cells}`} />
          <Badge value={`archived ${cov.archived}`} tone="ok" />
          <Badge value={`COMPLETE ${cov.complete}`} tone="ok" />
          <Badge value={`eligible ${cov.eligible}`} tone="ok" />
          <Badge value={`registry ${cov.registry}`} />
          <Badge value={`history ${historyTotal}`} />
          <Badge value="worker OFF" />
          <Badge value="export gate OFF (default)" tone="warn" />
          <Badge value="placesOrders=false" />
        </div>
        <p className="fxa-muted" style={{ marginTop: 8 }}>
          Mode: PRICE_ACTION (v1). Last search:{" "}
          {search ? `${String(search.status)} · ${shortId(search.searchId, 22)}` : "none loaded"}.
          Scanned={String(stats.candidatesScanned ?? "—")} · returned=
          {String(stats.resultsReturned ?? analogues.length)} · suppressed=
          {String(stats.candidatesSuppressed ?? "—")} · durationMs=
          {String(stats.durationMs ?? "—")}.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="fxa-analogue-split">
          <div>
            <h3>COMPLETE / candle-eligible ({complete.length})</h3>
            <div className="fxa-table-wrap" style={{ maxHeight: 180, overflow: "auto" }}>
              <table className="fxa-table">
                <thead>
                  <tr>
                    <th>Instrument</th>
                    <th>TF</th>
                    <th>n</th>
                    <th>Dataset</th>
                  </tr>
                </thead>
                <tbody>
                  {complete.slice(0, 40).map((d) => (
                    <tr key={String(d.datasetId)}>
                      <td>{String(d.instrument)}</td>
                      <td>{String(d.timeframe)}</td>
                      <td>{String(d.candleCount)}</td>
                      <td>
                        <button
                          type="button"
                          className="fxa-linkish"
                          onClick={() => onPickDataset(String(d.datasetId))}
                        >
                          {shortId(d.datasetId, 18)}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!complete.length ? (
                    <tr>
                      <td colSpan={4} className="fxa-muted">
                        No COMPLETE eligible datasets in response.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h3>INCOMPLETE / excluded ({incomplete.length})</h3>
            <div className="fxa-table-wrap" style={{ maxHeight: 180, overflow: "auto" }}>
              <table className="fxa-table">
                <thead>
                  <tr>
                    <th>Instrument</th>
                    <th>TF</th>
                    <th>Status</th>
                    <th>Dataset</th>
                  </tr>
                </thead>
                <tbody>
                  {incomplete.slice(0, 40).map((d) => (
                    <tr key={`${String(d.datasetId)}:${String(d.version)}`}>
                      <td>{String(d.instrument)}</td>
                      <td>{String(d.timeframe)}</td>
                      <td>
                        <Badge value={String(d.status ?? "?")} tone="warn" />
                      </td>
                      <td>{shortId(d.datasetId, 18)}</td>
                    </tr>
                  ))}
                  {!incomplete.length ? (
                    <tr>
                      <td colSpan={4} className="fxa-muted">
                        No INCOMPLETE rows in current page.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="fxa-card" data-analogue-reference>
        <h2>Reference state builder</h2>
        <p className="fxa-muted">
          Tip must be a CLOSED candle open-time from an immutable COMPLETE dataset. Reference is
          frozen once built — rebuild to change inputs (no in-place edit).
        </p>
        <div className="fxa-row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label>
            Dataset
            <select
              className="fxa-input"
              value={datasetId}
              onChange={(e) => onPickDataset(e.target.value)}
              style={{ minWidth: 220, display: "block" }}
            >
              <option value="">Select COMPLETE dataset…</option>
              {complete.map((d) => (
                <option key={String(d.datasetId)} value={String(d.datasetId)}>
                  {String(d.instrument)} {String(d.timeframe)} · n={String(d.candleCount)} ·{" "}
                  {shortId(d.datasetId, 16)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tip openTimeSec
            <input
              className="fxa-input"
              value={tipOpenTimeSec}
              onChange={(e) => setTipOpenTimeSec(e.target.value)}
              style={{ width: 140, display: "block" }}
            />
          </label>
          <label>
            Lookback
            <input
              className="fxa-input"
              value={lookbackBars}
              onChange={(e) => setLookbackBars(e.target.value)}
              style={{ width: 72, display: "block" }}
            />
          </label>
          <label>
            Warmup
            <input
              className="fxa-input"
              value={warmupBars}
              onChange={(e) => setWarmupBars(e.target.value)}
              style={{ width: 72, display: "block" }}
            />
          </label>
          <label>
            Mode
            <select
              className="fxa-input"
              value={eligibilityMode}
              onChange={(e) => setEligibilityMode(e.target.value)}
              style={{ display: "block", minWidth: 200 }}
            >
              {ANALOGUE_MODE_OPTIONS.map((m) => (
                <option key={m.value} value={m.value} disabled={!m.supportedForSearch}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="fxa-btn" disabled={busy != null} onClick={() => void buildReference()}>
            Freeze reference
          </button>
        </div>
        {reference ? (
          <div style={{ marginTop: 12 }} data-analogue-reference-frozen>
            <Badge value="FROZEN" tone="ok" />{" "}
            <code>{String(reference.referenceId)}</code>
            <ul className="fxa-muted" style={{ marginTop: 8 }}>
              <li>
                {String(reference.instrument)} / {String(reference.timeframe)} · tip{" "}
                {formatUnixSec(reference.tipOpenTimeSec)} ({String(reference.tipOpenTimeSec)})
              </li>
              <li>
                dataset {shortId(reference.datasetId, 28)} v{String(reference.datasetVersion)} · hash{" "}
                {shortId(reference.contentHash, 16)}
              </li>
              <li>
                lookback={String(reference.lookbackBars)} warmup={String(reference.warmupBars)} ·
                featureSet {String(reference.featureSetId)}@{String(reference.featureSetVersion)}
              </li>
              <li>
                PIT: {(Array.isArray(reference.pitWarnings) ? reference.pitWarnings : []).join("; ") || "—"}
              </li>
              <li>
                Cost: {(Array.isArray(reference.costWarnings) ? reference.costWarnings : []).join("; ") || "—"}
              </li>
              <li>
                Safety: placesOrders={String(reference.placesOrders)} mutatesBroker=
                {String(reference.mutatesBroker)} acceptsForExecution=
                {String(reference.acceptsForExecution)} similarityIsNotProbability=
                {String(reference.similarityIsNotProbability)}
              </li>
            </ul>
          </div>
        ) : (
          <p className="fxa-muted" style={{ marginTop: 8 }}>
            No frozen reference yet.
          </p>
        )}
      </section>

      <section className="fxa-card" data-analogue-search>
        <h2>Analogue search</h2>
        <p className="fxa-muted">
          Synchronous bounded search (no background worker). Submitting again while busy is blocked.
        </p>
        <div className="fxa-row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label>
            maxResults
            <input className="fxa-input" value={maxResults} onChange={(e) => setMaxResults(e.target.value)} style={{ width: 72, display: "block" }} />
          </label>
          <label>
            maxCandidates
            <input className="fxa-input" value={maxCandidates} onChange={(e) => setMaxCandidates(e.target.value)} style={{ width: 90, display: "block" }} />
          </label>
          <label>
            stride
            <input className="fxa-input" value={stride} onChange={(e) => setStride(e.target.value)} style={{ width: 64, display: "block" }} />
          </label>
          <label>
            timeoutMs
            <input className="fxa-input" value={timeoutMs} onChange={(e) => setTimeoutMs(e.target.value)} style={{ width: 90, display: "block" }} />
          </label>
          <label className="fxa-row" style={{ gap: 6, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={allowCrossInstrument}
              onChange={(e) => setAllowCrossInstrument(e.target.checked)}
            />
            Allow cross-instrument (same TF, ATR-normalized)
          </label>
          <button
            type="button"
            className="fxa-btn"
            disabled={busy != null}
            onClick={() => void runSearch()}
            data-analogue-search-submit
          >
            {busy === "search" ? "Searching…" : "Run search"}
          </button>
        </div>
        {search ? (
          <div style={{ marginTop: 10 }}>
            <Badge
              value={String(search.status)}
              tone={String(search.status) === "COMPLETED" ? "ok" : "warn"}
            />{" "}
            <span className="fxa-muted">
              id={shortId(search.searchId, 28)} · reason={String(search.statusReason ?? "—")} · hash=
              {shortId(search.searchHash, 16)}
            </span>
          </div>
        ) : null}
      </section>

      <section className="fxa-card" data-analogue-results>
        <h2>Ranked analogues</h2>
        <p className="fxa-muted">
          Order is backend ranking. {ANALOGUE_SIMILARITY_LABEL}. Outcomes are historical only — not a forecast.
        </p>
        <div className="fxa-table-wrap" style={{ overflow: "auto" }}>
          <table className="fxa-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Instrument</th>
                <th>TF</th>
                <th>Candidate tip</th>
                <th>Similarity (NOT probability)</th>
                <th>Coverage</th>
                <th>Outcome</th>
                <th>Dataset</th>
              </tr>
            </thead>
            <tbody>
              {analogues.map((a, i) => {
                const sim = asRecord(a.similarity);
                const out = asRecord(a.outcome);
                const horizons = Array.isArray(out.horizons) ? out.horizons : [];
                const h0 = asRecord(horizons[0]);
                return (
                  <tr key={String(a.analogueId)}>
                    <td>{i + 1}</td>
                    <td>{String(a.instrument)}</td>
                    <td>{String(a.timeframe)}</td>
                    <td>{formatUnixSec(a.tipOpenTimeSec)}</td>
                    <td>
                      <button type="button" className="fxa-linkish" onClick={() => void openAnalogue(String(a.analogueId))}>
                        {formatScore(sim.score)}
                      </button>
                    </td>
                    <td>{formatPct(sim.comparableCoverage, 0)}</td>
                    <td>
                      {h0.completeness
                        ? `${String(h0.completeness)} h${String(h0.bars)}`
                        : "—"}
                    </td>
                    <td>{shortId(a.datasetId, 16)}</td>
                  </tr>
                );
              })}
              {!analogues.length ? (
                <tr>
                  <td colSpan={8} className="fxa-muted">
                    {search
                      ? "Empty results / insufficient comparable evidence for this search."
                      : "No search loaded."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {searchRef.instrument ? (
          <p className="fxa-muted" style={{ marginTop: 8 }}>
            Reference {String(searchRef.instrument)}/{String(searchRef.timeframe)} tip{" "}
            {formatUnixSec(searchRef.tipOpenTimeSec)}
          </p>
        ) : null}
      </section>

      {selectedAnalogue ? (
        <section className="fxa-card" data-analogue-detail>
          <h2>Analogue detail</h2>
          <p>
            <strong>{similarityNeverProbabilityCopy(detailSim.score)}</strong>
          </p>
          <ul className="fxa-muted">
            <li>
              Candidate {String(selectedAnalogue.instrument)}/{String(selectedAnalogue.timeframe)} tip{" "}
              {formatUnixSec(selectedAnalogue.tipOpenTimeSec)}
            </li>
            <li>
              Dataset {String(selectedAnalogue.datasetId)} v{String(selectedAnalogue.datasetVersion)} ·
              hash {shortId(selectedAnalogue.contentHash, 16)}
            </li>
            <li>
              Feature set {String(detailSim.algorithmId)}@{String(detailSim.algorithmVersion)} · coverage{" "}
              {formatPct(detailSim.comparableCoverage)}
            </li>
            <li>
              Agreeing: {(Array.isArray(detailSim.agreeingFeatures) ? detailSim.agreeingFeatures : []).join(", ") || "—"}
            </li>
            <li>
              Disagreeing:{" "}
              {(Array.isArray(detailSim.disagreeingFeatures) ? detailSim.disagreeingFeatures : []).join(", ") || "—"}
            </li>
            <li>
              Unavailable:{" "}
              {(Array.isArray(detailSim.unavailableFeatures) ? detailSim.unavailableFeatures : []).join(", ") || "—"}
            </li>
            <li>
              Suppressed={String(selectedAnalogue.suppressed)} · reason=
              {String(selectedAnalogue.suppressionReason ?? "—")}
            </li>
            <li>
              PIT: {(Array.isArray(selectedAnalogue.pitWarnings) ? selectedAnalogue.pitWarnings : []).join("; ") || "—"}
            </li>
            <li>
              Cost: {(Array.isArray(selectedAnalogue.costWarnings) ? selectedAnalogue.costWarnings : []).join("; ") || "—"}
            </li>
            <li>
              Outcome sessionUncertainty={String(detailOutcome.sessionUncertainty)} costUncertainty=
              {String(detailOutcome.costUncertainty)} probabilityNotComputed=
              {String(detailOutcome.probabilityNotComputed)}
            </li>
          </ul>
          <h3>Feature contributions</h3>
          <ContributionBars contributions={detailContribs} />
          <h3>Outcome horizons (historical only)</h3>
          <table className="fxa-table">
            <thead>
              <tr>
                <th>Bars</th>
                <th>Completeness</th>
                <th>Direction</th>
                <th>Forward return</th>
                <th>MFE</th>
                <th>MAE</th>
              </tr>
            </thead>
            <tbody>
              {detailHorizons.map((h) => (
                <tr key={String(h.bars)}>
                  <td>{String(h.bars)}</td>
                  <td>{String(h.completeness)}</td>
                  <td>{String(h.direction ?? "—")}</td>
                  <td>{formatPct(h.forwardReturn)}</td>
                  <td>{formatPct(h.mfe)}</td>
                  <td>{formatPct(h.mae)}</td>
                </tr>
              ))}
              {!detailHorizons.length ? (
                <tr>
                  <td colSpan={6} className="fxa-muted">
                    No outcome horizons on this analogue.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <p className="fxa-muted">{String(asRecord(selectedAnalogue.explanation).disclaimer ?? "")}</p>
        </section>
      ) : null}

      <section className="fxa-card" data-analogue-history>
        <h2>Historical search library</h2>
        <div className="fxa-row" style={{ gap: 8, marginBottom: 8 }}>
          <button
            type="button"
            className="fxa-btn-secondary"
            disabled={busy != null || historyOffset <= 0}
            onClick={() => setHistoryOffset((o) => Math.max(0, o - 20))}
          >
            Prev
          </button>
          <button
            type="button"
            className="fxa-btn-secondary"
            disabled={busy != null || historyOffset + 20 >= historyTotal}
            onClick={() => setHistoryOffset((o) => o + 20)}
          >
            Next
          </button>
          <span className="fxa-muted">
            offset {historyOffset} / total {historyTotal}
          </span>
        </div>
        <table className="fxa-table">
          <thead>
            <tr>
              <th>Created</th>
              <th>Status</th>
              <th>Search ID</th>
              <th>Hash</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.searchId}>
                <td>{h.createdAt}</td>
                <td>
                  <Badge value={h.status} tone={h.status === "COMPLETED" ? "ok" : "warn"} />
                </td>
                <td>
                  <button type="button" className="fxa-linkish" onClick={() => void openSearch(h.searchId)}>
                    {shortId(h.searchId, 28)}
                  </button>
                </td>
                <td>{shortId(h.searchHash, 12)}</td>
              </tr>
            ))}
            {!history.length ? (
              <tr>
                <td colSpan={4} className="fxa-muted">
                  No persisted analogue searches yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="fxa-card" data-analogue-limitations>
        <h2>Limitations and data quality</h2>
        <ul>
          {ANALOGUE_DOCUMENTED_LIMITATIONS.map((line) => (
            <li key={line} className="fxa-muted">
              {line}
            </li>
          ))}
        </ul>
        <p className="fxa-muted">
          Live coverage summary above is from GET /research/coverage when available. Documented
          archive-depth notes that are not API fields are labelled as documented limitations, not
          live metrics.
        </p>
      </section>
    </div>
  );
}
