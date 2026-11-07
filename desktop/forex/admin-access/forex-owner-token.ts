/**
 * Stage 7.2 — Browser-local system-owner token helper (sessionStorage only).
 * Separate from Forex Admin token. Never logs the raw secret.
 */
export const FOREX_OWNER_TOKEN_STORAGE_KEY = "kwizera.owner.apiToken";

function sessionStore(): Storage | undefined {
  try {
    return typeof sessionStorage !== "undefined" ? sessionStorage : undefined;
  } catch {
    return undefined;
  }
}

export function maskForexOwnerToken(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 4) return "••••";
  return `${trimmed.slice(0, 2)}••••••••${trimmed.slice(-2)}`;
}

export function getForexOwnerToken(): string {
  const store = sessionStore();
  if (!store) return "";
  try {
    return store.getItem(FOREX_OWNER_TOKEN_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function saveForexOwnerToken(raw: string): { ok: boolean; masked: string | null } {
  const trimmed = raw.trim();
  const store = sessionStore();
  if (!store) return { ok: false, masked: null };
  try {
    if (!trimmed) {
      store.removeItem(FOREX_OWNER_TOKEN_STORAGE_KEY);
      return { ok: true, masked: null };
    }
    store.setItem(FOREX_OWNER_TOKEN_STORAGE_KEY, trimmed);
    return { ok: true, masked: maskForexOwnerToken(trimmed) };
  } catch {
    return { ok: false, masked: null };
  }
}

export function clearForexOwnerToken(): void {
  const store = sessionStore();
  if (!store) return;
  try {
    store.removeItem(FOREX_OWNER_TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Owner-only header. Never uses Authorization Bearer (admin path). */
export function buildForexOwnerHeaders(): Record<string, string> {
  const token = getForexOwnerToken();
  if (!token) return {};
  return { "x-kwizera-owner-token": token };
}
