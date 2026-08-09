import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativeProject, CreativeWorkspaceManager } from "../creative-workspace/creative-workspace-manager.js";
import type { ProductAssetPreparationManager } from "../product-asset-preparation/product-asset-preparation-manager.js";
import type { ProductIntelligenceManager } from "../product-intelligence/product-intelligence-manager.js";
import type { ProductIntelligenceProfile } from "../product-intelligence/types.js";
import type { ProductPromptOrchestrationManager } from "../product-prompt-orchestration/product-prompt-orchestration-manager.js";
import type { ProductPromptOrchestrationResult } from "../product-prompt-orchestration/types.js";
import type { ProductScenePlanningManager } from "../product-scene-planning/product-scene-planning-manager.js";
import type { ProductStoryboardManager } from "../product-storyboard/product-storyboard-manager.js";
import type { ProductStoryboardResult } from "../product-storyboard/types.js";
import type { ProductVideoGenerationManager } from "../product-video-generation/product-video-generation-manager.js";
import type { ProductVideoGenerationResult } from "../product-video-generation/types.js";
import {
  buildNarrationCues,
  buildSoundEffects,
  buildSubtitlesVtt,
  defaultMix,
  evaluateSync,
  mixTracks,
  SAMPLE_RATE,
  selectMusic,
  selectVoice,
  synthesizeEffectsTrack,
  synthesizeMusicTrack,
  synthesizeVoiceTrack,
} from "./audio-composer.js";
import type {
  AiMeProductAudioGenerationAwareness,
  MixSettings,
  ProductAudioAsset,
  ProductAudioGenerationExplainResult,
  ProductAudioGenerationHealthReport,
  ProductAudioGenerationQuality,
  ProductAudioGenerationResult,
  ProductAudioGenerationStore,
  SceneNarrationCue,
  SoundEffectCue,
  SyncReport,
} from "./types.js";

const EMPTY: ProductAudioGenerationStore = { generations: [], cache: {}, history: [], logs: [] };

/** Step 8 runtime: voice, music, SFX, mix synced to Step 7 video. Defers final rendering. */
export class ProductAudioGenerationManager {
  private root = "";
  private core: AiCoreManager | null = null;
  private workspace: CreativeWorkspaceManager | null = null;
  private products: ProductIntelligenceManager | null = null;
  private assets: ProductAssetPreparationManager | null = null;
  private scenes: ProductScenePlanningManager | null = null;
  private storyboards: ProductStoryboardManager | null = null;
  private orchestration: ProductPromptOrchestrationManager | null = null;
  private videos: ProductVideoGenerationManager | null = null;
  private store: ProductAudioGenerationStore = structuredClone(EMPTY);

  readonly quality = new ProductAudioQualityEngine();
  readonly health = new ProductAudioGenerationHealthManager(this);

  async initialize(
    storageRoot: string,
    dependencies: {
      core: AiCoreManager;
      workspace: CreativeWorkspaceManager;
      products: ProductIntelligenceManager;
      assets: ProductAssetPreparationManager;
      scenes: ProductScenePlanningManager;
      storyboards: ProductStoryboardManager;
      orchestration: ProductPromptOrchestrationManager;
      videos: ProductVideoGenerationManager;
    },
  ): Promise<void> {
    this.root = path.join(storageRoot, "product-audio-generation-runtime");
    this.core = dependencies.core;
    this.workspace = dependencies.workspace;
    this.products = dependencies.products;
    this.assets = dependencies.assets;
    this.scenes = dependencies.scenes;
    this.storyboards = dependencies.storyboards;
    this.orchestration = dependencies.orchestration;
    this.videos = dependencies.videos;
    await fs.mkdir(path.join(this.root, "assets"), { recursive: true });
    this.store = await this.readStore();
    this.log("info", "Product audio generation runtime restored.");
    await this.persist();
  }

  isInitialized(): boolean {
    return Boolean(this.root && this.workspace && this.products && this.storyboards && this.orchestration && this.videos);
  }

