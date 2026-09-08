import type { AdminRouteId } from "./types";

export interface AdminNavItem {
  id: AdminRouteId;
  label: string;
  path: string;
  implemented: boolean;
  group: "admin" | "ai" | "creative" | "business" | "system";
  groupLabel: string;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { id: "dashboard", label: "Dashboard", path: "/admin/dashboard", implemented: true, group: "admin", groupLabel: "Admin" },
  { id: "models", label: "Models", path: "/admin/models", implemented: true, group: "ai", groupLabel: "AI Control" },
  { id: "providers", label: "Providers", path: "/admin/providers", implemented: true, group: "ai", groupLabel: "AI Control" },
  { id: "features", label: "Feature Mapping", path: "/admin/features", implemented: true, group: "ai", groupLabel: "AI Control" },
  { id: "video", label: "Video", path: "/admin/video", implemented: false, group: "creative", groupLabel: "Creative" },
  { id: "image", label: "Image", path: "/admin/image", implemented: false, group: "creative", groupLabel: "Creative" },
  { id: "audio", label: "Audio", path: "/admin/audio", implemented: false, group: "creative", groupLabel: "Creative" },
  { id: "voice", label: "Voice", path: "/admin/voice", implemented: false, group: "creative", groupLabel: "Creative" },
  { id: "customers", label: "Customers", path: "/admin/customers", implemented: false, group: "business", groupLabel: "Business" },
  { id: "projects", label: "Projects", path: "/admin/projects", implemented: false, group: "business", groupLabel: "Business" },
  { id: "usage", label: "Usage", path: "/admin/usage", implemented: false, group: "business", groupLabel: "Business" },
  { id: "costs", label: "Costs", path: "/admin/costs", implemented: false, group: "business", groupLabel: "Business" },
  { id: "credits", label: "Credits", path: "/admin/credits", implemented: false, group: "business", groupLabel: "Business" },
  { id: "payments", label: "Payments", path: "/admin/payments", implemented: false, group: "business", groupLabel: "Business" },
  { id: "system", label: "System Health", path: "/admin/system", implemented: true, group: "system", groupLabel: "System" },
  { id: "logs", label: "Logs", path: "/admin/logs", implemented: false, group: "system", groupLabel: "System" },
  { id: "storage", label: "Storage", path: "/admin/storage", implemented: false, group: "system", groupLabel: "System" },
  { id: "database", label: "Database", path: "/admin/database", implemented: false, group: "system", groupLabel: "System" },
  { id: "settings", label: "Settings", path: "/admin/settings", implemented: true, group: "system", groupLabel: "System" },
];

export const ADMIN_GROUP_ORDER = ["admin", "ai", "creative", "business", "system"] as const;

export function parseAdminRouteFromLocation(): AdminRouteId {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const hash = window.location.hash.replace(/^#/, "");
  const candidate = path.startsWith("/admin")
    ? path.replace(/^\/admin\/?/, "") || "dashboard"
    : hash.startsWith("admin/")
      ? hash.replace(/^admin\//, "")
      : hash === "admin"
        ? "dashboard"
        : "dashboard";
  const id = (candidate.split("/")[0] || "dashboard") as AdminRouteId;
  return ADMIN_NAV.some((item) => item.id === id) ? id : "dashboard";
}

export function adminPathFor(route: AdminRouteId): string {
  return `/admin/${route}`;
}

export function syncAdminUrl(route: AdminRouteId): void {
  const next = adminPathFor(route);
  if (window.location.pathname !== next) {
    window.history.replaceState({ adminRoute: route }, "", next);
  }
}

export function isAdminUrl(): boolean {
  return window.location.pathname === "/admin"
    || window.location.pathname.startsWith("/admin/")
    || window.location.hash.startsWith("#admin");
}
