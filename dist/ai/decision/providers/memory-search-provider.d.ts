import { MemorySearchResult } from "../types.js";
export interface MemorySearchProvider {
    search(query: string, context: Record<string, unknown>): Promise<MemorySearchResult>;
}
/** Stub provider — Memory Engine not implemented until later phase */
export declare class StubMemorySearchProvider implements MemorySearchProvider {
    search(query: string, _context: Record<string, unknown>): Promise<MemorySearchResult>;
}
//# sourceMappingURL=memory-search-provider.d.ts.map