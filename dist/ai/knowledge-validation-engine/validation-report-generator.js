import fs from "node:fs";
import path from "node:path";
export class ValidationReportGenerator {
    storageRoot;
    runner;
    integrityValidator;
    relationshipValidator;
    constructor(storageRoot, runner, integrityValidator, relationshipValidator) {
        this.storageRoot = storageRoot;
        this.runner = runner;
        this.integrityValidator = integrityValidator;
        this.relationshipValidator = relationshipValidator;
    }
    async generateAll(status) {
        const reportDir = path.join(this.storageRoot, "project-state");
        fs.mkdirSync(reportDir, { recursive: true });
        const results = this.runner.getAllResults();
        const integrity = await this.integrityValidator.validateAll();
        const relationships = await this.relationshipValidator.validateAll(false);
        const validationReportPath = path.join(reportDir, "Knowledge-Validation-Report.md");
        const qualityReportPath = path.join(reportDir, "Knowledge-Quality-Report.md");
        const integrityReportPath = path.join(reportDir, "Knowledge-Integrity-Report.md");
        fs.writeFileSync(validationReportPath, this.buildValidationReport(status, results, relationships), "utf8");
        fs.writeFileSync(qualityReportPath, this.buildQualityReport(results), "utf8");
        fs.writeFileSync(integrityReportPath, this.buildIntegrityReport(integrity, relationships), "utf8");
        return { validationReportPath, qualityReportPath, integrityReportPath };
    }
    buildValidationReport(status, results, relationships) {
        return [
            "# Knowledge Validation Report",
            "",
            `**Generated:** ${new Date().toISOString()}`,
            `**Engine Status:** ${status.engineStatus}`,
            `**Readiness Score:** ${status.readinessScore}/100`,
            "",
            "## Summary",
            "",
            `- Total validations: ${status.totalValidations}`,
            `- Trusted records: ${status.trustedCount}`,
            `- Rejected records: ${status.rejectedCount}`,
            `- Relationship validation: ${status.relationshipValidationStatus}`,
            "",
            "## Record Validation Results",
            "",
            "| Knowledge ID | Level | Trusted | Quality | Issues |",
            "|--------------|-------|---------|---------|--------|",
            ...results.map((r) => `| ${r.knowledgeId} | ${r.validationLevel} | ${r.trusted ? "yes" : "no"} | ${r.scores.qualityScore} | ${r.issues.length} |`),
            "",
            "## Relationship Validation",
            "",
            `- Relationships checked: ${relationships.relationshipsChecked}`,
            `- Broken references: ${relationships.brokenReferences}`,
            `- Orphan records: ${relationships.orphanRecords}`,
            "",
            "## Known Issues",
            "",
            ...(status.knownIssues.length > 0 ? status.knownIssues.map((i) => `- ${i}`) : ["- None"]),
            "",
        ].join("\n");
    }
    buildQualityReport(results) {
        const avg = (field) => results.length > 0
            ? Math.round(results.reduce((sum, r) => sum + r.scores[field], 0) / results.length)
            : 0;
        return [
            "# Knowledge Quality Report",
            "",
            `**Generated:** ${new Date().toISOString()}`,
            "",
            "## Aggregate Scores",
            "",
            "| Metric | Average |",
            "|--------|---------|",
            `| Quality Score | ${avg("qualityScore")} |`,
            `| Reliability Score | ${avg("reliabilityScore")} |`,
            `| Completeness Score | ${avg("completenessScore")} |`,
            `| Consistency Score | ${avg("consistencyScore")} |`,
            `| Confidence Score | ${avg("confidenceScore")} |`,
            "",
            "## Per-Record Quality",
            "",
            "| Knowledge ID | Quality | Reliability | Completeness | Consistency | Confidence | Level |",
            "|--------------|---------|-------------|--------------|-------------|------------|-------|",
            ...results.map((r) => `| ${r.knowledgeId} | ${r.scores.qualityScore} | ${r.scores.reliabilityScore} | ${r.scores.completenessScore} | ${r.scores.consistencyScore} | ${r.scores.confidenceScore} | ${r.validationLevel} |`),
            "",
        ].join("\n");
    }
    buildIntegrityReport(integrity, relationships) {
        return [
            "# Knowledge Integrity Report",
            "",
            `**Generated:** ${new Date().toISOString()}`,
            "",
            "## Storage Integrity",
            "",
            `- Valid: ${integrity.valid ? "yes" : "no"}`,
            `- Records checked: ${integrity.recordsChecked}`,
            `- Corrupted records: ${integrity.corruptedRecords}`,
            `- Checksum failures: ${integrity.checksumFailures}`,
            `- Version integrity failures: ${integrity.versionIntegrityFailures}`,
            "",
            "## Relationship Integrity",
            "",
            `- Valid: ${relationships.valid ? "yes" : "no"}`,
            `- Relationships checked: ${relationships.relationshipsChecked}`,
            `- Issues repaired: ${relationships.issuesRepaired}`,
            "",
            "## Diagnostics",
            "",
            ...(integrity.diagnostics.length > 0
                ? integrity.diagnostics.map((d) => `- ${d}`)
                : ["- No integrity issues detected"]),
            "",
        ].join("\n");
    }
}
//# sourceMappingURL=validation-report-generator.js.map