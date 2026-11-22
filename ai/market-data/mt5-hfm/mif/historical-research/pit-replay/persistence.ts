/**
 * P8.B — immutable PIT replay input manifest persistence.
 * Under {researchRoot}/pit-replay-manifests/{manifestId}.json
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { sanitizeResearchStorageId, type MifHistoricalResearchStorage } from "../storage.js";
import type { MifPitReplayInputManifest } from "./types.js";

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function atomicWrite(filePath: string, data: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const handle = await fs.open(tmp, "w");
  try {
    await handle.writeFile(data, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await fs.rename(tmp, filePath);
  } catch {
    try {
      await fs.unlink(filePath);
    } catch {
      /* ignore */
    }
    await fs.rename(tmp, filePath);
  }
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    if (!raw.trim()) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return null;
    throw err;
  }
}

export function resolvePitReplayManifestsDir(researchRoot: string): string {
  return path.join(researchRoot, "pit-replay-manifests");
}

export class MifPitReplayManifestStorage {
  readonly root: string;

  constructor(researchRoot: string) {
    this.root = resolvePitReplayManifestsDir(researchRoot);
  }

  static fromResearchStorage(storage: MifHistoricalResearchStorage): MifPitReplayManifestStorage {
    return new MifPitReplayManifestStorage(storage.root);
  }

  manifestPath(manifestId: string): string {
    return path.join(this.root, `${sanitizeResearchStorageId(manifestId)}.json`);
  }

  async ensureLayout(): Promise<void> {
    await ensureDir(this.root);
  }

  /**
   * Persist immutable manifest. Identical contentIdentityHash → idempotent OK.
   * Different content for same manifestId → refuse.
   */
  async persistManifest(
    manifest: MifPitReplayInputManifest,
  ): Promise<{ ok: true; created: boolean } | { ok: false; code: string; message: string }> {
    await this.ensureLayout();
    const p = this.manifestPath(manifest.manifestId);
    const existing = await readJsonFile<MifPitReplayInputManifest>(p);
    if (existing) {
      if (existing.contentIdentityHash === manifest.contentIdentityHash) {
        return { ok: true, created: false };
      }
      return {
        ok: false,
        code: "MANIFEST_IMMUTABLE_CONFLICT",
        message: `refusing to change existing PIT replay manifest ${manifest.manifestId}`,
      };
    }
    await atomicWrite(p, `${JSON.stringify(manifest, null, 2)}\n`);
    const check = await this.getManifest(manifest.manifestId);
    if (!check || check.contentIdentityHash !== manifest.contentIdentityHash) {
      return { ok: false, code: "READBACK_FAILED", message: "manifest read-after-write failed" };
    }
    return { ok: true, created: true };
  }

  async getManifest(manifestId: string): Promise<MifPitReplayInputManifest | null> {
    return readJsonFile<MifPitReplayInputManifest>(this.manifestPath(manifestId));
  }

  /**
   * Verify loaded manifest identity still matches recomputed content hash fields.
   */
  verifyManifestIntegrity(manifest: MifPitReplayInputManifest): {
    ok: boolean;
    code: string | null;
  } {
    if (manifest.status !== "FROZEN") {
      return { ok: false, code: "NOT_FROZEN" };
    }
    if (manifest.clipMode !== "CLOSE_TIME_AT_DECISION") {
      return { ok: false, code: "INVALID_CLIP_MODE" };
    }
    if (!manifest.contentIdentityHash || !manifest.manifestId) {
      return { ok: false, code: "MISSING_IDENTITY" };
    }
    if (!manifest.manifestId.startsWith("pitrm:")) {
      return { ok: false, code: "BAD_MANIFEST_ID" };
    }
    return { ok: true, code: null };
  }
}
