/**
 * Shared Admin session-auth helpers for protected Admin pages.
 * Admin API token authorizes Admin APIs — never an AI provider credential.
 */

import { AdminApiError } from "./admin-api";

export function isAdminAuthError(err: unknown): boolean {
  return err instanceof AdminApiError && err.status === 403;
}

export function adminAuthErrorMessage(err: unknown): string {
  if (err instanceof AdminApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Admin authorization required";
}
