import type { HfmAccountState, HfmFreshness, HfmQuoteState, HfmRealtimeState } from "../types";
import {
  formatAge,
  formatMoney,
  formatPrice,
  formatSpread,
  freshnessLabel,
  quoteDirection,
} from "../format";
import {
  labelCandleFeed,
  labelMarketDataReadiness,
  labelMt5AgentAuth,
  labelQuoteFeed,
  labelTerminalProcess,
  statusToneClass,
} from "../hfm-status-display";

function toneForFreshness(f: HfmFreshness): "live" | "closed" | "stale" | "wait" | "down" {
  if (f === "LIVE") return "live";
  if (f === "MARKET_CLOSED") return "closed";
  if (f === "STALE" || f === "WAITING_FOR_DATA") return f === "STALE" ? "stale" : "wait";
  return "down";
}

export function HfmFreshnessBadge({ freshness }: { freshness: HfmFreshness }) {
  return (
    <span className="hfm-badge" data-tone={toneForFreshness(freshness)}>
      {freshnessLabel(freshness)}
    </span>
  );
}

export function HfmAccountOverview({
  account,
  freshness,
}: {
  account: HfmAccountState | null;
  freshness: HfmFreshness;
}) {
  const ccy = account?.currency ?? null;
  const marginLevel =
    account?.marginLevel != null && Number.isFinite(account.marginLevel)
      ? `${account.marginLevel.toFixed(2)}%`
      : null;
  return (
    <section className="hfm-card hfm-account-panel" aria-label="Account overview">
      <h2 className="hfm-sr-only">Account overview · HFM_MT5 Demo</h2>
      <div className="hfm-account">
        <div className="hfm-account-id">
          <strong className="hfm-account-login">
            {account?.loginExact ?? account?.loginHint ?? "—"}
          </strong>
          <div className="hfm-account-meta">
            {account?.server ?? "Server unavailable"}
            {ccy ? ` · ${ccy}` : ""}
            {marginLevel ? ` · ML ${marginLevel}` : ""}
          </div>
          <div className="hfm-account-badges">
            <HfmFreshnessBadge freshness={freshness} />
            {account?.connectionStatus ? (
              <span
                className="hfm-badge"
                data-tone={account.connectionStatus === "connected" ? "live" : "wait"}
              >
                {account.connectionStatus}
              </span>
            ) : null}
          </div>
        </div>
        <div className="hfm-account-metrics" role="group" aria-label="Account financial metrics">
          <div className="hfm-metric">
            <span>Balance</span>
            <strong>{formatMoney(account?.balance, ccy)}</strong>
          </div>
          <div className="hfm-metric">
            <span>Equity</span>
            <strong>{formatMoney(account?.equity, ccy)}</strong>
          </div>
          <div className="hfm-metric">
            <span>Free Margin</span>
            <strong>{formatMoney(account?.freeMargin, ccy)}</strong>
          </div>
          <div className="hfm-metric">
            <span>Used Margin</span>
            <strong>{formatMoney(account?.usedMargin, ccy)}</strong>
          </div>
          <div className="hfm-metric">
            <span>Leverage</span>
            <strong>
              {account?.leverage != null && String(account.leverage) !== ""
                ? `1:${account.leverage}`
                : "—"}
            </strong>
          </div>
          <div className="hfm-metric">
            <span>Pos / Pending</span>
            <strong>
              {account?.openPositionsCount ?? "—"} / {account?.pendingOrdersCount ?? "—"}
            </strong>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HfmMarketWatch({
  quotes,
  activeSymbol,
  onSelect,
}: {
  quotes: Record<string, HfmQuoteState>;
  activeSymbol: string;
  onSelect: (symbol: string) => void;
}) {
  const rows = Object.values(quotes).sort((a, b) => a.symbol.localeCompare(b.symbol));
  return (
    <section className="hfm-card hfm-watch" aria-label="Market watch">
      <h2>Market Watch</h2>
      {rows.length === 0 ? (
        <p className="hfm-subtitle">Waiting for broker quotes…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Bid</th>
              <th>Ask</th>
              <th>Spread</th>
              <th>Δ</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => {
              const dir = quoteDirection(q);
              return (
                <tr key={q.symbol} data-active={q.symbol === activeSymbol}>
                  <td>
                    <button type="button" className="sym" onClick={() => onSelect(q.symbol)}>
                      {q.symbol}
                    </button>
                  </td>
                  <td className={dir === "up" ? "hfm-dir-up" : dir === "down" ? "hfm-dir-down" : undefined}>
                    {formatPrice(q.bid, q.digits)}
                  </td>
                  <td>{formatPrice(q.ask, q.digits)}</td>
                  <td>{formatSpread(q)}</td>
                  <td className={dir === "up" ? "hfm-dir-up" : dir === "down" ? "hfm-dir-down" : undefined}>
                    {dir === "up" ? "▲" : dir === "down" ? "▼" : "—"}
                  </td>
                  <td>
                    <span className="hfm-badge" data-tone={toneForFreshness(q.freshness)}>
                      {freshnessLabel(q.freshness)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="hfm-subtitle" style={{ marginTop: 8 }}>
        Δ shows tick-to-tick mid move only — not a fabricated 24h change.
      </p>
    </section>
  );
}

export function HfmMarketIntelligence() {
  return (
    <section className="hfm-card" aria-label="Market intelligence">
      <h2>Market Intelligence</h2>
      <p className="hfm-locked-note">ANALYSIS NOT AVAILABLE</p>
      <p className="hfm-subtitle">
        HFM-specific market structure / key levels are not connected in production. No illustrative
        signals are shown.
      </p>
    </section>
  );
}

export function HfmAiAnalysisPanel() {
  return (
    <section className="hfm-card" aria-label="AI analysis">
      <h2>AI Analysis (Read-Only)</h2>
      <p className="hfm-locked-note">ANALYSIS NOT AVAILABLE</p>
      <p className="hfm-subtitle">
        No verified HFM AI BUY/SELL bias is wired. FXCM analysis is not reused here.
      </p>
    </section>
  );
}

export function HfmOrdersPositions({ account }: { account: HfmAccountState | null }) {
  return (
    <section className="hfm-card" aria-label="Orders and positions">
      <h2>Orders & Positions</h2>
      <div className="hfm-kv">
        <div>
          <span>Open positions</span>
          <strong>{account?.openPositionsCount ?? "—"}</strong>
        </div>
        <div>
          <span>Pending orders</span>
          <strong>{account?.pendingOrdersCount ?? "—"}</strong>
        </div>
        <div>
          <span>Detail records</span>
          <strong>Unavailable</strong>
        </div>
      </div>
      <button type="button" className="hfm-trade-lock" disabled>
        Trading disabled — Read-Only (No order execution)
      </button>
    </section>
  );
}

export function HfmSystemHealth({ state }: { state: HfmRealtimeState }) {
  const sseOk = state.sseStatus === "connected";
  const term = labelTerminalProcess(state.terminalRunning);
  const auth = labelMt5AgentAuth(state.authenticated, state.terminalRunning);
  const quote = labelQuoteFeed(state.freshness);
  const candleCount = Object.values(state.candles).reduce((n, tfs) => {
    if (!tfs) return n;
    return n + Object.values(tfs).reduce((m, bars) => m + (Array.isArray(bars) ? bars.length : 0), 0);
  }, 0);
  const candle = labelCandleFeed({ candleBarCount: candleCount, quoteFeed: state.freshness });
  const ready = labelMarketDataReadiness({
    sseStatus: state.sseStatus,
    connectionState: state.connectionState,
    freshness: state.freshness,
  });
  return (
    <section className="hfm-card" aria-label="System health">
      <h2>System Health</h2>
      <ul className="hfm-health-list">
        <li>
          <span>MT5 Terminal</span>
          <strong className={statusToneClass(term.tone)}>{term.text}</strong>
        </li>
        <li>
          <span>Broker auth</span>
          <strong className={statusToneClass(auth.tone)}>{auth.text}</strong>
        </li>
        <li>
          <span>Quote feed</span>
          <strong className={statusToneClass(quote.tone)}>{quote.text}</strong>
        </li>
        <li>
          <span>Candle feed</span>
          <strong className={statusToneClass(candle.tone)}>{candle.text}</strong>
        </li>
        <li>
          <span>Market data</span>
          <strong className={statusToneClass(ready.tone)}>{ready.text}</strong>
        </li>
        <li>
          <span>SSE client</span>
          <strong className={sseOk ? "hfm-ok" : "hfm-warn"}>{state.sseStatus}</strong>
        </li>
        <li>
          <span>Last update age</span>
          <strong>{formatAge(state.ageSec, state.lastEventAt)}</strong>
        </li>
        <li>
          <span>MCP (MT5)</span>
          <strong className="hfm-bad">Not used (Phase 1 bypass)</strong>
        </li>
        <li>
          <span>Broker mutation</span>
          <strong className="hfm-ok">{state.mutatesBroker ? "ENABLED" : "DISABLED"}</strong>
        </li>
      </ul>
    </section>
  );
}

export function HfmDataStatusBar({ state }: { state: HfmRealtimeState }) {
  return (
    <footer className="hfm-footer" aria-label="Safety and data status">
      <span>
        Execution: <strong>OFF</strong>
      </span>
      <span>
        Emergency Lock: <strong className="em-on">ON</strong>
      </span>
      <span>
        Automatic Entry: <strong>DISABLED</strong>
      </span>
      <span>
        placesOrders: <strong>{String(state.placesOrders)}</strong>
      </span>
      <span>
        mutatesBroker: <strong>{String(state.mutatesBroker)}</strong>
      </span>
      <span>
        Feed: <strong>{freshnessLabel(state.freshness)}</strong> · age {formatAge(state.ageSec, state.lastEventAt)} ·
        seq {state.lastSeq ?? "—"}
      </span>
      <span>
        Broker: <strong>HFM_MT5</strong> Demo
      </span>
    </footer>
  );
}
