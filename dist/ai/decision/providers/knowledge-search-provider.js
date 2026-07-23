/** Stub provider — Knowledge Engine not implemented until later phase */
export class StubKnowledgeSearchProvider {
    async search(query, _context) {
        return {
            found: false,
            items: [],
            message: `Knowledge Engine not yet available. Query preserved: "${query.slice(0, 80)}"`,
        };
    }
}
//# sourceMappingURL=knowledge-search-provider.js.map