import fs from "node:fs";
import path from "node:path";
import { AudioGenerationBlueprintStage, } from "./types.js";
import { AUDIO_GENERATION_BLUEPRINT_STAGES } from "./audio-generation-categories.js";
export class AudioGenerationBlueprintManager {
    logger;
    blueprints = new Map();
    blueprintsPath = "";
    catalogPath = "";
    constructor(logger) {
        this.logger = logger;
    }
    initialize(storage) {
        this.blueprintsPath = storage.getBlueprintsPath();
        this.catalogPath = path.join(this.blueprintsPath, "audio-generation-blueprint-catalog.json");
        fs.mkdirSync(this.blueprintsPath, { recursive: true });
        if (fs.existsSync(this.catalogPath)) {
            this.loadFromDisk();
        }
        else {
            this.persist();
        }
        this.logger.log("info", "blueprint", "Audio generation blueprint manager initialized", {
            blueprintCount: this.blueprints.size,
        });
    }
    createBlueprint(input) {
        const now = new Date().toISOString();
        const blueprintId = input.blueprintId ?? `aud-blueprint-${Date.now()}`;
        const stages = this.buildDefaultStages();
        const blueprint = {
            blueprintId,
            projectId: input.projectId,
            name: input.name,
            stages,
            multiProject: input.multiProject ?? true,
            multiTrack: input.multiTrack ?? true,
            multiLanguage: input.multiLanguage ?? true,
            multiSpeaker: input.multiSpeaker ?? true,
            multiPlatform: input.multiPlatform ?? true,
            multiQuality: input.multiQuality ?? true,
            batchGeneration: input.batchGeneration ?? true,
            distributedGeneration: input.distributedGeneration ?? true,
            cloudGenerationPrepared: input.cloudGenerationPrepared ?? true,
            realTimePrepared: input.realTimePrepared ?? true,
            integrityVerified: true,
            version: 1,
            createdAt: now,
            lastUpdated: now,
        };
        this.blueprints.set(blueprintId, blueprint);
        this.persist();
        this.logger.log("info", "blueprint", `Audio generation blueprint created: ${blueprintId}`, {
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
            if (blueprint.stages.length !== AUDIO_GENERATION_BLUEPRINT_STAGES.length) {
                issues.push(`Blueprint ${blueprint.blueprintId} missing stages`);
            }
            const stageIds = new Set(blueprint.stages.map((s) => s.stage));
            for (const required of AUDIO_GENERATION_BLUEPRINT_STAGES) {
                if (!stageIds.has(required)) {
                    issues.push(`Blueprint ${blueprint.blueprintId} missing stage ${required}`);
                }
            }
        }
        return { valid: issues.length === 0, issues };
    }
    repairSafeIssues() {
        for (const [id, blueprint] of this.blueprints.entries()) {
            if (blueprint.stages.length !== AUDIO_GENERATION_BLUEPRINT_STAGES.length) {
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
            [AudioGenerationBlueprintStage.SpeechToSpeech]: [AudioGenerationBlueprintStage.TextToSpeech],
            [AudioGenerationBlueprintStage.VoiceCloning]: [AudioGenerationBlueprintStage.SpeechToSpeech],
            [AudioGenerationBlueprintStage.MusicGeneration]: [AudioGenerationBlueprintStage.TextToSpeech],
            [AudioGenerationBlueprintStage.SoundEffectsGeneration]: [AudioGenerationBlueprintStage.MusicGeneration],
            [AudioGenerationBlueprintStage.AmbientAudioGeneration]: [AudioGenerationBlueprintStage.SoundEffectsGeneration],
            [AudioGenerationBlueprintStage.AudioEnhancement]: [AudioGenerationBlueprintStage.AmbientAudioGeneration],
            [AudioGenerationBlueprintStage.AudioRestoration]: [AudioGenerationBlueprintStage.AudioEnhancement],
            [AudioGenerationBlueprintStage.AudioMixing]: [
                AudioGenerationBlueprintStage.MusicGeneration,
                AudioGenerationBlueprintStage.SoundEffectsGeneration,
            ],
            [AudioGenerationBlueprintStage.AudioMastering]: [AudioGenerationBlueprintStage.AudioMixing],
            [AudioGenerationBlueprintStage.RenderingPlanning]: [AudioGenerationBlueprintStage.AudioMastering],
            [AudioGenerationBlueprintStage.ExportPlanning]: [AudioGenerationBlueprintStage.RenderingPlanning],
        };
        return AUDIO_GENERATION_BLUEPRINT_STAGES.map((stage, index) => ({
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
//# sourceMappingURL=audio-generation-blueprint-manager.js.map