import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FOREX_ADMIN_NAV,
  FOREX_ADMIN_ROOT,
  isForexAdminUrl,
  parseForexAdminRouteFromLocation,
} from "../../../desktop/forex-admin/forex-admin-routes";

const root = path.resolve(process.cwd());

function read(relative: string) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

describe("Phase 19 dedicated Forex Admin routing", () => {
  it("uses /admin/forex as the canonical independent entry", () => {
    expect(FOREX_ADMIN_ROOT).toBe("/admin/forex");
    expect(isForexAdminUrl("/admin/forex")).toBe(true);
    expect(isForexAdminUrl("/admin/forex/knowledge")).toBe(true);
    expect(isForexAdminUrl("/admin")).toBe(false);
    expect(isForexAdminUrl("/admin/knowledge")).toBe(false);
    expect(isForexAdminUrl("/forex/dashboard")).toBe(false);
  });

  it("parses nested knowledge routes including detail/edit", () => {
    expect(parseForexAdminRouteFromLocation("/admin/forex").view).toBe("dashboard");
    expect(parseForexAdminRouteFromLocation("/admin/forex/knowledge").view).toBe("knowledge");
    expect(parseForexAdminRouteFromLocation("/admin/forex/knowledge/documents").view).toBe("knowledge-documents");
    expect(parseForexAdminRouteFromLocation("/admin/forex/knowledge/new").view).toBe("knowledge-new");
    const detail = parseForexAdminRouteFromLocation("/admin/forex/knowledge/abc-123");
    expect(detail.view).toBe("knowledge-detail");
    expect(detail.documentId).toBe("abc-123");
    const edit = parseForexAdminRouteFromLocation("/admin/forex/knowledge/abc-123/edit");
    expect(edit.view).toBe("knowledge-edit");
    expect(edit.documentId).toBe("abc-123");
  });

  it("keeps Forex Admin navigation out of General Admin nav", () => {
    const adminRoutes = read("desktop/admin-control-center/admin-routes.ts");
    expect(adminRoutes).not.toContain('/admin/forex');
    expect(adminRoutes).not.toContain("Forex Admin");
    expect(FOREX_ADMIN_NAV.some((item) => item.path === "/admin/forex")).toBe(true);
    expect(FOREX_ADMIN_NAV.some((item) => item.path === "/admin/forex/knowledge")).toBe(true);
  });

  it("wires a dedicated surface before General Admin in desktop entry", () => {
    const src = read("desktop/src.tsx");
    expect(src).toContain("isForexAdminUrl");
    expect(src).toContain('return "forex-admin"');
    const forexAdminIdx = src.indexOf("isForexAdminUrl()");
    const adminIdx = src.indexOf("isAdminUrl()");
    expect(forexAdminIdx).toBeGreaterThan(-1);
    expect(adminIdx).toBeGreaterThan(forexAdminIdx);
    expect(src).toContain("ForexAdminApp");
    expect(src).toContain('data-app-surface="admin"');
  });

  it("exposes Forex Admin API with shared Admin token auth (not general /api/admin path)", () => {
    const api = read("dev/server/forex-admin-api.ts");
    const index = read("dev/server/index.ts");
    expect(api).toContain("/api/forex-admin");
    expect(api).toContain("authentication");
    expect(api).toContain("admin-token");
    expect(api).toContain("requireForexAdmin");
    expect(index).toContain("handleForexAdminApi");
    // Auth boundary lives in forex-admin-auth (shared helper), not inline assertAdminAccess.
    expect(read("dev/server/forex-admin-auth.ts")).toContain("assertAdminAccess");
  });

  it("aliases /admin/forex/ai-training to AI Training surface", () => {
    expect(parseForexAdminRouteFromLocation("/admin/forex/ai-training").view).toBe("ai-training");
    expect(FOREX_ADMIN_NAV.some((item) => item.label === "AI Training")).toBe(true);
    expect(FOREX_ADMIN_NAV.every((item) => item.label !== "Knowledge Base")).toBe(true);
  });

  it("routes HFM MT5 Connection Manager under market data with Live lock", () => {
    expect(parseForexAdminRouteFromLocation("/admin/forex/mt5-hfm").view).toBe("mt5-hfm");
    expect(parseForexAdminRouteFromLocation("/admin/forex/mt5-hfm").canonicalPath).toBe(
      "/admin/forex/mt5-hfm",
    );
    expect(FOREX_ADMIN_NAV.some((item) => item.path === "/admin/forex/mt5-hfm")).toBe(true);
    expect(read("desktop/forex-admin/ForexAdminPages.tsx")).toContain("ForexAdminMt5HfmPage");
    expect(read("dev/server/index.ts")).toContain("handleMt5HfmApi");
    expect(read("dev/server/mt5-hfm-api.ts")).toContain("LIVE_ACTIVATION_LOCKED");
    expect(read("dev/server/mt5-hfm-api.ts")).not.toContain("/credentials/reveal");
    expect(read("dev/server/mt5-hfm-api.ts")).not.toContain("password-reveal");
    expect(read("dev/server/mt5-hfm-api.ts")).toContain("appendMt5HfmCredentialAudit");
    expect(read("ai/market-data/mt5-hfm/login-bridge.ts")).toContain("implemented_agent_optional");
    expect(read("ai/market-data/mt5-hfm/demo-profile.ts")).toContain("mt5-hfm:demo:password");
    expect(read("ai/market-data/mt5-hfm/demo-profile.ts")).toContain("mt5-hfm:live:password");
    expect(read("ai/market-data/mt5-hfm/live-gate.ts")).toContain("credentialStorageEnabled: true");
    expect(read("ai/market-data/mt5-hfm/live-gate.ts")).toContain("loginEnabled: false");
    expect(read("desktop/forex-admin/ForexAdminMt5HfmPage.tsx")).toContain("LIVE login locked");
    expect(read("ai/market-data/mt5-hfm/bridge-security-audit.ts")).toContain("/run/kwizera/mt5-hfm-agent.sock");
    expect(read("ai/market-data/mt5-hfm/demo-login-plan.ts")).toContain("dns_tcp");
    expect(read("ai/market-data/mt5-hfm/systemd-proposal.ts")).toContain("phase4_units_authored_not_enabled");
    expect(read("ai/market-data/mt5-hfm/systemd-proposal.ts")).toContain("proposal_only");
    expect(read("services/mt5-hfm-lifecycle/kwizera-mt5-xvfb.service")).toContain("Xvfb :97");
    expect(read("services/mt5-hfm-lifecycle/kwizera-mt5-hfm-demo.service")).toContain("Requires=kwizera-mt5-xvfb.service");
    expect(read("services/mt5-hfm-lifecycle/kwizera-mt5-hfm-demo.service")).not.toContain("kwizera-ai.service");
    expect(read("services/mt5-hfm-lifecycle/bin/stop-mt5-demo.sh")).toContain("WINEPREFIX");
    expect(read("services/mt5-hfm-lifecycle/bin/stop-mt5-demo.sh")).not.toContain("pkill -u");
    expect(read("dev/server/mt5-hfm-api.ts")).toContain("authenticatedLogin: false");
    expect(read("dev/server/mt5-hfm-api.ts")).toContain("/api/forex/providers/mt5-hfm/login");
    expect(read("services/mt5-hfm-agent/agent.py")).toContain("SO_PEERCRED");
    expect(read("services/mt5-hfm-agent/mt5_control.py")).toContain("/portable");
  });
});
