import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  customerServiceRegistry,
  isCustomerSurface,
  isCustomerServiceWorkspace,
  isCustomerVisibleProjectName,
  customerFacingProjectName,
} from "../../../desktop/customer-platform/index.ts";

describe("STEP 4–5 customer platform hardening", () => {
  it("identifies customer surfaces for chrome suppression", () => {
    expect(isCustomerSurface("home")).toBe(true);
    expect(isCustomerSurface("service-create-video")).toBe(true);
    expect(isCustomerSurface("service-edit-photo")).toBe(true);
    expect(isCustomerSurface("open-project")).toBe(true);
    expect(isCustomerSurface("generated-videos")).toBe(false);
    expect(isCustomerSurface("admin")).toBe(false);
    expect(isCustomerServiceWorkspace("service-passport")).toBe(true);
    expect(isCustomerServiceWorkspace("home")).toBe(false);
  });

  it("keeps Design Studio honest as Coming Soon until engines ship", () => {
    const design = customerServiceRegistry.getService("design-studio");
    expect(design?.status).toBe("COMING_SOON");
    expect(design?.workspace).toBeUndefined();
  });

  it("keeps Create Video on the customer Product Setup entry, not late-stage export", () => {
    expect(customerServiceRegistry.getService("create-video")?.workspace).toBe("service-create-video");
  });

  it("strips production chrome on customer canvas and softens Product Setup copy", () => {
    const production = fs.readFileSync(path.resolve("desktop/shell/ProductionWorkspace.tsx"), "utf8");
    expect(production).toContain("isCustomerSurface");
    expect(production).toContain("data-customer-canvas");
    const customerBranch = production.match(/if \(customerSurface\) \{[\s\S]*?return \([\s\S]*?\);\s*\}/);
    expect(customerBranch?.[0]).toBeTruthy();
    expect(customerBranch?.[0]).not.toContain("QuickActionBar");

    const appShell = fs.readFileSync(path.resolve("desktop/shell/AppShell.tsx"), "utf8");
    expect(appShell).toContain("isCustomerSurface(layout.workspace)");
    expect(appShell).toContain("customer-surface");
    expect(appShell).toContain("Loading your studio");
    expect(appShell).toMatch(/!customerSurface \? <BottomPanel/);
    expect(appShell).toMatch(/!customerSurface \? <FloatingWindowsLayer/);
    expect(appShell).toContain("RightSidebar");
    expect(appShell).toMatch(/!customerSurface &&[\s\S]*RightSidebar|rightOpen && !layout\.zen && !customerSurface/);

    const setup = fs.readFileSync(path.resolve("desktop/product-setup/ProductSetupWorkspace.tsx"), "utf8");
    expect(setup).toContain("customerMode");
    expect(setup).toContain("Add your photos");
    expect(setup).toContain("Preparing your photos");

    const createVideo = fs.readFileSync(
      path.resolve("desktop/customer-platform/workspace/CreateVideoServiceWorkspace.tsx"),
      "utf8",
    );
    expect(createVideo).toContain("customerMode");

    const header = fs.readFileSync(path.resolve("desktop/shell/WorkspaceHeader.tsx"), "utf8");
    expect(header).not.toContain("header-status-cluster");
    expect(header).not.toContain("Quick commands");
    expect(header).not.toContain("header-workspace-name");

    const css = fs.readFileSync(path.resolve("desktop/customer-platform/customer.css"), "utf8");
    expect(css).toContain("customer-production-workspace");
    expect(css).toContain("layout-engine-shell.customer-surface");
    expect(css).toContain(".cp-catalog-grid");
    expect(css).not.toContain("min-width: 560px");
  });

  it("does not mount internal AI Me / dock / floating panels on customer surfaces", () => {
    const appShell = fs.readFileSync(path.resolve("desktop/shell/AppShell.tsx"), "utf8");
    expect(appShell).toContain("customerSurface");
    expect(appShell).toMatch(/!customerSurface \? <BottomPanel \/> : null/);
    expect(appShell).toMatch(/!customerSurface \? <FloatingWindowsLayer \/> : null/);
    expect(appShell).toMatch(/rightOpen && !layout\.zen && !customerSurface/);
    expect(appShell).toMatch(/isCustomerSurface\(layout\.workspace\)[\s\S]*ai-me|!isCustomerSurface\(layout\.workspace\)/);
    // Customer chrome-suppression effect must not reference setLayout before it is declared.
    expect(appShell).toMatch(/setLayoutState\(\(current\) => \(\{[\s\S]*rightOpen: false[\s\S]*bottomExpanded: false/);
    expect(appShell).not.toMatch(/setLayout\(\{ rightOpen: false, bottomExpanded: false \}\)/);

    const home = fs.readFileSync(path.resolve("desktop/customer-platform/CustomerHome.tsx"), "utf8");
    expect(home).not.toMatch(/AI Me|AI Assistance|Ollama|Workspace Awareness|Production Status/i);
    expect(home).not.toContain("RightSidebar");
    expect(home).not.toContain("BottomPanel");
  });

  it("filters GlobalSearch to customer-safe results on customer surfaces", () => {
    const search = fs.readFileSync(path.resolve("desktop/shell/navigation/GlobalSearch.tsx"), "utf8");
    expect(search).toContain("isCustomerSurface");
    expect(search).toContain("customerOnly");
    const engine = fs.readFileSync(path.resolve("desktop/shell/navigation/navigation-engine.ts"), "utf8");
    expect(engine).toContain("customerOnly");
    expect(engine).toContain("if (customerOnly)");
  });

  it("Customer Home IA uses categorized services with My Projects at the bottom", () => {
    const home = fs.readFileSync(path.resolve("desktop/customer-platform/CustomerHome.tsx"), "utf8");
    expect(home).toContain("homeServiceCatalog");
    expect(home).toContain("ServiceCategory");
    expect(home).toContain("ServiceGrid");
    expect(home).toContain("My Projects");
    expect(home).toContain("data-home-footer");
    expect(home.indexOf("cp-home-categories")).toBeLessThan(home.indexOf("cp-my-projects-entry"));
    expect(home).not.toContain("CategoryCard");
    expect(home).not.toContain("Recent projects");
    expect(home).not.toContain("popularServices");
    expect(home).not.toContain("quickActionsForHome");
    expect(home).not.toContain("Quick actions");
    expect(home).not.toContain("Popular services");
    expect(home).not.toContain("/api/workspace");
  });

  it("hides internal-ops project names from customer header without deleting data", () => {
    expect(isCustomerVisibleProjectName("Summer Promo Video")).toBe(true);
    expect(isCustomerVisibleProjectName("Ollama Audit 1788798532693")).toBe(false);
    expect(customerFacingProjectName("Ollama Audit 1788798532693")).toBeNull();
    expect(customerFacingProjectName("Brand Launch")).toBe("Brand Launch");

    const header = fs.readFileSync(path.resolve("desktop/shell/WorkspaceHeader.tsx"), "utf8");
    expect(header).toContain("customerFacingProjectName");
  });

  it("does not put Admin in customer navigation or customer surfaces", () => {
    const nav = JSON.stringify(customerServiceRegistry.buildNavigation());
    expect(nav).not.toMatch(/\/admin|Admin Control Center/i);
    expect(isCustomerSurface("admin")).toBe(false);
  });
});
