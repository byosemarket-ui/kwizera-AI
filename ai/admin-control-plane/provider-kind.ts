import type { AdminProviderRecord, ProviderKind, ProviderType } from "./types.js";

const LOCAL_TYPES = new Set(["ollama", "local"]);
const INTERNAL_TYPES = new Set(["internal", "kwizera"]);

export function inferProviderKind(provider: Pick<AdminProviderRecord, "type" | "kind">): ProviderKind {
  if (provider.kind) return provider.kind;
  const type = String(provider.type ?? "").toLowerCase();
  if (LOCAL_TYPES.has(type)) return "LOCAL";
  if (INTERNAL_TYPES.has(type)) return "INTERNAL";
  if (!type || type === "custom" || type === "other") return "OTHER";
  return "EXTERNAL_API";
}

export function defaultKindForType(type: ProviderType): ProviderKind {
  return inferProviderKind({ type });
}
