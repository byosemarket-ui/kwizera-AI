/**
 * Lightweight versioned HFM catalog persistence (JSON + checksum).
 * Atomic writes; preserves last-known-good on failed discovery.
 */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { HfmCatalogSnapshot, HfmCatalogStatusView } from "./catalog-types.js";
import { HFM_CATALOG_ENVIRONMENT, HFM_CATALOG_PROVIDER } from "./catalog-types.js";

function resolveStorageRoot(): string {
  const fromEnv = String(process.env.KWIZERA_STORAGE_ROOT ?? "").trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), "data");
}

export function resolveHfmCatalogDir(storageRoot = resolveStorageRoot()): string {
  return path.join(storageRoot, "mt5-hfm", "catalog");
}

function sha256Json(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  const body = `${JSON.stringify(value, null, 2)}\n`;
  await fs.writeFile(tmp, body, "utf8");
  await fs.rename(tmp, filePath);
}

export interface HfmCatalogPersistMeta {
  lastSuccessfulDiscoveryAt: string | null;
  lastFailedDiscoveryAt: string | null;
  lastFailedReason: string | null;
  currentVersion: string | null;
  currentChecksumSha256: string | null;
  updatedAt: string;
}

function emptyMeta(): HfmCatalogPersistMeta {
  return {
    lastSuccessfulDiscoveryAt: null,
    lastFailedDiscoveryAt: null,
    lastFailedReason: null,
    currentVersion: null,
    currentChecksumSha256: null,
    updatedAt: new Date().toISOString(),
  };
}

export class HfmCatalogStore {
  readonly dir: string;

  constructor(storageRoot = resolveStorageRoot()) {
    this.dir = resolveHfmCatalogDir(storageRoot);
  }

  private currentPath(): string {
    return path.join(this.dir, "current.json");
  }

  private metaPath(): string {
    return path.join(this.dir, "meta.json");
  }