  async generateProductAudio(projectId: string): Promise<ProductAudioGenerationResult> {
    this.ensureReady();
    const project = await this.workspace!.getProject(projectId);
    if (!project) throw new Error("Project not found");

    const product = (await this.products!.getProfile(projectId))
      ?? (await this.products!.analyzeProductIntelligence(projectId));
    await this.assets!.getResult(projectId) ?? (await this.assets!.prepareProductAssets(projectId));
    await this.scenes!.getPlan(projectId) ?? (await this.scenes!.planProductScenes(projectId));
    const storyboard = (await this.storyboards!.getStoryboard(projectId))
      ?? (await this.storyboards!.generateStoryboardAndScript(projectId));
    const orch = (await this.orchestration!.getOrchestration(projectId))
      ?? (await this.orchestration!.orchestratePromptsAndModels(projectId));
    const video = (await this.videos!.getGeneration(projectId))
      ?? (await this.videos!.generateProductSceneVideos(projectId));
    if (!video.clips.length) throw new Error("Generate product video (Step 7) before audio generation.");

    const cacheKey = this.cacheKey(project, product, storyboard, orch, video);
    const cachedId = this.store.cache[cacheKey];
    const cached = cachedId ? this.store.generations.find((item) => item.generationId === cachedId) : undefined;
    if (cached) return { ...cached, cached: true };

    const language = detectLanguage(storyboard, orch);
    const voice = selectVoice(product, project, language);
    const music = selectMusic(product, project);
    let mix = defaultMix();
    let narrationCues = buildNarrationCues(storyboard, video.clips, language);
    // Prefer Step 5 voice prompts when they carry scene narration continuity.
    narrationCues = enrichFromVoicePrompts(narrationCues, orch);
    let soundEffects = buildSoundEffects(video.clips, storyboard.panels);
    let sync = evaluateSync(video, narrationCues, soundEffects, mix);

    const projectDir = path.join(this.root, "assets", projectId);
    await fs.mkdir(projectDir, { recursive: true });
    const generationId = randomUUID();
    const duration = Math.max(1, video.totalDurationSeconds);

    let voiceWav = synthesizeVoiceTrack(duration, voice.persona, narrationCues, mix);
    let musicWav = synthesizeMusicTrack(duration, music.style, mix);
    let effectsWav = synthesizeEffectsTrack(duration, soundEffects, mix);
    let mixWav = mixTracks(voiceWav, musicWav, effectsWav, mix);
    let subtitles = buildSubtitlesVtt(narrationCues);

    let quality = this.quality.evaluate(voice, music, narrationCues, soundEffects, sync, mix, language);
    const repairs: string[] = [];
    if (quality.issues.length || sync.problems.length) {
      const repaired = this.applyQualityRepairs({
        narrationCues,
        soundEffects,
        mix,
        sync,
        video,
        storyboard,
        issues: [...quality.issues, ...sync.problems],
      });
      narrationCues = repaired.narrationCues;
      soundEffects = repaired.soundEffects;
      mix = repaired.mix;
      sync = evaluateSync(video, narrationCues, soundEffects, mix);
      repairs.push(...repaired.repairs);
      voiceWav = synthesizeVoiceTrack(duration, voice.persona, narrationCues, mix);
      musicWav = synthesizeMusicTrack(duration, music.style, mix);
      effectsWav = synthesizeEffectsTrack(duration, soundEffects, mix);
      mixWav = mixTracks(voiceWav, musicWav, effectsWav, mix);
      subtitles = buildSubtitlesVtt(narrationCues);
      quality = this.quality.evaluate(voice, music, narrationCues, soundEffects, sync, mix, language);
      quality.repairs = repairs;
    }

    const assets = await this.writeAssets(projectId, generationId, {
      voiceWav,
      musicWav,
      effectsWav,
      mixWav,
      subtitles,
      duration,
    });

    const now = new Date().toISOString();
    const result: ProductAudioGenerationResult = {
      generationId,
      projectId,
      productId: product.id,
      videoGenerationId: video.generationId,
      storyboardId: storyboard.storyboardId,
      orchestrationId: orch.orchestrationId,
      voice,
      music,
      narrationCues,
      soundEffects,
      mix,
      sync,
      assets,
      improvementRecommendations: this.buildImprovements(quality, sync, voice, music),
      quality,
      creativePipelineStep: 8,
      renderingDeferred: true,
      copyrightSafe: true,
      createdAt: now,
      updatedAt: now,
      cached: false,
    };

    this.store.generations = this.store.generations.filter((item) => item.projectId !== projectId);
    this.store.generations.unshift(result);
    this.store.cache[cacheKey] = result.generationId;
    this.history(projectId, "generate", `Generated audio package for ${product.productName} (${duration}s).`);
    this.log("info", `Product audio generation ready for ${project.name}.`);
    await this.persist();
    return structuredClone(result);
  }

