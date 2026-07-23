/**
 * KWIZERA AI STUDIO — Relationship Memory Engine types (Step 3J)
 */
export var RelationshipType;
(function (RelationshipType) {
    RelationshipType["ParentChild"] = "parent-child";
    RelationshipType["Related"] = "related";
    RelationshipType["Similar"] = "similar";
    RelationshipType["Reference"] = "reference";
    RelationshipType["Dependency"] = "dependency";
    RelationshipType["Sequence"] = "sequence";
    RelationshipType["Version"] = "version";
    RelationshipType["Alternative"] = "alternative";
    RelationshipType["DerivedFrom"] = "derived-from";
    RelationshipType["InspiredBy"] = "inspired-by";
    RelationshipType["RecommendedWith"] = "recommended-with";
    RelationshipType["FrequentlyUsedTogether"] = "frequently-used-together";
})(RelationshipType || (RelationshipType = {}));
export var ValidationStatus;
(function (ValidationStatus) {
    ValidationStatus["Valid"] = "valid";
    ValidationStatus["Pending"] = "pending";
    ValidationStatus["Invalid"] = "invalid";
    ValidationStatus["Repaired"] = "repaired";
})(ValidationStatus || (ValidationStatus = {}));
export class RelationshipMemoryEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "RelationshipMemoryEngineError";
    }
}
//# sourceMappingURL=types.js.map