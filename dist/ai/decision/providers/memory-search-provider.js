/** Stub provider — Memory Engine not implemented until later phase */
export class StubMemorySearchProvider {
    async search(query, _context) {
        return {
            found: false,
            items: [],
            message: `Memory Engine not yet available. Query preserved: "${query.slice(0, 80)}"`,
        };
    }
}
//# sourceMappingURL=memory-search-provider.js.map