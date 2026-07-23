import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, CampaignType, MarketingPlatform, ProjectType, } from "../ai/index.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-marketing-memory-"));
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    console.log("KWIZERA AI STUDIO — Step 3H Marketing Memory Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("step-3h-validation");
        const foundation = core.getManager().memoryFoundation;
        const projects = foundation.getProjectMemoryEngine();
        const marketing = foundation.getMarketingMemoryEngine();
        const indexEngine = foundation.getIndexEngine();
        const learning = foundation.getLearningMemoryEngine();
        results.initialization = {
            passed: marketing.isInitialized() && marketing.isStartupComplete(),
            detail: "Marketing Memory Engine operational",
        };
        const marketingDir = path.join(storageRoot, "memory", "marketing");
        results.marketingDirectories = {
            passed: fs.existsSync(marketingDir),
            detail: marketingDir,
        };
        await projects.createProject({
            projectId: "step3h-project",
            projectName: "Step 3H Marketing Validation",
            projectType: ProjectType.Marketing,
            description: "Validates marketing memory engine",
            tags: ["validation", "kwizera"],
        });
        const createStart = Date.now();
        const createResult = await marketing.createCampaign({
            campaignId: "step3h-campaign",
            projectId: "step3h-project",
            campaignName: "KWIZERA Launch Marketing",
            product: "AI Studio",
            brand: "KWIZERA",
            campaignType: CampaignType.ProductLaunch,
            platform: MarketingPlatform.InstagramReels,
            targetAudience: "Creative professionals",
            goal: "Brand launch conversion",
            language: "en",
            content: {
                headlines: ["The Future of Creative AI is Here"],
                hooks: ["Stop struggling with complex tools"],
                captions: ["Create professional promos in minutes with KWIZERA AI STUDIO"],
                callToActions: ["Start creating free"],
                productDescriptions: ["Local-first AI creative studio for professionals"],
                promotionalScripts: ["Intro hook, product demo, CTA"],
                hashtags: ["#kwizera", "#aicreator", "#promo"],
                keywords: ["ai", "creative", "promo", "studio"],
                sellingPoints: ["Local-first", "AI-powered", "Fast workflow"],
                emotionalTriggers: ["inspiration", "empowerment", "confidence"],
            },
            campaign: {
                campaignStructure: "hook-problem-solution-cta",
                campaignFlow: "attention-interest-desire-action",
                openingStyle: "bold-question",
                productPresentation: "hero-demo",
                benefits: ["10x faster", "Professional quality", "No cloud dependency"],
                customerProblem: "Creative workflows are too slow and complex",
                solution: "KWIZERA AI STUDIO automates promo creation",
                closingStrategy: "urgency-with-offer",
                offerStrategy: "free-trial-cta",
            },
            branding: {
                brandVoice: "confident-inspiring",
                brandPersonality: "innovative-professional",
                brandColors: ["#1a1a2e", "#e94560", "#ffffff"],
                brandIdentity: "modern-tech-creative",
                brandStyle: "bold-minimal",
                brandMessaging: "Create without limits",
                logoUsage: "intro-outro-watermark",
                typography: "geometric-sans",
            },
            socialMedia: {
                platform: MarketingPlatform.InstagramReels,
                bestPractices: ["Hook in 1 second", "Vertical 9:16", "Text overlays"],
                contentStyle: "fast-dynamic",
                optimalLength: "15-30 seconds",
                postingTips: ["Peak hours 6-9pm", "Use trending audio"],
            },
            customer: {
                customerInterests: ["AI tools", "video marketing"],
                preferredMarketingStyles: ["bold", "story-driven"],
                preferredLanguages: ["en"],
            },
            tags: ["validation", "launch", "promo-style"],
        });
        const createMs = Date.now() - createStart;
        results.campaignStorage = {
            passed: createResult.success,
            detail: `Created in ${createMs}ms`,
        };
        const campaign = await marketing.getCampaign("step3h-campaign");
        results.contentMemory = {
            passed: (campaign?.content.headlines.length ?? 0) >= 1 && (campaign?.content.hooks.length ?? 0) >= 1,
            detail: `${campaign?.content.headlines.length} headline(s), ${campaign?.content.hooks.length} hook(s)`,
        };
        results.brandingMemory = {
            passed: Boolean(campaign?.branding.brandVoice && campaign?.branding.brandColors.length),
            detail: `Voice: ${campaign?.branding.brandVoice}`,
        };
        const customer = marketing.getCustomerMemory();
        results.customerMemory = {
            passed: customer.customerInterests.length >= 1 && customer.preferredMarketingStyles.length >= 1,
            detail: `${customer.customerInterests.length} interest(s), ${customer.preferredMarketingStyles.length} style(s)`,
        };
        const updateResult = await marketing.updateCampaign("step3h-campaign", {
            contentAppend: {
                callToActions: ["Download now — limited offer"],
            },
        });
        results.patternDetection = {
            passed: updateResult.patternsDetected > 0 && marketing.getDetectedPatterns().length > 0,
            detail: `${marketing.getDetectedPatterns().length} pattern(s), ${marketing.getReusablePatterns().length} reusable`,
        };
        const relationships = marketing.getCampaignRelationships("step3h-campaign");
        results.relationshipDetection = {
            passed: relationships !== null,
            detail: `${relationships?.relatedMemories.length ?? 0} related memory(s)`,
        };
        const searchStart = Date.now();
        const searchResults = marketing.searchCampaigns({
            brand: "KWIZERA",
            hook: "struggling",
            cta: "Start",
            goal: "conversion",
            platform: MarketingPlatform.InstagramReels,
        });
        const searchMs = Date.now() - searchStart;
        results.search = {
            passed: searchResults.length >= 1 && searchMs < 5000,
            detail: `${searchResults.length} result(s) in ${searchMs}ms`,
        };
        const learnResult = await marketing.completeCampaign("step3h-campaign", 90);
        results.learning = {
            passed: learnResult.success && learnResult.recommendations.length > 0,
            detail: `Learning ID: ${learnResult.learningId}, ${learnResult.patternsStored} pattern(s)`,
        };
        const learningHistory = learning.getLearningHistory();
        results.learningIntegration = {
            passed: learningHistory.some((h) => h.relatedProject === "step3h-project"),
            detail: `${learningHistory.length} learning record(s)`,
        };
        const indexed = indexEngine.lookup({ project: "step3h-project" });
        results.indexIntegration = {
            passed: indexed.memoryIds.includes("step3h-campaign"),
            detail: `${indexed.memoryIds.length} indexed record(s)`,
        };
        const historyFile = path.join(marketingDir, "marketing-history.jsonl");
        const patternsFile = path.join(marketingDir, "marketing-patterns.jsonl");
        const customerFile = path.join(marketingDir, "customer-memory.json");
        results.storageIntegrity = {
            passed: fs.existsSync(historyFile) && fs.existsSync(patternsFile) && fs.existsSync(customerFile),
            detail: "History, patterns, and customer memory persisted",
        };
        const logDir = path.join(storageRoot, "logs");
        const logFiles = fs.existsSync(logDir)
            ? fs.readdirSync(logDir).filter((f) => f.startsWith("marketing-memory-engine"))
            : [];
        results.logging = {
            passed: logFiles.length > 0,
            detail: logDir,
        };
        const report = marketing.buildStatusReport();
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
        const reportPath = path.join(process.cwd(), "STEP-3H-VALIDATION-REPORT.md");
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
        "# KWIZERA AI STUDIO — Phase 3 Step 3H Validation Report",
        "",
        "**Phase:** 3 — Persistent Memory",
        "**Step:** 3H — Marketing Memory Engine",
        `**Date:** ${new Date().toISOString()}`,
        `**Storage root:** \`${storageRoot}\``,
        "**Assistant:** KWIZERA AI",
        "",
        "---",
        "",
        "## Marketing Memory Status",
        "",
        "| Field | Value |",
        "|-------|-------|",
        `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
        `| **Engine Status** | ${status.engineStatus} |`,
        `| **Readiness Score** | **${status.readinessScore}/100** |`,
        "",
        "## Campaign Status",
        "",
        `- ${status.campaignStatus}`,
        "",
        "## Pattern Detection Status",
        "",
        `- ${status.patternDetectionStatus}`,
        "",
        "## Brand Memory Status",
        "",
        `- ${status.brandMemoryStatus}`,
        "",
        "## Relationship Status",
        "",
        `- ${status.relationshipStatus}`,
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
        `| Campaign Creation | ${createMs}ms |`,
        `| Last Search | ${searchMs}ms |`,
        `| Average Save | ${status.performance.averageSaveMs}ms |`,
        `| Average Search | ${status.performance.averageSearchMs}ms |`,
        `| Total Patterns | ${status.totalPatterns} |`,
        `| Customer Profile Fields | ${status.totalCustomerProfiles} |`,
        "",
        "## Known Issues",
        "",
        ...(status.knownIssues.length > 0
            ? status.knownIssues.map((i) => `- ${i}`)
            : ["- None"]),
        "",
        "---",
        "",
        "**KWIZERA AI** — Step 3H Marketing Memory Engine validation complete. Awaiting user approval before Step 3I.",
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-marketing-memory-engine.js.map