  async getGeneration(projectId: string): Promise<ProductAudioGenerationResult | null> {
    return this.store.generations.find((item) => item.projectId === projectId) ?? null;
  }

  async getAssetAbsolutePath(assetId: string): Promise<string | null> {
    for (const generation of this.store.generations) {
      const asset = generation.assets.find((item) => item.assetId === assetId);
      if (!asset) continue;
      const absolute = path.join(this.root, asset.relativePath);
      try {
        await fs.access(absolute);
        return absolute;
      } catch {
        return null;
      }
    }
    return null;
  }

  async explainGeneration(projectId: string): Promise<ProductAudioGenerationExplainResult> {
    const result = (await this.getGeneration(projectId)) ?? (await this.generateProductAudio(projectId));
    const productName = result.voice.brandMatch;
    return {
      generationId: result.generationId,
      productName,
      summary: `Generated offline voice (${result.voice.persona}), ${result.music.style} music, ${result.soundEffects.length} SFX cues, and mix for ${result.narrationCues.length} scenes. Rendering deferred.`,
      voiceExplanation: result.voice.why,
      musicExplanation: result.music.why,
      effectExplanations: result.soundEffects.slice(0, 12).map((fx) => ({
        sceneNumber: fx.sceneNumber,
        kind: fx.kind,
        why: fx.why,
      })),
      syncProblems: result.sync.problems,
      improvementRecommendations: result.improvementRecommendations,
      readyForRendering: result.quality.overall >= 70 && result.sync.problems.length === 0,
    };
  }

  async recommendBetterAudio(projectId: string): Promise<string[]> {
    const result = (await this.getGeneration(projectId)) ?? (await this.generateProductAudio(projectId));
    return [...result.improvementRecommendations];
  }

  async detectAudioQualityProblems(projectId: string): Promise<string[]> {
    const result = (await this.getGeneration(projectId)) ?? (await this.generateProductAudio(projectId));
    return [...result.quality.issues, ...result.sync.problems];
  }

  getAiMeProductAudioGenerationAwareness(): AiMeProductAudioGenerationAwareness {
    const available = this.isInitialized();
    return {
      available,
      enabled: available,
      offlineFirst: true,
      canExplainVoiceSelection: available,
      canExplainMusicSelection: available,
      canExplainSoundEffects: available,
      canRecommendBetterAudio: available,
      canDetectAudioQualityProblems: available,
      renderingDeferred: true,
      summary: available
        ? "AI Me Product Audio Generation is online: explain voice, music, and SFX; recommend improvements; detect quality/sync problems. Final rendering remains deferred."
        : "Product Audio Generation runtime is not initialized.",
    };
  }

  async runHealthCheck(projectId?: string): Promise<ProductAudioGenerationHealthReport> {
    return this.health.check(projectId);
  }

  async repair(projectId?: string): Promise<ProductAudioGenerationHealthReport> {
    return this.health.repair(projectId);
  }

  async getDashboard(projectId?: string): Promise<{
    generations: ProductAudioGenerationResult[];
    history: ProductAudioGenerationStore["history"];
    logs: ProductAudioGenerationStore["logs"];
    awareness: AiMeProductAudioGenerationAwareness;
    analytics: Record<string, number>;
  }> {
    const generations = this.store.generations.filter((item) => !projectId || item.projectId === projectId);
    return {
      generations: structuredClone(generations),
      history: this.store.history.filter((item) => !projectId || item.projectId === projectId),
      logs: [...this.store.logs],
      awareness: this.getAiMeProductAudioGenerationAwareness(),
      analytics: {
        generations: generations.length,
        assets: generations.reduce((sum, item) => sum + item.assets.length, 0),
        averageQuality: generations.length
          ? Math.round(generations.reduce((sum, item) => sum + item.quality.overall, 0) / generations.length)
          : 0,
        cached: Object.keys(this.store.cache).length,
      },
    };
  }

