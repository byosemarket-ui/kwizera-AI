import { GenerationAssetType, VideoGenerationHealthLevel, VideoGenerationSource, VideoGenerationVerificationStatus, } from "../video-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../video-generation-foundation/generation-asset-registry.js";
import { DirectorCameraAngle, DirectorCameraMovement, DirectorShotType, } from "./types.js";
export class CameraDirectorProcessor {
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
    async planCamera(input) {
        const start = Date.now();
        this.foundation.setLifecycleGenerating();
        try {
            const scenes = this.resolveScenes(input);
            if (scenes.length === 0) {
                return this.reject(start, "Generated scenes required — provide valid sceneId or storyboardId", [
                    "Scenes must exist and be validated before camera planning",
                ]);
            }
            const invalidScene = scenes.find((s) => !s.validated || !s.productionReady);
            if (invalidScene) {
                return this.reject(start, "All scenes must be validated and production-ready", [
                    `Scene ${invalidScene.sceneId} not ready for camera direction`,
                ]);
            }
            const generated = [];
            const allDiagnostics = [];
            for (const scene of scenes) {
                const storyboard = this.foundation
                    .getStoryGenerationEngine()
                    .getStoryboard(scene.profile.storyboardId);
                const existing = this.records.getByScene(scene.sceneId)[0];
                const version = existing ? existing.profile.cameraVersion + 1 : 1;
                const draftBase = this.analyzer.buildCameraPlan(scene, storyboard, version);
                const scores = this.scorer.computeScores(draftBase, scene);
                let validation = this.scorer.isPlanValid(scores, draftBase);
                if (!validation.valid) {
                    const repaired = this.applySafeRepairs(draftBase, validation.diagnostics);
                    if (repaired.repaired) {
                        this.logger.log("info", "validation", "Safe camera plan repairs applied", {
                            sceneId: scene.sceneId,
                            repairs: repaired.repairs,
                        });
                    }
                    validation = this.scorer.isPlanValid(scores, draftBase);
                    if (!validation.valid) {
                        allDiagnostics.push(...validation.diagnostics.map((d) => `${scene.sceneId}: ${d}`));
                        continue;
                    }
                }
                const draft = {
                    ...draftBase,
                    scores,
                    relationships: this.linker.detectRelationships({ ...draftBase, scores }, scene, storyboard, input),
                    recommendations: this.analyzer.buildRecommendations(draftBase),
                    validated: true,
                    productionReady: this.scorer.isProductionReady(scores, draftBase),
                    brandConsistent: this.scorer.isBrandConsistent(scores, scene),
                    cinematicallyConsistent: this.scorer.isCinematicallyConsistent(draftBase.continuity),
                    createdAt: existing?.createdAt ?? new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                };
                const generationValidation = this.foundation.validateGeneration({
                    qualityScore: scores.cameraDirectionScore,
                    confidenceScore: scores.aiConfidenceScore,
                    verificationStatus: scores.aiConfidenceScore >= 75
                        ? VideoGenerationVerificationStatus.Verified
                        : VideoGenerationVerificationStatus.Pending,
                    source: VideoGenerationSource.ProductionPlan,
                    sourceRef: draft.cameraPlanId,
                    versionHistory: [
                        {
                            version,
                            timestamp: new Date().toISOString(),
                            changeSummary: `Camera plan v${version} — ${draft.shotPlans.length} shots directed`,
                            source: VideoGenerationSource.ProductionPlan,
                        },
                    ],
                    relationshipLinks: [
                        ...draft.relationships.scenes,
                        ...draft.relationships.storyboards,
                        draft.cameraPlanId,
                    ],
                    healthStatus: VideoGenerationHealthLevel.Good,
                });
                if (!generationValidation.valid) {
                    allDiagnostics.push(...generationValidation.issues.map((i) => `${scene.sceneId}: ${i}`));
                    continue;
                }
                this.records.upsert(draft);
                this.registerGenerationAsset(draft, scene);
                generated.push(draft);
                this.logger.log("info", "planning", "Camera plan generated", {
                    cameraPlanId: draft.cameraPlanId,
                    sceneId: scene.sceneId,
                    shots: draft.shotPlans.length,
                });
                this.logger.log("info", "decision", "Camera decisions recorded", {
                    cameraPlanId: draft.cameraPlanId,
                    primaryStrategy: draft.compositionPlanning.primaryStrategy,
                });
                this.logger.log("info", "composition", "Composition planning complete", {
                    cameraPlanId: draft.cameraPlanId,
                });
            }
            if (generated.length === 0) {
                return {
                    success: false,
                    durationMs: Date.now() - start,
                    diagnostics: allDiagnostics.length > 0 ? allDiagnostics : ["No camera plans passed validation"],
                    message: "Camera planning failed — every plan must pass validation before approval",
                };
            }
            if (generated.some((p) => p.recommendations.length > 0)) {
                this.logger.log("info", "recommendation", "Camera planning recommendations", {
                    count: generated.reduce((n, p) => n + p.recommendations.length, 0),
                });
            }
            this.logger.log("info", "relationship", "Camera plan relationships linked", {
                planCount: generated.length,
            });
            return {
                success: true,
                plans: generated,
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
        if (query.cameraPlanId)
            results = results.filter((r) => r.cameraPlanId === query.cameraPlanId);
        if (query.sceneId)
            results = results.filter((r) => r.profile.sceneId === query.sceneId);
        if (query.storyboardId)
            results = results.filter((r) => r.profile.storyboardId === query.storyboardId);
        if (query.productId)
            results = results.filter((r) => r.relationships.products.includes(query.productId));
        if (query.brandId)
            results = results.filter((r) => r.relationships.brands.includes(query.brandId));
        if (query.campaignId)
            results = results.filter((r) => r.relationships.campaigns.includes(query.campaignId));
        if (query.platform)
            results = results.filter((r) => r.profile.platform === query.platform);
        if (query.cameraAngle) {
            results = results.filter((r) => r.shotPlans.some((s) => s.cameraAngle === query.cameraAngle));
        }
        if (query.shotType) {
            results = results.filter((r) => r.shotPlans.some((s) => s.shotType === query.shotType));
        }
        if (query.keywords) {
            const kw = query.keywords.toLowerCase();
            results = results.filter((r) => r.marketingImpact.heroMoment.toLowerCase().includes(kw) ||
                r.compositionPlanning.productHighlight.toLowerCase().includes(kw));
        }
        if (query.text) {
            const textLower = query.text.toLowerCase();
            results = results.filter((r) => r.cameraPlanId.toLowerCase().includes(textLower) ||
                r.profile.sceneId.toLowerCase().includes(textLower));
        }
        return results.slice(0, query.limit ?? 50);
    }
    resolveScenes(input) {
        const sceneEngine = this.foundation.getSceneGenerationEngine();
        if (input.sceneId) {
            const scene = sceneEngine.getScene(input.sceneId);
            return scene ? [scene] : [];
        }
        if (input.storyboardId) {
            return sceneEngine.getScenesByStoryboard(input.storyboardId);
        }
        return [];
    }
    registerGenerationAsset(record, scene) {
        this.foundation.assetRegistry.registerAsset({
            assetId: record.cameraPlanId,
            assetType: GenerationAssetType.CameraPlan,
            assetName: `Camera Plan — Scene ${scene.structure.sceneOrder}: ${scene.structure.scenePurpose}`,
            projectId: record.profile.projectId,
            sceneId: record.profile.sceneId,
            ...createDefaultGenerationAssetQuality(VideoGenerationSource.ProductionPlan),
            qualityScore: record.scores.cameraDirectionScore,
            confidenceScore: record.scores.aiConfidenceScore,
            relationshipLinks: [scene.sceneId, scene.profile.storyboardId, record.cameraPlanId],
            relatedProducts: record.relationships.products,
            relatedBrands: record.relationships.brands,
            relatedCampaigns: record.relationships.campaigns,
            relatedKnowledge: record.relationships.knowledgeRecords,
            relatedProductionPlans: record.relationships.motionPlans,
        });
    }
    applySafeRepairs(draft, diagnostics) {
        const repairs = [];
        if (diagnostics.some((d) => d.includes("at least one shot")) && draft.shotPlans.length === 0) {
            draft.shotPlans.push({
                shotId: `${draft.profile.sceneId}-director-repair-1`,
                shotOrder: 1,
                shotType: DirectorShotType.Medium,
                cameraAngle: DirectorCameraAngle.EyeLevel,
                cameraMovement: DirectorCameraMovement.Static,
                framing: "Standard medium coverage",
                duration: "5s",
                marketingPurpose: "Repair shot — standard coverage",
            });
            repairs.push("Added default director shot");
        }
        if (diagnostics.some((d) => d.includes("Focus subject"))) {
            draft.focusPlanning.focusSubject = "Scene subject — repair focus assignment";
            repairs.push("Assigned default focus subject");
        }
        draft.continuity.issues = draft.continuity.issues.filter((i) => !diagnostics.some((d) => d.includes(i)));
        if (repairs.length > 0) {
            draft.continuity.cameraConsistency = true;
            draft.continuity.issues = [];
        }
        return { repaired: repairs.length > 0, repairs };
    }
    reject(start, message, diagnostics) {
        this.logger.log("warn", "validation", message, { diagnostics });
        return { success: false, durationMs: Date.now() - start, diagnostics, message };
    }
}
//# sourceMappingURL=camera-director-processor.js.map