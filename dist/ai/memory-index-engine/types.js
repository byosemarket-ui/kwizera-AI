/**
 * KWIZERA AI STUDIO — Memory Index Engine types (Step 3D)
 */
export var IndexType;
(function (IndexType) {
    IndexType["MemoryId"] = "memory-id";
    IndexType["Project"] = "project";
    IndexType["Product"] = "product";
    IndexType["Video"] = "video";
    IndexType["Marketing"] = "marketing";
    IndexType["Category"] = "category";
    IndexType["Brand"] = "brand";
    IndexType["Tags"] = "tags";
    IndexType["Keywords"] = "keywords";
    IndexType["Language"] = "language";
    IndexType["Workflow"] = "workflow";
    IndexType["Decision"] = "decision";
    IndexType["Reasoning"] = "reasoning";
    IndexType["Date"] = "date";
    IndexType["FileType"] = "file-type";
    IndexType["AiModule"] = "ai-module";
    IndexType["UserPreferences"] = "user-preferences";
    IndexType["Related"] = "related";
})(IndexType || (IndexType = {}));
export var IndexSearchMode;
(function (IndexSearchMode) {
    IndexSearchMode["Exact"] = "exact";
    IndexSearchMode["Keyword"] = "keyword";
    IndexSearchMode["Category"] = "category";
    IndexSearchMode["Relationship"] = "relationship";
    IndexSearchMode["Recent"] = "recent";
    IndexSearchMode["Hybrid"] = "hybrid";
    IndexSearchMode["Priority"] = "priority";
    IndexSearchMode["Similarity"] = "similarity";
})(IndexSearchMode || (IndexSearchMode = {}));
export class MemoryIndexEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "MemoryIndexEngineError";
    }
}
//# sourceMappingURL=types.js.map