  async persist(): Promise<void> {
    await fs.writeFile(path.join(this.root, "generations.json"), `${JSON.stringify(this.store, null, 2)}\n`, "utf8");
  }

  log(level: "info" | "warning" | "error", message: string): void {
    this.store.logs.unshift({ at: new Date().toISOString(), level, message });
    this.store.logs.splice(100);
    this.core?.logger.info("product-audio-generation", message);
  }

  history(projectId: string, event: string, detail: string): void {
    this.store.history.unshift({ id: randomUUID(), at: new Date().toISOString(), projectId, event, detail });
    this.store.history.splice(100);
  }

  private ensureReady(): void {
    if (!this.isInitialized()) throw new Error("Product Audio Generation Manager is not initialized");
  }

  private async readStore(): Promise<ProductAudioGenerationStore> {
    try {
      const raw = await fs.readFile(path.join(this.root, "generations.json"), "utf8");
      return { ...structuredClone(EMPTY), ...JSON.parse(raw) } as ProductAudioGenerationStore;
    } catch {
      return structuredClone(EMPTY);
    }
  }

  private cacheKey(
    project: CreativeProject,
    product: ProductIntelligenceProfile,
    storyboard: ProductStoryboardResult,
    orch: ProductPromptOrchestrationResult,
    video: ProductVideoGenerationResult,
  ): string {
    return createHash("sha256")
      .update(JSON.stringify({
        projectId: project.id,
        productId: product.id,
        storyboardId: storyboard.storyboardId,
        orchestrationId: orch.orchestrationId,
        videoGenerationId: video.generationId,
        clips: video.clips.map((clip) => [clip.clipId, clip.startSeconds, clip.endSeconds]),
      }))
      .digest("hex");
  }

  private async writeAssets(
    projectId: string,
    generationId: string,
    files: {
      voiceWav: Buffer;
      musicWav: Buffer;
      effectsWav: Buffer;
      mixWav: Buffer;
      subtitles: string;
      duration: number;
    },
  ): Promise<ProductAudioAsset[]> {
    const prefix = generationId.slice(0, 8);
    const specs: Array<{ kind: ProductAudioAsset["kind"]; fileName: string; bytes: Buffer | string; mime: ProductAudioAsset["mimeType"] }> = [
      { kind: "voice", fileName: `voice-${prefix}.wav`, bytes: files.voiceWav, mime: "audio/wav" },
      { kind: "music", fileName: `music-${prefix}.wav`, bytes: files.musicWav, mime: "audio/wav" },
      { kind: "effects", fileName: `effects-${prefix}.wav`, bytes: files.effectsWav, mime: "audio/wav" },
      { kind: "mix", fileName: `mix-${prefix}.wav`, bytes: files.mixWav, mime: "audio/wav" },
      { kind: "subtitles", fileName: `subs-${prefix}.vtt`, bytes: files.subtitles, mime: "text/vtt" },
    ];
    const assets: ProductAudioAsset[] = [];
    for (const spec of specs) {
      const relativePath = path.join("assets", projectId, spec.fileName);
      const absolute = path.join(this.root, relativePath);
      if (typeof spec.bytes === "string") await fs.writeFile(absolute, spec.bytes, "utf8");
      else await fs.writeFile(absolute, spec.bytes);
      assets.push({
        assetId: randomUUID(),
        kind: spec.kind,
        fileName: spec.fileName,
        relativePath: relativePath.replace(/\\/g, "/"),
        mimeType: spec.mime,
        durationSeconds: files.duration,
        sampleRate: spec.mime === "audio/wav" ? SAMPLE_RATE : undefined,
      });
    }
    return assets;
  }

