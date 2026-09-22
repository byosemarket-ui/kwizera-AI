import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  CUSTOMER_CATEGORIES,
  CUSTOMER_SERVICES,
  CustomerRegistryError,
  CustomerServiceRegistry,
  customerNavContainsAdmin,
  customerServiceRegistry,
} from "../../../desktop/customer-platform/index.ts";
import { navigationEngine } from "../../../desktop/shell/navigation/navigation-engine.ts";

describe("Customer service registry", () => {
  it("loads categories and services with stable order and statuses", () => {
    const snapshot = customerServiceRegistry.snapshot();
    expect(snapshot.categories.map((item) => item.key)).toEqual([
      "VIDEO", "IMAGE", "PHOTO_STUDIO", "DESIGN", "AUDIO", "VOICE", "MY_WORK", "ACCOUNT",
    ]);
    expect(snapshot.services.length).toBe(CUSTOMER_SERVICES.length);
    expect(snapshot.services.some((item) => item.status === "AVAILABLE")).toBe(true);
    expect(snapshot.services.some((item) => item.status === "COMING_SOON")).toBe(true);
    const video = snapshot.services.filter((item) => item.category === "VIDEO");
    const orders = video.map((item) => item.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    expect(customerServiceRegistry.getService("create-video")?.workspace).toBe("service-create-video");
  });

  it("rejects invalid, duplicate, and Admin-leaking definitions", () => {
    expect(() => new CustomerServiceRegistry([
      { ...CUSTOMER_CATEGORIES[0], key: "NOT_REAL" as never },
    ], [])).toThrow(CustomerRegistryError);

    expect(() => new CustomerServiceRegistry(CUSTOMER_CATEGORIES, [
      { ...CUSTOMER_SERVICES[0], key: "create-video" },
      { ...CUSTOMER_SERVICES[0], key: "create-video" },
    ])).toThrow(/Duplicate service/);

    expect(() => new CustomerServiceRegistry(CUSTOMER_CATEGORIES, [
      { ...CUSTOMER_SERVICES[0], key: "admin-models", title: "Admin Control Center", route: "/admin/models" },
    ])).toThrow(/Admin/);

    expect(() => new CustomerServiceRegistry(CUSTOMER_CATEGORIES, [
      { ...CUSTOMER_SERVICES[0], key: "ghost", category: "MISSING" as never },
    ])).toThrow(/unknown category/);

    const withDisabled = new CustomerServiceRegistry(CUSTOMER_CATEGORIES, [
      ...CUSTOMER_SERVICES,
      {
        ...CUSTOMER_SERVICES[0],
        key: "retired-tool",
        title: "Retired Tool",
        description: "Kept in the registry but not offered to customers.",
        route: "/create/retired",
        status: "DISABLED",
      },
    ]);
    expect(withDisabled.getService("retired-tool")?.enabled).toBe(false);
    expect(withDisabled.search("Retired Tool")).toEqual([]);
  });

  it("builds customer navigation from the registry and never includes Admin", () => {
    const nav = customerServiceRegistry.buildNavigation();
    expect(nav.map((group) => group.key)).toEqual(["HOME", "CREATE", "MY_WORK", "ACCOUNT"]);
    expect(nav.find((group) => group.key === "HOME")?.items[0]?.workspace).toBe("home");
    expect(nav.find((group) => group.key === "CREATE")?.items.map((item) => item.title)).toEqual(
      expect.arrayContaining(["Video", "Image", "Design", "Photo Studio", "Audio", "Voice"]),
    );
    expect(nav.find((group) => group.key === "MY_WORK")?.items.map((item) => item.key)).toEqual([
      "projects", "assets",
    ]);
    expect(nav.find((group) => group.key === "ACCOUNT")?.items.map((item) => item.key)).toEqual([
      "settings", "help",
    ]);
    expect(JSON.stringify(nav)).not.toMatch(/Admin Control Center|\/admin/);
    expect(customerNavContainsAdmin()).toBe(false);
  });
});

describe("Customer Home architecture", () => {
  it("exposes primary creation services with honest availability", () => {
    const primary = customerServiceRegistry.primaryCreationServices();
    expect(primary.map((item) => item.key)).toEqual([
      "create-video", "edit-photo", "passport-photo", "design-studio",
    ]);
    expect(primary.find((item) => item.key === "create-video")?.status).toBe("AVAILABLE");
    expect(primary.find((item) => item.key === "edit-photo")?.status).toBe("AVAILABLE");
    expect(primary.find((item) => item.key === "passport-photo")?.status).toBe("AVAILABLE");
    expect(primary.find((item) => item.key === "design-studio")?.status).toBe("COMING_SOON");
    expect(primary.find((item) => item.key === "create-video")?.workspace).toBe("service-create-video");
    expect(primary.find((item) => item.key === "edit-photo")?.workspace).toBe("service-edit-photo");
    expect(primary.find((item) => item.key === "passport-photo")?.workspace).toBe("service-passport");
    expect(primary.find((item) => item.key === "design-studio")?.workspace).toBeUndefined();
  });

  it("builds home catalog pillars and explore categories from the central registry", () => {
    const catalog = customerServiceRegistry.homeCatalogCategories();
    expect(catalog.map((entry) => entry.category.key)).toEqual([
      "VIDEO", "IMAGE", "PHOTO_STUDIO", "DESIGN", "AUDIO", "VOICE",
    ]);
    expect(catalog.find((entry) => entry.category.key === "VIDEO")?.status).toBe("AVAILABLE");
    expect(catalog.find((entry) => entry.category.key === "VOICE")?.status).toBe("COMING_SOON");
    const explore = customerServiceRegistry.exploreCategories();
    expect(explore.map((entry) => entry.category.key)).toEqual([
      "VIDEO", "IMAGE", "PHOTO_STUDIO", "DESIGN", "AUDIO", "VOICE",
    ]);
    expect(explore.every((entry) => entry.services.length > 0)).toBe(true);
    expect(explore.every((entry) => entry.services.every((service) => service.category === entry.category.key))).toBe(true);
  });

  it("quick actions only include available services with workspaces", () => {
    const actions = customerServiceRegistry.quickActionsForHome();
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((item) => item.status === "AVAILABLE" && item.workspace)).toBe(true);
    expect(actions.some((item) => item.key === "passport-photo")).toBe(true);
  });
});

