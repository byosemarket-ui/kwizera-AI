import { describe, expect, it } from "vitest";
import {
  ADMIN_NAV,
  STUDIO_ROOT_PATH,
  adminPathFor,
  isAdminUrl,
  parseAdminRouteFromLocation,
} from "../../../desktop/admin-control-center/admin-routes.ts";
import { assertNavIconsComplete } from "../../../desktop/shell/nav-icons.ts";
import { ALL_WORKSPACE_IDS } from "../../../desktop/shell/types.ts";
import { SIDEBAR_SECTIONS, workspaceNav } from "../../../desktop/shell/workspace-registry.ts";
import { navigationEngine } from "../../../desktop/shell/navigation/navigation-engine.ts";
import { navigationStore } from "../../../desktop/shell/navigation/navigation-store.ts";
import fs from "node:fs";
import path from "node:path";

describe("Admin Control Center routing separation", () => {
  it("keeps workspace id for redirect compatibility and complete nav icons", () => {
    expect(ALL_WORKSPACE_IDS).toContain("admin");
    expect(() => assertNavIconsComplete()).not.toThrow();
  });

  it("does not place Admin Control Center in the Studio sidebar", () => {
    const sidebarIds = SIDEBAR_SECTIONS.flatMap((section) => section.ids);
    expect(sidebarIds).not.toContain("admin");
    const adminNav = workspaceNav.find((item) => item.id === "admin");
    expect(adminNav?.inSidebar).toBe(false);
    expect(adminNav?.label).toBe("Admin Control Center");
  });

  it("excludes Admin from Studio global search results", () => {
    const results = navigationEngine.search("Admin Control");
    expect(results.some((item) => item.workspace === "admin" || /admin control center/i.test(item.label))).toBe(false);
  });

  it("never records Admin visits in Studio navigation memory", () => {
    const base = {
      favorites: ["home", "ai-me", "production"],
      recent: ["home"],
      pinned: false,
      collapsedGroups: [],
      history: [{ workspace: "home" as const, at: new Date().toISOString() }],
      visitCounts: { home: 1 },
      lastVisitedAt: {},
      recentPanels: [],
      quickAccess: ["home", "production", "ai-me"],
      commandCounts: {},
      frequentProjects: [],
      frequentAssets: [],
      frequentAiActions: [],
      favoriteTemplates: [],
      selectedViews: {},
    };
    const afterVisit = navigationStore.visit(base, "admin");
    expect(afterVisit).toEqual(base);
    const afterFavorite = navigationStore.toggleFavorite(base, "admin");
    expect(afterFavorite).toEqual(base);
    expect(navigationStore.rankFrequentWorkspaces({
      ...base,
      visitCounts: { home: 1, admin: 99, production: 5 },
    })).not.toContain("admin");
  });

  it("LeftSidebar and navigation store source exclude Admin from Studio lists", () => {
    const store = fs.readFileSync(path.resolve("desktop/shell/navigation/navigation-store.ts"), "utf8");
    expect(store).toContain("isStudioNavWorkspace");
    expect(store).toContain('id !== "admin"');
    const sidebar = fs.readFileSync(path.resolve("desktop/shell/LeftSidebar.tsx"), "utf8");
    expect(sidebar).toContain('id !== "admin"');
    expect(sidebar).toContain("/admin/dashboard");
  });

  it("exposes implemented admin routes and marks future sections as coming soon", () => {
    const implemented = ADMIN_NAV.filter((item) => item.implemented).map((item) => item.id);
    expect(implemented).toEqual(expect.arrayContaining(["dashboard", "models", "providers", "features", "settings", "system"]));
    expect(ADMIN_NAV.find((item) => item.id === "customers")?.implemented).toBe(false);
    expect(adminPathFor("models")).toBe("/admin/models");
    expect(STUDIO_ROOT_PATH).toBe("/");
  });

  it("detects admin URLs and parses child routes without Studio dependence", () => {
    expect(isAdminUrl("/admin", "")).toBe(true);
    expect(isAdminUrl("/admin/dashboard", "")).toBe(true);
    expect(isAdminUrl("/admin/models", "")).toBe(true);
    expect(isAdminUrl("/admin/providers", "")).toBe(true);
    expect(isAdminUrl("/admin/features", "")).toBe(true);
    expect(isAdminUrl("/admin/settings", "")).toBe(true);
    expect(isAdminUrl("/admin/system", "")).toBe(true);
    expect(isAdminUrl("/", "")).toBe(false);
    expect(isAdminUrl("/desktop/", "")).toBe(false);
  });

  it("mounts Admin outside Studio shell at the application root", () => {
    const src = fs.readFileSync(path.resolve("desktop/src.tsx"), "utf8");
    expect(src).toContain('surface === "admin"');
    expect(src).toContain("AdminControlCenter");
    expect(src).toContain('data-app-surface="admin"');
    expect(src).toContain('data-app-surface="studio"');
    expect(src).toContain("STUDIO_ROOT_PATH");
    expect(src).toContain("onExitToStudio");
    const admin = fs.readFileSync(path.resolve("desktop/admin-control-center/AdminControlCenter.tsx"), "utf8");
    expect(admin).toContain("Back to Studio");
    expect(admin).toContain("acc-shell");
  });

  it("does not nest AdminControlCenter inside AppShell", () => {
    const shell = fs.readFileSync(path.resolve("desktop/shell/AppShell.tsx"), "utf8");
    expect(shell).not.toContain("AdminControlCenter");
    expect(shell).not.toContain("isAdminUrl");
    expect(shell).toContain('workspace === "admin"');
    expect(shell).toContain("/admin/dashboard");
  });

  it("WorkspaceRouter redirects admin workspace to /admin instead of nesting Admin UI", () => {
    const router = fs.readFileSync(path.resolve("desktop/shell/WorkspaceRouter.tsx"), "utf8");
    expect(router).toContain('case "admin"');
    expect(router).toContain("/admin/dashboard");
    expect(router).not.toContain("<AdminControlCenter");
  });
});

describe("Admin route parsing (jsdom-free helpers)", () => {
  it("maps pathname segments to admin routes when window is available", () => {
    expect(adminPathFor("dashboard")).toBe("/admin/dashboard");
    expect(adminPathFor("providers")).toBe("/admin/providers");
    expect(adminPathFor("features")).toBe("/admin/features");
    expect(adminPathFor("settings")).toBe("/admin/settings");
    expect(adminPathFor("system")).toBe("/admin/system");
    void parseAdminRouteFromLocation;
  });
});
