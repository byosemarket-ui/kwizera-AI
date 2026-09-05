/**
 * Safe AI response cache — project-aware, versioned keys, no secrets.
 * Used for reusable advisor/planning results on low-RAM hosts.
 */

export interface AiCacheEntry<T> {
  value: T;
  createdAt: number;
  expiresAt: number;
}

const store = new Map<string, AiCacheEntry<unknown>>();
const DEFAULT_TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 64;

export function buildAiCacheKey(parts: {
  task: string;
  model: string;
  promptVersion: string;
  projectId?: string;
  contextVersion?: string;
  knowledgeVersion?: string;
}): string {
  return [
    parts.task,
    parts.model,
    parts.promptVersion,
    parts.projectId ?? "global",
    parts.contextVersion ?? "0",
    parts.knowledgeVersion ?? "0",
  ].join("|");
}

export function getCachedAiResult<T>(key: string): T | null {
  const entry = store.get(key) as AiCacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function setCachedAiResult<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): void {
  if (store.size >= MAX_ENTRIES) {
    const first = store.keys().next().value;
    if (first) store.delete(first);
  }
  const now = Date.now();
  store.set(key, { value, createdAt: now, expiresAt: now + ttlMs });
}

export function invalidateAiCache(predicate?: (key: string) => boolean): void {
  if (!predicate) {
    store.clear();
    return;
  }
  for (const key of [...store.keys()]) {
    if (predicate(key)) store.delete(key);
  }
}

export function invalidateAiCacheForProject(projectId: string): void {
  invalidateAiCache((key) => key.includes(`|${projectId}|`));
}

export function aiCacheSizeForTests(): number {
  return store.size;
}
