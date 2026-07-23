import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, CreativeStyle, ImageType, } from "../ai/index.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-image-knowledge-"));
}
const SAMPLE_LUXURY_PRODUCT = {
    imageId: "step4e-luxury-product",
    imagePath: "D:\\KWIZERA-AI-STUDIO\\samples\\images\\luxury-product-hero.png",
    imageName: "KWIZERA Luxury Product Hero",
    imageType: ImageType.Product,
    width: 2400,
    height: 3000,
    product: "KWIZERA Pro Studio",
    brandName: "KWIZERA",
    category: "software",
    language: "en",
    visual: {
        products: ["KWIZERA Pro Studio"],
        dominantColors: ["#1a1a2e", "#d4af37", "#ffffff"],
        background: "luxury-gradient",
        lighting: "dramatic-studio",
        composition: "rule-of-thirds",
        cameraAngle: "slight-low",
    },
    metrics: {
        sharpness: 92,
        brightness: 78,
        contrast: 85,
        compositionQuality: 88,
        noise: 8,
    },
    productPresentation: {
        position: "center",
        visibility: 95,
        focus: 94,
        angle: "three-quarter",
        branding: "KWIZERA",
    },
    design: {
        layout: "centered-hero",
        creativeStyle: CreativeStyle.Luxury,
        visualBalance: 90,
        typography: "serif-luxury",
    },
    brandInfo: {
        logoPosition: "top-left",
        brandColors: ["#1a1a2e", "#d4af37"],
        brandIdentity: "KWIZERA",
        brandConsistency: 92,
    },
    tags: ["luxury", "product", "validation", "kwizera"],
    keywords: ["product", "luxury", "studio"],
};
const SAMPLE_MINIMAL_COMMERCIAL = {
    imageId: "step4e-minimal-commercial",
    imagePath: "D:\\KWIZERA-AI-STUDIO\\samples\\images\\minimal-commercial-banner.png",
    imageName: "KWIZERA Minimal Commercial Banner",
    imageType: ImageType.Marketing,
    width: 1920,
    height: 1080,
    product: "KWIZERA Lite Studio",
    brandName: "KWIZERA",
    category: "marketing",
    design: {
        layout: "minimal-grid",
        creativeStyle: CreativeStyle.Minimal,
        visualBalance: 72,
    },
    metrics: {
        sharpness: 80,
        brightness: 60,
        compositionQuality: 65,
        noise: 15,
    },
    productPresentation: {
        visibility: 75,
        focus: 78,
    },
    brandInfo: {
        brandIdentity: "KWIZERA",
        brandConsistency: 70,
    },
    tags: ["minimal", "commercial", "validation"],
};
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    console.log("KWIZERA AI STUDIO — Step 4E Image Knowledge Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("step-4e-validation");
        const foundation = core.getManager().knowledgeFoundation;
        const engine = foundation.getImageKnowledgeEngine();
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: "Image Knowledge Engine operational",
        };
        const analysisStart = Date.now();
        const luxury = await engine.analyzeImage(SAMPLE_LUXURY_PRODUCT);
        const analysisMs = Date.now() - analysisStart;
        results.imageAnalysis = {
            passed: luxury.success && Boolean(luxury.record),
            detail: `Luxury product analyzed in ${analysisMs}ms, quality ${luxury.record?.scores.imageQualityScore}`,
        };
        results.productAnalysis = {
            passed: (luxury.record?.productPresentation.visibility ?? 0) >= 80,
            detail: `Visibility ${luxury.record?.productPresentation.visibility}, focus ${luxury.record?.productPresentation.focus}`,
        };
        results.brandRecognition = {
            passed: luxury.record?.brand.brandIdentity === "KWIZERA" && (luxury.record?.brand.brandConsistency ?? 0) >= 80,
            detail: `Brand ${luxury.record?.brand.brandIdentity}, consistency ${luxury.record?.brand.brandConsistency}`,
        };
        const commercial = await engine.analyzeImage(SAMPLE_MINIMAL_COMMERCIAL);
        results.qualityScoring = {
            passed: (luxury.record?.scores.imageQualityScore ?? 0) > (commercial.record?.scores.imageQualityScore ?? 0) &&
                (luxury.record?.scores.aiConfidenceScore ?? 0) >= 70,
            detail: `Luxury ${luxury.record?.scores.imageQualityScore} vs minimal ${commercial.record?.scores.imageQualityScore}`,
        };
        const relationships = engine.detectRelationships("step4e-luxury-product");
        results.relationshipDetection = {
            passed: Boolean(relationships && relationships.similarBrands.length + relationships.similarStyles.length >= 0),
            detail: `Similar brands ${relationships?.similarBrands.length ?? 0}, styles ${relationships?.similarStyles.length ?? 0}`,
        };
        if (commercial.success && relationships) {
            const updated = engine.detectRelationships("step4e-minimal-commercial");
            results.relationshipAfterSecond = {
                passed: Boolean(updated && updated.similarBrands.length >= 1),
                detail: `${updated?.similarBrands.length ?? 0} similar brand link(s)`,
            };
        }
        else {
            results.relationshipAfterSecond = { passed: false, detail: "second analysis failed" };
        }
        results.knowledgeStorage = {
            passed: Boolean(luxury.record?.knowledgeId) && foundation.getStorageEngine().findIndexEntry(luxury.record.knowledgeId) !== undefined,
            detail: luxury.record?.knowledgeId ?? "none",
        };
        const recs = engine.getRecommendations("step4e-minimal-commercial");
        results.recommendations = {
            passed: recs.length >= 1,
            detail: `${recs.length} recommendation(s), top: ${recs[0]?.category ?? "none"}`,
        };
        const searchStart = Date.now();
        const search = await engine.searchImages({ brand: "KWIZERA", minQuality: 70 });
        const searchMs = Date.now() - searchStart;
        results.search = {
            passed: search.length >= 1,
            detail: `${search.length} result(s) in ${searchMs}ms`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `image-knowledge-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        const invalid = await engine.analyzeImage({
            imagePath: "",
            imageName: "",
        });
        results.validationRejection = {
            passed: !invalid.success,
            detail: invalid.message ?? "rejected invalid input",
        };
        const report = engine.buildStatusReport();
        results.performance = {
            passed: analysisMs < 15000 && searchMs < 10000,
            detail: `analysis ${analysisMs}ms, search ${searchMs}ms`,
        };
        results.readiness = {
            passed: report.readinessScore === 100,
            detail: `Readiness ${report.readinessScore}/100`,
        };
        await core.stop("step-4e-validation-complete");
        const allPassed = Object.values(results).every((r) => r.passed);
        const reportPath = path.join(process.cwd(), "STEP-4E-VALIDATION-REPORT.md");
        fs.writeFileSync(reportPath, buildReport(report, results, storageRoot, allPassed), "utf8");
        console.log("Validation Results:");
        for (const [key, result] of Object.entries(results)) {
            console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
        }
        console.log("---");
        console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
        console.log(`Readiness Score: ${report.readinessScore}/100`);
        console.log("Report written:", reportPath);
        if (useTemp && fs.existsSync(storageRoot)) {
            fs.rmSync(storageRoot, { recursive: true, force: true });
        }
        process.exit(allPassed ? 0 : 1);
    }
    catch (error) {
        console.error("Validation failed:", error);
        process.exit(1);
    }
}
function buildReport(status, results, storageRoot, allPassed) {
    return [
        "# KWIZERA AI STUDIO — Phase 4 Step 4E Validation Report",
        "",
        "**Phase:** 4 — Knowledge Engine",
        "**Step:** 4E — Image Knowledge Engine",
        `**Date:** ${new Date().toISOString()}`,
        `**Storage root:** \`${storageRoot}\``,
        "**Assistant:** KWIZERA AI",
        "",
        "---",
        "",
        "## Image Knowledge Status",
        "",
        "| Field | Value |",
        "|-------|-------|",
        `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
        `| **Engine Status** | ${status.engineStatus} |`,
        `| **Readiness Score** | **${status.readinessScore}/100** |`,
        `| **Images Analyzed** | ${status.imagesAnalyzed} |`,
        `| **Patterns Learned** | ${status.patternsLearned} |`,
        "",
        "## Validation Results",
        "",
        "| Check | Status | Detail |",
        "|-------|--------|--------|",
        ...Object.entries(results).map(([key, r]) => `| ${key} | ${r.passed ? "✅ PASS" : "❌ FAIL"} | ${r.detail} |`),
        "",
        "## Visual Analysis Status",
        "",
        `- ${status.visualAnalysisStatus}`,
        `- Average quality score: ${status.averageQualityScore}`,
        "",
        "## Relationship Status",
        "",
        `- ${status.relationshipStatus}`,
        "",
        "## Performance",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        `| Average Analysis | ${status.performance.averageAnalysisMs}ms |`,
        `| Average Search | ${status.performance.averageSearchMs}ms |`,
        `| Average Recommendation | ${status.performance.averageRecommendationMs}ms |`,
        "",
        "## Known Issues",
        "",
        ...(status.knownIssues.length > 0
            ? status.knownIssues.map((i) => `- ${i}`)
            : ["- None"]),
        "",
        "---",
        "",
        "**KWIZERA AI** — Step 4E Image Knowledge Engine validation complete. Awaiting user approval before Step 4F.",
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-image-knowledge-engine.js.map