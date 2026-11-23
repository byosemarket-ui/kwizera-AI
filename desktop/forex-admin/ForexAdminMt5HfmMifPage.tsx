/**
 * Phase 5E Step 4 — HFM_MT5 Market Intelligence Admin surface.
 * Displays ranking, evidence, probability, and AI reasoning from persisted APIs.
 * Analytical only — never execution authorization.
 */
import { useCallback, useEffect, useState } from "react";
import { forexProvidersApi } from "./api";

type Busy = "refresh" | "detect" | "rank" | "prob" | "ai" | null;

function Badge({ value, tone }: { value: string; tone?: "ok" | "warn" | "danger" }) {
  return (
    <span className="fxa-badge" data-tone={tone}>
      {value}
    </span>
  );
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function shortId(id: unknown, n = 12): string {
  const s = String(id ?? "");
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}

export function ForexAdminMt5HfmMifPage() {
  const [symbol, setSymbol] = useState("XAUUSD");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<unknown[]>([]);
  const [rankingItems, setRankingItems] = useState<unknown[]>([]);
  const [probabilityItems, setProbabilityItems] = useState<unknown[]>([]);
  const [reasoningItems, setReasoningItems] = useState<unknown[]>([]);
  const [selectedReasoning, setSelectedReasoning] = useState<Record<string, unknown> | null>(null);
  const [lastOd, setLastOd] = useState<Record<string, unknown> | null>(null);
  const [workerEnabled, setWorkerEnabled] = useState(false);
  const [lifecycleMonitorEnabled, setLifecycleMonitorEnabled] = useState(false);

  const loadLists = useCallback(async () => {
    setBusy("refresh");
    setError(null);
    try {
      const [cands, ranks, probs, ais, worker, lifeMon] = await Promise.all([
        forexProvidersApi.mt5HfmMifCandidatesList({ symbol, limit: 10 }),
        forexProvidersApi.mt5HfmMifRankingList({ symbol, limit: 5 }),
        forexProvidersApi.mt5HfmMifProbabilityList({ symbol, limit: 5 }),
        forexProvidersApi.mt5HfmMifAiReasoningList({ symbol, limit: 5 }),
        forexProvidersApi.mt5HfmMifWorkerStatus().catch(() => null),
        forexProvidersApi.mt5HfmMifLifecycleMonitorStatus().catch(() => null),
      ]);
      setCandidates(cands.items ?? []);
      setRankingItems(ranks.items ?? []);
      setProbabilityItems(probs.items ?? []);
      setReasoningItems(ais.items ?? []);
      if (worker && typeof worker === "object") {
        const w = asRecord((worker as { worker?: unknown }).worker);
        setWorkerEnabled(Boolean(w.enabled));
      }
      if (lifeMon && typeof lifeMon === "object") {
        const m = asRecord((lifeMon as { monitor?: unknown }).monitor);
        setLifecycleMonitorEnabled(Boolean(m.enabled));
      }
      setNote("HFM_MT5 Market Intelligence lists refreshed (read-only).");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load MIF lists.");
    } finally {
      setBusy(null);
    }
  }, [symbol]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  async function runDetection() {
    setBusy("detect");
    setError(null);
    setNote(null);
    try {
      const res = await forexProvidersApi.mt5HfmMifOpportunityDetection({
        symbol: symbol.trim().toUpperCase(),
        timeframes: ["H1", "H4", "D1"],
        primaryTimeframe: "H1",
        persist: true,
        candleLimit: 120,
      });
      const result = asRecord(res.result ?? res);
      setLastOd(result);
      setNote(
        `Detection ${String(result.analysisStatus ?? "ok")} · candidates=${String(result.candidateCount ?? "?")} · provider=${String(result.providerId ?? "?")}`,
      );
      await loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opportunity detection failed.");
    } finally {
      setBusy(null);
    }
  }

  async function runProbabilityForFirstCandidate() {
    const first = asRecord(candidates[0]);
    const cid = String(first.candidateId ?? first.id ?? "");
    if (!cid) {
      setError("No candidate available for probability assessment.");
      return;
    }
    setBusy("prob");
    setError(null);
    try {
      await forexProvidersApi.mt5HfmMifProbabilityCreate({ candidateId: cid });
      setNote(`Probability assessment requested for ${shortId(cid, 16)} (nullable if levels missing).`);
      await loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Probability assessment failed.");
    } finally {
      setBusy(null);
    }
  }

  async function runAiReasoning() {
    const runId = String(
      asRecord(lastOd).requestId
        ?? asRecord(asRecord(lastOd).persistence).runId
        ?? "",
    );
    if (!runId) {
      setError("Run an opportunity detection first so an analysisRunId exists.");
      return;
    }
    setBusy("ai");
    setError(null);
    try {
      const first = asRecord(candidates[0]);
      const cid = String(first.candidateId ?? "");
      const res = await forexProvidersApi.mt5HfmMifAiReasoningCreate({
        analysisRunId: runId,
        candidateId: cid || undefined,
        reuseExisting: false,
      });
      const reasoning = asRecord(res.reasoning);
      setSelectedReasoning(reasoning);
      setNote(
        `AI reasoning ${String(reasoning.status)} · model=${String(reasoning.modelIdentifier ?? "n/a")} · approve=${String(reasoning.doesNotApproveAiReasoning)}`,
      );
      await loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI reasoning failed.");
    } finally {
      setBusy(null);
    }
  }

  async function openReasoning(id: string) {
    setBusy("refresh");
    setError(null);
    try {
      const res = await forexProvidersApi.mt5HfmMifAiReasoningGet(id);
      setSelectedReasoning(asRecord(res.reasoning));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reasoning.");
    } finally {
      setBusy(null);
    }
  }

  const output = asRecord(selectedReasoning?.output);
  const bullish = asRecord(output.bullishScenario);
  const bearish = asRecord(output.bearishScenario);

  return (
    <div className="fxa-page" data-forex-admin-mif-intelligence>
      <header className="fxa-page-header">
        <h1>HFM MT5 Market Intelligence</h1>
        <p className="fxa-muted">
          Phase 5E integrated view — ranking, evidence, probability, and AI reasoning.
          Analytical only. Ranking is not win probability. Null probability is not zero.
        </p>
      </header>

      <section className="fxa-card">
        <div className="fxa-row" style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <label>
            Symbol{" "}
            <input
              className="fxa-input"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              style={{ width: 100 }}
            />
          </label>
          <button type="button" className="fxa-btn" disabled={busy != null} onClick={() => void loadLists()}>
            Refresh
          </button>
          <button type="button" className="fxa-btn" disabled={busy != null} onClick={() => void runDetection()}>
            Run detection
          </button>
          <button
            type="button"
            className="fxa-btn"
            disabled={busy != null || candidates.length === 0}
            onClick={() => void runProbabilityForFirstCandidate()}
          >
            Assess probability
          </button>
          <button type="button" className="fxa-btn" disabled={busy != null} onClick={() => void runAiReasoning()}>
            Run AI reasoning
          </button>
          <Badge value={workerEnabled ? "WORKER ON" : "WORKER OFF"} tone={workerEnabled ? "danger" : "ok"} />
          <Badge
            value={lifecycleMonitorEnabled ? "LIFECYCLE MON ON" : "LIFECYCLE MON OFF"}
            tone={lifecycleMonitorEnabled ? "warn" : "ok"}
          />
          <Badge value="HFM_MT5 only" tone="ok" />
          <Badge value="no execution" tone="ok" />
        </div>
        {busy ? <p className="fxa-muted">Busy: {busy}…</p> : null}
        {error ? (
          <div className="fxa-error" role="alert">
            {error}
          </div>
        ) : null}
        {note ? <p className="fxa-muted">{note}</p> : null}
      </section>

      <section className="fxa-card">
        <h2>Candidates</h2>
        {candidates.length === 0 ? (
          <p className="fxa-muted">No persisted candidates for {symbol}.</p>
        ) : (
          <ul className="fxa-list">
            {candidates.slice(0, 8).map((c, i) => {
              const row = asRecord(c);
              return (
                <li key={String(row.candidateId ?? i)}>
                  <code>{shortId(row.candidateId, 16)}</code> · {String(row.strategyId ?? "?")} ·{" "}
                  {String(row.direction ?? "?")} · {String(row.status ?? row.lifecycleState ?? "?")} ·{" "}
                  {String(row.assessmentTimestamp ?? row.updatedAt ?? "")}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="fxa-card">
        <h2>Ranking (setup quality — not win probability)</h2>
        {rankingItems.length === 0 ? (
          <p className="fxa-muted">No ranking runs.</p>
        ) : (
          <ul className="fxa-list">
            {rankingItems.slice(0, 5).map((r, i) => {
              const row = asRecord(r);
              const top = Array.isArray(row.rankings)
                ? (row.rankings as unknown[])[0]
                : Array.isArray(row.top)
                ? (row.top as unknown[])[0]
                : null;
              const t = asRecord(top);
              return (
                <li key={String(row.rankingRunId ?? i)}>
                  <code>{shortId(row.rankingRunId, 18)}</code> · ranked={String(row.rankedCount ?? "?")} ·
                  top score={String(t.overallScore ?? "n/a")} · band={String(t.scoreBand ?? "n/a")} ·{" "}
                  {String(row.calculatedAt ?? "")}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="fxa-card">
        <h2>Probability &amp; calibration</h2>
        <p className="fxa-muted">
          Historical decisive frequency when levels exist. Unavailable when levels missing. Never invent probability.
        </p>
        {probabilityItems.length === 0 ? (
          <p className="fxa-muted">No probability assessments.</p>
        ) : (
          <ul className="fxa-list">
            {probabilityItems.slice(0, 5).map((p, i) => {
              const row = asRecord(p);
              const prob = row.probability;
              const sample = String(row.sampleStatus ?? "?");
              const cal = String(row.calibrationStatus ?? "UNCALIBRATED");
              return (
                <li key={String(row.assessmentId ?? i)}>
                  <code>{shortId(row.assessmentId, 16)}</code> · p=
                  {prob == null ? "null (not zero)" : String(prob)} · sample={sample} · cal={cal} ·
                  reliability={String(row.reliabilityStatus ?? "?")}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="fxa-card">
        <h2>AI market reasoning history</h2>
        {reasoningItems.length === 0 ? (
          <p className="fxa-muted">No AI reasoning runs.</p>
        ) : (
          <ul className="fxa-list">
            {reasoningItems.slice(0, 5).map((a, i) => {
              const row = asRecord(a);
              const id = String(row.reasoningRunId ?? "");
              return (
                <li key={id || String(i)}>
                  <button
                    type="button"
                    className="fxa-btn"
                    style={{ marginRight: 8 }}
                    disabled={!id || busy != null}
                    onClick={() => void openReasoning(id)}
                  >
                    Open
                  </button>
                  <code>{shortId(id, 18)}</code> · {String(row.status)} · model={String(row.modelIdentifier ?? "n/a")} ·{" "}
                  {String(row.calculatedAt ?? "")}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {selectedReasoning ? (
        <section className="fxa-card" data-ai-reasoning-detail>
          <h2>AI reasoning detail</h2>
          <p className="fxa-muted">
            status={String(selectedReasoning.status)} · prompt={String(selectedReasoning.promptVersion)} ·
            contract={String(selectedReasoning.contractId)} · doesNotApprove=
            {String(selectedReasoning.doesNotApproveAiReasoning)} · executionReadiness=
            {String(selectedReasoning.executionReadiness)}
          </p>
          <p>
            <strong>Overview:</strong> {String(output.marketOverview ?? "—")}
          </p>
          <p>
            <strong>Evidence support:</strong> {String(output.evidenceSupportStatus ?? "UNAVAILABLE")}
          </p>
          <div className="fxa-row" style={{ gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <h3>Bullish · {String(bullish.status ?? "—")}</h3>
              <p>{String(bullish.summary ?? "—")}</p>
              <p className="fxa-muted">
                price={String(bullish.priceContextStatus ?? "LEVELS_NOT_PROVIDED")} · support refs=
                {Array.isArray(bullish.supportingEvidenceRefs)
                  ? (bullish.supportingEvidenceRefs as unknown[]).length
                  : 0}
              </p>
              <p className="fxa-muted">
                confirm: {JSON.stringify((bullish.confirmationConditions as unknown[])?.slice?.(0, 2) ?? [])}
              </p>
              <p className="fxa-muted">
                invalidation: {JSON.stringify((bullish.invalidationConditions as unknown[])?.slice?.(0, 2) ?? [])}
              </p>
            </div>
            <div style={{ flex: 1, minWidth: 260 }}>
              <h3>Bearish · {String(bearish.status ?? "—")}</h3>
              <p>{String(bearish.summary ?? "—")}</p>
              <p className="fxa-muted">
                price={String(bearish.priceContextStatus ?? "LEVELS_NOT_PROVIDED")} · support refs=
                {Array.isArray(bearish.supportingEvidenceRefs)
                  ? (bearish.supportingEvidenceRefs as unknown[]).length
                  : 0}
              </p>
              <p className="fxa-muted">
                confirm: {JSON.stringify((bearish.confirmationConditions as unknown[])?.slice?.(0, 2) ?? [])}
              </p>
              <p className="fxa-muted">
                invalidation: {JSON.stringify((bearish.invalidationConditions as unknown[])?.slice?.(0, 2) ?? [])}
              </p>
            </div>
          </div>
          <p>
            <strong>Missing:</strong> {JSON.stringify((output.missingInformation as unknown[])?.slice?.(0, 6) ?? [])}
          </p>
          <p>
            <strong>Contradictions:</strong>{" "}
            {JSON.stringify((output.contradictions as unknown[])?.slice?.(0, 4) ?? [])}
          </p>
          <p>
            <strong>Conclusion:</strong> {String(output.reasoningConclusion ?? "—")}
          </p>
          <p className="fxa-muted">{String(selectedReasoning.disclaimer ?? "")}</p>
        </section>
      ) : null}

      {lastOd ? (
        <section className="fxa-card">
          <h2>Last detection snapshot</h2>
          <p className="fxa-muted">
            provider={String(lastOd.providerId)} · quality={String(lastOd.dataQualityStatus)} · analysis=
            {String(lastOd.analysisStatus)} · run={String(lastOd.requestId ?? "—")} · placesOrders=
            {String(lastOd.placesOrders)} · mutatesBroker={String(lastOd.mutatesBroker)} · acceptsForExecution=
            {String(lastOd.acceptsForExecution)}
          </p>
          {(() => {
            const dq = asRecord(lastOd.dataQualityDiagnostics);
            if (!Object.keys(dq).length) return null;
            return (
              <p className="fxa-muted">
                quality driver: {String(dq.explanation ?? dq.analysisStatusDriver ?? "—")} · codes=
                {JSON.stringify(dq.primaryFindingCodes ?? [])} · sessionCalendarMissing=
                {String(dq.sessionCalendarAuthorityMissing)}
              </p>
            );
          })()}
        </section>
      ) : null}
    </div>
  );
}