  private applyQualityRepairs(input: {
    narrationCues: SceneNarrationCue[];
    soundEffects: SoundEffectCue[];
    mix: MixSettings;
    sync: SyncReport;
    video: ProductVideoGenerationResult;
    storyboard: ProductStoryboardResult;
    issues: string[];
  }): {
    narrationCues: SceneNarrationCue[];
    soundEffects: SoundEffectCue[];
    mix: MixSettings;
    repairs: string[];
  } {
    const repairs: string[] = [];
    let narrationCues = [...input.narrationCues];
    let soundEffects = [...input.soundEffects];
    let mix = { ...input.mix };

    if (input.issues.some((issue) => issue.includes("timing") || issue.includes("Narration cue"))) {
      narrationCues = input.video.clips.map((clip) => {
        const existing = narrationCues.find((cue) => cue.sceneNumber === clip.sceneNumber);
        const panel = input.storyboard.panels.find((item) => item.sceneNumber === clip.sceneNumber);
        return {
          sceneNumber: clip.sceneNumber,
          section: existing?.section ?? "feature-presentation",
          text: existing?.text || panel?.voice.narration || panel?.scenePurpose || "Product scene",
          startSeconds: clip.startSeconds,
          endSeconds: clip.endSeconds,
          language: existing?.language || "en",
        };
      });
      repairs.push("resynced-narration-to-clip-timeline");
    }
    if (input.issues.some((issue) => issue.includes("Music volume") || issue.includes("mix") || issue.includes("balance"))) {
      mix = { ...mix, musicVolume: Math.min(mix.musicVolume, mix.voiceVolume * 0.35), voiceVolume: Math.max(mix.voiceVolume, 0.8) };
      repairs.push("ducked-music-under-narration");
    }
    if (input.issues.some((issue) => issue.includes("SFX") || issue.includes("effects"))) {
      soundEffects = soundEffects.filter((fx) => fx.atSeconds >= 0 && fx.atSeconds <= input.video.totalDurationSeconds + 0.05);
      repairs.push("clamped-sfx-to-timeline");
    }
    if (input.issues.some((issue) => issue.includes("empty"))) {
      narrationCues = narrationCues.map((cue) => ({
        ...cue,
        text: cue.text.trim() || input.storyboard.marketingScript.fullNarration.slice(0, 120) || "Discover the product.",
      }));
      repairs.push("filled-empty-narration");
    }
    return { narrationCues, soundEffects, mix, repairs };
  }

  private buildImprovements(
    quality: ProductAudioGenerationQuality,
    sync: SyncReport,
    voice: ProductAudioGenerationResult["voice"],
    music: ProductAudioGenerationResult["music"],
  ): string[] {
    const tips: string[] = [];
    if (quality.voiceQualityScore < 90) tips.push(`Consider a clearer ${voice.persona} delivery pace in storyboard voice scripts.`);
    if (quality.musicQualityScore < 90) tips.push(`Refine campaign emotion cues for a stronger ${music.style} bed.`);
    if (sync.problems.length) tips.push(...sync.problems.slice(0, 2));
    if (quality.mixBalanceScore < 90) tips.push("Keep music ducked under narration for broadcast clarity.");
    if (!tips.length) tips.push("Audio package is ready; proceed to Rendering & Export only after review.");
    return tips;
  }
}

export class ProductAudioQualityEngine {
  evaluate(
    voice: ProductAudioGenerationResult["voice"],
    music: ProductAudioGenerationResult["music"],
    narration: SceneNarrationCue[],
    effects: SoundEffectCue[],
    sync: SyncReport,
    mix: MixSettings,
    language: string,
  ): ProductAudioGenerationQuality {
    const issues: string[] = [];
    if (!voice.persona) issues.push("voice-generation");
    if (!narration.length || narration.some((cue) => !cue.text.trim())) issues.push("narration");
    if (!music.style || music.licensedOrGenerated !== "generated-offline") issues.push("music");
    if (effects.length < 3) issues.push("sound-effects");
    if (sync.problems.length) issues.push("synchronization");
    if (!(mix.musicVolume < mix.voiceVolume) || !mix.musicBelowNarration) issues.push("audio-mixing");
    if (!language) issues.push("language");

    const voiceQualityScore = 90;
    const narrationQualityScore = narration.every((cue) => cue.text.trim().length >= 8) ? 92 : 70;
    const musicQualityScore = 88;
    const soundEffectsScore = Math.min(94, 70 + effects.length);
    const synchronizationScore = sync.score;
    const mixBalanceScore = mix.musicVolume < mix.voiceVolume * 0.5 ? 93 : 72;
    const languageQualityScore = language.length >= 2 ? 90 : 60;
    const overall = Math.round(
      (voiceQualityScore + narrationQualityScore + musicQualityScore + soundEffectsScore + synchronizationScore + mixBalanceScore + languageQualityScore) / 7,
    );
    return {
      voiceQualityScore,
      narrationQualityScore,
      musicQualityScore,
      soundEffectsScore,
      synchronizationScore,
      mixBalanceScore,
      languageQualityScore,
      overall: issues.length ? Math.min(overall, 68) : overall,
      issues,
      repairs: [],
    };
  }
}

