/**
 * Persist simulation-only positions (never broker IDs).
 */
import fs from "node:fs";
import path from "node:path";
import { resolveStorageRoot } from "../../../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomic } from "../../../../storage/safe-json.js";
import type { SimPosition } from "./simulation-lifecycle.js";

const MAX = 50;

interface FileShape {
  schemaVersion: "at-sim-lifecycle-v1";
  positions: SimPosition[];
}

function filePath(storageRoot?: string): string {
  return path.join(
    storageRoot ?? resolveStorageRoot(),
    "forex-automated-trading",
    "simulation-positions.json",
  );
}

function normalize(raw: unknown): FileShape {
  const empty: FileShape = { schemaVersion: "at-sim-lifecycle-v1", positions: [] };
  if (!raw || typeof raw !== "object") return empty;
  const o = raw as Record<string, unknown>;
  const positions = Array.isArray(o.positions)
    ? (o.positions as SimPosition[])
      .filter((p) => p && typeof p === "object" && typeof p.simulationPositionId === "string")
      .slice(0, MAX)
    : [];
  return { schemaVersion: "at-sim-lifecycle-v1", positions };
}

export class AtSimLifecycleStore {
  private data: FileShape;
  private readonly file: string;

  constructor(storageRoot?: string) {
    this.file = filePath(storageRoot);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    this.data = normalize(readJsonSafeSync(this.file, null).value);
  }

  list(): SimPosition[] {
    return [...this.data.positions];
  }

  get(id: string): SimPosition | null {
    return this.data.positions.find((p) => p.simulationPositionId === id) ?? null;
  }

  async upsert(position: SimPosition): Promise<SimPosition> {
    const idx = this.data.positions.findIndex(
      (p) => p.simulationPositionId === position.simulationPositionId,
    );
    if (idx >= 0) this.data.positions[idx] = position;
    else this.data.positions.unshift(position);
    this.data.positions = this.data.positions.slice(0, MAX);
    await writeJsonAtomic(this.file, this.data);
    return position;
  }

  /** Prevent duplicate open positions for the same draft. */
  findOpenByDraft(draftId: string): SimPosition | null {
    return (
      this.data.positions.find(
        (p) =>
          p.sourceDraftId === draftId
          && (p.state === "SIMULATED_OPEN"
            || p.state === "MONITORING"
            || p.state === "STALE_INTERRUPTED"
            || p.state === "EXIT_TRIGGERED"),
      ) ?? null
    );
  }
}

let singleton: AtSimLifecycleStore | null = null;

export function getAtSimLifecycleStore(storageRoot?: string): AtSimLifecycleStore {
  if (storageRoot) return new AtSimLifecycleStore(storageRoot);
  if (!singleton) singleton = new AtSimLifecycleStore();
  return singleton;
}

export function resetAtSimLifecycleStoreForTests(): void {
  singleton = null;
}
