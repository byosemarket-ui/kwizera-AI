export type ForexAdminRouteId =
  | "dashboard"
  | "instruments"
  | "knowledge"
  | "knowledge-documents"
  | "knowledge-topics"
  | "knowledge-categories"
  | "knowledge-concepts"
  | "knowledge-status"
  | "indexing"
  | "ai-configuration"
  | "retrieval-diagnostics"
  | "system-health"
  | "settings"
  | "knowledge-new"
  | "knowledge-detail"
  | "knowledge-edit"
  | "memory"
  | "journal"
  | "journal-detail"
  | "outcomes"
  | "mistakes"
  | "learning";

export type ForexAdminViewId = ForexAdminRouteId | "not-found";

export type ForexAdminNavGroupId = "overview" | "market-data" | "knowledge" | "memory" | "ai-system" | "system";

export interface ForexAdminNavItem {
  id: Exclude<
    ForexAdminRouteId,
    "knowledge-new" | "knowledge-detail" | "knowledge-edit" | "journal-detail"
  >;
  label: string;
  path: string;
  implemented: boolean;
  group: ForexAdminNavGroupId;
  groupLabel: string;
}

export const FOREX_ADMIN_ROOT = "/admin/forex";

export const FOREX_ADMIN_NAV: ForexAdminNavItem[] = [
  { id: "dashboard", label: "Dashboard", path: "/admin/forex", implemented: true, group: "overview", groupLabel: "Overview" },
  { id: "instruments", label: "FXCM Instruments", path: "/admin/forex/instruments", implemented: true, group: "market-data", groupLabel: "Market Data" },
  { id: "knowledge", label: "Knowledge Base", path: "/admin/forex/knowledge", implemented: true, group: "knowledge", groupLabel: "AI Knowledge" },
  { id: "knowledge-documents", label: "Documents", path: "/admin/forex/knowledge/documents", implemented: true, group: "knowledge", groupLabel: "AI Knowledge" },
  { id: "knowledge-topics", label: "Topics", path: "/admin/forex/knowledge/topics", implemented: true, group: "knowledge", groupLabel: "AI Knowledge" },
  { id: "knowledge-categories", label: "Categories", path: "/admin/forex/knowledge/categories", implemented: true, group: "knowledge", groupLabel: "AI Knowledge" },
  { id: "knowledge-concepts", label: "Concepts", path: "/admin/forex/knowledge/concepts", implemented: true, group: "knowledge", groupLabel: "AI Knowledge" },
  { id: "memory", label: "Memory", path: "/admin/forex/memory", implemented: true, group: "memory", groupLabel: "AI Memory" },
  { id: "journal", label: "Journal", path: "/admin/forex/journal", implemented: true, group: "memory", groupLabel: "AI Memory" },
  { id: "outcomes", label: "Outcomes", path: "/admin/forex/outcomes", implemented: true, group: "memory", groupLabel: "AI Memory" },
  { id: "mistakes", label: "Mistakes", path: "/admin/forex/mistakes", implemented: true, group: "memory", groupLabel: "AI Memory" },
  { id: "learning", label: "Learning", path: "/admin/forex/learning", implemented: true, group: "memory", groupLabel: "AI Memory" },
  { id: "knowledge-status", label: "Knowledge Status", path: "/admin/forex/knowledge/settings", implemented: true, group: "ai-system", groupLabel: "AI System" },
  { id: "indexing", label: "Indexing", path: "/admin/forex/indexing", implemented: true, group: "ai-system", groupLabel: "AI System" },
  { id: "ai-configuration", label: "AI Configuration", path: "/admin/forex/ai-configuration", implemented: true, group: "ai-system", groupLabel: "AI System" },
  { id: "retrieval-diagnostics", label: "Retrieval Diagnostics", path: "/admin/forex/retrieval-diagnostics", implemented: true, group: "ai-system", groupLabel: "AI System" },
  { id: "system-health", label: "System Health", path: "/admin/forex/system-health", implemented: true, group: "ai-system", groupLabel: "AI System" },
  { id: "settings", label: "Settings", path: "/admin/forex/settings", implemented: true, group: "system", groupLabel: "System" },
];

export const FOREX_ADMIN_GROUP_ORDER: ForexAdminNavGroupId[] = [
  "overview",
  "market-data",
  "knowledge",
  "memory",
  "ai-system",
  "system",
];

export function isForexAdminUrl(
  pathname = typeof window !== "undefined" ? window.location.pathname : "",
): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === FOREX_ADMIN_ROOT || path.startsWith(`${FOREX_ADMIN_ROOT}/`);
}

export interface ForexAdminLocation {
  view: ForexAdminViewId;
  documentId: string | null;
  canonicalPath: string;
}

