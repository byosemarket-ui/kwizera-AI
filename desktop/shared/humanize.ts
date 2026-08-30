/**
 * Convert structured product/marketing values into human-readable text.
 * Never use blind String(object) — that produces "[object Object]".
 */

const TEXT_KEYS = [
  "point",
  "message",
  "label",
  "text",
  "value",
  "name",
  "title",
  "summary",
  "reason",
  "field",
  "recommendation",
  "description",
] as const;

export function humanizeValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") {
    return value === "[object Object]" ? "" : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map(humanizeValue).filter(Boolean).join(" · ");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of TEXT_KEYS) {
      const candidate = obj[key];
      if (typeof candidate === "string" && candidate.trim() && candidate !== "[object Object]") {
        return candidate;
      }
    }
    const parts = Object.entries(obj)
      .filter(([, item]) => item != null && typeof item !== "object")
      .map(([key, item]) => `${key}: ${item}`);
    return parts.join(", ");
  }
  return "";
}

export function humanizeList(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(humanizeValue).filter(Boolean);
  const one = humanizeValue(value);
  return one ? [one] : [];
}
