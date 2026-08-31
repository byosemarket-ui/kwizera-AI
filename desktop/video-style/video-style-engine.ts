/**
 * STEP 3 engine — consumes STEP 1 + STEP 2 and builds authoritative CreativePlan.
 */

import type { CreativeToneId, ProductionModeId } from "../../ai/video-production/production-mode-types.js";
import { MODE_COPY, recommendCreativeTone } from "../../ai/video-production/production-mode-types.js";
import { platformPreview } from "../video-requirements/platform-map.js";
import { STEP3_HANDOFF_KEY, type Step3HandoffPayload } from "../video-requirements/types.js";
import {
  persistWorkflowStep,
  readScopedHandoff,
  resolveBoundProject,
  writeScopedHandoff,
} from "../product-creation/workflow";
import {
  fetchProductionCapabilities,
  finalizeCreativePlan,
  generatePlanWithMode,
  getCreativePlan,
  getProductionManifest,
  updateCreativePlan,
} from "./api";
import {
  buildPlanPreview,
  buildScenePreviews,
  computeReadiness,
  formatPriceLabel,
  mapCapabilities,
  recommendedModeReason,
} from "./readiness";
import type {
  ScenePreview,
  Step4HandoffPayload,
  VideoStyleSnapshot,
} from "./types";
import { STEP4_HANDOFF_KEY, TONE_OPTIONS } from "./types";

type Listener = (snap: VideoStyleSnapshot) => void;
type NotifyFn = (
  tone: "success" | "warning" | "error" | "info",
  title: string,
  detail: string,
) => void;

export class VideoStyleEngine {
  private projectId: string | null = null;
  private projectName = "";
  private handoff: Step3HandoffPayload | null = null;
  private selectedMode: ProductionModeId | null = null;
  private creativeTone: CreativeToneId | null = null;
  private modes = mapCapabilities([]);
  private plan: VideoStyleSnapshot["plan"] = null;
  private manifest: VideoStyleSnapshot["manifest"] = null;
  private generating = false;
  private saveState: VideoStyleSnapshot["saveState"] = "saved";
  private listeners = new Set<Listener>();
  private notify: NotifyFn | null = null;
  private transitioning = false;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  setNotify(fn: NotifyFn | null): void {
    this.notify = fn;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): VideoStyleSnapshot {
    const platformId = this.handoff?.platformId ?? "tiktok";
    const preview = platformPreview(platformId);
    const commercial = this.plan?.commercial;
    const summary = this.handoff && this.projectId ? {
      productId: this.handoff.productId,
      productName: commercial?.productName || this.projectName,
      heroUrl: this.handoff.assetIds[0]
        ? `/api/workspace/projects/${this.projectId}/images/${this.handoff.assetIds[0]}`
        : null,
      platformLabel: preview.label,
      platformId,
      aspectRatio: preview.aspectRatio,
      width: preview.width,
      height: preview.height,
      durationSeconds: this.handoff.durationSeconds,
      priceLabel: formatPriceLabel(commercial?.pricing.currentPrice, commercial?.pricing.currency),
      discountLabel: commercial?.pricing.discountPercentage
        ? `Save ${commercial.pricing.discountPercentage}%`
        : null,
      website: commercial?.destination.website?.trim() || null,
      objective: this.handoff.objective,
      language: this.handoff.language,
    } : null;

    const planPreview = buildPlanPreview(
      this.plan,
      this.manifest,
      this.handoff?.durationSeconds ?? 30,
      preview.label,
    );
    const scenes = buildScenePreviews(this.projectId ?? "", this.plan);

    const base: VideoStyleSnapshot = {
      version: 1,
      projectId: this.projectId,
      projectName: this.projectName,
      handoff: this.handoff,
      summary,
      modes: this.modes,
      selectedMode: this.selectedMode,
      recommendedReason: recommendedModeReason(this.modes, new Set(scenes.map((s) => s.view)).size),
      creativeTone: this.creativeTone,
      toneOptions: [...TONE_OPTIONS],
      plan: this.plan,
      manifest: this.manifest,
      planPreview,
      scenes,
      generating: this.generating,
      saveState: this.saveState,
      readiness: { ready: false, blockingIssues: [], warnings: [], statusLabel: "NOT READY" },
      canContinue: false,
      continueBlockedReason: null,
      updatedAt: new Date().toISOString(),
    };
    base.readiness = computeReadiness(base);
    base.canContinue = base.readiness.ready && !this.transitioning;
    base.continueBlockedReason = base.readiness.blockingIssues[0] ?? null;
    return base;
  }

