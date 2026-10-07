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

  it("exposes Forex Admin API outside general admin auth guard path", () => {
    const api = read("dev/server/forex-admin-api.ts");
    const index = read("dev/server/index.ts");
    expect(api).toContain("/api/forex-admin");
    expect(api).toContain("authentication");
    expect(api).toContain("deferred");
    expect(index).toContain("handleForexAdminApi");
    expect(api).not.toContain("assertAdminAccess");
  });
});
