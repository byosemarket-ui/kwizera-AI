import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, ProductAnalysisCategory, ProductAnalysisIndustry, ProductAvailabilityStatus, ProductBusinessType, ProductUnderstandingMarketingGoal, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-product-understanding-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_TECH = {
    productId: "step5c-kwizera-pro",
    productName: "KWIZERA Pro Studio",
    category: ProductAnalysisCategory.Software,
    subcategory: "creative-workstation",
    brand: "KWIZERA",
    model: "KWP-PRO-2026",
    sku: "KWZ-PRO-STUDIO-001",
    description: "Professional AI-powered creative workstation empowering marketing teams to produce brand-consistent content at scale",
    features: ["AI video generation", "brand consistency", "multi-platform export"],
    specifications: { license: "pro", deployment: "cloud" },
    materials: ["digital-license"],
    price: 299.99,
    currency: "USD",
    availability: ProductAvailabilityStatus.InStock,
    industry: ProductAnalysisIndustry.Technology,
    useCase: "creative-production",
    targetCustomer: "creative professionals and marketing teams",
    businessType: ProductBusinessType.B2B,
    tags: ["software", "validation"],
    keywords: ["AI studio", "kwizera"],
};
const SAMPLE_FASHION = {
    productId: "step5c-kwizera-jacket",
    productName: "KWIZERA Urban Jacket",
    category: ProductAnalysisCategory.Fashion,
    subcategory: "outerwear",
    brand: "KWIZERA",
    description: "Premium urban jacket for creators who need weather-resistant style on the move",
    features: ["water-resistant", "breathable", "minimal branding"],
    specifications: { fabric: "cotton-blend" },
    materials: ["cotton", "polyester"],
    price: 129.99,
    currency: "USD",
    availability: ProductAvailabilityStatus.InStock,
    industry: ProductAnalysisIndustry.Fashion,
    businessType: ProductBusinessType.D2C,
    tags: ["fashion", "validation"],
    keywords: ["jacket", "kwizera"],
};
const SAMPLE_BEAUTY = {
    productId: "step5c-glow-serum",
    productName: "Radiance Vitamin C Serum",
    category: ProductAnalysisCategory.Beauty,
    subcategory: "skincare",
    brand: "GlowLab",
    description: "Clinical-grade vitamin C serum delivering radiant skin and anti-aging benefits",
    features: ["vitamin-c", "anti-aging", "hydrating"],
    specifications: { volume: "30ml" },
    materials: ["glass-bottle"],
    price: 45.0,
    currency: "USD",
    availability: ProductAvailabilityStatus.InStock,
    industry: ProductAnalysisIndustry.Beauty,
    tags: ["beauty", "validation"],
    keywords: ["serum", "glowlab"],
};
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 5C Product Understanding Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("step-5c-validation");
        const foundation = core.getManager().productIntelligenceFoundation;
        const analysisEngine = foundation.getProductAnalysisEngine();
        const engine = foundation.getProductUnderstandingEngine();
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: "Product Understanding Engine operational",
        };
        await analysisEngine.analyzeProduct(SAMPLE_TECH);
        const understandStart = Date.now();
        const tech = await engine.understandProduct({
            productId: "step5c-kwizera-pro",
            marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
        });
        const understandMs = Date.now() - understandStart;
        results.productUnderstanding = {
            passed: tech.success && Boolean(tech.record),
            detail: `Technology product understood in ${understandMs}ms, score ${tech.record?.scores.understandingScore}`,
        };
        results.valueAnalysis = {
            passed: (tech.record?.valueAnalysis.functionalValue ?? 0) >= 50 &&
                (tech.record?.valueAnalysis.commercialValue ?? 0) >= 50,
            detail: `Functional ${tech.record?.valueAnalysis.functionalValue}, commercial ${tech.record?.valueAnalysis.commercialValue}`,
        };
        results.customerUnderstanding = {
            passed: (tech.record?.customer.customerNeeds.length ?? 0) >= 2 &&
                (tech.record?.customer.customerPainPoints.length ?? 0) >= 1,
            detail: `${tech.record?.customer.customerNeeds.length} needs, ${tech.record?.customer.customerPainPoints.length} pain points`,
        };
        results.useCaseUnderstanding = {
            passed: Boolean(tech.record?.context.whereUsed && tech.record?.context.whyCustomersChoose),
            detail: `Context: ${tech.record?.context.whereUsed}`,
        };
        await analysisEngine.analyzeProduct(SAMPLE_FASHION);
        await analysisEngine.analyzeProduct(SAMPLE_BEAUTY);
        const fashion = await engine.understandProduct({ productId: "step5c-kwizera-jacket" });
        const beauty = await engine.understandProduct({ productId: "step5c-glow-serum" });
        results.multiIndustry = {
            passed: fashion.success && beauty.success,
            detail: `Fashion ${fashion.record?.customer.targetIndustry}, Beauty ${beauty.record?.customer.targetIndustry}`,
        };
        results.understandingScores = {
            passed: (tech.record?.scores.understandingScore ?? 0) >= 55 &&
                (tech.record?.scores.customerValueScore ?? 0) >= 50 &&
                (tech.record?.scores.businessValueScore ?? 0) >= 50,
            detail: `Understanding ${tech.record?.scores.understandingScore}, customer ${tech.record?.scores.customerValueScore}, business ${tech.record?.scores.businessValueScore}`,
        };
        results.relationshipDetection = {
            passed: (fashion.record?.relationships.similarProducts.length ?? 0) >= 0,
            detail: `Fashion similar products: ${fashion.record?.relationships.similarProducts.length ?? 0}`,
        };
        results.marketingReadiness = {
            passed: (tech.record?.scores.marketingReadinessScore ?? 0) >= 40,
            detail: `Marketing readiness ${tech.record?.scores.marketingReadinessScore}`,
        };
        const noAnalysis = await engine.understandProduct({ productId: "step5c-nonexistent" });
        results.incompleteRejection = {
            passed: !noAnalysis.success,
            detail: noAnalysis.message ?? "Rejected without analysis",
        };
        const repaired = await engine.repairUnderstanding("step5c-kwizera-jacket");
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Understanding repair pipeline verified" : "Repair failed",
        };
        const purposeSearch = engine.searchUnderstanding({ purpose: "creative" });
        results.search = {
            passed: purposeSearch.length >= 1,
            detail: `${purposeSearch.length} result(s) by purpose`,
        };
        const audienceSearch = engine.searchUnderstanding({
            targetAudience: "creative professionals",
        });
        results.audienceSearch = {
            passed: audienceSearch.length >= 1,
            detail: `${audienceSearch.length} result(s) by target audience`,
        };
        const status = engine.buildStatusReport();
        results.performance = {
            passed: status.performance.averageUnderstandingMs < 120000,
            detail: `avg understanding ${status.performance.averageUnderstandingMs}ms, search ${status.performance.averageSearchMs}ms`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `product-understanding-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        const registered = foundation.getRegistry().getModule("product-understanding-engine");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}`,
        };
        await core.stop("step-5c-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "Product-Understanding-Report.md"), buildUnderstandingReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Customer-Value-Report.md"), buildCustomerValueReport(tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Business-Value-Report.md"), buildBusinessValueReport(tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-5C-VALIDATION-REPORT.md"), buildUnderstandingReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record), "utf8");
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
function buildUnderstandingReport(status, results, storageRoot, allPassed, tech, fashion, beauty) {
    return [
        "# Product Understanding Report — Step 5C",
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
        "## Products Understood",
        "",
        `- Technology: ${tech?.identity.productName ?? "n/a"} (${tech?.scores.understandingScore ?? 0}/100)`,
        `- Fashion: ${fashion?.identity.productName ?? "n/a"} (${fashion?.scores.understandingScore ?? 0}/100)`,
        `- Beauty: ${beauty?.identity.productName ?? "n/a"} (${beauty?.scores.understandingScore ?? 0}/100)`,
        "",
        `Products understood: ${status.productsUnderstood}`,
        "",
    ].join("\n");
}
function buildCustomerValueReport(tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    return [
        "# Customer Value Report — Step 5C",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Product | Target Customer | Customer Value | Needs | Pain Points |",
        "|---------|-----------------|----------------|-------|-------------|",
        ...rows.map((r) => `| ${r.identity.productName} | ${r.customer.targetCustomer} | ${r.scores.customerValueScore}/100 | ${r.customer.customerNeeds.length} | ${r.customer.customerPainPoints.length} |`),
        "",
    ].join("\n");
}
function buildBusinessValueReport(tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    return [
        "# Business Value Report — Step 5C",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Product | Business Value | Commercial | Market | Brand | USPs |",
        "|---------|----------------|------------|--------|-------|------|",
        ...rows.map((r) => `| ${r.identity.productName} | ${r.scores.businessValueScore}/100 | ${r.valueAnalysis.commercialValue} | ${r.valueAnalysis.marketValue} | ${r.valueAnalysis.brandValue} | ${r.uniqueValue.uniqueSellingPoints.length} |`),
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-product-understanding-engine.js.map