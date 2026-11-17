/**
 * HFM-only user watchlists (localStorage).
 * Not a broker subscription. Provider locked to HFM_MT5 / demo.
 */

const STORAGE_KEY = "kwizera.hfm.market-watch.watchlists.v1";
const MAX_LISTS = 20;
const MAX_SYMBOLS_PER_LIST = 100;

export type HfmMwWatchlist = {
  id: string;
  name: string;
  provider: "HFM_MT5";
  environment: "demo";
  symbols: string[];
  createdAt: string;
  updatedAt: string;
};

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `hfm-wl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readRaw(): HfmMwWatchlist[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row): row is HfmMwWatchlist => {
        if (!row || typeof row !== "object") return false;
        const r = row as HfmMwWatchlist;
        return (
          typeof r.id === "string" &&
          typeof r.name === "string" &&
          r.provider === "HFM_MT5" &&
          r.environment === "demo" &&
          Array.isArray(r.symbols)
        );
      })
      .map((r) => ({
        ...r,
        symbols: r.symbols
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          .map((s) => s.trim())
          .slice(0, MAX_SYMBOLS_PER_LIST),
      }))
      .slice(0, MAX_LISTS);
  } catch {
    return [];
  }
}

function writeRaw(rows: HfmMwWatchlist[]): { ok: boolean; error: string | null } {
  if (typeof localStorage === "undefined") {
    return { ok: false, error: "localStorage unavailable" };
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, MAX_LISTS)));
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "Failed to persist HFM watchlists" };
  }
}

export function listHfmWatchlists(): HfmMwWatchlist[] {
  return readRaw();
}

export function createHfmWatchlist(name: string): {
  ok: boolean;
  error: string | null;
  list: HfmMwWatchlist | null;
} {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name required", list: null };
  const rows = readRaw();
  if (rows.length >= MAX_LISTS) return { ok: false, error: "Watchlist limit reached", list: null };
  const now = new Date().toISOString();
  const list: HfmMwWatchlist = {
    id: newId(),
    name: trimmed.slice(0, 64),
    provider: "HFM_MT5",
    environment: "demo",
    symbols: [],
    createdAt: now,
    updatedAt: now,
  };
  const saved = writeRaw([list, ...rows]);
  return { ok: saved.ok, error: saved.error, list: saved.ok ? list : null };
}

export function renameHfmWatchlist(
  id: string,
  name: string,
): { ok: boolean; error: string | null; list: HfmMwWatchlist | null } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name required", list: null };
  const rows = readRaw();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return { ok: false, error: "Watchlist not found", list: null };
  rows[idx] = {
    ...rows[idx]!,
    name: trimmed.slice(0, 64),
    updatedAt: new Date().toISOString(),
  };
  const saved = writeRaw(rows);
  return { ok: saved.ok, error: saved.error, list: saved.ok ? rows[idx]! : null };
}

export function deleteHfmWatchlist(id: string): { ok: boolean; error: string | null } {
  const next = readRaw().filter((r) => r.id !== id);
  return writeRaw(next);
}

export function addSymbolToHfmWatchlist(
  id: string,
  symbol: string,
): { ok: boolean; error: string | null; list: HfmMwWatchlist | null } {
  const s = symbol.trim();
  if (!s) return { ok: false, error: "Symbol required", list: null };
  const rows = readRaw();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return { ok: false, error: "Watchlist not found", list: null };
  const list = rows[idx]!;
  if (list.symbols.includes(s)) return { ok: true, error: null, list };
  if (list.symbols.length >= MAX_SYMBOLS_PER_LIST) {
    return { ok: false, error: "Watchlist symbol limit reached", list };
  }
  rows[idx] = {
    ...list,
    symbols: [...list.symbols, s],
    updatedAt: new Date().toISOString(),
  };
  const saved = writeRaw(rows);
  return { ok: saved.ok, error: saved.error, list: saved.ok ? rows[idx]! : null };
}

export function removeSymbolFromHfmWatchlist(
  id: string,
  symbol: string,
): { ok: boolean; error: string | null; list: HfmMwWatchlist | null } {
  const s = symbol.trim();
  const rows = readRaw();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return { ok: false, error: "Watchlist not found", list: null };
  rows[idx] = {
    ...rows[idx]!,
    symbols: rows[idx]!.symbols.filter((x) => x !== s),
    updatedAt: new Date().toISOString(),
  };
  const saved = writeRaw(rows);
  return { ok: saved.ok, error: saved.error, list: saved.ok ? rows[idx]! : null };
}
