import fs from "node:fs";
import path from "node:path";
import { ImageGenerationBlueprintStage, } from "./types.js";
import { IMAGE_GENERATION_BLUEPRINT_STAGES } from "./image-generation-categories.js";
export class ImageGenerationBlueprintManager {
    logger;
    blueprints = new Map();
    blueprintsPath = "";
    catalogPath = "";
    constructor(logger) {
        this.logger = logger;
    }
    initialize(storage) {
        this.blueprintsPath = storage.getBlueprintsPath();
        this.catalogPath = path.join(this.blueprintsPath, "image-generation-blueprint-catalog.json");
        fs.mkdirSync(this.blueprintsPath, { recursive: true });
        if (fs.existsSync(this.catalogPath)) {
            this.loadFromDisk();
        }
        else {
            this.persist();
        }
        this.logger.log("info", "blueprint", "Image generation blueprint manager initialized", {
            blueprintCount: this.blueprints.size,
        });
    }
    createBlueprint(input) {
        const now = new Date().toISOString();
        const blueprintId = input.blueprintId ?? `img-blueprint-${Date.now()}`;
        const stages = this.buildDefaultStages();
        const blueprint = {
            blueprintId,
            projectId: input.projectId,
            name: input.name,
            stages,
            multiProject: input.multiProject ?? true,
            multiImage: input.multiImage ?? true,
            multiLanguage: input.multiLanguage ?? true,
            multiPlatform: input.multiPlatform ?? true,
            multiResolution: input.multiResolution ?? true,
            batchGeneration: input.batchGeneration ?? true,
            distributedGeneration: input.distributedGeneration ?? true,
            cloudGenerationPrepared: input.cloudGenerationPrepared ?? true,
            integrityVerified: true,
            version: 1,
            createdAt: now,
            lastUpdated: now,
        };
        this.blueprints.set(blueprintId, blueprint);
        this.persist();
        this.logger.log("info", "blueprint", `Image generation blueprint created: ${blueprintId}`, {
            projectId: input.projectId,
            stageCount: stages.length,
        });
        return blueprint;
    }
    getBlueprint(blueprintId) {
        return this.blueprints.get(blueprintId);
    }
    getBlueprintsByProject(projectId) {
        return [...this.blueprints.values()].filter((b) => b.projectId === projectId);
    }
    getCount() {
        return this.blueprints.size;
    }
    verifyIntegrity() {
        const issues = [];
        if (!fs.existsSync(this.catalogPath)) {
            issues.push("Blueprint catalog missing");
        }
        for (const blueprint of this.blueprints.values()) {
            if (blueprint.stages.length !== IMAGE_GENERATION_BLUEPRINT_STAGES.length) {
                issues.push(`Blueprint ${blueprint.blueprintId} missing stages`);
            }
            const stageIds = new Set(blueprint.stages.map((s) => s.stage));
            for (const required of IMAGE_GENERATION_BLUEPRINT_STAGES) {
                if (!stageIds.has(required)) {
                    issues.push(`Blueprint ${blueprint.blueprintId} missing stage ${required}`);
                }
            }
        }
        return { valid: issues.length === 0, issues };
    }
    repairSafeIssues() {
        for (const [id, blueprint] of this.blueprints.entries()) {
            if (blueprint.stages.length !== IMAGE_GENERATION_BLUEPRINT_STAGES.length) {
                blueprint.stages = this.buildDefaultStages();
                blueprint.lastUpdated = new Date().toISOString();
                blueprint.integrityVerified = true;
                this.blueprints.set(id, blueprint);
            }
        }
        this.persist();
    }
    buildDefaultStages() {
        const deps = {
            [ImageGenerationBlueprintStage.ImageToImage]: [ImageGenerationBlueprintStage.TextToImage],
            [ImageGenerationBlueprintStage.ProductImageGeneration]: [ImageGenerationBlueprintStage.TextToImage],
            [ImageGenerationBlueprintStage.BackgroundGeneration]: [ImageGenerationBlueprintStage.TextToImage],
            [ImageGenerationBlueprintStage.ImageEditing]: [ImageGenerationBlueprintStage.ImageToImage],
            [ImageGenerationBlueprintStage.Inpainting]: [ImageGenerationBlueprintStage.ImageEditing],
            [ImageGenerationBlueprintStage.Outpainting]: [ImageGenerationBlueprintStage.Inpainting],
            [ImageGenerationBlueprintStage.ImageEnhancement]: [ImageGenerationBlueprintStage.ImageEditing],
            [ImageGenerationBlueprintStage.BrandingDesign]: [ImageGenerationBlueprintStage.ProductImageGeneration],
            [ImageGenerationBlueprintStage.MultiStyleImageGeneration]: [
                ImageGenerationBlueprintStage.ImageToImage,
                ImageGenerationBlueprintStage.BrandingDesign,
            ],
            [ImageGenerationBlueprintStage.ImageProduction]: [
                ImageGenerationBlueprintStage.MultiStyleImageGeneration,
                ImageGenerationBlueprintStage.BrandingDesign,
            ],
            [ImageGenerationBlueprintStage.RenderingPlanning]: [ImageGenerationBlueprintStage.ImageProduction],
            [ImageGenerationBlueprintStage.ImageQualityValidation]: [
                ImageGenerationBlueprintStage.RenderingPlanning,
                ImageGenerationBlueprintStage.ImageProduction,
            ],
            [ImageGenerationBlueprintStage.ImageGenerationOptimization]: [
                ImageGenerationBlueprintStage.ImageQualityValidation,
                ImageGenerationBlueprintStage.RenderingPlanning,
            ],
            [ImageGenerationBlueprintStage.ExportPlanning]: [ImageGenerationBlueprintStage.ImageGenerationOptimization],
        };
        return IMAGE_GENERATION_BLUEPRINT_STAGES.map((stage, index) => ({
            stage,
            enabled: true,
            order: index + 1,
            dependencies: deps[stage] ?? [],
            qualityScore: 80,
            readinessScore: 75,
            lastUpdated: new Date().toISOString(),
        }));
    }
    loadFromDisk() {
        const data = JSON.parse(fs.readFileSync(this.catalogPath, "utf8"));
        this.blueprints.clear();
        for (const blueprint of data.blueprints ?? []) {
            this.blueprints.set(blueprint.blueprintId, blueprint);
        }
    }
    persist() {
        fs.writeFileSync(this.catalogPath, JSON.stringify({ blueprints: [...this.blueprints.values()] }, null, 2), "utf8");
    }
}
//# sourceMappingURL=generation-blueprint-manager.js.map