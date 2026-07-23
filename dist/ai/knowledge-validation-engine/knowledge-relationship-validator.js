export class KnowledgeRelationshipValidator {
    foundation;
    logger;
    constructor(foundation, logger) {
        this.foundation = foundation;
        this.logger = logger;
    }
    validateRecord(record) {
        const storage = this.foundation.getStorageEngine();
        const issues = [];
        const indexIds = new Set(storage.getIndexEntries().map((e) => e.knowledgeId));
        for (const relatedId of record.relatedKnowledge) {
            if (relatedId === record.knowledgeId) {
                issues.push("Self-referential related knowledge link");
            }
            else if (!indexIds.has(relatedId)) {
                issues.push(`Broken related knowledge reference: ${relatedId}`);
            }
        }
        const graph = this.foundation.getGraphEngine().getGraph();
        if (!graph.nodes[record.knowledgeId] &&
            record.status !== "archived" &&
            record.status !== "rejected") {
            issues.push("Knowledge record missing from relationship graph");
        }
        return { valid: issues.length === 0, issues };
    }
    async validateAll(repair = false) {
        const start = Date.now();
        const storage = this.foundation.getStorageEngine();
        const graphEngine = this.foundation.getGraphEngine();
        const diagnostics = [];
        let brokenReferences = 0;
        let orphanRecords = 0;
        const indexIds = new Set(storage.getIndexEntries().map((e) => e.knowledgeId));
        const graph = graphEngine.getGraph();
        for (const id of indexIds) {
            if (!graph.nodes[id]) {
                orphanRecords++;
                diagnostics.push(`Record not represented in graph: ${id}`);
            }
        }
        for (const nodeId of Object.keys(graph.nodes)) {
            const node = graph.nodes[nodeId];
            if (node?.knowledgeType && !indexIds.has(nodeId)) {
                orphanRecords++;
                diagnostics.push(`Orphan graph node without index entry: ${nodeId}`);
            }
        }
        for (const entry of storage.getIndexEntries()) {
            let read;
            try {
                read = await storage.getRecord(entry.knowledgeId, "knowledge-validation-engine");
            }
            catch {
                continue;
            }
            if (!read.record)
                continue;
            for (const relatedId of read.record.relatedKnowledge) {
                if (!indexIds.has(relatedId)) {
                    brokenReferences++;
                    diagnostics.push(`Broken reference ${relatedId} in ${entry.knowledgeId}`);
                }
            }
        }
        let issuesRepaired = 0;
        if (repair) {
            const integrity = graphEngine.validateIntegrity();
            issuesRepaired = integrity.issuesRepaired;
            diagnostics.push(...integrity.diagnostics.map((d) => d.detail));
        }
        const result = {
            valid: brokenReferences === 0 && orphanRecords === 0,
            relationshipsChecked: storage.getIndexEntries().length,
            brokenReferences,
            orphanRecords,
            issuesRepaired,
            diagnostics,
            durationMs: Date.now() - start,
        };
        this.logger.log("info", "relationship", "Relationship validation complete", {
            valid: result.valid,
            relationshipsChecked: result.relationshipsChecked,
            issuesRepaired,
        });
        return result;
    }
}
//# sourceMappingURL=knowledge-relationship-validator.js.map