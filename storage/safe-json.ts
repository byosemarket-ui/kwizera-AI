/**
 * Safe persistence helpers — corrupt/truncated JSON must not kill boot.
 * Quarantines bad files; never deletes project media.
 */
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

export interface SafeJsonReadResult<T> {
  value: T;
  recovered: boolean;
  quarantinedPath?: string;
  error?: string;
}

export async function quarantineCorruptFile(filePath: string, reason: string): Promise<string | undefined> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = `${filePath}.corrupt.${stamp}`;
  try {
    await fs.rename(filePath, dest);
    console.warn("[KWIZERA][safe-json] quarantined corrupt store", {
      filePath,
      dest,
      reason: reason.slice(0, 200),
    });
    return dest;
  } catch (error) {
    console.warn("[KWIZERA][safe-json] quarantine failed", {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

export async function readJsonSafe<T>(
  filePath: string,
  fallback: T,
  opts?: { maxBytes?: number },
): Promise<SafeJsonReadResult<T>> {
  const maxBytes = opts?.maxBytes ?? Number(process.env.KWIZERA_JSON_MAX_BYTES || 2_000_000);
  try {
    const stat = await fs.stat(filePath);
    if (stat.size > maxBytes) {
      const reason = `oversized JSON store (${stat.size} bytes > ${maxBytes})`;
      const quarantinedPath = await quarantineCorruptFile(filePath, reason);
      return {
        value: fallback,
        recovered: true,
        quarantinedPath,
        error: reason,
      };
    }
    const text = await fs.readFile(filePath, "utf8");
    if (!text.trim()) {
      return { value: fallback, recovered: false };
    }
    try {
      return { value: JSON.parse(text) as T, recovered: false };
    } catch (parseError) {
      const reason = parseError instanceof Error ? parseError.message : String(parseError);
      const quarantinedPath = await quarantineCorruptFile(filePath, reason);
      return {
        value: fallback,
        recovered: true,
        quarantinedPath,
        error: reason,
      };
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { value: fallback, recovered: false };
    }
    throw error;
  }
}

/** Sync variant for memory/knowledge engines that still use fs.readFileSync. */
export function readJsonSafeSync<T>(
  filePath: string,
  fallback: T,
  opts?: { maxBytes?: number },
): SafeJsonReadResult<T> {
  const maxBytes = opts?.maxBytes ?? Number(process.env.KWIZERA_JSON_MAX_BYTES || 2_000_000);
  try {
    if (!fsSync.existsSync(filePath)) {
      return { value: fallback, recovered: false };
    }
    const stat = fsSync.statSync(filePath);
    if (stat.size > maxBytes) {
      const reason = `oversized JSON store (${stat.size} bytes > ${maxBytes})`;
      const quarantinedPath = quarantineCorruptFileSync(filePath, reason);
      return { value: fallback, recovered: true, quarantinedPath, error: reason };
    }
    const text = fsSync.readFileSync(filePath, "utf8");
    if (!text.trim()) {
      return { value: fallback, recovered: false };
    }
    try {
      return { value: JSON.parse(text) as T, recovered: false };
    } catch (parseError) {
      const reason = parseError instanceof Error ? parseError.message : String(parseError);
      const quarantinedPath = quarantineCorruptFileSync(filePath, reason);
      return { value: fallback, recovered: true, quarantinedPath, error: reason };
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { value: fallback, recovered: false };
    }
    throw error;
  }
}

function quarantineCorruptFileSync(filePath: string, reason: string): string | undefined {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = `${filePath}.corrupt.${stamp}`;
  try {
    fsSync.renameSync(filePath, dest);
    console.warn("[KWIZERA][safe-json] quarantined corrupt store", {
      filePath,
      dest,
      reason: reason.slice(0, 200),
    });
    return dest;
  } catch (error) {
    console.warn("[KWIZERA][safe-json] quarantine failed", {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

export async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${createHash("sha1").update(randomUUID()).digest("hex")}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, filePath);
}
