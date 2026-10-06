import { Activity, Brain, Newspaper, NotebookPen, Shield, Waypoints, Zap, BarChart3 } from "lucide-react";
import { ForexSectionHeader } from "./components/ForexSectionHeader";
import { ForexStatusBadge } from "./components/ForexStatusBadge";
import { ForexEmptyState } from "./components/ForexEmptyState";
import { ForexOverviewCard } from "./components/ForexOverviewCard";
import { MarketCard } from "./components/MarketCard";
import { MarketChartPanel } from "./components/MarketChartPanel";
import {
  FOREX_ACTIVITY,
  FOREX_QUICK_ACTIONS,
  FOREX_SERVICE_CONNECTIONS,
  formatUtcClock,
  resolveMarketSessions,
  sessionStatusLabel,
} from "./dashboard-data";
import type { ForexRouteId } from "./forex-routes";
import type { SelectedMarket } from "./market-data/selected-market";
import type { ChartTimeframeId } from "./chart/types";
import { timeframeLabel } from "./chart/types";
import type { LiveTickerSnapshot, MarketConnectionSnapshot } from "../../ai/market-data/binance/types";
import { connectionBadgeTone, publicConnectionDetail, publicConnectionLabel } from "../../ai/market-data/binance/connection";
import { LiveTickerPanel } from "./LiveTickerPanel";
import {
  formatLastUpdateUtc,
  liveMarketStatusLabel,
  resolveTickerUiStatus,
} from "./market-data/live-market-status";
import { listSessionWatchlist } from "./market-data/session-watchlist";
import { buildBinanceOverviewEntries } from "./market-data/binance-overview";

