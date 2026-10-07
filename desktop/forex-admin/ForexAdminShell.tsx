import { useEffect, useMemo, useState } from "react";
import { ForexAdminPageRouter, titleForView } from "./ForexAdminPages";
import {
  FOREX_ADMIN_GROUP_ORDER,
  FOREX_ADMIN_NAV,
  FOREX_ADMIN_ROOT,
  getForexAdminDocumentTitle,
  parseForexAdminRouteFromLocation,
  pushForexAdminUrl,
  syncForexAdminUrl,
  type ForexAdminLocation,
  type ForexAdminNavGroupId,
} from "./forex-admin-routes";
import "./forex-admin.css";

export function ForexAdminShell() {
  const [location, setLocation] = useState<ForexAdminLocation>(() => parseForexAdminRouteFromLocation());
  const [sidebarOpen, setSidebarOpen] = useState(() => (
    typeof window !== "undefined" ? window.innerWidth > 820 : true
  ));

  useEffect(() => {
    const sync = () => setLocation(parseForexAdminRouteFromLocation());
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => {
    const syncSidebarToViewport = () => {
      const desktop = window.innerWidth > 820;
      setSidebarOpen((open) => (desktop ? true : open));
    };
    syncSidebarToViewport();
    window.addEventListener("resize", syncSidebarToViewport);
    return () => window.removeEventListener("resize", syncSidebarToViewport);
  }, []);

  useEffect(() => {
    syncForexAdminUrl(location.canonicalPath);
    document.title = getForexAdminDocumentTitle(location.view);
  }, [location]);

  const grouped = useMemo(() => {
    const map = new Map<ForexAdminNavGroupId, typeof FOREX_ADMIN_NAV>();
    for (const group of FOREX_ADMIN_GROUP_ORDER) map.set(group, []);
    for (const item of FOREX_ADMIN_NAV) {
      map.get(item.group)?.push(item);
    }
    return map;
  }, []);

  const open = (path: string) => {
    pushForexAdminUrl(path);
    setLocation(parseForexAdminRouteFromLocation(path));
    if (window.innerWidth <= 820) setSidebarOpen(false);
  };

  return (
    <div
      className="fxa-root"
      data-app-surface="forex-admin"
      data-forex-admin-shell
      data-sidebar={sidebarOpen ? "open" : "closed"}
    >
      <aside className="fxa-sidebar" data-forex-admin-sidebar>
        <div className="fxa-brand">
          <strong>FOREX ADMIN</strong>
          <span>AI Knowledge · Education foundation</span>
        </div>
        {[...grouped.entries()].map(([group, items]) => (
          <div className="fxa-nav-group" key={group}>
            <div className="fxa-nav-label">{items[0]?.groupLabel ?? group}</div>
            {items.map((item) => {
              const active = location.canonicalPath === item.path
                || (item.id === "knowledge" && (location.view === "knowledge-detail" || location.view === "knowledge-edit" || location.view === "knowledge-new"))
                || (item.id === "knowledge-documents" && location.view === "knowledge-documents");
              return (
                <button
                  key={item.id}
                  type="button"
                  className="fxa-nav-item"
                  data-active={active ? "true" : "false"}
                  onClick={() => open(item.path)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </aside>
      <div className="fxa-main">
        <header className="fxa-header" data-forex-admin-header>
          <div className="fxa-row">
            <button type="button" className="fxa-btn-secondary fxa-menu-btn" onClick={() => setSidebarOpen((v) => !v)}>
              Menu
            </button>
            <h1>{titleForView(location.view)}</h1>
          </div>
          <div className="fxa-header-actions">
            <button type="button" className="fxa-btn-secondary" onClick={() => { window.location.assign("/forex/dashboard"); }}>
              Open Forex UI
            </button>
            <button type="button" className="fxa-btn-secondary" onClick={() => { window.location.assign("/"); }}>
              Back to Studio
            </button>
          </div>
        </header>
        <main className="fxa-content" data-forex-admin-page>
          <ForexAdminPageRouter
            view={location.view}
            documentId={location.documentId}
            onOpen={open}
          />
        </main>
      </div>
      <span hidden data-forex-admin-root={FOREX_ADMIN_ROOT} />
    </div>
  );
}
