/**
 * KWIZERA AI STUDIO — Memory Retrieval Engine types (Step 3C)
 */
export var SearchMode;
(function (SearchMode) {
    SearchMode["Exact"] = "exact";
    SearchMode["Keyword"] = "keyword";
    SearchMode["Category"] = "category";
    SearchMode["Relationship"] = "relationship";
    SearchMode["Recent"] = "recent";
    SearchMode["Priority"] = "priority";
    SearchMode["History"] = "history";
    SearchMode["Hybrid"] = "hybrid";
})(SearchMode || (SearchMode = {}));
export var SearchField;
(function (SearchField) {
    SearchField["MemoryId"] = "memory-id";
    SearchField["Project"] = "project";
    SearchField["Product"] = "product";
    SearchField["Video"] = "video";
    SearchField["Marketing"] = "marketing";
    SearchField["Category"] = "category";
    SearchField["Tags"] = "tags";
    SearchField["Keywords"] = "keywords";
    SearchField["Date"] = "date";
    SearchField["Workflow"] = "workflow";
    SearchField["Decision"] = "decision";
    SearchField["Reasoning"] = "reasoning";
    SearchField["Language"] = "language";
    SearchField["UserPreference"] = "user-preference";
    SearchField["Related"] = "related";
})(SearchField || (SearchField = {}));
export class MemoryRetrievalEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "MemoryRetrievalEngineError";
    }
}
//# sourceMappingURL=types.js.map