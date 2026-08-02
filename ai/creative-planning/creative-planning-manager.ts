import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativeProject, ValidationResult } from "../creative-workspace/creative-workspace-manager.js";
import type { MarketingIntelligenceManager } from "../marketing-intelligence/marketing-intelligence-manager.js";
import type { DecisionIntelligenceManager } from "../decision-intelligence/decision-intelligence-manager.js";
import { ProjectState } from "../state-manager/types.js";

export interface PlanScene {
  id: string;
  order: number;
  durationSeconds: number;
  purpose: string;
  visual: string;
  narration: string;
  camera: string;
  lighting: string;
  composition: string;
  animation: string;
}

export interface CreativePlan {
  id: string;
  projectId: string;
  createdAt: string;
  modifiedAt: string;
  version: number;
  analyses: {
    product: string;
    brand: string;
    campaign: string;
    audience: string;
    platform: string;
    language: string;
  };
  creativeBrief: string;
  marketingStrategy: string;
  creativeStrategy: string;
  storyboard: string;
  script: string;
  scenes: PlanScene[];
  cameraPlan: string;
  lightingPlan: string;
  colourStyle: string;
  compositionGuide: string;
  animationPlan: string;
  prompts: { image: string; video: string; audio: string };
  workflow: string[];
}

export interface PlanResult {
  plan?: CreativePlan;
  validation: ValidationResult;
}

/**
 * Step 2 planning only: it creates editable production direction, never media,
 * rendering, encoding, export, or calls to generation foundations.
 */
export class CreativePlanningManager {
  private root = "";
  private core: AiCoreManager | null = null;
  private marketingIntelligence: MarketingIntelligenceManager | null = null;
  private decisionIntelligence: DecisionIntelligenceManager | null = null;

  async initialize(storageRoot: string, core?: AiCoreManager): Promise<void> {
    this.root = path.join(storageRoot, "creative-planning", "plans");
    this.core = core ?? null;
    await fs.mkdir(this.root, { recursive: true });
  }

  async getPlan(projectId: string): Promise<CreativePlan | null> {
    this.ensureInitialized();
    return this.readJson<CreativePlan | null>(this.planPath(projectId), null);
  }
  attachMarketingIntelligence(manager: MarketingIntelligenceManager): void { this.marketingIntelligence = manager; }
  attachDecisionIntelligence(manager: DecisionIntelligenceManager): void { this.decisionIntelligence = manager; }

  async createPlan(project: CreativeProject, validation: ValidationResult): Promise<PlanResult> {
    this.ensureInitialized();
    if (!validation.valid) return { validation };

    const existing = await this.getPlan(project.id);
    const now = new Date().toISOString();
    await this.decisionIntelligence?.decide(project.id, "pipeline");
    const marketing = await this.marketingIntelligence?.analyze(project.id);
    const plan = this.buildPlan(project, existing, now, marketing ?? undefined);
    this.transition(project.id, ProjectState.Modified);
    this.transition(project.id, ProjectState.Saving);
    await this.writeJson(this.planPath(project.id), plan);
    this.transition(project.id, ProjectState.Saved);
    return { plan, validation };
  }

  async updatePlan(projectId: string, changes: Partial<Omit<CreativePlan, "id" | "projectId" | "createdAt" | "modifiedAt" | "version">>): Promise<CreativePlan> {
    const current = await this.getPlan(projectId);
    if (!current) throw new Error("Generate a creative plan before editing it");
    const plan: CreativePlan = {
      ...current,
      ...changes,
      analyses: { ...current.analyses, ...changes.analyses },
      prompts: { ...current.prompts, ...changes.prompts },
      modifiedAt: new Date().toISOString(),
      version: current.version + 1,
    };
    this.transition(projectId, ProjectState.Modified);
    this.transition(projectId, ProjectState.Saving);
    await this.writeJson(this.planPath(projectId), plan);
    this.transition(projectId, ProjectState.Saved);
    return plan;
  }

