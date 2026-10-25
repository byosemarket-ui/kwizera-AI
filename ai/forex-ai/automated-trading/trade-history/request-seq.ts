/**
 * Phase 60.0.5 — ignore stale async responses when a newer request has started.
 * Pure helper for Trade Monitor fetch races (tables / history / performance).
 */
export function isCurrentRequest(activeId: number, responseId: number): boolean {
  return activeId === responseId && responseId > 0;
}

export function nextRequestId(prev: number): number {
  const n = Math.floor(prev);
  if (!Number.isFinite(n) || n < 0) return 1;
  return n + 1;
}
