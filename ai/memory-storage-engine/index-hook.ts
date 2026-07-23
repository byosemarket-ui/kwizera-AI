import type { MemoryRecord } from "./types.js";

/** Hook for automatic indexing when memory records change */
export interface MemoryIndexHook {
  onRecordStored(record: MemoryRecord): void;
  onRecordUpdated(record: MemoryRecord): void;
  onRecordRemoved(memoryId: string): void;
}
