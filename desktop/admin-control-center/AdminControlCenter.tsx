import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  LayoutDashboard, Boxes, Cable, Waypoints, Clapperboard, Image, AudioLines, Mic,
  Users, FolderKanban, Activity, Coins, Wallet, CreditCard, HeartPulse, ScrollText,
  HardDrive, Database, Settings, Menu, X, ArrowLeft, KeyRound, Workflow, BookOpen, GraduationCap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ADMIN_GROUP_ORDER, ADMIN_NAV, parseAdminRouteFromLocation, syncAdminUrl } from "./admin-routes";
import type { AdminRouteId } from "./types";
import { ComingSoon } from "./components/ui";
import { DashboardPage } from "./pages/DashboardPage";
import { ModelsPage } from "./pages/ModelsPage";
import { ProvidersPage } from "./pages/ProvidersPage";
import { FeaturesPage } from "./pages/FeaturesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SystemPage } from "./pages/SystemPage";
import { ApiAccessPage } from "./pages/ApiAccessPage";
import { WorkflowsPage } from "./pages/WorkflowsPage";
import { KnowledgePage } from "./pages/KnowledgePage";
import { TrainingPage } from "./pages/TrainingPage";
import "./admin.css";

const ICONS: Record<AdminRouteId, LucideIcon> = {
  dashboard: LayoutDashboard,
  models: Boxes,
  providers: Cable,
  features: Waypoints,
  knowledge: BookOpen,
  training: GraduationCap,
  "api-access": KeyRound,
  video: Clapperboard,
  image: Image,
  audio: AudioLines,
  voice: Mic,
  customers: Users,
  projects: FolderKanban,
  usage: Activity,
  costs: Coins,
  credits: Wallet,
  payments: CreditCard,
  system: HeartPulse,
  workflows: Workflow,
  logs: ScrollText,
  storage: HardDrive,
  database: Database,
  settings: Settings,
};

/** A rendering error inside one Admin page shows an error for that page and keeps the navigation usable. */
class PageBoundary extends Component<{ children: ReactNode }, { failed: string | null }> {
  state = { failed: null as string | null };

  static getDerivedStateFromError(err: unknown) {
    return { failed: err instanceof Error ? err.message.slice(0, 200) : "Unknown rendering error" };
  }

  componentDidCatch(err: unknown) {
    console.error("[KWIZERA] Admin page render failed:", err);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="acc-card" role="alert" style={{ padding: 16 }}>
        <h2>This page could not be displayed</h2>
        <p className="acc-muted">{this.state.failed}</p>
        <p className="acc-muted">Server-side jobs are not affected; reload the page to see their current state.</p>
        <button type="button" className="acc-button" onClick={() => this.setState({ failed: null })}>Try again</button>
      </div>
    );
  }
}

interface AdminControlCenterProps {
  onExitToStudio?: () => void;
  onOpenStudioHealth?: () => void;
}

export function AdminControlCenter({ onExitToStudio, onOpenStudioHealth }: AdminControlCenterProps) {
  const [route, setRoute] = useState<AdminRouteId>(() => parseAdminRouteFromLocation());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    syncAdminUrl(route);
    document.title = "KWIZERA AI STUDIO — Admin Control Center";
    return () => {
      document.title = "KWIZERA AI STUDIO";
    };
  }, [route]);

  useEffect(() => {
    const onPop = () => setRoute(parseAdminRouteFromLocation());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const groups = useMemo(
    () => ADMIN_GROUP_ORDER.map((group) => ({
      group,
      label: ADMIN_NAV.find((item) => item.group === group)?.groupLabel ?? group,
      items: ADMIN_NAV.filter((item) => item.group === group),
    })),
    [],
  );

  const navigate = (id: AdminRouteId, implemented: boolean) => {
    if (!implemented) return;
    setRoute(id);
    setMobileNavOpen(false);
  };

  const goToApiAccess = () => navigate("api-access", true);
  const goToProviders = () => navigate("providers", true);

  let content = <ComingSoon title={ADMIN_NAV.find((item) => item.id === route)?.label ?? "Section"} />;
  if (route === "dashboard") content = <DashboardPage onGoToApiAccess={goToApiAccess} />;
  else if (route === "models") content = <ModelsPage onGoToApiAccess={goToApiAccess} />;
  else if (route === "providers") content = <ProvidersPage onGoToApiAccess={goToApiAccess} />;
  else if (route === "features") content = <FeaturesPage onGoToApiAccess={goToApiAccess} />;
  else if (route === "api-access") content = <ApiAccessPage onGoToProviders={goToProviders} />;
  else if (route === "settings") content = <SettingsPage onGoToApiAccess={goToApiAccess} />;
  else if (route === "system") content = <SystemPage onOpenStudioHealth={onOpenStudioHealth} onGoToApiAccess={goToApiAccess} />;
  else if (route === "workflows") content = <WorkflowsPage onGoToApiAccess={goToApiAccess} />;
  else if (route === "knowledge") content = <KnowledgePage onGoToApiAccess={goToApiAccess} />;
  else if (route === "training") content = <TrainingPage onGoToApiAccess={goToApiAccess} onGoToKnowledge={() => navigate("knowledge", true)} />;

  return (
    <div className="acc-shell" data-admin-route={route}>
      <header className="acc-topbar">
        <div className="acc-topbar-left">
          <button
            type="button"
            className="acc-icon-button acc-mobile-nav-toggle"
            aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="acc-brand">
            <span className="acc-brand-mark">KWIZERA AI STUDIO</span>
            <span className="acc-brand-sub">Admin Control Center</span>
          </div>
        </div>
        <div className="acc-topbar-right">
          {onExitToStudio ? (
            <button type="button" className="acc-button ghost" onClick={onExitToStudio}>
              <ArrowLeft size={14} />
              Back to Studio
            </button>
          ) : null}
        </div>
      </header>

      <div className="acc-body">
        <aside className={`acc-sidebar ${mobileNavOpen ? "open" : ""}`} aria-label="Admin navigation">
          <nav className="acc-nav">
            {groups.map((group) => (
              <div key={group.group} className="acc-nav-group">
                <span className="acc-nav-group-label">{group.label}</span>
                {group.items.map((item) => {
                  const Icon = ICONS[item.id];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`acc-nav-item ${route === item.id ? "active" : ""} ${item.implemented ? "" : "disabled"}`}
                      disabled={!item.implemented}
                      title={item.implemented ? item.label : `${item.label} (coming soon)`}
                      onClick={() => navigate(item.id, item.implemented)}
                    >
                      <Icon size={16} />
                      <span>{item.label}</span>
                      {!item.implemented ? <em className="acc-soon">Soon</em> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        {mobileNavOpen ? (
          <button
            type="button"
            className="acc-sidebar-scrim"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          />
        ) : null}

        <main className="acc-main" id="admin-main">
          <PageBoundary key={route}>{content}</PageBoundary>
        </main>
      </div>
    </div>
  );
}
