import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, MemoryStorageType, ProjectType, } from "../ai/index.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-product-memory-"));
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    console.log("KWIZERA AI STUDIO — Step 3I Product Memory Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("step-3i-validation");
        const foundation = core.getManager().memoryFoundation;
        const projects = foundation.getProjectMemoryEngine();
        const products = foundation.getProductMemoryEngine();
        const indexEngine = foundation.getIndexEngine();
        const learning = foundation.getLearningMemoryEngine();
        results.initialization = {
            passed: products.isInitialized() && products.isStartupComplete(),
            detail: "Product Memory Engine operational",
        };
        const productDir = path.join(storageRoot, "memory", "products");
        results.productDirectories = {
            passed: fs.existsSync(productDir),
            detail: productDir,
        };
        await projects.createProject({
            projectId: "step3i-project",
            projectName: "Step 3I Product Validation",
            projectType: ProjectType.Product,
            description: "Validates product memory engine",
            tags: ["validation", "kwizera"],
        });
        const createStart = Date.now();
        const createResult = await products.createProduct({
            productId: "step3i-product",
            projectId: "step3i-project",
            productName: "KWIZERA Pro Studio",
            brand: "KWIZERA",
            category: "software",
            subcategory: "creative-tools",
            sku: "KWZ-PRO-3I",
            description: "Professional AI creative studio for promotional content creation.",
            features: ["AI workflow", "Local-first storage", "Video export", "Marketing tools"],
            specifications: { version: "1.0", platform: "Windows", minRam: "8GB" },
            materials: ["digital-license"],
            colors: ["#1a1a2e", "#e94560"],
            sizes: ["standard", "enterprise"],
            price: 149.99,
            currency: "USD",
            availability: "in-stock",
            countryOfOrigin: "US",
            supplier: "KWIZERA Inc",
            language: "en",
            marketingGoal: "conversion",
            visual: {
                productImages: ["assets/product-hero.png", "assets/product-angle.png"],
                productBackgrounds: ["bg/studio-white", "bg/gradient-dark"],
                productAngles: ["front", "45-degree"],
                lightingStyle: "studio-professional",
                presentationStyle: "hero-center",
                colorPalette: ["#1a1a2e", "#e94560", "#ffffff"],
                packagingStyle: "digital-box",
                productLayout: "center-hero",
            },
            marketing: {
                bestHeadlines: ["The Future of Creative AI"],
                bestHooks: ["Stop wasting hours on repetitive promo work"],
                bestCta: ["Start creating free", "Get Pro now"],
                bestDescriptions: ["Local-first AI studio for professional promotional content"],
                bestSellingPoints: ["10x faster workflow", "Complete privacy", "Pro quality exports"],
                emotionalMarketingStyle: "aspirational-confidence",
                storytellingStyle: "problem-agitate-solve",
            },
            customerPreferences: {
                preferredCategories: ["software", "creative-tools"],
                preferredColors: ["#1a1a2e"],
                preferredPriceRange: "100-200",
            },
            tags: ["validation", "pro", "software"],
        });
        const createMs = Date.now() - createStart;
        results.productStorage = {
            passed: createResult.success,
            detail: `Created in ${createMs}ms, profile score from storage`,
        };
        const product = await products.getProduct("step3i-product");
        results.visualMemory = {
            passed: (product?.visual.productImages.length ?? 0) >= 2,
            detail: `${product?.visual.productImages.length} image(s), layout: ${product?.visual.productLayout}`,
        };
        results.marketingRelationships = {
            passed: (product?.marketing.bestHeadlines.length ?? 0) >= 1 && (product?.marketing.bestCta.length ?? 0) >= 1,
            detail: `CTA: ${product?.marketing.bestCta[0]}`,
        };
        const prefs = products.getCustomerPreferences();
        results.customerMemory = {
            passed: prefs.preferredCategories.length >= 1,
            detail: `${prefs.preferredCategories.length} category preference(s)`,
        };
        await foundation.getStorageEngine().storeRecord({
            memoryId: "step3i-video",
            memoryType: MemoryStorageType.Video,
            category: "promotional",
            title: "Product Promo Video",
            description: "Promo for KWIZERA Pro",
            source: "step-3i-validation",
            relatedProject: "step3i-project",
        });
        await foundation.getStorageEngine().storeRecord({
            memoryId: "step3i-marketing",
            memoryType: MemoryStorageType.Marketing,
            category: "marketing",
            title: "Product Launch Campaign",
            description: "Marketing for KWIZERA Pro",
            source: "step-3i-validation",
            relatedProject: "step3i-project",
        });
        const updateResult = await products.updateProduct("step3i-product", {
            videoRelationships: {
                promotionalVideos: ["step3i-video"],
                marketingCampaigns: ["step3i-marketing"],
                posters: ["poster-step3i.png"],
                banners: ["banner-step3i.png"],
            },
            presentationStyleRating: 90,
        });
        results.videoRelationships = {
            passed: (await products.getProduct("step3i-product")).videoRelationships.promotionalVideos.includes("step3i-video"),
            detail: "Video and marketing campaigns linked",
        };
        results.patternDetection = {
            passed: updateResult.patternsDetected > 0 && products.getDetectedPatterns().length > 0,
            detail: `${products.getDetectedPatterns().length} pattern(s), ${products.getReusablePatterns().length} reusable`,
        };
        const relationships = products.getProductRelationships("step3i-product");
        results.relationshipDetection = {
            passed: relationships !== null && relationships.relatedMemories.length >= 2,
            detail: `${relationships?.relatedMemories.length ?? 0} related memory(s)`,
        };
        const searchStart = Date.now();
        const searchResults = products.searchProducts({
            brand: "KWIZERA",
            category: "software",
            sku: "KWZ-PRO-3I",
            color: "1a1a2e",
            minPrice: 100,
            maxPrice: 200,
            marketingGoal: "conversion",
        });
        const searchMs = Date.now() - searchStart;
        results.search = {
            passed: searchResults.length >= 1 && searchMs < 5000,
            detail: `${searchResults.length} result(s) in ${searchMs}ms`,
        };
        const learnResult = await products.learnFromProject("step3i-product");
        results.learning = {
            passed: learnResult.success && learnResult.recommendations.length > 0,
            detail: `Learning ID: ${learnResult.learningId}, ${learnResult.lessons.length} lesson(s)`,
        };
        const learningHistory = learning.getLearningHistory();
        results.learningIntegration = {
            passed: learningHistory.length >= 1,
            detail: `${learningHistory.length} learning record(s)`,
        };
        const indexed = indexEngine.lookup({ project: "step3i-project" });
        results.indexIntegration = {
            passed: indexed.memoryIds.includes("step3i-product"),
            detail: `${indexed.memoryIds.length} indexed record(s)`,
        };
        const historyFile = path.join(productDir, "product-history.jsonl");
        const patternsFile = path.join(productDir, "product-patterns.jsonl");
        const prefsFile = path.join(productDir, "customer-preferences.json");
        results.storageIntegrity = {
            passed: fs.existsSync(historyFile) && fs.existsSync(patternsFile) && fs.existsSync(prefsFile),
            detail: "History, patterns, and preferences persisted",
        };
        const logDir = path.join(storageRoot, "logs");
        const logFiles = fs.existsSync(logDir)
            ? fs.readdirSync(logDir).filter((f) => f.startsWith("product-memory-engine"))
            : [];
        results.logging = {
            passed: logFiles.length > 0,
            detail: logDir,
        };
        const report = products.buildStatusReport();
        results.performance = {
            passed: createMs < 5000,
            detail: `create ${createMs}ms, avg search ${report.performance.averageSearchMs}ms`,
        };
        results.readiness = {
            passed: report.readinessScore >= 85,
            detail: `Readiness ${report.readinessScore}/100`,
        };
        await core.stop("validation complete");
        const allPassed = Object.values(results).every((r) => r.passed);
        const reportPath = path.join(process.cwd(), "STEP-3I-VALIDATION-REPORT.md");
        fs.writeFileSync(reportPath, buildReport(report, results, storageRoot, allPassed, createMs, searchMs), "utf8");
        console.log(buildReport(report, results, storageRoot, allPassed, createMs, searchMs));
        console.log("---");
        console.log(`Report written to: ${reportPath}`);
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
function buildReport(status, results, storageRoot, allPassed, createMs, searchMs) {
    return [
        "# KWIZERA AI STUDIO — Phase 3 Step 3I Validation Report",
        "",
        "**Phase:** 3 — Persistent Memory",
        "**Step:** 3I — Product Memory Engine",
        `**Date:** ${new Date().toISOString()}`,
        `**Storage root:** \`${storageRoot}\``,
        "**Assistant:** KWIZERA AI",
        "",
        "---",
        "",
        "## Product Memory Status",
        "",
        "| Field | Value |",
        "|-------|-------|",
        `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
        `| **Engine Status** | ${status.engineStatus} |`,
        `| **Readiness Score** | **${status.readinessScore}/100** |`,
        "",
        "## Relationship Status",
        "",
        `- ${status.relationshipStatus}`,
        "",
        "## Pattern Detection Status",
        "",
        `- ${status.patternDetectionStatus}`,
        "",
        "## Learning Status",
        "",
        `- ${status.learningStatus}`,
        "",
        "## Validation Results",
        "",
        "| Check | Status | Detail |",
        "|-------|--------|--------|",
        ...Object.entries(results).map(([key, r]) => `| ${key} | ${r.passed ? "✅ PASS" : "❌ FAIL"} | ${r.detail} |`),
        "",
        "## Performance",
        "",
        `| Metric | Value |`,
        `|--------|-------|`,
        `| Product Creation | ${createMs}ms |`,
        `| Last Search | ${searchMs}ms |`,
        `| Average Save | ${status.performance.averageSaveMs}ms |`,
        `| Average Search | ${status.performance.averageSearchMs}ms |`,
        `| Total Products | ${status.totalProducts} |`,
        `| Total Patterns | ${status.totalPatterns} |`,
        "",
        "## Known Issues",
        "",
        ...(status.knownIssues.length > 0
            ? status.knownIssues.map((i) => `- ${i}`)
            : ["- None"]),
        "",
        "---",
        "",
        "**KWIZERA AI** — Step 3I Product Memory Engine validation complete. Awaiting user approval before Step 3J.",
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-product-memory-engine.js.map