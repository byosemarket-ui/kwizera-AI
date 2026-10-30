/**
 * Phase 4.3 — Cross-process single-worker ownership for AutoEngineWorker.
 * File lock under KWIZERA_STORAGE_ROOT. Never enables mutation by itself.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { resolveStorageRoot } from "../../../../storage/paths/storage-paths.js";

export interface WorkerLockPayload {
  schemaVersion: "kwizera.auto-engine-lock.v1";
  ownerId: string;
  pid: number;
  acquiredAtUtc: string;
  heartbeatAtUtc: string;
  hostname: string;
}

export interface WorkerLockHandle {
  ownerId: string;
  path: string;
  release: () => void;
  heartbeat: () => boolean;
}

const SCHEMA = "kwizera.auto-engine-lock.v1" as const;

export function resolveAutoEngineLockPath(storageRoot?: string): string {
  return join(
    storageRoot ?? resolveStorageRoot(),
    "forex",
    "auto-engine-worker.lock.json",
  );
}

function readLock(path: string): WorkerLockPayload | null {
  try {
    if (!existsSync(path)) return null;
    const raw = JSON.parse(readFileSync(path, "utf8")) as WorkerLockPayload;
    if (!raw || raw.schemaVersion !== SCHEMA || !raw.ownerId) return null;
    return raw;
  } catch {
    return null;
  }
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Try to acquire exclusive worker ownership.
 * Stale locks (dead pid or heartbeat older than staleMs) may be stolen.
 */
export function tryAcquireAutoEngineWorkerLock(input: {
  ownerId: string;
  path?: string;
  staleMs?: number;
  nowMs?: number;
  hostname?: string;
}): { ok: true; handle: WorkerLockHandle } | { ok: false; code: string; holder: WorkerLockPayload | null } {
  const path = input.path ?? resolveAutoEngineLockPath();
  const staleMs = input.staleMs ?? 90_000;
  const nowMs = input.nowMs ?? Date.now();
  mkdirSync(dirname(path), { recursive: true });

  const existing = readLock(path);
  if (existing) {
    const beat = Date.parse(existing.heartbeatAtUtc);
    const stale = !Number.isFinite(beat) || nowMs - beat > staleMs;
    const dead = !isProcessAlive(existing.pid);
    const sameOwner = existing.ownerId === input.ownerId && existing.pid === process.pid;
    if (!sameOwner && !stale && !dead) {
      return { ok: false, code: "WORKER_LOCK_HELD", holder: existing };
    }
  }

  const payload: WorkerLockPayload = {
    schemaVersion: SCHEMA,
    ownerId: input.ownerId,
    pid: process.pid,
    acquiredAtUtc: new Date(nowMs).toISOString(),
    heartbeatAtUtc: new Date(nowMs).toISOString(),
    hostname: input.hostname ?? (process.env.COMPUTERNAME ?? process.env.HOSTNAME ?? "unknown"),
  };

  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
    // On Windows rename over existing may fail — unlink then rename.
    if (existsSync(path)) {
      try {
        unlinkSync(path);
      } catch {
        /* race — re-check below */
      }
    }
    renameSync(tmp, path);
  } catch {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    const holder = readLock(path);
    if (holder && holder.ownerId === input.ownerId && holder.pid === process.pid) {
      // lost race but we still own it
    } else {
      return { ok: false, code: "WORKER_LOCK_RACE", holder };
    }
  }

  const confirmed = readLock(path);
  if (!confirmed || confirmed.ownerId !== input.ownerId || confirmed.pid !== process.pid) {
    return { ok: false, code: "WORKER_LOCK_NOT_OWNED", holder: confirmed };
  }

  const handle: WorkerLockHandle = {
    ownerId: input.ownerId,
    path,
    heartbeat: () => {
      const cur = readLock(path);
      if (!cur || cur.ownerId !== input.ownerId || cur.pid !== process.pid) return false;
      const next: WorkerLockPayload = {
        ...cur,
        heartbeatAtUtc: new Date().toISOString(),
      };
      try {
        writeFileSync(path, JSON.stringify(next, null, 2), "utf8");
        return true;
      } catch {
        return false;
      }
    },
    release: () => {
      const cur = readLock(path);
      if (cur && cur.ownerId === input.ownerId && cur.pid === process.pid) {
        try {
          unlinkSync(path);
        } catch {
          /* ignore */
        }
      }
    },
  };
  return { ok: true, handle };
}

/** True when this process currently holds the lock file. */
export function ownsAutoEngineWorkerLock(input: {
  ownerId: string;
  path?: string;
}): boolean {
  const path = input.path ?? resolveAutoEngineLockPath();
  const cur = readLock(path);
  return Boolean(cur && cur.ownerId === input.ownerId && cur.pid === process.pid);
}
