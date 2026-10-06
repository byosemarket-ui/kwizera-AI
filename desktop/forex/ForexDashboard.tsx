import { Brain, Newspaper, NotebookPen, Shield, Waypoints, Zap, BarChart3 } from "lucide-react";
import { ForexSectionHeader } from "./components/ForexSectionHeader";
import { ForexStatusBadge } from "./components/ForexStatusBadge";
import { ForexEmptyState } from "./components/ForexEmptyState";
import { ForexOverviewCard } from "./components/ForexOverviewCard";
import { MarketCard } from "./components/MarketCard";
import { MarketChartPanel } from "./components/MarketChartPanel";
import {
  FOREX_ACTIVITY,
  FOREX_INSTRUMENTS,
  FOREX_QUICK_ACTIONS,
  FOREX_SERVICE_CONNECTIONS,
  FOREX_WATCHLIST,
  formatUtcClock,
  marketOverviewQuotes,
  resolveMarketSessions,
  sessionStatusLabel,
} from "./dashboard-data";
import type { ForexRouteId } from "./forex-routes";

export function ForexDashboard({
  onOpenModule,
}: {
  onOpenModule: (id: ForexRouteId) => void;
}) {
  const quotes = marketOverviewQuotes();
  const sessions = resolveMarketSessions();
  const chartInstrument = FOREX_INSTRUMENTS[0];
  const clock = formatUtcClock(new Date());

  return (
    <section className="fx-dashboard" data-forex-dashboard="true" data-forex-page="dashboard" aria-labelledby="fx-dashboard-title">
      <div className="fx-dash-header" data-forex-section="header">
        <ForexSectionHeader
          eyebrow="Welcome to KWIZERA Forex"
          title="Forex Dashboard"
          description="Monitor markets, analyze opportunities and manage your trading workflow from one workspace."
        />
        <h2 id="fx-dashboard-title" className="fx-sr-only">Forex Dashboard</h2>
        <p className="fx-panel-meta">Forex workspace · {clock}</p>
      </div>

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
              <ForexStatusBadge tone={session.status === "open" || session.status === "closing-soon" ? "live" : "future"}>
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
            <p className="fx-panel-meta">Instrument labels are ready. Live pricing is not connected.</p>
          </div>
          <button type="button" className="fx-text-button" onClick={() => onOpenModule("markets")}>
            Open Markets
          </button>
        </div>
        <div className="fx-market-grid">
          {quotes.map((quote) => (
            <MarketCard key={quote.instrument.symbol} quote={quote} />
          ))}
        </div>
      </section>

      <div className="fx-dash-split">
        <MarketChartPanel instrument={chartInstrument} onOpenCharts={() => onOpenModule("charts")} />
        <section className="fx-watchlist-preview" data-forex-section="watchlist" aria-labelledby="fx-watchlist-title">
          <div className="fx-panel-header">
            <div>
              <h2 id="fx-watchlist-title">Watchlist preview</h2>
              <p className="fx-panel-meta">Favorites will appear here after the Watchlist module is connected.</p>
            </div>
          </div>
          {FOREX_WATCHLIST.length === 0 ? (
            <ForexEmptyState
              title="Your watchlist is empty."
              description="Add instruments from the Watchlist module."
              actionLabel="Open Watchlist"
              onAction={() => onOpenModule("watchlist")}
            />
          ) : (
            <ul className="fx-watchlist-rows">
              {FOREX_WATCHLIST.map((entry) => (
                <li key={entry.instrument.symbol}>
                  <span>{entry.instrument.symbol}</span>
                  <span>Not connected</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="fx-overview-grid" data-forex-section="modules">
        <ForexOverviewCard
          testId="ai-analysis"
          title="AI Analysis"
          description="AI-assisted Forex analysis will be available here."
          status="AI analysis not connected"
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
            The dashboard UI is ready; underlying services will be connected in later phases.
          </p>
          <ul className="fx-connection-list">
            {FOREX_SERVICE_CONNECTIONS.map((service) => (
              <li key={service.id}>
                <span>{service.label}</span>
                <ForexStatusBadge tone="offline">{service.detail}</ForexStatusBadge>
              </li>
            ))}
          </ul>
          <p className="fx-panel-meta" role="status">Market data connection: Not connected</p>
        </section>
      </div>
    </section>
  );
}
