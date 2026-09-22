import type {
  CustomerCategory,
  CustomerNavGroup,
  CustomerNavItem,
  CustomerService,
  CustomerServiceRegistrySnapshot,
  CustomerServiceStatus,
} from "./types";
import { CUSTOMER_CATEGORIES } from "./categories";
import { CUSTOMER_SERVICES } from "./services";
import { validateCategory, validateService, CustomerRegistryError } from "./validation";

const NAV_GROUP_META: Array<{ key: CustomerNavGroup["key"]; title: string; order: number }> = [
  { key: "HOME", title: "Home", order: 0 },
  { key: "CREATE", title: "Create", order: 10 },
  { key: "MY_WORK", title: "My Work", order: 20 },
  { key: "ACCOUNT", title: "Account", order: 30 },
];

function sortByOrder<T extends { order: number; title?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order || (a.title ?? "").localeCompare(b.title ?? ""));
}

export class CustomerServiceRegistry {
  readonly categories: CustomerCategory[];
  readonly services: CustomerService[];

  constructor(
    categories: CustomerCategory[] = CUSTOMER_CATEGORIES,
    services: CustomerService[] = CUSTOMER_SERVICES,
  ) {
    const seenCategories = new Set<string>();
    this.categories = sortByOrder(categories.map((item) => validateCategory(item, seenCategories)));
    const categoryKeys = new Set(this.categories.map((item) => item.key));
    const seenServices = new Set<string>();
    this.services = sortByOrder(services.map((item) => validateService(item, categoryKeys, seenServices)));
    this.assertNoAdmin();
  }

  assertNoAdmin(): void {
    const haystack = JSON.stringify({
      categories: this.categories,
      services: this.services,
    });
    if (/admin control center|\/admin|provider credentials|feature mapping/i.test(haystack)) {
      throw new CustomerRegistryError("ADMIN_FORBIDDEN", "Customer registry must not include Admin surfaces");
    }
  }

  getCategory(key: string): CustomerCategory | undefined {
    return this.categories.find((item) => item.key === key);
  }

  getService(key: string): CustomerService | undefined {
    return this.services.find((item) => item.key === key);
  }

  listByCategory(category: string): CustomerService[] {
    return this.services.filter((item) => item.category === category);
  }

  listByStatus(status: CustomerServiceStatus): CustomerService[] {
    return this.services.filter((item) => item.status === status);
  }

  /** Primary creation CTAs — representative available / coming-soon pillars. */
  primaryCreationServices(): CustomerService[] {
    const keys = ["create-video", "edit-photo", "passport-photo", "design-studio"];
    return keys
      .map((key) => this.getService(key))
      .filter((item): item is CustomerService => Boolean(item));
  }

  /**
   * Home catalog pillars — six creative domains for the main grid.
   * Status is derived from services in each category (honest availability).
   */
  homeCatalogCategories(): Array<{ category: CustomerCategory; status: CustomerServiceStatus }> {
    const order: Array<CustomerCategory["key"]> = [
      "VIDEO", "IMAGE", "PHOTO_STUDIO", "DESIGN", "AUDIO", "VOICE",
    ];
    return order
      .map((key) => this.getCategory(key))
      .filter((category): category is CustomerCategory => Boolean(category?.enabled))
      .map((category) => {
        const services = this.listByCategory(category.key).filter((item) => item.status !== "DISABLED");
        const available = services.some((item) => item.status === "AVAILABLE" && item.workspace);
        const allDisabled = services.length === 0
          || this.listByCategory(category.key).every((item) => item.status === "DISABLED");
        const status: CustomerServiceStatus = allDisabled
          ? "DISABLED"
          : available
            ? "AVAILABLE"
            : "COMING_SOON";
        return { category, status };
      });
  }

  /** Featured / popular strip — available creation services plus a few honest coming-soon cards. */
  popularServices(): CustomerService[] {
    const primary = new Set(this.primaryCreationServices().map((item) => item.key));
    const available = this.services.filter(
      (item) =>
        item.status === "AVAILABLE"
        && item.category !== "ACCOUNT"
        && item.category !== "MY_WORK"
        && !primary.has(item.key),
    );
    const soon = this.services.filter(
      (item) => item.status === "COMING_SOON" && !primary.has(item.key),
    ).slice(0, 4);
    return [...available.slice(0, 6), ...soon];
  }

