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
  | "VOICE"
  | "MY_WORK"
  | "ACCOUNT";

export type CustomerNavGroupKey = "HOME" | "CREATE" | "MY_WORK" | "ACCOUNT";

/** Cross-category creative intent — not a separate Home category. */
export type CustomerUseCase =
  | "MARKETING"
  | "SOCIAL_MEDIA"
  | "PRODUCT"
  | "IDENTITY"
  | "GENERAL";

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
  /** Optional customer-facing grouping within a category. */
  subcategory?: string;
  /** Cross-category use case tags (marketing, social, product, etc.). */
  useCase?: CustomerUseCase;
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