  async hydrate(): Promise<void> {
    const bound = await resolveBoundProject();
    if (!bound) {
      this.emit();
      return;
    }
    this.projectId = bound.projectId;
    this.projectName = bound.projectName;

    this.handoff = readScopedHandoff<Step3HandoffPayload>(STEP3_HANDOFF_KEY, bound.projectId);
    if (!this.handoff) {
      this.emit();
      return;
    }

    const viewCount = this.handoff.assetIds.length;
    try {
      const caps = await fetchProductionCapabilities(viewCount);
      this.modes = mapCapabilities(caps.capabilities);
    } catch {
      this.modes = mapCapabilities([]);
    }

    const existingPlan = await getCreativePlan(bound.projectId).catch(() => ({ plan: null }));
    this.plan = existingPlan.plan;
    this.manifest = (await getProductionManifest(bound.projectId).catch(() => ({ manifest: null }))).manifest;

    if (this.plan?.productionMode) {
      this.selectedMode = this.plan.productionMode as ProductionModeId;
    } else {
      const rec = this.modes.find((m) => m.recommended && m.available);
      this.selectedMode = rec?.mode ?? this.modes.find((m) => m.available)?.mode ?? null;
    }

    if (this.plan?.creativeTone) {
      this.creativeTone = this.plan.creativeTone as CreativeToneId;
    } else {
      const info = bound.project.productInformation;
      this.creativeTone = recommendCreativeTone(
        String(info.category ?? "Product"),
        this.handoff.objective,
      );
    }

    if (!this.plan?.scenes?.length && this.selectedMode) {
      await this.generatePlan(false);
    }

    this.emit();
  }

  async selectMode(mode: ProductionModeId): Promise<void> {
    const cap = this.modes.find((m) => m.mode === mode);
    if (!cap?.available) {
      this.notify?.("warning", "Mode unavailable", cap?.reason ?? "This production mode cannot be used.", "warnings");
      return;
    }
    if (this.selectedMode === mode) return;
    this.selectedMode = mode;
    this.emit();
    await this.generatePlan(true);
  }

  async selectTone(tone: CreativeToneId): Promise<void> {
    if (this.creativeTone === tone) return;
    this.creativeTone = tone;
    this.emit();
    this.schedulePersistTone();
    if (this.plan) await this.generatePlan(true);
  }

  async generatePlan(regenerate: boolean): Promise<void> {
    if (!this.projectId || !this.selectedMode) return;
    this.generating = true;
    this.saveState = "saving";
    this.emit();
    try {
      this.plan = await generatePlanWithMode(
        this.projectId,
        this.selectedMode,
        this.creativeTone,
        regenerate,
      );
      this.manifest = (await getProductionManifest(this.projectId)).manifest;
      this.saveState = "saved";
    } catch (error) {
      this.saveState = "error";
      this.notify?.("error", "Plan generation failed", error instanceof Error ? error.message : "Unable to generate plan", "errors");
    } finally {
      this.generating = false;
      this.emit();
    }
  }

  async updateSceneText(sceneId: string, text: string): Promise<void> {
    if (!this.projectId || !this.plan) return;
    this.saveState = "saving";
    this.emit();
    try {
      const scenes = this.plan.scenes.map((scene) => (
        scene.id === sceneId
          ? { ...scene, text, userEdited: true, fieldSources: { ...scene.fieldSources, text: "USER_DEFINED" as const } }
          : scene
      ));
      this.plan = (await updateCreativePlan(this.projectId, { scenes })).plan;
      this.manifest = (await getProductionManifest(this.projectId)).manifest;
      this.saveState = "saved";
    } catch (error) {
      this.saveState = "error";
      this.notify?.("error", "Save failed", error instanceof Error ? error.message : "Unable to save scene", "errors");
    } finally {
      this.emit();
    }
  }

