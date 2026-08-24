import type { ProductivityAction } from "./types";
import { KEYBOARD_SHORTCUTS, QUICK_ACTIONS } from "../navigation/navigation-engine";

const STORAGE_KEY = "kwizera.ux-productivity.v1";

interface Store {
  favorites: string[];
  recent: Array<{ id: string; at: string; count: number }>;
}

function load(): Store {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Store | null;
    if (!raw) return { favorites: [], recent: [] };
    return {
      favorites: raw.favorites ?? [],
      recent: (raw.recent ?? []).slice(0, 20),
    };
  } catch {
    return { favorites: [], recent: [] };
  }
}

function save(store: Store): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function recordAction(id: string): void {
  const store = load();
  const existing = store.recent.find((r) => r.id === id);
  const recent = [
    { id, at: new Date().toISOString(), count: (existing?.count ?? 0) + 1 },
    ...store.recent.filter((r) => r.id !== id),
  ].slice(0, 20);
  save({ ...store, recent });
}

export function toggleFavoriteAction(id: string): string[] {
  const store = load();
  const favorites = store.favorites.includes(id)
    ? store.favorites.filter((f) => f !== id)
    : [...store.favorites, id].slice(0, 12);
  save({ ...store, favorites });
  return favorites;
}

export function listProductivityActions(): {
  quick: ProductivityAction[];
  favorites: ProductivityAction[];
  recent: ProductivityAction[];
  frequent: ProductivityAction[];
  recommendations: string[];
} {
  const store = load();
  const catalog: ProductivityAction[] = [
    ...QUICK_ACTIONS.map((a) => ({
      id: a.id,
      label: a.label,
      detail: a.detail,
      shortcut: a.shortcut,
      favorite: store.favorites.includes(a.id),
      count: store.recent.find((r) => r.id === a.id)?.count,
      recentAt: store.recent.find((r) => r.id === a.id)?.at,
    })),
    ...KEYBOARD_SHORTCUTS.map((s) => ({
      id: s.action,
      label: s.action.replace(/-/g, " "),
      detail: s.detail,
      shortcut: s.keys,
      favorite: store.favorites.includes(s.action),
    })),
  ];

  const byId = new Map(catalog.map((a) => [a.id, a]));
  const favorites = store.favorites.map((id) => byId.get(id)).filter(Boolean) as ProductivityAction[];
  const recent = store.recent.map((r) => {
    const base = byId.get(r.id);
    return base ? { ...base, recentAt: r.at, count: r.count } : null;
  }).filter(Boolean) as ProductivityAction[];
  const frequent = [...store.recent]
    .sort((a, b) => b.count - a.count)
    .map((r) => byId.get(r.id))
    .filter(Boolean)
    .slice(0, 6) as ProductivityAction[];

  const recommendations: string[] = [];
  if (!store.favorites.length) recommendations.push("Favorite Save and AI Me for one-click access.");
  if (!store.recent.some((r) => r.id === "save")) recommendations.push("Use Ctrl+S regularly — auto save also protects production.");
  if (!store.recent.some((r) => r.id === "ai-me")) recommendations.push("Open AI Me (Ctrl+Shift+A) when unsure which panel to use.");

  return {
    quick: catalog.slice(0, 9),
    favorites,
    recent: recent.slice(0, 8),
    frequent,
    recommendations,
  };
}

export function workspaceTourSteps() {
  return [
    { id: "header", target: "header", title: "Command bar", body: "Search with Ctrl+K, watch save status, and open preferences with Ctrl+,." },
    { id: "nav", target: "left-sidebar", title: "Navigation", body: "Favorites, frequent pages, and full groups keep production surfaces one click away." },
    { id: "center", target: "center", title: "Production workspace", body: "Panels dock, float, and resize. Ctrl+Shift+L opens the layout manager." },
    { id: "ai", target: "right-sidebar", title: "AI Me", body: "Ask for layout, preference, performance, and UX guidance without leaving the studio." },
    { id: "bottom", target: "bottom-panel", title: "Status & logs", body: "Track production metrics, warnings, and performance without losing focus." },
  ];
}
