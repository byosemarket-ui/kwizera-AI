import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
const EMPTY = { profiles: [], history: [], cache: {}, logs: [] };
/** Builds durable campaign strategy profiles from workspace and intelligence evidence without producing creative media. */
export class MarketingIntelligenceManager {
    root = "";
    core = null;
    workspace = null;
    products = null;
    images = null;
    store = structuredClone(EMPTY);
    analysis = new MarketingAnalysisEngine();
    audience = new AudienceAnalysisEngine();
    brand = new BrandIntelligenceEngine();
    campaign = new CampaignIntelligenceEngine();
    sellingPoints = new ProductSellingPointAnalyzer();
    value = new ValuePropositionEngine();
    cta = new CallToActionEngine();
    platform = new PlatformOptimizationEngine();
    content = new ContentStrategyEngine();
    competitors = new CompetitorAnalysisEngine();
    recommendations = new MarketingRecommendationEngine();
    decision = new MarketingDecisionEngine();
    metadata = new MarketingMetadataManager();
    history = new MarketingHistoryManager(this);
    cache = new MarketingCacheManager();
    validation = new MarketingValidationManager();
    analytics = new MarketingAnalyticsManager(this);
    async initialize(storageRoot, dependencies) { this.root = path.join(storageRoot, "marketing-intelligence-runtime"); this.core = dependencies.core; this.workspace = dependencies.workspace; this.products = dependencies.products; this.images = dependencies.images; await fs.mkdir(this.root, { recursive: true }); this.store = await this.readStore(); this.log("info", "Marketing intelligence runtime restored."); await this.persist(); }
    isInitialized() { return Boolean(this.root); }
    async analyze(projectId) { this.ensureReady(); const project = await this.workspace.getProject(projectId); if (!project)
        throw new Error("Project not found"); const check = this.validation.validate(project); if (!check.valid)
        throw new Error(check.issues.join(" ")); const key = this.cache.key(project); const cachedId = this.store.cache[key]; const cached = cachedId ? this.store.profiles.find((profile) => profile.id === cachedId) : undefined; if (cached)
        return { ...cached, cached: true }; const [product, images] = await Promise.all([this.products.analyze(projectId), this.images.analyzeProject(projectId)]); const profile = this.buildProfile(project, product, images); this.store.profiles = this.store.profiles.filter((item) => item.projectId !== projectId); this.store.profiles.unshift(profile); this.store.cache[key] = profile.id; this.history.record(projectId, "analysis", `Built marketing strategy profile at ${profile.score}/100.`); this.log("info", `Marketing profile analyzed for ${project.name}.`); await this.persist(); return { ...profile }; }
    async getProfile(projectId) { return this.store.profiles.find((profile) => profile.projectId === projectId) ?? null; }
    async getDashboard(projectId) { const profiles = this.store.profiles.filter((profile) => !projectId || profile.projectId === projectId); return { profiles: structuredClone(profiles), history: this.store.history.filter((item) => !projectId || item.projectId === projectId), logs: [...this.store.logs], analytics: this.analytics.summary(), integrations: { aiCore: Boolean(this.core), productIntelligence: Boolean(this.products), imageIntelligence: Boolean(this.images), productIntelligenceFoundation: Boolean(this.core?.productIntelligenceFoundation), imageIntelligenceFoundation: Boolean(this.core?.imageIntelligenceFoundation), memoryFoundation: Boolean(this.core?.memoryFoundation), knowledgeFoundation: Boolean(this.core?.knowledgeFoundation), stateManager: Boolean(this.core?.stateManager), moduleManager: Boolean(this.core?.moduleManager), creativePipeline: Boolean(this.core?.workflowEngine), generationLayer: Boolean(this.core?.imageGenerationFoundation || this.core?.videoGenerationFoundation) } }; }
    async persist() { await fs.writeFile(path.join(this.root, "profiles.json"), `${JSON.stringify(this.store, null, 2)}\n`, "utf8"); }
    log(level, message) { this.store.logs.unshift({ at: new Date().toISOString(), level, message }); this.store.logs.splice(100); this.core?.logger.info("marketing-intelligence", message); }
    buildProfile(project, product, images) { const audience = this.audience.analyze(project); const brand = this.brand.analyze(project); const campaign = this.campaign.analyze(project); const sellingPoints = this.sellingPoints.analyze(project, product, images); const platform = this.platform.optimize(project.platform); const ctas = this.cta.create(project, campaign); const value = this.value.create(project, sellingPoints, audience); const strategy = this.content.create(project, value, platform, ctas[0]); const score = this.analysis.score(project, product, images, sellingPoints); return { id: randomUUID(), projectId: project.id, productOverview: `${product.identifiedAs}; ${product.materials.join(", ")}; ${product.viewCount} reference view(s).`, audience, brand, campaign, sellingPoints, valueProposition: value, strategy, ctas, platform, competitors: this.competitors.analyze(project, product.category), recommendations: this.recommendations.create(project, platform, images), score, performancePrediction: this.decision.predict(score, platform), metadata: this.metadata.create(product, images), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), cached: false }; }
    async readStore() { try {
        const value = JSON.parse(await fs.readFile(path.join(this.root, "profiles.json"), "utf8"));
        return { ...structuredClone(EMPTY), ...value, profiles: value.profiles ?? [], history: value.history ?? [], cache: value.cache ?? {}, logs: value.logs ?? [] };
    }
    catch (error) {
        if (error.code === "ENOENT")
            return structuredClone(EMPTY);
        throw error;
    } }
    ensureReady() { if (!this.root || !this.workspace || !this.products || !this.images)
        throw new Error("Marketing Intelligence Manager is not initialized"); }
}
export class MarketingAnalysisEngine {
    score(project, product, images, sellingPoints) { const imageScore = images.length ? Math.round(images.reduce((sum, image) => sum + image.quality.score, 0) / images.length) : 0; return Math.min(97, Math.round(product.quality.score * .4 + imageScore * .2 + Math.min(20, sellingPoints.length * 4) + (project.campaignInformation.callToAction ? 10 : 5) + (project.brandInformation.voice ? 7 : 3))); }
}
export class AudienceAnalysisEngine {
    analyze(project) { const audience = project.targetAudience || "campaign audience requires confirmation"; return { persona: audience, needs: [/active|urban/i.test(audience) ? "portable everyday utility" : "clear product relevance", "credible benefit proof"], messaging: `Speak directly to ${audience} with benefit-led, understandable language.` }; }
}
export class BrandIntelligenceEngine {
    analyze(project) { return { identity: project.brandInformation.name || "brand requires confirmation", voice: project.brandInformation.voice || "clear and confident", consistency: project.brandInformation.guidelines || "Keep product, tone, and CTA consistent across every campaign asset." }; }
}
export class CampaignIntelligenceEngine {
    analyze(project) { return { name: project.campaignInformation.name || "campaign requires confirmation", objective: project.campaignInformation.objective || "objective requires confirmation", goal: `Move the audience toward ${project.campaignInformation.objective || "the next campaign action"}.` }; }
}
export class ProductSellingPointAnalyzer {
    analyze(project, product, images) { return unique([project.productInformation.description, ...product.features, ...product.functions, ...product.materials.filter((item) => !item.includes("verification")), images.length > 1 ? "multiple product reference views" : "product reference image"].filter(Boolean)); }
}
export class ValuePropositionEngine {
    create(project, points, audience) { return `${project.productInformation.name} gives ${audience.persona} ${points.slice(0, 3).join(", ")}.`; }
}
export class CallToActionEngine {
    create(project, campaign) { return unique([project.campaignInformation.callToAction || `Discover ${project.productInformation.name}`, `See how ${project.productInformation.name} supports your day`, campaign.objective.toLowerCase().includes("awareness") ? "Learn more" : "Take the next step"]); }
}
export class PlatformOptimizationEngine {
    optimize(platform) { const guides = { instagram: { format: "vertical visual-first social content", recommendations: ["Lead with a product hook in the first three seconds.", "Use concise benefit-led captions and a direct CTA."] }, tiktok: { format: "native vertical short-form content", recommendations: ["Use an authentic, fast demonstration.", "Frame the value as a practical audience insight."] }, linkedin: { format: "credible professional social content", recommendations: ["Lead with evidence and clear business relevance.", "Use a considered CTA and polished brand treatment."] }, facebook: { format: "trust-building social content", recommendations: ["Make the core benefit readable early.", "Use clear proof and a simple closing action."] }, youtube: { format: "narrative video content", recommendations: ["Build value through a clear narrative arc.", "Use a memorable final CTA."] } }; const guide = guides[platform] ?? guides.instagram; return { name: platform, ...guide }; }
}
export class ContentStrategyEngine {
    create(project, value, platform, cta) { return `For ${platform.name}, lead with ${value} Use ${platform.format}, product proof, and finish with “${cta}”.`; }
}
export class CompetitorAnalysisEngine {
    analyze(project, category) { return [`Category benchmark: ${category} campaigns compete for immediate audience relevance.`, `Differentiate ${project.brandInformation.name || "the brand"} through concrete product proof, not unsupported competitor claims.`]; }
}
export class MarketingRecommendationEngine {
    create(project, platform, images) { return unique([...platform.recommendations, ...(images[0]?.enhancements?.slice(0, 2) ?? []), `Align every asset with ${project.brandInformation.name || "the brand"} voice and campaign objective.`]); }
}
export class MarketingDecisionEngine {
    predict(score, platform) { return score >= 80 ? `Strong readiness for ${platform.name} creative planning.` : "Improve product evidence, CTA clarity, or audience definition before high-confidence creative planning."; }
}
export class MarketingMetadataManager {
    create(product, images) { return { provider: "local-marketing-strategy-analyzer", productProfileId: product.id, imageProfileCount: images.length, productQuality: product.quality.score, generatedAt: new Date().toISOString() }; }
}
export class MarketingHistoryManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    record(projectId, event, detail) { this.manager["store"].history.unshift({ id: randomUUID(), at: new Date().toISOString(), projectId, event, detail }); this.manager["store"].history.splice(100); }
}
export class MarketingCacheManager {
    key(project) { return createHash("sha256").update(JSON.stringify({ product: project.productInformation, brand: project.brandInformation, campaign: project.campaignInformation, audience: project.targetAudience, platform: project.platform, images: project.productImages.map((image) => [image.id, image.fileName, image.sizeBytes]) })).digest("hex"); }
}
export class MarketingValidationManager {
    validate(project) { const issues = [!project.productInformation.name.trim() ? "Product name is required for marketing analysis." : "", !project.targetAudience.trim() ? "Target audience is required for marketing analysis." : "", !project.campaignInformation.objective.trim() ? "Campaign objective is required for marketing analysis." : "", !project.brandInformation.name.trim() ? "Brand name is required for marketing analysis." : ""].filter(Boolean); return { valid: !issues.length, issues }; }
}
export class MarketingAnalyticsManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    summary() { const profiles = this.manager["store"].profiles; return { profiles: profiles.length, averageScore: profiles.length ? Math.round(profiles.reduce((sum, profile) => sum + profile.score, 0) / profiles.length) : 0, platformOptimized: profiles.filter((profile) => profile.platform.recommendations.length > 0).length, ctaSuggestions: profiles.reduce((sum, profile) => sum + profile.ctas.length, 0), cachedAnalyses: Object.keys(this.manager["store"].cache).length }; }
}
function unique(values) { return [...new Set(values)]; }
//# sourceMappingURL=marketing-intelligence-manager.js.map