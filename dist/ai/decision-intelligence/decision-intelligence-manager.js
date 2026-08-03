import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
const EMPTY = { profiles: [], history: [], cache: {}, logs: [] };
/** Persistent project-level reasoning layer. It recommends and records decisions; execution remains owned by existing managers. */
export class DecisionIntelligenceManager {
    root = "";
    core = null;
    workspace = null;
    models = null;
    products = null;
    images = null;
    marketing = null;
    store = structuredClone(EMPTY);
    analysis = new DecisionAnalysisEngine();
    planning = new DecisionPlanningEngine();
    comparison = new DecisionComparisonEngine();
    scoring = new DecisionScoringEngine();
    strategy = new StrategySelectionEngine();
    workflow = new WorkflowSelectionEngine();
    model = new AiModelSelectionEngine();
    resources = new ResourceDecisionEngine();
    risk = new RiskEvaluationEngine();
    confidence = new ConfidenceScoringEngine();
    validation = new DecisionValidationEngine();
    explanation = new DecisionExplanationEngine();
    memory = new DecisionMemoryManager(this);
    analytics = new DecisionAnalyticsManager(this);
    history = new DecisionHistoryManager(this);
    cache = new DecisionCacheManager();
    async initialize(storageRoot, dependencies) { this.root = path.join(storageRoot, "decision-intelligence-runtime"); this.core = dependencies.core; this.workspace = dependencies.workspace; this.models = dependencies.models; this.products = dependencies.products; this.images = dependencies.images; this.marketing = dependencies.marketing; await fs.mkdir(this.root, { recursive: true }); this.store = await this.readStore(); this.log("info", "Decision intelligence runtime restored."); await this.persist(); }
    isInitialized() { return Boolean(this.root); }
    async decide(projectId, taskKind = "pipeline") { this.ensureReady(); const project = await this.workspace.getProject(projectId); if (!project)
        throw new Error("Project not found"); const valid = this.validation.validate(project); if (!valid.valid)
        throw new Error(valid.issues.join(" ")); const key = this.cache.key(project, taskKind); const cached = this.store.cache[key] ? this.store.profiles.find((profile) => profile.id === this.store.cache[key]) : undefined; if (cached)
        return { ...cached, cached: true }; const [product, imageProfiles, marketing, resources] = await Promise.all([this.products.analyze(projectId), this.images.analyzeProject(projectId), this.marketing.analyze(projectId), this.resources.analyze(this.models)]); const options = this.scoring.score(this.planning.options(project, taskKind), product.quality.score, imageProfiles, marketing.score, resources); const selected = this.strategy.select(this.comparison.rank(options)); const model = await this.model.select(this.models, taskKind); const confidence = this.confidence.score(product.quality.score, marketing.score, imageProfiles.length, selected.risk); const learnedFrom = this.memory.relevant(project, taskKind); const profile = { id: randomUUID(), projectId, taskKind, objective: project.campaignInformation.objective, priority: this.analysis.priority(project, taskKind), options, selected, confidence, resourceAnalysis: resources, modelRecommendation: model, explanation: this.explanation.create(selected, model, confidence, learnedFrom), risks: this.risk.evaluate(project, imageProfiles, resources), learnedFrom, createdAt: new Date().toISOString(), cached: false }; this.store.profiles = this.store.profiles.filter((item) => !(item.projectId === projectId && item.taskKind === taskKind)); this.store.profiles.unshift(profile); this.store.cache[key] = profile.id; this.history.record(projectId, "decision", `Selected ${selected.label} at ${confidence}% confidence.`); this.log("info", `Decision profile prepared for ${project.name}: ${selected.label}.`); await this.persist(); return { ...profile }; }
    async getProfile(projectId, taskKind = "pipeline") { return this.store.profiles.find((profile) => profile.projectId === projectId && profile.taskKind === taskKind) ?? null; }
    async getDashboard(projectId) { return { profiles: structuredClone(this.store.profiles.filter((item) => !projectId || item.projectId === projectId)), history: this.store.history.filter((item) => !projectId || item.projectId === projectId), logs: [...this.store.logs], analytics: this.analytics.summary(), integrations: { aiCore: Boolean(this.core), decisionFoundation: Boolean(this.core?.decisionEngine), productIntelligence: Boolean(this.products), imageIntelligence: Boolean(this.images), marketingIntelligence: Boolean(this.marketing), modelManagement: Boolean(this.models), memoryFoundation: Boolean(this.core?.memoryFoundation), knowledgeFoundation: Boolean(this.core?.knowledgeFoundation), workflowEngine: Boolean(this.core?.workflowEngine), taskScheduler: Boolean(this.core?.taskManager), automationEngine: Boolean(this.core?.workflowEngine), stateManager: Boolean(this.core?.stateManager), generationLayer: Boolean(this.core?.imageGenerationFoundation || this.core?.videoGenerationFoundation) } }; }
    async persist() { await fs.writeFile(path.join(this.root, "decisions.json"), `${JSON.stringify(this.store, null, 2)}\n`, "utf8"); }
    log(level, message) { this.store.logs.unshift({ at: new Date().toISOString(), level, message }); this.store.logs.splice(100); this.core?.logger.info("decision-intelligence", message); }
    async readStore() { try {
        const saved = JSON.parse(await fs.readFile(path.join(this.root, "decisions.json"), "utf8"));
        return { ...structuredClone(EMPTY), ...saved, profiles: saved.profiles ?? [], history: saved.history ?? [], cache: saved.cache ?? {}, logs: saved.logs ?? [] };
    }
    catch (error) {
        if (error.code === "ENOENT")
            return structuredClone(EMPTY);
        throw error;
    } }
    ensureReady() { if (!this.root || !this.workspace || !this.models || !this.products || !this.images || !this.marketing)
        throw new Error("Decision Intelligence Manager is not initialized"); }
}
export class DecisionAnalysisEngine {
    priority(project, task) { return task === "pipeline" || /launch|urgent|deadline/i.test(project.campaignInformation.objective) ? "high" : "normal"; }
}
export class DecisionPlanningEngine {
    options(project, task) { const platform = project.platform; return [{ id: "quality-first", label: "Quality-first creative workflow", workflow: "analyze -> plan -> generate -> review", creativeApproach: "product proof with marketing-led narrative", renderingStrategy: "high-quality approved artifact export", score: 0, risk: "low", resourceCost: "medium", reasons: ["Preserves evidence and review checkpoints", `Optimized for ${platform}`] }, { id: "balanced", label: "Balanced delivery workflow", workflow: "analyze -> plan -> generate", creativeApproach: "focused product demonstration", renderingStrategy: "standard local artifact preparation", score: 0, risk: "medium", resourceCost: "low", reasons: ["Reduces resource use", "Keeps creative planning intact"] }, { id: "rapid", label: "Rapid concept workflow", workflow: "plan -> generate", creativeApproach: "single-message social concept", renderingStrategy: "lightweight preview preparation", score: 0, risk: "high", resourceCost: "low", reasons: ["Fastest iteration", "Requires later evidence review"] }]; }
}
export class DecisionComparisonEngine {
    rank(options) { return [...options].sort((left, right) => right.score - left.score); }
}
export class DecisionScoringEngine {
    score(options, productScore, images, marketingScore, resources) { const imageScore = images.length ? Math.round(images.reduce((sum, item) => sum + item.quality.score, 0) / images.length) : 0; return options.map((option, index) => ({ ...option, score: Math.min(98, Math.max(45, Math.round(productScore * .3 + imageScore * .15 + marketingScore * .25 + (resources.gpuAvailable ? 12 : 7) + [15, 9, 2][index]))) })); }
}
export class StrategySelectionEngine {
    select(options) { return options[0]; }
}
export class WorkflowSelectionEngine {
    select(profile) { return profile.selected.workflow; }
}
export class AiModelSelectionEngine {
    async select(models, task) { const category = task === "video-generation" ? "video" : task === "image-generation" ? "image" : task === "analysis" ? "vision" : "language"; const selected = await models.selectBest(category); return selected ? { id: selected.id, name: selected.name, category: selected.category, reason: "Installed, healthy, and resource-compatible model with the best local selection rank." } : { id: `studio-${category}-base`, name: `Studio ${category} profile`, category, reason: "No installed compatible model is available; use this catalog recommendation after installation and validation." }; }
}
export class ResourceDecisionEngine {
    async analyze(models) { const hardware = await models.detectHardware(); return { availableRamMb: hardware.ram.freeMb, availableStorageMb: hardware.storage.freeMb, gpuAvailable: hardware.gpu.available, recommendation: hardware.gpu.available ? "Use the quality-first workflow with hardware-aware model selection." : "Use balanced local workflow; confirm GPU-intensive models before loading." }; }
}
export class RiskEvaluationEngine {
    evaluate(project, images, resources) { return unique([images.length ? "Image evidence is metadata-derived where visual providers are unavailable." : "No uploaded image evidence is available.", !resources.gpuAvailable ? "No supported GPU detected; resource-heavy model loading may be constrained." : "", !project.campaignInformation.callToAction ? "Campaign CTA is not specified." : ""].filter(Boolean)); }
}
export class ConfidenceScoringEngine {
    score(product, marketing, imageCount, risk) { return Math.min(96, Math.max(45, Math.round(product * .35 + marketing * .35 + Math.min(15, imageCount * 5) + (risk === "low" ? 11 : risk === "medium" ? 6 : 1)))); }
}
export class DecisionValidationEngine {
    validate(project) { const issues = [!project.productInformation.name.trim() ? "Product name is required for a decision." : "", !project.campaignInformation.objective.trim() ? "Campaign objective is required for a decision." : "", !project.targetAudience.trim() ? "Target audience is required for a decision." : ""].filter(Boolean); return { valid: !issues.length, issues }; }
}
export class DecisionExplanationEngine {
    create(selected, model, confidence, learned) { return `${selected.label} was selected because it achieved the highest evidence-weighted score (${selected.score}/100), balances ${selected.resourceCost} resource cost with ${selected.risk} risk, and has ${confidence}% confidence. Model recommendation: ${model.name}. ${learned.length ? `It also considers ${learned.length} compatible prior decision(s).` : "No compatible prior decision is stored yet."}`; }
}
export class DecisionMemoryManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    relevant(project, task) { return this.manager["store"].profiles.filter((item) => item.taskKind === task && item.projectId !== project.id).slice(0, 3).map((item) => `${item.selected.label} (${item.confidence}% confidence)`); }
}
export class DecisionAnalyticsManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    summary() { const profiles = this.manager["store"].profiles; return { decisions: profiles.length, averageConfidence: profiles.length ? Math.round(profiles.reduce((sum, item) => sum + item.confidence, 0) / profiles.length) : 0, qualityFirstSelections: profiles.filter((item) => item.selected.id === "quality-first").length, learnedDecisions: profiles.filter((item) => item.learnedFrom.length > 0).length, cachedDecisions: Object.keys(this.manager["store"].cache).length }; }
}
export class DecisionHistoryManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    record(projectId, event, detail) { this.manager["store"].history.unshift({ id: randomUUID(), at: new Date().toISOString(), projectId, event, detail }); this.manager["store"].history.splice(100); }
}
export class DecisionCacheManager {
    key(project, task) { return createHash("sha256").update(JSON.stringify({ task, product: project.productInformation, brand: project.brandInformation, campaign: project.campaignInformation, audience: project.targetAudience, platform: project.platform, images: project.productImages.map((item) => [item.id, item.fileName, item.sizeBytes]) })).digest("hex"); }
}
function unique(values) { return [...new Set(values)]; }
//# sourceMappingURL=decision-intelligence-manager.js.map