describe("Customer design system and components", () => {
  it("defines required tokens and reusable component exports", () => {
    const css = fs.readFileSync(path.resolve("desktop/customer-platform/customer.css"), "utf8");
    for (const token of [
      "--cp-bg", "--cp-surface", "--cp-surface-elevated", "--cp-text", "--cp-text-secondary",
      "--cp-text-muted", "--cp-border", "--cp-focus", "--cp-success", "--cp-warning", "--cp-error",
      "--cp-disabled", "--cp-radius", "--cp-title-size", "--cp-touch",
    ]) {
      expect(css).toContain(token);
    }
    expect(css).toContain("--cp-shadow");
    expect(css).toContain("--cp-transition");
    expect(css).toContain(".cp-page-title");
    expect(css).toContain(".cp-section-title");
    expect(css).toContain(".cp-home");
    expect(css).toContain(".cp-welcome");
    expect(css).toContain(".cp-catalog-grid");
    expect(css).toContain("repeat(6, minmax(0, 1fr))");
    expect(css).toContain("--cp-page-bg");
    expect(css).toContain("--cp-surface-glass");
    expect(css).toContain(".cp-my-projects-entry");
    expect(css).toContain(".cp-project-grid");
    expect(css).toContain("@media (max-width: 320px)");
    expect(css).toContain("@media (max-width: 360px)");
    expect(css).toContain("@media (max-width: 375px)");
    expect(css).toContain("@media (max-width: 390px)");
    expect(css).toContain("@media (max-width: 414px)");
    expect(css).toContain("@media (max-width: 768px)");
    expect(css).toContain("@media (max-width: 820px)");
    expect(css).toContain("@media (max-width: 1024px)");
    expect(css).toContain("@media (max-width: 1280px)");
    expect(css).toContain(".cp-mobile-nav-drawer");
    expect(css).toContain("focus-visible");
    expect(css).toContain("customer-left-sidebar");

    const ui = fs.readFileSync(path.resolve("desktop/customer-platform/components/ui.tsx"), "utf8");
    expect(ui).toContain("export function ServiceCard");
    expect(ui).toContain("export function ServiceGrid");
    expect(ui).toContain("export function ProjectCard");
    expect(ui).toContain("export function QuickAction");
    expect(ui).toContain("export function CategoryCard");
    expect(ui).toContain("aria-label");
    expect(ui).toContain("Coming soon");
    expect(ui).toContain("Unavailable");
    expect(ui).toContain('event.key === "Enter"');
  });

  it("wires commercial Customer Home without technical dashboard or Admin IA", () => {
    const dash = fs.readFileSync(path.resolve("desktop/dashboard/ProfessionalDashboard.tsx"), "utf8");
    expect(dash).toContain("CustomerHome");
    expect(dash).not.toMatch(/Live production|Live Production|dash-widget-grid|AI Status|Render Queue/i);
    const home = fs.readFileSync(path.resolve("desktop/customer-platform/CustomerHome.tsx"), "utf8");
    expect(home).toContain("Welcome to");
    expect(home).toContain("homeCatalogCategories");
    expect(home).toContain("What do you want to create?");
    expect(home).toContain("My Projects");
    expect(home).toContain("CategoryCard");
    expect(home).toContain("data-customer-service-grid");
    expect(home).not.toContain("Recent projects");
    expect(home).not.toContain("Quick actions");
    expect(home).not.toContain("Popular services");
    expect(home).not.toContain("My work");
    expect(home).not.toContain("quickActionsForHome");
    expect(home).not.toContain("popularServices");
    expect(home).not.toContain("/api/workspace");
    expect(home).not.toContain("Create something amazing today");
    const tokens = fs.readFileSync(path.resolve("desktop/shell/theme/tokens.css"), "utf8");
    expect(tokens).toContain("--shell-page-bg");
    expect(tokens).toContain("scrollbar-color");
    expect(tokens).toContain("::-webkit-scrollbar");
    const catalog = fs.readFileSync(path.resolve("desktop/customer-platform/CustomerCatalog.tsx"), "utf8");
    expect(catalog).toContain("ServiceCategory");
    expect(catalog).toContain("exploreCategories");
    const sidebar = fs.readFileSync(path.resolve("desktop/shell/LeftSidebar.tsx"), "utf8");
    expect(sidebar).toContain("CustomerNavSection");
    expect(sidebar).toContain("data-customer-sidebar");
    expect(sidebar).not.toContain("getSidebarNavByGroup");
    expect(sidebar).not.toMatch(/Admin Control Center/);
    const header = fs.readFileSync(path.resolve("desktop/shell/WorkspaceHeader.tsx"), "utf8");
    expect(header).toContain("cp-mobile-nav-toggle");
    expect(header).toContain("data-customer-header");
    expect(header).not.toContain("header-status-cluster");
    expect(header).not.toMatch(/Ollama|API status|Storage/i);
    const shell = fs.readFileSync(path.resolve("desktop/shell/AppShell.tsx"), "utf8");
    expect(shell).toContain("CustomerMobileNavDrawer");
    expect(shell).not.toContain("Admin Control Center");
    const src = fs.readFileSync(path.resolve("desktop/src.tsx"), "utf8");
    expect(src).toContain("customer-platform/customer.css");
    expect(src).toContain("AdminControlCenter");
    expect(src).toContain('surface === "admin"');
  });

  it("ServiceCard does not navigate coming-soon or disabled services", () => {
    const ui = fs.readFileSync(path.resolve("desktop/customer-platform/components/ui.tsx"), "utf8");
    expect(ui).toContain('service.status === "AVAILABLE" && service.enabled');
    expect(ui).toContain("if (available) onStart?.(service)");
    expect(ui).toContain('aria-disabled={!available}');
  });
});