export function ForexDashboard({
  onOpenModule,
  binanceConnection,
  onRetryBinance,
  selectedMarket,
  timeframe,
  liveTicker,
  onSelectMarket,
}: {
  onOpenModule: (id: ForexRouteId) => void;
  binanceConnection: MarketConnectionSnapshot;
  onRetryBinance: () => void;
  selectedMarket: SelectedMarket | null;
  timeframe: ChartTimeframeId;
  liveTicker: LiveTickerSnapshot;
  onSelectMarket?: (market: SelectedMarket) => void;
}) {
  const overviewEntries = buildBinanceOverviewEntries(selectedMarket, liveTicker);
  const sessions = resolveMarketSessions();
  const clock = formatUtcClock(new Date());
  const tickerStatus = selectedMarket?.venue === "binance-spot"
    ? resolveTickerUiStatus(liveTicker, selectedMarket.symbol)
    : null;
  const sessionWatchlist = listSessionWatchlist();
  const taStatus = selectedMarket?.venue === "binance-spot"
    ? `${selectedMarket.displaySymbol} · ${timeframeLabel(timeframe)} · shared Binance candles with Charts`
    : "Select a Binance Spot symbol for live candles";

  return (
    <section
      className="fx-dashboard"
      data-forex-dashboard="true"
      data-forex-page="dashboard"
      data-market-symbol={selectedMarket?.venue === "binance-spot" ? selectedMarket.symbol : ""}
      data-market-timeframe={timeframe}
      aria-labelledby="fx-dashboard-title"
    >
      <div className="fx-dash-header" data-forex-section="header">
        <ForexSectionHeader
          eyebrow="Welcome to KWIZERA Forex"
          title="Forex Dashboard"
          description="Monitor markets, analyze opportunities and manage your trading workflow from one workspace."
        />
        <h2 id="fx-dashboard-title" className="fx-sr-only">Forex Dashboard</h2>
        <p className="fx-panel-meta">Forex workspace · {clock}</p>
      </div>

      <section className="fx-selected-binance" data-forex-section="selected-market">
        <div className="fx-panel-header">
          <div>
            <h2>Active Binance market</h2>
            <p className="fx-panel-meta">
              {selectedMarket?.venue === "binance-spot"
                ? `${selectedMarket.displaySymbol} (${selectedMarket.symbol}) · Spot miniTicker · status ${tickerStatus ?? "NO_DATA"} · last update ${formatLastUpdateUtc(liveTicker.ticker?.eventTimeUtc)}`
                : "Select a Binance Spot symbol from Markets. Live price is shown only after valid Binance data arrives."}
            </p>
          </div>
          <button type="button" className="fx-text-button" onClick={() => onOpenModule("markets")}>
            Open Markets
          </button>
        </div>
        {selectedMarket?.venue === "binance-spot" ? (
          <LiveTickerPanel snapshot={liveTicker} expectedSymbol={selectedMarket.symbol} />
        ) : null}
      </section>

      <section className="fx-session-panel" data-forex-section="sessions" aria-labelledby="fx-session-title">
        <div className="fx-panel-header">
          <div>
            <h2 id="fx-session-title">Market sessions</h2>
            <p className="fx-panel-meta">
              Standard session hours in UTC. This is a schedule clock, not a live exchange feed.
            </p>
          </div>
        </div>
        <div className="fx-session-grid">
          {sessions.map((session) => (
            <article key={session.id} className="fx-session-card" data-session-status={session.status}>
              <h3>{session.label}</h3>
              <p>{session.hoursLabel}</p>
              <ForexStatusBadge tone="future">
                {sessionStatusLabel(session.status)}
              </ForexStatusBadge>
            </article>
          ))}
        </div>
      </section>

      <section className="fx-market-overview" data-forex-section="markets" aria-labelledby="fx-markets-title">
        <div className="fx-panel-header">
          <div>
            <h2 id="fx-markets-title">Market overview</h2>
            <p className="fx-panel-meta">
              Binance Spot symbols from this session. Live price comes from the shared workspace ticker for the active symbol only — traditional FX pairs are not shown as Binance markets.
            </p>
          </div>
          <button type="button" className="fx-text-button" onClick={() => onOpenModule("markets")}>
            Open Markets
          </button>
        </div>
        {overviewEntries.length === 0 ? (
          <ForexEmptyState
            title="No Binance markets in overview yet."
            description="Open Markets and select a Spot symbol. It becomes the workspace market for Dashboard, Charts, and Technical Analysis."
            actionLabel="Open Markets"
            onAction={() => onOpenModule("markets")}
          />
        ) : (
          <div className="fx-market-grid" data-binance-overview="true">
            {overviewEntries.map((entry) => (
              <MarketCard
                key={entry.market.symbol}
                entry={entry}
                onSelect={onSelectMarket}
              />
            ))}
          </div>
        )}
      </section>

      <div className="fx-dash-split">
        <MarketChartPanel
          selectedMarket={selectedMarket}
          timeframe={timeframe}
          liveTicker={liveTicker}
          onOpenCharts={() => onOpenModule("charts")}
        />
        <section className="fx-watchlist-preview" data-forex-section="watchlist" aria-labelledby="fx-watchlist-title">
          <div className="fx-panel-header">
            <div>
              <h2 id="fx-watchlist-title">Watchlist preview</h2>
              <p className="fx-panel-meta">Same session Binance symbols as overview. Persistence is not connected.</p>
            </div>
            <button type="button" className="fx-text-button" onClick={() => onOpenModule("watchlist")}>
              Open Watchlist
            </button>
          </div>
          {sessionWatchlist.length === 0 ? (
            <ForexEmptyState
              title="Your watchlist is currently empty."
              description="Select Binance Spot symbols from Markets. They appear here for this browser session only — no fake prices."
              actionLabel="Open Markets"
              onAction={() => onOpenModule("markets")}
            />
          ) : (
            <ul className="fx-watchlist-rows" data-session-watchlist-preview="true">
              {sessionWatchlist.map((entry) => {
                const active = selectedMarket?.symbol === entry.symbol;
                const status = active ? resolveTickerUiStatus(liveTicker, entry.symbol) : null;
                return (
                  <li key={entry.symbol}>
                    <span>{entry.displaySymbol}</span>
                    <span>{status === "LIVE" ? "LIVE" : active ? liveMarketStatusLabel(status ?? "CONNECTED") : "Session"}</span>
                    {onSelectMarket ? (
                      <button type="button" className="fx-text-button" onClick={() => onSelectMarket(entry)}>
                        {active ? "Active" : "Select"}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="fx-overview-grid" data-forex-section="modules">
        <ForexOverviewCard
          testId="technical-analysis"
          title="Technical Analysis"
          description="SMA, EMA, RSI, MACD and Bollinger tools share the chart engine. Not a trading signal."
          status={taStatus}
          actionLabel="Open Technical Analysis"
          icon={Activity}
          onOpen={() => onOpenModule("technical-analysis")}
        />
        <ForexOverviewCard
          testId="ai-analysis"
          title="AI Analysis"
          description="Ollama-backed Forex AI foundation. Health status and structured reasoning over market state — not a trading signal."
          status="Forex AI foundation"
          actionLabel="Open AI Analysis"
          icon={Brain}
          onOpen={() => onOpenModule("ai-analysis")}
        />
        <ForexOverviewCard
          testId="signals"
          title="Trading Signals"
          description="No live signals available. Signal engine will be connected in a future phase."
          status="Signal engine not connected"
          actionLabel="Open Signals"
          icon={Zap}
          onOpen={() => onOpenModule("signals")}
        />
        <ForexOverviewCard
          testId="strategies"
          title="Strategies"
          description="Strategy development, monitoring, and testing will live in this workspace."
          status="Strategy engine not connected"
          actionLabel="Open Strategies"
          icon={Waypoints}
          onOpen={() => onOpenModule("strategies")}
        />
        <ForexOverviewCard
          testId="risk"
          title="Risk Management"
          description="Risk-per-trade, position sizing, and exposure tools will appear here."
          status="Risk data not connected."
          actionLabel="Open Risk Management"
          icon={Shield}
          onOpen={() => onOpenModule("risk-management")}
        />
        <ForexOverviewCard
          testId="performance"
          title="Performance"
          description="No trading history available. Performance analytics will appear after the trading data layer is connected."
          status="Performance data not connected"
          actionLabel="Open Performance"
          icon={BarChart3}
          onOpen={() => onOpenModule("performance")}
        />
        <ForexOverviewCard
          testId="journal"
          title="Trade Journal"
          description="No trades recorded yet."
          status="Journal not connected"
          actionLabel="Open Trade Journal"
          icon={NotebookPen}
          onOpen={() => onOpenModule("trade-journal")}
        />
        <ForexOverviewCard
          testId="intelligence"
          title="Market Intelligence"
          description="Market news, economic events, and sentiment tools will be connected later."
          status="Intelligence feed not connected"
          actionLabel="Open Market Intelligence"
          icon={Newspaper}
          onOpen={() => onOpenModule("market-intelligence")}
        />
      </div>

      <div className="fx-dash-split fx-dash-split-even">
        <section className="fx-calendar-preview" data-forex-section="calendar" aria-labelledby="fx-calendar-title">
          <div className="fx-panel-header">
            <div>
              <h2 id="fx-calendar-title">Upcoming economic events</h2>
              <p className="fx-panel-meta">Calendar feed is reserved for a later phase.</p>
            </div>
          </div>
          <ForexEmptyState
            title="Economic calendar data not connected."
            description="Event times and macroeconomic releases will appear here when the intelligence layer is connected."
            actionLabel="Open Market Intelligence"
            onAction={() => onOpenModule("market-intelligence")}
          />
        </section>
        <section className="fx-activity-preview" data-forex-section="activity" aria-labelledby="fx-activity-title">
          <div className="fx-panel-header">
            <div>
              <h2 id="fx-activity-title">Recent activity</h2>
              <p className="fx-panel-meta">System and trading activity will list here when available.</p>
            </div>
          </div>
          {FOREX_ACTIVITY.length === 0 ? (
            <ForexEmptyState title="No recent activity." description="There is no recorded workspace or trade activity yet." />
          ) : null}
        </section>
      </div>

      <div className="fx-dash-split fx-dash-split-even">
        <section className="fx-quick-actions" data-forex-section="actions" aria-labelledby="fx-actions-title">
          <h2 id="fx-actions-title">Quick actions</h2>
          <div className="fx-action-grid">
            {FOREX_QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                className="fx-text-button fx-action-button"
                onClick={() => onOpenModule(action.id)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </section>
        <section className="fx-connection-panel" data-forex-section="connections" aria-labelledby="fx-connections-title">
          <h2 id="fx-connections-title">Data connection status</h2>
          <p className="fx-panel-meta">
            Binance public REST reachability is checked here. A reachable ping is not live market data.
          </p>
          <ul className="fx-connection-list">
            {FOREX_SERVICE_CONNECTIONS.map((service) => {
              if (service.id === "market-data") {
                return (
                  <li key={service.id}>
                    <span>{service.label}</span>
                    <ForexStatusBadge tone={connectionBadgeTone(binanceConnection)}>
                      {publicConnectionLabel(binanceConnection)}
                    </ForexStatusBadge>
                  </li>
                );
              }
              return (
                <li key={service.id}>
                  <span>{service.label}</span>
                  <ForexStatusBadge tone="offline">{service.detail}</ForexStatusBadge>
                </li>
              );
            })}
          </ul>
          <p
            className="fx-panel-meta"
            role="status"
            data-binance-connection={tickerStatus ? liveTicker.connectionState : binanceConnection.state}
            data-live-market={tickerStatus === "LIVE" ? "true" : "false"}
            data-live-status={tickerStatus ?? "NO_DATA"}
          >
            Market data connection: {tickerStatus === "LIVE"
              ? `Live Binance miniTicker for ${selectedMarket?.symbol}.`
              : tickerStatus
                ? liveMarketStatusLabel(tickerStatus)
                : publicConnectionDetail(binanceConnection)}
          </p>
          {binanceConnection.state === "ERROR" ? (
            <button type="button" className="fx-text-button" onClick={onRetryBinance}>
              Retry
            </button>
          ) : null}
        </section>
      </div>
    </section>
  );
}
