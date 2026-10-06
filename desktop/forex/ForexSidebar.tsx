import { FOREX_GROUP_ORDER, FOREX_NAV, type ForexRouteId, type ForexViewId } from "./forex-routes";
import { resolveForexIcon } from "./forex-icons";

export function ForexSidebar({
  route,
  open,
  onNavigate,
}: {
  route: ForexViewId;
  open: boolean;
  onNavigate: (id: ForexRouteId) => void;
}) {
  return (
    <aside
      id="forex-sidebar"
      className={`fx-sidebar ${open ? "is-open" : ""}`}
      aria-label="Forex navigation"
      data-forex-sidebar="true"
    >
      <div className="fx-brand">
        <span className="fx-brand-mark">KWIZERA</span>
        <span className="fx-brand-sub">FOREX</span>
      </div>
      <nav className="fx-nav" aria-label="Forex modules">
        {FOREX_GROUP_ORDER.map((group) => {
          const items = FOREX_NAV.filter((item) => item.group === group && item.inSidebar);
          if (items.length === 0) return null;
          const label = items[0]?.groupLabel ?? group;
          const groupActive = items.some((item) => item.id === route);
          return (
            <div
              key={group}
              className={`fx-nav-group ${groupActive ? "is-current" : ""}`}
              data-forex-nav-group={group}
              data-forex-nav-group-active={groupActive ? "true" : "false"}
            >
              <span className="fx-nav-group-label">{label}</span>
              {items.map((item) => {
                const Icon = resolveForexIcon(item.icon);
                const active = route === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`fx-nav-item ${active ? "is-active" : ""} ${item.implemented ? "" : "is-future"}`}
                    onClick={() => onNavigate(item.id)}
                    aria-current={active ? "page" : undefined}
                    aria-label={item.implemented ? item.label : `${item.label}, coming soon`}
                    title={item.implemented ? item.label : `${item.label} — ${item.phaseNote}`}
                  >
                    <Icon size={16} aria-hidden="true" />
                    <span>{item.label}</span>
                    {!item.implemented ? <em>Soon</em> : null}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
