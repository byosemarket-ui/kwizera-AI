import { MemorySearchResult } from "../types.js";

export interface MemorySearchProvider {
  search(query: string, context: Record<string, unknown>): Promise<MemorySearchResult>;
}

/** Stub provider — Memory Engine not implemented until later phase */
export class StubMemorySearchProvider implements MemorySearchProvider {
  async search(query: string, _context: Record<string, unknown>): Promise<MemorySearchResult> {
    return {
      found: false,
      items: [],
      message: `Memory Engine not yet available. Query preserved: "${query.slice(0, 80)}"`,
    };
  }
}
