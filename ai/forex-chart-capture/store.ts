/**
 * Phase 49A — Bounded filesystem persistence for chart captures.
 * Meta in store.json; PNG bytes under images/{captureId}.png.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveStorageRoot } from "../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomic } from "../../storage/safe-json.js";
import {
  CAPTURE_LIST_DEFAULT_LIMIT,
  CAPTURE_LIST_MAX_LIMIT,
  CAPTURE_MAX_STORED,
  CHART_CAPTURE_SCHEMA_VERSION,
} from "./limits.js";
import type {
  ChartCaptureListItem,
  ChartCaptureRecord,
  ChartCaptureSessionState,
  CreateCaptureInput,
} from "./types.js";
import type { CaptureTimeframeId } from "./limits.js";

interface StoreFile {
  version: 1;
  schemaVersion: string;
  captures: ChartCaptureRecord[];
  sessions: ChartCaptureSessionState[];
}

const EMPTY: StoreFile = {
  version: 1,
  schemaVersion: CHART_CAPTURE_SCHEMA_VERSION,
  captures: [],
  sessions: [],
};

export class ChartCaptureStore {
  private readonly rootDir: string;
  private readonly imagesDir: string;
  private readonly storePath: string;
  private ready = false;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(storageRoot?: string) {
    this.rootDir = path.join(storageRoot ?? resolveStorageRoot(), "forex-chart-captures");
    this.imagesDir = path.join(this.rootDir, "images");
    this.storePath = path.join(this.rootDir, "store.json");
  }

  get root(): string {
    return this.rootDir;
  }

  async ensureReady(): Promise<void> {
    if (this.ready) return;
    fs.mkdirSync(this.imagesDir, { recursive: true });
    if (!fs.existsSync(this.storePath)) {
      await writeJsonAtomic(this.storePath, EMPTY);
    }
    this.ready = true;
  }

  private readFile(): StoreFile {
    const result = readJsonSafeSync<StoreFile>(this.storePath, EMPTY);
    const value = result.value ?? EMPTY;
    return {
      version: 1,
      schemaVersion: CHART_CAPTURE_SCHEMA_VERSION,
      captures: Array.isArray(value.captures) ? value.captures : [],
      sessions: Array.isArray(value.sessions) ? value.sessions : [],
    };
  }

  private imagePath(captureId: string): string {
    return path.join(this.imagesDir, `${captureId}.png`);
  }

  async create(input: CreateCaptureInput, imageBuffer: Buffer): Promise<ChartCaptureRecord> {
    const captureId = randomUUID();
    const now = new Date().toISOString();
    const record: ChartCaptureRecord = {
      schemaVersion: CHART_CAPTURE_SCHEMA_VERSION,
      captureId,
      capturedAtUtc: input.capturedAtUtc,
      capturedAtLocal: input.capturedAtLocal,
      mode: input.mode,
      status: "STORED",
      instrument: input.instrument,
      timeframe: input.timeframe as CaptureTimeframeId,
      chartRange: input.chartRange ?? {
        visibleFromSec: null,
        visibleToSec: null,
        logicalFrom: null,
        logicalTo: null,
      },
      candleWindow: input.candleWindow,
      quote: input.quote,
      marketSnapshot: input.marketSnapshot ?? { snapshotId: null, contentFingerprint: null },
      image: {
        mimeType: "image/png",
        width: input.width,
        height: input.height,
        byteLength: imageBuffer.length,
        fileName: `${captureId}.png`,
      },
      sessionId: input.sessionId ?? null,
      error: null,
      ownershipScope: "studio",
      selectedForAi: false,
      createdAt: now,
    };

    const run = this.writeChain.then(async () => {
      await this.ensureReady();
      fs.writeFileSync(this.imagePath(captureId), imageBuffer);
      const store = this.readFile();
      store.captures.push(record);
      while (store.captures.length > CAPTURE_MAX_STORED) {
        const removed = store.captures.shift();
        if (removed) {
          try {
            fs.unlinkSync(this.imagePath(removed.captureId));
          } catch {
            /* missing image is fine */
          }
        }
      }
      await writeJsonAtomic(this.storePath, store);
    });
    this.writeChain = run.then(() => undefined, () => undefined);
    await run;
    return record;
  }

  async get(captureId: string): Promise<ChartCaptureRecord | null> {
    await this.ensureReady();
    const id = String(captureId ?? "").trim();
    if (!id) return null;
    return this.readFile().captures.find((c) => c.captureId === id) ?? null;
  }

  async getImage(captureId: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const meta = await this.get(captureId);
    if (!meta) return null;
    const p = this.imagePath(meta.captureId);
    if (!fs.existsSync(p)) return null;
    return { buffer: fs.readFileSync(p), mimeType: meta.image.mimeType };
  }

  async list(opts?: {
    limit?: number;
    instrument?: string;
    timeframe?: string;
    sessionId?: string;
    mode?: string;
    fromUtc?: string;
    toUtc?: string;
  }): Promise<ChartCaptureListItem[]> {
    await this.ensureReady();
    const limit = Math.max(
      1,
      Math.min(CAPTURE_LIST_MAX_LIMIT, opts?.limit ?? CAPTURE_LIST_DEFAULT_LIMIT),
    );
    let items = [...this.readFile().captures].reverse();
    if (opts?.instrument) {
      const sym = opts.instrument.toUpperCase();
      items = items.filter((c) => c.instrument.symbol.toUpperCase() === sym
        || c.instrument.displaySymbol.toUpperCase() === sym);
    }
    if (opts?.timeframe) {
      items = items.filter((c) => c.timeframe === opts.timeframe);
    }
    if (opts?.sessionId) {
      items = items.filter((c) => c.sessionId === opts.sessionId);
    }
    if (opts?.mode) {
      const mode = opts.mode.toUpperCase();
      items = items.filter((c) => c.mode === mode);
    }
    if (opts?.fromUtc) {
      const from = Date.parse(opts.fromUtc);
      if (Number.isFinite(from)) {
        items = items.filter((c) => Date.parse(c.capturedAtUtc) >= from);
      }
    }
    if (opts?.toUtc) {
      const to = Date.parse(opts.toUtc);
      if (Number.isFinite(to)) {
        items = items.filter((c) => Date.parse(c.capturedAtUtc) <= to);
      }
    }
    return items.slice(0, limit).map((c) => ({
      ...c,
      hasImage: fs.existsSync(this.imagePath(c.captureId)),
    }));
  }

  async delete(captureId: string): Promise<boolean> {
    const id = String(captureId ?? "").trim();
    if (!id) return false;
    const run = this.writeChain.then(async () => {
      await this.ensureReady();
      const store = this.readFile();
      const idx = store.captures.findIndex((c) => c.captureId === id);
      if (idx < 0) return false;
      store.captures.splice(idx, 1);
      try {
        fs.unlinkSync(this.imagePath(id));
      } catch {
        /* ok */
      }
      await writeJsonAtomic(this.storePath, store);
      return true;
    });
    this.writeChain = run.then(() => undefined, () => undefined);
    return run;
  }

  async setSelectedForAi(captureId: string, selected: boolean): Promise<ChartCaptureRecord | null> {
    const id = String(captureId ?? "").trim();
    if (!id) return null;
    let updated: ChartCaptureRecord | null = null;
    const run = this.writeChain.then(async () => {
      await this.ensureReady();
      const store = this.readFile();
      const item = store.captures.find((c) => c.captureId === id);
      if (!item) return;
      item.selectedForAi = Boolean(selected);
      updated = item;
      await writeJsonAtomic(this.storePath, store);
    });
    this.writeChain = run.then(() => undefined, () => undefined);
    await run;
    return updated;
  }

  async upsertSession(session: ChartCaptureSessionState): Promise<void> {
    const run = this.writeChain.then(async () => {
      await this.ensureReady();
      const store = this.readFile();
      const idx = store.sessions.findIndex((s) => s.sessionId === session.sessionId);
      if (idx >= 0) store.sessions[idx] = session;
      else store.sessions.push(session);
      // Keep only recent sessions
      if (store.sessions.length > 20) {
        store.sessions = store.sessions.slice(-20);
      }
      await writeJsonAtomic(this.storePath, store);
    });
    this.writeChain = run.then(() => undefined, () => undefined);
    await run;
  }

  async getSession(sessionId: string): Promise<ChartCaptureSessionState | null> {
    await this.ensureReady();
    return this.readFile().sessions.find((s) => s.sessionId === sessionId) ?? null;
  }

  async listSessions(limit = 10): Promise<ChartCaptureSessionState[]> {
    await this.ensureReady();
    return this.readFile().sessions.slice(-Math.max(1, Math.min(20, limit))).reverse();
  }
}

let singleton: ChartCaptureStore | null = null;

export function getChartCaptureStore(storageRoot?: string): ChartCaptureStore {
  if (storageRoot) return new ChartCaptureStore(storageRoot);
  if (!singleton) singleton = new ChartCaptureStore();
  return singleton;
}