describe("Customer navigation search regression", () => {
  it("finds customer services and still excludes Admin Control Center", () => {
    const flyer = navigationEngine.search("Flyer");
    expect(flyer.some((item) => item.label === "Flyer")).toBe(true);
    expect(flyer.find((item) => item.label === "Flyer")?.detail).toBe("Coming soon");
    const video = navigationEngine.search("Create Video");
    expect(video.some((item) => item.label === "Create Video")).toBe(true);
    const design = navigationEngine.search("Design Studio");
    expect(design.some((item) => item.label === "Design Studio")).toBe(true);
    const admin = navigationEngine.search("Admin Control");
    expect(admin.some((item) => item.workspace === "admin" || /admin control center/i.test(item.label))).toBe(false);
  });
});

describe("Customer Home regression surfaces", () => {
  it("keeps dashboard engines available for non-home surfaces", () => {
    expect(fs.existsSync(path.resolve("desktop/dashboard/live-engine.ts"))).toBe(true);
    expect(fs.existsSync(path.resolve("desktop/dashboard/widget-store.ts"))).toBe(true);
    expect(fs.existsSync(path.resolve("desktop/dashboard/TechnicalProductionDashboard.tsx"))).toBe(true);
    const index = fs.readFileSync(path.resolve("desktop/dashboard/index.ts"), "utf8");
    expect(index).toContain("dashboardLiveEngine");
    expect(index).toContain("dashboardWidgetStore");
    expect(index).toContain("TechnicalProductionDashboard");
  });

  it("preserves admin and studio route separation in src", () => {
    const src = fs.readFileSync(path.resolve("desktop/src.tsx"), "utf8");
    expect(src).toContain("AdminControlCenter");
    expect(src).toContain("AppShell");
    expect(src).toMatch(/surface === ["']admin["']/);
  });
});
