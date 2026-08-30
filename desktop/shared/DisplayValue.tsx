import { humanizeList, humanizeValue } from "./humanize";

export function DisplayText({ value, fallback = "—" }: { value: unknown; fallback?: string }) {
  const text = humanizeValue(value);
  return <>{text || fallback}</>;
}

export function DisplayList({
  value,
  separator = " · ",
  fallback = "—",
}: {
  value: unknown;
  separator?: string;
  fallback?: string;
}) {
  const items = humanizeList(value);
  if (!items.length) return <>{fallback}</>;
  return <>{items.join(separator)}</>;
}