export class ProductAudioGenerationHealthManager {
  constructor(private readonly manager: ProductAudioGenerationManager) {}

  async check(projectId?: string): Promise<ProductAudioGenerationHealthReport> {
    const checks: ProductAudioGenerationHealthReport["checks"] = [
      { name: "runtime-initialized", passed: this.manager.isInitialized(), detail: this.manager.isInitialized() ? "ok" : "not initialized" },
    ];
    if (projectId && this.manager.isInitialized()) {
      const result = (await this.manager.getGeneration(projectId)) ?? (await this.manager.generateProductAudio(projectId));
      checks.push(
        { name: "voice-generation", passed: result.quality.voiceQualityScore >= 70 && Boolean(result.voice.persona), detail: `persona=${result.voice.persona}; score=${result.quality.voiceQualityScore}` },
        { name: "narration", passed: result.quality.narrationQualityScore >= 70 && result.narrationCues.length >= 4, detail: `cues=${result.narrationCues.length}` },
        { name: "music", passed: result.quality.musicQualityScore >= 70 && result.music.licensedOrGenerated === "generated-offline", detail: `style=${result.music.style}` },
        { name: "sound-effects", passed: result.quality.soundEffectsScore >= 70 && result.soundEffects.length >= 3, detail: `fx=${result.soundEffects.length}` },
        { name: "audio-mixing", passed: result.quality.mixBalanceScore >= 70 && result.mix.musicBelowNarration, detail: `voice=${result.mix.voiceVolume}; music=${result.mix.musicVolume}` },
        { name: "synchronization", passed: result.quality.synchronizationScore >= 70 && result.sync.problems.length === 0, detail: `sync=${result.quality.synchronizationScore}` },
        { name: "rendering-deferred", passed: result.renderingDeferred && result.creativePipelineStep === 8, detail: `step=${result.creativePipelineStep}` },
      );
    }
    const criticalIssues = checks.filter((check) => !check.passed).map((check) => check.name);
    return { healthy: criticalIssues.length === 0, checks, repaired: [], criticalIssues };
  }

  async repair(projectId?: string): Promise<ProductAudioGenerationHealthReport> {
    const repaired: string[] = [];
    if (!this.manager.isInitialized()) {
      return {
        healthy: false,
        checks: [{ name: "runtime-initialized", passed: false, detail: "Cannot repair uninitialized runtime" }],
        repaired,
        criticalIssues: ["runtime-initialized"],
      };
    }
    if (projectId) {
      this.manager["store"].generations = this.manager["store"].generations.filter((item) => item.projectId !== projectId);
      for (const [key, id] of Object.entries(this.manager["store"].cache)) {
        if (!this.manager["store"].generations.some((item) => item.generationId === id)) delete this.manager["store"].cache[key];
      }
      repaired.push("cleared-project-audio-cache");
      await this.manager.generateProductAudio(projectId);
      repaired.push("regenerated-product-audio");
    }
    await this.manager.persist();
    repaired.push("persisted-generations");
    const report = await this.check(projectId);
    return { ...report, repaired };
  }
}

function detectLanguage(storyboard: ProductStoryboardResult, orch: ProductPromptOrchestrationResult): string {
  const sample = `${storyboard.marketingScript.fullNarration} ${orch.scenePromptSets[0]?.prompts.voice ?? ""}`;
  if (/[àèéìòù]|ndetse|murakoze|yego/i.test(sample)) return "rw";
  return "en";
}

function enrichFromVoicePrompts(
  cues: SceneNarrationCue[],
  orch: ProductPromptOrchestrationResult,
): SceneNarrationCue[] {
  return cues.map((cue) => {
    const prompt = orch.scenePromptSets.find((set) => set.sceneNumber === cue.sceneNumber)?.prompts.voice ?? "";
    const quoted = prompt.match(/Voiceover:\s*"([^"]+)"/i)?.[1];
    if (quoted?.trim() && quoted.trim().length >= cue.text.length) {
      return { ...cue, text: quoted.trim() };
    }
    return cue;
  });
}
