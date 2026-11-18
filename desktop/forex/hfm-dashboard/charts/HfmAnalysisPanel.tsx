/**
 * Phase 4 — AI Analysis panel below the HFM chart.
 * Analysis-only: never places broker orders.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  analyzeHfmNowRequest,
  disableHfmAutoAnalysisRequest,
  enableHfmAutoAnalysisRequest,
  fetchHfmAutoAnalysisStatus,
  prepareHfmAnalysisContextRequest,
  updateHfmAutoAnalysisSymbolRequest,
} from "./api";

type Tone = "up" | "down" | "warn" | "muted";

type DecisionAction = "BUY" | "SELL" | "NO_TRADE" | "WAITING_FOR_CONFIRMATION" | "NONE";

interface AnalysisResultView {
  action: DecisionAction;
  confidence: number | null;
  confidenceLabel: string | null;
  summary: string;
  trend: string | null;
  momentum: string | null;
  structure: string | null;
  volatility: string | null;
  levels: Array<{ label: string; value: string; tone: Tone }>;
  patterns: string[];
  missingNotes: string[];
  analysisId: string | null;
  symbol: string | null;
  model: string | null;
  completeness: string | null;
  analysisStatus: string | null;
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

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function biasTone(v: string | null): Tone {
  const u = (v ?? "").toUpperCase();
  if (/(BULL|STRONG|HIGHER|ALIGNED|TRENDING)/.test(u)) return "up";
  if (/(BEAR|WEAK|LOWER|CONFLICT|UNACCEPTABLE)/.test(u)) return "down";
  if (/(VOLATILE|MODERATE|MIXED|PARTIAL|WARN)/.test(u)) return "warn";
  if (!u || u === "NOT_PROVIDED" || u === "UNCLEAR" || u === "NEUTRAL") return "muted";
  return "muted";
}

function formatDecision(action: DecisionAction): string {
  switch (action) {
    case "BUY":
      return "BUY";
    case "SELL":
      return "SELL";
    case "NO_TRADE":
      return "NO TRADE";
    case "WAITING_FOR_CONFIRMATION":
      return "WAITING";
    default:
      return "—";
  }
}

function parseAnalysis(analysis: Record<string, unknown> | null): AnalysisResultView | null {
  if (!analysis) return null;
  const result = asRecord(analysis.result);
  const decision = asRecord(result?.decision);
  const rawAction = str(decision?.action)?.toUpperCase() ?? "";
  const action: DecisionAction =
    rawAction === "BUY" || rawAction === "SELL" || rawAction === "NO_TRADE" || rawAction === "WAITING_FOR_CONFIRMATION"
      ? rawAction
      : "NONE";

  const market = asRecord(result?.marketOverview);
  const marketProvided = str(market?.sectionStatus) === "PROVIDED";
  const tf = asRecord(result?.timeframeAnalysis);
  const h1 = asRecord(tf?.H1);
  const trade = asRecord(result?.tradePlan);
  const evidence = asRecord(result?.evidence);
  const risk = asRecord(result?.riskAssessment);
  const completeness = asRecord(result?.completeness);

  const levels: AnalysisResultView["levels"] = [];
  const entry = asRecord(trade?.entryZone);
  const entryLow = num(entry?.low);
  const entryHigh = num(entry?.high);
  if (entryLow != null || entryHigh != null) {
    levels.push({
      label: "Entry zone",
      value: `${entryLow ?? "—"} – ${entryHigh ?? "—"}`,
      tone: "muted",
    });
  }
  const protective = num(trade?.stopLoss);
  if (protective != null) levels.push({ label: "Protective level", value: String(protective), tone: "down" });
  const targets = Array.isArray(trade?.takeProfitTargets)
    ? (trade!.takeProfitTargets as unknown[]).map(num).filter((n): n is number => n != null)
    : [];
  targets.forEach((t, i) => levels.push({ label: `Target ${i + 1}`, value: String(t), tone: "up" }));
  const invalidation = num(trade?.invalidationPrice);
  if (invalidation != null) levels.push({ label: "Invalidation", value: String(invalidation), tone: "down" });

  const patterns: string[] = [];
  const observed = Array.isArray(evidence?.observedFacts) ? evidence!.observedFacts.map(String) : [];
  const interpretations = Array.isArray(evidence?.interpretations) ? evidence!.interpretations.map(String) : [];
  const h1Obs = Array.isArray(h1?.observations) ? h1!.observations.map(String) : [];
  for (const item of [...observed, ...interpretations, ...h1Obs]) {
    const t = item.trim();
    if (t && !patterns.includes(t)) patterns.push(t);
  }

  const missingNotes: string[] = [];
  if (str(market?.sectionStatus) === "NOT_PROVIDED") missingNotes.push("Market overview not provided by AI");
  if (str(h1?.sectionStatus) === "NOT_PROVIDED") missingNotes.push("H1 context not provided by AI");
  const missingSections = Array.isArray(completeness?.missingSections)
    ? completeness!.missingSections.map(String)
    : [];
  for (const m of missingSections) {
    if (m && !missingNotes.includes(m)) missingNotes.push(m);
  }

  const trend = marketProvided ? str(market?.overallBias) : null;
  const momentum = marketProvided ? str(market?.timeframeAlignment) : null;
  const structure = str(h1?.sectionStatus) === "PROVIDED" ? str(h1?.structure) : null;
  const volatility = marketProvided
    ? str(market?.marketCondition)
    : str(risk?.sectionStatus) === "PROVIDED"
      ? str(risk?.riskLevel)
      : null;

  return {
    action,
    confidence: num(decision?.confidence),
    confidenceLabel: str(decision?.confidenceLabel),
    summary: str(decision?.summary) ?? "",
    trend,
    momentum,
    structure,
    volatility,
    levels,
    patterns: patterns.slice(0, 8),
    missingNotes,
    analysisId: str(analysis.analysisId),
    symbol: str(analysis.symbol),
    model: str(result?.model) ?? str(analysis.model),
    completeness: str(completeness?.status),
    analysisStatus: str(result?.analysisStatus) ?? str(analysis.status),
  };
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

export function HfmAnalysisPanel(props: {
  symbol: string;
  timeframe: string;
}) {
  const { symbol, timeframe } = props;
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("IDLE");
  const [error, setError] = useState<string | null>(null);
  const [analysisRaw, setAnalysisRaw] = useState<Record<string, unknown> | null>(null);
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

  const view = useMemo(() => parseAnalysis(analysisRaw), [analysisRaw]);

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

  const refreshScheduler = useCallback(async () => {
    try {
      const body = await fetchHfmAutoAnalysisStatus();
      applyScheduler(body.scheduler);
      const active = asRecord(body.activeAnalysis);
      if (active?.result && !analysisRaw) {
        setAnalysisRaw(active);
      } else if (active && str(active.status) === "COMPLETED" && active.result) {
        setAnalysisRaw(active);
      }
    } catch {
      /* keep last known UI state */
    }
  }, [analysisRaw, applyScheduler]);

  useEffect(() => {
    void refreshScheduler();
  }, [refreshScheduler]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!scheduler.enabled) return;
    const id = window.setInterval(() => {
      void refreshScheduler();
    }, 15_000);
    return () => window.clearInterval(id);
  }, [scheduler.enabled, refreshScheduler]);

  // Persist latest chart symbol for the *next* scheduled run (never mutates an active job).
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
        /* non-fatal: status refresh will reconcile */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe, applyScheduler]);

  const liveTone = busy
    ? "warn"
    : error
      ? "bad"
      : view?.action && view.action !== "NONE"
        ? "ok"
        : "idle";

  const liveLabel = busy
    ? stage || "Analyzing"
    : error
      ? "Failed"
      : scheduler.enabled
        ? "Live Analysis"
        : view
          ? "Latest Analysis"
          : "Idle";

  const onAnalyzeNow = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setStage("PREPARING_CONTEXT");
    setPhase2Note(null);
    try {
      const body = await analyzeHfmNowRequest({ symbol, chartTimeframe: timeframe });
      applyScheduler(body.scheduler);
      const analysis = asRecord(body.analysis);
      if (analysis) setAnalysisRaw(analysis);
      if (body.alreadyRunning) {
        setStage("ALREADY_RUNNING");
        setError(str(body.errorMessage) ?? "Another analysis is already running");
      } else if (!body.ok) {
        setStage(str(body.stage) ?? "FAILED");
        setError(str(body.errorMessage) ?? str(asRecord(body.error)?.message) ?? "Analysis failed");
      } else {
        setStage("COMPLETED");
      }
    } catch (err) {
      setStage("FAILED");
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      void refreshScheduler();
    }
  };

  const onToggleAuto = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (scheduler.enabled) {
        const body = await disableHfmAutoAnalysisRequest();
        applyScheduler(body.scheduler);
        setStage("IDLE");
      } else {
        setStage("ANALYZING");
        const body = await enableHfmAutoAnalysisRequest({ symbol, chartTimeframe: timeframe });
        applyScheduler(body.scheduler ?? asRecord(body.firstRun)?.scheduler);
        const first = asRecord(body.firstRun);
        const analysis = asRecord(first?.analysis) ?? asRecord(body.analysis);
        if (analysis) setAnalysisRaw(analysis);
        if (first && !first.ok) {
          setStage(str(first.stage) ?? "FAILED");
          setError(str(first.errorMessage) ?? "Auto Analysis first run failed");
        } else {
          setStage(first?.alreadyRunning ? "ALREADY_RUNNING" : "COMPLETED");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
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

  const confidencePct = view?.confidence != null ? Math.max(0, Math.min(100, view.confidence)) : null;
  const confidenceTone =
    view?.action === "SELL" ? "sell" : view?.action === "WAITING_FOR_CONFIRMATION" ? "wait" : "buy";

  return (
    <section
      className="hfm-charts-analysis-boundary hfm-analysis-panel"
      data-hfm-analysis-boundary="true"
      data-analysis-implemented="true"
      data-phase2-context="true"
      data-phase3-reasoning="true"
      data-phase4-analysis="true"
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
            disabled={busy}
            onClick={() => void onAnalyzeNow()}
          >
            {busy ? "Analyzing…" : "Analyze Now"}
          </button>
          <button
            type="button"
            className="hap-btn hap-btn-auto"
            data-auto-analysis="true"
            data-on={scheduler.enabled ? "true" : "false"}
            disabled={busy}
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
        (placesOrders=false). Chart symbol now: {symbol}.
      </p>

      <div className="hap-meta-row" data-analysis-meta="true">
        <span>Status: <strong>{stage}</strong></span>
        <span>Symbol: <strong>{view?.symbol ?? symbol}</strong></span>
        <span>Timeframe: <strong>{timeframe}</strong></span>
        <span>Last: <strong>{formatWhen(scheduler.lastCompletedAt)}</strong></span>
        <span>
          Auto: <strong>{scheduler.enabled ? `ON · ${scheduler.status}` : "OFF"}</strong>
        </span>
        <span>
          Next: <strong>{scheduler.enabled ? countdownLabel(scheduler.nextRunAt, nowMs) : "No next automatic run scheduled"}</strong>
        </span>
        {view?.analysisId ? <span>ID: <strong>{view.analysisId}</strong></span> : null}
      </div>

      {error ? <p className="hap-error" data-analysis-error="true">{error}</p> : null}
      {scheduler.enabled && scheduler.lastError ? (
        <p className="hap-error" data-scheduler-error="true">{scheduler.lastError}</p>
      ) : null}

      {settingsOpen ? (
        <div className="hap-settings-panel" data-analysis-settings-panel="true">
          <p>
            Backend-owned Auto Analysis runs every 30 minutes after the previous analysis completes.
            Frontend timers never start analysis.
          </p>
          <p>Selected scheduler symbol: {scheduler.selectedSymbol || "—"}</p>
          <button
            type="button"
            className="hap-btn"
            data-phase2-prepare="true"
            disabled={busy}
            onClick={() => void onPrepareOnly()}
          >
            Prepare HFM Analysis Context
          </button>
          {phase2Note ? <p data-phase2-detail="true">{phase2Note}</p> : null}
        </div>
      ) : null}

      <div className="hap-grid">
        <article className="hap-card" data-card="signal">
          <h3>Signal</h3>
          <div className="hap-decision" data-action={view?.action ?? "NONE"} data-phase3-result="true">
            {formatDecision(view?.action ?? "NONE")}
          </div>
          <div className="hap-confidence-label">
            <span>Confidence</span>
            <strong>
              {confidencePct != null ? `${confidencePct}%` : "Not provided by AI"}
              {view?.confidenceLabel ? ` · ${view.confidenceLabel}` : ""}
            </strong>
          </div>
          <div className="hap-confidence-bar" aria-hidden="true">
            <div
              className="hap-confidence-fill"
              data-tone={confidenceTone}
              style={{ width: `${confidencePct ?? 0}%` }}
            />
          </div>
          <div className="hap-empty" data-phase3-completeness="true">
            {view?.completeness
              ? `Completeness: ${view.completeness}${view.analysisStatus === "COMPLETED_WITH_GAPS" ? " · AI analysis incomplete" : ""}`
              : "No validated decision yet"}
          </div>
        </article>

        <article className="hap-card" data-card="summary">
          <h3><span className="hap-card-icon" aria-hidden="true" /> Market Summary</h3>
          <dl className="hap-kv">
            <div>
              <dt>Trend</dt>
              <dd data-tone={biasTone(view?.trend)}>
                {view?.trend && view.trend !== "NOT_PROVIDED" ? view.trend : "Not provided by AI"}
              </dd>
            </div>
            <div>
              <dt>Momentum</dt>
              <dd data-tone={biasTone(view?.momentum)}>
                {view?.momentum && view.momentum !== "NOT_PROVIDED" ? view.momentum : "Not provided by AI"}
              </dd>
            </div>
            <div>
              <dt>Market Structure</dt>
              <dd data-tone={view?.structure ? "up" : "muted"}>
                {view?.structure || "Not provided by AI"}
              </dd>
            </div>
            <div>
              <dt>Volatility</dt>
              <dd data-tone={biasTone(view?.volatility)}>
                {view?.volatility && view.volatility !== "NOT_PROVIDED" ? view.volatility : "Not provided by AI"}
              </dd>
            </div>
          </dl>
        </article>

        <article className="hap-card" data-card="levels">
          <h3><span className="hap-card-icon" aria-hidden="true" /> Key Levels</h3>
          {view?.levels.length ? (
            <dl className="hap-kv">
              {view.levels.map((lvl) => (
                <div key={`${lvl.label}-${lvl.value}`}>
                  <dt>{lvl.label}</dt>
                  <dd data-tone={lvl.tone}>{lvl.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="hap-empty">No validated levels in this analysis</p>
          )}
        </article>

        <article className="hap-card" data-card="patterns">
          <h3><span className="hap-card-icon" aria-hidden="true" /> Pattern &amp; Context</h3>
          {view?.patterns.length ? (
            <ul className="hap-checklist">
              {view.patterns.map((item) => (
                <li key={item}>
                  <span className="hap-check" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hap-empty">No pattern evidence provided by AI</p>
          )}
          {view?.missingNotes.length ? (
            <div data-phase3-missing="true" className="hap-empty">
              Missing evidence: {view.missingNotes.join(", ")}
            </div>
          ) : null}
        </article>

        <article className="hap-card" data-card="insight" data-span="insight">
          <h3><span className="hap-card-icon" aria-hidden="true" /> AI Insight</h3>
          {view?.summary ? (
            <p className="hap-insight" data-phase3-summary="true">{view.summary}</p>
          ) : (
            <p className="hap-empty">Run Analyze Now to generate an insight from live HFM context.</p>
          )}
          {view?.model ? <p className="hap-empty">Model: {view.model}</p> : null}
        </article>
      </div>
    </section>
  );
}
