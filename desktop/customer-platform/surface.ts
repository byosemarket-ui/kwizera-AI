import type { WorkspaceId } from "../../shell/types";

/** Customer product surfaces — hide production chrome and internal diagnostics. */
const CUSTOMER_SURFACES = new Set<WorkspaceId>([
  "home",
  "service-create-video",
  "service-product-marketing-video",
  "service-edit-photo",
  "service-passport",
  "service-design",
  "service-audio",
  "open-project",
  "asset-library",
  "settings",
  "help",
]);

export function isCustomerSurface(workspace: WorkspaceId): boolean {
  return CUSTOMER_SURFACES.has(workspace);
}

export function isCustomerServiceWorkspace(workspace: WorkspaceId): boolean {
  return workspace.startsWith("service-");
}
