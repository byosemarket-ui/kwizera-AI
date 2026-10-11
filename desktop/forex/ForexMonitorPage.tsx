/**
 * Phase 38F — Continuous server-side market monitoring control panel.
 * Mutations require Admin API token (same session key as Forex Admin).
 */
import { useCallback, useEffect, useState } from "react";
import { ForexSectionHeader } from "./components/ForexSectionHeader";
import { ForexStatusBadge } from "./components/ForexStatusBadge";
import type { SelectedMarket } from "./market-data/selected-market";
import type { ChartTimeframeId } from "./chart/types";
/** Shared with Forex Admin / Admin Control Center — browser session only. */
const FOREX_ADMIN_TOKEN_STORAGE_KEY = "kwizera.admin.apiToken";

function getForexAdminSessionToken(): string {
  try {
    return sessionStorage.getItem(FOREX_ADMIN_TOKEN_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

function setForexAdminSessionToken(token: string): void {
  try {
    const trimmed = token.trim();
    if (trimmed) sessionStorage.setItem(FOREX_ADMIN_TOKEN_STORAGE_KEY, trimmed);
    else sessionStorage.removeItem(FOREX_ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

type MonitorSession = {
  sessionId: string;
  provider: string;
  environment: string | null;
  symbol: string;
  timeframe: string;
  lifecycleState: string;
  freshnessState: string;
  lastEvaluationAt: string | null;
  lastValidCandleTime: number | null;
  lastDataUpdateAt: string | null;
  dataAgeMs: number | null;
  lastError: string | null;
  evaluationCount: number;
  workerActive: boolean;
  currentSetup: {
    setupId: string;
    state: string;
    direction: string;
    evidenceLines: string[];
    confirmationRequirements: Array<{ description: string; met: boolean } | string>;
    invalidationConditions: Array<{ description: string; triggered: boolean } | string>;
  } | null;
  lastEvidenceSummary: string | null;
  narrative: {
    status: string;
    summary: string | null;
    latencyMs: number | null;
    error: string | null;
  };
};

type MonitorEvent = {
  eventId: string;
  type: string;
  at: string;
  fromState: string | null;
  toState: string | null;
  message: string;
  dataFreshness?: string | null;
};

function authHeaders(): Record<string, string> {
  const token = getForexAdminSessionToken();
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
    "x-kwizera-admin-token": token,
  };
}

async function monitorFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    const msg = data?.error?.message || `Request failed (${res.status})`;
    const err = new Error(msg) as Error & { status?: number; code?: string };
    err.status = res.status;
    err.code = data?.error?.code;
    throw err;
  }
  return data as T;
}

function providerFromMarket(market: SelectedMarket | null): string {
  if (!market) return "BINANCE";
  if (market.provider) return market.provider;
  if (market.venue === "forexconnect") return "FOREXCONNECT";
  if (market.venue === "fxcm") return "FXCM";
  if (market.venue === "binance-spot") return "BINANCE";
  return "BINANCE";
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function reqText(item: { description: string; met?: boolean } | string): string {
  if (typeof item === "string") return item;
  return item.met === false ? `${item.description} (pending)` : item.description;
}

function toneFor(state: string): "live" | "future" | "offline" {
  const s = state.toUpperCase();
  if (s.includes("FRESH") || s.includes("CONFIRMED") || s.includes("WATCHING") || s === "COMPLETED") {
    return "live";
  }
  if (
    s.includes("ERROR")
    || s.includes("STALE")
    || s.includes("STOPPED")
    || s.includes("TIMEOUT")
    || s.includes("FAILED")
    || s.includes("INACTIVE")
  ) {
    return "offline";
  }
  return "future";
}

export function ForexMonitorPage({
  selectedMarket,
  timeframe,
}: {
  selectedMarket: SelectedMarket | null;
  timeframe: ChartTimeframeId;
}) {
  const [tokenDraft, setTokenDraft] = useState(() => getForexAdminSessionToken());
  const [sessions, setSessions] = useState<MonitorSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<MonitorEvent[]>([]);
  const [stats, setStats] = useState<{
    activeSessions?: number;
    tickCount?: number;
    lastTickAt?: string | null;
    resources?: { cpuUsage: number; ramUsage: number; systemRamUsedMb: number; systemRamTotalMb: number } | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [narrativeEnabled, setNarrativeEnabled] = useState(true);
  const [metaNote, setMetaNote] = useState<string | null>(null);

  const provider = providerFromMarket(selectedMarket);
  const symbol = selectedMarket?.symbol ?? "";
  const selected = sessions.find((s) => s.sessionId === selectedId) ?? sessions[0] ?? null;

  const refresh = useCallback(async () => {
    try {
      const [listRes, statsRes] = await Promise.all([
        monitorFetch<{ sessions: MonitorSession[] }>("/api/forex/monitor/sessions"),
        monitorFetch<{ stats: typeof stats }>("/api/forex/monitor/stats"),
      ]);
      setSessions(listRes.sessions ?? []);
      setStats(statsRes.stats ?? null);
      setError(null);
      if (!selectedId && listRes.sessions?.[0]) {
        setSelectedId(listRes.sessions[0].sessionId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load monitoring sessions.");
    }
  }, [selectedId]);

  const refreshEvents = useCallback(async (sessionId: string) => {
    try {
      const res = await monitorFetch<{ events: MonitorEvent[] }>(
        `/api/forex/monitor/sessions/${encodeURIComponent(sessionId)}/events`,
      );
      setEvents(res.events ?? []);
    } catch {
      setEvents([]);
    }
  }, []);

  useEffect(() => {
    void monitorFetch<{ note?: string }>("/api/forex/monitor/meta")
      .then((m) => setMetaNote(m.note ?? null))
      .catch(() => setMetaNote(null));
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 8_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (selected?.sessionId) void refreshEvents(selected.sessionId);
  }, [selected?.sessionId, refreshEvents, selected?.lifecycleState, selected?.evaluationCount]);

  const saveToken = () => {
    setForexAdminSessionToken(tokenDraft);
    setError(null);
    void refresh();
  };

  const start = async () => {
    if (!symbol) {
      setError("Select a market instrument first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await monitorFetch<{ session: MonitorSession }>("/api/forex/monitor/sessions", {
        method: "POST",
        body: JSON.stringify({
          provider,
          symbol,
          timeframe,
          narrativeEnabled,
        }),
      });
      setSelectedId(res.session.sessionId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Start failed.");
    } finally {
      setBusy(false);
    }
  };

  const act = async (action: "pause" | "resume" | "stop") => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await monitorFetch(`/api/forex/monitor/sessions/${encodeURIComponent(selected.sessionId)}/${action}`, {
        method: "POST",
        body: "{}",
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${action} failed.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="fx-monitor" data-forex-monitor="phase38f">
      <ForexSectionHeader
        title="Market Monitor"
        description="Server-side continuous monitoring of closed candles with deterministic pattern and structure evidence. Optional LLM narrative never blocks the monitor loop. Not trade execution."
      />

      {metaNote ? <p className="fx-page-desc">{metaNote}</p> : null}

      <div className="fx-monitor-auth">
        <label className="fx-monitor-label" htmlFor="fx-monitor-token">
          Admin API token (session only — {FOREX_ADMIN_TOKEN_STORAGE_KEY})
        </label>
        <div className="fx-monitor-auth-row">
          <input
            id="fx-monitor-token"
            type="password"
            className="fx-monitor-input"
            value={tokenDraft}
            onChange={(e) => setTokenDraft(e.target.value)}
            placeholder="KWIZERA_ADMIN_API_TOKEN"
            autoComplete="off"
          />
          <button type="button" className="fx-studio-link" onClick={saveToken}>
            Save token
          </button>
        </div>
      </div>

      <div className="fx-monitor-controls">
        <div className="fx-monitor-identity">
          <span><strong>Provider</strong> {provider}</span>
          <span><strong>Symbol</strong> {symbol || "—"}</span>
          <span><strong>Timeframe</strong> {timeframe}</span>
        </div>
        <label className="fx-monitor-check">
          <input
            type="checkbox"
            checked={narrativeEnabled}
            onChange={(e) => setNarrativeEnabled(e.target.checked)}
          />
          Optional LLM narrative on setup transitions
        </label>
        <div className="fx-monitor-actions">
          <button type="button" className="fx-studio-link" disabled={busy || !symbol} onClick={() => void start()}>
            Start monitoring
          </button>
          <button type="button" className="fx-studio-link" disabled={busy || !selected} onClick={() => void act("pause")}>
            Pause
          </button>
          <button type="button" className="fx-studio-link" disabled={busy || !selected} onClick={() => void act("resume")}>
            Resume
          </button>
          <button type="button" className="fx-studio-link" disabled={busy || !selected} onClick={() => void act("stop")}>
            Stop
          </button>
        </div>
      </div>

      {error ? (
        <p className="fx-page-desc" role="alert" data-forex-monitor-error="">
          {error}
        </p>
      ) : null}

      {stats ? (
        <div className="fx-monitor-stats" data-forex-monitor-stats="">
          <ForexStatusBadge tone="future">Workers {stats.activeSessions ?? 0}</ForexStatusBadge>
          <ForexStatusBadge tone="future">Ticks {stats.tickCount ?? 0}</ForexStatusBadge>
          <span className="fx-muted">Last tick {fmtTime(stats.lastTickAt)}</span>
          {stats.resources ? (
            <span className="fx-muted">
              VPS probe CPU {stats.resources.cpuUsage}% · RAM {stats.resources.ramUsage}%
              ({stats.resources.systemRamUsedMb}/{stats.resources.systemRamTotalMb} MB)
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="fx-monitor-layout">
        <aside className="fx-monitor-list">
          <h2 className="fx-monitor-h2">Sessions</h2>
          {sessions.length === 0 ? (
            <p className="fx-page-desc">No monitoring sessions. Start one for the selected market.</p>
          ) : (
            <ul>
              {sessions.map((s) => (
                <li key={s.sessionId}>
                  <button
                    type="button"
                    className={s.sessionId === selected?.sessionId ? "fx-monitor-session active" : "fx-monitor-session"}
                    onClick={() => setSelectedId(s.sessionId)}
                  >
                    <span>{s.provider} {s.symbol} {s.timeframe}</span>
                    <ForexStatusBadge tone={toneFor(s.lifecycleState)}>{s.lifecycleState}</ForexStatusBadge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="fx-monitor-detail" data-forex-monitor-detail="">
          {!selected ? (
            <p className="fx-page-desc">Select or start a session to inspect evidence.</p>
          ) : (
            <>
              <div className="fx-monitor-badges">
                <ForexStatusBadge tone={toneFor(selected.lifecycleState)}>
                  Lifecycle {selected.lifecycleState}
                </ForexStatusBadge>
                <ForexStatusBadge tone={toneFor(selected.freshnessState)}>
                  Freshness {selected.freshnessState}
                </ForexStatusBadge>
                <ForexStatusBadge tone={selected.workerActive ? "future" : "live"}>
                  Worker {selected.workerActive ? "busy" : "idle"}
                </ForexStatusBadge>
                <ForexStatusBadge tone={toneFor(selected.narrative.status)}>
                  Narrative {selected.narrative.status}
                </ForexStatusBadge>
              </div>
              <dl className="fx-monitor-dl">
                <div><dt>Last evaluation</dt><dd>{fmtTime(selected.lastEvaluationAt)}</dd></div>
                <div><dt>Last data update</dt><dd>{fmtTime(selected.lastDataUpdateAt)}</dd></div>
                <div><dt>Data age</dt><dd>{selected.dataAgeMs != null ? `${Math.round(selected.dataAgeMs / 1000)}s` : "—"}</dd></div>
                <div><dt>Evaluations</dt><dd>{selected.evaluationCount}</dd></div>
                <div><dt>Evidence</dt><dd>{selected.lastEvidenceSummary || "—"}</dd></div>
              </dl>

              {selected.lastError ? (
                <p className="fx-page-desc" role="status">Error: {selected.lastError}</p>
              ) : null}

              {selected.freshnessState !== "FRESH" ? (
                <p className="fx-page-desc" data-forex-monitor-freshness-warn="">
                  Freshness is {selected.freshnessState}. A running worker is not the same as LIVE market updates.
                  Historical candles can support evaluation but do not prove a live stream.
                </p>
              ) : null}

              {selected.currentSetup ? (
                <div className="fx-monitor-setup" data-forex-monitor-setup="">
                  <h2 className="fx-monitor-h2">
                    Setup {selected.currentSetup.state} · {selected.currentSetup.direction}
                  </h2>
                  <ul>
                    {selected.currentSetup.evidenceLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <h3 className="fx-monitor-h3">Confirmation still needed</h3>
                  <ul>
                    {(selected.currentSetup.confirmationRequirements ?? []).map((item, i) => (
                      <li key={i}>{reqText(item)}</li>
                    ))}
                  </ul>
                  <h3 className="fx-monitor-h3">Invalidation</h3>
                  <ul>
                    {(selected.currentSetup.invalidationConditions ?? []).map((item, i) => (
                      <li key={i}>{typeof item === "string" ? item : item.description}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="fx-page-desc">No setup present — watching for configured conditions.</p>
              )}

              {selected.narrative.status !== "NONE" ? (
                <div className="fx-monitor-narrative" data-forex-monitor-narrative="">
                  <h2 className="fx-monitor-h2">LLM narrative (async)</h2>
                  <p className="fx-page-desc">
                    Status {selected.narrative.status}
                    {selected.narrative.latencyMs != null ? ` · ${selected.narrative.latencyMs}ms` : ""}
                  </p>
                  {selected.narrative.summary ? <p>{selected.narrative.summary}</p> : null}
                  {selected.narrative.error ? <p className="fx-page-desc">{selected.narrative.error}</p> : null}
                </div>
              ) : null}

              <div className="fx-monitor-events" data-forex-monitor-events="">
                <h2 className="fx-monitor-h2">Recent events</h2>
                {events.length === 0 ? (
                  <p className="fx-page-desc">No events yet.</p>
                ) : (
                  <ul>
                    {[...events].reverse().slice(0, 30).map((ev) => (
                      <li key={ev.eventId}>
                        <time>{fmtTime(ev.at)}</time>
                        {" · "}
                        {ev.type}
                        {ev.fromState && ev.toState ? ` · ${ev.fromState} → ${ev.toState}` : ""}
                        {" — "}
                        {ev.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
