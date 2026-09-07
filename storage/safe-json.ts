/**
 * Safe persistence helpers — corrupt/truncated JSON must not kill boot.
 * Quarantines bad files; never deletes project media.
 */
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
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
): Promise<SafeJsonReadResult<T>> {
  try {
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

export async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${createHash("sha1").update(randomUUID()).digest("hex")}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, filePath);
}