export function parseForexAdminRouteFromLocation(
  pathname = typeof window !== "undefined" ? window.location.pathname : "",
): ForexAdminLocation {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (!isForexAdminUrl(path)) {
    return { view: "not-found", documentId: null, canonicalPath: FOREX_ADMIN_ROOT };
  }
  const rest = path.slice(FOREX_ADMIN_ROOT.length).replace(/^\//, "");
  if (!rest) return { view: "dashboard", documentId: null, canonicalPath: FOREX_ADMIN_ROOT };

  if (rest === "instruments") {
    return { view: "instruments", documentId: null, canonicalPath: "/admin/forex/instruments" };
  }
  if (rest === "knowledge") return { view: "knowledge", documentId: null, canonicalPath: "/admin/forex/knowledge" };
  if (rest === "knowledge/documents") {
    return { view: "knowledge-documents", documentId: null, canonicalPath: "/admin/forex/knowledge/documents" };
  }
  if (rest === "knowledge/topics") {
    return { view: "knowledge-topics", documentId: null, canonicalPath: "/admin/forex/knowledge/topics" };
  }
  if (rest === "knowledge/categories") {
    return { view: "knowledge-categories", documentId: null, canonicalPath: "/admin/forex/knowledge/categories" };
  }
  if (rest === "knowledge/concepts") {
    return { view: "knowledge-concepts", documentId: null, canonicalPath: "/admin/forex/knowledge/concepts" };
  }
  if (rest === "knowledge/settings") {
    return { view: "knowledge-status", documentId: null, canonicalPath: "/admin/forex/knowledge/settings" };
  }
  if (rest === "knowledge/new") {
    return { view: "knowledge-new", documentId: null, canonicalPath: "/admin/forex/knowledge/new" };
  }
  const edit = rest.match(/^knowledge\/([^/]+)\/edit$/);
  if (edit) {
    return {
      view: "knowledge-edit",
      documentId: decodeURIComponent(edit[1]!),
      canonicalPath: `/admin/forex/knowledge/${edit[1]}/edit`,
    };
  }
  const detail = rest.match(/^knowledge\/([^/]+)$/);
  if (detail && detail[1] !== "documents" && detail[1] !== "topics" && detail[1] !== "categories"
    && detail[1] !== "concepts" && detail[1] !== "settings" && detail[1] !== "new") {
    return {
      view: "knowledge-detail",
      documentId: decodeURIComponent(detail[1]!),
      canonicalPath: `/admin/forex/knowledge/${detail[1]}`,
    };
  }
  if (rest === "indexing") return { view: "indexing", documentId: null, canonicalPath: "/admin/forex/indexing" };
  if (rest === "memory") return { view: "memory", documentId: null, canonicalPath: "/admin/forex/memory" };
  if (rest === "journal") return { view: "journal", documentId: null, canonicalPath: "/admin/forex/journal" };
  const journalDetail = rest.match(/^journal\/([^/]+)$/);
  if (journalDetail) {
    return {
      view: "journal-detail",
      documentId: decodeURIComponent(journalDetail[1]!),
      canonicalPath: `/admin/forex/journal/${journalDetail[1]}`,
    };
  }
  if (rest === "outcomes") return { view: "outcomes", documentId: null, canonicalPath: "/admin/forex/outcomes" };
  if (rest === "mistakes") return { view: "mistakes", documentId: null, canonicalPath: "/admin/forex/mistakes" };
  if (rest === "learning") return { view: "learning", documentId: null, canonicalPath: "/admin/forex/learning" };
  if (rest === "ai-configuration") {
    return { view: "ai-configuration", documentId: null, canonicalPath: "/admin/forex/ai-configuration" };
  }
  if (rest === "retrieval-diagnostics") {
    return { view: "retrieval-diagnostics", documentId: null, canonicalPath: "/admin/forex/retrieval-diagnostics" };
  }
  if (rest === "system-health") {
    return { view: "system-health", documentId: null, canonicalPath: "/admin/forex/system-health" };
  }
  if (rest === "settings") return { view: "settings", documentId: null, canonicalPath: "/admin/forex/settings" };

  return { view: "not-found", documentId: null, canonicalPath: path };
}

export function syncForexAdminUrl(canonicalPath: string): void {
  if (window.location.pathname !== canonicalPath) {
    window.history.replaceState({ forexAdmin: true }, "", canonicalPath);
  }
}

export function pushForexAdminUrl(canonicalPath: string): void {
  if (window.location.pathname !== canonicalPath) {
    window.history.pushState({ forexAdmin: true }, "", canonicalPath);
  }
}

export function getForexAdminDocumentTitle(view: ForexAdminViewId): string {
  switch (view) {
    case "dashboard":
      return "KWIZERA AI STUDIO — Forex Admin";
    case "instruments":
      return "KWIZERA AI STUDIO — FXCM Instruments";
    case "knowledge":
    case "knowledge-documents":
      return "KWIZERA AI STUDIO — Forex Knowledge Base";
    case "knowledge-new":
      return "KWIZERA AI STUDIO — New Forex Knowledge";
    case "knowledge-edit":
      return "KWIZERA AI STUDIO — Edit Forex Knowledge";
    case "knowledge-detail":
      return "KWIZERA AI STUDIO — Forex Knowledge Detail";
    case "knowledge-topics":
      return "KWIZERA AI STUDIO — Forex Knowledge Topics";
    case "knowledge-categories":
      return "KWIZERA AI STUDIO — Forex Knowledge Categories";
    case "knowledge-concepts":
      return "KWIZERA AI STUDIO — Forex Knowledge Concepts";
    case "knowledge-status":
      return "KWIZERA AI STUDIO — Forex Knowledge Status";
    case "indexing":
      return "KWIZERA AI STUDIO — Forex Knowledge Indexing";
    case "ai-configuration":
      return "KWIZERA AI STUDIO — Forex AI Configuration";
    case "retrieval-diagnostics":
      return "KWIZERA AI STUDIO — Forex Retrieval Diagnostics";
    case "system-health":
      return "KWIZERA AI STUDIO — Forex AI System Health";
    case "memory":
      return "KWIZERA AI STUDIO — Forex AI Memory";
    case "journal":
    case "journal-detail":
      return "KWIZERA AI STUDIO — Forex AI Journal";
    case "outcomes":
      return "KWIZERA AI STUDIO — Forex AI Outcomes";
    case "mistakes":
      return "KWIZERA AI STUDIO — Forex AI Mistakes";
    case "learning":
      return "KWIZERA AI STUDIO — Forex AI Learning";
    case "settings":
      return "KWIZERA AI STUDIO — Forex Admin Settings";
    default:
      return "KWIZERA AI STUDIO — Forex Admin";
  }
}
