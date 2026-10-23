/**
 * Phase 57.5 — Concise operator label for broker execution posture.
 * Do not prefix with "BROKER EXECUTION" when the code is already `EXECUTION_FORBIDDEN`
 * (that produced "BROKER EXECUTION EXECUTION_FORBIDDEN").
 */
export function formatBrokerExecutionBadgeLabel(
  code: string | null | undefined,
): string {
  const c = String(code ?? "EXECUTION_FORBIDDEN").trim();
  if (
    c === "EXECUTION_FORBIDDEN"
    || c === "DISABLED"
    || c === "UNAUTHORIZED"
    || c === "BLOCKED"
  ) {
    return "Broker execution: Forbidden";
  }
  return `Broker execution: ${c}`;
}
