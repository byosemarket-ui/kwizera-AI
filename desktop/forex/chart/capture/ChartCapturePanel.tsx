/**
 * Phase 49A — Capture button, scheduled session controls, and capture history.
 * Captures the active chart only (no silent timeframe switching).
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Camera, Pause, Play, Square, Trash2 } from "lucide-react";
import type { ForexPriceChartHandle } from "../ForexPriceChart";
import type { Candle, ChartTimeframeId } from "../types";
import {
  CAPTURE_INTERVAL_PRESETS_MS,
  CAPTURE_MAX_DURATION_MS,
  CAPTURE_MAX_PER_SESSION,
  CAPTURE_MIN_DURATION_MS,
  CAPTURE_MIN_INTERVAL_MS,
  isCaptureTimeframeId,
  type CaptureTimeframeId,
} from "../../../../ai/forex-chart-capture/limits";
import type {
  ChartCaptureListItem,
  ChartCaptureSessionState,
  FeedHealthState,
} from "../../../../ai/forex-chart-capture/types";
import {
  canvasToPngBase64,
  captureImageUrl,
  createCaptureSession,
  deleteCapture,
  listCaptures,
  patchCaptureSession,
  setCaptureSelected,
  uploadCapture,
} from "./capture-client";

export interface ChartCaptureContext {
  symbol: string;
  displaySymbol: string;
  provider: string;
  timeframe: ChartTimeframeId;
  candles: Candle[];
  feedHealth: FeedHealthState;
  bid: number | null;
  ask: number | null;
  mid: number | null;
  lastPrice: number | null;
  lastGenuinePriceChangeAt: string | null;
  lastGenuinePriceChangeAgeMs: number | null;
  marketSnapshotId: string | null;
  marketSnapshotFingerprint: string | null;
}

function formatLocalFromUtc(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toString();
  }
}

function candleWindowFrom(candles: Candle[]) {
  const closed = candles.filter((c) => c.closed !== false);
  const forming = candles.filter((c) => c.closed === false);
  return {
    closedCount: closed.length,
    formingCount: forming.length,
    totalCount: candles.length,
    firstOpenTimeSec: candles[0]?.time ?? null,
    lastOpenTimeSec: candles[candles.length - 1]?.time ?? null,
  };
}

export function ChartCapturePanel({
  chartRef,
  context,
  enabled,
}: {
  chartRef: RefObject<ForexPriceChartHandle | null>;
  context: ChartCaptureContext | null;
  enabled: boolean;
}) {
  const [capturing, setCapturing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ChartCaptureListItem[]>([]);
  const [filterTf, setFilterTf] = useState<string>("");
  const [filterMode, setFilterMode] = useState<string>("");
  const [viewer, setViewer] = useState<ChartCaptureListItem | null>(null);
  const [intervalMs, setIntervalMs] = useState(5 * 60_000);
  const [durationMs, setDurationMs] = useState(30 * 60_000);
  const [maxCaptures, setMaxCaptures] = useState(12);
  const [session, setSession] = useState<ChartCaptureSessionState | null>(null);
  const captureLock = useRef(false);
  const timerRef = useRef<number | null>(null);
  const sessionRef = useRef<ChartCaptureSessionState | null>(null);
  const contextRef = useRef(context);
  contextRef.current = context;
  sessionRef.current = session;

  const refreshHistory = useCallback(async () => {
    const result = await listCaptures({
      limit: 40,
      instrument: contextRef.current?.symbol,
      timeframe: filterTf || undefined,
      mode: filterMode || undefined,
    });
    if (result.ok) setItems(result.items);
  }, [filterTf, filterMode]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  useEffect(() => () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runCapture = useCallback(async (mode: "MANUAL" | "SCHEDULED", sessionId: string | null) => {
    if (captureLock.current) {
      return { ok: false as const, error: "Capture already in progress." };
    }
    const ctx = contextRef.current;
    if (!enabled || !ctx) {
      return { ok: false as const, error: "Select a market with chart data before capturing." };
    }
    if (!isCaptureTimeframeId(ctx.timeframe)) {
      return { ok: false as const, error: `Unsupported timeframe: ${ctx.timeframe}` };
    }
    const handle = chartRef.current;
    if (!handle) {
      return { ok: false as const, error: "Chart renderer is not ready." };
    }

    captureLock.current = true;
    setCapturing(true);
    setError(null);
    setMessage(null);

    try {
      const canvas = handle.takeScreenshot();
      if (!canvas) {
        return { ok: false as const, error: "Native chart screenshot failed." };
      }
      const encoded = canvasToPngBase64(canvas);
      if (!encoded.ok) return encoded;

      const capturedAt = new Date();
      const capturedAtUtc = capturedAt.toISOString();
      const range = handle.getVisibleRange();
      const payload = {
        imageBase64: encoded.base64,
        mimeType: "image/png",
        width: encoded.width,
        height: encoded.height,
        capturedAtUtc,
        capturedAtLocal: formatLocalFromUtc(capturedAtUtc),
        mode,
        instrument: {
          symbol: ctx.symbol,
          displaySymbol: ctx.displaySymbol,
          provider: ctx.provider,
        },
        timeframe: ctx.timeframe,
        chartRange: {
          visibleFromSec: range.timeFromSec,
          visibleToSec: range.timeToSec,
          logicalFrom: range.logicalFrom,
          logicalTo: range.logicalTo,
        },
        candleWindow: candleWindowFrom(ctx.candles),
        quote: {
          bid: ctx.bid,
          ask: ctx.ask,
          mid: ctx.mid,
          lastPrice: ctx.lastPrice,
          feedHealth: ctx.feedHealth,
          lastGenuinePriceChangeAt: ctx.lastGenuinePriceChangeAt,
          lastGenuinePriceChangeAgeMs: ctx.lastGenuinePriceChangeAgeMs,
        },
        marketSnapshot: {
          snapshotId: ctx.marketSnapshotId,
          contentFingerprint: ctx.marketSnapshotFingerprint,
        },
        sessionId,
      };

      const uploaded = await uploadCapture(payload);
      if (!uploaded.ok || !uploaded.capture) {
        return { ok: false as const, error: uploaded.error ?? "Upload failed." };
      }
      setMessage(
        mode === "MANUAL"
          ? `Captured ${ctx.displaySymbol} · ${ctx.timeframe} at ${formatLocalFromUtc(capturedAtUtc)}`
          : `Scheduled capture saved · ${ctx.timeframe}`,
      );
      await refreshHistory();
      return { ok: true as const, capture: uploaded.capture };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Capture failed.",
      };
    } finally {
      captureLock.current = false;
      setCapturing(false);
    }
  }, [chartRef, enabled, refreshHistory]);

  const clearTimer = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const scheduleNext = useCallback((active: ChartCaptureSessionState) => {
    clearTimer();
    if (active.status !== "RUNNING") return;
    const endsAt = active.endsAtUtc ? Date.parse(active.endsAtUtc) : NaN;
    const now = Date.now();
    if (Number.isFinite(endsAt) && now >= endsAt) {
      void patchCaptureSession(active.sessionId, { action: "TICK", status: "COMPLETED", nextCaptureAtUtc: null })
        .then((r) => { if (r.session) setSession(r.session); });
      setMessage("Scheduled session completed (duration reached).");
      return;
    }
    if (active.captureCount >= active.config.maxCaptures) {
      void patchCaptureSession(active.sessionId, { action: "TICK", status: "COMPLETED", nextCaptureAtUtc: null })
        .then((r) => { if (r.session) setSession(r.session); });
      setMessage("Scheduled session completed (max captures reached).");
      return;
    }

    const delay = Math.max(1_000, active.config.intervalMs);
    const nextAt = new Date(now + delay).toISOString();
    void patchCaptureSession(active.sessionId, {
      action: "TICK",
      status: "RUNNING",
      nextCaptureAtUtc: nextAt,
    }).then((r) => { if (r.session) setSession(r.session); });

    timerRef.current = window.setTimeout(async () => {
      const current = sessionRef.current;
      if (!current || current.sessionId !== active.sessionId || current.status !== "RUNNING") return;
      const ctx = contextRef.current;
      if (!ctx
        || ctx.symbol !== current.config.instrumentSymbol
        || ctx.timeframe !== current.config.timeframe
        || ctx.provider !== current.config.provider) {
        const fail = await patchCaptureSession(current.sessionId, {
          action: "TICK",
          status: "FAILED",
          lastError: "Active chart instrument/timeframe no longer matches the session. Capture skipped — chart was not changed.",
          nextCaptureAtUtc: null,
        });
        if (fail.session) setSession(fail.session);
        setError("Scheduled capture stopped: chart selection no longer matches the session (chart was not auto-switched).");
        return;
      }

      const result = await runCapture("SCHEDULED", current.sessionId);
      if (!result.ok) {
        const fail = await patchCaptureSession(current.sessionId, {
          action: "TICK",
          lastError: result.error,
          captureCount: current.captureCount,
        });
        if (fail.session) {
          setSession(fail.session);
          scheduleNext({ ...fail.session, status: "RUNNING" });
        }
        setError(result.error);
        return;
      }
      const nextCount = current.captureCount + 1;
      const tick = await patchCaptureSession(current.sessionId, {
        action: "TICK",
        captureCount: nextCount,
        lastCaptureId: result.capture.captureId,
        lastError: null,
        status: nextCount >= current.config.maxCaptures ? "COMPLETED" : "RUNNING",
      });
      if (tick.session) {
        setSession(tick.session);
        if (tick.session.status === "RUNNING") scheduleNext(tick.session);
        else setMessage("Scheduled session completed.");
      }
    }, delay);
  }, [runCapture]);

  const onManualCapture = async () => {
    const result = await runCapture("MANUAL", session?.sessionId ?? null);
    if (!result.ok) setError(result.error);
  };

  const onStartSession = async () => {
    const ctx = contextRef.current;
    if (!ctx || !enabled) {
      setError("Select a market with chart data before starting a session.");
      return;
    }
    if (intervalMs < CAPTURE_MIN_INTERVAL_MS || durationMs < CAPTURE_MIN_DURATION_MS
      || durationMs > CAPTURE_MAX_DURATION_MS || maxCaptures < 1 || maxCaptures > CAPTURE_MAX_PER_SESSION) {
      setError("Invalid schedule limits.");
      return;
    }
    clearTimer();
    const created = await createCaptureSession({
      enabled: true,
      intervalMs,
      durationMs,
      instrumentSymbol: ctx.symbol,
      instrumentDisplaySymbol: ctx.displaySymbol,
      provider: ctx.provider,
      timeframe: ctx.timeframe as CaptureTimeframeId,
      maxCaptures,
    });
    if (!created.ok || !created.session) {
      setError(created.error ?? "Failed to start session.");
      return;
    }
    setSession(created.session);
    setError(null);
    setMessage("Scheduled session running — keep this page open. Closing the browser stops captures.");
    // First capture shortly after start, then interval cadence.
    const first = await runCapture("SCHEDULED", created.session.sessionId);
    if (first.ok) {
      const tick = await patchCaptureSession(created.session.sessionId, {
        action: "TICK",
        captureCount: 1,
        lastCaptureId: first.capture.captureId,
        lastError: null,
      });
      if (tick.session) {
        setSession(tick.session);
        scheduleNext(tick.session);
      }
    } else {
      setError(first.error);
      scheduleNext(created.session);
    }
  };

  const onPause = async () => {
    if (!session) return;
    clearTimer();
    const r = await patchCaptureSession(session.sessionId, { action: "PAUSE" });
    if (r.session) setSession(r.session);
  };

  const onResume = async () => {
    if (!session) return;
    const r = await patchCaptureSession(session.sessionId, { action: "RESUME" });
    if (r.session) {
      setSession(r.session);
      scheduleNext(r.session);
    }
  };

  const onStop = async () => {
    if (!session) return;
    clearTimer();
    const r = await patchCaptureSession(session.sessionId, { action: "STOP" });
    if (r.session) setSession(r.session);
    setMessage("Scheduled session stopped.");
  };

  const onDelete = async (item: ChartCaptureListItem) => {
    if (!window.confirm(`Delete capture ${item.instrument.displaySymbol} · ${item.timeframe}?`)) return;
    const r = await deleteCapture(item.captureId);
    if (!r.ok) {
      setError(r.error ?? "Delete failed.");
      return;
    }
    if (viewer?.captureId === item.captureId) setViewer(null);
    await refreshHistory();
  };

  const onToggleSelect = async (item: ChartCaptureListItem) => {
    const r = await setCaptureSelected(item.captureId, !item.selectedForAi);
    if (!r.ok) {
      setError(r.error ?? "Selection update failed.");
      return;
    }
    await refreshHistory();
  };

  return (
    <aside className="fx-capture-panel" data-phase-49a="true" data-fx-chart-capture="true">
      <div className="fx-capture-toolbar">
        <button
          type="button"
          className="fx-capture-button"
          data-fx-capture-manual="true"
          disabled={!enabled || capturing}
          aria-busy={capturing}
          onClick={() => void onManualCapture()}
        >
          <Camera size={14} aria-hidden />
          {capturing ? "Capturing…" : "Capture Chart for AI"}
        </button>
        <p className="fx-panel-meta fx-capture-note">
          Captures the visible chart only (native lightweight-charts export). Does not switch timeframe or call OpenAI.
        </p>
      </div>

      {(message || error) ? (
        <p
          className={`fx-capture-status ${error ? "is-error" : "is-ok"}`}
          role="status"
          data-fx-capture-status={error ? "error" : "ok"}
        >
          {error ?? message}
        </p>
      ) : null}

      <details className="fx-capture-schedule" data-fx-capture-schedule="true">
        <summary>Scheduled capture session</summary>
        <p className="fx-panel-meta">
          Runs in this browser tab only. Closing, reloading, or leaving Charts stops the timer.
          Interval includes a 5-minute option. Active chart instrument/timeframe must stay matched —
          the session will not silently change your chart.
        </p>
        <div className="fx-capture-schedule-grid">
          <label>
            Interval
            <select
              aria-label="Capture interval"
              value={intervalMs}
              disabled={session?.status === "RUNNING" || session?.status === "PAUSED"}
              onChange={(e) => setIntervalMs(Number(e.target.value))}
            >
              {CAPTURE_INTERVAL_PRESETS_MS.map((ms) => (
                <option key={ms} value={ms}>
                  {ms === 60_000 ? "1 minute" : `${ms / 60_000} minutes`}
                </option>
              ))}
            </select>
          </label>
          <label>
            Duration
            <select
              aria-label="Session duration"
              value={durationMs}
              disabled={session?.status === "RUNNING" || session?.status === "PAUSED"}
              onChange={(e) => setDurationMs(Number(e.target.value))}
            >
              <option value={15 * 60_000}>15 minutes</option>
              <option value={30 * 60_000}>30 minutes</option>
              <option value={60 * 60_000}>1 hour</option>
              <option value={2 * 60 * 60_000}>2 hours</option>
              <option value={CAPTURE_MAX_DURATION_MS}>24 hours</option>
            </select>
          </label>
          <label>
            Max captures
            <input
              type="number"
              min={1}
              max={CAPTURE_MAX_PER_SESSION}
              aria-label="Maximum captures per session"
              value={maxCaptures}
              disabled={session?.status === "RUNNING" || session?.status === "PAUSED"}
              onChange={(e) => setMaxCaptures(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="fx-capture-session-actions">
          {(!session || session.status === "IDLE" || session.status === "COMPLETED"
            || session.status === "STOPPED" || session.status === "FAILED") ? (
            <button type="button" className="fx-text-button" disabled={!enabled || capturing} onClick={() => void onStartSession()}>
              <Play size={14} aria-hidden /> Start
            </button>
          ) : null}
          {session?.status === "RUNNING" ? (
            <button type="button" className="fx-text-button" onClick={() => void onPause()}>
              <Pause size={14} aria-hidden /> Pause
            </button>
          ) : null}
          {session?.status === "PAUSED" ? (
            <button type="button" className="fx-text-button" onClick={() => void onResume()}>
              <Play size={14} aria-hidden /> Resume
            </button>
          ) : null}
          {session && (session.status === "RUNNING" || session.status === "PAUSED") ? (
            <button type="button" className="fx-text-button" onClick={() => void onStop()}>
              <Square size={14} aria-hidden /> Stop
            </button>
          ) : null}
        </div>
        {session ? (
          <p className="fx-panel-meta" data-fx-capture-session-status={session.status}>
            Session {session.status}
            {" · "}
            {session.captureCount}/{session.config.maxCaptures}
            {session.nextCaptureAtUtc
              ? ` · next ${formatLocalFromUtc(session.nextCaptureAtUtc)}`
              : ""}
            {session.lastError ? ` · ${session.lastError}` : ""}
          </p>
        ) : null}
      </details>

      <div className="fx-capture-history" data-fx-capture-history="true">
        <div className="fx-capture-history-head">
          <strong>Capture history</strong>
          <div className="fx-capture-filters">
            <select
              aria-label="Filter timeframe"
              value={filterTf}
              onChange={(e) => setFilterTf(e.target.value)}
            >
              <option value="">All TF</option>
              <option value="5m">5m</option>
              <option value="15m">15m</option>
              <option value="30m">30m</option>
              <option value="1h">1h</option>
              <option value="4h">4h</option>
              <option value="1d">1d</option>
            </select>
            <select
              aria-label="Filter mode"
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
            >
              <option value="">All modes</option>
              <option value="MANUAL">Manual</option>
              <option value="SCHEDULED">Scheduled</option>
            </select>
          </div>
        </div>
        {items.length === 0 ? (
          <p className="fx-panel-meta fx-capture-empty">No screenshots yet. Capture the chart to build a library for future AI analysis.</p>
        ) : (
          <ul className="fx-capture-list">
            {items.map((item) => (
              <li key={item.captureId} className="fx-capture-card" data-capture-id={item.captureId}>
                <button
                  type="button"
                  className="fx-capture-thumb-btn"
                  onClick={() => setViewer(item)}
                  aria-label={`Open capture ${item.instrument.displaySymbol} ${item.timeframe}`}
                >
                  <img
                    className="fx-capture-thumb"
                    src={captureImageUrl(item.captureId)}
                    alt=""
                    loading="lazy"
                    width={120}
                    height={68}
                  />
                </button>
                <div className="fx-capture-card-meta">
                  <strong>{item.instrument.displaySymbol}</strong>
                  <span>{item.timeframe} · {item.mode}</span>
                  <span>{formatLocalFromUtc(item.capturedAtUtc)}</span>
                  <span>Feed {item.quote.feedHealth}</span>
                  <div className="fx-capture-card-actions">
                    <label className="fx-capture-select">
                      <input
                        type="checkbox"
                        checked={item.selectedForAi}
                        onChange={() => void onToggleSelect(item)}
                      />
                      Select for AI
                    </label>
                    <button
                      type="button"
                      className="fx-icon-button"
                      aria-label="Delete capture"
                      onClick={() => void onDelete(item)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {viewer ? (
        <div className="fx-capture-viewer" role="dialog" aria-modal="true" aria-label="Capture preview">
          <div className="fx-capture-viewer-inner">
            <header className="fx-capture-viewer-head">
              <strong>
                {viewer.instrument.displaySymbol} · {viewer.timeframe} · {viewer.mode}
              </strong>
              <button type="button" className="fx-text-button" onClick={() => setViewer(null)}>Close</button>
            </header>
            <img
              className="fx-capture-viewer-img"
              src={captureImageUrl(viewer.captureId)}
              alt={`${viewer.instrument.displaySymbol} chart capture`}
            />
            <dl className="fx-capture-meta-grid">
              <div><dt>Capture ID</dt><dd>{viewer.captureId}</dd></div>
              <div><dt>UTC</dt><dd>{viewer.capturedAtUtc}</dd></div>
              <div><dt>Local</dt><dd>{viewer.capturedAtLocal}</dd></div>
              <div><dt>Provider</dt><dd>{viewer.instrument.provider}</dd></div>
              <div><dt>Feed</dt><dd>{viewer.quote.feedHealth}</dd></div>
              <div><dt>Bid / Ask</dt><dd>{viewer.quote.bid ?? "—"} / {viewer.quote.ask ?? "—"}</dd></div>
              <div><dt>Candles</dt><dd>{viewer.candleWindow.closedCount} closed · {viewer.candleWindow.formingCount} forming</dd></div>
              <div><dt>Image</dt><dd>{viewer.image.width}×{viewer.image.height} · {viewer.image.byteLength} B · {viewer.image.mimeType}</dd></div>
              <div><dt>Snapshot</dt><dd>{viewer.marketSnapshot.snapshotId ?? "none"}</dd></div>
              <div><dt>Session</dt><dd>{viewer.sessionId ?? "—"}</dd></div>
            </dl>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
