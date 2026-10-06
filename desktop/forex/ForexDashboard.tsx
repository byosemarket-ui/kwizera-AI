import { FOREX_DASHBOARD_MODULES, getForexNavItem, type ForexRouteId } from "./forex-routes";
import { ForexModuleCard } from "./components/ForexModuleCard";
import { ForexSectionHeader } from "./components/ForexSectionHeader";
import { ForexStatusBadge } from "./components/ForexStatusBadge";
import { resolveForexIcon } from "./forex-icons";

export function ForexDashboard({
  onOpenModule,
}: {
  onOpenModule: (id: ForexRouteId) => void;
}) {
  return (
    <section className="fx-dashboard" data-forex-dashboard="true" data-forex-page="dashboard" aria-labelledby="fx-dashboard-title">
      <ForexSectionHeader
        eyebrow="KWIZERA FOREX"
        title="Forex Intelligence"
        description="Analyze markets, understand price action, and build intelligent trading workflows."
      />
      <h2 id="fx-dashboard-title" className="fx-sr-only">Forex Dashboard</h2>

      <div className="fx-hero-panel">
        <div>
          <p className="fx-eyebrow">Welcome to KWIZERA Forex</p>
          <p className="fx-page-desc">
            This is the Forex workspace inside KWIZERA AI STUDIO. Navigation for every module is
            available now. Live market data, signals, and execution are not connected yet.
          </p>
        </div>
        <div className="fx-status-stack" role="status">
          <ForexStatusBadge tone="offline">Market data connection: Not connected</ForexStatusBadge>
          <ForexStatusBadge tone="future">Live market integration — Coming in a future phase</ForexStatusBadge>
        </div>
      </div>

      <div className="fx-module-grid" data-forex-module-grid="true">
        {FOREX_DASHBOARD_MODULES.map((module) => {
          const item = getForexNavItem(module.id);
          const Icon = resolveForexIcon(item.icon);
          return (
            <ForexModuleCard
              key={module.id}
              title={module.title}
              description={module.description}
              icon={Icon}
              available={item.implemented}
              statusLabel={item.phaseNote}
              onOpen={() => onOpenModule(module.id)}
            />
          );
        })}
      </div>
    </section>
  );
}
