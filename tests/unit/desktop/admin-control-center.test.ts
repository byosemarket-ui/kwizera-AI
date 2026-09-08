import { describe, expect, it } from "vitest";
import { ADMIN_NAV, adminPathFor } from "../../../desktop/admin-control-center/admin-routes.ts";
import { assertNavIconsComplete } from "../../../desktop/shell/nav-icons.ts";
import { ALL_WORKSPACE_IDS } from "../../../desktop/shell/types.ts";

describe("Admin Control Center UI foundation", () => {
  it("registers admin workspace and nav icons for every workspace id", () => {
    expect(ALL_WORKSPACE_IDS).toContain("admin");
    expect(() => assertNavIconsComplete()).not.toThrow();
  });

  it("exposes implemented admin routes and marks future sections as coming soon", () => {
    const implemented = ADMIN_NAV.filter((item) => item.implemented).map((item) => item.id);
    expect(implemented).toEqual(expect.arrayContaining(["dashboard", "models", "providers", "features", "settings", "system"]));
    expect(ADMIN_NAV.find((item) => item.id === "customers")?.implemented).toBe(false);
    expect(adminPathFor("models")).toBe("/admin/models");
  });
});
