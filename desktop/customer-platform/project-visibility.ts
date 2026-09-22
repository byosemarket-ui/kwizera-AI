/**
 * Customer-facing project name helpers.
 * Does not delete data — only hides internal/ops-named projects from customer UI.
 */

const INTERNAL_PROJECT_NAME = /^(ollama\s*audit|deployment|ai\s*me|workspace\s*awareness|production\s*status)\b/i;

export function isCustomerVisibleProjectName(name: string | null | undefined): boolean {
  if (!name || !name.trim()) return false;
  return !INTERNAL_PROJECT_NAME.test(name.trim());
}

export function customerFacingProjectName(name: string | null | undefined): string | null {
  if (!isCustomerVisibleProjectName(name)) return null;
  return name!.trim();
}
