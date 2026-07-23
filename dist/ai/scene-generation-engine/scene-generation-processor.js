import { GenerationAssetType, VideoGenerationHealthLevel, VideoGenerationSource, VideoGenerationVerificationStatus, } from "../video-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../video-generation-foundation/generation-asset-registry.js";
import { ShotType, } from "./types.js";
export class SceneGenerationProcessor {
    foundation;
    analyzer;
    scorer;
    linker;
    records;
    logger;
    constructor(foundation, analyzer, scorer, linker, records, logger) {
        this.foundation = foundation;
        this.analyzer = analyzer;
        this.scorer = scorer;
        this.linker = linker;
        this.records = records;
        this.logger = logger;
    }
    async generateScenes(input) {
        const start = Date.now();
        this.foundation.setLifecycleGenerating();
        try {
            const storyboard = this.resolveStoryboard(input);
            if (!storyboard) {
                return this.reject(start, "Approved storyboard required — provide valid storyboardId", [
                    "Storyboard must exist and be validated before scene generation",
                ]);
            }
            if (!storyboard.validated || !storyboard.productionReady) {
                return this.reject(start, "Storyboard must be validated and production-ready", [
                    "Complete storyboard generation and validation before scene generation",
                ]);
            }
            const sourceScenes = input.sceneId
                ? storyboard.scenes.filter((s) => s.sceneId === input.sceneId)
                : storyboard.scenes;
            if (sourceScenes.length === 0) {
                return this.reject(start, "No scenes found in storyboard", ["Storyboard contains no generatable scenes"]);
            }
            const generated = [];
            const allDiagnostics = [];
            for (const sourceScene of sourceScenes) {
                const existing = this.records.get(sourceScene.sceneId);
                const version = existing ? existing.profile.sceneVersion + 1 : 1;
                const draftBase = this.analyzer.buildSceneRecord(storyboard, sourceScene, version);
                const scores = this.scorer.computeScores(draftBase, storyboard);
                const validation = this.scorer.isSceneValid(scores, draftBase);
                if (!validation.valid) {
                    const repaired = this.applySafeRepairs(draftBase, validation.diagnostics);
                    if (repaired.repaired) {
                        this.logger.log("info", "validation", "Safe scene repairs applied", {
                            sceneId: sourceScene.sceneId,
                            repairs: repaired.repairs,
                        });
                    }
                    const revalidation = this.scorer.isSceneValid(scores, draftBase);
                    if (!revalidation.valid) {
                        allDiagnostics.push(...revalidation.diagnostics.map((d) => `${sourceScene.sceneId}: ${d}`));
                        continue;
                    }
                }
                const draft = {
                    ...draftBase,
                    scores,
                    relationships: this.linker.detectRelationships({ ...draftBase, scores }, storyboard, input),
                    recommendations: this.analyzer.buildRecommendations(draftBase),
                    validated: true,
                    productionReady: this.scorer.isProductionReady(scores, draftBase),
                    marketingReady: this.scorer.isMarketingReady(draftBase.structure),
                    brandConsistent: this.scorer.isBrandConsistent(scores),
                    createdAt: existing?.createdAt ?? new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                };
                const generationValidation = this.foundation.validateGeneration({
                    qualityScore: scores.sceneQualityScore,
                    confidenceScore: scores.aiConfidenceScore,
                    verificationStatus: scores.aiConfidenceScore >= 75
                        ? VideoGenerationVerificationStatus.Verified
                        : VideoGenerationVerificationStatus.Pending,
                    source: VideoGenerationSource.Storyboard,
                    sourceRef: draft.sceneId,
                    versionHistory: [
                        {
                            version,
                            timestamp: new Date().toISOString(),
                            changeSummary: `Scene v${version} — ${draft.shots.length} shots`,
                            source: VideoGenerationSource.Storyboard,
                        },
                    ],
                    relationshipLinks: [
                        ...draft.relationships.storyboards,
                        ...draft.relationships.products,
                        draft.sceneId,
                    ],
                    healthStatus: VideoGenerationHealthLevel.Good,
                });
                if (!generationValidation.valid) {
                    allDiagnostics.push(...generationValidation.issues.map((i) => `${sourceScene.sceneId}: ${i}`));
                    continue;
                }
                this.records.upsert(draft);
                this.registerGenerationAsset(draft, storyboard);
                generated.push(draft);
                this.logger.log("info", "generation", "Scene blueprint generated", {
                    sceneId: draft.sceneId,
                    shots: draft.shots.length,
                    productionReady: draft.productionReady,
                });
                this.logger.log("info", "shot-planning", "Shot sequence planned", {
                    sceneId: draft.sceneId,
                    shotCount: draft.shots.length,
                });
            }
            if (generated.length === 0) {
                return {
                    success: false,
                    durationMs: Date.now() - start,
                    diagnostics: allDiagnostics.length > 0 ? allDiagnostics : ["No scenes passed validation"],
                    message: "Scene generation failed — every scene must pass validation before approval",
                };
            }
            if (generated.some((s) => s.recommendations.length > 0)) {
                this.logger.log("info", "recommendation", "Scene generation recommendations", {
                    count: generated.reduce((n, s) => n + s.recommendations.length, 0),
                });
            }
            this.logger.log("info", "relationship", "Scene relationships linked", {
                sceneCount: generated.length,
                storyboardId: storyboard.storyboardId,
            });
            return {
                success: true,
                scenes: generated,
                record: generated.length === 1 ? generated[0] : undefined,
                durationMs: Date.now() - start,
                diagnostics: allDiagnostics,
            };
        }
        finally {
            this.foundation.setLifecycleReady();
        }
    }
    search(query) {
        let results = this.records.getAll();
        if (query.sceneId)
            results = results.filter((r) => r.sceneId === query.sceneId);
        if (query.storyboardId)
            results = results.filter((r) => r.profile.storyboardId === query.storyboardId);
        if (query.productId)
            results = results.filter((r) => r.profile.productId === query.productId);
        if (query.brandId)
            results = results.filter((r) => r.profile.brandId === query.brandId);
        if (query.campaignId)
            results = results.filter((r) => r.profile.campaignId === query.campaignId);
        if (query.platform)
            results = results.filter((r) => r.profile.platform === query.platform);
        if (query.sceneType)
            results = results.filter((r) => r.structure.sceneType === query.sceneType);
        if (query.keywords) {
            const kw = query.keywords.toLowerCase();
            results = results.filter((r) => r.structure.scenePurpose.toLowerCase().includes(kw) ||
                r.structure.sceneObjectives.some((o) => o.toLowerCase().includes(kw)));
        }
        if (query.text) {
            const textLower = query.text.toLowerCase();
            results = results.filter((r) => r.sceneId.toLowerCase().includes(textLower) ||
                r.structure.scenePurpose.toLowerCase().includes(textLower));
        }
        return results.slice(0, query.limit ?? 50);
    }
    resolveStoryboard(input) {
        const storyEngine = this.foundation.getStoryGenerationEngine();
        return storyEngine.getStoryboard(input.storyboardId) ?? null;
    }
    registerGenerationAsset(record, storyboard) {
        this.foundation.assetRegistry.registerAsset({
            assetId: record.sceneId,
            assetType: GenerationAssetType.Scene,
            assetName: `Scene ${record.structure.sceneOrder}: ${record.structure.scenePurpose}`,
            projectId: record.profile.projectId,
            sceneId: record.sceneId,
            ...createDefaultGenerationAssetQuality(VideoGenerationSource.Storyboard),
            qualityScore: record.scores.sceneQualityScore,
            confidenceScore: record.scores.aiConfidenceScore,
            relationshipLinks: [storyboard.storyboardId, ...record.relationships.products],
            relatedProducts: record.relationships.products,
            relatedBrands: record.relationships.brands,
            relatedCampaigns: record.relationships.campaigns,
            relatedKnowledge: record.relationships.knowledgeRecords,
            relatedProductionPlans: record.relationships.motionPlans,
        });
        const project = this.foundation.getProjectManager().getProject(record.profile.projectId);
        if (project) {
            this.foundation.getProjectManager().registerScene(record.profile.projectId, record.sceneId);
        }
    }
    applySafeRepairs(draft, diagnostics) {
        const repairs = [];
        if (diagnostics.some((d) => d.includes("at least one shot")) && draft.shots.length === 0) {
            draft.shots.push({
                shotId: `${draft.sceneId}-shot-repair-1`,
                shotOrder: 1,
                shotDuration: draft.structure.sceneDuration,
                shotType: ShotType.Medium,
                cameraAngle: draft.cameraPlanning.primaryAngle,
                cameraMovement: draft.cameraPlanning.primaryMovement,
                framing: "Standard coverage framing",
                focusPoint: "Scene subject",
                motionInstructions: "Static establishing shot",
            });
            repairs.push("Added default repair shot");
        }
        if (diagnostics.some((d) => d.includes("Scene duration")) && !draft.structure.sceneDuration) {
            draft.structure.sceneDuration = "8s";
            repairs.push("Set default scene duration");
        }
        return { repaired: repairs.length > 0, repairs };
    }
    reject(start, message, diagnostics) {
        this.logger.log("warn", "validation", message, { diagnostics });
        return { success: false, durationMs: Date.now() - start, diagnostics, message };
    }
}
//# sourceMappingURL=scene-generation-processor.js.map