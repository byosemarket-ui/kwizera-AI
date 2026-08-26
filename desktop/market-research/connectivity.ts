export interface ConnectivityResult {
  internetAvailable: boolean;
  localServerAvailable: boolean;
  detail: string;
}

const TIMEOUT_MS = 2500;

async function fetchWithTimeout(url: string): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: "GET", signal: ctrl.signal, cache: "no-store" });
    return res.ok || res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Offline-first: browser onLine + one local status probe. No repeated failed loops. */
export async function detectConnectivity(): Promise<ConnectivityResult> {
  const navOnline = typeof navigator === "undefined" ? false : navigator.onLine;
  const localServerAvailable = await fetchWithTimeout("/api/desktop-workspace/status");
  const internetAvailable = navOnline;
  const detail = internetAvailable
    ? localServerAvailable
      ? "Internet: AVAILABLE. Local workspace API reachable. Hybrid research (online status + local knowledge)."
      : "Internet: AVAILABLE (browser). Local research API not confirmed — using local Knowledge Base."
    : "Internet: UNAVAILABLE. Research Mode: OFFLINE LOCAL KNOWLEDGE.";
  return { internetAvailable, localServerAvailable, detail };
}
