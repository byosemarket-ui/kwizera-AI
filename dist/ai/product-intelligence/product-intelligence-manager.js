import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
const EMPTY = { profiles: [], history: [], cache: {}, logs: [] };
const MATERIALS = [[/steel|metal|insulated|bottle|canister/i, "stainless steel"], [/glass/i, "glass"], [/wood|timber/i, "wood"], [/leather/i, "leather"], [/fabric|textile|cotton/i, "textile"], [/plastic|polymer/i, "polymer"]];
const COLOURS = [[/black|dark/i, "black"], [/white|clear/i, "white"], [/blue/i, "blue"], [/red/i, "red"], [/green/i, "green"], [/gold|yellow/i, "gold"]];
/** Builds a durable digital product profile from workspace evidence; vision providers can replace these local analyzers later. */
export class ProductIntelligenceManager {
    root = "";
    core = null;
    workspace = null;
    imageIntelligence = null;
    store = structuredClone(EMPTY);
    identification = new ProductIdentificationEngine();
    classification = new ProductClassificationEngine();
    multiView = new MultiViewAnalysisEngine();
    reconstruction = new ProductReconstructionEngine();
    shape = new ProductShapeAnalyzer();
    materials = new MaterialDetectionEngine();
    texture = new TextureAnalysisEngine();
    colour = new ColourIntelligenceEngine();
    features = new ProductFeatureExtractor();
    function = new ProductFunctionAnalyzer();
    quality = new ProductQualityAnalyzer();
    brand = new BrandRecognitionEngine();
    relationships = new ProductRelationshipEngine();
    decision = new ProductDecisionEngine();
    metadata = new ProductMetadataManager();
    history = new ProductHistoryManager(this);
    cache = new ProductCacheManager();
    validation = new ProductValidationManager();
    analytics = new ProductAnalyticsManager(this);
    async initialize(storageRoot, dependencies) { this.root = path.join(storageRoot, "product-intelligence-runtime"); this.core = dependencies.core; this.workspace = dependencies.workspace; await fs.mkdir(this.root, { recursive: true }); this.store = await this.readStore(); this.log("info", "Product intelligence runtime restored."); await this.persist(); }
    isInitialized() { return Boolean(this.root); }
    attachImageIntelligence(manager) { this.imageIntelligence = manager; }
    async analyze(projectId) {
        this.ensureReady();
        const project = await this.workspace.getProject(projectId);
        if (!project)
            throw new Error("Project not found");
        const check = this.validation.validate(project);
        if (!check.valid)
            throw new Error(check.issues.join(" "));
        const key = this.cache.key(project);
        const cachedId = this.store.cache[key];
        const cached = cachedId ? this.store.profiles.find((profile) => profile.id === cachedId) : undefined;
        if (cached)
            return { ...cached, cached: true };
        const imageProfiles = this.imageIntelligence ? await this.imageIntelligence.analyzeProject(projectId) : [];
        const profile = this.buildProfile(project, imageProfiles);
        this.store.profiles = this.store.profiles.filter((item) => item.projectId !== projectId);
        this.store.profiles.unshift(profile);
        this.store.cache[key] = profile.id;
        this.history.record(projectId, "analysis", `Built a ${profile.viewCount}-view digital product profile at ${profile.quality.score}/100.`);
        this.log("info", `Product profile analyzed for ${project.name}.`);
        await this.persist();
        return { ...profile };
    }
    async getProfile(projectId) { this.ensureReady(); return this.store.profiles.find((profile) => profile.projectId === projectId) ?? null; }
    async getDashboard(projectId) { const profiles = this.store.profiles.filter((profile) => !projectId || profile.projectId === projectId); return { profiles: structuredClone(profiles), history: this.store.history.filter((item) => !projectId || item.projectId === projectId), logs: [...this.store.logs], analytics: this.analytics.summary(), integrations: { aiCore: Boolean(this.core), productIntelligenceFoundation: Boolean(this.core?.productIntelligenceFoundation), memoryFoundation: Boolean(this.core?.memoryFoundation), knowledgeFoundation: Boolean(this.core?.knowledgeFoundation), stateManager: Boolean(this.core?.stateManager), moduleManager: Boolean(this.core?.moduleManager), creativePipeline: Boolean(this.core?.workflowEngine), generationLayer: Boolean(this.core?.imageGenerationFoundation || this.core?.videoGenerationFoundation) } }; }
    async persist() { await fs.writeFile(path.join(this.root, "profiles.json"), `${JSON.stringify(this.store, null, 2)}\n`, "utf8"); }
    log(level, message) { this.store.logs.unshift({ at: new Date().toISOString(), level, message }); this.store.logs.splice(100); this.core?.logger.info("product-intelligence", message); }
    buildProfile(project, imageProfiles) { const evidence = evidenceText(project); const now = new Date().toISOString(); const category = this.classification.classify(project); const materials = this.materials.detect(evidence, category); const colours = this.colour.detect(evidence, project.productImages.map((image) => image.fileName)); const shape = this.shape.analyze(evidence, category); const features = this.features.extract(project, materials); const functions = this.function.analyze(evidence, category); const view = this.multiView.analyze(project); const brand = this.brand.recognize(project); const quality = this.quality.analyze(project, view, features); const profile = { id: randomUUID(), projectId: project.id, productName: project.productInformation.name, identifiedAs: this.identification.identify(project, category), category, brand, imageIds: project.productImages.map((image) => image.id), viewCount: view.viewCount, materials, colours, textures: this.texture.analyze(evidence, materials), shapes: shape, features, functions, quality, relationships: this.relationships.detect(project, category, brand), metadata: { ...this.metadata.create(project, view), imageIntelligenceProfiles: imageProfiles.length, averageImageQuality: imageProfiles.length ? Math.round(imageProfiles.reduce((sum, item) => sum + item.quality.score, 0) / imageProfiles.length) : 0, imageComposition: imageProfiles[0]?.composition ?? "not analyzed" }, createdAt: now, updatedAt: now, cached: false }; return this.reconstruction.reconstruct(profile); }
    async readStore() { try {
        const value = JSON.parse(await fs.readFile(path.join(this.root, "profiles.json"), "utf8"));
        return { ...structuredClone(EMPTY), ...value, profiles: value.profiles ?? [], history: value.history ?? [], cache: value.cache ?? {}, logs: value.logs ?? [] };
    }
    catch (error) {
        if (error.code === "ENOENT")
            return structuredClone(EMPTY);
        throw error;
    } }
    ensureReady() { if (!this.root || !this.workspace)
        throw new Error("Product Intelligence Manager is not initialized"); }
}
export class ProductIdentificationEngine {
    identify(project, category) { return `${project.productInformation.name || "Unlabeled product"} (${category})`; }
}
export class ProductClassificationEngine {
    classify(project) { const value = `${project.productInformation.category} ${project.productInformation.description}`.toLowerCase(); if (/bottle|drink|beverage|cup|mug/.test(value))
        return "Beverage container"; if (/shoe|apparel|clothing|fashion/.test(value))
        return "Apparel"; if (/phone|device|electronic/.test(value))
        return "Consumer electronics"; if (/beauty|cosmetic|skincare/.test(value))
        return "Beauty and personal care"; return project.productInformation.category.trim() || "General consumer product"; }
}
export class MultiViewAnalysisEngine {
    analyze(project) { return { viewCount: project.productImages.length, coverage: project.productImages.length > 1 ? "multi-view" : "single-view" }; }
}
export class ProductReconstructionEngine {
    reconstruct(profile) { return { ...profile, metadata: { ...profile.metadata, reconstruction: profile.viewCount > 1 ? "multi-view product grouping" : "single-view product representation" } }; }
}
export class ProductShapeAnalyzer {
    analyze(evidence, category) { if (/bottle|container|cylinder/i.test(`${evidence} ${category}`))
        return ["cylindrical", "vertical", "compact"]; if (/box|package|rectangular/i.test(evidence))
        return ["rectangular", "structured"]; return ["product silhouette", "compact form"]; }
}
export class MaterialDetectionEngine {
    detect(evidence, category) { const matches = MATERIALS.filter(([pattern]) => pattern.test(`${evidence} ${category}`)).map(([, material]) => material); return matches.length ? unique(matches) : ["material requires visual-provider verification"]; }
}
export class TextureAnalysisEngine {
    analyze(evidence, materials) { if (/matte/i.test(evidence))
        return ["matte"]; if (/gloss|shiny/i.test(evidence))
        return ["glossy"]; if (materials.includes("stainless steel") || materials.includes("glass"))
        return ["smooth"]; return ["surface texture requires visual-provider verification"]; }
}
export class ColourIntelligenceEngine {
    detect(evidence, names) { const matches = COLOURS.filter(([pattern]) => pattern.test(`${evidence} ${names.join(" ")}`)).map(([, colour]) => colour); return matches.length ? unique(matches) : ["colour requires visual-provider verification"]; }
}
export class ProductFeatureExtractor {
    extract(project, materials) { return unique([project.productInformation.sku ? `SKU ${project.productInformation.sku}` : "", project.productImages.length > 1 ? "multi-angle reference set" : "single reference image", ...materials.filter((material) => !material.includes("verification"))].filter(Boolean)); }
}
export class ProductFunctionAnalyzer {
    analyze(evidence, category) { if (/bottle|beverage container/i.test(`${evidence} ${category}`))
        return ["stores beverages", "supports portable use"]; if (/apparel/i.test(category))
        return ["wearable product"]; return ["function inferred from product category"]; }
}
export class ProductQualityAnalyzer {
    analyze(project, view, features) { const score = Math.min(98, 62 + Math.min(18, view.viewCount * 8) + (project.productInformation.description.length > 24 ? 8 : 0) + (project.brandInformation.name ? 6 : 0) + (features.length > 1 ? 4 : 0)); return { score, confidence: Math.min(96, score - (view.viewCount === 1 ? 12 : 4)), notes: [view.viewCount > 1 ? "Multiple uploaded views were grouped as one product." : "Additional views would improve reconstruction confidence.", "Profile is derived from uploaded metadata and local evidence rules."] }; }
}
export class BrandRecognitionEngine {
    recognize(project) { return project.brandInformation.name.trim() || "brand requires confirmation"; }
}
export class ProductRelationshipEngine {
    detect(project, category, brand) { return [{ type: "belongs-to-brand", target: brand, confidence: brand.includes("requires") ? 45 : 95 }, { type: "classified-as", target: category, confidence: project.productInformation.category ? 88 : 55 }, { type: "used-in-campaign", target: project.campaignInformation.name || "campaign requires confirmation", confidence: 85 }]; }
}
export class ProductDecisionEngine {
    recommend(profile) { return profile.quality.confidence >= 75 ? "Ready for generation context" : "Collect more product views before high-confidence generation"; }
}
export class ProductMetadataManager {
    create(project, view) { return { provider: "local-product-profile-analyzer", imageCount: view.viewCount, viewCoverage: view.coverage, source: "creative-workspace", generatedAt: new Date().toISOString() }; }
}
export class ProductHistoryManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    record(projectId, event, detail) { this.manager["store"].history.unshift({ id: randomUUID(), at: new Date().toISOString(), projectId, event, detail }); this.manager["store"].history.splice(100); }
}
export class ProductCacheManager {
    key(project) { return createHash("sha256").update(JSON.stringify({ productInformation: project.productInformation, brandInformation: project.brandInformation, campaignInformation: project.campaignInformation, images: project.productImages.map((image) => [image.id, image.fileName, image.sizeBytes]) })).digest("hex"); }
}
export class ProductValidationManager {
    validate(project) { const issues = [!project.productInformation.name.trim() ? "Product name is required for analysis." : "", !project.productInformation.description.trim() ? "Product description is required for analysis." : "", !project.productImages.length ? "Upload at least one product image for analysis." : ""].filter(Boolean); return { valid: !issues.length, issues }; }
}
export class ProductAnalyticsManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    summary() { const profiles = this.manager["store"].profiles; return { profiles: profiles.length, multiViewProfiles: profiles.filter((profile) => profile.viewCount > 1).length, averageQuality: profiles.length ? Math.round(profiles.reduce((sum, profile) => sum + profile.quality.score, 0) / profiles.length) : 0, averageConfidence: profiles.length ? Math.round(profiles.reduce((sum, profile) => sum + profile.quality.confidence, 0) / profiles.length) : 0, cachedAnalyses: Object.keys(this.manager["store"].cache).length }; }
}
function evidenceText(project) { return [project.productInformation.name, project.productInformation.category, project.productInformation.description, project.productInformation.sku, project.brandInformation.name, project.brandInformation.guidelines, project.productImages.map((image) => image.fileName).join(" ")].filter(Boolean).join(" "); }
function unique(values) { return [...new Set(values)]; }
//# sourceMappingURL=product-intelligence-manager.js.map