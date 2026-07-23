import fs from "node:fs";
import path from "node:path";
import {
  GenerationBlueprint,
  GenerationBlueprintStage,
  GenerationBlueprintStageEntry,
} from "./types.js";
import { GENERATION_BLUEPRINT_STAGES } from "./video-generation-categories.js";
import { VideoGenerationFoundationLogger } from "./video-generation-logger.js";
import { VideoGenerationStorageManager } from "./video-generation-storage.js";

export class GenerationBlueprintManager {
  private blueprints = new Map<string, GenerationBlueprint>();
  private blueprintsPath = "";
  private catalogPath = "";

  constructor(private readonly logger: VideoGenerationFoundationLogger) {}

  initialize(storage: VideoGenerationStorageManager): void {
    this.blueprintsPath = storage.getBlueprintsPath();
    this.catalogPath = path.join(this.blueprintsPath, "generation-blueprint-catalog.json");
    fs.mkdirSync(this.blueprintsPath, { recursive: true });

    if (fs.existsSync(this.catalogPath)) {
      this.loadFromDisk();
    } else {
      this.persist();
    }

    this.logger.log("info", "blueprint", "Generation blueprint manager initialized", {
      blueprintCount: this.blueprints.size,
    });
  }

  createBlueprint(input: {
    blueprintId?: string;
    projectId: string;
    name: string;
    multiProject?: boolean;
    multiVideo?: boolean;
    multiScene?: boolean;
    multiTimeline?: boolean;
    multiLanguage?: boolean;
    multiPlatform?: boolean;
    batchGeneration?: boolean;
    distributedGeneration?: boolean;
    cloudGenerationPrepared?: boolean;
  }): GenerationBlueprint {
    const now = new Date().toISOString();
    const blueprintId = input.blueprintId ?? `blueprint-${Date.now()}`;
    const stages = this.buildDefaultStages();

    const blueprint: GenerationBlueprint = {
      blueprintId,
      projectId: input.projectId,
      name: input.name,
      stages,
      multiProject: input.multiProject ?? true,
      multiVideo: input.multiVideo ?? true,
      multiScene: input.multiScene ?? true,
      multiTimeline: input.multiTimeline ?? true,
      multiLanguage: input.multiLanguage ?? true,
      multiPlatform: input.multiPlatform ?? true,
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
    this.logger.log("info", "blueprint", `Generation blueprint created: ${blueprintId}`, {
      projectId: input.projectId,
      stageCount: stages.length,
    });
    return blueprint;
  }

  getBlueprint(blueprintId: string): GenerationBlueprint | undefined {
    return this.blueprints.get(blueprintId);
  }

  getBlueprintsByProject(projectId: string): GenerationBlueprint[] {
    return [...this.blueprints.values()].filter((b) => b.projectId === projectId);
  }

  getCount(): number {
    return this.blueprints.size;
  }

  verifyIntegrity(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    if (!fs.existsSync(this.catalogPath)) {
      issues.push("Blueprint catalog missing");
    }
    for (const blueprint of this.blueprints.values()) {
      if (blueprint.stages.length !== GENERATION_BLUEPRINT_STAGES.length) {
        issues.push(`Blueprint ${blueprint.blueprintId} missing stages`);
      }
      const stageIds = new Set(blueprint.stages.map((s) => s.stage));
      for (const required of GENERATION_BLUEPRINT_STAGES) {
        if (!stageIds.has(required)) {
          issues.push(`Blueprint ${blueprint.blueprintId} missing stage ${required}`);
        }
      }
    }
    return { valid: issues.length === 0, issues };
  }

  repairSafeIssues(): void {
    for (const [id, blueprint] of this.blueprints.entries()) {
      if (blueprint.stages.length !== GENERATION_BLUEPRINT_STAGES.length) {
        blueprint.stages = this.buildDefaultStages();
        blueprint.lastUpdated = new Date().toISOString();
        blueprint.integrityVerified = true;
        this.blueprints.set(id, blueprint);
      }
    }
    this.persist();
  }

  private buildDefaultStages(): GenerationBlueprintStageEntry[] {
    const deps: Partial<Record<GenerationBlueprintStage, GenerationBlueprintStage[]>> = {
      [GenerationBlueprintStage.SceneGeneration]: [GenerationBlueprintStage.StoryGeneration],
      [GenerationBlueprintStage.ShotGeneration]: [GenerationBlueprintStage.SceneGeneration],
      [GenerationBlueprintStage.CameraPlanning]: [GenerationBlueprintStage.ShotGeneration],
      [GenerationBlueprintStage.MotionPlanning]: [GenerationBlueprintStage.CameraPlanning],
      [GenerationBlueprintStage.AnimationPlanning]: [GenerationBlueprintStage.MotionPlanning],
      [GenerationBlueprintStage.VisualEffectsPlanning]: [GenerationBlueprintStage.AnimationPlanning],
      [GenerationBlueprintStage.AudioSynchronization]: [GenerationBlueprintStage.SceneGeneration],
      [GenerationBlueprintStage.MarketingVideoPlanning]: [GenerationBlueprintStage.AudioSynchronization],
      [GenerationBlueprintStage.VideoProductionPlanning]: [GenerationBlueprintStage.MarketingVideoPlanning],
      [GenerationBlueprintStage.RenderingPlanning]: [GenerationBlueprintStage.VideoProductionPlanning],
      [GenerationBlueprintStage.VideoQualityValidation]: [GenerationBlueprintStage.RenderingPlanning],
      [GenerationBlueprintStage.VideoGenerationOptimization]: [GenerationBlueprintStage.VideoQualityValidation],
      [GenerationBlueprintStage.ExportPlanning]: [GenerationBlueprintStage.VideoGenerationOptimization],
    };

    return GENERATION_BLUEPRINT_STAGES.map((stage, index) => ({
      stage,
      enabled: true,
      order: index + 1,
      dependencies: deps[stage] ?? [],
      qualityScore: 80,
      readinessScore: 75,
      lastUpdated: new Date().toISOString(),
    }));
  }

  private loadFromDisk(): void {
    const data = JSON.parse(fs.readFileSync(this.catalogPath, "utf8")) as {
      blueprints: GenerationBlueprint[];
    };
    this.blueprints.clear();
    for (const blueprint of data.blueprints ?? []) {
      this.blueprints.set(blueprint.blueprintId, blueprint);
    }
  }

  private persist(): void {
    fs.writeFileSync(
      this.catalogPath,
      JSON.stringify({ blueprints: [...this.blueprints.values()] }, null, 2),
      "utf8"
    );
  }
}
