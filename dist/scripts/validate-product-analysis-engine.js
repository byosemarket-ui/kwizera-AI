import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, ProductAnalysisCategory, ProductAnalysisIndustry, ProductAvailabilityStatus, ProductBusinessType, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-product-analysis-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_ELECTRONICS = {
    productId: "step5b-kwizera-pro",
    productName: "KWIZERA Pro Studio",
    category: ProductAnalysisCategory.Software,
    subcategory: "creative-workstation",
    brand: "KWIZERA",
    model: "KWP-PRO-2026",
    sku: "KWZ-PRO-STUDIO-001",
    description: "Professional AI-powered creative workstation for marketing teams and studios with full pipeline support",
    features: ["AI video generation", "brand consistency", "multi-platform export", "knowledge engine"],
    specifications: { cpu: "optimized", storage: "cloud-sync", license: "pro" },
    materials: ["digital-license", "cloud-infrastructure"],
    dimensions: "cloud-native",
    weight: "n/a",
    colors: ["midnight-black"],
    sizes: ["enterprise"],
    packaging: "digital-license",
    countryOfOrigin: "US",
    supplier: "KWIZERA Direct",
    price: 299.99,
    currency: "USD",
    availability: ProductAvailabilityStatus.InStock,
    industry: ProductAnalysisIndustry.Technology,
    useCase: "creative-production",
    targetCustomer: "creative professionals and marketing teams",
    businessType: ProductBusinessType.B2B,
    visual: { productVisibility: 95, productQuality: 92, productImages: ["hero-front.png"] },
    tags: ["software", "kwizera", "validation"],
    keywords: ["AI studio", "creative workstation", "kwizera"],
};
const SAMPLE_FASHION = {
    productId: "step5b-kwizera-jacket",
    productName: "KWIZERA Urban Jacket",
    category: ProductAnalysisCategory.Fashion,
    subcategory: "outerwear",
    brand: "KWIZERA",
    model: "KWJ-URBAN-01",
    sku: "KWZ-JKT-BLK-M",
    description: "Premium urban jacket designed for creators on the move with weather-resistant materials",
    features: ["water-resistant", "breathable", "minimal branding"],
    specifications: { fabric: "cotton-blend", lining: "soft-fleece" },
    materials: ["cotton", "polyester"],
    dimensions: "M standard fit",
    weight: "0.8kg",
    colors: ["black", "navy"],
    sizes: ["S", "M", "L", "XL"],
    packaging: "branded-hanger-bag",
    countryOfOrigin: "IT",
    supplier: "KWIZERA Apparel",
    price: 129.99,
    currency: "USD",
    availability: ProductAvailabilityStatus.InStock,
    industry: ProductAnalysisIndustry.Fashion,
    businessType: ProductBusinessType.D2C,
    tags: ["fashion", "kwizera", "validation"],
    keywords: ["jacket", "urban", "kwizera"],
};
const SAMPLE_BEAUTY = {
    productId: "step5b-glow-serum",
    productName: "Radiance Vitamin C Serum",
    category: ProductAnalysisCategory.Beauty,
    subcategory: "skincare",
    brand: "GlowLab",
    model: "GL-VC-30",
    sku: "GL-SERUM-30ML",
    description: "Premium vitamin C serum for radiant skin with clinical-grade formulation",
    features: ["vitamin-c", "anti-aging", "hydrating"],
    specifications: { volume: "30ml", concentration: "15%" },
    materials: ["glass-bottle", "serum-formula"],
    dimensions: "30ml bottle",
    weight: "0.15kg",
    colors: ["amber"],
    sizes: ["30ml"],
    packaging: "premium-box",
    countryOfOrigin: "FR",
    supplier: "GlowLab Paris",
    price: 45.0,
    currency: "USD",
    availability: ProductAvailabilityStatus.InStock,
    industry: ProductAnalysisIndustry.Beauty,
    tags: ["beauty", "validation", "skincare"],
    keywords: ["serum", "vitamin-c", "glowlab"],
};
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 5B Product Analysis Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("step-5b-validation");
        const engine = core.getManager().productIntelligenceFoundation.getProductAnalysisEngine();
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: "Product Analysis Engine operational",
        };
        const analysisStart = Date.now();
        const electronics = await engine.analyzeProduct(SAMPLE_ELECTRONICS);
        const analysisMs = Date.now() - analysisStart;
        results.productAnalysis = {
            passed: electronics.success && Boolean(electronics.record),
            detail: `Electronics analyzed in ${analysisMs}ms, completeness ${electronics.record?.scores.completenessScore}`,
        };
        results.classification = {
            passed: electronics.record?.classification.industry === ProductAnalysisIndustry.Technology &&
                electronics.record?.classification.category === ProductAnalysisCategory.Software,
            detail: `${electronics.record?.classification.industry}/${electronics.record?.classification.category}/${electronics.record?.classification.subcategory}`,
        };
        results.completenessScoring = {
            passed: (electronics.record?.scores.completenessScore ?? 0) >= 60,
            detail: `Completeness ${electronics.record?.scores.completenessScore}, data quality ${electronics.record?.scores.dataQualityScore}`,
        };
        results.qualityScores = {
            passed: (electronics.record?.scores.marketingReadinessScore ?? 0) >= 50 &&
                (electronics.record?.scores.analysisConfidenceScore ?? 0) >= 55,
            detail: `Marketing ${electronics.record?.scores.marketingReadinessScore}, confidence ${electronics.record?.scores.analysisConfidenceScore}`,
        };
        const fashion = await engine.analyzeProduct(SAMPLE_FASHION);
        const beauty = await engine.analyzeProduct(SAMPLE_BEAUTY);
        results.multiIndustry = {
            passed: fashion.success && beauty.success,
            detail: `Fashion ${fashion.record?.classification.industry}, Beauty ${beauty.record?.classification.industry}`,
        };
        results.relationshipDetection = {
            passed: (fashion.record?.relationships.relatedProducts.length ?? 0) >= 1,
            detail: `Fashion linked to ${fashion.record?.relationships.relatedProducts.length} related product(s), brands: ${fashion.record?.relationships.relatedBrands.join(", ")}`,
        };
        const incomplete = await engine.analyzeProduct({ productId: "step5b-incomplete", productName: "Incomplete" });
        results.incompleteRejection = {
            passed: !incomplete.success,
            detail: incomplete.message ?? incomplete.diagnostics.join("; "),
        };
        const repaired = await engine.repairProduct("step5b-kwizera-jacket");
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Repair pipeline re-validated existing product" : "Repair failed",
        };
        const searchResults = engine.searchProducts({ brand: "KWIZERA", limit: 10 });
        results.search = {
            passed: searchResults.length >= 2,
            detail: `${searchResults.length} product(s) found by brand`,
        };
        const skuSearch = engine.searchProducts({ sku: "KWZ-PRO-STUDIO-001" });
        results.skuSearch = {
            passed: skuSearch.length === 1 && skuSearch[0]?.productId === "step5b-kwizera-pro",
            detail: `SKU search returned ${skuSearch.length} result(s)`,
        };
        const status = engine.buildStatusReport();
        results.knowledgeBridge = {
            passed: status.knowledgeBridgeStatus === "connected",
            detail: status.knowledgeBridgeStatus,
        };
        results.memoryBridge = {
            passed: status.memoryBridgeStatus === "connected",
            detail: status.memoryBridgeStatus,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `product-analysis-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        results.performance = {
            passed: status.performance.averageAnalysisMs < 120000,
            detail: `avg analysis ${status.performance.averageAnalysisMs}ms, search ${status.performance.averageSearchMs}ms`,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        const registered = core.getManager().productIntelligenceFoundation.getRegistry().getModule("product-analysis-engine");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}`,
        };
        await core.stop("step-5b-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        const analysisReport = buildAnalysisReport(status, results, storageRoot, allPassed);
        const classificationReport = buildClassificationReport(electronics.record, fashion.record, beauty.record);
        const readinessReport = buildReadinessReport(status, allPassed);
        fs.writeFileSync(path.join(projectStateDir, "Product-Analysis-Report.md"), analysisReport, "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Product-Classification-Report.md"), classificationReport, "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Product-Readiness-Report.md"), readinessReport, "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-5B-VALIDATION-REPORT.md"), analysisReport, "utf8");
        console.log("Reports written:", projectStateDir);
        console.log("Validation Results:");
        for (const [key, result] of Object.entries(results)) {
            console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
        }
        console.log("---");
        console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
        console.log(`Readiness Score: ${status.readinessScore}/100`);
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
function buildAnalysisReport(status, results, storageRoot, allPassed) {
    return [
        "# Product Analysis Report — Step 5B",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Storage:** \`${storageRoot}\``,
        `**Overall:** ${allPassed ? "✅ PASS" : "❌ FAIL"}`,
        `**Readiness:** ${status.readinessScore}/100`,
        "",
        "## Validation Results",
        "",
        "| Check | Status | Detail |",
        "|-------|--------|--------|",
        ...Object.entries(results).map(([k, r]) => `| ${k} | ${r.passed ? "✅" : "❌"} | ${r.detail} |`),
        "",
        "## Engine Status",
        "",
        `- Products analyzed: ${status.productsAnalyzed}`,
        `- Avg completeness: ${status.averageCompletenessScore}`,
        `- Avg confidence: ${status.averageConfidenceScore}`,
        `- Knowledge bridge: ${status.knowledgeBridgeStatus}`,
        `- Memory bridge: ${status.memoryBridgeStatus}`,
        "",
    ].join("\n");
}
function buildClassificationReport(electronics, fashion, beauty) {
    const rows = [electronics, fashion, beauty].filter(Boolean);
    return [
        "# Product Classification Report — Step 5B",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Product | Industry | Category | Subcategory | Use Case | Target Customer | Business Type |",
        "|---------|----------|----------|-------------|----------|-----------------|---------------|",
        ...rows.map((r) => `| ${r.profile.productName} | ${r.classification.industry} | ${r.classification.category} | ${r.classification.subcategory} | ${r.classification.useCase} | ${r.classification.targetCustomer} | ${r.classification.businessType} |`),
        "",
    ].join("\n");
}
function buildReadinessReport(status, allPassed) {
    return [
        "# Product Readiness Report — Step 5B",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Overall:** ${allPassed ? "✅ APPROVED" : "❌ NOT APPROVED"}`,
        "",
        "## Readiness Scores",
        "",
        `| Metric | Value |`,
        `|--------|-------|`,
        `| Engine Readiness | ${status.readinessScore}/100 |`,
        `| Avg Completeness | ${status.averageCompletenessScore}/100 |`,
        `| Avg Confidence | ${status.averageConfidenceScore}/100 |`,
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-product-analysis-engine.js.map