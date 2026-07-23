import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeGraphStore } from "./knowledge-graph-store.js";
import { KnowledgeGraphLogger } from "./graph-logger.js";
import { KnowledgeGraphDiscoveryResult } from "./types.js";
export declare class KnowledgeGraphDiscovery {
    private readonly foundation;
    private readonly graph;
    private readonly logger;
    constructor(foundation: AiKnowledgeFoundation, graph: KnowledgeGraphStore, logger: KnowledgeGraphLogger);
    discover(knowledgeId?: string): Promise<KnowledgeGraphDiscoveryResult>;
    private discoverExplicitLinks;
    private discoverMemoryLinks;
    private discoverTagLinks;
    private discoverTypeAffinity;
    private discoverTopicLinks;
}
//# sourceMappingURL=knowledge-graph-discovery.d.ts.map