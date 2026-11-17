/**
 * HFM-only favorites preference store (localStorage).
 * Favorites ≠ subscriptions. Provider locked to HFM_MT5 / demo.
 */

const STORAGE_KEY = "kwizera.hfm.market-watch.favorites.v1";
const MAX_FAVORITES = 200;

export type HfmMwFavoriteEntry = {
  provider: "HFM_MT5";
  environment: "demo";
  symbol: string;
  addedAt: string;
};

function readRaw(): HfmMwFavoriteEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row): row is HfmMwFavoriteEntry => {
        if (!row || typeof row !== "object") return false;
        const r = row as HfmMwFavoriteEntry;
        return (
          r.provider === "HFM_MT5" &&
          r.environment === "demo" &&
          typeof r.symbol === "string" &&
          r.symbol.trim().length > 0
        );
      })
      .slice(0, MAX_FAVORITES);
  } catch {
    return [];
  }
}

function writeRaw(rows: HfmMwFavoriteEntry[]): { ok: boolean; error: string | null } {
  if (typeof localStorage === "undefined") {
    return { ok: false, error: "localStorage unavailable" };
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, MAX_FAVORITES)));
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "Failed to persist HFM favorites" };
  }
}

export function listHfmFavorites(): HfmMwFavoriteEntry[] {
  return readRaw();
}

export function listHfmFavoriteSymbols(): string[] {
  return readRaw().map((r) => r.symbol);
}

export function isHfmFavorite(symbol: string): boolean {
  const s = symbol.trim();
  return readRaw().some((r) => r.symbol === s);
}

export function addHfmFavorite(symbol: string): { ok: boolean; error: string | null; symbols: string[] } {
  const s = symbol.trim();
  if (!s) return { ok: false, error: "Symbol required", symbols: listHfmFavoriteSymbols() };
  const rows = readRaw();
  if (rows.some((r) => r.symbol === s)) {
    return { ok: true, error: null, symbols: rows.map((r) => r.symbol) };
  }
  rows.unshift({
    provider: "HFM_MT5",
    environment: "demo",
    symbol: s,
    addedAt: new Date().toISOString(),
  });
  const saved = writeRaw(rows);
  return { ok: saved.ok, error: saved.error, symbols: listHfmFavoriteSymbols() };
}

export function removeHfmFavorite(symbol: string): { ok: boolean; error: string | null; symbols: string[] } {
  const s = symbol.trim();
  const next = readRaw().filter((r) => r.symbol !== s);
  const saved = writeRaw(next);
  return { ok: saved.ok, error: saved.error, symbols: listHfmFavoriteSymbols() };
}

export function toggleHfmFavorite(symbol: string): {
  ok: boolean;
  error: string | null;
  favorite: boolean;
  symbols: string[];
} {
  if (isHfmFavorite(symbol)) {
    const r = removeHfmFavorite(symbol);
    return { ...r, favorite: false };
  }
  const r = addHfmFavorite(symbol);
  return { ...r, favorite: r.ok };
}
