import type { HfmAccountState, HfmFreshness, HfmQuoteState, HfmRealtimeState } from "../types";
import {
  formatAge,
  formatMoney,
  formatPrice,
  formatSpread,
  freshnessLabel,
  quoteDirection,
} from "../format";

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
  const termOk = state.terminalRunning === true;
  const authOk = state.authenticated === true;
  const feedOk =
    state.freshness === "LIVE" || state.freshness === "MARKET_CLOSED" || state.freshness === "STALE";
  const feedDisconnected = state.freshness === "DISCONNECTED" || state.freshness === "DATA_UNAVAILABLE";
  return (
    <section className="hfm-card" aria-label="System health">
      <h2>System Health</h2>
      <ul className="hfm-health-list">
        <li>
          <span>MT5 Terminal</span>
          <strong className={termOk ? "hfm-ok" : "hfm-bad"}>{termOk ? "Online" : "Offline"}</strong>
        </li>
        <li>
          <span>Broker auth</span>
          <strong className={authOk ? "hfm-ok" : "hfm-bad"}>
            {authOk ? "Authenticated" : "Unauthenticated"}
          </strong>
        </li>
        <li>
          <span>HFM Data Feed</span>
          <strong className={feedOk ? "hfm-ok" : feedDisconnected ? "hfm-bad" : "hfm-warn"}>
            {freshnessLabel(state.freshness)}
          </strong>
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
