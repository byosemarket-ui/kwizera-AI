/**
 * Cross-process mutex via exclusive file creation (O_CREAT|O_EXCL).
 * Serializes read-modify-write of the XAU position lock across workers and app instances
 * sharing the same storage root. A holder that dies leaves a stale file, broken after staleMs.
 */
import fs from "node:fs";

export interface FileMutexOptions {
  timeoutMs?: number;
  staleMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function withFileMutex<T>(
  mutexPath: string,
  fn: () => T | Promise<T>,
  opts: FileMutexOptions = {},
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 5_000;
  const staleMs = opts.staleMs ?? 15_000;
  const started = Date.now();
  let fd: number | null = null;
  while (fd == null) {
    try {
      fd = fs.openSync(mutexPath, "wx");
      fs.writeSync(fd, JSON.stringify({ pid: process.pid, atMs: Date.now() }));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      try {
        const st = fs.statSync(mutexPath);
        if (Date.now() - st.mtimeMs > staleMs) {
          fs.unlinkSync(mutexPath);
          continue;
        }
      } catch {
        continue;
      }
      if (Date.now() - started > timeoutMs) {
        throw new Error("POSITION_LOCK_MUTEX_TIMEOUT");
      }
      await sleep(5 + Math.floor(Math.random() * 20));
    }
  }
  try {
    return await fn();
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      /* already closed */
    }
    try {
      fs.unlinkSync(mutexPath);
    } catch {
      /* already removed */
    }
  }
}
