/**
 * Workflow navigation guards — prevents React error #130 from undefined sidebar icons.
 *
 * Root cause (Step 1 → Step 2 crash): LeftSidebar rendered navigation.recent entries with
 * navIcons[id] where video-requirements / video-style / final-video-review were missing,
 * producing <undefined /> and React minified error #130 at the RootErrorBoundary.
 */
import { describe, expect, it } from "vitest";
import { ALL_WORKSPACE_IDS } from "../desktop/shell/types";
import { assertNavIconsComplete, isNavIconComponent, NAV_ICONS, resolveNavIcon } from "../desktop/shell/nav-icons";
import { navigationStore } from "../desktop/shell/navigation/navigation-store";

describe("workflow navigation icons", () => {
  it("maps every workspace id to a valid React icon component", () => {
    expect(() => assertNavIconsComplete()).not.toThrow();
    for (const id of ALL_WORKSPACE_IDS) {
      expect(isNavIconComponent(NAV_ICONS[id])).toBe(true);
      expect(isNavIconComponent(resolveNavIcon(id))).toBe(true);
    }
  });

  it("includes the 3-step product video workflow routes", () => {
    for (const id of ["new-project", "video-requirements", "video-style", "final-video-review"] as const) {
      expect(isNavIconComponent(NAV_ICONS[id])).toBe(true);
      expect(resolveNavIcon(id)).toBe(NAV_ICONS[id]);
    }
  });

  it("resolves icons for workspaces added to recent navigation after Continue", () => {
    let nav = navigationStore.load();
    nav = navigationStore.visit(nav, "new-project");
    nav = navigationStore.visit(nav, "video-requirements");
    for (const id of nav.recent.slice(0, 4)) {
      expect(isNavIconComponent(resolveNavIcon(id))).toBe(true);
    }
  });

  it("falls back safely for unknown ids at runtime", () => {
    // @ts-expect-error intentional invalid id for defensive fallback
    expect(isNavIconComponent(resolveNavIcon("not-a-workspace"))).toBe(true);
  });
});
