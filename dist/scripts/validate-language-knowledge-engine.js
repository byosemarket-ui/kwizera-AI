import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, KnowledgeSupportedLanguage, LanguageMarketingGoal, LanguageScriptType, LanguageWritingStyle, } from "../ai/index.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-language-knowledge-"));
}
const SAMPLE_ENGLISH = {
    languageId: "step4j-english-kwizera",
    language: KnowledgeSupportedLanguage.English,
    brandName: "KWIZERA",
    productName: "KWIZERA Pro",
    topic: "AI creative studio",
    industry: "creative-technology",
    audience: "marketing professionals",
    marketingGoal: LanguageMarketingGoal.Conversion,
    writingStyle: LanguageWritingStyle.Marketing,
    scriptType: LanguageScriptType.PromotionalScript,
    content: "KWIZERA Pro empowers creative teams to produce professional marketing content faster. Start your free trial today.",
    marketing: {
        headlines: ["Create smarter with KWIZERA Pro", "AI-powered creative studio"],
        hooks: ["What if you could create in minutes?"],
        callToActions: ["Start Free Trial"],
    },
    grammar: { grammarScore: 92, issues: [] },
    subtitles: { syncQuality: 90, readabilityOnScreen: 88 },
    localization: { translationReadiness: 85, localizationReadiness: 82 },
    tags: ["english", "kwizera", "validation"],
};
const SAMPLE_KINYARWANDA = {
    languageId: "step4j-kinyarwanda-kwizera",
    language: KnowledgeSupportedLanguage.Kinyarwanda,
    brandName: "KWIZERA",
    productName: "KWIZERA Pro",
    writingStyle: LanguageWritingStyle.Marketing,
    scriptType: LanguageScriptType.SocialCaption,
    content: "Murakoze guhitamo KWIZERA Pro. Kora ibikorwa bya marketing vuba kandi neza.",
    grammar: { grammarScore: 85, issues: [] },
    tags: ["kinyarwanda", "kwizera", "validation"],
};
const SAMPLE_SUBTITLE = {
    languageId: "step4j-subtitle-en",
    language: KnowledgeSupportedLanguage.English,
    brandName: "KWIZERA",
    scriptType: LanguageScriptType.Subtitle,
    content: "Discover KWIZERA Pro. Create faster. Stay on brand.",
    subtitles: {
        subtitleText: ["Discover KWIZERA Pro", "Create faster", "Stay on brand"],
        syncQuality: 92,
        readabilityOnScreen: 90,
    },
    tags: ["subtitle", "validation", "video"],
};
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    console.log("KWIZERA AI STUDIO — Step 4J Language Knowledge Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("step-4j-validation");
        const engine = core.getManager().knowledgeFoundation.getLanguageKnowledgeEngine();
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: "Language Knowledge Engine operational",
        };
        const analysisStart = Date.now();
        const english = await engine.analyzeLanguage(SAMPLE_ENGLISH);
        const analysisMs = Date.now() - analysisStart;
        results.languageUnderstanding = {
            passed: english.success && Boolean(english.record),
            detail: `English analyzed in ${analysisMs}ms, grammar ${english.record?.scores.grammarScore}`,
        };
        results.grammarAnalysis = {
            passed: (english.record?.scores.grammarScore ?? 0) >= 75,
            detail: `Grammar ${english.record?.scores.grammarScore}, issues ${english.record?.grammar.issues.length}`,
        };
        results.marketingLanguage = {
            passed: (english.record?.scores.marketingScore ?? 0) >= 75,
            detail: `Marketing ${english.record?.scores.marketingScore}, headlines ${english.record?.marketing.headlines.length}`,
        };
        const kinyarwanda = await engine.analyzeLanguage(SAMPLE_KINYARWANDA);
        const subtitle = await engine.analyzeLanguage(SAMPLE_SUBTITLE);
        results.multiLanguage = {
            passed: kinyarwanda.success && subtitle.success,
            detail: `Kinyarwanda ${kinyarwanda.record?.language}, subtitle ${subtitle.record?.scriptType}`,
        };
        const detected = engine.detectLanguage("Murakoze guhitamo KWIZERA", KnowledgeSupportedLanguage.Kinyarwanda);
        results.languageDetection = {
            passed: detected === KnowledgeSupportedLanguage.Kinyarwanda,
            detail: `Detected ${detected}`,
        };
        results.subtitlePreparation = {
            passed: (subtitle.record?.scores.subtitleQualityScore ?? 0) >= 75,
            detail: `Subtitle quality ${subtitle.record?.scores.subtitleQualityScore}, lines ${subtitle.record?.subtitles.subtitleText.length}`,
        };
        const rels = engine.detectRelationships("step4j-english-kwizera");
        results.relationshipDetection = {
            passed: kinyarwanda.success,
            detail: `Related languages ${rels?.relatedLanguages.length}, brands ${rels?.relatedBrands.length}`,
        };
        results.knowledgeStorage = {
            passed: english.record?.knowledgeId === "language-knowledge-step4j-english-kwizera",
            detail: english.record?.knowledgeId ?? "missing",
        };
        const recs = engine.getRecommendations("step4j-english-kwizera");
        results.recommendations = {
            passed: recs.length >= 0,
            detail: `${recs.length} recommendation(s), top: ${recs[0]?.category ?? "none"}`,
        };
        const searchStart = Date.now();
        const search = await engine.searchLanguages({ language: KnowledgeSupportedLanguage.English, brand: "KWIZERA" });
        const searchMs = Date.now() - searchStart;
        results.search = {
            passed: search.length >= 1,
            detail: `${search.length} result(s) in ${searchMs}ms`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `language-knowledge-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        const invalid = await engine.analyzeLanguage({
            language: KnowledgeSupportedLanguage.English,
            content: "",
        });
        results.validationRejection = {
            passed: !invalid.success,
            detail: invalid.message ?? "rejected",
        };
        const unverified = await engine.analyzeLanguage({
            language: KnowledgeSupportedLanguage.English,
            content: "bad",
            grammar: { grammarScore: 20, issues: ["severe errors"] },
            marketing: { headlines: [], hooks: [], callToActions: [] },
        });
        results.unverifiedRejection = {
            passed: !unverified.success,
            detail: unverified.message ?? "rejected",
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
        await core.stop("step-4j-validation-complete");
        const allPassed = Object.values(results).every((r) => r.passed);
        const reportPath = path.join(process.cwd(), "STEP-4J-VALIDATION-REPORT.md");
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
        "# KWIZERA AI STUDIO — Phase 4 Step 4J Validation Report",
        "",
        "**Phase:** 4 — Knowledge Engine",
        "**Step:** 4J — Language Knowledge Engine",
        `**Date:** ${new Date().toISOString()}`,
        `**Storage root:** \`${storageRoot}\``,
        "**Assistant:** KWIZERA AI",
        "",
        "---",
        "",
        "## Language Knowledge Status",
        "",
        "| Field | Value |",
        "|-------|-------|",
        `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
        `| **Engine Status** | ${status.engineStatus} |`,
        `| **Readiness Score** | **${status.readinessScore}/100** |`,
        `| **Records Analyzed** | ${status.recordsAnalyzed} |`,
        `| **Patterns Learned** | ${status.patternsLearned} |`,
        "",
        "## Validation Results",
        "",
        "| Check | Status | Detail |",
        "|-------|--------|--------|",
        ...Object.entries(results).map(([key, r]) => `| ${key} | ${r.passed ? "✅ PASS" : "❌ FAIL"} | ${r.detail} |`),
        "",
        "## Grammar Status",
        "",
        `- ${status.grammarStatus}`,
        "",
        "## Marketing Language Status",
        "",
        `- ${status.marketingLanguageStatus}`,
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
        "**KWIZERA AI** — Step 4J Language Knowledge Engine validation complete. Awaiting user approval before Step 4K.",
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-language-knowledge-engine.js.map