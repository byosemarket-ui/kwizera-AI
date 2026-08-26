/**
 * Sync creative-memory / production history (localStorage cache)
 * → durable disk via Persistent Memory Center.
 * Disk is source of truth across restarts/updates; localStorage remains a fast cache.
 */

import { persistentMemoryApi, type StudioMemoryKind } from "./api-client";

const SYNC_FLAG = "kwizera.persistent-memory.last-sync.v1";
const HYDRATE_FLAG = "kwizera.persistent-memory.last-hydrate.v1";

function mapCategory(category: string): StudioMemoryKind {
  const c = category.toUpperCase();
  if (c.includes("PREFERENCE")) return "USER_PREFERENCE";
  if (c.includes("DECISION")) return "AI_DECISION";
  if (c.includes("CORRECTION") || c.includes("REVIEW")) return "AI_CORRECTION";
  if (c.includes("PRODUCTION") || c.includes("VERSION")) return "PRODUCTION_MEMORY";
  if (c.includes("MARKETING")) return "MARKETING_MEMORY";
  if (c.includes("CREATIVE")) return "CREATIVE_MEMORY";
  if (c.includes("LEARNING")) return "AI_LEARNING";
  return "PROJECT_MEMORY";
}

export async function syncCreativeMemoryBlobToDisk(blob: {
  byProject?: Record<string, { entries?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>;
}): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  let failed = 0;
  const projects = blob.byProject ?? {};
  for (const [projectId, pack] of Object.entries(projects)) {
    const entries = Array.isArray(pack)
      ? pack
      : (pack.entries ?? []);
    for (const entry of entries) {
      try {
        const id = String(entry.id ?? "");
        const title = String(entry.title ?? entry.topic ?? entry.summary ?? (id || "memory"));
        const content = String(entry.detail ?? entry.summary ?? entry.content ?? JSON.stringify(entry));
        const kind = mapCategory(String(entry.category ?? "PROJECT_MEMORY"));
        await persistentMemoryApi.saveMemory({
          kind,
          title,
          content,
          projectId,
          source: "creative-memory-sync",
          dedupeKey: id || undefined,
          importance: String(entry.importance ?? "NORMAL").toUpperCase(),
          tags: Array.isArray(entry.tags) ? entry.tags.map(String) : [kind],
          payload: { creativeMemoryId: id, raw: entry },
        });
        synced += 1;
      } catch {
        failed += 1;
      }
    }
  }
  try {
    localStorage.setItem(SYNC_FLAG, new Date().toISOString());
  } catch { /* ignore */ }
  return { synced, failed };
}

/** Persist production history entries as PRODUCTION_MEMORY (metadata only — no media blobs). */
export async function syncProductionHistoryToDisk(
  entries: Array<Record<string, unknown>>,
): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  let failed = 0;
  for (const entry of entries.slice(0, 100)) {
    try {
      const productionId = String(entry.productionId ?? "");
      const versionLabel = String(entry.versionLabel ?? "");
      const projectId = String(entry.projectId ?? "");
      const title = `Production ${productionId || "unknown"} ${versionLabel}`.trim();
      const content = JSON.stringify({
        productionId,
        versionLabel,
        status: entry.status ?? null,
        completedAt: entry.completedAt ?? entry.updatedAt ?? null,
        packageId: entry.packageId ?? null,
        // File refs only — never embed media
        outputRefs: entry.outputRefs ?? entry.exports ?? null,
      });
      await persistentMemoryApi.saveMemory({
        kind: "PRODUCTION_MEMORY",
        title,
        content,
        projectId: projectId || undefined,
        source: "production-history-sync",
        dedupeKey: `${productionId}:${versionLabel}`,
        importance: "HIGH",
        tags: ["production", "history", versionLabel].filter(Boolean),
        payload: { productionHistory: true, productionId, versionLabel },
      });
      synced += 1;
    } catch {
      failed += 1;
    }
  }
  return { synced, failed };
}

export async function persistUserPreference(opts: {
  key: string;
  value: string;
  projectId?: string;
}): Promise<void> {
  await persistentMemoryApi.saveMemory({
    kind: "USER_PREFERENCE",
    title: `Preference: ${opts.key}`,
    content: opts.value,
    projectId: opts.projectId,
    source: "user-preference",
    dedupeKey: `pref:${opts.key}:${opts.projectId ?? "global"}`,
    importance: "HIGH",
    tags: ["preference", opts.key],
  });
}

/**
 * Fill empty localStorage creative-memory slots from disk after restart.
 * Does not overwrite non-empty project caches (disk sync already keeps them fresh).
 */
export async function hydrateCreativeMemoryFromDisk(blob: {
  byProject: Record<string, Array<Record<string, unknown>>>;
}): Promise<{ restoredProjects: number; restoredEntries: number }> {
  let restoredProjects = 0;
  let restoredEntries = 0;
  try {
    const health = await persistentMemoryApi.health();
    if (!health.ready) return { restoredProjects: 0, restoredEntries: 0 };

    const { records } = await persistentMemoryApi.searchMemory({
      kind: "CREATIVE_MEMORY",
      limit: 100,
    });
    const projectRecords = await persistentMemoryApi.searchMemory({
      kind: "PROJECT_MEMORY",
      limit: 100,
    });
    const all = [...records, ...projectRecords] as Array<Record<string, unknown>>;

    const byProject: Record<string, Array<Record<string, unknown>>> = { ...blob.byProject };
    for (const rec of all) {
      const projectId = String(
        rec.relatedProject
        ?? (rec.payload as { projectId?: string } | undefined)?.projectId
        ?? "",
      );
      if (!projectId) continue;
      const existing = byProject[projectId] ?? [];
      if (existing.length > 0) continue; // keep local cache if present

      const payload = (rec.payload ?? {}) as Record<string, unknown>;
      const raw = (payload.raw as Record<string, unknown> | undefined) ?? {
        id: String(payload.creativeMemoryId ?? rec.memoryId ?? ""),
        title: String(rec.title ?? ""),
        summary: String(rec.description ?? payload.content ?? ""),
        category: String(payload.kind ?? rec.category ?? "CREATIVE_MEMORY"),
        content: String(payload.content ?? rec.description ?? ""),
        importance: String(payload.importance ?? "NORMAL"),
        source: String(rec.source ?? "disk"),
      };
      if (!byProject[projectId]) {
        byProject[projectId] = [];
        restoredProjects += 1;
      }
      byProject[projectId].push(raw);
      restoredEntries += 1;
    }

    Object.assign(blob, { byProject });
    try {
      localStorage.setItem(HYDRATE_FLAG, new Date().toISOString());
    } catch { /* ignore */ }
  } catch {
    /* API unavailable — offline cache only */
  }
  return { restoredProjects, restoredEntries };
}

export function getLastSyncAt(): string | null {
  try {
    return localStorage.getItem(SYNC_FLAG);
  } catch {
    return null;
  }
}

export function getLastHydrateAt(): string | null {
  try {
    return localStorage.getItem(HYDRATE_FLAG);
  } catch {
    return null;
  }
}
