import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, KnowledgeProductCategory, KnowledgeProductMarketingGoal, } from "../ai/index.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-product-knowledge-"));
}
const SAMPLE_ELECTRONICS = {
    productId: "step4h-kwizera-pro",
    productName: "KWIZERA Pro Studio",
    category: KnowledgeProductCategory.Electronics,
    subcategory: "creative-workstation",
    brand: "KWIZERA",
    description: "Professional AI-powered creative workstation for marketing teams and studios",
    features: ["AI video generation", "brand consistency", "multi-platform export", "knowledge engine"],
    specifications: { cpu: "optimized", storage: "cloud-sync", license: "pro" },
    materials: ["aluminum", "premium-components"],
    colors: ["midnight-black", "studio-silver"],
    sizes: ["desktop"],
    price: 299.99,
    currency: "USD",
    targetAudience: "creative professionals and marketing teams",
    marketingGoal: KnowledgeProductMarketingGoal.Conversion,
    supplier: "KWIZERA Direct",
    brandKnowledge: { brandConsistency: 92 },
    visual: { productVisibility: 95, productQuality: 90 },
    marketing: {
        callToAction: "Start Free Trial — Create Smarter",
        uniqueSellingPoints: ["AI-powered", "brand-consistent", "all-in-one studio"],
        productPositioning: "Premium AI creative studio for professionals",
    },
    customer: {
        customerNeeds: ["faster production", "brand consistency", "professional output"],
        customerInterests: ["AI tools", "video marketing", "automation"],
        preferredPlatforms: ["instagram", "youtube", "website"],
    },
    tags: ["electronics", "kwizera", "validation", "campaign-launch"],
    keywords: ["AI studio", "creative workstation", "kwizera"],
};
const SAMPLE_FASHION = {
    productId: "step4h-kwizera-lite",
    productName: "KWIZERA Lite Headphones",
    category: KnowledgeProductCategory.Fashion,
    subcategory: "audio-accessories",
    brand: "KWIZERA",
    description: "Stylish wireless headphones for everyday creators",
    features: ["wireless", "noise-cancelling"],
    specifications: { battery: "20h" },
    colors: ["black"],
    price: 79.99,
    currency: "USD",
    targetAudience: "aspiring creators 18-30",
    marketingGoal: KnowledgeProductMarketingGoal.Awareness,
    brandKnowledge: { brandConsistency: 65 },
    visual: { productVisibility: 72, productQuality: 68 },
    customer: {
        customerNeeds: ["affordable quality", "portable"],
        customerInterests: ["music", "content creation"],
        preferredPlatforms: ["tiktok", "instagram"],
    },
    tags: ["fashion", "kwizera", "validation"],
};
const SAMPLE_BEAUTY = {
    productId: "step4h-beauty-serum",
    productName: "Radiance Vitamin C Serum",
    category: KnowledgeProductCategory.Beauty,
    subcategory: "skincare",
    brand: "GlowLab",
    description: "Premium vitamin C serum for radiant skin",
    features: ["vitamin-c", "anti-aging", "hydrating"],
    specifications: { volume: "30ml", spf: "none" },
    materials: ["glass-bottle", "serum-formula"],
    colors: ["amber"],
    price: 45.0,
    currency: "USD",
    targetAudience: "beauty enthusiasts 25-40",
    marketingGoal: KnowledgeProductMarketingGoal.Conversion,
    brandKnowledge: { brandConsistency: 88 },
    visual: { productVisibility: 92, productQuality: 88 },
    tags: ["beauty", "validation", "skincare"],
};
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    console.log("KWIZERA AI STUDIO — Step 4H Product Knowledge Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("step-4h-validation");
        const engine = core.getManager().knowledgeFoundation.getProductKnowledgeEngine();
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: "Product Knowledge Engine operational",
        };
        const analysisStart = Date.now();
        const electronics = await engine.analyzeProduct(SAMPLE_ELECTRONICS);
        const analysisMs = Date.now() - analysisStart;
        results.productAnalysis = {
            passed: electronics.success && Boolean(electronics.record),
            detail: `Electronics analyzed in ${analysisMs}ms, quality ${electronics.record?.scores.productQualityScore}`,
        };
        results.categoryUnderstanding = {
            passed: electronics.record?.profile.category === KnowledgeProductCategory.Electronics,
            detail: `${electronics.record?.profile.category}/${electronics.record?.profile.subcategory}`,
        };
        results.brandUnderstanding = {
            passed: (electronics.record?.brand.brandConsistency ?? 0) >= 80,
            detail: `Brand ${electronics.record?.profile.brand}, consistency ${electronics.record?.brand.brandConsistency}`,
        };
        results.marketingUnderstanding = {
            passed: (electronics.record?.scores.marketingReadinessScore ?? 0) >= 70,
            detail: `Marketing readiness ${electronics.record?.scores.marketingReadinessScore}`,
        };
        const fashion = await engine.analyzeProduct(SAMPLE_FASHION);
        const beauty = await engine.analyzeProduct(SAMPLE_BEAUTY);
        results.multiCategory = {
            passed: fashion.success && beauty.success,
            detail: `Fashion ${fashion.record?.profile.category}, Beauty ${beauty.record?.profile.category}`,
        };
        results.qualityScoring = {
            passed: (electronics.record?.scores.productQualityScore ?? 0) >
                (fashion.record?.scores.productQualityScore ?? 0),
            detail: `Electronics ${electronics.record?.scores.productQualityScore} vs fashion ${fashion.record?.scores.productQualityScore}`,
        };
        const rels = engine.detectRelationships("step4h-kwizera-pro");
        results.relationshipDetection = {
            passed: (rels?.relatedProducts.length ?? 0) >= 1,
            detail: `Related products ${rels?.relatedProducts.length}, brands ${rels?.relatedBrands.length}`,
        };
        results.knowledgeStorage = {
            passed: electronics.record?.knowledgeId === "product-knowledge-step4h-kwizera-pro",
            detail: electronics.record?.knowledgeId ?? "missing",
        };
        const recs = engine.getRecommendations("step4h-kwizera-lite");
        results.recommendations = {
            passed: recs.length > 0,
            detail: `${recs.length} recommendation(s), top: ${recs[0]?.category ?? "none"}`,
        };
        const searchStart = Date.now();
        const search = await engine.searchProducts({ brand: "KWIZERA" });
        const searchMs = Date.now() - searchStart;
        results.search = {
            passed: search.length >= 2,
            detail: `${search.length} result(s) in ${searchMs}ms`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `product-knowledge-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        const invalid = await engine.analyzeProduct({ productName: "", brand: "" });
        results.validationRejection = {
            passed: !invalid.success,
            detail: invalid.message ?? "rejected",
        };
        const lowQuality = await engine.analyzeProduct({
            productName: "Bad Product",
            brand: "Unknown Brand",
            features: [],
            visual: { productVisibility: 20, productQuality: 20 },
            brandKnowledge: { brandConsistency: 20 },
            marketing: { callToAction: "", uniqueSellingPoints: [] },
            customer: { customerNeeds: [], customerInterests: [], preferredPlatforms: [] },
        });
        results.lowQualityRejection = {
            passed: !lowQuality.success,
            detail: lowQuality.message ?? "rejected",
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
        await core.stop("step-4h-validation-complete");
        const allPassed = Object.values(results).every((r) => r.passed);
        const reportPath = path.join(process.cwd(), "STEP-4H-VALIDATION-REPORT.md");
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
        "# KWIZERA AI STUDIO — Phase 4 Step 4H Validation Report",
        "",
        "**Phase:** 4 — Knowledge Engine",
        "**Step:** 4H — Product Knowledge Engine",
        `**Date:** ${new Date().toISOString()}`,
        `**Storage root:** \`${storageRoot}\``,
        "**Assistant:** KWIZERA AI",
        "",
        "---",
        "",
        "## Product Knowledge Status",
        "",
        "| Field | Value |",
        "|-------|-------|",
        `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
        `| **Engine Status** | ${status.engineStatus} |`,
        `| **Readiness Score** | **${status.readinessScore}/100** |`,
        `| **Products Analyzed** | ${status.productsAnalyzed} |`,
        `| **Patterns Learned** | ${status.patternsLearned} |`,
        "",
        "## Validation Results",
        "",
        "| Check | Status | Detail |",
        "|-------|--------|--------|",
        ...Object.entries(results).map(([key, r]) => `| ${key} | ${r.passed ? "✅ PASS" : "❌ FAIL"} | ${r.detail} |`),
        "",
        "## Category Analysis Status",
        "",
        `- ${status.categoryAnalysisStatus}`,
        "",
        "## Brand Knowledge Status",
        "",
        `- ${status.brandKnowledgeStatus}`,
        "",
        "## Recommendation Quality",
        "",
        `- ${status.recommendationQuality}`,
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
        "**KWIZERA AI** — Step 4H Product Knowledge Engine validation complete. Awaiting user approval before Step 4I.",
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-product-knowledge-engine.js.map