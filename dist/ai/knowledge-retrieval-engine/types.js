/**
 * KWIZERA AI STUDIO — Knowledge Retrieval Engine types (Step 4C)
 */
export var KnowledgeSearchMode;
(function (KnowledgeSearchMode) {
    KnowledgeSearchMode["Exact"] = "exact";
    KnowledgeSearchMode["Semantic"] = "semantic";
    KnowledgeSearchMode["Keyword"] = "keyword";
    KnowledgeSearchMode["Category"] = "category";
    KnowledgeSearchMode["Relationship"] = "relationship";
    KnowledgeSearchMode["Hybrid"] = "hybrid";
    KnowledgeSearchMode["Context"] = "context";
    KnowledgeSearchMode["Priority"] = "priority";
    KnowledgeSearchMode["Recommendation"] = "recommendation";
})(KnowledgeSearchMode || (KnowledgeSearchMode = {}));
export class KnowledgeRetrievalEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "KnowledgeRetrievalEngineError";
    }
}
//# sourceMappingURL=types.js.map