  getIntegrationStatus(): Record<string, boolean> {
    return {
      aiCore: this.core !== null,
      memoryFoundation: Boolean(this.core?.memoryFoundation),
      knowledgeFoundation: Boolean(this.core?.knowledgeFoundation),
      productIntelligence: Boolean(this.core?.productIntelligenceFoundation),
      imageIntelligence: Boolean(this.core?.imageIntelligenceFoundation),
      marketingIntelligenceRuntime: Boolean(this.marketingIntelligence?.isInitialized()),
      decisionIntelligenceRuntime: Boolean(this.decisionIntelligence?.isInitialized()),
      videoIntelligence: Boolean(this.core?.videoIntelligenceFoundation),
      stateManager: Boolean(this.core?.stateManager),
    };
  }

  private buildPlan(project: CreativeProject, existing: CreativePlan | null, now: string, marketing?: { valueProposition: string; strategy: string; ctas: string[]; platform: { recommendations: string[] } }): CreativePlan {
    const product = project.productInformation;
    const brand = project.brandInformation;
    const campaign = project.campaignInformation;
    const platform = platformGuidance(project.platform);
    const hook = `${product.name}: ${campaign.objective}`;
    const scenes: PlanScene[] = [
      scene(1, 3, "Hook", `Open on ${product.name} solving a familiar ${product.category.toLowerCase()} need.`, `${hook}.`, "Macro detail, quick push-in", "High-contrast key light", "Product centered with negative space", "Subtle text and product motion"),
      scene(2, 6, "Product proof", `Show the defining product benefit: ${product.description}.`, `Made for ${project.targetAudience}.`, "Medium orbit", "Soft directional light", "Rule of thirds with detail cutaways", "Feature callouts animate in"),
      scene(3, 4, "Brand close", `Land the ${brand.name} point of view and next action.`, campaign.callToAction || `Discover ${product.name} today.`, "Hero close-up, gentle pull-back", "Warm rim light", "Clear logo-safe closing frame", "CTA resolves cleanly"),
    ];
    return {
      id: existing?.id ?? randomUUID(), projectId: project.id, createdAt: existing?.createdAt ?? now, modifiedAt: now, version: (existing?.version ?? 0) + 1,
      analyses: {
        product: `${product.name} is a ${product.category}: ${product.description}`,
        brand: `${brand.name}${brand.voice ? ` communicates with a ${brand.voice} voice` : " requires a consistent, recognizable voice"}.`,
        campaign: `${campaign.name} is focused on ${campaign.objective}.`,
        audience: `Primary audience: ${project.targetAudience}.`,
        platform: platform.analysis,
        language: `Use ${languageName(project.language)} for all on-screen and spoken planning copy.`,
      },
      creativeBrief: `Create a ${platform.tone} ${platform.format} for ${brand.name} that introduces ${product.name}, demonstrates ${product.description}, and advances ${campaign.objective}.${marketing ? ` Marketing value: ${marketing.valueProposition}` : ""}`,
      marketingStrategy: marketing?.strategy ?? `Lead with a problem-aware hook, demonstrate the benefit, then use ${campaign.callToAction || "a direct campaign call to action"} for ${project.targetAudience}.`,
      creativeStrategy: `${platform.pacing} Keep ${brand.name} visually consistent and make ${product.name} the unmistakable visual priority.`,
      storyboard: scenes.map((item) => `Scene ${item.order}: ${item.purpose} - ${item.visual}`).join("\n"),
      script: scenes.map((item) => `${item.order}. ${item.narration}`).join("\n"),
      scenes,
      cameraPlan: scenes.map((item) => `Scene ${item.order}: ${item.camera}`).join("\n"),
      lightingPlan: scenes.map((item) => `Scene ${item.order}: ${item.lighting}`).join("\n"),
      colourStyle: brand.guidelines || "Use the brand palette where available; otherwise use a balanced neutral base with one confident accent aligned to the campaign mood.",
      compositionGuide: scenes.map((item) => `Scene ${item.order}: ${item.composition}`).join("\n"),
      animationPlan: scenes.map((item) => `Scene ${item.order}: ${item.animation}`).join("\n"),
      prompts: {
        image: `${product.name}, ${product.category}, ${product.description}, ${brand.name} brand direction, ${platform.format}, product hero composition, ${project.targetAudience}, ${languageName(project.language)} campaign context${marketing ? `, ${marketing.valueProposition}` : ""}`,
        video: `${platform.format}; ${scenes.map((item) => item.visual).join(" Then ")}; ${platform.pacing.toLowerCase()}; end with ${marketing?.ctas[0] || campaign.callToAction || "a clear call to action"}.${marketing ? ` ${marketing.platform.recommendations[0]}` : ""}`,
        audio: `${languageName(project.language)} voice direction: ${brand.voice || "clear and confident"}. Pace: ${platform.pacing.toLowerCase()}. Script: ${scenes.map((item) => item.narration).join(" ")}`,
      },
      workflow: ["Confirm approved creative brief", "Prepare product image references", "Review storyboard and script", "Review camera, lighting, composition, colour, and animation plans", "Approve prompts for the later production pipeline"],
    };
  }

