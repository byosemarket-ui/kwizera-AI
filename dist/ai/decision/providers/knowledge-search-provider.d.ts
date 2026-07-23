import { KnowledgeSearchResult } from "../types.js";
export interface KnowledgeSearchProvider {
    search(query: string, context: Record<string, unknown>): Promise<KnowledgeSearchResult>;
}
/** Stub provider — Knowledge Engine not implemented until later phase */
export declare class StubKnowledgeSearchProvider implements KnowledgeSearchProvider {
    search(query: string, _context: Record<string, unknown>): Promise<KnowledgeSearchResult>;
}
//# sourceMappingURL=knowledge-search-provider.d.ts.map