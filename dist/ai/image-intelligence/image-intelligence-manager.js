import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
const EMPTY = { profiles: [], history: [], cache: {}, logs: [] };
/** Persists local image evidence profiles; a vision provider can replace individual analyzers without changing this API. */
export class ImageIntelligenceManager {
    root = "";
    core = null;
    workspace = null;
    store = structuredClone(EMPTY);
    analysis = new ImageAnalysisEngine();
    quality = new ImageQualityAnalyzer();
    background = new BackgroundAnalysisEngine();
    backgroundRemoval = new BackgroundRemovalAnalyzer();
    lighting = new LightingAnalysisEngine();
    shadow = new ShadowAnalysisEngine();
    reflection = new ReflectionAnalysisEngine();
    camera = new CameraAngleAnalyzer();
    composition = new CompositionAnalyzer();
    perspective = new PerspectiveAnalyzer();
    objects = new ObjectDetectionEngine();
    scene = new SceneUnderstandingEngine();
    enhancement = new ImageEnhancementDecisionEngine();
    defects = new ImageDefectDetectionEngine();
    metadata = new ImageMetadataManager();
    history = new ImageHistoryManager(this);
    cache = new ImageCacheManager();
    validation = new ImageValidationManager();
    analytics = new ImageAnalyticsManager(this);
    async initialize(storageRoot, dependencies) { this.root = path.join(storageRoot, "image-intelligence-runtime"); this.core = dependencies.core; this.workspace = dependencies.workspace; await fs.mkdir(this.root, { recursive: true }); this.store = await this.readStore(); this.log("info", "Image intelligence runtime restored."); await this.persist(); }
    isInitialized() { return Boolean(this.root); }
    async analyzeProject(projectId) { this.ensureReady(); const project = await this.workspace.getProject(projectId); if (!project)
        throw new Error("Project not found"); const validation = this.validation.validate(project); if (!validation.valid)
        throw new Error(validation.issues.join(" ")); return Promise.all(project.productImages.map((image) => this.analyzeImage(project, image))); }
    async analyzeImage(project, image) { const key = this.cache.key(project, image); const cachedId = this.store.cache[key]; const cached = cachedId ? this.store.profiles.find((profile) => profile.id === cachedId) : undefined; if (cached)
        return { ...cached, cached: true }; const profile = this.buildProfile(project, image); this.store.profiles = this.store.profiles.filter((item) => item.imageId !== image.id); this.store.profiles.unshift(profile); this.store.cache[key] = profile.id; this.history.record(project.id, image.id, "analysis", `Analyzed ${image.fileName}: ${profile.quality.score}/100 quality.`); this.log("info", `Image intelligence profile created for ${image.fileName}.`); await this.persist(); return { ...profile }; }
    async getProfiles(projectId) { return this.store.profiles.filter((profile) => profile.projectId === projectId).map((profile) => ({ ...profile })); }
    async getDashboard(projectId) { const profiles = this.store.profiles.filter((profile) => !projectId || profile.projectId === projectId); return { profiles: structuredClone(profiles), history: this.store.history.filter((item) => !projectId || item.projectId === projectId), logs: [...this.store.logs], analytics: this.analytics.summary(), integrations: { aiCore: Boolean(this.core), imageIntelligenceFoundation: Boolean(this.core?.imageIntelligenceFoundation), productIntelligenceFoundation: Boolean(this.core?.productIntelligenceFoundation), memoryFoundation: Boolean(this.core?.memoryFoundation), knowledgeFoundation: Boolean(this.core?.knowledgeFoundation), stateManager: Boolean(this.core?.stateManager), moduleManager: Boolean(this.core?.moduleManager), creativePipeline: Boolean(this.core?.workflowEngine), generationLayer: Boolean(this.core?.imageGenerationFoundation || this.core?.videoGenerationFoundation) } }; }
    async persist() { await fs.writeFile(path.join(this.root, "profiles.json"), `${JSON.stringify(this.store, null, 2)}\n`, "utf8"); }
    log(level, message) { this.store.logs.unshift({ at: new Date().toISOString(), level, message }); this.store.logs.splice(100); this.core?.logger.info("image-intelligence", message); }
    buildProfile(project, image) { const evidence = `${project.productInformation.name} ${project.productInformation.description} ${image.fileName}`; const quality = this.quality.analyze(image); const background = this.background.analyze(evidence); const objects = this.objects.detect(project, image); const profile = { id: randomUUID(), projectId: project.id, imageId: image.id, fileName: image.fileName, mimeType: image.mimeType, quality, background, lighting: this.lighting.analyze(evidence), shadows: this.shadow.analyze(evidence), reflections: this.reflection.analyze(evidence), cameraAngle: this.camera.analyze(evidence), composition: this.composition.analyze(evidence), perspective: this.perspective.analyze(evidence), objects, scene: this.scene.understand(project, objects, background), defects: this.defects.detect(image, quality), enhancements: [], metadata: this.metadata.create(image), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), cached: false }; profile.enhancements = this.enhancement.recommend(profile); return this.analysis.finalize(profile); }
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
        throw new Error("Image Intelligence Manager is not initialized"); }
}
export class ImageAnalysisEngine {
    finalize(profile) { return { ...profile, metadata: { ...profile.metadata, provider: "local-image-evidence-analyzer" } }; }
}
export class ImageQualityAnalyzer {
    analyze(image) { const sizeScore = image.sizeBytes > 100_000 ? 20 : image.sizeBytes > 10_000 ? 14 : 7; const score = Math.min(94, 58 + sizeScore + (image.mimeType === "image/png" ? 8 : 5)); return { score, confidence: Math.min(88, score - 8), notes: [image.sizeBytes < 10_000 ? "Small source file may limit detail retention." : "Source file size supports standard creative use.", "Quality is assessed from file metadata until a pixel-level provider is configured."] }; }
}
export class BackgroundAnalysisEngine {
    analyze(evidence) { if (/studio|white|plain|isolated/i.test(evidence))
        return { type: "controlled studio background", removable: true, confidence: 72 }; if (/outdoor|street|nature|lifestyle/i.test(evidence))
        return { type: "environmental background", removable: true, confidence: 68 }; return { type: "background requires visual-provider verification", removable: false, confidence: 38 }; }
}
export class BackgroundRemovalAnalyzer {
    analyze(background) { return background.removable ? "Background separation is a suitable future enhancement." : "Confirm subject boundary with a visual provider before background removal."; }
}
export class LightingAnalysisEngine {
    analyze(evidence) { if (/studio|bright|light/i.test(evidence))
        return "controlled or bright lighting inferred from context"; if (/dark|night/i.test(evidence))
        return "low-light context inferred"; return "lighting requires visual-provider verification"; }
}
export class ShadowAnalysisEngine {
    analyze(evidence) { return /shadow/i.test(evidence) ? "shadow mentioned in source evidence" : "shadow requires visual-provider verification"; }
}
export class ReflectionAnalysisEngine {
    analyze(evidence) { return /glass|steel|metal|reflect/i.test(evidence) ? "reflective material may create highlights" : "reflection requires visual-provider verification"; }
}
export class CameraAngleAnalyzer {
    analyze(evidence) { if (/front/i.test(evidence))
        return "front product view"; if (/side/i.test(evidence))
        return "side product view"; if (/top|overhead/i.test(evidence))
        return "top-down view"; return "camera angle requires visual-provider verification"; }
}
export class CompositionAnalyzer {
    analyze(evidence) { return /studio|product/i.test(evidence) ? "product-focused composition inferred" : "composition requires visual-provider verification"; }
}
export class PerspectiveAnalyzer {
    analyze(evidence) { return /front|side|top|overhead/i.test(evidence) ? "perspective inferred from image naming" : "perspective requires visual-provider verification"; }
}
export class ObjectDetectionEngine {
    detect(project, image) { return [{ label: project.productInformation.name || "primary product", confidence: 86 }, ...(image.fileName.toLowerCase().includes("bottle") ? [{ label: "bottle", confidence: 82 }] : [])]; }
}
export class SceneUnderstandingEngine {
    understand(project, objects, background) { return `${project.productInformation.name || objects[0]?.label || "Product"} in ${background.type}; ${objects.length} object label(s) recorded.`; }
}
export class ImageEnhancementDecisionEngine {
    recommend(profile) { return unique([profile.quality.score < 75 ? "Use a higher-resolution source image." : "Preserve source resolution for generation.", profile.background.removable ? "Prepare subject mask for background variations." : "Verify background boundaries before removal.", profile.cameraAngle.includes("requires") ? "Capture named front, side, and detail views for stronger camera planning." : "Use this identified view in camera planning.", ...profile.defects.map((defect) => `Address: ${defect}`)]); }
}
export class ImageDefectDetectionEngine {
    detect(image, quality) { return unique([...(image.sizeBytes < 10_000 ? ["limited source resolution"] : []), ...(quality.score < 70 ? ["metadata quality below preferred threshold"] : [])]); }
}
export class ImageMetadataManager {
    create(image) { return { source: "creative-workspace", sizeBytes: image.sizeBytes, mimeType: image.mimeType, uploadedAt: image.uploadedAt, generatedAt: new Date().toISOString() }; }
}
export class ImageHistoryManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    record(projectId, imageId, event, detail) { this.manager["store"].history.unshift({ id: randomUUID(), at: new Date().toISOString(), projectId, imageId, event, detail }); this.manager["store"].history.splice(100); }
}
export class ImageCacheManager {
    key(project, image) { return createHash("sha256").update(JSON.stringify({ project: project.id, product: project.productInformation, image: [image.id, image.fileName, image.mimeType, image.sizeBytes] })).digest("hex"); }
}
export class ImageValidationManager {
    validate(project) { const issues = [!project.productImages.length ? "Upload at least one product image for analysis." : ""].filter(Boolean); return { valid: !issues.length, issues }; }
}
export class ImageAnalyticsManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    summary() { const profiles = this.manager["store"].profiles; return { analyzedImages: profiles.length, averageQuality: profiles.length ? Math.round(profiles.reduce((sum, profile) => sum + profile.quality.score, 0) / profiles.length) : 0, removableBackgrounds: profiles.filter((profile) => profile.background.removable).length, defectFlags: profiles.reduce((sum, profile) => sum + profile.defects.length, 0), cachedAnalyses: Object.keys(this.manager["store"].cache).length }; }
}
function unique(values) { return [...new Set(values)]; }
//# sourceMappingURL=image-intelligence-manager.js.map