  featuredForHome(): CustomerService[] {
    const seen = new Set<string>();
    const merged: CustomerService[] = [];
    for (const item of [...this.primaryCreationServices(), ...this.popularServices()]) {
      if (seen.has(item.key)) continue;
      seen.add(item.key);
      merged.push(item);
    }
    return merged;
  }

  /** Category browse sections for catalog pages — creation categories only. */
  exploreCategories(): Array<{ category: CustomerCategory; services: CustomerService[] }> {
    const order: Array<CustomerCategory["key"]> = [
      "VIDEO", "IMAGE", "PHOTO_STUDIO", "DESIGN", "AUDIO", "VOICE",
    ];
    return order
      .map((key) => this.getCategory(key))
      .filter((category): category is CustomerCategory => Boolean(category?.enabled))
      .map((category) => ({
        category,
        services: this.listByCategory(category.key).filter((item) => item.status !== "DISABLED"),
      }))
      .filter((entry) => entry.services.length > 0);
  }

  /**
   * Home service discovery — category sections with real services (not category pillars).
   * Hides category-hub rows marked metadata.homeVisible === false.
   */
  homeServiceCatalog(): Array<{ category: CustomerCategory; services: CustomerService[] }> {
    return this.exploreCategories()
      .map(({ category, services }) => ({
        category,
        services: services.filter((item) => item.metadata?.homeVisible !== false),
      }))
      .filter((entry) => entry.services.length > 0);
  }

  listByUseCase(useCase: string): CustomerService[] {
    return this.services.filter(
      (item) => item.status !== "DISABLED" && item.useCase === useCase,
    );
  }

  /** Quick actions that already map to a real Studio workspace. */
  quickActionsForHome(): CustomerService[] {
    return this.primaryCreationServices().filter(
      (item) => item.status === "AVAILABLE" && Boolean(item.workspace),
    );
  }

  buildNavigation(): CustomerNavGroup[] {
    const home: CustomerNavItem = {
      key: "home",
      title: "Home",
      description: "Customer home",
      icon: "home",
      route: "/",
      status: "AVAILABLE",
      workspace: "home",
      group: "HOME",
    };

    const createItems: CustomerNavItem[] = this.categories
      .filter((category) => category.navGroup === "CREATE" && category.enabled)
      .map((category) => {
        const firstAvailable = this.listByCategory(category.key).find((item) => item.status === "AVAILABLE" && item.workspace);
        const allDisabled = this.listByCategory(category.key).every((item) => item.status === "DISABLED");
        return {
          key: `category-${category.key}`,
          title: category.key === "PHOTO_STUDIO"
            ? "Photo Studio"
            : category.title === "Design Studio"
              ? "Design"
              : category.title,
          description: category.description,
          icon: category.icon,
          route: `/create/${category.key.toLowerCase()}`,
          status: allDisabled ? "DISABLED" : firstAvailable ? "AVAILABLE" : "COMING_SOON",
          workspace: firstAvailable?.workspace,
          group: "CREATE" as const,
          category: category.key,
        };
      });

    const workKeys = new Set(["projects", "assets"]);
    const accountKeys = new Set(["settings", "help"]);
    const workAndAccount = this.services
      .filter((item) =>
        (item.category === "MY_WORK" && workKeys.has(item.key))
        || (item.category === "ACCOUNT" && accountKeys.has(item.key)),
      )
      .map((item) => ({
        key: item.key,
        title: item.title,
        description: item.description,
        icon: item.icon,
        route: item.route,
        status: item.status,
        workspace: item.workspace,
        group: item.category === "MY_WORK" ? "MY_WORK" as const : "ACCOUNT" as const,
        category: item.category,
      }));

    return NAV_GROUP_META.map((meta) => ({
      key: meta.key,
      title: meta.title,
      order: meta.order,
      items: meta.key === "HOME"
        ? [home]
        : meta.key === "CREATE"
          ? createItems
          : workAndAccount.filter((item) => item.group === meta.key),
    }));
  }

  snapshot(): CustomerServiceRegistrySnapshot {
    return {
      categories: this.categories,
      services: this.services,
      navigation: this.buildNavigation(),
    };
  }

  search(query: string): CustomerService[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.services.filter((item) => item.status !== "DISABLED");
    return this.services.filter((item) => {
      if (item.status === "DISABLED") return false;
      const hay = [
        item.title,
        item.description,
        item.keywords.join(" "),
        item.category,
        item.subcategory ?? "",
        item.useCase ?? "",
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }
}

export const customerServiceRegistry = new CustomerServiceRegistry();