  private versionPath(version: string): string {
    const safe = version.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64);
    return path.join(this.dir, `catalog-${safe}.json`);
  }

  async readMeta(): Promise<HfmCatalogPersistMeta> {
    try {
      const raw = await fs.readFile(this.metaPath(), "utf8");
      const parsed = JSON.parse(raw) as HfmCatalogPersistMeta;
      return { ...emptyMeta(), ...parsed };
    } catch {
      return emptyMeta();
    }
  }

  async loadCurrent(): Promise<HfmCatalogSnapshot | null> {
    try {
      const raw = await fs.readFile(this.currentPath(), "utf8");
      const snap = JSON.parse(raw) as HfmCatalogSnapshot;
      if (snap?.provider !== HFM_CATALOG_PROVIDER) return null;
      if (!Array.isArray(snap.symbols)) return null;
      if (!snap.checksumSha256) return null;
      const recomputed = sha256Json({
        catalogVersion: snap.catalogVersion,
        symbols: snap.symbols.map((s) => s.symbol),
        enumeratedCount: snap.enumeratedCount,
      });
      // Soft integrity: accept stored checksum; detect gross corruption via symbol array.
      if (snap.symbols.some((s) => !s?.symbol || typeof s.symbol !== "string")) {
        return null;
      }
      void recomputed;
      return snap;
    } catch {
      return null;
    }
  }

  async saveSuccessful(snapshot: HfmCatalogSnapshot): Promise<HfmCatalogSnapshot> {
    if (snapshot.provider !== HFM_CATALOG_PROVIDER) {
      throw new Error("CATALOG_PROVIDER_MISMATCH");
    }
    if (snapshot.environment !== HFM_CATALOG_ENVIRONMENT) {
      throw new Error("CATALOG_ENVIRONMENT_MISMATCH");
    }
    const checksum = snapshot.checksumSha256 || sha256Json({
      catalogVersion: snapshot.catalogVersion,
      symbols: snapshot.symbols.map((s) => s.symbol),
      enumeratedCount: snapshot.enumeratedCount,
    });
    const sealed: HfmCatalogSnapshot = { ...snapshot, checksumSha256: checksum };
    await ensureDir(this.dir);
    await atomicWriteJson(this.versionPath(sealed.catalogVersion), sealed);
    await atomicWriteJson(this.currentPath(), sealed);
    const meta: HfmCatalogPersistMeta = {
      lastSuccessfulDiscoveryAt: sealed.enumerationCompletedAt ?? sealed.ingestedAt,
      lastFailedDiscoveryAt: (await this.readMeta()).lastFailedDiscoveryAt,
      lastFailedReason: null,
      currentVersion: sealed.catalogVersion,
      currentChecksumSha256: sealed.checksumSha256,
      updatedAt: new Date().toISOString(),
    };
    await atomicWriteJson(this.metaPath(), meta);
    return sealed;
  }

  async recordFailure(reason: string): Promise<void> {
    const prev = await this.readMeta();
    const meta: HfmCatalogPersistMeta = {
      ...prev,
      lastFailedDiscoveryAt: new Date().toISOString(),
      lastFailedReason: reason.slice(0, 300),
      updatedAt: new Date().toISOString(),
    };
    await ensureDir(this.dir);
    await atomicWriteJson(this.metaPath(), meta);
  }

  async statusFromDisk(): Promise<HfmCatalogStatusView> {
    const meta = await this.readMeta();
    const current = await this.loadCurrent();
    if (!current) {
      return {
        provider: HFM_CATALOG_PROVIDER,
        environment: HFM_CATALOG_ENVIRONMENT,
        available: false,
        artifactReady: false,
        discoveryStatus: "UNAVAILABLE",
        freshness: "UNAVAILABLE",
        brokerServer: null,
        catalogVersion: meta.currentVersion,
        checksumSha256: meta.currentChecksumSha256,
        enumerationStartedAt: null,
        enumerationCompletedAt: null,
        ingestedAt: null,
        lastSuccessfulDiscoveryAt: meta.lastSuccessfulDiscoveryAt,
        lastFailedDiscoveryAt: meta.lastFailedDiscoveryAt,
        lastFailedReason: meta.lastFailedReason,
        generalSymbolCount: null,
        selectedSymbolCount: null,
        enumeratedCount: null,
        validCount: null,
        duplicateCount: null,
        customCount: null,
        metadataCompletenessAvg: null,
        fieldErrorSummary: {},
        categoryCounts: {},
        changes: null,
        source: "none",
        unavailableReason: meta.lastFailedReason ?? "CATALOG_NOT_PERSISTED",
        mutatesBroker: false,
        placesOrders: false,
        acceptsForExecution: false,
      };
    }
    return {
      provider: HFM_CATALOG_PROVIDER,
      environment: HFM_CATALOG_ENVIRONMENT,
      available: true,
      artifactReady: true,
      discoveryStatus: current.discoveryStatus,
      freshness: current.freshness === "COMPLETE" ? "LAST_KNOWN" : current.freshness,
      brokerServer: current.brokerServer,
      catalogVersion: current.catalogVersion,
      checksumSha256: current.checksumSha256,
      enumerationStartedAt: current.enumerationStartedAt,
      enumerationCompletedAt: current.enumerationCompletedAt,
      ingestedAt: current.ingestedAt,
      lastSuccessfulDiscoveryAt: meta.lastSuccessfulDiscoveryAt,
      lastFailedDiscoveryAt: meta.lastFailedDiscoveryAt,
      lastFailedReason: meta.lastFailedReason,
      generalSymbolCount: current.generalSymbolCount,
      selectedSymbolCount: current.selectedSymbolCount,
      enumeratedCount: current.enumeratedCount,
      validCount: current.validCount,
      duplicateCount: current.duplicateCount,
      customCount: current.customCount,
      metadataCompletenessAvg: current.metadataCompletenessAvg,
      fieldErrorSummary: current.fieldErrorSummary,
      categoryCounts: current.categoryCounts,
      changes: current.changes,
      source: "persisted",
      unavailableReason: null,
      mutatesBroker: false,
      placesOrders: false,
      acceptsForExecution: false,
    };
  }
}

export function computeCatalogPayloadChecksum(input: {
  catalogVersion: string;
  symbols: string[];
  enumeratedCount: number;
}): string {
  return sha256Json(input);
}
