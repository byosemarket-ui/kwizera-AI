/**
 * Customer-facing information architecture.
 * Source of truth for service catalog, Home cards, and future Customer navigation.
 * Admin Control Center is never part of this registry.
 */

export type CustomerServiceStatus = "AVAILABLE" | "COMING_SOON" | "DISABLED";

export type CustomerCategoryKey =
  | "VIDEO"
  | "IMAGE"
  | "PHOTO_STUDIO"
  | "DESIGN"
  | "AUDIO"
  | "MY_WORK"
  | "ACCOUNT";

export type CustomerNavGroupKey = "HOME" | "CREATE" | "MY_WORK" | "ACCOUNT";

/** Existing Studio workspace ids that a service may open. */
export type CustomerWorkspaceId = string;

export interface CustomerCategory {
  key: CustomerCategoryKey;
  title: string;
  description: string;
  order: number;
  enabled: boolean;
  icon: string;
  navGroup: CustomerNavGroupKey;
}

export interface CustomerService {
  key: string;
  title: string;
  description: string;
  category: CustomerCategoryKey;
  icon: string;
  route: string;
  status: CustomerServiceStatus;
  enabled: boolean;
  order: number;
  workspace?: CustomerWorkspaceId;
  keywords: string[];
  metadata: Record<string, unknown>;
}

export interface CustomerNavItem {
  key: string;
  title: string;
  description?: string;
  icon: string;
  route: string;
  status: CustomerServiceStatus;
  workspace?: CustomerWorkspaceId;
  group: CustomerNavGroupKey;
  category?: CustomerCategoryKey;
}

export interface CustomerNavGroup {
  key: CustomerNavGroupKey;
  title: string;
  order: number;
  items: CustomerNavItem[];
}

export interface CustomerServiceRegistrySnapshot {
  categories: CustomerCategory[];
  services: CustomerService[];
  navigation: CustomerNavGroup[];
}