  private transition(projectId: string, state: ProjectState): void {
    this.core?.stateManager?.updateProjectState(projectId, state, { systemAction: "creative-planning", metadata: { source: "creative-planning" } });
  }

  private async readJson<T>(filePath: string, fallback: T): Promise<T> {
    try { return JSON.parse(await fs.readFile(filePath, "utf8")) as T; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
      throw new Error(`Unable to read creative plan: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async writeJson(filePath: string, value: unknown): Promise<void> {
    const temporary = `${filePath}.${createHash("sha1").update(randomUUID()).digest("hex")}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await fs.rename(temporary, filePath);
  }

  private ensureInitialized(): void { if (!this.root) throw new Error("Creative Planning Manager is not initialized"); }
  private planPath(projectId: string): string { return path.join(this.root, `${projectId}.json`); }
}

function scene(order: number, durationSeconds: number, purpose: string, visual: string, narration: string, camera: string, lighting: string, composition: string, animation: string): PlanScene {
  return { id: randomUUID(), order, durationSeconds, purpose, visual, narration, camera, lighting, composition, animation };
}

function languageName(language: string): string {
  return ({ en: "English", fr: "French", sw: "Swahili", rw: "Kinyarwanda" } as Record<string, string>)[language] ?? language;
}

function platformGuidance(platform: string): { format: string; tone: string; pacing: string; analysis: string } {
  const guidance: Record<string, { format: string; tone: string; pacing: string; analysis: string }> = {
    instagram: { format: "vertical social video", tone: "polished and human", pacing: "Use a fast first three seconds and concise benefit-led beats.", analysis: "Instagram prioritizes immediate visual impact, concise storytelling, and a clear saved/shared value proposition." },
    tiktok: { format: "vertical short-form video", tone: "direct and native", pacing: "Use a native-feeling hook and fast, honest demonstration.", analysis: "TikTok rewards fast hooks, authentic demonstrations, and direct conversational pacing." },
    facebook: { format: "social video", tone: "clear and trust-building", pacing: "Use clear benefits with readable messaging and a strong closing CTA.", analysis: "Facebook supports benefit-led storytelling that earns attention before the action request." },
    linkedin: { format: "professional social video", tone: "credible and considered", pacing: "Use a concise business-relevant hook and evidence-led value.", analysis: "LinkedIn responds to credible insight, professional presentation, and a clear strategic outcome." },
    youtube: { format: "video content", tone: "informative and engaging", pacing: "Open with value, then progress through a clear narrative arc.", analysis: "YouTube benefits from clear narrative structure, sustained value, and a memorable closing." },
  };
  return guidance[platform] ?? guidance.instagram;
}