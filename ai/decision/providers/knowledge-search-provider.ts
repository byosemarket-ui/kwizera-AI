import { KnowledgeSearchResult } from "../types.js";

export interface KnowledgeSearchProvider {
  search(query: string, context: Record<string, unknown>): Promise<KnowledgeSearchResult>;
}

/** Stub provider — Knowledge Engine not implemented until later phase */
export class StubKnowledgeSearchProvider implements KnowledgeSearchProvider {
  async search(query: string, _context: Record<string, unknown>): Promise<KnowledgeSearchResult> {
    return {
      found: false,
      items: [],
      message: `Knowledge Engine not yet available. Query preserved: "${query.slice(0, 80)}"`,
    };
  }
}
