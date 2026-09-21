import type { CustomerCategory, CustomerService, CustomerServiceStatus } from "./types";

export class CustomerRegistryError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "CustomerRegistryError";
    this.code = code;
  }
}

const STATUSES: CustomerServiceStatus[] = ["AVAILABLE", "COMING_SOON", "DISABLED"];

const CATEGORY_KEYS = new Set([
  "VIDEO", "IMAGE", "PHOTO_STUDIO", "DESIGN", "AUDIO", "MY_WORK", "ACCOUNT",
]);

const ADMIN_LEAK = /admin|provider credential|feature mapping|control plane|internal cost/i;

export function validateCategory(input: CustomerCategory, seen = new Set<string>()): CustomerCategory {
  if (!input.key || !CATEGORY_KEYS.has(input.key)) {
    throw new CustomerRegistryError("INVALID_CATEGORY", `Invalid category key: ${String(input.key)}`);
  }
  if (seen.has(input.key)) {
    throw new CustomerRegistryError("DUPLICATE_CATEGORY", `Duplicate category: ${input.key}`);
  }
  seen.add(input.key);
  if (!input.title?.trim()) {
    throw new CustomerRegistryError("REQUIRED_FIELD", `Category ${input.key} is missing a title`);
  }
  if (!Number.isFinite(input.order)) {
    throw new CustomerRegistryError("INVALID_ORDER", `Category ${input.key} has an invalid order`);
  }
  if (ADMIN_LEAK.test(`${input.title} ${input.description}`)) {
    throw new CustomerRegistryError("ADMIN_FORBIDDEN", `Category ${input.key} must not expose Admin internals`);
  }
  return input;
}

export function validateService(
  input: CustomerService,
  categoryKeys: Set<string>,
  seen = new Set<string>(),
): CustomerService {
  if (!input.key?.trim()) {
    throw new CustomerRegistryError("REQUIRED_FIELD", "Service key is required");
  }
  if (seen.has(input.key)) {
    throw new CustomerRegistryError("DUPLICATE_SERVICE", `Duplicate service: ${input.key}`);
  }
  seen.add(input.key);
  if (!input.title?.trim() || !input.description?.trim()) {
    throw new CustomerRegistryError("REQUIRED_FIELD", `Service ${input.key} is missing title or description`);
  }
  if (!categoryKeys.has(input.category)) {
    throw new CustomerRegistryError("UNKNOWN_CATEGORY", `Service ${input.key} references unknown category ${input.category}`);
  }
  if (!STATUSES.includes(input.status)) {
    throw new CustomerRegistryError("INVALID_STATUS", `Service ${input.key} has invalid status`);
  }
  if (!input.route?.startsWith("/")) {
    throw new CustomerRegistryError("INVALID_ROUTE", `Service ${input.key} route must start with /`);
  }
  if (input.route.startsWith("/admin") || input.key.includes("admin")) {
    throw new CustomerRegistryError("ADMIN_FORBIDDEN", `Service ${input.key} cannot target Admin`);
  }
  if (!Number.isFinite(input.order)) {
    throw new CustomerRegistryError("INVALID_ORDER", `Service ${input.key} has an invalid order`);
  }
  if (ADMIN_LEAK.test(`${input.title} ${input.description} ${input.keywords.join(" ")}`)) {
    throw new CustomerRegistryError("ADMIN_FORBIDDEN", `Service ${input.key} must not expose Admin internals`);
  }
  const enabled = input.status === "DISABLED" ? false : input.enabled;
  return { ...input, enabled };
}
