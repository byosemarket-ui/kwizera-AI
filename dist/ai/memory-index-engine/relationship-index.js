import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { MemoryStorageType } from "../memory-storage-engine/types.js";
const GRAPH_VERSION = "0.1.0";
export class RelationshipIndex {
    logger;
    graphPath = "";
    graph = {
        version: GRAPH_VERSION,
        lastUpdated: new Date().toISOString(),
        nodes: {},
        edgeCount: 0,
    };
    constructor(logger) {
        this.logger = logger;
    }
    initialize(indexesDir) {
        this.graphPath = path.join(indexesDir, "relationships.json");
        if (fs.existsSync(this.graphPath)) {
            this.graph = JSON.parse(fs.readFileSync(this.graphPath, "utf8"));
        }
        else {
            this.persist();
        }
    }
    buildFromRecord(record, allIds) {
        const relatedIds = [];
        for (const id of allIds) {
            if (id === record.memoryId)
                continue;
            if (this.isRelated(record, id)) {
                relatedIds.push(id);
            }
        }
        const node = {
            memoryId: record.memoryId,
            memoryType: record.memoryType,
            relatedIds,
            projects: record.memoryType === MemoryStorageType.Project ? [record.memoryId] : record.relatedProject ? [record.relatedProject] : [],
            products: record.memoryType === MemoryStorageType.Product ? [record.memoryId] : [],
            videos: record.memoryType === MemoryStorageType.Video ? [record.memoryId] : [],
            marketing: record.memoryType === MemoryStorageType.Marketing ? [record.memoryId] : [],
            learning: record.memoryType === MemoryStorageType.Learning ? [record.memoryId] : [],
            knowledge: record.memoryType === MemoryStorageType.Knowledge ? [record.memoryId] : [],
            workflows: record.relatedWorkflow ? [record.relatedWorkflow] : [],
            decisions: record.memoryType === MemoryStorageType.Decision ? [record.memoryId] : [],
            reasoning: record.memoryType === MemoryStorageType.Reasoning ? [record.memoryId] : [],
            strength: relatedIds.length * 10,
        };
        this.graph.nodes[record.memoryId] = node;
        this.graph.edgeCount = Object.values(this.graph.nodes).reduce((sum, n) => sum + n.relatedIds.length, 0);
        this.graph.lastUpdated = new Date().toISOString();
        this.persist();
        this.logger.log("debug", "relationship", "Relationship node updated", {
            memoryId: record.memoryId,
            related: relatedIds.length,
        });
        return node;
    }
    removeNode(memoryId) {
        delete this.graph.nodes[memoryId];
        for (const node of Object.values(this.graph.nodes)) {
            node.relatedIds = node.relatedIds.filter((id) => id !== memoryId);
        }
        this.graph.edgeCount = Object.values(this.graph.nodes).reduce((sum, n) => sum + n.relatedIds.length, 0);
        this.persist();
    }
    getRelated(memoryId) {
        return this.graph.nodes[memoryId]?.relatedIds ?? [];
    }
    getGraph() {
        return this.graph;
    }
    clear() {
        this.graph = {
            version: GRAPH_VERSION,
            lastUpdated: new Date().toISOString(),
            nodes: {},
            edgeCount: 0,
        };
        this.persist();
    }
    isRelated(record, otherId) {
        if (record.relatedProject && otherId.includes(record.relatedProject))
            return true;
        if (record.relatedWorkflow && otherId.includes(record.relatedWorkflow))
            return true;
        for (const tag of record.tags) {
            if (otherId.toLowerCase().includes(tag.toLowerCase()))
                return true;
        }
        return false;
    }
    persist() {
        const content = JSON.stringify(this.graph, null, 2);
        fs.writeFileSync(this.graphPath, content, "utf8");
        const hash = crypto.createHash("sha256").update(content).digest("hex");
        fs.writeFileSync(`${this.graphPath}.sha256`, hash, "utf8");
    }
    verifyChecksum() {
        const checksumFile = `${this.graphPath}.sha256`;
        if (!fs.existsSync(this.graphPath) || !fs.existsSync(checksumFile))
            return false;
        const content = fs.readFileSync(this.graphPath, "utf8");
        const expected = fs.readFileSync(checksumFile, "utf8").trim();
        const actual = crypto.createHash("sha256").update(content).digest("hex");
        return expected === actual;
    }
}
//# sourceMappingURL=relationship-index.js.map