  async updateSceneAsset(sceneId: string, assetId: string): Promise<void> {
    if (!this.projectId || !this.plan || !this.handoff?.assetIds.includes(assetId)) return;
    this.saveState = "saving";
    this.emit();
    try {
      const scenes = this.plan.scenes.map((scene) => (
        scene.id === sceneId
          ? {
            ...scene,
            assetId,
            userEdited: true,
            fieldSources: { ...scene.fieldSources, assetId: "USER_DEFINED" as const },
          }
          : scene
      ));
      this.plan = (await updateCreativePlan(this.projectId, { scenes })).plan;
      this.manifest = (await getProductionManifest(this.projectId)).manifest;
      this.saveState = "saved";
    } catch (error) {
      this.saveState = "error";
      this.notify?.("error", "Save failed", error instanceof Error ? error.message : "Unable to save scene", "errors");
    } finally {
      this.emit();
    }
  }

  async continueToStep4(): Promise<void> {
    const snap = this.snapshot();
    if (!snap.canContinue || !this.projectId || !this.handoff || !this.plan) {
      throw new Error(snap.continueBlockedReason ?? "Complete the production plan before continuing.");
    }
    this.transitioning = true;
    this.saveState = "saving";
    this.emit();
    try {
      if (this.plan.scenes.some((s) => !s.assetId) && this.handoff.assetIds.length) {
        const fallback = this.handoff.assetIds[0]!;
        const scenes = this.plan.scenes.map((scene) => (
          scene.assetId ? scene : { ...scene, assetId: fallback, userEdited: true }
        ));
        this.plan = (await updateCreativePlan(this.projectId, { scenes })).plan;
      }
      const result = await finalizeCreativePlan(this.projectId);
      this.plan = result.plan;
      this.manifest = result.manifest;

      const preview = platformPreview(this.handoff.platformId);
      const commercial = this.plan.commercial;
      const handoff: Step4HandoffPayload = {
        version: 1,
        step: "step-4-final-review",
        projectId: this.projectId,
        projectName: this.projectName,
        briefId: this.handoff.briefId,
        productId: this.handoff.productId,
        planId: this.plan.id,
        manifestId: this.plan.manifestId ?? this.manifest?.manifestId ?? null,
        assetIds: [...this.handoff.assetIds],
        heroAssetId: this.handoff.assetIds[0] ?? null,
        productionMode: this.selectedMode!,
        styleLabel: MODE_COPY[this.selectedMode!]?.label,
        creativeTone: this.creativeTone,
        platformId: this.handoff.platformId,
        platformLabel: preview.label,
        formatLabel: `${preview.width} × ${preview.height}`,
        durationSeconds: this.handoff.durationSeconds,
        language: this.handoff.language,
        priceLabel: formatPriceLabel(commercial?.pricing.currentPrice, commercial?.pricing.currency),
        discountLabel: commercial?.pricing.discountPercentage
          ? `Save ${commercial.pricing.discountPercentage}%`
          : null,
        objective: this.handoff.objective,
        sceneCount: this.plan.scenes.length,
        preparedAt: new Date().toISOString(),
      };
      writeScopedHandoff(STEP4_HANDOFF_KEY, handoff);
      await persistWorkflowStep(this.projectId, 4, 3);
      this.saveState = "saved";
    } finally {
      this.transitioning = false;
      this.emit();
    }
  }

  private schedulePersistTone(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      void this.persistToneOnly();
    }, 500);
  }

  private async persistToneOnly(): Promise<void> {
    if (!this.projectId || !this.creativeTone) return;
    try {
      this.plan = (await updateCreativePlan(this.projectId, {
        creativeTone: this.creativeTone,
        productionMode: this.selectedMode ?? undefined,
      })).plan;
    } catch {
      // non-blocking
    }
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const listener of this.listeners) listener(snap);
  }
}

export const videoStyleEngine = new VideoStyleEngine();

export function scenePurposeLabel(purpose: string): string {
  return purpose.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function motionLabel(motion: string): string {
  return motion.replace(/_/g, " ").toLowerCase();
}
