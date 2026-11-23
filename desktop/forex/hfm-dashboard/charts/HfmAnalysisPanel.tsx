/**
 * Phase 6 — Charts AI Analysis panel: Phase 2–5 professional integration.
 * Analysis-only: never places broker orders.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  analyzeHfmNowRequest,
  disableHfmAutoAnalysisRequest,
  enableHfmAutoAnalysisRequest,
  fetchHfmAutoAnalysisStatus,
  fetchHfmEconomicCalendar,
  fetchHfmFundamentalsStatus,
  fetchHfmIntelligenceSummary,
  fetchHfmScenarioSummary,
  prepareHfmAnalysisContextRequest,
  updateHfmAutoAnalysisSymbolRequest,
} from "./api";
import { HfmAiDecisionPanel } from "./analysis/HfmAiDecisionPanel";
import { HfmOpportunityLifecyclePanel } from "./analysis/HfmOpportunityLifecyclePanel";
import { HfmBuyerSellerPressurePanel } from "./analysis/HfmBuyerSellerPressurePanel";
import { HfmDeepTechnicalIntelligencePanel } from "./analysis/HfmDeepTechnicalIntelligencePanel";
import { HfmExternalMarketIntelligencePanel } from "./analysis/HfmExternalMarketIntelligencePanel";

import { HfmAnalyticalLevels } from "./analysis/HfmAnalyticalLevels";
import { HfmAnalysisHistory } from "./analysis/HfmAnalysisHistory";
import { HfmEconomicCalendarPanel } from "./analysis/HfmEconomicCalendarPanel";
import { HfmEvidenceExplorer } from "./analysis/HfmEvidenceExplorer";
import { HfmOrchestrationStatus } from "./analysis/HfmOrchestrationStatus";
import { HfmScenarioCompare } from "./analysis/HfmScenarioCompare";
import {
  emptyCalendarView,
  parseHfmEconomicCalendarResponse,
  type HfmEconomicCalendarView,
} from "./analysis/parse-hfm-fundamentals";
import {
  buildAnalyticalOverlays,
  type HfmAnalyticalOverlay,
} from "./analysis/analytical-overlays";
import { extractScenarioLevels } from "./analysis/parse-hfm-analysis-result";
import {
  useHfmAnalysisSession,
  type AnalysisPackagesState,
} from "./analysis/useHfmAnalysisSession";
import { HFM_ANALYTICAL_CONFIDENCE_DISCLAIMER } from "./analysis/parse-hfm-analysis-result";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

interface SchedulerView {
  enabled: boolean;
  selectedSymbol: string;
  status: string;
  nextRunAt: string | null;
  lastCompletedAt: string | null;
  lastResultStatus: string | null;
  lastError: string | null;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString();
}

function countdownLabel(nextRunAt: string | null, nowMs: number): string {
  if (!nextRunAt) return "No next automatic run scheduled";
  const t = Date.parse(nextRunAt);
  if (!Number.isFinite(t)) return nextRunAt;
  const diff = t - nowMs;
  if (diff <= 0) return "Due now (backend-owned)";
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

async function loadPackagesForSnapshot(input: {
  snapshotId: string;
  symbol?: string | null;
}): Promise<AnalysisPackagesState> {
  const [intelBody, scenBody] = await Promise.all([
    fetchHfmIntelligenceSummary({
      snapshotId: input.snapshotId,
      symbol: input.symbol ?? undefined,
    }).catch((err) => ({
      ok: false,
      status: "FAILED",
      error: { message: err instanceof Error ? err.message : String(err) },
      intelligence: null,
    })),
    fetchHfmScenarioSummary({
      snapshotId: input.snapshotId,
      symbol: input.symbol ?? undefined,
    }).catch((err) => ({
      ok: false,
      status: "FAILED",
      error: { message: err instanceof Error ? err.message : String(err) },
      scenarioPackage: null,
    })),
  ]);
  const intelErr = asRecord(intelBody.error);
  const scenErr = asRecord(scenBody.error);
  const intelFailed = intelBody.ok === false;
  const scenFailed = scenBody.ok === false && scenBody.status !== "NOT_FOUND";
  return {
    intelligence: asRecord(intelBody.intelligence),
    intelligenceStatus: str(intelBody.status),
    scenarioPackage: asRecord(scenBody.scenarioPackage),
    scenarioStatus: str(scenBody.status),
    loadError: intelFailed
      ? (str(intelErr?.message) ?? "Intelligence load failed")
      : scenFailed
        ? (str(scenErr?.message) ?? "Scenario load failed")
        : null,
  };
}

export function HfmAnalysisPanel(props: {
  symbol: string;
  timeframe: string;
  onAnalyticalOverlaysChange?: (overlays: HfmAnalyticalOverlay[]) => void;
  onRequestLoadSymbol?: (symbol: string) => void;
}) {
  const { symbol, timeframe } = props;
  const session = useHfmAnalysisSession(symbol);
  const {
    state: sessionState,
    setStage,
    setError,
    beginRequest,
    isCurrent,
    finishRequest,
    applyAnalysis,
    applyPackages,
    clearForSymbolChange,
    loadHistoryView,
    returnToLive,
    emptyPackages,
  } = session;
  const [calendarView, setCalendarView] = useState<HfmEconomicCalendarView>(() =>
    emptyCalendarView({ loading: true }),
  );
  const [scheduler, setScheduler] = useState<SchedulerView>({
    enabled: false,
    selectedSymbol: symbol,
    status: "OFF",
    nextRunAt: null,
    lastCompletedAt: null,
    lastResultStatus: null,
    lastError: null,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [phase2Note, setPhase2Note] = useState<string | null>(null);
  const [showOverlays, setShowOverlays] = useState(false);
  const [highlightScenarioId, setHighlightScenarioId] = useState<string | null>(null);
  const [lastAppliedAnalysisId, setLastAppliedAnalysisId] = useState<string | null>(null);

  const view = sessionState.view;

  const applyScheduler = useCallback((raw: unknown) => {
    const s = asRecord(raw);
    if (!s) return;
    setScheduler({
      enabled: Boolean(s.enabled),
      selectedSymbol: str(s.selectedSymbol) ?? symbol,
      status: str(s.status) ?? (s.enabled ? "IDLE" : "OFF"),
      nextRunAt: str(s.nextRunAt),
      lastCompletedAt: str(s.lastCompletedAt),
      lastResultStatus: str(s.lastResultStatus),
      lastError: str(s.lastError),
    });
  }, [symbol]);

  const attachPackages = useCallback(async (
    gen: number,
    analysis: Record<string, unknown> | null,
  ) => {
    const parsed = analysis ? asRecord(analysis) : null;
    const snapshotId = str(parsed?.snapshotId) ?? str(parsed?.contextId);
    if (!snapshotId) {
      applyPackages(gen, emptyPackages());
      return;
    }
    const pkgs = await loadPackagesForSnapshot({
      snapshotId,
      symbol: str(parsed?.symbol) ?? symbol,
    });
    applyPackages(gen, pkgs);
  }, [applyPackages, emptyPackages, symbol]);

  const refreshScheduler = useCallback(async () => {
    try {
      const body = await fetchHfmAutoAnalysisStatus();
      applyScheduler(body.scheduler);
      const active = asRecord(body.activeAnalysis);
      if (!active) return;
      if (sessionState.busy || sessionState.mode === "history") return;
      const status = str(active.status);
      const analysisId = str(active.analysisId);
      if (status === "COMPLETED" && active.result) {
        if (analysisId && analysisId === lastAppliedAnalysisId) return;
        const gen = sessionState.requestGeneration;
        if (applyAnalysis(gen, active, { fromAuto: true })) {
          if (analysisId) setLastAppliedAnalysisId(analysisId);
          await attachPackages(gen, active);
        }
      }
    } catch {
      /* keep last known UI state */
    }
  }, [
    applyScheduler,
    attachPackages,
    applyAnalysis,
    sessionState.busy,
    sessionState.mode,
    sessionState.requestGeneration,
    lastAppliedAnalysisId,
  ]);

  useEffect(() => {
    void refreshScheduler();
  }, [refreshScheduler]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // 15s poll only while Auto Analysis is enabled
  useEffect(() => {
    if (!scheduler.enabled) return;
    const id = window.setInterval(() => {
      void refreshScheduler();
    }, 15_000);
    return () => window.clearInterval(id);
  }, [scheduler.enabled, refreshScheduler]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const body = await updateHfmAutoAnalysisSymbolRequest({
          symbol,
          chartTimeframe: timeframe,
        });
        if (!cancelled) applyScheduler(body.scheduler);
      } catch {
        /* non-fatal */
      }
    })();
    clearForSymbolChange();
    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe, applyScheduler, clearForSymbolChange]);

  useEffect(() => {
    let cancelled = false;
    setCalendarView(emptyCalendarView({ loading: true }));
    void (async () => {
      try {
        const statusBody = await fetchHfmFundamentalsStatus();
        const availability = str(statusBody.availability) ?? "NOT_CONFIGURED";
        if (availability === "LICENSING_BLOCKED" || availability === "NOT_CONFIGURED") {
          if (!cancelled) {
            setCalendarView(
              emptyCalendarView({
                loading: false,
                availability,
                attribution: null,
                message: str(statusBody.enableInstructions),
              }),
            );
          }
          return;
        }
        const ccy =
          symbol.length >= 6
            ? `${symbol.slice(0, 3)},${symbol.slice(3, 6)}`
            : symbol.startsWith("XAU")
              ? "USD"
              : "";
        const calBody = await fetchHfmEconomicCalendar({
          currency: ccy || undefined,
          impact: "high,medium",
          limit: 40,
        });
        if (!cancelled) setCalendarView(parseHfmEconomicCalendarResponse(calBody));
      } catch {
        if (!cancelled) {
          setCalendarView(
            emptyCalendarView({
              loading: false,
              availability: "UNAVAILABLE",
              message: "Calendar request failed",
            }),
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const scenarioLevels = useMemo(() => {
    const pkg = sessionState.packages.scenarioPackage;
    if (!pkg) return [];
    const bullish = asRecord(pkg.bullishScenario);
    const bearish = asRecord(pkg.bearishScenario);
    const selectedId = highlightScenarioId ?? view?.selectedScenarioId;
    const pick =
      (bullish && str(bullish.scenarioId) === selectedId && bullish)
      || (bearish && str(bearish.scenarioId) === selectedId && bearish)
      || bullish
      || bearish;
    return extractScenarioLevels(pick);
  }, [sessionState.packages.scenarioPackage, highlightScenarioId, view?.selectedScenarioId]);

  const combinedLevels = useMemo(() => {
    const fromAi = view?.levels ?? [];
    const map = new Map<string, (typeof fromAi)[number]>();
    for (const lv of [...fromAi, ...scenarioLevels]) {
      const key = `${lv.label}:${lv.price}`;
      if (!map.has(key)) map.set(key, lv);
    }
    return [...map.values()];
  }, [view?.levels, scenarioLevels]);

  const evidenceLevels = useMemo(() => {
    const evidence = asRecord(sessionState.packages.intelligence?.evidence);
    const items = Array.isArray(evidence?.items) ? evidence!.items : [];
    const out: Array<{ id: string; kind: string; price: number | null; note?: string | null }> = [];
    for (const item of items) {
      const row = asRecord(item);
      if (!row) continue;
      const levels = Array.isArray(row.levels) ? row.levels : [];
      for (const lv of levels) {
        const l = asRecord(lv);
        if (!l) continue;
        out.push({
          id: String(row.evidenceId ?? l.id ?? ""),
          kind: String(l.kind ?? row.evidenceType ?? ""),
          price: typeof l.price === "number" ? l.price : null,
          note: typeof l.note === "string" ? l.note : null,
        });
      }
    }
    return out;
  }, [sessionState.packages.intelligence]);

  useEffect(() => {
    const built = buildAnalyticalOverlays({
      enabled: showOverlays,
      snapshotId: view?.snapshotId ?? null,
      expectedSnapshotId: view?.snapshotId ?? null,
      scenarioId: highlightScenarioId ?? view?.selectedScenarioId,
      levels: combinedLevels,
      evidenceLevels,
    });
    props.onAnalyticalOverlaysChange?.(built.overlays);
  }, [
    showOverlays,
    view?.snapshotId,
    view?.selectedScenarioId,
    highlightScenarioId,
    combinedLevels,
    evidenceLevels,
    props,
  ]);

  const liveTone = sessionState.busy
    ? "warn"
    : sessionState.error
      ? "bad"
      : view?.action && view.action !== "NONE"
        ? "ok"
        : "idle";

  const liveLabel = sessionState.busy
    ? sessionState.stage || "Analyzing"
    : sessionState.error
      ? "Failed"
      : sessionState.mode === "history"
        ? "History view"
        : scheduler.enabled
          ? "Live Analysis"
          : view
            ? "Latest Analysis"
            : "Idle";

  const onAnalyzeNow = async () => {
    if (sessionState.busy) return;
    const gen = beginRequest();
    setStage("PREPARING_CONTEXT");
    setPhase2Note(null);
    try {
      const body = await analyzeHfmNowRequest({ symbol, chartTimeframe: timeframe });
      if (!isCurrent(gen)) return;
      applyScheduler(body.scheduler);
      const analysis = asRecord(body.analysis);
      if (body.alreadyRunning) {
        setStage("ALREADY_RUNNING");
        setError(str(body.errorMessage) ?? "Another analysis is already running");
        if (analysis) applyAnalysis(gen, analysis, { markManualComplete: true });
      } else if (!body.ok) {
        setStage(str(body.stage) ?? "FAILED");
        setError(
          str(body.errorMessage) ?? str(asRecord(body.error)?.message) ?? "Analysis failed",
        );
        if (analysis) applyAnalysis(gen, analysis, { markManualComplete: true });
      } else {
        applyAnalysis(gen, analysis, { markManualComplete: true });
        if (analysis && str(analysis.analysisId)) setLastAppliedAnalysisId(str(analysis.analysisId));
        setStage("COMPLETED");
        await attachPackages(gen, analysis);
      }
    } catch (err) {
      if (!isCurrent(gen)) return;
      setStage("FAILED");
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      finishRequest(gen);
      void refreshScheduler();
    }
  };

  const onToggleAuto = async () => {
    if (sessionState.busy) return;
    const gen = beginRequest();
    try {
      if (scheduler.enabled) {
        const body = await disableHfmAutoAnalysisRequest();
        if (!isCurrent(gen)) return;
        applyScheduler(body.scheduler);
        setStage("IDLE");
      } else {
        setStage("ANALYZING");
        const body = await enableHfmAutoAnalysisRequest({ symbol, chartTimeframe: timeframe });
        if (!isCurrent(gen)) return;
        applyScheduler(body.scheduler ?? asRecord(body.firstRun)?.scheduler);
        const first = asRecord(body.firstRun);
        const analysis = asRecord(first?.analysis) ?? asRecord(body.analysis);
        if (analysis) {
          applyAnalysis(gen, analysis, { markManualComplete: true });
          if (str(analysis.analysisId)) setLastAppliedAnalysisId(str(analysis.analysisId));
          await attachPackages(gen, analysis);
        }
        if (first && !first.ok) {
          setStage(str(first.stage) ?? "FAILED");
          setError(str(first.errorMessage) ?? "Auto Analysis first run failed");
        } else {
          setStage(first?.alreadyRunning ? "ALREADY_RUNNING" : "COMPLETED");
        }
      }
    } catch (err) {
      if (!isCurrent(gen)) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      finishRequest(gen);
      void refreshScheduler();
    }
  };

  const onPrepareOnly = async () => {
    setPhase2Note("Preparing HFM multi-TF context…");
    try {
      const body = await prepareHfmAnalysisContextRequest({ symbol, chartTimeframe: timeframe });
      const snap = asRecord(body.snapshot);
      setPhase2Note(
        `Context ${str(snap?.snapshotId) ?? "—"} · quality ${str(asRecord(snap?.dataQuality)?.status) ?? "—"}`,
      );
    } catch (err) {
      setPhase2Note(err instanceof Error ? err.message : String(err));
    }
  };

  const onHistorySelect = async (analysis: Record<string, unknown>) => {
    const snapshotId = str(analysis.snapshotId) ?? str(analysis.contextId);
    const pkgs = snapshotId
      ? await loadPackagesForSnapshot({
          snapshotId,
          symbol: str(analysis.symbol),
        })
      : emptyPackages();
    loadHistoryView(analysis, pkgs);
    if (str(analysis.analysisId)) setLastAppliedAnalysisId(str(analysis.analysisId));
  };

  return (
    <section
      className="hfm-charts-analysis-boundary hfm-analysis-panel"
      data-hfm-analysis-boundary="true"
      data-analysis-implemented="true"
      data-phase2-context="true"
      data-phase3-reasoning="true"
      data-phase4-analysis="true"
      data-phase6-ui="true"
      aria-label="AI Analysis panel"
    >
      <header className="hap-header">
        <div className="hap-header-left">
          <div className="hap-title-row">
            <span className="hap-bot-icon" aria-hidden="true" />
            <h2 className="hap-title">AI Analysis (OpenAI)</h2>
          </div>
          <span className="hap-live-pill" data-tone={liveTone === "ok" ? undefined : liveTone}>
            <span className="hap-live-dot" aria-hidden="true" />
            {liveLabel}
          </span>
        </div>
        <div className="hap-actions">
          <button
            type="button"
            className="hap-btn hap-btn-analyze"
            data-phase3-reason="true"
            data-analyze-now="true"
            disabled={sessionState.busy}
            onClick={() => void onAnalyzeNow()}
          >
            {sessionState.busy ? "Analyzing…" : "Analyze Now"}
          </button>
          <button
            type="button"
            className="hap-btn hap-btn-auto"
            data-auto-analysis="true"
            data-on={scheduler.enabled ? "true" : "false"}
            disabled={sessionState.busy}
            onClick={() => void onToggleAuto()}
          >
            {scheduler.enabled ? "Auto Analysis ON (Every 30 Min)" : "Auto Analysis OFF"}
          </button>
          <button
            type="button"
            className="hap-btn hap-btn-settings"
            aria-label="Analysis settings"
            data-analysis-settings="true"
            onClick={() => setSettingsOpen((v) => !v)}
          >
            ⚙
          </button>
        </div>
      </header>

      <p className="hap-safety" data-analysis-safety="true">
        AI ANALYSIS ONLY — NO BROKER ORDERS ARE PLACED. No BUY/SELL signals authorize execution
        (placesOrders=false). Chart symbol now: {symbol}. {HFM_ANALYTICAL_CONFIDENCE_DISCLAIMER}
        {" "}
        <a
          className="hap-perf-analytics-link"
          href="/admin/forex/mt5-hfm/performance-analytics"
          data-perf-analytics-nav="true"
        >
          Performance Analytics
        </a>
        {" "}
        (read-only historical outcomes).
      </p>

      <div className="hap-meta-row" data-analysis-meta="true">
        <span>Status: <strong>{sessionState.stage}</strong></span>
        <span>Symbol: <strong>{view?.symbol ?? symbol}</strong></span>
        <span>Chart TF: <strong>{timeframe}</strong></span>
        <span>Analysis pack: <strong>H4–M5</strong></span>
        <span>Last: <strong>{formatWhen(scheduler.lastCompletedAt)}</strong></span>
        <span>
          Auto: <strong>{scheduler.enabled ? `ON · ${scheduler.status}` : "OFF"}</strong>
        </span>
        <span>
          Next: <strong>{scheduler.enabled ? countdownLabel(scheduler.nextRunAt, nowMs) : "No next automatic run scheduled"}</strong>
        </span>
        {view?.analysisId ? <span>ID: <strong>{view.analysisId}</strong></span> : null}
        {view?.snapshotId ? <span>Snapshot: <strong>{view.snapshotId.slice(0, 8)}</strong></span> : null}
      </div>

      {sessionState.staleForSymbol ? (
        <p className="hap-error" data-stale-symbol="true">
          Displayed analysis is for {sessionState.analysisSymbol}, while the chart shows {symbol}.
          Run Analyze Now for the current symbol.
        </p>
      ) : null}
      {sessionState.mode === "history" ? (
        <p className="hap-empty" data-history-mode="true">
          Viewing historical analysis (view-only).{" "}
          <button type="button" className="hap-btn" onClick={() => returnToLive()}>
            Return to live
          </button>
        </p>
      ) : null}

      {sessionState.error ? <p className="hap-error" data-analysis-error="true">{sessionState.error}</p> : null}
      {scheduler.enabled && scheduler.lastError ? (
        <p className="hap-error" data-scheduler-error="true">{scheduler.lastError}</p>
      ) : null}

      {settingsOpen ? (
        <div className="hap-settings-panel" data-analysis-settings-panel="true">
          <p>
            Backend-owned Auto Analysis runs every 30 minutes after the previous analysis completes.
            Frontend timers never start analysis. Status polls every 15s only while Auto is ON.
          </p>
          <p>Selected scheduler symbol: {scheduler.selectedSymbol || "—"}</p>
          <button
            type="button"
            className="hap-btn"
            data-phase2-prepare="true"
            disabled={sessionState.busy}
            onClick={() => void onPrepareOnly()}
          >
            Prepare HFM Analysis Context
          </button>
          {phase2Note ? <p data-phase2-detail="true">{phase2Note}</p> : null}
        </div>
      ) : null}

      <div className="hap-grid hap-grid-phase6">
        <HfmAiDecisionPanel view={view} mode={sessionState.mode} />
        <HfmOrchestrationStatus
          intelligence={sessionState.packages.intelligence}
          status={sessionState.packages.intelligenceStatus}
          loadError={sessionState.packages.loadError}
          chartTimeframe={timeframe}
        />
        <HfmAnalyticalLevels
          levels={combinedLevels}
          riskReward={view?.riskReward ?? null}
          showOverlays={showOverlays}
          onToggleOverlays={setShowOverlays}
        />
      </div>

      <HfmScenarioCompare
        scenarioPackage={sessionState.packages.scenarioPackage}
        outcome={str(sessionState.packages.scenarioPackage?.outcome)}
        selectedScenarioId={highlightScenarioId ?? view?.selectedScenarioId}
        onSelectScenario={setHighlightScenarioId}
      />

      <HfmOpportunityLifecyclePanel symbol={symbol} />

      <HfmBuyerSellerPressurePanel symbol={symbol} />

      <HfmDeepTechnicalIntelligencePanel symbol={symbol} />

      <HfmExternalMarketIntelligencePanel symbol={symbol} />

      <HfmEvidenceExplorer intelligence={sessionState.packages.intelligence} />

      <HfmEconomicCalendarPanel view={calendarView} />

      <HfmAnalysisHistory
        symbol={symbol}
        onSelect={(analysis) => void onHistorySelect(analysis)}
        onLoadSymbolOnChart={(sym) => props.onRequestLoadSymbol?.(sym)}
      />
    </section>
  );
}
