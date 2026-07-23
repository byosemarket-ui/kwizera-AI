const REQUIRED_STRING_FIELDS = [
    "knowledgeId",
    "knowledgeType",
    "category",
    "title",
    "description",
    "source",
];
export class KnowledgeStructureValidator {
    validate(record) {
        const issues = [];
        const warnings = [];
        for (const field of REQUIRED_STRING_FIELDS) {
            const value = record[field];
            if (typeof value !== "string" || value.trim() === "") {
                issues.push(`Missing or empty required field: ${field}`);
            }
        }
        if (!Array.isArray(record.tags)) {
            issues.push("Tags must be an array");
        }
        if (!Array.isArray(record.keywords)) {
            issues.push("Keywords must be an array");
        }
        if (!record.classification) {
            issues.push("Classification metadata is required");
        }
        if (record.title.length > 500) {
            issues.push("Title exceeds maximum length (500)");
        }
        if (record.description.length < 10) {
            warnings.push("Description is very short — completeness may be low");
        }
        if (!record.summary || record.summary.length < 5) {
            warnings.push("Summary is missing or too short");
        }
        if (record.version < 1) {
            issues.push("Invalid version number");
        }
        return { valid: issues.length === 0, issues, warnings };
    }
}
//# sourceMappingURL=knowledge-structure-validator.js.map