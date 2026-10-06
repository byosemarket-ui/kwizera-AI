import { customerServiceRegistry } from "./registry";
import { resolveCustomerIcon } from "./icons";
import type { CustomerNavItem } from "./types";

export function CustomerNavSection({
  onNavigate,
  currentWorkspace,
  collapsed,
}: {
  onNavigate: (workspace: string) => void;
  currentWorkspace?: string;
  collapsed?: boolean;
}) {
  const groups = customerServiceRegistry.buildNavigation();

  const activate = (item: CustomerNavItem) => {
    if (item.status !== "AVAILABLE") return;
    if (item.route === "/forex" || item.route.startsWith("/forex/")) {
      window.location.assign("/forex");
      return;
    }
    if (!item.workspace) return;
    onNavigate(item.workspace);
  };

  return (
    <div className="cp-customer-nav" data-customer-nav="true" aria-label="Customer navigation">
      {groups.map((group) => (
        <div key={group.key} className="nav-group-block">
          {!collapsed ? <span className="nav-group">{group.title}</span> : null}
          {group.items.map((item) => {
            const Icon = resolveCustomerIcon(item.icon);
            const hrefNav = item.route === "/forex" || item.route.startsWith("/forex/");
            const available = item.status === "AVAILABLE" && (Boolean(item.workspace) || hrefNav);
            const soon = item.status === "COMING_SOON";
            return (
              <button
                key={item.key}
                type="button"
                data-forex-nav={hrefNav ? "true" : undefined}
                className={`nav-item ${currentWorkspace === item.workspace ? "active" : ""} ${available ? "" : "disabled"}`}
                onClick={() => activate(item)}
                disabled={!available}
                title={soon ? `${item.title} (coming soon)` : item.title}
                aria-label={soon ? `${item.title}, coming soon` : item.title}
                aria-current={currentWorkspace === item.workspace ? "page" : undefined}
              >
                <Icon size={18} />
                <span>{item.title}</span>
                {soon && !collapsed ? <em className="cp-caption">Soon</em> : null}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function customerNavContainsAdmin(): boolean {
  const hay = JSON.stringify(customerServiceRegistry.buildNavigation());
  return /admin control center|\/admin\b/i.test(hay);
}
