/**
 * Phase 60.0.14 — Central Forex Admin API token service.
 *
 * Single approved frontend source for reading/writing the admin token and
 * attaching headers to approved same-origin KWIZERA API requests.
 *
 * Persistence: browser profile localStorage (migrates legacy sessionStorage).
 * Not encrypted; not safe against XSS. Does not sync across machines/browsers.
 * Never put the token in URLs, logs, or error messages.
 */

export const FOREX_ADMIN_TOKEN_STORAGE_KEY = "kwizera.admin.apiToken";

/** Approved same-origin API prefixes that may receive admin credentials. */
export const FOREX_ADMIN_API_PREFIXES = [
  "/api/forex/",
  "/api/admin/",
] as const;

export type ForexAdminTokenSnapshot = {
  configured: boolean;
  /** Masked preview only — never the raw secret. */
  masked: string | null;
  /** Monotonic generation for stale-response guards. */
  generation: number;
  storageAvailable: boolean;
  storageError: string | null;
};

type Listener = (snapshot: ForexAdminTokenSnapshot) => void;

let generation = 0;
const listeners = new Set<Listener>();
let lastStorageError: string | null = null;

function safeStorageGet(store: Storage | undefined, key: string): string | null {
  if (!store) return null;
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(store: Storage | undefined, key: string, value: string): boolean {
  if (!store) return false;
  try {
    store.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeStorageRemove(store: Storage | undefined, key: string): boolean {
  if (!store) return false;
  try {
    store.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function browserLocalStorage(): Storage | undefined {
  try {
    return typeof localStorage !== "undefined" ? localStorage : undefined;
  } catch {
    return undefined;
  }
}

function browserSessionStorage(): Storage | undefined {
  try {
    return typeof sessionStorage !== "undefined" ? sessionStorage : undefined;
  } catch {
    return undefined;
  }
}

/** Mask for UI — never returns the full secret. */
export function maskForexAdminToken(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 4) return "••••";
  return `${trimmed.slice(0, 2)}••••••••${trimmed.slice(-2)}`;
}

/**
 * Read the configured token. Migrates sessionStorage → localStorage once.
 * Returns empty string when unset or storage is unavailable.
 */
export function getForexAdminToken(): string {
  lastStorageError = null;
  const local = browserLocalStorage();
  const session = browserSessionStorage();

  const fromLocal = safeStorageGet(local, FOREX_ADMIN_TOKEN_STORAGE_KEY)?.trim() ?? "";
  if (fromLocal) return fromLocal;

  const fromSession = safeStorageGet(session, FOREX_ADMIN_TOKEN_STORAGE_KEY)?.trim() ?? "";
  if (fromSession) {
    if (local && safeStorageSet(local, FOREX_ADMIN_TOKEN_STORAGE_KEY, fromSession)) {
      safeStorageRemove(session, FOREX_ADMIN_TOKEN_STORAGE_KEY);
    }
    return fromSession;
  }
  return "";
}

export function hasForexAdminToken(): boolean {
  return getForexAdminToken().length > 0;
}

export function getForexAdminTokenSnapshot(): ForexAdminTokenSnapshot {
  const local = browserLocalStorage();
  const storageAvailable = Boolean(local);
  const token = getForexAdminToken();
  return {
    configured: token.length > 0,
    masked: maskForexAdminToken(token),
    generation,
    storageAvailable,
    storageError: lastStorageError,
  };
}

function notify(): void {
  const snap = getForexAdminTokenSnapshot();
  for (const listener of listeners) {
    try {
      listener(snap);
    } catch {
      /* ignore subscriber errors */
    }
  }
}

export function subscribeForexAdminToken(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type SaveForexAdminTokenResult =
  | { ok: true; snapshot: ForexAdminTokenSnapshot }
  | { ok: false; error: string; snapshot: ForexAdminTokenSnapshot };

/** Save/update token. Empty string clears. Never logs the value. */
export function saveForexAdminToken(raw: string): SaveForexAdminTokenResult {
  const trimmed = raw.trim();
  const local = browserLocalStorage();
  const session = browserSessionStorage();
  lastStorageError = null;

  if (!trimmed) {
    return clearForexAdminToken();
  }

  if (!local) {
    lastStorageError = "Browser storage unavailable";
    // Best-effort session fallback so the current tab can still authorize.
    if (session && safeStorageSet(session, FOREX_ADMIN_TOKEN_STORAGE_KEY, trimmed)) {
      generation += 1;
      notify();
      return {
        ok: true,
        snapshot: {
          ...getForexAdminTokenSnapshot(),
          storageAvailable: false,
          storageError: "Saved for this tab only — localStorage unavailable",
        },
      };
    }
    return {
      ok: false,
      error: "Browser storage unavailable",
      snapshot: getForexAdminTokenSnapshot(),
    };
  }

  if (!safeStorageSet(local, FOREX_ADMIN_TOKEN_STORAGE_KEY, trimmed)) {
    lastStorageError = "Failed to write token to browser storage";
    return {
      ok: false,
      error: lastStorageError,
      snapshot: getForexAdminTokenSnapshot(),
    };
  }
  safeStorageRemove(session, FOREX_ADMIN_TOKEN_STORAGE_KEY);
  generation += 1;
  notify();
  return { ok: true, snapshot: getForexAdminTokenSnapshot() };
}

export function clearForexAdminToken(): SaveForexAdminTokenResult {
  lastStorageError = null;
  const local = browserLocalStorage();
  const session = browserSessionStorage();
  const localOk = !local || safeStorageRemove(local, FOREX_ADMIN_TOKEN_STORAGE_KEY);
  const sessionOk = !session || safeStorageRemove(session, FOREX_ADMIN_TOKEN_STORAGE_KEY);
  if (!localOk && !sessionOk) {
    lastStorageError = "Failed to clear browser storage";
    return {
      ok: false,
      error: lastStorageError,
      snapshot: getForexAdminTokenSnapshot(),
    };
  }
  generation += 1;
  notify();
  return { ok: true, snapshot: getForexAdminTokenSnapshot() };
}

/** True when path is an approved same-origin admin API path. */
export function isApprovedForexAdminApiPath(path: string): boolean {
  try {
    const url = path.startsWith("http://") || path.startsWith("https://")
      ? new URL(path)
      : new URL(path, "http://local.invalid");
    const pathname = url.pathname;
    return FOREX_ADMIN_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  } catch {
    return FOREX_ADMIN_API_PREFIXES.some((prefix) => path.startsWith(prefix));
  }
}

/**
 * Build auth headers for an approved same-origin API request.
 * Returns empty headers when no token or path is not approved (never leaks token).
 */
export function buildForexAdminHeaders(
  pathOrUrl: string,
  options?: { includeJsonContentType?: boolean },
): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options?.includeJsonContentType) {
    headers["Content-Type"] = "application/json";
  }
  if (!isApprovedForexAdminApiPath(pathOrUrl)) {
    return headers;
  }
  const token = getForexAdminToken();
  if (!token) return headers;
  // Dedicated header is the primary contract; Bearer mirrors Admin Control Plane.
  headers["x-kwizera-admin-token"] = token;
  headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** Redact accidental token appearances from user-facing strings. */
export function redactForexAdminToken(text: string, token?: string): string {
  const active = (token ?? getForexAdminToken()).trim();
  if (!active || active.length < 4) return text;
  return text.split(active).join("[REDACTED]");
}
